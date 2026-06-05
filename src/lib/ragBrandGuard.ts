export type BrandSlug = "desembre" | "dermagarden" | "vavaw";

export interface RagChunk {
  chunk_id: string;
  product_id: number;
  product_name: string;
  chunk_type: string;
  similarity_score: number;
  content: string;
  brand_id?: string | null;
  [key: string]: any;
}

export interface BrandFilterResult {
  allowed: RagChunk[];
  suppressed: RagChunk[];
  noDataMessage?: string;
}

export const NO_DATA_MESSAGES: Record<BrandSlug | "unknown_product", string> = {
  dermagarden: "Hiện tại chưa có dữ liệu tri thức đã duyệt cho Dermagarden.",
  vavaw: "Hiện tại chưa có dữ liệu tri thức đã duyệt cho VAVAW.",
  desembre: "Hiện tại chưa có dữ liệu tri thức đã duyệt cho Desembre.",
  unknown_product: "Mình chưa có dữ liệu tri thức đã duyệt cho sản phẩm này.",
};

/**
 * Detects the brand from the user's query using regex.
 */
export function detectBrandFromQuery(query: string): BrandSlug | null {
  if (!query) return null;
  const q = query.toLowerCase();

  // Desembre aliases: desembre, desemb, décem...
  if (/(desembre|desemb|décembre)/i.test(q)) {
    return "desembre";
  }

  // Dermagarden aliases: dermagarden, derma garden, dermag
  if (/(dermagarden|derma garden|dermag\b)/i.test(q)) {
    return "dermagarden";
  }

  // VAVAW aliases: vavaw
  if (/(vavaw)/i.test(q)) {
    return "vavaw";
  }

  return null;
}

/**
 * Filters retrieved chunks based on the detected brand to prevent cross-brand hallucination.
 *
 * @param chunks The raw chunks retrieved from semantic search
 * @param detectedBrand The brand slug detected from the user's query
 * @param brandIdMap A map of brand slug to its UUID in the database
 * @returns Filtered result with allowed/suppressed chunks and an optional safe fallback message
 */
export function filterChunksByBrand(
  chunks: RagChunk[],
  detectedBrand: BrandSlug | null,
  brandIdMap: Record<BrandSlug, string>
): BrandFilterResult {
  // If no brand detected, allow all (current behavior)
  if (!detectedBrand) {
    return { allowed: chunks, suppressed: [] };
  }

  const targetBrandId = brandIdMap[detectedBrand];
  if (!targetBrandId) {
    // Should not happen if map is correctly populated, but fallback to allow if ID is unknown
    return { allowed: chunks, suppressed: [] };
  }

  const allowed: RagChunk[] = [];
  const suppressed: RagChunk[] = [];
  const otherBrandsFound = new Set<string>();

  for (const chunk of chunks) {
    // If chunk has no brand_id, we cautiously allow it to preserve legacy behavior for unmapped chunks,
    // OR we could suppress it if strict. The spec says "chỉ cho phép chunks có brand_id của Dermagarden".
    // For Desembre, "retrieval hiện tại phải giữ nguyên".
    // Since we mapped all approved knowledge to Desembre, legacy chunks have Desembre brand_id now.
    // If a chunk lacks brand_id, we'll assume it's legacy Desembre for safety.
    const isLegacyDesembre = !chunk.brand_id && detectedBrand === "desembre";
    
    if (chunk.brand_id === targetBrandId || isLegacyDesembre) {
      allowed.push(chunk);
    } else {
      suppressed.push(chunk);
      if (chunk.brand_id) {
        otherBrandsFound.add(chunk.brand_id);
      }
    }
  }

  // Case 1: User asks "Dermagarden Milk Essential"
  // detectedBrand = "dermagarden", but chunks are Desembre chunks (because of "Milk Essential").
  if (allowed.length === 0 && suppressed.length > 0 && detectedBrand) {
    // Check if we retrieved chunks from another known brand (e.g., Desembre)
    const desembreId = brandIdMap["desembre"];
    if (otherBrandsFound.has(desembreId)) {
      // Extract unique product names from the suppressed Desembre chunks to build a helpful message
      const productNames = Array.from(new Set(suppressed.map((c) => c.product_name))).filter(Boolean);
      const productListStr = productNames.length > 0 ? productNames.join(", ") : "sản phẩm này";
      
      const brandDisplay = detectedBrand === "dermagarden" ? "Dermagarden" : "VAVAW";
      
      return {
        allowed: [],
        suppressed,
        noDataMessage: `Mình chưa có dữ liệu tri thức đã duyệt cho sản phẩm ${brandDisplay} bạn hỏi. ${productListStr} hiện đang có dữ liệu dưới brand Desembre, bạn muốn xem thông tin Desembre không?`,
      };
    }
  }

  // Case 2: Dermagarden/VAVAW question but no matching chunks at all
  if (allowed.length === 0 && (detectedBrand === "dermagarden" || detectedBrand === "vavaw")) {
    return {
      allowed: [],
      suppressed,
      noDataMessage: NO_DATA_MESSAGES[detectedBrand],
    };
  }

  return { allowed, suppressed };
}
