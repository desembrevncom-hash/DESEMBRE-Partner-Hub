import { describe, expect, it } from "vitest";
import {
  dedupeSalesSheetIngredients,
  cleanSalesSheetTemplateHtml,
  extractIngredientName,
} from "../src/lib/salesSheetVersionUtils";
import { renderTemplate } from "../src/lib/documentTemplates";

describe("Product Sales Sheet Ingredient Deduplication & Section Normalization", () => {
  const sampleTemplate = `
    <div class="sales-sheet">
      <div class="section-benefits">
        <h4>CÔNG DỤNG NỔI BẬT</h4>
        <div>{{knowledge.benefits}}</div>
      </div>

      <!-- Ingredient Highlights -->
      <div>
        <h4>THÀNH PHẦN NỔI BẬT</h4>
        <div>{{knowledge.ingredient_highlights}}</div>
      </div>

      <!-- Key Ingredients & Functions -->
      <div>
        <h4>THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG</h4>
        <div>{{knowledge.key_ingredients}}</div>
      </div>

      <!-- Full Ingredients -->
      <div>
        <h4>THÀNH PHẦN ĐẦY ĐỦ</h4>
        <div>{{knowledge.full_ingredients}}</div>
      </div>

      <div>
        <h4>LOẠI DA PHÙ HỢP</h4>
        <div>{{knowledge.skin_types}}</div>
      </div>

      <div>
        <h4>HƯỚNG DẪN SỬ DỤNG</h4>
        <div>{{knowledge.usage}}</div>
      </div>

      <div>
        <h4>LƯU Ý TƯ VẤN</h4>
        <div>{{knowledge.sales_notes}}</div>
      </div>

      <div>
        <h4>CHỐNG CHỈ ĐỊNH</h4>
        <div>{{knowledge.warnings}}</div>
      </div>
    </div>
  `.trim();

  // Test 1: Sales Sheet with key_ingredients_functions renders "THÀNH PHẦN CHÍNH & CHỨC NĂNG" once
  // and does NOT render duplicated "THÀNH PHẦN NỔI BẬT" bullet list
  it("Test 1: Sales Sheet with key_ingredients renders THÀNH PHẦN CHÍNH & CHỨC NĂNG once and does NOT render THÀNH PHẦN NỔI BẬT", () => {
    const knowledge = {
      benefits: ["Làm sạch sâu bụi bẩn", "Duy trì độ ẩm"],
      key_ingredients: [
        "Tinh dầu hạt mắc ca: Cung cấp độ ẩm sâu và làm mềm mượt da",
        "Glycerin: Giữ nước và duy trì độ ẩm tự nhiên",
        "Allantoin: Làm dịu da và tái tạo tế bào",
      ],
      // Duplicated list that was previously duplicated
      ingredient_highlights: [
        "Tinh dầu hạt mắc ca: Cung cấp độ ẩm sâu và làm mềm mượt da",
        "Glycerin: Giữ nước và duy trì độ ẩm tự nhiên",
        "Allantoin: Làm dịu da và tái tạo tế bào",
      ],
      full_ingredients: "Water, Mineral Oil, Macadamia Integrifolia Seed Oil, Glycerin, Allantoin.",
      skin_types: ["Mọi loại da"],
      usage: ["Lấy 2-3ml thoa đều"],
      sales_notes: ["Phù hợp cả da nhạy cảm"],
      warnings: ["Không thoa lên vết thương hở"],
    };

    const deduped = dedupeSalesSheetIngredients(knowledge);

    // Assert deduplication results
    expect(deduped.has_key_ingredients).toBe(true);
    expect(deduped.show_ingredient_highlights).toBe(false);
    expect(deduped.key_ingredients).toHaveLength(3);
    expect(deduped.key_ingredients[0]).toBe(
      "Tinh dầu hạt mắc ca: Cung cấp độ ẩm sâu và làm mềm mượt da",
    );
    // ingredient_highlights overlapping with key_ingredients are deduped
    expect(deduped.ingredient_highlights).toEqual([]);

    // Clean template and render
    const cleanedTemplate = cleanSalesSheetTemplateHtml(sampleTemplate, deduped.has_key_ingredients);
    const renderedHtml = renderTemplate(cleanedTemplate, {
      knowledge: {
        benefits: knowledge.benefits.map((b) => `- ${b}`).join("\n"),
        key_ingredients: deduped.key_ingredients.map((k) => `- ${k}`).join("\n"),
        ingredient_highlights: deduped.show_ingredient_highlights
          ? deduped.ingredient_highlights.map((h) => `- ${h}`).join("\n")
          : "",
        full_ingredients: deduped.full_ingredients,
        skin_types: knowledge.skin_types.map((s) => `- ${s}`).join("\n"),
        usage: knowledge.usage.map((u) => `- ${u}`).join("\n"),
        sales_notes: knowledge.sales_notes.map((n) => `- ${n}`).join("\n"),
        warnings: knowledge.warnings.map((w) => `- ${w}`).join("\n"),
      },
    });

    // 1. "THÀNH PHẦN CHÍNH & CHỨC NĂNG" rendered exactly once
    const keyIngredientsMatches = renderedHtml.match(/THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG/g);
    expect(keyIngredientsMatches).toHaveLength(1);

    // 2. "THÀNH PHẦN NỔI BẬT" is NOT rendered
    expect(renderedHtml).not.toContain("THÀNH PHẦN NỔI BẬT");

    // 3. Full ingredients is rendered once
    const fullIngredientsMatches = renderedHtml.match(/THÀNH PHẦN ĐẦY ĐỦ/g);
    expect(fullIngredientsMatches).toHaveLength(1);
    expect(renderedHtml).toContain("Water, Mineral Oil, Macadamia Integrifolia Seed Oil");

    // 4. Content of key ingredients appears only once per ingredient
    const macadamiaMatches = renderedHtml.match(/Tinh dầu hạt mắc ca: Cung cấp độ ẩm sâu/g);
    expect(macadamiaMatches).toHaveLength(1);
  });

  // Test 2: Structured key_ingredients_functions object format is canonicalized to "Name: Function"
  it("Test 2: Structured key_ingredients_functions object format is canonicalized to 'Name: Function'", () => {
    const knowledge = {
      key_ingredients_functions: [
        { name: "Niacinamide", function: "Dưỡng trắng mờ thâm" },
        { name: "Arbutin", function: "Ức chế sắc tố melanin" },
      ],
      ingredient_highlights: ["Niacinamide", "Arbutin"],
      full_ingredients: "Aqua, Niacinamide, Arbutin, Glycerin.",
    };

    const deduped = dedupeSalesSheetIngredients(knowledge);

    expect(deduped.has_key_ingredients).toBe(true);
    expect(deduped.show_ingredient_highlights).toBe(false);
    expect(deduped.key_ingredients).toEqual([
      "Niacinamide: Dưỡng trắng mờ thâm",
      "Arbutin: Ức chế sắc tố melanin",
    ]);
    expect(deduped.full_ingredients).toBe("Aqua, Niacinamide, Arbutin, Glycerin.");
  });

  // Test 3: If key_ingredients is missing, ingredient_highlights (short tags) is rendered without error
  it("Test 3: If key_ingredients is missing, ingredient_highlights (short tags) is rendered as fallback", () => {
    const knowledge = {
      key_ingredients: [],
      ingredient_highlights: ["Chiết xuất trà xanh", "Vitamin C"],
      full_ingredients: "",
    };

    const deduped = dedupeSalesSheetIngredients(knowledge);

    expect(deduped.has_key_ingredients).toBe(false);
    expect(deduped.show_ingredient_highlights).toBe(true);
    expect(deduped.ingredient_highlights).toEqual(["Chiết xuất trà xanh", "Vitamin C"]);

    const cleanedTemplate = cleanSalesSheetTemplateHtml(sampleTemplate, deduped.has_key_ingredients);
    // Since has_key_ingredients is false, THÀNH PHẦN NỔI BẬT remains in template for fallback
    expect(cleanedTemplate).toContain("THÀNH PHẦN NỔI BẬT");

    const renderedHtml = renderTemplate(cleanedTemplate, {
      knowledge: {
        ingredient_highlights: deduped.ingredient_highlights.map((h) => `- ${h}`).join("\n"),
        key_ingredients: "Chưa có thông tin trong tài liệu nguồn.",
        full_ingredients: "Chưa có thông tin trong tài liệu nguồn.",
      },
    });

    expect(renderedHtml).toContain("THÀNH PHẦN NỔI BẬT");
    expect(renderedHtml).toContain("Chiết xuất trà xanh");
  });

  // Test 4: ingredient_highlights with accidental function descriptions is stripped to short tags
  it("Test 4: ingredient_highlights with accidental function descriptions is stripped to short tags only", () => {
    const knowledge = {
      key_ingredients: [],
      ingredient_highlights: [
        "Hyaluronic Acid: Cấp ẩm đa tầng",
        "Peptide: Tăng sinh collagen",
      ],
    };

    const deduped = dedupeSalesSheetIngredients(knowledge);

    expect(deduped.ingredient_highlights).toEqual(["Hyaluronic Acid", "Peptide"]);
  });

  // Test 5: extractIngredientName handles various bullet and punctuation patterns
  it("Test 5: extractIngredientName extracts clean normalized name", () => {
    expect(extractIngredientName("Tinh dầu hạt mắc ca: Cung cấp độ ẩm")).toBe(
      "tinh dầu hạt mắc ca",
    );
    expect(extractIngredientName("- **Glycerin**: Giữ ẩm tự nhiên")).toBe("glycerin");
    expect(extractIngredientName("Allantoin")).toBe("allantoin");
    expect(extractIngredientName("")).toBe("");
  });

  // Test 6: No empty section boxes - missing fields are replaced by fallback or hidden cleanly
  it("Test 6: No empty section boxes in Sales Sheet A4", () => {
    const knowledge = {
      benefits: ["Làm sáng da"],
      key_ingredients: ["Niacinamide: Giảm thâm"],
      ingredient_highlights: ["Niacinamide"],
      full_ingredients: "", // Missing
      skin_types: [], // Missing
      usage: [], // Missing
      sales_notes: [], // Missing
      warnings: [], // Missing
    };

    const deduped = dedupeSalesSheetIngredients(knowledge);

    const NO_INFO = "Chưa có thông tin trong tài liệu nguồn.";
    const cleanedTemplate = cleanSalesSheetTemplateHtml(sampleTemplate, deduped.has_key_ingredients);
    const renderedHtml = renderTemplate(cleanedTemplate, {
      knowledge: {
        benefits: "- Làm sáng da",
        key_ingredients: deduped.key_ingredients.map((k) => `- ${k}`).join("\n"),
        ingredient_highlights: "",
        full_ingredients: deduped.full_ingredients || NO_INFO,
        skin_types: NO_INFO,
        usage: NO_INFO,
        sales_notes: NO_INFO,
        warnings: NO_INFO,
      },
    });

    // Verify there are no empty content divs
    expect(renderedHtml).not.toContain("<div></div>");
    expect(renderedHtml).not.toContain("THÀNH PHẦN NỔI BẬT");
    expect(renderedHtml).toContain("THÀNH PHẦN CHÍNH &amp; CHỨC NĂNG");
    expect(renderedHtml).toContain("THÀNH PHẦN ĐẦY ĐỦ");
    expect(renderedHtml).toContain(NO_INFO);
  });

  // Test 7: Customer-facing mode strips internal training labels, consultation notes, and changes headers
  it("Test 7: Customer-facing mode removes internal labels and renders customer-safe headers", () => {
    const internalTemplate = `
      <div>
        <span>TÀI LIỆU ĐÀO TẠO NỘI BỘ</span>
        <h3>BẢNG GIÁ ĐỐI TÁC</h3>
        <div>{{knowledge.benefits}}</div>
        <div>{{knowledge.key_ingredients}}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <h4>LƯU Ý TƯ VẤN</h4>
            <div>{{knowledge.sales_notes}}</div>
          </div>
          <div>
            <h4>CHỐNG CHỈ ĐỊNH</h4>
            <div>{{knowledge.warnings}}</div>
          </div>
        </div>
        <div>Tài liệu lưu hành nội bộ Desembre | {{footer_note}}</div>
      </div>
    `.trim();

    const cleanedCustomerTemplate = cleanSalesSheetTemplateHtml(
      internalTemplate,
      true,
      "customer",
    );

    // Assert internal labels are removed or replaced
    expect(cleanedCustomerTemplate).not.toContain("TÀI LIỆU ĐÀO TẠO NỘI BỘ");
    expect(cleanedCustomerTemplate).not.toContain("LƯU Ý TƯ VẤN");
    expect(cleanedCustomerTemplate).not.toContain("BẢNG GIÁ ĐỐI TÁC");
    expect(cleanedCustomerTemplate).not.toContain("Tài liệu lưu hành nội bộ Desembre");

    // Assert customer-safe replacements exist
    expect(cleanedCustomerTemplate).toContain("THÔNG TIN SẢN PHẨM");
    expect(cleanedCustomerTemplate).toContain("BẢNG GIÁ SẢN PHẨM");
    expect(cleanedCustomerTemplate).toContain("CẢNH BÁO / CHỐNG CHỈ ĐỊNH");
    expect(cleanedCustomerTemplate).toContain("Thông tin sản phẩm được cung cấp bởi Desembre Vietnam");

    // Render with customer mode
    const rendered = renderTemplate(cleanedCustomerTemplate, {
      knowledge: {
        benefits: "- Làm sạch da",
        key_ingredients: "- Tinh dầu mắc ca: Giữ ẩm",
        sales_notes: "", // In customer mode, sales_notes is empty
        warnings: "- Tránh tiếp xúc mắt",
      },
      footer_note: "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.",
    });

    expect(rendered).not.toContain("TÀI LIỆU ĐÀO TẠO NỘI BỘ");
    expect(rendered).not.toContain("LƯU Ý TƯ VẤN");
    expect(rendered).toContain("THÔNG TIN SẢN PHẨM");
    expect(rendered).toContain("BẢNG GIÁ SẢN PHẨM");
    expect(rendered).toContain("CẢNH BÁO / CHỐNG CHỈ ĐỊNH");
    expect(rendered).toContain("Tránh tiếp xúc mắt");
  });

  // Test 8: Internal mode retains LƯU Ý TƯ VẤN and sales notes
  it("Test 8: Internal mode retains LƯU Ý TƯ VẤN and internal notes", () => {
    const internalTemplate = `
      <div>
        <span>TÀI LIỆU ĐÀO TẠO NỘI BỘ</span>
        <h3>BẢNG GIÁ ĐỐI TÁC</h3>
        <div>{{knowledge.benefits}}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          <div>
            <h4>LƯU Ý TƯ VẤN</h4>
            <div>{{knowledge.sales_notes}}</div>
          </div>
          <div>
            <h4>CHỐNG CHỈ ĐỊNH</h4>
            <div>{{knowledge.warnings}}</div>
          </div>
        </div>
      </div>
    `.trim();

    const cleanedInternalTemplate = cleanSalesSheetTemplateHtml(
      internalTemplate,
      true,
      "internal",
    );

    expect(cleanedInternalTemplate).toContain("LƯU Ý TƯ VẤN");

    const rendered = renderTemplate(cleanedInternalTemplate, {
      knowledge: {
        benefits: "- Dưỡng ẩm",
        sales_notes: "- Phù hợp chốt gói liệu trình spa",
        warnings: "- Tránh ánh nắng",
      },
    });

    expect(rendered).toContain("LƯU Ý TƯ VẤN");
    expect(rendered).toContain("Phù hợp chốt gói liệu trình spa");
  });
});
