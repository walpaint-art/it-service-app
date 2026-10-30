const path = require('path');

// Caminhos configuráveis por ambiente (Render usa disco persistente em /var/data)
const ROOT_DIR = path.join(__dirname, '..');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(ROOT_DIR, 'database.sqlite');

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(ROOT_DIR, 'uploads');

// Banco e uploads empacotados junto com a aplicação, usados apenas para semear um disco vazio
const SEED_DB_PATH = path.join(ROOT_DIR, 'database.sqlite');
const SEED_UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

// Secret file do Render com o banco em base64 (não fica no repositório)
const SEED_DB_B64_PATH = process.env.SEED_DB_B64_PATH || '/etc/secrets/database.seed.b64';

module.exports = {
  ROOT_DIR,
  DB_PATH,
  UPLOADS_DIR,
  SEED_DB_PATH,
  SEED_UPLOADS_DIR,
  SEED_DB_B64_PATH,
};
