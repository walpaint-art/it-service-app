const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const { DB_PATH, SEED_DB_PATH, SEED_DB_B64_PATH } = require('./lib/paths');
const remoteStore = require('./lib/remote-store');

const dbPath = DB_PATH;

let db = null;
let readyPromise = null;

function findWasm() {
  const candidates = [
    path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.join(__dirname, 'node_modules', 'sql.js', 'sql-wasm.wasm'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('sql-wasm.wasm não encontrado em node_modules/sql.js');
}

// Normaliza valores para os tipos aceitos pelo SQLite (undefined não é aceito)
function normalizeParams(params) {
  return params.map((value) => {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    if (value !== null && typeof value === 'object') return JSON.stringify(value);
    return value;
  });
}

// Aceita tanto run(sql, [a, b]) quanto run(sql, a, b)
function toParamArray(args) {
  if (args.length === 1 && Array.isArray(args[0])) return normalizeParams(args[0]);
  return normalizeParams(args);
}

function saveDbToFile() {
  if (!db) return;
  const data = Buffer.from(db.export());
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const tmpPath = `${dbPath}.tmp`;
  fs.writeFileSync(tmpPath, data);
  fs.renameSync(tmpPath, dbPath);
  remoteStore.schedule();
}

function rawAll(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(normalizeParams(params));
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function rawGet(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(normalizeParams(params));
    if (!stmt.step()) return undefined;
    return stmt.getAsObject();
  } finally {
    stmt.free();
  }
}

function rawRun(sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(normalizeParams(params));
    stmt.step();
  } finally {
    stmt.free();
  }
  const changes = db.getRowsModified();
  const row = rawGet('SELECT last_insert_rowid() AS id');
  saveDbToFile();
  return { changes, lastInsertRowid: row ? row.id : 0 };
}

// API compatível com better-sqlite3, usada pelas rotas
const compatDb = {
  prepare(sql) {
    return {
      get: (...args) => rawGet(sql, toParamArray(args)),
      all: (...args) => rawAll(sql, toParamArray(args)),
      run: (...args) => rawRun(sql, toParamArray(args)),
    };
  },
  get: (sql, ...args) => rawGet(sql, toParamArray(args)),
  all: (sql, ...args) => rawAll(sql, toParamArray(args)),
  run: (sql, ...args) => rawRun(sql, toParamArray(args)),
};

function createSchema() {
  const creates = [    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, full_name TEXT, role TEXT DEFAULT 'tecnico',
      company_name TEXT, company_cnpj TEXT, email TEXT, phone TEXT,
      whatsapp_number TEXT, address TEXT, logo_path TEXT, theme TEXT DEFAULT 'light',
      primary_color TEXT DEFAULT '#3b82f6', secondary_color TEXT DEFAULT '#10b981',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact_name TEXT,
      phone TEXT NOT NULL, whatsapp TEXT, email TEXT, company TEXT, cnpj TEXT,
      address TEXT, city TEXT, state TEXT, zip_code TEXT, notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL,
      name TEXT NOT NULL, category TEXT NOT NULL, brand TEXT, model TEXT,
      serial_number TEXT, ip_address TEXT, mac_address TEXT, purchase_date TEXT,
      warranty TEXT, location TEXT, notes TEXT, status TEXT DEFAULT 'ativo',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT, price REAL DEFAULT 0, duration_minutes INTEGER DEFAULT 60,
      active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_number TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL, technician_id INTEGER, title TEXT NOT NULL,
      description TEXT, problem_report TEXT, status TEXT DEFAULT 'orcamento',
      priority TEXT DEFAULT 'media', whatsapp_thread_id TEXT, total_value REAL DEFAULT 0,
      discount REAL DEFAULT 0, payment_status TEXT DEFAULT 'pendente',
      cost REAL DEFAULT 0, expense REAL DEFAULT 0,
      scheduled_date TEXT, started_at TEXT, completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (technician_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, item_id INTEGER,
      name TEXT NOT NULL, category TEXT, brand TEXT, model TEXT, serial_number TEXT,
      quantity INTEGER DEFAULT 1, unit_price REAL DEFAULT 0, authorized INTEGER DEFAULT 1,
      installed INTEGER DEFAULT 0, executed INTEGER DEFAULT 0, notes TEXT,
      photos TEXT DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL)`,
    `CREATE TABLE IF NOT EXISTS order_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, service_id INTEGER,
      name TEXT NOT NULL, category TEXT, description TEXT, quantity INTEGER DEFAULT 1,
      unit_price REAL DEFAULT 0, authorized INTEGER DEFAULT 1, executed INTEGER DEFAULT 0,
      notes TEXT, photos TEXT DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL)`,
    `CREATE TABLE IF NOT EXISTS order_media (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, type TEXT NOT NULL,
      file_path TEXT NOT NULL, caption TEXT, uploaded_by INTEGER,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL)`,
    `CREATE TABLE IF NOT EXISTS whatsapp_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, customer_id INTEGER,
      direction TEXT NOT NULL, message TEXT, media_path TEXT,
      status TEXT DEFAULT 'sent', sent_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL)`,
    `CREATE TABLE IF NOT EXISTS config (
      id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL,
      value TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
  ];
  for (const sql of creates) db.run(sql);
}

