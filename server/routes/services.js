const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Listar serviços
router.get('/', (req, res) => {
  try {
    const { category, active } = req.query;
    let sql = 'SELECT * FROM services';
    const params = [];
    const conditions = [];
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (active !== undefined) {
      conditions.push('active = ?');
      params.push(active === 'true' ? 1 : 0);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY name ASC';
    const services = db.prepare(sql).all(params);
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter serviço por ID
router.get('/:id', (req, res) => {
  try {
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar serviço
router.post('/', (req, res) => {
  try {
    const { name, category, description, price, duration_minutes, active } = req.body;
    if (!name || !category) {
      return res.status(400).json({ error: 'Nome e categoria são obrigatórios' });
    }
    const info = db.prepare(
      `INSERT INTO services (name, category, description, price, duration_minutes, active)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(name, category, description, price || 0, duration_minutes || 60, active !== undefined ? (active ? 1 : 0) : 1);
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar serviço
router.put('/:id', (req, res) => {
  try {
    const { name, category, description, price, duration_minutes, active } = req.body;
    const existing = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });
    db.prepare(
      `UPDATE services SET name = ?, category = ?, description = ?, price = ?,
       duration_minutes = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(name, category, description, price, duration_minutes, active !== undefined ? (active ? 1 : 0) : 1, req.params.id);
    const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir serviço
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM services WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });
    db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
