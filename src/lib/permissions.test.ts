import { describe, expect, it } from "vitest";
import {
  canAccessAdminPage,
  canCreateOrder,
  canManageUsers,
  canEditProduct,
  canViewOrdersMenu,
  getRouteAccessDecision,
} from "./permissions";

describe("permissions", () => {
  it("allows admin to access admin page", () => {
    expect(canAccessAdminPage("admin")).toBe(true);
  });

  it("does not allow sale to access admin page", () => {
    expect(canAccessAdminPage("sale")).toBe(false);
  });

  it("allows sale to create order", () => {
    expect(canCreateOrder("sale")).toBe(true);
  });

  it("does not allow sale to manage users", () => {
    expect(canManageUsers("sale")).toBe(false);
  });

  it("allows admin to edit products but restricts sale", () => {
    expect(canEditProduct("admin")).toBe(true);
    expect(canEditProduct("sale")).toBe(false);
    expect(canEditProduct("guest")).toBe(false);
  });

  it("allows admin and sale to view orders menu but restricts guest", () => {
    expect(canViewOrdersMenu("admin")).toBe(true);
    expect(canViewOrdersMenu("sale")).toBe(true);
    expect(canViewOrdersMenu("guest")).toBe(false);
  });
});

describe("getRouteAccessDecision", () => {
  it("restricts sale and guest from /admin routes with appropriate redirects", () => {
    const saleDecision = getRouteAccessDecision("/admin/users", "sale");
    expect(saleDecision.allowed).toBe(false);
    expect(saleDecision.redirectTo).toBe("/");

    const guestDecision = getRouteAccessDecision("/admin/users", "guest");
    expect(guestDecision.allowed).toBe(false);
    expect(guestDecision.redirectTo).toBe("/login");
  });

  it("allows admin to access /admin routes", () => {
    const decision = getRouteAccessDecision("/admin/users", "admin");
    expect(decision.allowed).toBe(true);
  });

  it("restricts guest from /orders routes and redirects to /login", () => {
    const decision = getRouteAccessDecision("/orders", "guest");
    expect(decision.allowed).toBe(false);
    expect(decision.redirectTo).toBe("/login");
  });

  it("allows sale and admin to access /orders routes", () => {
    expect(getRouteAccessDecision("/orders", "sale").allowed).toBe(true);
    expect(getRouteAccessDecision("/orders", "admin").allowed).toBe(true);
  });
});
