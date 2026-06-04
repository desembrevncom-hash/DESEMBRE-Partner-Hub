import { getSaleMarkerColor, FREE_POOL_COLOR } from "./mapOwnerColor";
import { getStaffDisplayName, StaffMap } from "./staffDisplay";

export const FREE_POOL_FILTER = "__free_pool__";

export function applyOwnerFilter(customers: any[], activeOwnerFilter: string | null): any[] {
  if (!activeOwnerFilter) return customers;

  if (activeOwnerFilter === FREE_POOL_FILTER) {
    return customers.filter((c) => !c.owner_sale_id || c.ownership_status === "free_pool");
  }

  return customers.filter((c) => c.owner_sale_id === activeOwnerFilter);
}

export function toggleOwnerFilter(
  currentFilter: string | null,
  newFilter: string | null,
): string | null {
  if (currentFilter === newFilter) {
    return null;
  }
  return newFilter;
}

export interface LegendItem {
  id: string;
  name: string;
  color: string;
  count: number;
}

export function getOwnerLegendItems(customers: any[], staffMap: StaffMap): LegendItem[] {
  const counts: Record<string, number> = {};
  let freePoolCount = 0;

  customers.forEach((c) => {
    if (!c.owner_sale_id || c.ownership_status === "free_pool") {
      freePoolCount++;
    } else {
      counts[c.owner_sale_id] = (counts[c.owner_sale_id] || 0) + 1;
    }
  });

  const items: LegendItem[] = Object.keys(counts)
    .map((saleId) => {
      const colorObj = getSaleMarkerColor(saleId);
      const name = getStaffDisplayName(saleId, staffMap);
      return { id: saleId, name, color: colorObj.color, count: counts[saleId] };
    })
    .sort((a, b) => b.count - a.count);

  if (freePoolCount > 0) {
    items.push({
      id: FREE_POOL_FILTER,
      name: "Chưa phân công / Free Pool",
      color: FREE_POOL_COLOR.color,
      count: freePoolCount,
    });
  }

  return items;
}
