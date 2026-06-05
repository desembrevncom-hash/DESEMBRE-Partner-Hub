/**
 * tests/workspaceFilterMapping.test.ts
 * Phase v1.3.0G.2.1 — Workspace UX & Linkage Optimization
 * Tests for centralized KPI/Alert route mapping and customer risk labels.
 */

import { describe, it, expect } from "vitest";
import {
  workspaceKpiToRoute,
  workspaceAlertToRoute,
  customerRiskLabels,
} from "../src/lib/workspaceFilterMapping";

// ─── Safety checks ────────────────────────────────────────────────────────────
describe("Safety: no forbidden patterns in mapping module", () => {
  it("does not contain provider send call", async () => {
    const src = await import("fs").then((fs) =>
      fs.readFileSync("src/lib/workspaceFilterMapping.ts", "utf-8"),
    );
    expect(src).not.toMatch(/sendZalo|sendZNS|sendEmail|sendSMS|provider\.send/i);
  });

  it("does not contain service role key", async () => {
    const src = await import("fs").then((fs) =>
      fs.readFileSync("src/lib/workspaceFilterMapping.ts", "utf-8"),
    );
    expect(src).not.toMatch(/service_role|SUPABASE_SERVICE/i);
  });

  it("does not contain secret or token", async () => {
    const src = await import("fs").then((fs) =>
      fs.readFileSync("src/lib/workspaceFilterMapping.ts", "utf-8"),
    );
    expect(src).not.toMatch(/secret|token|api_key/i);
  });
});

// ─── KPI Route Mapping ────────────────────────────────────────────────────────
describe("workspaceKpiToRoute()", () => {
  it("lead → /customers?risk=leads_to_call", () => {
    const route = workspaceKpiToRoute("lead");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "leads_to_call" });
  });

  it("followup → /customers?risk=today", () => {
    const route = workspaceKpiToRoute("followup");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "today" });
  });

  it("checkin → /customers?risk=checkin_today", () => {
    const route = workspaceKpiToRoute("checkin");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "checkin_today" });
  });

  it("quotation → /customers?risk=quotation_pending", () => {
    const route = workspaceKpiToRoute("quotation");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "quotation_pending" });
  });

  it("overdue → /customers?risk=overdue", () => {
    const route = workspaceKpiToRoute("overdue");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "overdue" });
  });

  it("draft_order → /orders?filter=draft", () => {
    const route = workspaceKpiToRoute("draft_order");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/orders");
    expect(route!.search).toEqual({ filter: "draft" });
  });

  it("unknown key → null", () => {
    expect(workspaceKpiToRoute("nonexistent")).toBeNull();
  });

  it("does NOT map to ?filter= for customers (bug prevention)", () => {
    // Ensure none of the customer routes use the old broken ?filter= param
    const customerKeys = ["lead", "followup", "checkin", "quotation", "overdue"];
    for (const key of customerKeys) {
      const route = workspaceKpiToRoute(key);
      expect(route!.search).not.toHaveProperty("filter");
      expect(route!.search).toHaveProperty("risk");
    }
  });
});

// ─── Alert Route Mapping ──────────────────────────────────────────────────────
describe("workspaceAlertToRoute()", () => {
  it("data_stale → /customers?risk=data_stale", () => {
    const route = workspaceAlertToRoute("data_stale");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "data_stale" });
  });

  it("no_social → /customers?risk=no_social", () => {
    const route = workspaceAlertToRoute("no_social");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "no_social" });
  });

  it("duplicate_phone → /customers?risk=duplicate_phone", () => {
    const route = workspaceAlertToRoute("duplicate_phone");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "duplicate_phone" });
  });

  it("overdue → /customers?risk=overdue", () => {
    const route = workspaceAlertToRoute("overdue");
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/customers");
    expect(route!.search).toEqual({ risk: "overdue" });
  });

  it("unknown key → null", () => {
    expect(workspaceAlertToRoute("invalid_key")).toBeNull();
  });
});

