import { describe, it, expect } from "vitest";
import {
  extractPreviewBullets,
  extractIngredientNames,
} from "../src/lib/productPreviewExtractors";
import { buildPublicProductProfile } from "../src/lib/publicProductProfile";
import fs from "fs";
import path from "path";

describe("Product Preview Extractors & Catalog Card Information Hierarchy", () => {
  it("1. extractIngredientNames turns 'Aloe Vera: Làm dịu, cấp ẩm' into 'Aloe Vera'", () => {
    const input = [
      "Aloe Vera: Làm dịu, cấp ẩm",
      "Hyaluronic Acid (Cấp ẩm sâu 24h)",
      "Niacinamide: Dưỡng trắng da",
      "Peptide: Phục hồi hàng rào bảo vệ",
    ];

    const result = extractIngredientNames(input, 3);
    expect(result).toEqual(["Aloe Vera", "Hyaluronic Acid", "Niacinamide"]);
  });

  it("2. extractPreviewBullets normalizes multiline strings and arrays into bullet items", () => {
    const stringInput = "- Sữa rửa mặt dịu nhẹ\n- Giúp cân bằng độ pH\n- Không gây kích ứng";
    const bullets = extractPreviewBullets(stringInput, 2);
    expect(bullets).toEqual(["Sữa rửa mặt dịu nhẹ", "Giúp cân bằng độ pH"]);
  });

  it("3. buildPublicProductProfile populates highlightPreview from benefits first (fallback to product_characteristics)", () => {
    const rawKnowledgeWithBenefits = {
      name: "Desembre Oxygen Water Cream",
      benefits: "- Tăng cường cấp ẩm 24h\n- Làm dịu da mẩn đỏ",
      product_characteristics: "- Đặc tính 1\n- Đặc tính 2",
      ingredient_highlights: [
        "Oxygen Water: Cung cấp oxy cho tế bào da",
        "Peptide: Tăng sinh collagen",
      ],
      qa_status: "approved",
      is_active: true,
      is_public: true,
    };

    const profileWithBenefits = buildPublicProductProfile(rawKnowledgeWithBenefits);

    expect(profileWithBenefits.highlightPreview).toEqual([
      "Tăng cường cấp ẩm 24h",
      "Làm dịu da mẩn đỏ",
    ]);

    // Fallback when benefits is empty
    const rawKnowledgeNoBenefits = {
      name: "Desembre Oxygen Water Cream",
      benefits: "",
      product_characteristics: "- Phục hồi da nhạy cảm\n- Tăng cường độ đàn hồi",
      qa_status: "approved",
      is_active: true,
      is_public: true,
    };

    const profileNoBenefits = buildPublicProductProfile(rawKnowledgeNoBenefits);

    expect(profileNoBenefits.highlightPreview).toEqual([
      "Phục hồi da nhạy cảm",
      "Tăng cường độ đàn hồi",
    ]);
  });

  it("4. CatalogProductCard does not render product.description and uses label ĐIỂM NỔI BẬT (not ĐẶC TÍNH)", () => {
    const cardPath = path.resolve(__dirname, "../src/features/catalog/CatalogProductCard.tsx");
    const fileContent = fs.readFileSync(cardPath, "utf-8");

    // Must NOT render product.description paragraph
    expect(fileContent.includes("product.description")).toBe(false);

    // Renders label ĐIỂM NỔI BẬT
    expect(fileContent).toContain("ĐIỂM NỔI BẬT");

    // Must NOT render label ĐẶC TÍNH
    expect(fileContent.includes("ĐẶC TÍNH")).toBe(false);
  });

  it("5. CatalogProductCard renders activeIngredientPreview chips and hides section when empty", () => {
    const cardPath = path.resolve(__dirname, "../src/features/catalog/CatalogProductCard.tsx");
    const fileContent = fs.readFileSync(cardPath, "utf-8");

    // Renders chips conditionally
    expect(fileContent).toContain("product.activeIngredientPreview && product.activeIngredientPreview.length > 0");
    expect(fileContent).toContain("HOẠT CHẤT CHÍNH");
  });

  it("6. ProductDetailModal still contains product.description / profile.description for full detail view", () => {
    const modalPath = path.resolve(__dirname, "../src/features/catalog/ProductDetailModal.tsx");
    const fileContent = fs.readFileSync(modalPath, "utf-8");

    expect(fileContent).toContain("profile.description");
  });

  it("7. No full_ingredients or sales_pitch appears in catalog card source code", () => {
    const cardPath = path.resolve(__dirname, "../src/features/catalog/CatalogProductCard.tsx");
    const fileContent = fs.readFileSync(cardPath, "utf-8");

    const forbiddenFields = [
      "full_ingredients",
      "fullIngredients",
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
