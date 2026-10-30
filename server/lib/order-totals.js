const { db } = require('../db');

// Regra de cobrança das linhas da OS:
// - item só é cobrado se estiver autorizado, não instalado, não executado e não pago
// - serviço só é cobrado se estiver autorizado, não executado e não pago
function isItemChargeable(item) {
  return (
    Number(item.authorized) === 1 &&
    !Number(item.installed) &&
    !Number(item.executed) &&
    !Number(item.paid)
  );
}

function isServiceChargeable(service) {
  return Number(service.authorized) === 1 && !Number(service.executed) && !Number(service.paid);
}

function lineValue(line) {
  return Number(line.unit_price || 0) * Number(line.quantity || 1);
}

// Calcula os subtotais, os descontos automáticos (linhas riscadas) e o total da OS
function computeOrderTotals(order) {
  const itemRows = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const serviceRows = db.prepare('SELECT * FROM order_services WHERE order_id = ?').all(order.id);

  let itemsGross = 0;
  let itemsDiscount = 0;
  for (const item of itemRows) {
    const value = lineValue(item);
    itemsGross += value;
    if (!isItemChargeable(item)) itemsDiscount += value;
  }

  let servicesGross = 0;
  let servicesDiscount = 0;
  for (const service of serviceRows) {
    const value = lineValue(service);
    servicesGross += value;
    if (!isServiceChargeable(service)) servicesDiscount += value;
  }

  const discount = Number(order.discount || 0);
  const chargeable = itemsGross - itemsDiscount + servicesGross - servicesDiscount;
  const total = Math.max(chargeable - discount, 0);

  return {
    itemsGross,
    servicesGross,
    itemsDiscount,
    servicesDiscount,
    discount,
    chargeable,
    total: Math.round(total * 100) / 100,
  };
}

// Recalcula e grava o total da OS a partir das linhas e do desconto
function recalcOrderTotal(orderId) {
  const order = db.prepare('SELECT id, discount FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;

  const totals = computeOrderTotals(order);
  db.prepare('UPDATE orders SET total_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(totals.total, order.id);
  return totals;
}

// Mantém os totais de todas as OS coerentes com as linhas (executado na inicialização)
function syncAllOrderTotals() {
  const orders = db.prepare('SELECT id FROM orders').all();
  for (const order of orders) recalcOrderTotal(order.id);
  return orders.length;
}

module.exports = {
  isItemChargeable,
  isServiceChargeable,
  lineValue,
  computeOrderTotals,
  recalcOrderTotal,
  syncAllOrderTotals,
};
