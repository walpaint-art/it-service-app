const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DB_PATH, UPLOADS_DIR } = require('./paths');

// Backup automático do banco/uploads num repositório privado do GitHub.
// Ativado apenas quando as variáveis abaixo existem (no Render).
const TOKEN = (process.env.GITHUB_STORE_TOKEN || '').trim();
const REPO = (process.env.GITHUB_STORE_REPO || '').trim(); // "usuario/repositorio"
const BRANCH = (process.env.GITHUB_STORE_BRANCH || 'main').trim();
const MAX_FILE_BYTES = Number(process.env.GITHUB_STORE_MAX_MB || 45) * 1024 * 1024;
const DEBOUNCE_MS = Number(process.env.GITHUB_STORE_DEBOUNCE_MS || 15000);

const ENABLED = Boolean(TOKEN && REPO);
const API = 'https://api.github.com';

let ready = false; // só grava no remoto depois de tentar restaurar
let timer = null;
let running = false;
let pending = false;

function enabled() {
  return ENABLED;
}

async function gh(method, endpoint, body) {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'it-service-app',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`GitHub ${method} ${endpoint} -> ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

function gitBlobSha(buffer) {
  const hash = crypto.createHash('sha1');
  hash.update(`blob ${buffer.length}\0`);
  hash.update(buffer);
  return hash.digest('hex');
}

// Lista o conteúdo atual do repositório de backup (null quando ainda está vazio)
async function getSnapshot() {
  let commitSha;
  try {
    const ref = await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
    commitSha = ref.object.sha;
  } catch (err) {
    if (err.status === 404 || err.status === 409) return null;
    throw err;
  }
  const commit = await gh('GET', `/repos/${REPO}/git/commits/${commitSha}`);
  const tree = await gh('GET', `/repos/${REPO}/git/trees/${commit.tree.sha}?recursive=1`);
  const files = new Map();
  for (const entry of tree.tree || []) {
    if (entry.type === 'blob') files.set(entry.path, entry);
  }
  return { commitSha, treeSha: commit.tree.sha, files };
}

async function downloadBlob(sha) {
  const blob = await gh('GET', `/repos/${REPO}/git/blobs/${sha}`);
  const raw = (blob.content || '').replace(/\n/g, '');
  return Buffer.from(raw, blob.encoding === 'base64' ? 'base64' : 'utf8');
}

// Restaura banco e uploads que estiverem faltando no disco local
async function restore() {
  if (!ENABLED) {
    ready = true;
    return { restored: 0, skipped: 'disabled' };
  }
  const snapshot = await getSnapshot();
  if (!snapshot) {
    console.log('Backup remoto vazio: iniciando com o secret file.');
    ready = true;
    return { restored: 0, empty: true };
  }

  let restored = 0;

  if (!fs.existsSync(DB_PATH) && snapshot.files.has('database.sqlite')) {
    const data = await downloadBlob(snapshot.files.get('database.sqlite').sha);
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, data);
    restored += 1;
    console.log('Banco restaurado do backup remoto do GitHub.');
  }

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const [remotePath, entry] of snapshot.files) {
    if (!remotePath.startsWith('uploads/')) continue;
    const target = path.join(UPLOADS_DIR, path.basename(remotePath));
    if (fs.existsSync(target)) continue;
    const data = await downloadBlob(entry.sha);
    fs.writeFileSync(target, data);
    restored += 1;
  }

  ready = true;
  if (restored) console.log(`Backup remoto: ${restored} arquivo(s) restaurado(s).`);
  return { restored };
}

function collectLocal() {
  const files = new Map();
  if (fs.existsSync(DB_PATH)) files.set('database.sqlite', fs.readFileSync(DB_PATH));
  if (fs.existsSync(UPLOADS_DIR)) {
    for (const name of fs.readdirSync(UPLOADS_DIR)) {
      const full = path.join(UPLOADS_DIR, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      if (stat.size > MAX_FILE_BYTES) {
        console.warn(`Backup remoto: ignorando ${name} (${Math.round(stat.size / 1048576)} MB > limite).`);
        continue;
      }
      files.set(`uploads/${name}`, fs.readFileSync(full));
    }
  }
  return files;
}

// Envia um commit único com todas as diferenças (inclusões e remoções)
async function persist() {
  const snapshot = await getSnapshot();
  const local = collectLocal();

  // Repositório ainda vazio: a API de blobs não funciona, cria os arquivos via Contents API
  if (!snapshot) {
    let created = 0;
    for (const [filePath, buffer] of local) {
      await gh('PUT', `/repos/${REPO}/contents/${filePath}`, {
        message: `backup inicial: ${filePath}`,
        content: buffer.toString('base64'),
        branch: BRANCH,
      });
      created += 1;
    }
    console.log(`Backup remoto iniciado (${created} arquivo(s)).`);
    return { changed: created > 0, files: created };
  }

  const entries = [];

  for (const [filePath, buffer] of local) {
    const remote = snapshot.files.get(filePath);
    if (remote && remote.sha === gitBlobSha(buffer)) continue;
    const blob = await gh('POST', `/repos/${REPO}/git/blobs`, {
      content: buffer.toString('base64'),
      encoding: 'base64',
    });
    entries.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
  }

  for (const remotePath of snapshot.files.keys()) {
    if (remotePath !== 'database.sqlite' && !remotePath.startsWith('uploads/')) continue;
    if (local.has(remotePath)) continue;
    entries.push({ path: remotePath, mode: '100644', type: 'blob', sha: null });
  }

  if (!entries.length) return { changed: false };

  const tree = await gh('POST', `/repos/${REPO}/git/trees`, {
    base_tree: snapshot.treeSha,
    tree: entries,
  });

  const commit = await gh('POST', `/repos/${REPO}/git/commits`, {
    message: `backup ${new Date().toISOString()}`,
    tree: tree.sha,
    parents: [snapshot.commitSha],
  });

  await gh('PATCH', `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true });

  console.log(`Backup remoto atualizado (${entries.length} arquivo(s)).`);
  return { changed: true, files: entries.length };
}

async function flush() {
  if (!ENABLED || !ready || running) {
    if (running) pending = true;
    return;
  }
  running = true;
  try {
    await persist();
  } catch (err) {
    console.error('Falha no backup remoto:', err.message);
  } finally {
    running = false;
    if (pending) {
      pending = false;
      schedule(1000);
    }
  }
}

// Agenda um envio (agrupa várias gravações seguidas)
function schedule(delay = DEBOUNCE_MS) {
  if (!ENABLED || !ready) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, delay);
  if (typeof timer.unref === 'function') timer.unref();
}

async function shutdown() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await flush();
}

module.exports = { enabled, restore, schedule, flush, shutdown, persist };
