import { describe, it, expect } from "vitest";
import { parseGuidebookMarkdown } from "../src/lib/catalogAdminDb";

describe("parseGuidebookMarkdown", () => {
  const milkEssentialCleanserGuidebook = `
Đặc tính sản phẩm:
Sữa rửa mặt dạng sữa dịu nhẹ, kết cấu mềm mịn giúp làm sạch sâu mà không gây tổn thương hàng rào bảo vệ tự nhiên của da. Phù hợp cho mọi loại da, đặc biệt là da nhạy cảm và da sau trị liệu.

Hướng dẫn sử dụng:
1. Lấy một lượng vừa đủ (khoảng 2-3ml) ra lòng bàn tay.
2. Thoa đều lên da mặt và massage nhẹ nhàng theo chuyển động tròn trong 1-2 phút.
3. Rửa sạch lại bằng nước ấm hoặc lau nhẹ bằng bọt biển ẩm.

Hiệu quả và tác dụng:
- Làm sạch sâu bụi bẩn, bã nhờn và cặn trang điểm
- Cân bằng độ ẩm và củng cố màng lipid bảo vệ da
- Làm dịu tức thì làn da khô căng, kích ứng

Thành phần:
Water, Mineral Oil, Macadamia Integrifolia Seed Oil, Glycerin, Caprylic/Capric Triglyceride, Propylene Glycol, Cetearyl Alcohol, Polysorbate 60, Glyceryl Stearate, PEG-100 Stearate, Stearic Acid, Sorbitan Stearate, Dimethicone, Carbomer, Triethanolamine, Methylparaben, Propylparaben, Allantoin, Disodium EDTA, Fragrance.

Thành phần chính và chức năng:
- Chiết xuất tinh dầu hạt mắc ca: Dưỡng ẩm sâu, làm mềm mượt da và chống oxy hóa
- Glycerin: Giữ nước, cấp ẩm và duy trì độ ẩm tự nhiên cho da
- Allantoin: Làm dịu da, kháng viêm và thúc đẩy tái tạo tế bào
`.trim();

  it("extracts all sections correctly from Desembre Milk Essential Cleanser sample", () => {
    const draft = parseGuidebookMarkdown(
      milkEssentialCleanserGuidebook,
      "Desembre Milk Essential Cleanser",
    );

    // 1. Product Characteristics
    expect(draft.product_characteristics).toBeDefined();
    expect(draft.product_characteristics).toContain("Sữa rửa mặt dạng sữa dịu nhẹ");
    expect(draft.product_characteristics).toContain("da sau trị liệu");

    // 2. Usage Instructions
    expect(draft.usage_instructions).toContain("Lấy một lượng vừa đủ");
    expect(draft.usage_instructions).toContain("Rửa sạch lại bằng nước ấm");

    // 3. Benefits & Effects
    expect(draft.effects).toContain("Làm sạch sâu bụi bẩn");
    expect(draft.benefits).toContain("Làm sạch sâu bụi bẩn");
    expect(draft.benefits_list).toHaveLength(3);

    // 4. Full Ingredients
    expect(draft.full_ingredients).toBeDefined();
    expect(draft.full_ingredients).toContain("Water, Mineral Oil, Macadamia Integrifolia Seed Oil");
    expect(draft.full_ingredients).toContain("Fragrance");

    // 5. Key Ingredients and Functions
    expect(draft.key_ingredients_functions).toHaveLength(3);
    expect(draft.key_ingredients_functions![0]).toEqual({
      name: "Chiết xuất tinh dầu hạt mắc ca",
      function: "Dưỡng ẩm sâu, làm mềm mượt da và chống oxy hóa",
    });
    expect(draft.key_ingredients_functions![1]).toEqual({
      name: "Glycerin",
      function: "Giữ nước, cấp ẩm và duy trì độ ẩm tự nhiên cho da",
    });
    expect(draft.key_ingredients_functions![2]).toEqual({
      name: "Allantoin",
      function: "Làm dịu da, kháng viêm và thúc đẩy tái tạo tế bào",
    });

    // 6. Ingredient Highlights - short ingredient names only, never fallback to generic
    expect(draft.ingredient_highlights).toHaveLength(3);
    expect(draft.ingredient_highlights).not.toContain("Chiết xuất tự nhiên");
    expect(draft.ingredient_highlights![0]).toBe("Chiết xuất tinh dầu hạt mắc ca");
  });

  it("handles markdown headings and bold variants", () => {
    const markdownSample = `
## Đặc tính sản phẩm
Tinh chất dưỡng trắng cô đặc.

## Công dụng chính
- Mờ thâm sạm
- Đều màu da

## Thành phần chính và chức năng
- Niacinamide: Giảm sắc tố melanin
- Arbutin: Dưỡng sáng an toàn

## Thành phần
Niacinamide, Arbutin, Aqua, Glycerin

## Phù hợp với
- Loại da: Da dầu, Da xỉn màu
- Vấn đề da: Thâm nám, tàn nhang
`;

    const draft = parseGuidebookMarkdown(markdownSample, "Serum Niacinamide");

    expect(draft.product_characteristics).toBe("Tinh chất dưỡng trắng cô đặc.");
    expect(draft.benefits).toContain("Mờ thâm sạm");
    expect(draft.full_ingredients).toBe("Niacinamide, Arbutin, Aqua, Glycerin");
    expect(draft.key_ingredients_functions).toHaveLength(2);
    expect(draft.key_ingredients_functions![0].name).toBe("Niacinamide");
    expect(draft.skin_types).toEqual(["Da dầu", "Da xỉn màu"]);
    expect(draft.skin_concerns).toEqual(["Thâm nám", "tàn nhang"]);
  });

  it("does not fall back to generic 'Chiết xuất tự nhiên' when key ingredients are empty", () => {
    const textWithoutIngredients = `
## Công dụng chính
- Cấp ẩm tức thì
`;
    const draft = parseGuidebookMarkdown(textWithoutIngredients);
    expect(draft.ingredient_highlights).toEqual([]);
    expect(draft.ingredient_highlights).not.toContain("Chiết xuất tự nhiên");
  });

  it("handles empty string gracefully", () => {
    const draft = parseGuidebookMarkdown("");
    expect(draft.benefits).toBe("");
    expect(draft.ingredient_highlights).toEqual([]);
    expect(draft.skin_types).toEqual([]);
    expect(draft.usage_instructions).toBe("");
  });
});
