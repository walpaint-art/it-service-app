/**
 * Importa dados de recibos/planilhas (JSON) para o banco do sistema.
 *
 * Uso:
 *   node scripts/import-data.js imports/REC-2026-450.json
 *
 * O arquivo JSON pode conter:
 *   { customer, items[], services[], order }
 * - customer: criado ou atualizado (casado por CNPJ ou nome)
 * - items: equipamentos do cliente (casados por cliente + nome)
 * - services: catálogo de serviços (casados por nome)
 * - order: OS com itens/serviços (casada por order_number); reimportar substitui as linhas
 *
 * A operação é idempotente: rodar o mesmo arquivo duas vezes não duplica registros.
 */
const fs = require('fs');
const path = require('path');
const { db, init, saveDbToFile } = require('../db');

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());
const lower = (value) => text(value).toLowerCase();

function findCustomer(data) {
  if (text(data.cnpj)) {
    const byCnpj = db.prepare('SELECT * FROM customers WHERE cnpj = ?').get(text(data.cnpj));
    if (byCnpj) return byCnpj;
  }
  return db.prepare('SELECT * FROM customers WHERE lower(name) = ?').get(lower(data.name));
}

function upsertCustomer(data) {
  const fields = {
    name: text(data.name),
    contact_name: text(data.contact_name),
    phone: text(data.phone),
    whatsapp: text(data.whatsapp),
    email: text(data.email),
    company: text(data.company) || text(data.name),
    cnpj: text(data.cnpj),
    address: text(data.address),
    city: text(data.city),
    state: text(data.state),
    zip_code: text(data.zip_code),
    notes: text(data.notes),
  };
  if (!fields.name) throw new Error('customer.name é obrigatório');

  const existing = findCustomer(fields);
  if (existing) {
    db.prepare(
      `UPDATE customers SET name = ?, contact_name = ?, phone = ?, whatsapp = ?, email = ?,
       company = ?, cnpj = ?, address = ?, city = ?, state = ?, zip_code = ?, notes = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      fields.name, fields.contact_name, fields.phone, fields.whatsapp, fields.email,
      fields.company, fields.cnpj, fields.address, fields.city, fields.state,
      fields.zip_code, fields.notes, existing.id
    );
    return { id: existing.id, created: false };
  }

  const info = db.prepare(
    `INSERT INTO customers (name, contact_name, phone, whatsapp, email, company, cnpj, address, city, state, zip_code, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    fields.name, fields.contact_name, fields.phone, fields.whatsapp, fields.email,
    fields.company, fields.cnpj, fields.address, fields.city, fields.state,
    fields.zip_code, fields.notes
  );
  return { id: info.lastInsertRowid, created: true };
}

function upsertItem(customerId, data) {
  const name = text(data.name);
  if (!name) throw new Error('items[].name é obrigatório');
  const payload = {
    customer_id: customerId,
    name,
    category: text(data.category) || 'outro',
    brand: text(data.brand),
    model: text(data.model),
    serial_number: text(data.serial_number),
    ip_address: text(data.ip_address),
    mac_address: text(data.mac_address),
    purchase_date: text(data.purchase_date),
    warranty: text(data.warranty),
    location: text(data.location),
    notes: text(data.notes),
    status: text(data.status) || 'ativo',
  };

  const existing = db
    .prepare('SELECT id FROM items WHERE customer_id = ? AND lower(name) = ?')
    .get(customerId, name.toLowerCase());

  if (existing) {
    db.prepare(
      `UPDATE items SET category = ?, brand = ?, model = ?, serial_number = ?, ip_address = ?,
       mac_address = ?, purchase_date = ?, warranty = ?, location = ?, notes = ?, status = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      payload.category, payload.brand, payload.model, payload.serial_number, payload.ip_address,
      payload.mac_address, payload.purchase_date, payload.warranty, payload.location,
      payload.notes, payload.status, existing.id
    );
    return { id: existing.id, created: false };
  }

  const info = db.prepare(
    `INSERT INTO items (customer_id, name, category, brand, model, serial_number, ip_address,
     mac_address, purchase_date, warranty, location, notes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    customerId, payload.name, payload.category, payload.brand, payload.model,
    payload.serial_number, payload.ip_address, payload.mac_address, payload.purchase_date,
    payload.warranty, payload.location, payload.notes, payload.status
  );
  return { id: info.lastInsertRowid, created: true };
}

function upsertService(data) {
  const name = text(data.name);
  if (!name) throw new Error('services[].name é obrigatório');
  const payload = {
    name,
    category: text(data.category) || 'outro',
    description: text(data.description),
    price: Number(data.price) || 0,
    duration_minutes: parseInt(data.duration_minutes, 10) || 60,
    active: data.active === undefined ? 1 : data.active ? 1 : 0,
  };

  const existing = db.prepare('SELECT id FROM services WHERE lower(name) = ?').get(name.toLowerCase());
  if (existing) {
    db.prepare(
      `UPDATE services SET category = ?, description = ?, price = ?, duration_minutes = ?, active = ?,
       updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(
      payload.category, payload.description, payload.price, payload.duration_minutes,
      payload.active, existing.id
    );
    return { id: existing.id, created: false };
  }

  const info = db.prepare(
    `INSERT INTO services (name, category, description, price, duration_minutes, active)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    payload.name, payload.category, payload.description, payload.price,
    payload.duration_minutes, payload.active
  );
  return { id: info.lastInsertRowid, created: true };
}

function upsertOrder(customerId, data, itemIds, serviceIds) {
  const orderNumber = text(data.order_number);
  if (!orderNumber) throw new Error('order.order_number é obrigatório');
  const title = text(data.title);
  if (!title) throw new Error('order.title é obrigatório');

  const now = text(data.created_at) || new Date().toISOString().slice(0, 19).replace('T', ' ');
  const payload = {
    customer_id: customerId,
    title,
    description: text(data.description),
    problem_report: text(data.problem_report),
    status: text(data.status) || 'orcamento',
    priority: text(data.priority) || 'media',
    total_value: Number(data.total_value) || 0,
    discount: Number(data.discount) || 0,
    cost: Number(data.cost) || 0,
    expense: Number(data.expense) || 0,
    payment_status: text(data.payment_status) || 'pendente',
    created_at: now,
    scheduled_date: text(data.scheduled_date),
    started_at: text(data.started_at),
    completed_at: text(data.completed_at),
    updated_at: text(data.updated_at) || now,
  };

  let orderId;
  const existing = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(orderNumber);
  if (existing) {
    orderId = existing.id;
    db.prepare(
      `UPDATE orders SET customer_id = ?, title = ?, description = ?, problem_report = ?, status = ?,
       priority = ?, total_value = ?, discount = ?, cost = ?, expense = ?, payment_status = ?, created_at = ?, scheduled_date = ?,
       started_at = ?, completed_at = ?, updated_at = ? WHERE id = ?`
    ).run(
      payload.customer_id, payload.title, payload.description, payload.problem_report,
      payload.status, payload.priority, payload.total_value, payload.discount,
      payload.cost, payload.expense,
      payload.payment_status, payload.created_at, payload.scheduled_date || null,
      payload.started_at || null, payload.completed_at || null, payload.updated_at, orderId
    );
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
    db.prepare('DELETE FROM order_services WHERE order_id = ?').run(orderId);
  } else {
    const info = db.prepare(
      `INSERT INTO orders (order_number, customer_id, title, description, problem_report, status,
       priority, total_value, discount, cost, expense, payment_status, created_at, scheduled_date,
       started_at, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderNumber, payload.customer_id, payload.title, payload.description, payload.problem_report,
      payload.status, payload.priority, payload.total_value, payload.discount,
      payload.cost, payload.expense, payload.payment_status,
      payload.created_at, payload.scheduled_date || null, payload.started_at || null,
      payload.completed_at || null, payload.updated_at
    );
    orderId = info.lastInsertRowid;
  }

  for (const it of data.items || []) {
    const catalogId = itemIds.get(lower(it.catalog_item)) || null;
    const catalogItem = catalogId
      ? db.prepare('SELECT * FROM items WHERE id = ?').get(catalogId)
      : null;
    db.prepare(
      `INSERT INTO order_items (order_id, item_id, name, category, brand, model, serial_number,
       quantity, unit_price, authorized, installed, executed, notes, photos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId, catalogId, text(it.name) || catalogItem?.name || 'Item',
      text(it.category) || catalogItem?.category || 'outro',
      text(it.brand) || catalogItem?.brand || '',
      text(it.model) || catalogItem?.model || '',
      text(it.serial_number) || catalogItem?.serial_number || '',
      parseInt(it.quantity, 10) || 1,
      Number(it.unit_price) || 0,
      it.authorized === undefined ? 1 : it.authorized ? 1 : 0,
      it.installed ? 1 : 0,
      it.executed ? 1 : 0,
      text(it.notes),
      JSON.stringify(it.photos || [])
    );
  }

  for (const sv of data.services || []) {
    const catalogId = serviceIds.get(lower(sv.catalog_service)) || null;
    const catalogService = catalogId
      ? db.prepare('SELECT * FROM services WHERE id = ?').get(catalogId)
      : null;
    db.prepare(
      `INSERT INTO order_services (order_id, service_id, name, category, description, quantity,
       unit_price, authorized, executed, notes, photos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId, catalogId, text(sv.name) || catalogService?.name || 'Serviço',
      text(sv.category) || catalogService?.category || 'outro',
      text(sv.description) || catalogService?.description || '',
      parseInt(sv.quantity, 10) || 1,
      Number(sv.unit_price) || 0,
      sv.authorized === undefined ? 1 : sv.authorized ? 1 : 0,
      sv.executed ? 1 : 0,
      text(sv.notes),
      JSON.stringify(sv.photos || [])
    );
  }

  return { id: orderId, created: !existing };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node scripts/import-data.js <arquivo.json>');
    process.exit(1);
  }

  const raw = fs.readFileSync(path.resolve(file), 'utf8').replace(/^\uFEFF/, '');
  const payload = JSON.parse(raw);
  if (!payload.customer) throw new Error('O JSON precisa de um bloco "customer"');

  await init();

  const customer = upsertCustomer(payload.customer);
  const itemIds = new Map();
  for (const item of payload.items || []) {
    const result = upsertItem(customer.id, item);
    itemIds.set(lower(item.name), result.id);
    console.log(`${result.created ? 'criado' : 'atualizado'} item #${result.id}: ${item.name}`);
  }

  const serviceIds = new Map();
  for (const service of payload.services || []) {
    const result = upsertService(service);
    serviceIds.set(lower(service.name), result.id);
    console.log(`${result.created ? 'criado' : 'atualizado'} serviço #${result.id}: ${service.name}`);
  }

  let orderInfo = null;
  if (payload.order) {
    orderInfo = upsertOrder(customer.id, payload.order, itemIds, serviceIds);
    console.log(`${orderInfo.created ? 'criada' : 'atualizada'} OS #${payload.order.order_number} (id ${orderInfo.id})`);
  }

  saveDbToFile();

  console.log('\n=== Importação concluída ===');
  console.log(`${customer.created ? 'criado' : 'atualizado'} cliente #${customer.id}: ${payload.customer.name}`);
  console.log(`itens: ${(payload.items || []).length} | serviços: ${(payload.services || []).length} | OS: ${orderInfo ? 1 : 0}`);
}

main().catch((err) => {
  console.error('Falha na importação:', err.message);
  process.exit(1);
});
