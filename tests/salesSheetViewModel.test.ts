import { describe, expect, it } from "vitest";
import {
  buildSalesSheetViewModel,
  renderSalesSheetViewModelHtml,
} from "../src/lib/salesSheetViewModel";

describe("Sales Sheet View Model & Unified Customer/Internal Parity", () => {
  const sampleSheetData = {
    product: {
      name: "Desembre Oxygen Water Cream",
      brand_name: "Desembre",
      category_name: "Kem dưỡng",
      short_description: "Kem cấp ẩm phục hồi da nứt nẻ",
      image_url: "https://example.com/cream.jpg",
    },
    pricing: {
      retail: [{ sku: "OWC-50", size_label: "50ml", price: "850.000đ" }],
      salon: [{ sku: "OWC-250", size_label: "250ml", price: "2.100.000đ" }],
    },
    knowledge: {
      benefits: ["Tăng cường khả năng ngậm nước", "Làm dịu da nhạy cảm"],
      canonical_ingredients: ["Oxygen Water: Cung cấp oxy cho tế bào da", "Peptide: Tăng sinh collagen"],
      ingredient_highlights: ["Oxygen Water", "Peptide"],
      full_ingredients: "Water, Mineral Oil, Oxygen, Glycerin, Methylparaben.",
      skin_types: ["Da khô", "Da nhạy cảm"],
      usage: ["Thoa đều sau bước serum 2 lần/ngày"],
      sales_notes: ["Phù hợp tư vấn combo điều trị phục hồi sau laser"],
      warnings: ["Tránh tiếp xúc trực tiếp với vết thương hở"],
    },
    footer_note: "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
  };

  const sampleTemplate = `
    <div>
      <h1>{{product.name}}</h1>
      {{#if knowledge.benefits}}
      <div>
        <h4>CÔNG DỤNG NỔI BẬT</h4>
        <div>{{knowledge.benefits}}</div>
      </div>
      {{/if}}

      {{#if knowledge.key_ingredients}}
      <div>
        <h4>THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG</h4>
        <div>{{knowledge.key_ingredients}}</div>
      </div>
      {{/if}}

      {{#if knowledge.full_ingredients}}
      <div>
        <h4>THÀNH PHẦN ĐẦY ĐỦ</h4>
        <div>{{knowledge.full_ingredients}}</div>
      </div>
      {{/if}}

      {{#if knowledge.usage}}
      <div>
        <h4>HƯỚNG DẪN SỬ DỤNG</h4>
        <div>{{knowledge.usage}}</div>
      </div>
      {{/if}}

      {{#if knowledge.sales_notes}}
      <div>
        <h4>LƯU Ý TƯ VẤN</h4>
        <div>{{knowledge.sales_notes}}</div>
      </div>
      {{/if}}

      {{#if knowledge.warnings}}
      <div>
        <h4>CẢNH BẢO / CHỐNG CHỈ ĐỊNH</h4>
        <div>{{knowledge.warnings}}</div>
      </div>
      {{/if}}
    </div>
  `;

  // Test 1: Internal and Customer use same public field values when sheetData has data
  it("Test 1: Internal and Customer use exact same public field values when sheetData has data", () => {
    const internalVm = buildSalesSheetViewModel({
      sheetData: sampleSheetData,
      audience: "internal",
    });

    const customerVm = buildSalesSheetViewModel({
      sheetData: sampleSheetData,
      audience: "customer",
    });

    expect(customerVm.product.name).toBe(internalVm.product.name);
    expect(customerVm.product.brand_name).toBe(internalVm.product.brand_name);
    expect(customerVm.product.category_name).toBe(internalVm.product.category_name);
    expect(customerVm.product.short_description).toBe(internalVm.product.short_description);
    expect(customerVm.product.image_url).toBe(internalVm.product.image_url);
    expect(customerVm.benefits).toEqual(internalVm.benefits);
    expect(customerVm.ingredients).toEqual(internalVm.ingredients);
    expect(customerVm.skin_types).toEqual(internalVm.skin_types);
    expect(customerVm.usageInstructions).toEqual(internalVm.usageInstructions);
    expect(customerVm.warnings).toEqual(internalVm.warnings);
    expect(customerVm.variants).toEqual(internalVm.variants);
  });

  // Test 2: Customer strips internal-only fields but keeps benefits, ingredients, usage, warnings
  it("Test 2: Customer strips internal-only fields (sales_notes, full_ingredients) but keeps public fields", () => {
    const customerVm = buildSalesSheetViewModel({
      sheetData: sampleSheetData,
      audience: "customer",
    });

    // Internal fields stripped in Customer view model
    expect(customerVm.sales_notes).toEqual([]);
    expect(customerVm.full_ingredients).toBe("");

    // Public-safe fields retained
    expect(customerVm.benefits).toHaveLength(2);
    expect(customerVm.ingredients).toHaveLength(2);
    expect(customerVm.usageInstructions).toHaveLength(1);
    expect(customerVm.warnings).toHaveLength(1);

    const renderedCustomerHtml = renderSalesSheetViewModelHtml(customerVm, sampleTemplate);

    expect(renderedCustomerHtml).not.toContain("LƯU Ý TƯ VẤN");
    expect(renderedCustomerHtml).not.toContain("THÀNH PHẦN ĐẦY ĐỦ");
    expect(renderedCustomerHtml).toContain("CÔNG DỤNG NỔI BẬT");
    expect(renderedCustomerHtml).toContain("THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG");
    expect(renderedCustomerHtml).toContain("HƯỚNG DẪN SỬ DỤNG");
    expect(renderedCustomerHtml).toContain("CẢNH BÁO / CHỐNG CHỈ ĐỊNH");
  });

  // Test 3: Customer does not render empty warning box when warnings is empty
  it("Test 3: Customer does not render empty warning box when warnings array is empty", () => {
    const sheetDataNoWarnings = {
      ...sampleSheetData,
      knowledge: {
        ...sampleSheetData.knowledge,
        warnings: [],
      },
    };

    const customerVm = buildSalesSheetViewModel({
      sheetData: sheetDataNoWarnings,
      audience: "customer",
    });

    expect(customerVm.warnings).toEqual([]);

    const renderedCustomerHtml = renderSalesSheetViewModelHtml(customerVm, sampleTemplate);

    expect(renderedCustomerHtml).not.toContain("CẢNH BÁO / CHỐNG CHỈ ĐỊNH");
  });

  // Test 4: Customer ingredient source uses sheetData.canonical_ingredients before profile.ingredient_highlights
  it("Test 4: Customer ingredient source uses sheetData.canonical_ingredients before profile.ingredient_highlights fallback", () => {
    const profileFallback = {
      name: "Desembre Oxygen Water Cream",
      ingredient_highlights: ["Fallback Profile Ingredient 1", "Fallback Profile Ingredient 2"],
    };

    const customerVm = buildSalesSheetViewModel({
      sheetData: sampleSheetData,
      profile: profileFallback,
      audience: "customer",
    });

    // Uses sheetData canonical ingredients directly, does NOT use profile fallback or merge them
    expect(customerVm.ingredients).toEqual([
      "Oxygen Water: Cung cấp oxy cho tế bào da",
      "Peptide: Tăng sinh collagen",
    ]);
    expect(customerVm.__debugSource).toBe("sheetData");
  });

  // Test 5: Preview and PDF receive identical SalesSheetViewModel
  it("Test 5: Preview and PDF receive identical SalesSheetViewModel", () => {
    const customerVm = buildSalesSheetViewModel({
      sheetData: sampleSheetData,
      audience: "customer",
    });

    const pdfDataInput = {
      product: customerVm.product,
      variants: customerVm.variants,
      benefits: customerVm.benefits,
      ingredients: customerVm.ingredients,
      skin_types: customerVm.skin_types,
      usageInstructions: customerVm.usageInstructions,
      warnings: customerVm.warnings,
      footer_note: customerVm.footer_note,
      generated_at: customerVm.generated_at,
      audience: customerVm.audience,
    };

    expect(pdfDataInput.product).toEqual(customerVm.product);
    expect(pdfDataInput.variants).toEqual(customerVm.variants);
    expect(pdfDataInput.benefits).toEqual(customerVm.benefits);
    expect(pdfDataInput.ingredients).toEqual(customerVm.ingredients);
    expect(pdfDataInput.usageInstructions).toEqual(customerVm.usageInstructions);
    expect(pdfDataInput.warnings).toEqual(customerVm.warnings);
  });

  // Test 6: renderSalesSheetHtml contains ZERO {{ }} placeholders in output
  it("Test 6: renderSalesSheetHtml contains ZERO {{ }} placeholders in rendered output", () => {
    const customerVm = buildSalesSheetViewModel({
      sheetData: sampleSheetData,
      audience: "customer",
    });
    const html = renderSalesSheetViewModelHtml(customerVm);
    expect(html).not.toContain("{{");
    expect(html).not.toContain("}}");
  });

  // Test 7: Internal mode renders internal badge and sections without {{ }}
  it("Test 7: Internal mode renders internal badge and sections without {{ }}", () => {
    const internalVm = buildSalesSheetViewModel({
      sheetData: sampleSheetData,
      audience: "internal",
    });
    const html = renderSalesSheetViewModelHtml(internalVm);
    expect(html).not.toContain("{{");
    expect(html).toContain("TÀI LIỆU ĐÀO TẠO NỘI BỘ");
    expect(html).toContain("BẢNG GIÁ ĐỐI TÁC");
    expect(html).toContain("THÀNH PHẦN ĐẦY ĐỦ");
    expect(html).toContain("LƯU Ý TƯ VẤN");
  });
});
