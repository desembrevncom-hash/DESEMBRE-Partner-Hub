import { describe, expect, it } from "vitest";
import { normalizeTextForCompare, isSimilarContent } from "../src/lib/productContentDedupe";
import { buildPublicProductProfile } from "../src/lib/publicProductProfile";

describe("productContentDedupe", () => {
  describe("normalizeTextForCompare", () => {
    it("should normalize Vietnamese accents, punctuation, and casing", () => {
      const input = "Dạng Lotion KHÔNG BỌT, dịu nhẹ!!  Duy trì độ ẩm.";
      const result = normalizeTextForCompare(input);
      expect(result).toBe("dạng lotion không bọt dịu nhẹ duy trì độ ẩm");
    });

    it("should return empty string for empty or whitespace-only input", () => {
      expect(normalizeTextForCompare("")).toBe("");
      expect(normalizeTextForCompare("   ")).toBe("");
      expect(normalizeTextForCompare(null as any)).toBe("");
    });
  });

  describe("isSimilarContent", () => {
    it("should return true for identical or near-identical text", () => {
      const text1 = "Làm sạch bụi bẩn và bã nhờn nhẹ nhàng, duy trì độ ẩm tự nhiên cho da.";
      const text2 = "Làm sạch bụi bẩn bã nhờn nhẹ nhàng và duy trì độ ẩm tự nhiên cho làn da.";
      expect(isSimilarContent(text1, text2)).toBe(true);
    });

    it("should return true when text1 is substantially duplicated inside text2", () => {
      const text1 = "Làm sạch bụi bẩn bã nhờn duy trì độ ẩm.";
      const text2 = "Dạng lotion rửa mặt giúp làm sạch bụi bẩn bã nhờn duy trì độ ẩm tự nhiên.";
      expect(isSimilarContent(text1, text2)).toBe(true);
    });

    it("should return false for distinct content (e.g. form/texture vs outcomes)", () => {
      const characteristics = "Dạng lotion không bọt, dịu nhẹ, phù hợp sử dụng hằng ngày cho mọi loại da.";
      const benefits = "Làm sạch sâu bã nhờn, kháng khuẩn và hỗ trợ giảm mụn đầu đen hiệu quả.";
      expect(isSimilarContent(characteristics, benefits)).toBe(false);
    });

    it("should handle null or empty inputs safely without throwing", () => {
      expect(isSimilarContent("", "some text")).toBe(false);
      expect(isSimilarContent("some text", null as any)).toBe(false);
      expect(isSimilarContent(null as any, undefined as any)).toBe(false);
    });
  });

  describe("buildPublicProductProfile & Detail Modal safety", () => {
    it("should take benefits strictly from benefits field, without falling back to product_characteristics", () => {
      const rawProduct = {
        name: "Sữa rửa mặt Lotion",
        product_characteristics: "Dạng lotion không bọt dịu nhẹ",
        // benefits omitted
      };

      const profile = buildPublicProductProfile(rawProduct);
      expect(profile.benefits).toBeUndefined();
      expect(profile.product_characteristics).toBe("Dạng lotion không bọt dịu nhẹ");
    });

    it("should suppress characteristics when similar to benefits", () => {
      const characteristics = "Làm sạch bụi bẩn bã nhờn nhẹ nhàng duy trì độ ẩm";
      const benefits = "Làm sạch bụi bẩn và bã nhờn nhẹ nhàng, giúp duy trì độ ẩm tự nhiên";
      const description = "Sữa rửa mặt dịu nhẹ Desembre";

      const isDupWithBenefits = isSimilarContent(characteristics, benefits);
      const isDupWithDesc = isSimilarContent(characteristics, description);

      const showCharacteristics = Boolean(characteristics) && !isDupWithBenefits && !isDupWithDesc;
      expect(showCharacteristics).toBe(false);
    });

    it("should show characteristics when distinct from benefits and description", () => {
      const characteristics = "Dạng lotion không bọt dịu nhẹ phù hợp dùng hàng ngày";
      const benefits = "Tẩy sạch tế bào chết, làm mờ vết thâm sạm và dưỡng sáng làn da";
      const description = "Sữa rửa mặt dưỡng da Desembre";

      const isDupWithBenefits = isSimilarContent(characteristics, benefits);
      const isDupWithDesc = isSimilarContent(characteristics, description);

      const showCharacteristics = Boolean(characteristics) && !isDupWithBenefits && !isDupWithDesc;
      expect(showCharacteristics).toBe(true);
    });

    it("should NEVER expose full_ingredients in public product profile", () => {
      const rawProduct = {
        name: "Kem dưỡng Desembre",
        full_ingredients: "Aqua, Glycerin, Niacinamide, Dimethicone, Phenoxyethanol",
        ingredient_highlights: ["Glycerin", "Niacinamide"],
      };

      const profile = buildPublicProductProfile(rawProduct);
      expect((profile as any).full_ingredients).toBeUndefined();
      expect(profile.ingredient_highlights).toEqual(["Glycerin", "Niacinamide"]);
    });

    it("tra soát exact case 1: Milk Essential Cleanser - hides characteristics due to 92% token overlap with benefits", () => {
      const milkCharacteristics = "Sữa rửa mặt Milk Essential Cleanser dạng lotion dịu nhẹ không gây kích ứng da và giúp giữ ẩm cho da sau khi rửa mặt, giúp loại bỏ bụi bẩn, bã nhờn trên da một cách nhẹ dịu mà vẫn duy trì được độ ẩm cần thiết cho da.";
      const milkBenefits = "Sản phẩm giúp loại bỏ bụi bẩn, bã nhờn trên da một cách nhẹ dịu mà vẫn duy trì được độ ẩm cần thiết cho da";

      const isDup = isSimilarContent(milkCharacteristics, milkBenefits);
      expect(isDup).toBe(true); // Suppressed to prevent duplicate text!
    });

    it("tra soát exact case 2: Derma Science Water Cleanser - SHOWS characteristics because content is distinct", () => {
      const dermaCharacteristics = "Nước tẩy trang không chứa kiềm làm sạch dạng nước pH trung tính giúp loại bỏ các chất cặn bã và tạp chất trong da, làm cho da sạch và thông thoáng. Sử dụng được với cả da sau các liệu trình xâm lẫn.";
      const dermaBenefits = "Loại bỏ tạp chất, đồng thời dưỡng ẩm và làm dịu da.";

      const isDup = isSimilarContent(dermaCharacteristics, dermaBenefits);
      expect(isDup).toBe(false); // Shown on catalog!
    });
  });
});
