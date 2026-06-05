import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { decryptApiKey } from "../_shared/crypto-utils.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- AI Provider Abstraction ----------

interface AIResponse {
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface AIConfig {
  provider: string;
  chatModel: string;
  embeddingModel: string;
  openAiKey: string;
  geminiKey: string;
}

async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  config: AIConfig,
): Promise<AIResponse> {
  const apiKey = config.openAiKey;
  const model = config.chatModel;
  if (!apiKey) throw new Error("Chưa cấu hình AI provider. Thiếu OPENAI_API_KEY.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "{}",
    prompt_tokens: data.usage?.prompt_tokens || 0,
    completion_tokens: data.usage?.completion_tokens || 0,
    total_tokens: data.usage?.total_tokens || 0,
  };
}

async function callGemini(
  prompt: string,
  systemPrompt: string,
  config: AIConfig,
): Promise<AIResponse> {
  const apiKey = config.geminiKey;
  const model = config.chatModel;
  if (!apiKey) throw new Error("Chưa cấu hình AI provider. Thiếu GEMINI_API_KEY.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n---\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const usage = data.usageMetadata || {};
  return {
    content: text,
    prompt_tokens: usage.promptTokenCount || 0,
    completion_tokens: usage.candidatesTokenCount || 0,
    total_tokens: usage.totalTokenCount || 0,
  };
}

async function callAI(prompt: string, systemPrompt: string, config: AIConfig): Promise<AIResponse> {
  const provider = config.provider.toLowerCase();
  if (provider === "openai") return callOpenAI(prompt, systemPrompt, config);
  if (provider === "gemini") return callGemini(prompt, systemPrompt, config);
  throw new Error(
    `Chưa cấu hình AI provider. Vui lòng chọn OpenAI hoặc Gemini. Hiện tại đang chọn: ${provider}`,
  );
}

// ---------- RAG Helpers ----------
async function generateEmbedding(
  text: string,
  adminClient: any,
  config: AIConfig,
): Promise<number[]> {
  // --- PHASE 7.5: Cache Layer for Embeddings (TTL: forever) ---
  const cacheKey = `emb:${await hashText(text)}`;
  const { data: cached } = await adminClient
    .from("ai_cache")
    .select("payload")
    .eq("cache_key", cacheKey)
    .single();
  if (cached?.payload?.embedding) {
    // Increment hit count async (fire & forget)
    adminClient
      .from("ai_cache")
      .update({ hit_count: cached.payload.hit_count + 1 })
      .eq("cache_key", cacheKey);
    return cached.payload.embedding;
  }

  const apiKey = config.openAiKey;
  if (!apiKey) throw new Error("Chưa cấu hình OpenAI API Key để tạo embedding.");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: text, model: config.embeddingModel }),
  });
  if (!res.ok) throw new Error(`Embedding failed: ${await res.text()}`);
  const data = await res.json();
  const embedding = data.data[0].embedding;

  // Store in cache (no expiry for embeddings)
  await adminClient.from("ai_cache").upsert(
    {
      cache_key: cacheKey,
      cache_type: "embedding",
      payload: { embedding, hit_count: 0 },
      expires_at: null,
    },
    { onConflict: "cache_key" },
  );

  return embedding;
}

// Simple hash helper using Web Crypto API (available in Deno)
async function hashText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Helper to truncate long strings for preview (max 500 chars)
function truncateString(str: string, maxLen = 500): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...";
}

// Banned medical claims phrases
const BANNED_MEDICAL_PHRASES = [
  "trị dứt điểm",
  "cam kết khỏi",
  "chữa khỏi",
  "khỏi 100%",
  "điều trị bệnh",
  "thay thế thuốc",
  "không tái phát",
  "hiệu quả vĩnh viễn",
  "đảm bảo hết nám",
  "đảm bảo hết mụn",
];

function detectBannedPhrases(text: string): string[] {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  return BANNED_MEDICAL_PHRASES.filter((phrase) => lowerText.includes(phrase.toLowerCase()));
}

function detectUnsupportedProductMentions(
  text: string,
  retrievedChunks: any[],
  allProducts: any[],
): string[] {
  const lowerText = text.toLowerCase();
  const allowedProducts = new Set(
    retrievedChunks.map((c) => c.product_name?.toLowerCase()).filter(Boolean),
  );

  const violations: string[] = [];
  for (const p of allProducts) {
    const pNameLower = p.name?.toLowerCase();
    if (!pNameLower || pNameLower.length < 3) continue;

    // Check if response mentions product, but it's not in the retrieved chunks context
    if (lowerText.includes(pNameLower) && !allowedProducts.has(pNameLower)) {
      violations.push(p.name);
    }
  }
  return violations;
}

async function logSafetyEvent(
  adminClient: any,
  params: {
    requestId: string;
    userId: string;
    customerId?: string;
    eventType: string;
    phrase: string;
    severity: string;
    originalResponse?: string;
  },
) {
  try {
    await adminClient.from("ai_safety_events").insert({
      request_id: params.requestId,
      user_id: params.userId,
      customer_id: params.customerId || null,
      event_type: params.eventType,
      phrase: params.phrase || "N/A",
      severity: params.severity,
      original_response_preview: params.originalResponse
        ? truncateString(params.originalResponse, 500)
        : null,
      handled: false,
    });
  } catch (e) {
    console.error("Failed to log safety event:", e);
  }
}

// ---------- Phase 7.3: Hallucination Detector ----------
interface HallucinationResult {
  blocked: boolean;
  detectedPhrases: string[];
  safeResponse?: string;
}