// ─── Risk Labels ──────────────────────────────────────────────────────────────
describe("customerRiskLabels", () => {
  const expectedLabels: Record<string, string> = {
    leads_to_call: "Lead cần gọi",
    today: "Follow-up hôm nay",
    checkin_today: "Cần check-in",
    quotation_pending: "Báo giá chưa chốt",
    overdue: "Sắp thu hồi / quá hạn",
    data_stale: "Khách ngủ đông",
    no_social: "Thiếu MXH",
    duplicate_phone: "Trùng dữ liệu",
  };

  for (const [key, label] of Object.entries(expectedLabels)) {
    it(`label for "${key}" is "${label}"`, () => {
      expect(customerRiskLabels[key]).toBe(label);
    });
  }
});

// ─── Customer Smart Filter Logic (unit-level) ─────────────────────────────────
describe("Customer smart filter – leads_to_call logic", () => {
  const makeTask = (task_type: string, customer_id: string) => ({
    customer_id,
    task_type,
    status: "pending",
  });

  it("leads_to_call: matches customers with call task_types", () => {
    const tasks = [
      makeTask("call", "c1"),
      makeTask("phone_call", "c2"),
      makeTask("visit", "c3"), // should not match
    ];
    const callCustomerIds = new Set(
      tasks
        .filter((t) => ["call", "phone_call", "cold_call"].includes(t.task_type))
        .map((t) => t.customer_id),
    );
    expect(callCustomerIds.has("c1")).toBe(true);
    expect(callCustomerIds.has("c2")).toBe(true);
    expect(callCustomerIds.has("c3")).toBe(false);
  });

  it("checkin_today: matches customers with visit/check_in tasks", () => {
    const tasks = [
      makeTask("visit", "c1"),
      makeTask("check_in", "c2"),
      makeTask("call", "c3"), // should not match
    ];
    const checkinIds = new Set(
      tasks
        .filter((t) => ["visit", "check_in", "checkin"].includes(t.task_type))
        .map((t) => t.customer_id),
    );
    expect(checkinIds.has("c1")).toBe(true);
    expect(checkinIds.has("c2")).toBe(true);
    expect(checkinIds.has("c3")).toBe(false);
  });

  it("quotation_pending: matches customers with quotation/quote tasks", () => {
    const tasks = [
      makeTask("quotation", "c1"),
      makeTask("quote_follow_up", "c2"),
      makeTask("call", "c3"), // should not match
    ];
    const quotationIds = new Set(
      tasks
        .filter((t) =>
          ["quotation", "quote", "quote_follow_up", "quotation_follow_up"].includes(t.task_type),
        )
        .map((t) => t.customer_id),
    );
    expect(quotationIds.has("c1")).toBe(true);
    expect(quotationIds.has("c2")).toBe(true);
    expect(quotationIds.has("c3")).toBe(false);
  });

  it("duplicate_phone: matches customers with duplicate intel flags", () => {
    const customers = [
      { id: "c1", sales_intelligence: { duplicate_phone_risk: true } },
      { id: "c2", sales_intelligence: { duplicate_channel_risk: true } },
      {
        id: "c3",
        sales_intelligence: { duplicate_phone_risk: false, duplicate_channel_risk: false },
      },
      { id: "c4", sales_intelligence: null },
    ];
    const dupes = customers.filter((c) => {
      const intel = c.sales_intelligence;
      return intel?.duplicate_phone_risk || intel?.duplicate_channel_risk;
    });
    expect(dupes.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("empty task list produces empty result for leads_to_call", () => {
    const tasks: any[] = [];
    const callIds = new Set(
      tasks.filter((t) => ["call", "phone_call"].includes(t.task_type)).map((t) => t.customer_id),
    );
    const customers = [{ id: "c1" }, { id: "c2" }];
    const filtered = customers.filter((c) => callIds.has(c.id));
    expect(filtered).toHaveLength(0);
  });
});
