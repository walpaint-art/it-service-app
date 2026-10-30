const express = require('express');
const { db } = require('../db');

const router = express.Router();

// Listar clientes (com busca opcional)
router.get('/', (req, res) => {
  try {
    const { q } = req.query;
    let sql = 'SELECT * FROM customers';
    const params = [];
    if (q) {
      sql += ' WHERE name LIKE ? OR phone LIKE ? OR whatsapp LIKE ? OR company LIKE ?';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    sql += ' ORDER BY name ASC';
    const customers = db.prepare(sql).all(params);
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter um cliente por ID
router.get('/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Cliente não encontrado' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar cliente
router.post('/', (req, res) => {
  try {
    const {
      name, contact_name, phone, whatsapp, email, company, cnpj,
      address, city, state, zip_code, notes,
    } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
    }
    const info = db.prepare(
      `INSERT INTO customers (name, contact_name, phone, whatsapp, email, company, cnpj, address, city, state, zip_code, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(name, contact_name, phone, whatsapp, email, company, cnpj, address, city, state, zip_code, notes);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar cliente
router.put('/:id', (req, res) => {
  try {
    const {
      name, contact_name, phone, whatsapp, email, company, cnpj,
      address, city, state, zip_code, notes,
    } = req.body;
    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });
    db.prepare(
      `UPDATE customers SET name = ?, contact_name = ?, phone = ?, whatsapp = ?, email = ?,
       company = ?, cnpj = ?, address = ?, city = ?, state = ?, zip_code = ?, notes = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(name, contact_name, phone, whatsapp, email, company, cnpj, address, city, state, zip_code, notes, req.params.id);
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    res.json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir cliente
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Cliente não encontrado' });
    db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