async function validateAIOutput(
  responseText: string,
  adminClient: any,
): Promise<HallucinationResult> {
  // Load banned phrases from DB (or use hardcoded fallback if DB fails)
  const DEFAULT_BANNED = [
    "trị dứt điểm",
    "chữa khỏi",
    "chữa hoàn toàn",
    "cam kết hiệu quả",
    "đảm bảo 100%",
    "hiệu quả 100%",
    "tuyệt đối an toàn",
    "không tác dụng phụ",
    "điều trị y khoa",
    "kê đơn",
    "thuốc đặc trị",
    "trị nám dứt điểm",
    "xóa sẹo hoàn toàn",
    "thần kỳ",
  ];

  let bannedPhrases = DEFAULT_BANNED;
  try {
    const { data } = await adminClient
      .from("ai_banned_phrases")
      .select("phrase")
      .eq("is_active", true);
    if (data && data.length > 0) {
      bannedPhrases = data.map((r: any) => r.phrase);
    }
  } catch (_) {
    /* fallback to default */
  }

  const lowerResponse = responseText.toLowerCase();
  const detected = bannedPhrases.filter((phrase) => lowerResponse.includes(phrase.toLowerCase()));

  if (detected.length > 0) {
    return {
      blocked: true,
      detectedPhrases: detected,
      safeResponse:
        "⚠️ Phản hồi này đã bị chặn vì chứa nội dung không phù hợp (cam kết y khoa). Vui lòng tư vấn dựa trên dữ liệu trong Cẩm nang sản phẩm.",
    };
  }

  return { blocked: false, detectedPhrases: [] };
}

// ---------- Phase 7.6: Cost Logger (P4: dynamic pricing per model) ----------

// P4: Dynamic cost per 1M tokens by model
function estimateCost(promptTokens: number, completionTokens: number, model: string): number {
  const pricing: Record<string, [number, number]> = {
    "gpt-4o-mini": [0.15, 0.6],
    "gpt-4o": [2.5, 10.0],
    "gpt-4o-2024-11-20": [2.5, 10.0],
    "gpt-4o-2024-05-13": [5.0, 15.0],
    "gpt-4-turbo": [10.0, 30.0],
    "gemini-1.5-flash": [0.075, 0.3],
    "gemini-1.5-pro": [1.25, 5.0],
  };
  const [inPrice, outPrice] = pricing[model] ?? [0.15, 0.6];
  return (promptTokens / 1_000_000) * inPrice + (completionTokens / 1_000_000) * outPrice;
}

async function logUsage(
  adminClient: any,
  config: AIConfig,
  params: {
    userId: string;
    customerId?: string;
    mode: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheHit?: boolean;
    latencyMs?: number;
    modelOverride?: string;
  },
) {
  const model = params.modelOverride ?? config.chatModel;
  const totalCost = estimateCost(params.promptTokens, params.completionTokens, model);
  const provider = config.provider.toLowerCase();

  try {
    await adminClient.from("ai_usage_logs").insert({
      user_id: params.userId,
      customer_id: params.customerId || null,
      mode: params.mode,
      provider,
      model,
      prompt_tokens: params.promptTokens,
      completion_tokens: params.completionTokens,
      total_tokens: params.totalTokens,
      estimated_cost_usd: totalCost,
      cache_hit: params.cacheHit || false,
      latency_ms: params.latencyMs || null,
    });
  } catch (e) {
    console.error("Usage log error:", e);
  }
}

// ---------- Phase P4: Performance Helpers ----------

// Trim long chunk content to max characters (preserves safety quality)
function trimChunk(content: string, maxLen = 400): string {
  if (!content) return "";
  return content.length > maxLen ? content.slice(0, maxLen) + "…" : content;
}

// Model routing: rewrite_suggestions always use gpt-4o-mini (simple task)
function resolveModel(mode: string, config: AIConfig): string {
  if (mode === "rewrite_suggestions") return "gpt-4o-mini";
  return config.chatModel;
}

