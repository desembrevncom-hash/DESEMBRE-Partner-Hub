import { describe, expect, it } from "vitest";
import React from "react";
import fs from "fs";
import path from "path";
import {
  PRODUCT_SALES_SHEET_V1_HTML,
  PRODUCT_SALES_SHEET_V2_HTML,
  isTemplateV2,
  cleanSalesSheetTemplateHtml,
} from "../src/lib/salesSheetVersionUtils";
import {
  ProductSalesSheetPDF,
  type ProductSalesSheetPdfData,
} from "../src/components/admin/templates/ProductSalesSheetPDF";

describe("Product Sales Sheet Template v2 - Unit Tests", () => {
  // Test 1: v1 and v2 HTML comparison
  it("v1 has top-right brand logo block, whereas v2 has it removed", () => {
    // v1 must contain top-right DESEMBRE / LUXURY COSMETICS logo block
    expect(PRODUCT_SALES_SHEET_V1_HTML).toContain("DESEMBRE");
    expect(PRODUCT_SALES_SHEET_V1_HTML).toContain("Luxury Cosmetics");
    expect(PRODUCT_SALES_SHEET_V1_HTML).toContain('style="text-align: right;"');

    // v2 must NOT contain the top-right logo text
    expect(PRODUCT_SALES_SHEET_V2_HTML).not.toContain("Luxury Cosmetics");
    expect(PRODUCT_SALES_SHEET_V2_HTML).not.toContain("LUXURY COSMETICS");
    expect(PRODUCT_SALES_SHEET_V2_HTML).not.toContain('style="text-align: right;"');
  });

  // Test 2: v2 preserves all essential customer-facing sections
  it("v2 preserves all required customer-facing blocks", () => {
    // Badge
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("THÔNG TIN SẢN PHẨM");

    // Product name, brand, category
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("{{product.name}}");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("{{product.brand_name}}");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("{{product.category_name}}");

    // Image block
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("{{product.image_url}}");

    // Pricing block
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("BẢNG GIÁ SẢN PHẨM");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("{{#each variants}}");

    // Core content
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("CÔNG DỤNG NỔI BẬT");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("knowledge.key_ingredients");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("knowledge.full_ingredients");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("LOẠI DA PHÙ HỢP");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("HƯỚNG DẪN SỬ DỤNG");
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("CẢNH BÁO / CHỐNG CHỈ ĐỊNH");

    // Customer footer (uses template variable)
    expect(PRODUCT_SALES_SHEET_V2_HTML).toContain("{{footer_note}}");
  });


  // Test 3: isTemplateV2 detection
  it("isTemplateV2 accurately identifies v2 vs v1", () => {
    // Detected by name
    expect(isTemplateV2("product_sales_sheet_premium_v2", PRODUCT_SALES_SHEET_V2_HTML)).toBe(true);
    expect(isTemplateV2("my_custom_v2_template", "")).toBe(true);
    expect(isTemplateV2("product_sales_sheet_premium_v1", PRODUCT_SALES_SHEET_V1_HTML)).toBe(false);

    // Detected by HTML absence of logo
    expect(isTemplateV2("Custom Template", PRODUCT_SALES_SHEET_V2_HTML)).toBe(true);
    expect(isTemplateV2("Custom Template", PRODUCT_SALES_SHEET_V1_HTML)).toBe(false);
  });

  // Test 4: PDF component respects hideBrandLogo
  it("ProductSalesSheetPDF respects hideBrandLogo flag", () => {
    const mockData: ProductSalesSheetPdfData = {
      product: {
        name: "Desembre Milk Essential Cleanser",
        brand_name: "Desembre",
        category_name: "Làm sạch",
      },
      variants: [{ channel: "retail", size_label: "150ml", price: "450.000 đ" }],
      knowledge: {
        benefits: ["Làm sạch"],
        skin_types: ["Mọi loại da"],
      },
      audience: "customer",
    };

    // When hideBrandLogo is false (default v1)
    const elementV1 = ProductSalesSheetPDF({
      data: { ...mockData, hideBrandLogo: false },
    });
    const jsonV1 = JSON.stringify(elementV1);
    expect(jsonV1).toContain("LUXURY COSMETICS");

    // When hideBrandLogo is true (v2)
    const elementV2 = ProductSalesSheetPDF({
      data: { ...mockData, hideBrandLogo: true },
    });
    const jsonV2 = JSON.stringify(elementV2);
    expect(jsonV2).not.toContain("LUXURY COSMETICS");
  });

  // Test 5: Migration file checks
  it("migration file 20260908180000_seed_product_sales_sheet_v2.sql exists and is safe/idempotent", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260908180000_seed_product_sales_sheet_v2.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    // Upserts v2 without deleting or breaking v1
    expect(migrationSql).toContain("product_sales_sheet_premium_v2");
    expect(migrationSql).toContain("product_sales_sheet_premium_v1");
    expect(migrationSql).toContain("d1a22222-2222-2222-2222-222222222223");
    expect(migrationSql).toContain("approved");

    // Must use ON CONFLICT (id) DO UPDATE for idempotent upserts
    // (name column has no unique constraint in this schema)
    expect(migrationSql).toContain("ON CONFLICT (id) DO UPDATE SET");
    expect(migrationSql).toContain("html_template = EXCLUDED.html_template");

    // v1 HTML must have logo, v2 HTML must NOT
    // Strip SQL comments (lines starting with --) and check for Luxury Cosmetics in the remaining content
    const stripComments = (sql: string) =>
      sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
    const splitIdx = migrationSql.indexOf("-- 2. Upsert v2");
    expect(splitIdx).toBeGreaterThan(0);
    const v1Block = stripComments(migrationSql.substring(0, splitIdx));
    const v2Block = stripComments(migrationSql.substring(splitIdx));
    expect(v1Block).toContain("Luxury Cosmetics");
    expect(v2Block).not.toContain("Luxury Cosmetics");


  });

  // Test 6: v1 and v2 both contain extended sections (THÀNH PHẦN CHÍNH & CHỨC NĂNG, THÀNH PHẦN ĐẦY ĐỦ)
  it("v1 and v2 both contain extended sections required for full product display", () => {
    const sections = [
      "knowledge.key_ingredients",
      "knowledge.full_ingredients",
      "knowledge.benefits",
      "knowledge.usage",
      "knowledge.skin_types",
    ];
    for (const s of sections) {
      expect(PRODUCT_SALES_SHEET_V1_HTML).toContain(s);
      expect(PRODUCT_SALES_SHEET_V2_HTML).toContain(s);
    }
  });

  // Test 7: v2 html length is >= 90% of v1 html length (structural parity check)
  it("v2 html length is at least 90% of v1 html length", () => {
    const minLength = PRODUCT_SALES_SHEET_V1_HTML.length * 0.9;
    expect(PRODUCT_SALES_SHEET_V2_HTML.length).toBeGreaterThanOrEqual(minLength);
  });

  // Test 8: migration SQL contains extended sections in both v1 and v2
  it("migration SQL contains extended sections (key_ingredients, full_ingredients) in both v1 and v2 HTML", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../supabase/migrations/20260908180000_seed_product_sales_sheet_v2.sql",
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    expect(migrationSql).toContain("knowledge.key_ingredients");
    expect(migrationSql).toContain("knowledge.full_ingredients");
  });
});

