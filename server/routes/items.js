const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Listar itens (com filtro opcional por cliente e categoria)
router.get('/', (req, res) => {
  try {
    const { customer_id, category, q } = req.query;
    let sql = 'SELECT i.*, c.name AS customer_name FROM items i LEFT JOIN customers c ON i.customer_id = c.id';
    const params = [];
    const conditions = [];
    if (customer_id) {
      conditions.push('i.customer_id = ?');
      params.push(customer_id);
    }
    if (category) {
      conditions.push('i.category = ?');
      params.push(category);
    }
    if (q) {
      conditions.push('(i.name LIKE ? OR i.brand LIKE ? OR i.model LIKE ? OR i.serial_number LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY i.name ASC';
    const items = db.prepare(sql).all(params);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter um item por ID
router.get('/:id', (req, res) => {
  try {
    const item = db.prepare(
      'SELECT i.*, c.name AS customer_name FROM items i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.id = ?'
    ).get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar item
router.post('/', (req, res) => {
  try {
    const {
      customer_id, name, category, brand, model, serial_number,
      ip_address, mac_address, purchase_date, warranty, location, notes, status,
    } = req.body;
    if (!customer_id || !name || !category) {
      return res.status(400).json({ error: 'Cliente, nome e categoria são obrigatórios' });
    }
    const info = db.prepare(
      `INSERT INTO items (customer_id, name, category, brand, model, serial_number, ip_address, mac_address, purchase_date, warranty, location, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(customer_id, name, category, brand, model, serial_number, ip_address, mac_address, purchase_date, warranty, location, notes, status || 'ativo');
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar item
router.put('/:id', (req, res) => {
  try {
    const {
      name, category, brand, model, serial_number, ip_address, mac_address,
      purchase_date, warranty, location, notes, status,
    } = req.body;
    const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Item não encontrado' });
    db.prepare(
      `UPDATE items SET name = ?, category = ?, brand = ?, model = ?, serial_number = ?,
       ip_address = ?, mac_address = ?, purchase_date = ?, warranty = ?, location = ?,
       notes = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(name, category, brand, model, serial_number, ip_address, mac_address, purchase_date, warranty, location, notes, status, req.params.id);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir item
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Item não encontrado' });
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
