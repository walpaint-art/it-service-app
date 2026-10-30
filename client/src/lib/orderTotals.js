// Regras de cobrança da OS (espelham o backend em server/lib/order-totals.js)

export function lineValue(line) {
  return Number(line?.unit_price || 0) * Number(line?.quantity || 1);
}

export function isItemChargeable(item) {
  return (
    Number(item?.authorized) === 1 &&
    !Number(item?.installed) &&
    !Number(item?.executed) &&
    !Number(item?.paid)
  );
}

export function isServiceChargeable(service) {
  return Number(service?.authorized) === 1 && !Number(service?.executed) && !Number(service?.paid);
}

export function isItemStruck(item) {
  return !isItemChargeable(item);
}

export function isServiceStruck(service) {
  return !isServiceChargeable(service);
}

/**
 * Devolve subtotais brutos, descontos automáticos das linhas riscadas
 * (instaladas/executadas/não autorizadas), desconto manual e total final.
 */
export function computeOrderTotals(order) {
  const itemLines = order?.items || [];
  const serviceLines = order?.services || [];

  let itemsGross = 0;
  let itemsDiscount = 0;
  for (const item of itemLines) {
    const value = lineValue(item);
    itemsGross += value;
    if (isItemStruck(item)) itemsDiscount += value;
  }

  let servicesGross = 0;
  let servicesDiscount = 0;
  for (const service of serviceLines) {
    const value = lineValue(service);
    servicesGross += value;
    if (isServiceStruck(service)) servicesDiscount += value;
  }

  const discount = Number(order?.discount || 0);
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
