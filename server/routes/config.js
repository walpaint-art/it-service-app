const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { UPLOADS_DIR } = require('../lib/paths');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}-${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Apenas imagens são permitidas para o logo'), false);
  },
});

// Listar todas as configurações
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM config ORDER BY key ASC').all();
    const config = {};
    for (const row of rows) config[row.key] = row.value;
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter uma configuração específica
router.get('/:key', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM config WHERE key = ?').get(req.params.key);
    if (!row) return res.status(404).json({ error: 'Configuração não encontrada' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar configuração
router.put('/:key', (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ error: 'Valor é obrigatório' });
    const existing = db.prepare('SELECT id FROM config WHERE key = ?').get(req.params.key);
    if (!existing) {
      db.prepare('INSERT INTO config (key, value) VALUES (?, ?)').run(req.params.key, value);
    } else {
      db.prepare('UPDATE config SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(value, req.params.key);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload de logo da empresa
router.post('/upload-logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhuma imagem enviada' });
    const logoPath = `/uploads/${req.file.filename}`;
    db.prepare(
      `INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    ).run('company_logo', logoPath);
    // Também atualiza no usuário admin se existir
    const admin = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
    if (admin) {
      db.prepare('UPDATE users SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(logoPath, admin.id);
    }
    res.json({ success: true, logo_path: logoPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remover logo
router.delete('/logo', (req, res) => {
  try {
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get('company_logo');
    if (row && row.value) {
      const filePath = path.join(UPLOADS_DIR, path.basename(row.value));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare('UPDATE config SET value = NULL, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run('company_logo');
    db.prepare('UPDATE users SET logo_path = NULL, updated_at = CURRENT_TIMESTAMP').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
