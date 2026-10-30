const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authenticate, generateToken } = require('../middleware/auth');

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        company_name: user.company_name,
        company_cnpj: user.company_cnpj,
        email: user.email,
        phone: user.phone,
        whatsapp_number: user.whatsapp_number,
        address: user.address,
        logo_path: user.logo_path,
        theme: user.theme,
        primary_color: user.primary_color,
        secondary_color: user.secondary_color,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Perfil do usuário logado
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  res.json({
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    company_name: user.company_name,
    company_cnpj: user.company_cnpj,
    email: user.email,
    phone: user.phone,
    whatsapp_number: user.whatsapp_number,
    address: user.address,
    logo_path: user.logo_path,
    theme: user.theme,
    primary_color: user.primary_color,
    secondary_color: user.secondary_color,
  });
});

// Atualizar perfil
router.put('/me', authenticate, (req, res) => {
  try {
    const {
      full_name, company_name, company_cnpj, email, phone,
      whatsapp_number, address, theme, primary_color, secondary_color,
    } = req.body;
    db.prepare(
      `UPDATE users SET full_name = ?, company_name = ?, company_cnpj = ?, email = ?,
       phone = ?, whatsapp_number = ?, address = ?, theme = ?, primary_color = ?,
       secondary_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      full_name, company_name, company_cnpj, email, phone,
      whatsapp_number, address, theme, primary_color, secondary_color, req.user.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alterar senha
router.post('/change-password', authenticate, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(current_password, user.password_hash)) {
      return res.status(401).json({ error: 'Senha atual inválida' });
    }
    const hash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hash, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload de logo da empresa
router.post('/upload-logo', authenticate, (req, res) => {
  res.json({ success: true, message: 'Use o endpoint /api/config/upload-logo' });
});

module.exports = router;