// SHA-256 hash for cache keys using Web Crypto (available in Deno)
async function hashCacheKey(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return (
    "res:" +
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

// Generic cache get-or-set for response caching
async function getOrSetCache<T>(
  adminClient: any,
  key: string,
  cacheType: string,
  ttlMinutes: number,
  fn: () => Promise<T>,
): Promise<{ result: T; cacheHit: boolean }> {
  try {
    const { data: cached } = await adminClient
      .from("ai_cache")
      .select("payload, expires_at, hit_count")
      .eq("cache_key", key)
      .maybeSingle();

    if (cached && (!cached.expires_at || new Date(cached.expires_at) > new Date())) {
      // Cache HIT — update hit_count asynchronously (fire-and-forget)
      adminClient
        .from("ai_cache")
        .update({ hit_count: (cached.hit_count ?? 0) + 1, updated_at: new Date().toISOString() })
        .eq("cache_key", key)
        .then(() => {})
        .catch(() => {});
      return { result: cached.payload.data as T, cacheHit: true };
    }
  } catch (_) {
    /* cache unavailable — proceed to fn */
  }

  // Cache MISS — execute function
  const result = await fn();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  try {
    await adminClient.from("ai_cache").upsert(
      {
        cache_key: key,
        cache_type: cacheType,
        payload: { data: result },
        expires_at: expiresAt,
        hit_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch (_) {
    /* non-fatal: cache write failure */
  }

  return { result, cacheHit: false };
}

// ---------- Main Handler ----------

// F.3 Brand Guard Helpers
type BrandSlug = "desembre" | "dermagarden" | "vavaw";
function detectBrandFromQuery(query: string): BrandSlug | null {
  if (!query) return null;
  const q = query.toLowerCase();
  if (/(desembre|desemb|décembre)/i.test(q)) return "desembre";
  if (/(dermagarden|derma garden|dermag\b)/i.test(q)) return "dermagarden";
  if (/(vavaw)/i.test(q)) return "vavaw";
  return null;
}
function filterChunksByBrand(chunks: any[], detectedBrand: BrandSlug | null, brandIdMap: Record<string, string>) {
  if (!detectedBrand) return { allowed: chunks, suppressed: [] };
  const targetBrandId = brandIdMap[detectedBrand];
  if (!targetBrandId) return { allowed: chunks, suppressed: [] };

  const allowed: any[] = [];
  const suppressed: any[] = [];
  const otherBrandsFound = new Set<string>();

  for (const chunk of chunks) {
    const isLegacyDesembre = !chunk.brand_id && detectedBrand === "desembre";
    if (chunk.brand_id === targetBrandId || isLegacyDesembre) {
      allowed.push(chunk);
    } else {
      suppressed.push(chunk);
      if (chunk.brand_id) otherBrandsFound.add(chunk.brand_id);
    }
  }

  if (allowed.length === 0 && suppressed.length > 0) {
    const desembreId = brandIdMap["desembre"];
    if (desembreId && otherBrandsFound.has(desembreId)) {
      // Since edge chunks don't have product_name eagerly joined here, we fallback to a generic message
      const productListStr = "sản phẩm này";
      const brandDisplay = detectedBrand === "dermagarden" ? "Dermagarden" : "VAVAW";
      return {
        allowed: [],
        suppressed,
        noDataMessage: `Mình chưa có dữ liệu tri thức đã duyệt cho sản phẩm ${brandDisplay} bạn hỏi. ${productListStr} hiện đang có dữ liệu dưới brand Desembre, bạn muốn xem thông tin Desembre không?`
      };
    }
  }

  if (allowed.length === 0 && (detectedBrand === "dermagarden" || detectedBrand === "vavaw")) {
    const msgs: Record<string, string> = {
      dermagarden: "Hiện tại chưa có dữ liệu tri thức đã duyệt cho Dermagarden.",
      vavaw: "Hiện tại chưa có dữ liệu tri thức đã duyệt cho VAVAW."
    };
    return {
      allowed: [],
      suppressed,
      noDataMessage: msgs[detectedBrand]
    };
  }

  return { allowed, suppressed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // 1. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // --- Phase I: Load AI settings and check module toggle ---
    const { data: aiSettings, error: aiError } = await adminClient
      .from("ai_settings")
      .select("*")
      .eq("id", "default")
      .single();
    if (aiError || !aiSettings) {
      return json({ error: "Failed to load AI settings" }, 500);
    }
    // Check module toggle: sales assistant must be enabled
    if (!aiSettings.module_sales_assistant) {
      return json({ error: "AI module này đang bị Admin tắt." }, 403);
    }

    let openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    try {
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("encrypted_api_key")
        .eq("provider", "openai")
        .single();
      
      if (settings?.encrypted_api_key) {
        openaiApiKey = await decryptApiKey(settings.encrypted_api_key);
      }
    } catch (e) {
      console.error("Failed to read OPENAI_API_KEY from DB, fallback to env", e);
    }

    const aiConfig: AIConfig = {
      provider: aiSettings.provider || Deno.env.get("AI_PROVIDER") || "openai",
      chatModel: aiSettings.chat_model || "gpt-4o-mini",
      embeddingModel: aiSettings.embedding_model || "text-embedding-3-small",
      openAiKey: openaiApiKey,
      geminiKey: aiSettings.gemini_api_key || Deno.env.get("GEMINI_API_KEY") || "",
    };

    // 2. Parse input
    const body = await req.json();
    const { customerId, mode, taskId, debugQuery } = body;
    const requestId = crypto.randomUUID();

    if (
      mode !== "summary" &&
      mode !== "rewrite_suggestions" &&
      mode !== "debug_rag" &&
      mode !== "rag_audit"
    ) {
      return json(
        {
          error:
            "Only mode='summary', 'rewrite_suggestions', 'debug_rag', and 'rag_audit' are supported",
        },
        400,
      );
    }

    if (mode !== "debug_rag" && mode !== "rag_audit" && !customerId) {
      return json({ error: "customerId is required" }, 400);
    }

    // --- PHASE P4: Model routing (resolve per mode) ---
    // rewrite_suggestions always uses gpt-4o-mini; others use ai_settings.chat_model
    const resolvedModel = resolveModel(mode, aiConfig);
    const aiConfigForMode = { ...aiConfig, chatModel: resolvedModel };

    // --- PHASE 7: RAG Sandbox Debug Mode ---
    if (mode === "debug_rag") {
      if (!debugQuery) return json({ error: "debugQuery is required" }, 400);
      // Phase P3: debug_rag requires Admin or Sub Admin
      const { data: isAdminDebug, error: roleDebugError } = await adminClient.rpc(
        "is_admin_or_sub_admin",
        {
          user_id: user.id,
        },
      );
      if (roleDebugError || !isAdminDebug) {
        return json(
          { error: "Access denied. Only Admin or Sub Admin can use debug_rag mode." },
          403,
        );
      }
      try {
        const queryEmbedding = await generateEmbedding(debugQuery, adminClient, aiConfig);
        const { data: chunksData } = await adminClient.rpc("match_product_chunks", {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 5,
        });

        const retrievedChunks = chunksData || [];
        const systemPrompt = `[AI SAFETY LAYER]: Tuyệt đối không bịa thông tin sản phẩm. Chỉ sử dụng kiến thức từ mục <KNOWLEDGE_CHUNKS> bên dưới.`;
        const userPrompt = `=== KNOWLEDGE_CHUNKS ===\n${retrievedChunks.map((c: any, i: number) => `[Chunk ${i + 1}] ${c.content}`).join("\\n")}\n\n=== CÂU HỎI ===\n${debugQuery}`;

        // Simulate prompt (don't actually call AI to save token unless strictly requested, but we'll return the prompt structure)
        return json({
          query_generated: debugQuery,
          retrieved_chunks: retrievedChunks.map((c: any) => ({
            chunk_id: c.id,
            product_id: c.product_id,
            chunk_type: c.chunk_type,
            score: c.similarity,
            content: c.content,
          })),
          final_prompt_preview: `SYSTEM: ${systemPrompt}\n\nUSER: ${userPrompt}`,
          ai_response_preview: "Simulation mode (no tokens used)",
        });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }

    // --- PHASE P1: RAG Audit Mode ---
    if (mode === "rag_audit") {
      const { query: auditQuery, auditMode, threshold } = body;
      if (!auditQuery) return json({ error: "query is required for rag_audit mode" }, 400);
      if (!auditMode) return json({ error: "auditMode is required for rag_audit mode" }, 400);

      // Verify that calling user is admin or sub_admin
      const { data: isAdmin, error: roleError } = await adminClient.rpc("is_admin_or_sub_admin", {
        user_id: user.id,
      });

      const isProductCopilotAllowedForSale =
        auditMode === "product_tutor" &&
        aiSettings.product_copilot_enabled &&
        aiSettings.product_copilot_sale_enabled;

      if ((roleError || !isAdmin) && !isProductCopilotAllowedForSale) {
        return json(
          { error: "Access denied. Only Admin or Sub Admin can perform RAG audits." },
          403,
        );
      }

      const auditStartTime = Date.now(); // P4: latency tracking

      try {
        // 1. Generate query embedding
        const queryEmbedding = await generateEmbedding(auditQuery, adminClient, aiConfig);

        // F.4: Optional Strict DB-layer Brand Filtering
        const useRpcBrandFilter = Deno.env.get("RAG_USE_RPC_BRAND_FILTER") === "true";
        let rpcFilterBrandIds = undefined;

        // F.3: Brand-aware context guard
        const detectedBrand = detectBrandFromQuery(auditQuery);
        let brandIdMap: Record<string, string> = {};
        
        if (detectedBrand) {
          const { data: brandsData } = await adminClient.from("product_brands").select("id, name");
          brandsData?.forEach((b: any) => {
            const lowerName = b.name.toLowerCase();
            if (lowerName.includes("desembre")) brandIdMap["desembre"] = b.id;
            if (lowerName.includes("dermagarden")) brandIdMap["dermagarden"] = b.id;
            if (lowerName.includes("vavaw")) brandIdMap["vavaw"] = b.id;
          });

          if (useRpcBrandFilter && brandIdMap[detectedBrand]) {
            // TRADE-OFF DOCUMENTATION:
            // Mode TRUE: Strict DB-layer isolation for performance.
            // When filter_brand_ids is sent, the RPC returns ONLY chunks from this brand.
            // This means we will NEVER retrieve chunks from other brands, which PREVENTS the 
            // F.3 Smart Suggestion (e.g. asking "Dermagarden Milk Essential" won't find Desembre's Milk Essential chunk to suggest it).
            rpcFilterBrandIds = [brandIdMap[detectedBrand]];
          } else {
            // TRADE-OFF DOCUMENTATION:
            // Mode FALSE (Default): Prioritize Smart Suggestion.
            // RPC retrieves all matching chunks regardless of brand. The F.3 Edge Guard below will 
            // filter out wrong-brand chunks, but it CAN detect if a product belongs to another brand 
            // and return a helpful suggestion message.
          }
        }

        // 2. Search chunks in DB using match_product_chunks
        // We query with a lower threshold (0.1) to allow detecting if there is any retrieval context at all
        const parsedThreshold =
          threshold !== undefined && threshold !== null ? parseFloat(threshold) : 0.7;
        const { data: chunksData, error: matchError } = await adminClient.rpc(
          "match_product_chunks",
          {
            query_embedding: queryEmbedding,
            match_threshold: 0.1,
            match_count: 5,
            filter_brand_ids: rpcFilterBrandIds,
          },
        );

        if (matchError) throw matchError;

        let rawChunks = chunksData || [];

        if (detectedBrand) {
          const filterResult = filterChunksByBrand(rawChunks, detectedBrand, brandIdMap);
          if (filterResult.suppressed.length > 0 && filterResult.allowed.length === 0) {
            await logSafetyEvent(adminClient, {
              requestId: requestId,
              userId: user.id,
              eventType: "cross_brand_guard_triggered",
              phrase: detectedBrand,
              severity: "low",
            });
            return json({
              retrieved_chunks: [],
              final_answer: filterResult.noDataMessage || "Không tìm thấy dữ liệu cho thương hiệu này.",
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
              model_used: aiConfig.chatModel,
              provider: aiConfig.provider,
            });
          }
          rawChunks = filterResult.allowed;
        }

        // Determine if no retrieval at all
        const topScore =
          rawChunks.length > 0 ? Math.max(...rawChunks.map((c: any) => c.similarity ?? 0)) : 0;

        if (rawChunks.length === 0) {
          const fallbackText =
            "Hiện chưa có đủ dữ liệu chính thức trong Cẩm nang sản phẩm để tư vấn nội dung này.";
          await logSafetyEvent(adminClient, {
            requestId: requestId,
            userId: user.id,
            eventType: "no_retrieval",
            phrase: "N/A",
            severity: "medium",
          });
          return json({
            retrieved_chunks: [],
            final_answer: fallbackText,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            model_used: aiConfig.chatModel,
            provider: aiConfig.provider,
          });
        }

        // 3. Fetch details: product names, is_active, knowledge_version
        const retrievedChunks = [];
        const productIds = Array.from(new Set(rawChunks.map((c: any) => c.product_id)));
        const chunkIds = rawChunks.map((c: any) => c.id);

        // Get product names
        const { data: productsData } = await adminClient
          .from("products")
          .select("id, name")
          .in("id", productIds);
        const productNamesMap: Record<number, string> = {};
        productsData?.forEach((p: any) => {
          productNamesMap[p.id] = p.name;
        });

        // Get chunk level details (is_active, knowledge_version)
        const { data: chunksDb } = await adminClient
          .from("product_knowledge_chunks")
          .select("id, is_active, knowledge_version")
          .in("id", chunkIds);
        const chunkDbMap: Record<string, any> = {};
        chunksDb?.forEach((c: any) => {
          chunkDbMap[c.id] = c;
        });

        // Get product knowledge qa_status and is_active
        const { data: pkData } = await adminClient
          .from("product_knowledge")
          .select("product_id, is_active, qa_status")
          .in("product_id", productIds);
        const pkMap: Record<number, any> = {};
        pkData?.forEach((pk: any) => {
          pkMap[pk.product_id] = pk;
        });

        for (const c of rawChunks) {
          const prodName = productNamesMap[c.product_id] || `Sản phẩm #${c.product_id}`;
          const dbChunk = chunkDbMap[c.id] || {};
          const pk = pkMap[c.product_id] || {};

          retrievedChunks.push({
            chunk_id: c.id,
            product_id: c.product_id,
            product_name: prodName,
            chunk_type: c.chunk_type,
            similarity_score: c.similarity,
            knowledge_version: dbChunk.knowledge_version || c.metadata?.knowledge_version || 1,
            content: c.content,
            qa_status: pk.qa_status || "approved",
            is_active: dbChunk.is_active !== undefined ? dbChunk.is_active : true,
          });
        }

        // Check if top score fails threshold (Low Confidence Guard)
        if (topScore < parsedThreshold) {
          const fallbackText =
            "Hiện chưa có đủ dữ liệu chính thức trong Cẩm nang sản phẩm để tư vấn nội dung này. (Độ tin cậy của thông tin tìm thấy không đạt yêu cầu).";
          await logSafetyEvent(adminClient, {
            requestId: requestId,
            userId: user.id,
            eventType: "low_confidence_retrieval",
            phrase: `Top score: ${topScore.toFixed(4)}`,
            severity: "medium",
          });
          return json({
            retrieved_chunks: retrievedChunks,
            final_answer: fallbackText,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            model_used: aiConfig.chatModel,
            provider: aiConfig.provider,
          });
        }

        // Only keep chunks passing threshold for LLM prompt context
        const promptChunks = retrievedChunks.filter((c) => c.similarity_score >= parsedThreshold);

        // 4. Construct prompts based on auditMode
        let systemPrompt = "";
        if (auditMode === "product_tutor") {
          systemPrompt = `Bạn là Trợ lý Đào tạo Sản phẩm (Product Tutor) cho thương hiệu mỹ phẩm Desembre.
Nhiệm vụ của bạn là trả lời thắc mắc của Sales về sản phẩm dựa trên các thông tin được cung cấp trong <KNOWLEDGE_CHUNKS>.
Yêu cầu:
- Trả lời bằng tiếng Việt, ngắn gọn, chính xác, bám sát tài liệu.
- Tuyệt đối không tự bịa ra thông tin không có trong tài liệu.
- Nếu tài liệu không đủ thông tin, hãy ghi rõ "Không có đủ thông tin trong tài liệu để trả lời".`;
        } else if (auditMode === "objection_handling") {
          systemPrompt = `Bạn là Chuyên gia xử lý từ chối (Objection Handling) cho Sales mỹ phẩm Desembre.
Nhiệm vụ của bạn là hướng dẫn Sales cách phản hồi khách hàng khi gặp các câu hỏi khó, thắc mắc hoặc từ chối, dựa trên các thông tin được cung cấp trong <KNOWLEDGE_CHUNKS>.
Yêu cầu:
- Trả lời bằng tiếng Việt, khéo léo, thuyết phục, bám sát tài liệu sản phẩm.
- Tuyệt đối không cam kết y khoa hoặc nói quá công dụng.
- Nếu tài liệu không đủ thông tin, hãy ghi rõ "Không có đủ thông tin trong tài liệu để xử lý".`;
        } else if (auditMode === "usage_script") {
          systemPrompt = `Bạn là Trợ lý hướng dẫn sử dụng (Usage Script) cho thương hiệu mỹ phẩm Desembre.
Nhiệm vụ của bạn là xây dựng kịch bản tư vấn sử dụng sản phẩm (thứ tự dùng, lượng dùng, lưu ý...) cho Sales gửi khách hàng dựa trên <KNOWLEDGE_CHUNKS>.
Yêu cầu:
- Viết ngắn gọn, dễ hiểu, chuyên nghiệp bằng tiếng Việt.
- Chỉ dùng các bước và lưu ý có trong tài liệu được cung cấp.`;
        } else if (auditMode === "compare_products") {
          systemPrompt = `Bạn là Chuyên gia so sánh sản phẩm (Compare Products) cho thương hiệu mỹ phẩm Desembre.
Nhiệm vụ của bạn là so sánh các sản phẩm được hỏi dựa trên <KNOWLEDGE_CHUNKS>.
Yêu cầu:
- Làm nổi bật sự khác biệt về thành phần, công dụng, loại da phù hợp.
- Chỉ so sánh dựa trên các thông tin có trong tài liệu được cung cấp.`;
        } else {
          throw new Error(`Audit mode không hợp lệ: ${auditMode}`);
        }

        // Add instructions to return JSON response format with "final_answer"
        systemPrompt += `\n\nBạn BẮT BUỘC phải trả về một đối tượng JSON có cấu trúc sau:
{
  "final_answer": "Nội dung câu trả lời chi tiết và chính xác của bạn."
}`;

        // P4: trim chunk content, apply cache key for rag_audit
        const auditCacheKey = await hashCacheKey(
          `rag_audit:${auditMode}:${auditQuery}:${parsedThreshold}`,
        );

        const userPrompt = `=== KNOWLEDGE_CHUNKS ===\n${
          promptChunks.length > 0
            ? promptChunks
                .map(
                  (c: any, i: number) =>
                    `[Chunk ${i + 1}] (Sản phẩm: ${c.product_name}): ${trimChunk(c.content)}`,
                )
                .join("\n")
            : "Không tìm thấy chunks nào."
        }\n\n=== CÂU HỎI CỦA SALES ===\n${auditQuery}`;

        // 5. Call AI (with 30-min cache for rag_audit repeated queries)
        const { result: auditAiResult, cacheHit: auditCacheHit } = await getOrSetCache(
          adminClient,
          auditCacheKey,
          "rag_audit",
          30, // 30 minutes TTL
          async () => {
            const resp = await callAI(userPrompt, systemPrompt, aiConfig);
            return resp;
          },
        );
        const aiResponse = auditAiResult as any;

        let finalAnswer = "";
        try {
          const parsed = JSON.parse(aiResponse.content);
          finalAnswer = parsed.final_answer || aiResponse.content;
        } catch {
          finalAnswer = aiResponse.content;
        }

        // Post-processing safety checks
        const medicalViolations = detectBannedPhrases(finalAnswer);
        if (medicalViolations.length > 0) {
          finalAnswer =
            "Nội dung AI tạo ra có nguy cơ chứa claim y khoa nên đã được chặn. Vui lòng kiểm tra lại Product Knowledge hoặc viết lại câu hỏi.";
          await logSafetyEvent(adminClient, {
            requestId: requestId,
            userId: user.id,
            eventType: "medical_claim_blocked",
            phrase: medicalViolations.join(", "),
            severity: "high",
            originalResponse: aiResponse.content,
          });
        } else {
          const { data: allProductsData } = await adminClient.from("products").select("name");
          const allProducts = allProductsData || [];
          const productViolations = detectUnsupportedProductMentions(
            finalAnswer,
            promptChunks,
            allProducts,
          );
          if (productViolations.length > 0) {
            finalAnswer = `Phản hồi đã bị chặn do nhắc đến sản phẩm không có trong tài liệu đối chiếu: ${productViolations.join(", ")}. Vui lòng viết lại câu hỏi.`;
            await logSafetyEvent(adminClient, {
              requestId: requestId,
              userId: user.id,
              eventType: "unsupported_product_mention",
              phrase: productViolations.join(", "),
              severity: "medium",
              originalResponse: aiResponse.content,
            });
          }
        }

        // P4: Log usage for rag_audit (was missing before)
        const auditLatencyMs = Date.now() - auditStartTime;
        await logUsage(adminClient, aiConfig, {
          userId: user.id,
          customerId: undefined,
          mode: "rag_audit",
          promptTokens: auditCacheHit ? 0 : (aiResponse.prompt_tokens ?? 0),
          completionTokens: auditCacheHit ? 0 : (aiResponse.completion_tokens ?? 0),
          totalTokens: auditCacheHit ? 0 : (aiResponse.total_tokens ?? 0),
          latencyMs: auditLatencyMs,
          cacheHit: auditCacheHit,
        });

        return json({
          retrieved_chunks: retrievedChunks,
          final_answer: finalAnswer,
          prompt_tokens: auditCacheHit ? 0 : (aiResponse.prompt_tokens ?? 0),
          completion_tokens: auditCacheHit ? 0 : (aiResponse.completion_tokens ?? 0),
          total_tokens: auditCacheHit ? 0 : (aiResponse.total_tokens ?? 0),
          model_used: aiConfig.chatModel,
          provider: aiConfig.provider,
          cache_hit: auditCacheHit,
        });
      } catch (err: any) {
        return json({ error: err.message }, 500);
      }
    }
    // ---------------------------------------

    // 3. Check user permission to view this customer
    const { data: customerData, error: customerError } = await userClient
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (customerError || !customerData) {
      return json(
        { error: "Không có quyền xem khách hàng này hoặc khách hàng không tồn tại." },
        403,
      );
    }

    // 4. Load related data using adminClient for completeness
    const [activitiesResult, ordersResult, tasksResult] = await Promise.all([
      adminClient
        .from("customer_activities")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5), // P4: reduced from 10 → 5
      adminClient
        .from("orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(3), // P4: reduced from 5 → 3
      adminClient
        .from("customer_tasks")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(3), // P4: reduced from 5 → 3
    ]);

    const activities = activitiesResult.data || [];
    const orders = ordersResult.data || [];
    const tasks = tasksResult.data || [];

    // --- PHASE 7.1: RAG Semantic Search WITH VERSION CHECK ---
    let productChunks: any[] = [];
    let activeKnowledgeVersion: number | null = null;
    const startTime = Date.now();
    try {
      const searchContext = `Da khách hàng: ${customerData.skin_concern_focus || "không rõ"}. Ghi chú: ${customerData.notes || ""}. Các vấn đề quan tâm: mụn, nám, lão hóa, nhạy cảm.`;
      const queryEmbedding = await generateEmbedding(searchContext, adminClient, aiConfig);
      const { data: chunksData } = await adminClient.rpc("match_product_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.3,
        match_count: 3, // P4: reduced from 5 → 3 (top 3 most relevant chunks sufficient for summary)
      });
      productChunks = chunksData || [];
      if (productChunks.length > 0) {
        activeKnowledgeVersion = Math.max(
          ...productChunks.map((c: any) => c.knowledge_version || 1),
        );
      }
    } catch (e) {
      console.error("RAG Search Error:", e);
    }

    // --- PHASE 6.2B: REWRITE SUGGESTIONS ---
    if (mode === "rewrite_suggestions") {
      const { suggestions } = body;
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        return json({ error: "suggestions array is required for rewrite_suggestions mode" }, 400);
      }

      // P4: Compressed system prompt (removed duplicate safety block)
      const rewriteSystemPrompt = `Bạn là trợ lý sale mỹ phẩm chuyên nghiệp.
Viết lại các suggestion thành tin nhắn ngắn (1-2 câu) lịch sự cho Sale gửi khách.
Yêu cầu: ngắn gọn, tinh tế, tạo lý do chính đáng để liên hệ.
Ràng buộc: Chỉ dùng thông tin được cung cấp. Không bịa sản phẩm. Không claim y khoa.
Trả về JSON: { "rewrites": [{ "id": "...", "generatedPrompt": "..." }] }`;

      const rewriteUserPrompt = `=== THÔNG TIN KHÁCH HÀNG ===
Tên: ${customerData.name || "Khách hàng"}
Hạng: ${customerData.tier || "N/A"}

=== CÁC GỢI Ý CẦN REWRITE ===
${suggestions.map((s: any) => `ID: ${s.id}\nTiêu đề: ${s.title}\nLý do: ${s.reason}\nHành động: ${s.suggestedAction}`).join("\n\n")}

Hãy viết lại theo format JSON.`;

      const rewriteStartTime = Date.now(); // P4: latency tracking

      try {
        // P4: Cache rewrite results for 1 hour (same customer + same suggestions)
        const rewriteCacheKey = await hashCacheKey(
          `rewrite:${customerId}:${JSON.stringify(suggestions.map((s: any) => s.id).sort())}`,
        );

        const { result: rewriteCacheResult, cacheHit: rewriteCacheHit } = await getOrSetCache(
          adminClient,
          rewriteCacheKey,
          "rewrite",
          60, // 1 hour TTL
          async () => {
            // P4: model routing — rewrite always uses gpt-4o-mini
            const resp = await callAI(rewriteUserPrompt, rewriteSystemPrompt, aiConfigForMode);
            return resp;
          },
        );
        const rewriteResponse = rewriteCacheResult as any;
        const rewriteLatencyMs = Date.now() - rewriteStartTime;

        let parsedRewrite: any;
        try {
          parsedRewrite = JSON.parse(rewriteResponse.content);
        } catch {
          parsedRewrite = { rewrites: [] };
        }

        // P4: Log to ai_assistant_logs
        await adminClient.from("ai_assistant_logs").insert({
          user_id: user.id,
          customer_id: customerId,
          task_id: taskId || null,
          mode: "rewrite_suggestions",
          status: "success",
          prompt_tokens: rewriteCacheHit ? 0 : (rewriteResponse.prompt_tokens ?? 0),
          completion_tokens: rewriteCacheHit ? 0 : (rewriteResponse.completion_tokens ?? 0),
          total_tokens: rewriteCacheHit ? 0 : (rewriteResponse.total_tokens ?? 0),
        });

        // P4: Log usage (was missing before)
        await logUsage(adminClient, aiConfig, {
          userId: user.id,
          customerId,
          mode: "rewrite_suggestions",
          promptTokens: rewriteCacheHit ? 0 : (rewriteResponse.prompt_tokens ?? 0),
          completionTokens: rewriteCacheHit ? 0 : (rewriteResponse.completion_tokens ?? 0),
          totalTokens: rewriteCacheHit ? 0 : (rewriteResponse.total_tokens ?? 0),
          latencyMs: rewriteLatencyMs,
          cacheHit: rewriteCacheHit,
          modelOverride: resolvedModel, // gpt-4o-mini
        });

        return json({ rewrites: parsedRewrite.rewrites || [], cache_hit: rewriteCacheHit });
      } catch (err: any) {
        return json({ error: err.message || "Lỗi AI rewrite" }, 500);
      }
    }
    // ---------------------------------------

    // --- PHASE P2: RAG Guards in Summary Mode ---
    // A. Low Retrieval Guard (0 chunks fetched from match_product_chunks)
    if (productChunks.length === 0) {
      const fallbackText =
        "Hiện chưa có đủ dữ liệu chính thức trong Cẩm nang sản phẩm để tư vấn nội dung này.";
      await logSafetyEvent(adminClient, {
        requestId,
        userId: user.id,
        customerId,
        eventType: "no_retrieval",
        phrase: "N/A",
        severity: "medium",
      });

      const { data: convRow } = await adminClient
        .from("ai_conversation_logs")
        .insert({
          request_id: requestId,
          user_id: user.id,
          customer_id: customerId,
          task_id: taskId || null,
          mode: "summary",
          request_preview: "Summary mode: no retrieval",
          response_preview: fallbackText,
          retrieved_chunks: "[]",
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0,
          status: "success",
          error_message: null,
        })
        .select("id")
        .single();

      return json({
        conversation_id: convRow?.id || null,
        summary: fallbackText,
        hallucination_blocked: true,
        current_status: "Blocked",
        key_insights: [],
        risks: [],
        suggested_next_actions: [],
      });
    }

    // B. Low Confidence Guard (< 0.7 Score)
    const topScore = Math.max(...productChunks.map((c: any) => c.similarity ?? 0));
    if (topScore < 0.7) {
      const fallbackText =
        "Hiện chưa có đủ dữ liệu chính thức trong Cẩm nang sản phẩm để tư vấn nội dung này. (Độ tin cậy của thông tin tìm thấy không đạt yêu cầu).";
      await logSafetyEvent(adminClient, {
        requestId,
        userId: user.id,
        customerId,
        eventType: "low_confidence_retrieval",
        phrase: `Top score: ${topScore.toFixed(4)}`,
        severity: "medium",
      });

      const { data: convRow } = await adminClient
        .from("ai_conversation_logs")
        .insert({
          request_id: requestId,
          user_id: user.id,
          customer_id: customerId,
          task_id: taskId || null,
          mode: "summary",
          request_preview: "Summary mode: low confidence retrieval",
          response_preview: fallbackText,
          retrieved_chunks: JSON.stringify(
            productChunks.map((c) => ({
              chunk_id: c.id,
              product_id: c.product_id,
              chunk_type: c.chunk_type,
              score: c.similarity,
            })),
          ),
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0,
          status: "success",
          error_message: null,
        })
        .select("id")
        .single();

      return json({
        conversation_id: convRow?.id || null,
        summary: fallbackText,
        hallucination_blocked: true,
        current_status: "Blocked",
        key_insights: [],
        risks: [],
        suggested_next_actions: [],
      });
    }

    // Keep only chunks passing threshold for LLM prompt context
    const promptChunks = productChunks.filter((c) => (c.similarity ?? 0) >= 0.7);

    // 5. Build prompt for SUMMARY mode
    // P4: merged duplicate safety blocks (NGUYÊN TẮC + AI SAFETY LAYER) into one
    const systemPrompt = `Bạn là AI trợ lý bán hàng CRM Desembre Partner Hub.

NGUYÊN TẮC BẮT BUỘC:
- Chỉ tóm tắt và phân tích dựa trên DỮ LIỆU ĐƯỢC CUNG CẤP.
- Không bịa sản phẩm, công dụng, hay thông tin ngoài dữ liệu.
- Không claim y khoa (chữa bách bệnh, trị dứt điểm 100%, kê đơn điều trị).
- Không đề xuất hành động ngoài quyền bán hàng. Không nhắc đến AI.
- Chỉ dùng kiến thức từ <KNOWLEDGE_CHUNKS>. Nếu không có thông tin, ghi rõ thay vì suy diễn.
- Trả lời bằng tiếng Việt, chuyên nghiệp, ngắn gọn.

Trả về JSON:
{
  "summary": "Tóm tắt tổng quan 2-3 câu",
  "current_status": "Tình trạng hiện tại",
  "key_insights": ["Insight 1", "Insight 2"],
  "risks": ["Rủi ro 1"],
  "suggested_next_actions": ["Hành động 1", "Hành động 2"]
}`;

    const userPrompt = `=== THÔNG TIN KHÁCH HÀNG ===
Tên: ${customerData.name || "N/A"}
Loại: ${customerData.customer_type || "N/A"}
Hạng: ${customerData.tier || "N/A"}
Kênh tiếp cận: ${customerData.channel || "N/A"}
Lifecycle: ${customerData.lifecycle_stage || "N/A"}
Ghi chú: ${customerData.notes || "Không có"}
Skin concern focus: ${customerData.skin_concern_focus || "Không rõ"}
Địa chỉ: ${customerData.address || "N/A"}
Ngày tạo: ${customerData.created_at || "N/A"}

=== HOẠT ĐỘNG CHĂM SÓC GẦN ĐÂY (${activities.length} hoạt động) ===
${
  activities.length > 0
    ? activities
        .map(
          (a: any, i: number) =>
            `${i + 1}. [${a.activity_type || "note"}] ${a.title || ""} - ${a.content || ""} (${a.created_at})`,
        )
        .join("\n")
    : "Chưa có hoạt động nào."
}

=== ĐƠN HÀNG GẦN ĐÂY (${orders.length} đơn) ===
${
  orders.length > 0
    ? orders
        .map(
          (o: any, i: number) =>
            `${i + 1}. Đơn #${o.id?.slice(0, 8)} - Tổng: ${o.total?.toLocaleString() || 0}đ - Trạng thái: ${o.status || "N/A"} (${o.created_at})`,
        )
        .join("\n")
    : "Chưa có đơn hàng."
}

=== TASK/CÔNG VIỆC GẦN ĐÂY (${tasks.length} task) ===
${
  tasks.length > 0
    ? tasks
        .map(
          (t: any, i: number) =>
            `${i + 1}. [${t.status || "pending"}] ${t.title || ""} - Ưu tiên: ${t.priority || "normal"} - Hạn: ${t.due_at || "Không có"} (${t.created_at})`,
        )
        .join("\n")
    : "Chưa có task."
}


<KNOWLEDGE_CHUNKS> (${promptChunks.length} chunks)
${
  promptChunks.length > 0
    ? promptChunks
        .map(
          (chunk: any, i: number) =>
            `[Chunk ${i + 1}] Product ID ${chunk.product_id} (${chunk.chunk_type}): ${trimChunk(chunk.content)}`,
        )
        .join("\n")
    : "Không tìm thấy dữ liệu sản phẩm liên quan."
}
</KNOWLEDGE_CHUNKS>

Hãy tóm tắt tổng quan khách hàng này cho nhân viên bán hàng.`;

    // 6. Call AI (with latency tracking)
    let aiResponse: AIResponse;
    try {
      aiResponse = await callAI(userPrompt, systemPrompt, aiConfig);
    } catch (aiError: any) {
      await adminClient.from("ai_conversations").insert({
        user_id: user.id,
        customer_id: customerId,
        mode: "summary",
        prompt: userPrompt,
        retrieved_chunks: productChunks.map((c) => ({ chunk_id: c.id, score: c.similarity })),
        knowledge_version: activeKnowledgeVersion,
        status: "error",
        error_message: aiError.message || "Unknown AI error",
      });
      return json({ error: aiError.message || "Lỗi khi gọi AI provider." }, 500);
    }

    const latencyMs = Date.now() - startTime;

    // 7. Parse AI response
    let parsed: any;
    try {
      parsed = JSON.parse(aiResponse.content);
    } catch {
      parsed = {
        summary: aiResponse.content,
        current_status: "Không xác định",
        key_insights: [],
        risks: [],
        suggested_next_actions: [],
      };
    }

    // --- PHASE P2: Post-LLM Safety Guards in Summary Mode ---
    let hallucinationBlocked = false;
    let finalSummary = parsed.summary || "";
    let finalStatus = parsed.current_status || "";
    let finalInsights = Array.isArray(parsed.key_insights) ? parsed.key_insights : [];
    let finalRisks = Array.isArray(parsed.risks) ? parsed.risks : [];
    let finalActions = Array.isArray(parsed.suggested_next_actions)
      ? parsed.suggested_next_actions
      : [];

    // 1. Check Medical Claims (both hardcoded list and DB active banned phrases list)
    const medicalViolations = detectBannedPhrases(aiResponse.content);
    // Also validate against DB banned phrases
    const dbBannedCheck = await validateAIOutput(aiResponse.content, adminClient);
    if (medicalViolations.length > 0 || dbBannedCheck.blocked) {
      const matchedPhrases = Array.from(
        new Set([...medicalViolations, ...(dbBannedCheck.detectedPhrases || [])]),
      );

      hallucinationBlocked = true;
      finalSummary =
        "Nội dung AI tạo ra có nguy cơ chứa claim y khoa nên đã được chặn. Vui lòng kiểm tra lại Product Knowledge hoặc viết lại câu hỏi.";
      finalStatus = "Blocked";
      finalInsights = [];
      finalRisks = [];
      finalActions = [];
      await logSafetyEvent(adminClient, {
        requestId,
        userId: user.id,
        customerId,
        eventType: "medical_claim_blocked",
        phrase: matchedPhrases.join(", "),
        severity: "high",
        originalResponse: aiResponse.content,
      });
    } else {
      // 2. Check Unsupported Products
      const { data: allProductsData } = await adminClient.from("products").select("name");
      const allProducts = allProductsData || [];
      const productViolations = detectUnsupportedProductMentions(
        aiResponse.content,
        promptChunks,
        allProducts,
      );
      if (productViolations.length > 0) {
        hallucinationBlocked = true;
        finalSummary = `Phản hồi đã bị chặn do nhắc đến sản phẩm không có trong tài liệu đối chiếu: ${productViolations.join(", ")}. Vui lòng viết lại câu hỏi.`;
        finalStatus = "Blocked";
        finalInsights = [];
        finalRisks = [];
        finalActions = [];
        await logSafetyEvent(adminClient, {
          requestId,
          userId: user.id,
          customerId,
          eventType: "unsupported_product_mention",
          phrase: productViolations.join(", "),
          severity: "medium",
          originalResponse: aiResponse.content,
        });
      }
    }

    // 8. Log to ai_conversations (full audit trail)
    const inputCost = (aiResponse.prompt_tokens / 1_000_000) * 0.15;
    const outputCost = (aiResponse.completion_tokens / 1_000_000) * 0.6;
    const estimatedCostUsd = inputCost + outputCost;

    const { data: convRow } = await adminClient
      .from("ai_conversation_logs")
      .insert({
        request_id: requestId,
        user_id: user.id,
        customer_id: customerId,
        task_id: taskId || null,
        mode: "summary",
        request_preview: truncateString(userPrompt),
        response_preview: truncateString(aiResponse.content),
        retrieved_chunks: JSON.stringify(
          productChunks.map((c) => ({
            chunk_id: c.id,
            product_id: c.product_id,
            chunk_type: c.chunk_type,
            score: c.similarity,
          })),
        ),
        prompt_tokens: aiResponse.prompt_tokens,
        completion_tokens: aiResponse.completion_tokens,
        total_tokens: aiResponse.total_tokens,
        estimated_cost_usd: estimatedCostUsd,
        status: "success",
        error_message: null,
      })
      .select("id")
      .single();

    const conversationId = convRow?.id || null;

    // --- PHASE 7.4: Log token cost ---
    await logUsage(adminClient, aiConfig, {
      userId: user.id,
      customerId,
      mode: "summary",
      promptTokens: aiResponse.prompt_tokens,
      completionTokens: aiResponse.completion_tokens,
      totalTokens: aiResponse.total_tokens,
      latencyMs,
    });

    // 9. Return structured response
    return json({
      conversation_id: conversationId,
      summary: finalSummary,
      hallucination_blocked: hallucinationBlocked,
      current_status: finalStatus,
      key_insights: finalInsights,
      risks: finalRisks,
      suggested_next_actions: finalActions,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
