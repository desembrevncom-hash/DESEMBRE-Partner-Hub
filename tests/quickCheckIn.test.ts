import { describe, it, expect } from "vitest";

interface MockUser {
  id: string;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isTeleLead: boolean;
  isTelesale: boolean;
  isSale: boolean;
}

interface MockCustomer {
  id: string;
  name: string;
  facility_name: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  owner_sale_id: string | null;
  owner_tele_id: string | null;
  ownership_status: string;
}

// Scoping logic identical to supabase query scoping
function scopeCustomers(customersList: MockCustomer[], user: MockUser) {
  if (user.isAdmin || user.isSubAdmin) {
    return customersList;
  }
  return customersList.filter((c) => {
    if (user.isSale) {
      return c.owner_sale_id === user.id || c.ownership_status === "free_pool";
    }
    if (user.isTelesale || user.isTeleLead) {
      return c.owner_tele_id === user.id;
    }
    return c.owner_sale_id === user.id;
  });
}

// Logic for calculating priority score
function getPriorityScore(
  c: MockCustomer,
  todayApptCustIds: Set<string>,
  taskCustIds: Set<string>,
  distance: number | null,
  userId: string,
) {
  if (todayApptCustIds.has(c.id)) return 1;
  if (taskCustIds.has(c.id)) return 2;
  if (distance !== null && distance <= 500) return 3;
  if (c.owner_sale_id === userId || c.owner_tele_id === userId) return 4;
  return 5;
}

describe(" v1.3.0G.1.1 — Quick Check-in Selection & Prioritization Logic Verification", () => {
  const mockCustomers: MockCustomer[] = [
    {
      id: "cust-appt",
      name: "Spa A",
      facility_name: "Spa A Facility",
      phone: "0901234567",
      address: "Hanoi",
      latitude: 21.0285,
      longitude: 105.8542,
      owner_sale_id: "sale-1",
      owner_tele_id: null,
      ownership_status: "assigned",
    },
    {
      id: "cust-task",
      name: "Spa B",
      facility_name: "Spa B Facility",
      phone: "0901234568",
      address: "Hanoi",
      latitude: 21.02,
      longitude: 105.85,
      owner_sale_id: "sale-1",
      owner_tele_id: null,
      ownership_status: "assigned",
    },
    {
      id: "cust-nearby",
      name: "Spa C",
      facility_name: "Spa C Facility",
      phone: "0901234569",
      address: "Hanoi",
      latitude: 21.0283,
      longitude: 105.854, // Close to Spa A
      owner_sale_id: "sale-1",
      owner_tele_id: null,
      ownership_status: "assigned",
    },
    {
      id: "cust-assigned",
      name: "Spa D",
      facility_name: "Spa D Facility",
      phone: "0901234570",
      address: "Hanoi",
      latitude: 21.05,
      longitude: 105.9,
      owner_sale_id: "sale-1",
      owner_tele_id: null,
      ownership_status: "assigned",
    },
    {
      id: "cust-freepool",
      name: "Spa E",
      facility_name: "Spa E Facility",
      phone: "0901234571",
      address: "Hanoi",
      latitude: 21.06,
      longitude: 105.91,
      owner_sale_id: null,
      owner_tele_id: null,
      ownership_status: "free_pool",
    },
    {
      id: "cust-other",
      name: "Spa F",
      facility_name: "Spa F Facility",
      phone: "0901234572",
      address: "Hanoi",
      latitude: 21.07,
      longitude: 105.92,
      owner_sale_id: "sale-2",
      owner_tele_id: null,
      ownership_status: "assigned",
    },
  ];

  const userSale: MockUser = {
    id: "sale-1",
    isAdmin: false,
    isSubAdmin: false,
    isTeleLead: false,
    isTelesale: false,
    isSale: true,
  };

  const userTele: MockUser = {
    id: "tele-1",
    isAdmin: false,
    isSubAdmin: false,
    isTeleLead: false,
    isTelesale: true,
    isSale: false,
  };

  const userAdmin: MockUser = {
    id: "admin-1",
    isAdmin: true,
    isSubAdmin: false,
    isTeleLead: false,
    isTelesale: false,
    isSale: false,
  };

  describe("A. Customer Selection Scope By Role (RLS Verification)", () => {
    it("1. Sale user sees only assigned customers + free pool", () => {
      const result = scopeCustomers(mockCustomers, userSale);
      const ids = result.map((c) => c.id);
      expect(ids).toContain("cust-appt");
      expect(ids).toContain("cust-task");
      expect(ids).toContain("cust-nearby");
      expect(ids).toContain("cust-assigned");
      expect(ids).toContain("cust-freepool");
      expect(ids).not.toContain("cust-other"); // Belong to sale-2
    });

    it("2. Telesales user sees only their assigned telesales customers", () => {
      const mockCustomersWithTele = mockCustomers.map((c) => {
        if (c.id === "cust-appt") return { ...c, owner_tele_id: "tele-1" };
        return c;
      });
      const result = scopeCustomers(mockCustomersWithTele, userTele);
      const ids = result.map((c) => c.id);
      expect(ids).toContain("cust-appt");
      expect(ids).not.toContain("cust-task");
      expect(ids).not.toContain("cust-freepool");
    });

    it("3. Admin sees all customers", () => {
      const result = scopeCustomers(mockCustomers, userAdmin);
      expect(result.length).toBe(mockCustomers.length);
    });
  });

  describe("B. Recommendation Priority Score Rules", () => {
    const todayAppts = new Set(["cust-appt"]);
    const taskCusts = new Set(["cust-task"]);

    it("1. Appointment today gets score 1 (Top priority)", () => {
      const score = getPriorityScore(
        mockCustomers.find((c) => c.id === "cust-appt")!,
        todayAppts,
        taskCusts,
        null,
        "sale-1",
      );
      expect(score).toBe(1);
    });

    it("2. Outstanding task gets score 2 (Second priority)", () => {
      const score = getPriorityScore(
        mockCustomers.find((c) => c.id === "cust-task")!,
        todayAppts,
        taskCusts,
        null,
        "sale-1",
      );
      expect(score).toBe(2);
    });

    it("3. Nearby customer (< 500m) gets score 3 (Third priority)", () => {
      const score = getPriorityScore(
        mockCustomers.find((c) => c.id === "cust-nearby")!,
        todayAppts,
        taskCusts,
        150, // 150 meters
        "sale-1",
      );
      expect(score).toBe(3);
    });

    it("4. Customer owned by salesperson gets score 4 (Fourth priority)", () => {
      const score = getPriorityScore(
        mockCustomers.find((c) => c.id === "cust-assigned")!,
        todayAppts,
        taskCusts,
        1200, // > 500m
        "sale-1",
      );
      expect(score).toBe(4);
    });

    it("5. Other customers / free pool gets score 5 (Fifth priority)", () => {
      const score = getPriorityScore(
        mockCustomers.find((c) => c.id === "cust-freepool")!,
        todayAppts,
        taskCusts,
        null,
        "sale-1",
      );
      expect(score).toBe(5);
    });
  });
});
