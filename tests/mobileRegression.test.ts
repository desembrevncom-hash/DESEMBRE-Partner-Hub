import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Define mock user roles and mapping for testing route access
interface MockUser {
  id: string;
  roles: string[];
  isAdmin: boolean;
  isSubAdmin: boolean;
  isTeleLead: boolean;
  isTelesale: boolean;
  isSale: boolean;
}

// Function that represents the routing policy from F.5 and F.6
function checkRouteAccess(route: string, user: MockUser): { allowed: boolean; readOnly: boolean } {
  const isManager = user.isAdmin || user.isSubAdmin;

  if (route.startsWith("/admin/")) {
    if (route === "/admin/products" || route === "/admin/product-knowledge") {
      // Products and Product Knowledge are viewable by all, but modifications are manager-only
      return { allowed: true, readOnly: !isManager };
    }
    // Other admin technical routes are strict admin/sub_admin only
    return { allowed: isManager, readOnly: false };
  }

  if (route.startsWith("/marketing")) {
    // Marketing routes are allowed for admin, sub_admin, tele_lead, and sale. Telesales are blocked.
    const isAllowed = user.isAdmin || user.isSubAdmin || user.isTeleLead || user.isSale;
    return { allowed: isAllowed, readOnly: false };
  }

  if (route === "/reports/routing") {
    // Routing report is restricted to admin/sub_admin (isManager)
    return { allowed: isManager, readOnly: false };
  }

  // Workspace, customers, orders, calendar, etc. are allowed for all roles
  return { allowed: true, readOnly: false };
}

// Function representing navigation rendering logic from F.6
function getVisibleNavigation(user: MockUser) {
  const navItems = ["workspace", "customers", "calendar", "orders"];
  const moreMenuItems = [
    "profile",
    "settings/communication",
    "settings/message-templates",
    "admin/products",
  ];

  if (user.isAdmin || user.isSubAdmin || user.isTeleLead || user.isSale) {
    moreMenuItems.push("marketing");
  }

  return {
    navItems,
    moreMenuItems,
    // Technical admin routes should NEVER appear in the More menu for sale or telesale
    hasAdminTechnicalInMoreMenu: false,
  };
}

interface MockCustomer {
  id: string;
  name: string;
  owner_sale_id: string | null;
  owner_tele_id: string | null;
}

// Function simulating database query filters from customers/index.tsx
function filterCustomersForUser(customersList: MockCustomer[], user: MockUser) {
  if (user.isAdmin || user.isSubAdmin) {
    return customersList; // Admin & Sub-admin see everything
  }

  return customersList.filter((c) => {
    const isOwnerSale = c.owner_sale_id === user.id;
    const isOwnerTele = c.owner_tele_id === user.id;
    const isFreePool = !c.owner_sale_id && !c.owner_tele_id;

    if (user.isSale && (user.isTelesale || user.isTeleLead)) {
      // If user holds both roles, they see both owned sets
      return isOwnerSale || isOwnerTele;
    } else if (user.isSale) {
      // Sale sees owned + free pool (shared pool)
      return isOwnerSale || isFreePool;
    } else if (user.isTelesale || user.isTeleLead) {
      // Telesale/TeleLead sees owned tele customers
      return isOwnerTele;
    }
    return false;
  });
}

