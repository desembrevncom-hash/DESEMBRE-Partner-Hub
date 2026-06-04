import { describe, it, expect } from "vitest";
import {
  applyOwnerFilter,
  getOwnerLegendItems,
  toggleOwnerFilter,
  FREE_POOL_FILTER,
} from "../src/lib/mapOwnerFilter";

const mockStaffMap = {
  "sale1": { display_name: "Nguyen Van A" },
  "sale2": { display_name: "Tran Thi B" },
};

const mockCustomers = [
  { id: "1", owner_sale_id: "sale1", ownership_status: "assigned" },
  { id: "2", owner_sale_id: "sale1", ownership_status: "assigned" },
  { id: "3", owner_sale_id: "sale2", ownership_status: "assigned" },
  { id: "4", owner_sale_id: null, ownership_status: "free_pool" },
  { id: "5", owner_sale_id: "some_id", ownership_status: "free_pool" }, // technically free pool override
];

describe("mapOwnerFilter helper", () => {
  it("applyOwnerFilter with null returns all", () => {
    expect(applyOwnerFilter(mockCustomers, null)).toHaveLength(5);
  });

  it("applyOwnerFilter with owner id returns only that owner", () => {
    const res = applyOwnerFilter(mockCustomers, "sale1");
    expect(res).toHaveLength(2);
    expect(res.every((c) => c.owner_sale_id === "sale1")).toBe(true);
  });

  it("applyOwnerFilter with free pool filter returns free pool or null owner", () => {
    const res = applyOwnerFilter(mockCustomers, FREE_POOL_FILTER);
    // id 4 has null owner, id 5 has ownership_status === "free_pool"
    expect(res).toHaveLength(2);
    expect(res.map((c) => c.id)).toEqual(["4", "5"]);
  });

  it("toggleOwnerFilter toggles correctly", () => {
    expect(toggleOwnerFilter("sale1", "sale2")).toBe("sale2");
    expect(toggleOwnerFilter("sale1", "sale1")).toBe(null);
    expect(toggleOwnerFilter(null, "sale1")).toBe("sale1");
  });

  it("getOwnerLegendItems computes counts correctly", () => {
    const items = getOwnerLegendItems(mockCustomers, mockStaffMap);
    // sale1 (count 2), sale2 (count 1), free pool (count 2)
    // total 3 items
    expect(items).toHaveLength(3);

    const sale1Item = items.find((i) => i.id === "sale1");
    expect(sale1Item?.count).toBe(2);
    expect(sale1Item?.name).toBe("Nguyen Van A");

    const freePoolItem = items.find((i) => i.id === FREE_POOL_FILTER);
    expect(freePoolItem?.count).toBe(2);
  });

  it("does not mutate original array", () => {
    const orig = [...mockCustomers];
    applyOwnerFilter(orig, "sale1");
    expect(orig).toEqual(mockCustomers);
  });
});
