export function getCustomerSystemRevenue(customer: any): number {
  if (!customer) return 0;
  if (customer.total_order_amount !== undefined && customer.total_order_amount !== null) {
    return Number(customer.total_order_amount);
  }
  if (customer.orders && Array.isArray(customer.orders)) {
    return customer.orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0);
  }
  return 0;
}

export function getCustomerHistoricalRevenue(customer: any): number {
  if (!customer) return 0;
  return Number(customer.historical_revenue_total) || 0;
}

export function getCustomerLifetimeValue(customer: any): number {
  const system = getCustomerSystemRevenue(customer);
  const historical = getCustomerHistoricalRevenue(customer);
  return system + historical;
}

export function getCustomerTier(customer: any, goldThreshold: number): "GOLD" | "STANDARD" {
  const ltv = getCustomerLifetimeValue(customer);
  if (ltv >= goldThreshold) {
    return "GOLD";
  }
  return "STANDARD";
}
