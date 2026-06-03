export interface CustomerAttribution {
  first_campaign_id?: string;
  latest_campaign_id?: string;
  lead_source?: string;
}

export interface OrderAttributionSnapshot {
  attributed_campaign_id?: string;
  attributed_source?: string;
  revenue: number;
}

export function getCustomerAttribution(customer: any): string {
  if (customer.latest_campaign_id) return customer.latest_campaign_id;
  if (customer.first_campaign_id) return customer.first_campaign_id;
  if (customer.lead_source) return customer.lead_source;
  return "Unknown";
}

export function snapshotOrderAttribution(
  orderTotal: number,
  customer: any,
): OrderAttributionSnapshot {
  return {
    attributed_campaign_id: customer.latest_campaign_id || customer.first_campaign_id,
    attributed_source: customer.lead_source || "Unknown",
    revenue: orderTotal,
  };
}

export function calculateCampaignRevenue(orders: any[], campaigns: any[]) {
  const result: Record<string, { revenue: number; orders: number; name: string }> = {};

  // Initialize campaigns
  campaigns.forEach((c) => {
    result[c.id] = { revenue: 0, orders: 0, name: c.name };
  });

  orders.forEach((o) => {
    // If order has a snapshot of campaign_id, we use it (fallback to mock evaluation)
    const campId =
      o.attributed_campaign_id ||
      (o.customer ? o.customer.latest_campaign_id || o.customer.first_campaign_id : null);
    if (campId && result[campId]) {
      result[campId].revenue += Number(o.total_amount || 0);
      result[campId].orders += 1;
    }
  });

  return result;
}

export function calculateSourceRevenue(orders: any[]) {
  const result: Record<
    string,
    { revenue: number; orders: number; qualified: number; leads: number }
  > = {};

  orders.forEach((o) => {
    const source =
      o.attributed_source || (o.customer ? o.customer.lead_source : "Unknown") || "Unknown";
    if (!result[source]) {
      result[source] = { revenue: 0, orders: 0, qualified: 0, leads: 0 };
    }
    result[source].revenue += Number(o.total_amount || 0);
    result[source].orders += 1;
  });

  return result;
}