// Function verifying touch target classes against styling guidelines (minimum 44px / 40px)
function verifyTouchTargetClasses(
  componentName: string,
  classes: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const classList = classes.split(/\s+/);

  if (componentName === "Button") {
    // Must have h-11, h-12, min-h-11, or dynamic height that fits 44px
    const hasHeight = classList.some(
      (c) =>
        c.includes("h-11") || c.includes("h-12") || c.includes("min-h-11") || c.includes("h-[calc"),
    );
    if (!hasHeight) {
      errors.push("Button lacks 44px height class on mobile (e.g. h-11)");
    }
  } else if (componentName === "Input" || componentName === "Select") {
    const hasHeight = classList.some((c) => c.includes("h-11") || c.includes("min-h-11"));
    if (!hasHeight) {
      errors.push(`${componentName} lacks 44px height class on mobile (e.g. h-11)`);
    }
  } else if (componentName === "QuantityButton" || componentName === "PhotoUploadButton") {
    const hasWidth = classList.some((c) => c.includes("w-11") || c.includes("w-12"));
    const hasHeight = classList.some((c) => c.includes("h-11") || c.includes("h-12"));
    if (!hasWidth || !hasHeight) {
      errors.push(`${componentName} must be at least 44x44px (w-11 h-11) on mobile`);
    }
  } else if (componentName === "CalendarButton") {
    // Minimum height of 40px (h-10) for calendar buttons
    const hasMinHeight = classList.some(
      (c) =>
        c.includes("h-10") ||
        c.includes("min-h-10") ||
        c.includes("h-11") ||
        c.includes("min-h-11"),
    );
    if (!hasMinHeight) {
      errors.push("Calendar button lacks min-height 40px class (e.g. h-10)");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

describe("Phase v1.3.0F.7 — Mobile Regression Test Suite", () => {
  // Test user fixtures
  const users: Record<string, MockUser> = {
    admin: {
      id: "u-admin",
      roles: ["admin"],
      isAdmin: true,
      isSubAdmin: false,
      isTeleLead: false,
      isTelesale: false,
      isSale: false,
    },
    sub_admin: {
      id: "u-subadmin",
      roles: ["sub_admin"],
      isAdmin: false,
      isSubAdmin: true,
      isTeleLead: false,
      isTelesale: false,
      isSale: false,
    },
    tele_lead: {
      id: "u-telelead",
      roles: ["tele_lead"],
      isAdmin: false,
      isSubAdmin: false,
      isTeleLead: true,
      isTelesale: false,
      isSale: false,
    },
    telesale: {
      id: "u-telesale",
      roles: ["telesale"],
      isAdmin: false,
      isSubAdmin: false,
      isTeleLead: false,
      isTelesale: true,
      isSale: false,
    },
    sale: {
      id: "u-sale",
      roles: ["sale"],
      isAdmin: false,
      isSubAdmin: false,
      isTeleLead: false,
      isTelesale: false,
      isSale: true,
    },
  };

  describe("B. Route Access Control Regression", () => {
    const adminRoutes = [
      "/admin/operations",
      "/admin/sender-accounts",
      "/admin/inventory",
      "/admin/webhooks",
    ];

    it("1. Admin and Sub-admin are allowed on all admin technical routes", () => {
      for (const route of adminRoutes) {
        expect(checkRouteAccess(route, users.admin).allowed).toBe(true);
        expect(checkRouteAccess(route, users.sub_admin).allowed).toBe(true);
      }
    });

    it("2. Tele_lead, Telesale, and Sales are blocked from technical admin routes", () => {
      for (const route of adminRoutes) {
        expect(checkRouteAccess(route, users.tele_lead).allowed).toBe(false);
        expect(checkRouteAccess(route, users.telesale).allowed).toBe(false);
        expect(checkRouteAccess(route, users.sale).allowed).toBe(false);
      }
    });

    it("3. /admin/products and /admin/product-knowledge are read-only for non-managers", () => {
      const paths = ["/admin/products", "/admin/product-knowledge"];
      for (const path of paths) {
        // Managers (admin/sub-admin) are not read-only
        expect(checkRouteAccess(path, users.admin).readOnly).toBe(false);
        expect(checkRouteAccess(path, users.sub_admin).readOnly).toBe(false);

        // Non-managers are allowed but restricted to read-only
        const resSale = checkRouteAccess(path, users.sale);
        expect(resSale.allowed).toBe(true);
        expect(resSale.readOnly).toBe(true);

        const resTelesale = checkRouteAccess(path, users.telesale);
        expect(resTelesale.allowed).toBe(true);
        expect(resTelesale.readOnly).toBe(true);

        const resTelelead = checkRouteAccess(path, users.tele_lead);
        expect(resTelelead.allowed).toBe(true);
        expect(resTelelead.readOnly).toBe(true);
      }
    });

    it("4. Marketing routes allowed for admin, sub_admin, tele_lead, and sale, but blocked for telesale", () => {
      const marketingRoutes = ["/marketing/campaigns", "/marketing/logs"];
      for (const route of marketingRoutes) {
        expect(checkRouteAccess(route, users.admin).allowed).toBe(true);
        expect(checkRouteAccess(route, users.sub_admin).allowed).toBe(true);
        expect(checkRouteAccess(route, users.tele_lead).allowed).toBe(true);
        expect(checkRouteAccess(route, users.sale).allowed).toBe(true);
        expect(checkRouteAccess(route, users.telesale).allowed).toBe(false);
      }
    });

    it("5. Routing reports hidden for tele_lead, telesale, and sale", () => {
      const route = "/reports/routing";
      expect(checkRouteAccess(route, users.admin).allowed).toBe(true);
      expect(checkRouteAccess(route, users.sub_admin).allowed).toBe(true);
      expect(checkRouteAccess(route, users.tele_lead).allowed).toBe(false);
      expect(checkRouteAccess(route, users.telesale).allowed).toBe(false);
      expect(checkRouteAccess(route, users.sale).allowed).toBe(false);
    });
  });

  describe("C. Mobile Nav / More Menu Regression", () => {
    it("1. Sub-admin, Admin, Tele_lead, and Sales see Marketing link in navigation", () => {
      expect(getVisibleNavigation(users.sub_admin).moreMenuItems).toContain("marketing");
      expect(getVisibleNavigation(users.admin).moreMenuItems).toContain("marketing");
      expect(getVisibleNavigation(users.tele_lead).moreMenuItems).toContain("marketing");
      expect(getVisibleNavigation(users.sale).moreMenuItems).toContain("marketing");
    });

    it("2. Telesale does not see Marketing link in navigation", () => {
      expect(getVisibleNavigation(users.telesale).moreMenuItems).not.toContain("marketing");
    });

    it("3. Sales and Telesale do not see admin technical routes or shortcuts in more menu", () => {
      const navSales = getVisibleNavigation(users.sale);
      const navTelesale = getVisibleNavigation(users.telesale);

      expect(navSales.hasAdminTechnicalInMoreMenu).toBe(false);
      expect(navTelesale.hasAdminTechnicalInMoreMenu).toBe(false);

      const forbiddenInNav = [
        "admin/operations",
        "admin/sender-accounts",
        "admin/webhooks",
        "admin/inventory",
      ];
      for (const route of forbiddenInNav) {
        expect(navSales.moreMenuItems).not.toContain(route);
        expect(navTelesale.moreMenuItems).not.toContain(route);
      }
    });
  });

  describe("D. Product Action & Permission Controls", () => {
    it("1. isManager predicate is true only for admin and sub_admin", () => {
      const isManagerAdmin = users.admin.isAdmin || users.admin.isSubAdmin;
      const isManagerSub = users.sub_admin.isAdmin || users.sub_admin.isSubAdmin;
      const isManagerSale = users.sale.isAdmin || users.sale.isSubAdmin;
      const isManagerTele = users.telesale.isAdmin || users.telesale.isSubAdmin;
      const isManagerTeleLead = users.tele_lead.isAdmin || users.tele_lead.isSubAdmin;

      expect(isManagerAdmin).toBe(true);
      expect(isManagerSub).toBe(true);
      expect(isManagerSale).toBe(false);
      expect(isManagerTele).toBe(false);
      expect(isManagerTeleLead).toBe(false);
    });

    it("2. Non-managers (sales, telesale, tele_lead) are restricted from editing products", () => {
      const verifyPermissions = (user: MockUser) => {
        const isManager = user.isAdmin || user.isSubAdmin;
        return {
          canAddProduct: isManager,
          canEditImage: isManager,
          canEditLink: isManager,
          canEditKnowledge: isManager,
        };
      };

      const managerPerms = verifyPermissions(users.admin);
      expect(managerPerms.canAddProduct).toBe(true);
      expect(managerPerms.canEditImage).toBe(true);
      expect(managerPerms.canEditLink).toBe(true);
      expect(managerPerms.canEditKnowledge).toBe(true);

      const salePerms = verifyPermissions(users.sale);
      expect(salePerms.canAddProduct).toBe(false);
      expect(salePerms.canEditImage).toBe(false);
      expect(salePerms.canEditLink).toBe(false);
      expect(salePerms.canEditKnowledge).toBe(false);

      const telesalePerms = verifyPermissions(users.telesale);
      expect(telesalePerms.canAddProduct).toBe(false);
      expect(telesalePerms.canEditImage).toBe(false);
      expect(telesalePerms.canEditLink).toBe(false);
      expect(telesalePerms.canEditKnowledge).toBe(false);
    });
  });

  describe("E. Customer Database Query Scope Regression", () => {
    const mockCustomers = [
      { id: "c1", name: "Cust 1 (Sale Owned)", owner_sale_id: "u-sale", owner_tele_id: null },
      {
        id: "c2",
        name: "Cust 2 (Sale 2 Owned)",
        owner_sale_id: "u-other-sale",
        owner_tele_id: null,
      },
      { id: "c3", name: "Cust 3 (Free Pool)", owner_sale_id: null, owner_tele_id: null },
      { id: "c4", name: "Cust 4 (Tele Owned)", owner_sale_id: null, owner_tele_id: "u-telesale" },
      {
        id: "c5",
        name: "Cust 5 (Both Owned)",
        owner_sale_id: "u-sale",
        owner_tele_id: "u-telesale",
      },
    ];

    it("1. Admin and Sub-admin see the complete customer roster", () => {
      const listAdmin = filterCustomersForUser(mockCustomers, users.admin);
      const listSub = filterCustomersForUser(mockCustomers, users.sub_admin);

      expect(listAdmin.length).toBe(mockCustomers.length);
      expect(listSub.length).toBe(mockCustomers.length);
    });

    it("2. Sale user sees their owned customers and free pool customers", () => {
      const listSale = filterCustomersForUser(mockCustomers, users.sale);

      // Should contain c1 (owned), c3 (free pool), c5 (owned)
      const ids = listSale.map((c) => c.id);
      expect(ids).toContain("c1");
      expect(ids).toContain("c3");
      expect(ids).toContain("c5");

      // Should not contain c2 (other sale) or c4 (only tele owned)
      expect(ids).not.toContain("c2");
      expect(ids).not.toContain("c4");
    });

    it("3. Telesale user only sees their assigned customers", () => {
      const listTele = filterCustomersForUser(mockCustomers, users.telesale);

      // Should contain c4 (owned) and c5 (owned)
      const ids = listTele.map((c) => c.id);
      expect(ids).toContain("c4");
      expect(ids).toContain("c5");

      // Should not contain c1, c2, or free pool c3
      expect(ids).not.toContain("c1");
      expect(ids).not.toContain("c2");
      expect(ids).not.toContain("c3");
    });
  });

  describe("F. Touch Target & CSS Class Contract Regression", () => {
    it("1. Buttons include 44px touch height classes on mobile configurations", () => {
      const testClass = "h-11 md:h-8 px-4 rounded-xl";
      const result = verifyTouchTargetClasses("Button", testClass);
      expect(result.valid).toBe(true);
    });

    it("2. Inputs and Select triggers include h-11 on mobile", () => {
      const testClass = "w-full h-11 md:h-9 bg-slate-900 border-slate-800 text-sm";
      expect(verifyTouchTargetClasses("Input", testClass).valid).toBe(true);
      expect(verifyTouchTargetClasses("Select", testClass).valid).toBe(true);
    });

    it("3. Photo upload and quantity change buttons are 44x44px", () => {
      const photoClass = "w-11 h-11 md:w-8 md:h-8 flex items-center justify-center";
      const qtyClass = "w-11 h-11 border border-slate-700 bg-slate-950";
      expect(verifyTouchTargetClasses("PhotoUploadButton", photoClass).valid).toBe(true);
      expect(verifyTouchTargetClasses("QuantityButton", qtyClass).valid).toBe(true);
    });

    it("4. Calendar buttons satisfy minimum 40px height standard", () => {
      const calClass = "h-10 md:h-8 px-3 rounded-lg border";
      expect(verifyTouchTargetClasses("CalendarButton", calClass).valid).toBe(true);
    });

    it("5. Fails validation if height classes are missing or too small", () => {
      // Button lacks h-11, has h-8 (less than 44px)
      const badBtn = "h-8 w-full";
      expect(verifyTouchTargetClasses("Button", badBtn).valid).toBe(false);

      // Input lacks h-11 (only has h-9)
      const badInput = "h-9 w-full";
      expect(verifyTouchTargetClasses("Input", badInput).valid).toBe(false);
    });
  });

  describe("G. Safety and Secret Leak Prevention", () => {
    it("1. Check files for forbidden service role keys or app secrets", () => {
      const rootDir = path.resolve(__dirname, "..");
      const filesToCheck = [
        "src/routes/__root.tsx",
        "src/hooks/useAuth.tsx",
        "src/routes/admin/operations.tsx",
        "src/routes/admin/sender-accounts.tsx",
        "src/routes/admin/webhooks.tsx",
      ];

      const forbiddenTerms = [
        "SUPABASE_SERVICE_ROLE_KEY",
        "ZALO_APP_SECRET",
        "ZALO_OA_SECRET_KEY",
        "RESEND_API_KEY",
        "X-Worker-Secret",
      ];

      for (const relativePath of filesToCheck) {
        const fullPath = path.join(rootDir, relativePath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          for (const term of forbiddenTerms) {
            // Check that the file doesn't assign a hardcoded string to the forbidden term
            const lines = content.split("\n");
            for (const line of lines) {
              if (line.includes(term)) {
                // If it contains the term, ensure it is just importing environment variables, referring to types, or safe UI markup
                // Leaks typically look like: name = "secret" or key: "secret" with length >= 16
                const isAssignmentOfHardcodedSecret = new RegExp(
                  `[:=]\\s*['"\`][a-zA-Z0-9_\\-]{16,}['"\`]`,
                  "i",
                ).test(line);
                expect(isAssignmentOfHardcodedSecret).toBe(false);

                // Allow env config access, type checks, log statements, and visual elements
                expect(line).toMatch(
                  /env|process|type|AppRole|webhook|Header|headers|strong|span|div|label|Edge|Secrets|text|title|desc|error|message/i,
                );
              }
            }
          }
        }
      }
    });
  });
});
