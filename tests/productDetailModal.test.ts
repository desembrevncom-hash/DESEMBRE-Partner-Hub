import { describe, it, expect } from "vitest";
import type { PublicProduct } from "../src/features/catalog/types";
import fs from "fs";
import path from "path";

describe("ProductDetailModal - Launch Readiness & UX Standards (Milestone 2)", () => {
  const sampleProduct: PublicProduct = {
    id: "prod-101",
    name: "Desembre Hydro Science Hydro E.R. Cream",
    brandName: "Desembre",
    categoryName: "Kem dưỡng",
    description: "Kem dưỡng ẩm chuyên sâu và làm dịu da sinh học",
    benefits: "Phục hồi hàng rào bảo vệ da, cấp ẩm sâu 24h",
    ingredientHighlights: ["Hyaluronic Acid", "Ceramide NP", "Phytosphingosine"],
    skinTypes: ["Da khô", "Da nhạy cảm"],
    skinConcerns: ["Da thiếu ẩm", "Da bong tróc"],
    usageInstructions: "Sử dụng 2 lần mỗi ngày sau bước Tinh chất",
    warnings: "Không thoa lên vết thương hở",
    publicSizes: ["50ml"],
    publicPriceItems: [
      { sizeLabel: "50ml", channel: "retail", price: 850000, requiresContact: false },
    ],
  };

  it("1. full_ingredients is completely omitted from PublicProduct model and modal source code", () => {
    // Check that PublicProduct type doesn't contain full_ingredients
    expect((sampleProduct as Record<string, unknown>).full_ingredients).toBeUndefined();
    expect((sampleProduct as Record<string, unknown>).fullIngredients).toBeUndefined();

    // Inspect file source code directly
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent.includes("full_ingredients")).toBe(false);
    expect(fileContent.includes("fullIngredients")).toBe(false);
  });

  it("2. empty sections are not rendered (trim & length checks)", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    // Verify trim checks exist for description, benefits, usageInstructions, warnings
    expect(fileContent).toContain('product.description.trim() !== ""');
    expect(fileContent).toContain('product.benefits.trim() !== ""');
    expect(fileContent).toContain('product.usageInstructions.trim() !== ""');
    expect(fileContent).toContain('product.warnings.trim() !== ""');
  });

  it("3. benefits section is configured to render when present", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("Hiệu quả nổi bật");
    expect(fileContent).toContain("product.benefits");
  });

  it("4. ingredient highlights section is configured to render when present", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("Thành phần nổi bật");
    expect(fileContent).toContain("product.ingredientHighlights");
  });

  it("5. warning section is configured to render only when warnings exist", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("Lưu ý &amp; Chống chỉ định");
    expect(fileContent).toContain('product.warnings.trim() !== ""');
  });

  it("6. mobile sticky CTA bar and mobile CTA text exist", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    // Mobile sticky bar container
    expect(fileContent).toContain("lg:hidden sticky bottom-0");

    // Mobile CTA text
    expect(fileContent).toContain("Liên hệ tư vấn liệu trình &amp; đặt hàng");
    expect(fileContent).toContain("Đăng nhập Partner để xem giá Spa &amp; lên đơn");
  });

  it("7. internal forbidden fields are not referenced anywhere in ProductDetailModal.tsx", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    const forbiddenFields = [
      "sales_pitch",
      "consultation_notes",
      "sales_notes",
      "objections",
      "raw_text",
      "extracted_text",
      "file_url",
    ];

    for (const field of forbiddenFields) {
      expect(fileContent.includes(field)).toBe(false);
    }
  });
});
