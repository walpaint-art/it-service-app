const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { recalcOrderTotal, computeOrderTotals } = require('../lib/order-totals');
const { UPLOADS_DIR } = require('../lib/paths');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|avi|mkv|webm/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'), false);
  },
});

// Gerar número de OS
function generateOrderNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `OS-${y}${m}${d}-${rand}`;
}

// Listar ordens de serviço
router.get('/', (req, res) => {
  try {
    const { status, customer_id, technician_id, q, priority } = req.query;
    let sql = `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.whatsapp AS customer_whatsapp,
                      u.full_name AS technician_name
               FROM orders o
               LEFT JOIN customers c ON o.customer_id = c.id
               LEFT JOIN users u ON o.technician_id = u.id`;
    const params = [];
    const conditions = [];
    if (status) { conditions.push('o.status = ?'); params.push(status); }
    if (customer_id) { conditions.push('o.customer_id = ?'); params.push(customer_id); }
    if (technician_id) { conditions.push('o.technician_id = ?'); params.push(technician_id); }
    if (priority) { conditions.push('o.priority = ?'); params.push(priority); }
    if (q) {
      conditions.push('(o.order_number LIKE ? OR o.title LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY o.created_at DESC';
    const orders = db.prepare(sql).all(params);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obter uma OS completa com itens, serviços e mídias
router.get('/:id', (req, res) => {
  try {
    const order = db.prepare(
      `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.whatsapp AS customer_whatsapp,
              c.cnpj AS customer_cnpj, c.email AS customer_email, c.company AS customer_company,
              c.address AS customer_address, c.city AS customer_city, c.state AS customer_state,
              c.zip_code AS customer_zip, c.contact_name AS customer_contact,
              u.full_name AS technician_name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON o.technician_id = u.id
       WHERE o.id = ?`
    ).get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
    const services = db.prepare('SELECT * FROM order_services WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
    const media = db.prepare(
      `SELECT m.*, u.full_name AS uploaded_by_name FROM order_media m LEFT JOIN users u ON m.uploaded_by = u.id WHERE m.order_id = ? ORDER BY m.uploaded_at DESC`
    ).all(req.params.id);

    // Descontos automáticos das linhas riscadas (instaladas/executadas/não autorizadas)
    const totals = computeOrderTotals(order);

    res.json({
      ...order,
      items,
      services,
      media,
      discount_items: totals.itemsDiscount,
      discount_services: totals.servicesDiscount,
      total_calculated: totals.total,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Criar OS
router.post('/', (req, res) => {
  try {
    const {
      customer_id, technician_id, title, description, problem_report,
      status, priority, whatsapp_thread_id, total_value, discount,
      payment_status, scheduled_date, cost, expense, items = [], services = [],
    } = req.body;
    if (!customer_id || !title) {
      return res.status(400).json({ error: 'Cliente e título são obrigatórios' });
    }

    const orderNumber = generateOrderNumber();
    const info = db.prepare(
      `INSERT INTO orders (order_number, customer_id, technician_id, title, description, problem_report, status, priority,
       whatsapp_thread_id, total_value, discount, payment_status, scheduled_date, cost, expense)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderNumber, customer_id, technician_id || null, title, description, problem_report,
      status || 'orcamento', priority || 'media', whatsapp_thread_id || null,
      total_value || 0, discount || 0, payment_status || 'pendente', scheduled_date || null,
      cost || 0, expense || 0
    );
    const orderId = info.lastInsertRowid;

    // Inserir itens vinculados
    for (const it of items) {
      db.prepare(
        `INSERT INTO order_items (order_id, item_id, name, category, brand, model, serial_number, quantity, unit_price, authorized, installed, executed, notes, photos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        orderId, it.item_id || null, it.name, it.category, it.brand, it.model, it.serial_number,
        it.quantity || 1, it.unit_price || 0, it.authorized !== undefined ? (it.authorized ? 1 : 0) : 1,
        it.installed ? 1 : 0, it.executed ? 1 : 0, it.notes || '', JSON.stringify(it.photos || [])
      );
    }

    // Inserir serviços vinculados
    for (const sv of services) {
      db.prepare(
        `INSERT INTO order_services (order_id, service_id, name, category, description, quantity, unit_price, authorized, executed, notes, photos)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        orderId, sv.service_id || null, sv.name, sv.category, sv.description,
        sv.quantity || 1, sv.unit_price || 0, sv.authorized !== undefined ? (sv.authorized ? 1 : 0) : 1,
        sv.executed ? 1 : 0, sv.notes || '', JSON.stringify(sv.photos || [])
      );
    }

    // Total calculado a partir das linhas da OS
    recalcOrderTotal(orderId);

    res.status(201).json({ id: orderId, order_number: orderNumber, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar OS
router.put('/:id', (req, res) => {
  try {
    const {
      customer_id, technician_id, title, description, problem_report,
      status, priority, whatsapp_thread_id, total_value, discount,
      payment_status, scheduled_date, started_at, completed_at, cost, expense,
    } = req.body;
    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

    db.prepare(
      `UPDATE orders SET customer_id = ?, technician_id = ?, title = ?, description = ?, problem_report = ?,
       status = ?, priority = ?, whatsapp_thread_id = ?, total_value = ?, discount = ?,
       payment_status = ?, scheduled_date = ?, started_at = ?, completed_at = ?,
       cost = COALESCE(?, cost), expense = COALESCE(?, expense),
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      customer_id, technician_id || null, title, description, problem_report,
      status, priority, whatsapp_thread_id || null, total_value, discount,
      payment_status, scheduled_date || null, started_at || null, completed_at || null,
      cost === undefined ? null : Number(cost) || 0,
      expense === undefined ? null : Number(expense) || 0,
      req.params.id
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar apenas custos e despesas (uso interno, não aparece no rastreamento)
router.patch('/:id/financial', (req, res) => {
  try {
    const { cost, expense, discount } = req.body;
    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

    const toNumber = (value) => (value === undefined ? null : Number(value) || 0);
    db.prepare(
      `UPDATE orders SET cost = COALESCE(?, cost), expense = COALESCE(?, expense),
       discount = COALESCE(?, discount), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      toNumber(cost), toNumber(expense),
      discount === undefined ? null : Math.max(Number(discount) || 0, 0),
      req.params.id
    );

    if (discount !== undefined) recalcOrderTotal(req.params.id);

    const updated = db.prepare('SELECT total_value, discount FROM orders WHERE id = ?').get(req.params.id);
    res.json({ success: true, ...updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar status da OS
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status é obrigatório' });
    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });

    let extra = '';
    if (status === 'em_andamento' && !existing.started_at) extra = ', started_at = CURRENT_TIMESTAMP';
    if (status === 'concluido') extra = ', completed_at = CURRENT_TIMESTAMP';

    db.prepare(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP ${extra} WHERE id = ?`).run(status, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir OS
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM orders WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Ordem de serviço não encontrada' });
    db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar item à OS
router.post('/:id/items', (req, res) => {
  try {
    const { item_id, name, category, brand, model, serial_number, quantity, unit_price, authorized, installed, executed, notes, photos = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do item é obrigatório' });
    const info = db.prepare(
      `INSERT INTO order_items (order_id, item_id, name, category, brand, model, serial_number, quantity, unit_price, authorized, installed, executed, notes, photos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.params.id, item_id || null, name, category, brand, model, serial_number,
      quantity || 1, unit_price || 0, authorized !== undefined ? (authorized ? 1 : 0) : 1,
      installed ? 1 : 0, executed ? 1 : 0, notes || '', JSON.stringify(photos)
    );
    const item = db.prepare('SELECT * FROM order_items WHERE id = ?').get(info.lastInsertRowid);
    recalcOrderTotal(req.params.id);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Adicionar serviço à OS
router.post('/:id/services', (req, res) => {
  try {
    const { service_id, name, category, description, quantity, unit_price, authorized, executed, notes, photos = [] } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do serviço é obrigatório' });
    const info = db.prepare(
      `INSERT INTO order_services (order_id, service_id, name, category, description, quantity, unit_price, authorized, executed, notes, photos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      req.params.id, service_id || null, name, category, description,
      quantity || 1, unit_price || 0, authorized !== undefined ? (authorized ? 1 : 0) : 1,
      executed ? 1 : 0, notes || '', JSON.stringify(photos)
    );
    const sv = db.prepare('SELECT * FROM order_services WHERE id = ?').get(info.lastInsertRowid);
    recalcOrderTotal(req.params.id);
    res.status(201).json(sv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar item da OS
router.put('/items/:itemId', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM order_items WHERE id = ?').get(req.params.itemId);
    if (!existing) return res.status(404).json({ error: 'Item não encontrado' });

    const allowed = ['item_id', 'name', 'category', 'brand', 'model', 'serial_number', 'quantity', 'unit_price', 'authorized', 'installed', 'executed', 'paid', 'notes'];
    const data = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (data.name !== undefined && !String(data.name).trim()) {
      return res.status(400).json({ error: 'Nome do item é obrigatório' });
    }
    if (data.quantity !== undefined) data.quantity = Math.max(parseInt(data.quantity, 10) || 1, 1);
    if (data.unit_price !== undefined) data.unit_price = Math.max(Number(data.unit_price) || 0, 0);
    for (const flag of ['authorized', 'installed', 'executed', 'paid']) {
      if (data[flag] !== undefined) data[flag] = data[flag] ? 1 : 0;
    }

    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'Nada para atualizar' });

    db.prepare(
      `UPDATE order_items SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`
    ).run(...keys.map((k) => data[k]), existing.id);
    recalcOrderTotal(existing.order_id);

    res.json(db.prepare('SELECT * FROM order_items WHERE id = ?').get(existing.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Editar serviço da OS
router.put('/services/:svId', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM order_services WHERE id = ?').get(req.params.svId);
    if (!existing) return res.status(404).json({ error: 'Serviço não encontrado' });

    const allowed = ['service_id', 'name', 'category', 'description', 'quantity', 'unit_price', 'authorized', 'executed', 'paid', 'notes'];
    const data = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }
    if (data.name !== undefined && !String(data.name).trim()) {
      return res.status(400).json({ error: 'Nome do serviço é obrigatório' });
    }
    if (data.quantity !== undefined) data.quantity = Math.max(parseInt(data.quantity, 10) || 1, 1);
    if (data.unit_price !== undefined) data.unit_price = Math.max(Number(data.unit_price) || 0, 0);
    for (const flag of ['authorized', 'executed', 'paid']) {
      if (data[flag] !== undefined) data[flag] = data[flag] ? 1 : 0;
    }

    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'Nada para atualizar' });

    db.prepare(
      `UPDATE order_services SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`
    ).run(...keys.map((k) => data[k]), existing.id);
    recalcOrderTotal(existing.order_id);

    res.json(db.prepare('SELECT * FROM order_services WHERE id = ?').get(existing.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle autorizado/instalado/executado de um item
router.patch('/items/:itemId/toggle', (req, res) => {
  try {
    const { field } = req.body; // authorized, installed, executed, paid
    if (!field || !['authorized', 'installed', 'executed', 'paid'].includes(field)) {
      return res.status(400).json({ error: 'Campo inválido' });
    }
    const row = db.prepare(`SELECT id, order_id, ${field} FROM order_items WHERE id = ?`).get(req.params.itemId);
    if (!row) return res.status(404).json({ error: 'Item não encontrado' });
    const newVal = row[field] === 1 ? 0 : 1;
    db.prepare(`UPDATE order_items SET ${field} = ? WHERE id = ?`).run(newVal, req.params.itemId);
    // Item instalado/executado ou não autorizado sai do valor do orçamento
    const totals = recalcOrderTotal(row.order_id);
    res.json({ success: true, [field]: newVal, total_value: totals?.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle autorizado/executado de um serviço
router.patch('/services/:svId/toggle', (req, res) => {
  try {
    const { field } = req.body; // authorized, executed, paid
    if (!field || !['authorized', 'executed', 'paid'].includes(field)) {
      return res.status(400).json({ error: 'Campo inválido' });
    }
    const row = db.prepare(`SELECT id, order_id, ${field} FROM order_services WHERE id = ?`).get(req.params.svId);
    if (!row) return res.status(404).json({ error: 'Serviço não encontrado' });
    const newVal = row[field] === 1 ? 0 : 1;
    db.prepare(`UPDATE order_services SET ${field} = ? WHERE id = ?`).run(newVal, req.params.svId);
    // Serviço executado ou não autorizado sai do valor do orçamento
    const totals = recalcOrderTotal(row.order_id);
    res.json({ success: true, [field]: newVal, total_value: totals?.total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir item da OS
router.delete('/items/:itemId', (req, res) => {
  try {
    const row = db.prepare('SELECT id, order_id FROM order_items WHERE id = ?').get(req.params.itemId);
    if (!row) return res.status(404).json({ error: 'Item não encontrado' });
    db.prepare('DELETE FROM order_items WHERE id = ?').run(req.params.itemId);
    recalcOrderTotal(row.order_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir serviço da OS
router.delete('/services/:svId', (req, res) => {
  try {
    const row = db.prepare('SELECT id, order_id FROM order_services WHERE id = ?').get(req.params.svId);
    if (!row) return res.status(404).json({ error: 'Serviço não encontrado' });
    db.prepare('DELETE FROM order_services WHERE id = ?').run(req.params.svId);
    recalcOrderTotal(row.order_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload de mídia (foto/vídeo) para acompanhamento da OS
router.post('/:id/media', upload.array('files', 20), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    const orderId = req.params.id;
    const uploadedBy = req.user ? req.user.id : null;
    const inserted = [];
    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase();
      const isVideo = ['.mp4', '.mov', '.avi', '.mkv', '.webm'].includes(ext);
      const type = isVideo ? 'video' : 'photo';
      const info = db.prepare(
        `INSERT INTO order_media (order_id, type, file_path, caption, uploaded_by)
         VALUES (?, ?, ?, ?, ?)`
      ).run(orderId, type, `/uploads/${file.filename}`, file.originalname, uploadedBy);
      inserted.push({ id: info.lastInsertRowid, type, file_path: `/uploads/${file.filename}` });
    }
    res.status(201).json({ media: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Excluir mídia
router.delete('/media/:mediaId', (req, res) => {
  try {
    const media = db.prepare('SELECT file_path FROM order_media WHERE id = ?').get(req.params.mediaId);
    if (!media) return res.status(404).json({ error: 'Mídia não encontrada' });
    const filePath = path.join(UPLOADS_DIR, path.basename(media.file_path));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    db.prepare('DELETE FROM order_media WHERE id = ?').run(req.params.mediaId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Estatísticas do dashboard
router.get('/stats/summary', (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const byStatus = db.prepare(
      `SELECT status, COUNT(*) as c FROM orders GROUP BY status`
    ).all();
    const byPriority = db.prepare(
      `SELECT priority, COUNT(*) as c FROM orders GROUP BY priority`
    ).all();
    const totalValue = db.prepare('SELECT COALESCE(SUM(total_value), 0) as total FROM orders').get().total;
    const totalCost = db.prepare('SELECT COALESCE(SUM(cost), 0) as total FROM orders').get().total;
    const totalExpense = db.prepare('SELECT COALESCE(SUM(expense), 0) as total FROM orders').get().total;
    const pendentes = db.prepare("SELECT COUNT(*) as c FROM orders WHERE payment_status = 'pendente'").get().c;
    res.json({
      totalOrders, byStatus, byPriority, totalValue, pendentes,
      totalCost, totalExpense, totalProfit: Number(totalValue) - Number(totalCost) - Number(totalExpense),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
