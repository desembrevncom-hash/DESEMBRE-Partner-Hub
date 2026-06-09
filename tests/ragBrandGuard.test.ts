import { describe, it, expect } from "vitest";
import { detectBrandFromQuery, filterChunksByBrand, RagChunk } from "../src/lib/ragBrandGuard";

describe("ragBrandGuard", () => {
  const brandMap = {
    desembre: "uuid-desembre",
    dermagarden: "uuid-dermagarden",
    vavaw: "uuid-vavaw",
  };

  const mockDesembreChunk: RagChunk = {
    chunk_id: "c1",
    product_id: 1,
    product_name: "Milk Essential",
    chunk_type: "document",
    similarity_score: 0.8,
    content: "Sữa rửa mặt Desembre...",
    brand_id: "uuid-desembre",
  };

  const mockDermagardenChunk: RagChunk = {
    chunk_id: "c2",
    product_id: 3,
    product_name: "Derma Toner",
    chunk_type: "document",
    similarity_score: 0.7,
    content: "Toner Dermagarden...",
    brand_id: "uuid-dermagarden",
  };

  describe("detectBrandFromQuery", () => {
    it("detects Desembre", () => {
      expect(detectBrandFromQuery("Desembre có gì hot?")).toBe("desembre");
      expect(detectBrandFromQuery("desemb milk essential")).toBe("desembre");
      expect(detectBrandFromQuery("décembre")).toBe("desembre");
    });

    it("detects Dermagarden", () => {
      expect(detectBrandFromQuery("Dermagarden toner")).toBe("dermagarden");
      expect(detectBrandFromQuery("derma garden cho da khô")).toBe("dermagarden");
      expect(detectBrandFromQuery("dermag")).toBe("dermagarden");
    });

    it("detects VAVAW", () => {
      expect(detectBrandFromQuery("vavaw son")).toBe("vavaw");
    });

    it("returns null for unknown brand", () => {
      expect(detectBrandFromQuery("Sản phẩm cho da mụn")).toBeNull();
      expect(detectBrandFromQuery("Milk essential dùng thế nào?")).toBeNull();
    });
  });

  describe("filterChunksByBrand", () => {
    it("allows all chunks when no brand detected", () => {
      const chunks = [mockDesembreChunk, mockDermagardenChunk];
      const result = filterChunksByBrand(chunks, null, brandMap);
      expect(result.allowed).toHaveLength(2);
      expect(result.suppressed).toHaveLength(0);
      expect(result.noDataMessage).toBeUndefined();
    });

    it("allows only Desembre chunks when Desembre is detected", () => {
      const chunks = [mockDesembreChunk, mockDermagardenChunk];
      const result = filterChunksByBrand(chunks, "desembre", brandMap);
      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].chunk_id).toBe("c1");
      expect(result.suppressed).toHaveLength(1);
      expect(result.suppressed[0].chunk_id).toBe("c2");
    });

    it("returns Dermagarden no-data when Dermagarden is detected but no Dermagarden chunks exist", () => {
      const chunks = [mockDesembreChunk];
      const result = filterChunksByBrand(chunks, "dermagarden", brandMap);
      expect(result.allowed).toHaveLength(0);
      expect(result.suppressed).toHaveLength(1);
      expect(result.noDataMessage).toContain(
        "Milk Essential hiện đang có dữ liệu dưới brand Desembre",
      );
    });

    it("returns generic Dermagarden no-data when no chunks retrieved at all", () => {
      const result = filterChunksByBrand([], "dermagarden", brandMap);
      expect(result.allowed).toHaveLength(0);
      expect(result.suppressed).toHaveLength(0);
      expect(result.noDataMessage).toBe(
        "Hiện tại chưa có dữ liệu tri thức đã duyệt cho Dermagarden.",
      );
    });

    it("returns VAVAW no-data when VAVAW is detected but no VAVAW chunks exist", () => {
      // Simulate retrieving a Desembre chunk due to semantic overlap, but asking about VAVAW
      const chunks = [mockDesembreChunk];
      const result = filterChunksByBrand(chunks, "vavaw", brandMap);
      expect(result.allowed).toHaveLength(0);
      expect(result.suppressed).toHaveLength(1);
      expect(result.noDataMessage).toContain(
        "Milk Essential hiện đang có dữ liệu dưới brand Desembre",
      );
    });

    it("returns generic VAVAW no-data when no chunks retrieved", () => {
      const result = filterChunksByBrand([], "vavaw", brandMap);
      expect(result.allowed).toHaveLength(0);
      expect(result.suppressed).toHaveLength(0);
      expect(result.noDataMessage).toBe("Hiện tại chưa có dữ liệu tri thức đã duyệt cho VAVAW.");
    });

    it("allows Dermagarden chunks when Dermagarden is detected and chunks exist", () => {
      const chunks = [mockDesembreChunk, mockDermagardenChunk];
      const result = filterChunksByBrand(chunks, "dermagarden", brandMap);
      expect(result.allowed).toHaveLength(1);
      expect(result.allowed[0].chunk_id).toBe("c2");
      expect(result.suppressed).toHaveLength(1);
    });
  });
});
