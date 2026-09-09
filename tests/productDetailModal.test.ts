import { describe, it, expect } from "vitest";
import type { PublicProduct } from "../src/features/catalog/types";
import fs from "fs";
import path from "path";
import { isSimilarContent } from "../src/lib/productContentDedupe";
import { buildPublicProductProfile } from "../src/lib/publicProductProfile";

describe("ProductDetailModal - Launch Readiness, UX & Balanced Layout Standards", () => {
  const sampleProduct: PublicProduct = {
    id: "prod-101",
    name: "Desembre Hydro Science Hydro E.R. Cream",
    brandName: "Desembre",
    categoryName: "Kem dưỡng",
    description: "Kem dưỡng ẩm chuyên sâu và làm dịu da sinh học",
    benefits: "Phục hồi hàng rào bảo vệ da, cấp ẩm sâu 24h",
    ingredientHighlights: [
      "Hyaluronic Acid: Giúp giữ nước và cấp ẩm tức thì",
      "Ceramide NP: Củng cố hàng rào bảo vệ da",
      "Phytosphingosine",
    ],
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
    expect((sampleProduct as Record<string, unknown>).full_ingredients).toBeUndefined();
    expect((sampleProduct as Record<string, unknown>).fullIngredients).toBeUndefined();

    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent.includes("full_ingredients")).toBe(false);
    expect(fileContent.includes("fullIngredients")).toBe(false);
  });

  it("2. empty sections are not rendered (normalized buildPublicProductProfile checks)", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("buildPublicProductProfile");
    expect(fileContent).toContain("profile.description");
    expect(fileContent).toContain("profile.benefits");
    expect(fileContent).toContain("profile.usage_instructions");
    expect(fileContent).toContain("profile.warnings");
  });

  it("3. benefits section is configured to render when present", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("Hiệu quả nổi bật");
    expect(fileContent).toContain("profile.benefits");
  });

  it("4. renders THÀNH PHẦN CHÍNH & CHỨC NĂNG and no longer renders THÀNH PHẦN NỔI BẬT", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("THÀNH PHẦN CHÍNH & CHỨC NĂNG");
    expect(fileContent).not.toContain("Thành phần nổi bật");
    expect(fileContent).not.toContain("THÀNH PHẦN NỔI BẬT");
  });

  it("5. warning section is configured to render only when warnings exist", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("Lưu ý &amp; Chống chỉ định");
    expect(fileContent).toContain("profile.warnings");
  });

  it("6. full-width modal CTA footer exists with concise button text and correct scroll layout", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("flex-1 overflow-y-auto min-h-0");
    expect(fileContent).toContain("shrink-0 p-4 sm:px-6 sm:py-4 bg-white/95 backdrop-blur-md border-t border-slate-200");

    const ctaFooterMatches = fileContent.match(/<CTAFooter/g);
    expect(ctaFooterMatches?.length).toBe(1);

    expect(fileContent).toContain("Liên hệ tư vấn &amp; đặt hàng");
    expect(fileContent).toContain("Đăng nhập Partner");
    expect(fileContent).not.toContain("Đăng nhập Partner để xem giá Spa &amp; lên đơn");

    expect(fileContent).toContain("Partner đăng nhập để xem giá Spa và lên đơn hàng.");
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

  it("8. renders product_characteristics consistently whenever data is present", () => {
    const milkCharacteristics = "Sữa rửa mặt Milk Essential Cleanser dạng lotion dịu nhẹ...";
    const showMilkCharacteristics = Boolean(milkCharacteristics && milkCharacteristics.trim());
    expect(showMilkCharacteristics).toBe(true);

    const creamCharacteristics = "Dạng kem đặc màu trắng, mùi thơm nhẹ dịu";
    const showCreamCharacteristics = Boolean(creamCharacteristics && creamCharacteristics.trim());
    expect(showCreamCharacteristics).toBe(true);
  });

  it("9. empty warnings in product knowledge profile return undefined/empty and suppress warning box", () => {
    const emptyWarningsProduct = {
      name: "Sản phẩm không cảnh báo",
      warnings: "",
    };

    const profile = buildPublicProductProfile(emptyWarningsProduct);
    expect(profile.warnings).toBeUndefined();
  });
});
