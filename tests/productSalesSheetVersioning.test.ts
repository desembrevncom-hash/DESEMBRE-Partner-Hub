import { describe, expect, it } from "vitest";
import {
  sortSalesSheetVersions,
  isVersionDefault,
  findLatestApprovedVersion,
  resolveActiveSalesSheet,
  resolveSalesDisplaySheet,
  formatSalesSheetOptionLabel,
  normalizeSalesSheetContent,
  type SalesSheetVersionItem,
} from "../src/lib/salesSheetVersionUtils";

describe("Product Sales Sheet Versioning & Default Preview Workflow", () => {
  const sampleVersions: SalesSheetVersionItem[] = [
    {
      id: "sheet-v1",
      catalog_product_id: "prod-1",
      version: 1,
      status: "approved",
      is_current: false,
      is_default: false,
      created_at: "2026-08-01T10:00:00Z",
      title: "Sales Sheet v1",
      content_json: {
        product: { name: "Kem Dưỡng Desembre v1" },
        knowledge: { benefits: ["Dưỡng ẩm cơ bản"] },
      },
    },
    {
      id: "sheet-v2",
      catalog_product_id: "prod-1",
      version: 2,
      status: "approved",
      is_current: true,
      is_default: true,
      created_at: "2026-08-15T10:00:00Z",
      title: "Sales Sheet v2",
      content_json: {
        product: { name: "Kem Dưỡng Desembre v2" },
        knowledge: { benefits: ["Dưỡng ẩm sâu", "Phục hồi da"] },
      },
    },
    {
      id: "sheet-v3",
      catalog_product_id: "prod-1",
      version: 3,
      status: "draft",
      is_current: false,
      is_default: false,
      created_at: "2026-09-01T10:00:00Z",
      title: "Sales Sheet v3",
      content_json: {
        product: { name: "Kem Dưỡng Desembre v3 (Đang soạn thảo)" },
        knowledge: { benefits: ["Dưỡng ẩm siêu cấp"] },
      },
    },
  ];

  // 1. Sorting logic
  it("sorts versions newest first (version descending, then created_at descending)", () => {
    const sorted = sortSalesSheetVersions(sampleVersions);
    expect(sorted.map((s) => s.version)).toEqual([3, 2, 1]);
    expect(sorted[0].id).toBe("sheet-v3");
    expect(sorted[2].id).toBe("sheet-v1");
  });

  // 2. Identification of latest approved version
  it("identifies the latest approved version", () => {
    const latestApproved = findLatestApprovedVersion(sampleVersions);
    expect(latestApproved).toBeDefined();
    expect(latestApproved?.id).toBe("sheet-v2");
    expect(latestApproved?.version).toBe(2);
    expect(latestApproved?.status).toBe("approved");
  });

  // 3. Dropdown version selection & immediate preview state update
  it("resolves active sheet directly to selectedId when user changes dropdown", () => {
    // When user specifically selects v1 from dropdown:
    const activeV1 = resolveActiveSalesSheet(sampleVersions, {
      targetSelectedId: "sheet-v1",
    });
    expect(activeV1?.id).toBe("sheet-v1");
    expect(activeV1?.version).toBe(1);

    // When user selects v3 (draft) from dropdown:
    const activeV3 = resolveActiveSalesSheet(sampleVersions, {
      targetSelectedId: "sheet-v3",
    });
    expect(activeV3?.id).toBe("sheet-v3");
    expect(activeV3?.version).toBe(3);
  });

  // 4. Default selection on initial dialog open
  it("resolves active sheet to approved default version on initial load if no targetId passed", () => {
    const initialActive = resolveActiveSalesSheet(sampleVersions);
    expect(initialActive?.id).toBe("sheet-v2");
    expect(initialActive?.version).toBe(2);
    expect(isVersionDefault(initialActive!)).toBe(true);
  });

  // 5. Automatic promotion when saving new approved version
  it("switches default to new approved version (e.g. v4) after promotion", () => {
    // Simulate admin approving v4: v2 default cleared, v4 set as default
    const updatedVersions: SalesSheetVersionItem[] = [
      ...sampleVersions.map((v) => ({
        ...v,
        is_current: false,
        is_default: false,
      })),
      {
        id: "sheet-v4",
        catalog_product_id: "prod-1",
        version: 4,
        status: "approved",
        is_current: true,
        is_default: true,
        created_at: "2026-09-08T10:00:00Z",
        title: "Sales Sheet v4",
      },
    ];

    const active = resolveActiveSalesSheet(updatedVersions);
    expect(active?.id).toBe("sheet-v4");
    expect(active?.version).toBe(4);
    expect(active?.status).toBe("approved");
    expect(isVersionDefault(active!)).toBe(true);
  });

  // 6. Sales/Staff access control (Never view draft; see approved default)
  it("ensures Sales/Staff users see the approved default version, never drafts", () => {
    // When v2 is default approved and v3 is draft
    const salesSheet = resolveSalesDisplaySheet(sampleVersions, false);
    expect(salesSheet?.id).toBe("sheet-v2");
    expect(salesSheet?.status).toBe("approved");

    // Even if v3 draft is newer, Sales never sees v3
    expect(salesSheet?.id).not.toBe("sheet-v3");
  });

  // 7. Sales/Staff fallback to latest approved if no default is marked
  it("falls back to latest approved version for Sales if no sheet is explicitly marked default", () => {
    const noDefaultVersions: SalesSheetVersionItem[] = sampleVersions.map((v) => ({
      ...v,
      is_current: false,
      is_default: false,
    }));

    const salesSheet = resolveSalesDisplaySheet(noDefaultVersions, false);
    expect(salesSheet?.id).toBe("sheet-v2"); // latest approved
    expect(salesSheet?.version).toBe(2);
  });

  // 8. Sales/Staff returns undefined if only draft versions exist
  it("returns undefined for Sales if only draft versions exist", () => {
    const draftOnlyVersions: SalesSheetVersionItem[] = [
      {
        id: "sheet-draft-1",
        version: 1,
        status: "draft",
        is_current: false,
        is_default: false,
        created_at: "2026-09-01T00:00:00Z",
      },
    ];

    const salesSheet = resolveSalesDisplaySheet(draftOnlyVersions, false);
    expect(salesSheet).toBeUndefined();
  });

  // 9. Dropdown label formatting
  it("formats dropdown options with version, status, date, and default / latest badges", () => {
    const latestApproved = findLatestApprovedVersion(sampleVersions);

    // v2 is default approved: should have ★ Mặc định
    const v2Label = formatSalesSheetOptionLabel(sampleVersions[1], latestApproved?.id);
    expect(v2Label).toContain("v2");
    expect(v2Label).toContain("(Duyệt)");
    expect(v2Label).toContain("★ Mặc định");

    // v3 is draft: should show (Nháp) and no default
    const v3Label = formatSalesSheetOptionLabel(sampleVersions[2], latestApproved?.id);
    expect(v3Label).toContain("v3");
    expect(v3Label).toContain("(Nháp)");
    expect(v3Label).not.toContain("★ Mặc định");
  });

  // 10. Content normalization prevents undefined crashes
  it("normalizes malformed or partial content_json cleanly", () => {
    const normalized = normalizeSalesSheetContent(
      {
        product: { name: "Test Product" },
        // pricing & knowledge completely omitted
      },
      "Fallback Product",
      "Fallback Category",
    );

    expect(normalized.product.name).toBe("Test Product");
    expect(normalized.product.category_name).toBe("Fallback Category");
    expect(Array.isArray(normalized.pricing.retail)).toBe(true);
    expect(Array.isArray(normalized.knowledge.benefits)).toBe(true);
    expect(Array.isArray(normalized.knowledge.skin_types)).toBe(true);
    expect(normalized.footer_note).toBe(
      "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
    );
  });
});
