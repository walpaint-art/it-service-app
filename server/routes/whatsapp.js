const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { authenticate } = require('../middleware/auth');

// Enviar mensagem WhatsApp (simulação - gera link wa.me)
router.post('/send', authenticate, (req, res) => {
  try {
    const { order_id, customer_id, phone, message } = req.body;
    if (!phone && !customer_id) {
      return res.status(400).json({ error: 'Telefone ou cliente é obrigatório' });
    }

    let targetPhone = phone;
    let targetCustomer = null;
    if (customer_id) {
      targetCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customer_id);
      if (!targetCustomer) return res.status(404).json({ error: 'Cliente não encontrado' });
      targetPhone = targetCustomer.whatsapp || targetCustomer.phone;
    }
    if (!targetPhone) return res.status(400).json({ error: 'Cliente não possui telefone/WhatsApp cadastrado' });

    // Limpar telefone (apenas dígitos)
    const cleanPhone = String(targetPhone).replace(/\D/g, '');

    // Gerar link do WhatsApp
    const encodedMessage = encodeURIComponent(message || '');
    const waLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    // Registrar mensagem
    let orderId = null;
    if (order_id) {
      const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(order_id);
      if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
      orderId = order_id;
    }

    const info = db.prepare(
      `INSERT INTO whatsapp_messages (order_id, customer_id, direction, message, status)
       VALUES (?, ?, 'outbound', ?, 'sent')`
    ).run(orderId, customer_id || null, message || '');

    res.json({
      success: true,
      wa_link: waLink,
      phone: cleanPhone,
      message: message || '',
      message_id: info.lastInsertRowid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar mensagens WhatsApp
router.get('/', authenticate, (req, res) => {
  try {
    const { order_id, customer_id } = req.query;
    let sql = `SELECT wm.*, c.name AS customer_name FROM whatsapp_messages wm
               LEFT JOIN customers c ON wm.customer_id = c.id`;
    const params = [];
    const conditions = [];
    if (order_id) { conditions.push('wm.order_id = ?'); params.push(order_id); }
    if (customer_id) { conditions.push('wm.customer_id = ?'); params.push(customer_id); }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY wm.sent_at DESC';
    const messages = db.prepare(sql).all(params);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gerar link de acompanhamento público da OS (para o cliente ver fotos/vídeos)
router.get('/tracking/:orderNumber', (req, res) => {
  try {
    const order = db.prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.whatsapp AS customer_whatsapp
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id WHERE o.order_number = ?`
    ).get(req.params.orderNumber);
    if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
    const services = db.prepare('SELECT * FROM order_services WHERE order_id = ? ORDER BY created_at ASC').all(order.id);
    const media = db.prepare(
      `SELECT * FROM order_media WHERE order_id = ? ORDER BY uploaded_at DESC`
    ).all(order.id);

    // Identidade visual da empresa para a página pública
    const configRows = db.prepare('SELECT key, value FROM config').all();
    const config = Object.fromEntries(configRows.map((row) => [row.key, row.value]));
    const owner = db.prepare('SELECT company_name, whatsapp_number, phone, logo_path FROM users ORDER BY id ASC LIMIT 1').get();

    const company = {
      name: owner?.company_name || config.app_name || 'Assistência Técnica TI',
      app_name: config.app_name || 'Assistência Técnica TI',
      logo: config.company_logo || owner?.logo_path || '',
      whatsapp: config.whatsapp_number || owner?.whatsapp_number || owner?.phone || '',
    };

    // Dados internos de custo/despesa nunca vão para o link público
    const { cost, expense, ...publicOrder } = order;

    res.json({ order: publicOrder, items, services, media, company });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