// Adiciona colunas novas em bancos criados por versões anteriores
function migrateSchema() {
  const migrations = {
    orders: {
      cost: 'REAL DEFAULT 0',
      expense: 'REAL DEFAULT 0',
    },
    order_items: {
      paid: 'INTEGER DEFAULT 0',
    },
    order_services: {
      paid: 'INTEGER DEFAULT 0',
    },
  };

  for (const [table, columns] of Object.entries(migrations)) {
    const existing = rawAll(`PRAGMA table_info(${table})`).map((column) => column.name);
    for (const [name, definition] of Object.entries(columns)) {
      if (existing.includes(name)) continue;
      db.run(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
      console.log(`Migração aplicada: ${table}.${name}`);
    }
  }
}

function seedDefaultData() {
  // Só cria o admin inicial quando não existe nenhum usuário (instalação nova)
  const userCount = rawGet('SELECT COUNT(*) AS c FROM users');
  if (!userCount || userCount.c === 0) {
    const initialPassword =
      process.env.INITIAL_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
    const hash = bcrypt.hashSync(initialPassword, 10);
    rawRun(
      `INSERT INTO users (username, password_hash, full_name, role, company_name, whatsapp_number, theme)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ['admin', hash, 'Técnico Informática', 'admin', 'Sua Empresa TI', '', 'light']
    );
    console.log(`Usuário "admin" criado. Senha inicial: ${initialPassword}`);
  }

  const serviceCount = rawGet('SELECT COUNT(*) AS c FROM services');
  if (!serviceCount || serviceCount.c === 0) {
    const svs = [
      ['Manutenção de Computador', 'computador', 'Limpeza, pasta térmica, revisão HW/SW', 150, 120],
      ['Instalação e Configuração de Rede', 'rede', 'Cabeamento, roteador, switch, IP e Wi-Fi', 300, 180],
      ['Manutenção de Servidor', 'servidor', 'Revisão, backup, atualizações e monitoramento', 500, 240],
      ['Instalação de Câmeras IP', 'camera_ip', 'Instalação e configuração de câmeras IP', 250, 180],
      ['Configuração de NVR', 'nvr', 'Instalação e configuração de gravador NVR', 200, 120],
      ['Instalação de Sistemas', 'sistema', 'Instalação e configuração de sistemas/apps', 180, 150],
      ['Suporte Remoto', 'outro', 'Atendimento remoto via desktop/compartilhamento de tela', 100, 60],
    ];
    for (const s of svs) {
      rawRun(
        'INSERT INTO services (name, category, description, price, duration_minutes) VALUES (?, ?, ?, ?, ?)',
        s
      );
    }
  }

  const defaults = [
    ['app_name', 'Assistência Técnica TI'],
    ['company_logo', ''],
    ['whatsapp_number', ''],
    ['whatsapp_message', 'Olá! Este é o atendimento técnico da sua empresa de informática.'],
    ['allow_client_upload', '1'],
    ['currency', 'BRL'],
    ['language', 'pt-BR'],
    ['date_format', 'dd/MM/yyyy'],
    ['time_format', 'HH:mm'],
    ['require_whatsapp_login', '0'],
    ['auto_send_status_update', '1'],
    ['photo_max_size_mb', '10'],
    ['video_max_size_mb', '50'],
    ['enable_dark_theme', '1'],
    ['enable_custom_logo', '1'],
  ];
  for (const [key, value] of defaults) {
    rawRun('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)', [key, value]);
  }
}

function init() {
  if (readyPromise) return readyPromise;
  readyPromise = initSqlJs({ wasmBinary: fs.readFileSync(findWasm()) })
    .then((SQL) => {
      // Primeira execução: semeia o banco a partir do secret file (base64) ou do arquivo empacotado
      if (!fs.existsSync(dbPath)) {
        if (fs.existsSync(SEED_DB_B64_PATH)) {
          const encoded = fs.readFileSync(SEED_DB_B64_PATH, 'utf8').trim();
          const seeded = Buffer.from(encoded, 'base64');
          if (seeded.length) {
            fs.mkdirSync(path.dirname(dbPath), { recursive: true });
            fs.writeFileSync(dbPath, seeded);
            console.log('Banco inicial carregado do secret file do Render.');
          }
        } else if (dbPath !== SEED_DB_PATH && fs.existsSync(SEED_DB_PATH)) {
          fs.mkdirSync(path.dirname(dbPath), { recursive: true });
          fs.copyFileSync(SEED_DB_PATH, dbPath);
        }
      }

      let data = null;
      if (fs.existsSync(dbPath)) {
        try {
          data = fs.readFileSync(dbPath);
        } catch (err) {
          console.warn('Não foi possível ler o banco existente, criando um novo:', err.message);
        }
      }
      db = data && data.length ? new SQL.Database(data) : new SQL.Database();
      db.run('PRAGMA foreign_keys = ON');
      createSchema();
      migrateSchema();
      seedDefaultData();
      saveDbToFile();
      return db;
    })
    .catch((err) => {
      readyPromise = null;
      throw err;
    });
  return readyPromise;
}

module.exports = {
  init,
  db: compatDb,
  saveDbToFile,
  isReady: () => db !== null,
};
