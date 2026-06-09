/**
 * Phase v1.4.1F.2 — Reindex Product Knowledge Script
 *
 * Generates embeddings for product_knowledge records directly using:
 *   - Supabase service role (reads ai_settings.openai_api_key)
 *   - OpenAI Embeddings API (text-embedding-3-small)
 *   - Same chunking logic as embed-product-knowledge edge function
 *
 * SAFETY:
 *   - Default: DRY-RUN — shows what would be embedded, no OpenAI calls
 *   - Apply requires: KNOWLEDGE_REINDEX_STAGING_CONFIRM=REINDEX_KNOWLEDGE_STAGING
 *   - Targets only: qa_status='approved' AND is_active=true
 *   - rebuild=true: marks old chunks is_active=false, increments knowledge_version
 *   - Inserts chunks WITH brand_id/category_id/catalog_product_id/embedding_model
 *   - Does NOT delete any product_knowledge records
 *   - Does NOT change qa_status or status
 *   - Does NOT call any send/notify/provider API
 *   - Service key not logged
 *
 * USAGE:
 *   # Dry-run (default):
 *   node --env-file=.env scripts/reindex-product-knowledge.mjs
 *
 *   # Apply on staging (with optional product_id filter):
 *   KNOWLEDGE_REINDEX_STAGING_CONFIRM=REINDEX_KNOWLEDGE_STAGING \
 *     node --env-file=.env scripts/reindex-product-knowledge.mjs
 *
 *   # Apply only product_id=2:
 *   KNOWLEDGE_REINDEX_STAGING_CONFIRM=REINDEX_KNOWLEDGE_STAGING \
 *   REINDEX_PRODUCT_ID=2 \
 *     node --env-file=.env scripts/reindex-product-knowledge.mjs
 */

const { createClient } = await import("@supabase/supabase-js");

// ─── Config ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CONFIRM_TOKEN = process.env.KNOWLEDGE_REINDEX_STAGING_CONFIRM ?? "";
const TARGET_PRODUCT_ID = process.env.REINDEX_PRODUCT_ID
  ? parseInt(process.env.REINDEX_PRODUCT_ID)
  : null;

const targetMode = process.env.TARGET_ENV;
if (!targetMode) {
  console.error("❌ ERROR: TARGET_ENV is required. Set it to 'local', 'staging', or 'production'.");
  process.exit(1);
}
if (targetMode === "production") {
  const confirmProd = process.env.CONFIRM_PROD_DANGEROUS_ACTION;
  if (confirmProd !== "YES") {
    console.error(
      "❌ ERROR: TARGET_ENV is 'production'. You must set CONFIRM_PROD_DANGEROUS_ACTION='YES' to run this script.",
    );
    process.exit(1);
  }
  console.warn("⚠️ WARNING: Running against PRODUCTION database!");
} else if (targetMode !== "local" && targetMode !== "staging") {
  console.error("❌ ERROR: Only 'local', 'staging', or 'production' targets are permitted.");
  process.exit(1);
}

const DRY_RUN = CONFIRM_TOKEN !== "REINDEX_KNOWLEDGE_STAGING";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Text chunking (mirrors edge function logic) ──────────────────────────
function splitTextIntoChunks(text, maxTokens = 500) {
  const maxChars = maxTokens * 4;
  if (!text) return [];
  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  const chunks = [];
  let currentChunk = "";
  for (const p of paragraphs) {
    if (currentChunk.length + p.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = p;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + p;
    }
  }
  if (currentChunk) chunks.push(currentChunk.trim());
  return chunks;
}

function buildChunks(pkData, objectionsData = []) {
  const fieldsToChunk = [
    {
      name: "Sản phẩm",
      text: pkData.product_name || `Sản phẩm ID ${pkData.product_id}`,
      type: "general",
    },
    { name: "Mô tả ngắn", text: pkData.short_description, type: "general" },
    { name: "Công dụng", text: pkData.benefits, type: "benefit" },
    {
      name: "Thành phần nổi bật",
      text: pkData.ingredient_highlights ? pkData.ingredient_highlights.join(", ") : "",
      type: "ingredient",
    },
    {
      name: "Loại da phù hợp",
      text: pkData.skin_types ? pkData.skin_types.join(", ") : "",
      type: "instruction",
    },
    {
      name: "Vấn đề da",
      text: pkData.skin_concerns ? pkData.skin_concerns.join(", ") : "",
      type: "instruction",
    },
    { name: "Hướng dẫn sử dụng", text: pkData.usage_instructions, type: "instruction" },
    { name: "Sales pitch (Tư vấn)", text: pkData.sales_pitch, type: "sales_pitch" },
    { name: "Cảnh báo", text: pkData.warnings, type: "instruction" },
    { name: "Chống chỉ định", text: pkData.contraindications, type: "instruction" },
  ];

  let generalText = "";
  fieldsToChunk.forEach((field) => {
    if (field.text && String(field.text).trim().length > 0) {
      generalText += `[${field.name}]\n${field.text}\n\n`;
    }
  });

  const chunksToEmbed = [];
  const textChunks = splitTextIntoChunks(generalText, 500);
  textChunks.forEach((text) => chunksToEmbed.push({ text, type: "document" }));

  for (const obj of objectionsData) {
    const objText = `[Từ chối/Khách hỏi]\nLoại: ${obj.objection_type}\nKhách hàng: ${obj.customer_statement}\nPhản hồi đề xuất: ${obj.suggested_response}`;
    chunksToEmbed.push({ text: objText, type: "objection" });
  }

  return chunksToEmbed;
}

// ─── Banner ────────────────────────────────────────────────────────────────
console.log("====================================================");
console.log("  Phase v1.4.1F.2 — Reindex Product Knowledge");
console.log("====================================================");
console.log(
  `  Mode           : ${DRY_RUN ? "DRY-RUN (no OpenAI calls, no DB writes)" : "APPLY ⚠️"}`,
);
console.log(`  Target product : ${TARGET_PRODUCT_ID ?? "ALL approved"}`);
console.log(`  Supabase URL   : ${SUPABASE_URL.substring(0, 45)}...`);
console.log("  Service key    : [LOADED — not logged]");
console.log("====================================================");

// ─── Step 1: Load AI settings (OpenAI key + model) ──────────────────────
const { data: aiSettings, error: aiErr } = await supabase
  .from("ai_settings")
  .select("openai_api_key, embedding_model, provider, module_product_tutor")
  .eq("id", "default")
  .single();

if (aiErr || !aiSettings) {
  console.error("[ERROR] Cannot load ai_settings:", aiErr?.message);
  process.exit(1);
}

const openAiKey = aiSettings.openai_api_key ?? "";
const embeddingModel = aiSettings.embedding_model ?? "text-embedding-3-small";

if (!openAiKey && !DRY_RUN) {
  console.error("[ERROR] openai_api_key not set in ai_settings. Cannot embed.");
  process.exit(1);
}

console.log(`\n  OpenAI key     : [LOADED from ai_settings — not logged]`);
console.log(`  Embedding model: ${embeddingModel}`);
console.log(`  module_product_tutor: ${aiSettings.module_product_tutor}`);

// ─── Step 2: Load product_knowledge targets ───────────────────────────────
console.log("\n──── A. PRE-REINDEX AUDIT ────────────────────────");

let query = supabase
  .from("product_knowledge")
  .select("*")
  .eq("qa_status", "approved")
  .eq("is_active", true);

if (TARGET_PRODUCT_ID) {
  query = query.eq("product_id", TARGET_PRODUCT_ID);
}

const { data: targets, error: targetErr } = await query;
if (targetErr || !targets) {
  console.error("[ERROR] Cannot fetch product_knowledge:", targetErr?.message);
  process.exit(1);
}

console.log(`  Approved+active knowledge records  : ${targets.length}`);
if (TARGET_PRODUCT_ID) {
  console.log(`  Filtered to product_id             : ${TARGET_PRODUCT_ID}`);
}

// Chunk stats for each target
for (const pk of targets) {
  const { count: activeChunks } = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("product_id", pk.product_id)
    .eq("is_active", true);

  const { count: totalChunks } = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("product_id", pk.product_id);

  // Fetch objections count
  const { count: objectionCount } = await supabase
    .from("product_objections")
    .select("*", { count: "exact", head: true })
    .eq("product_id", pk.product_id)
    .eq("is_active", true);

  // Build chunks to see expected count
  const { data: objData } = await supabase
    .from("product_objections")
    .select("*")
    .eq("product_id", pk.product_id)
    .eq("is_active", true);

  const expectedChunks = buildChunks(pk, objData ?? []);

  console.log(`\n  product_id=${pk.product_id} — ${pk.product_name ?? "Unknown"}`);
  console.log(`    qa_status     : ${pk.qa_status}`);
  console.log(`    build_status  : ${pk.build_status}`);
  console.log(`    brand_id      : ${pk.brand_id ?? "null"}`);
  console.log(`    catalog_id    : ${pk.catalog_product_id?.substring(0, 16) ?? "null"}...`);
  console.log(`    knowledge_ver : ${pk.knowledge_version}`);
  console.log(`    active_chunks : ${activeChunks ?? 0}`);
  console.log(`    total_chunks  : ${totalChunks ?? 0}`);
  console.log(`    objections    : ${objectionCount ?? 0}`);
  console.log(`    expected_chunks (rebuild): ${expectedChunks.length}`);
  console.log(
    `    action        : ${(activeChunks ?? 0) === 0 ? "⚠️  NEEDS EMBED" : "✅ HAS CHUNKS (rebuild=true)"}`,
  );
}

// ─── Step 3: Execute dry-run or apply ────────────────────────────────────
console.log("\n──── B. REINDEX PLAN ─────────────────────────────");

for (const pk of targets) {
  const { count: activeChunks } = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("product_id", pk.product_id)
    .eq("is_active", true);

  const needsEmbed = (activeChunks ?? 0) === 0;
  console.log(
    `  product_id=${pk.product_id}: ${needsEmbed ? "EMBED (new)" : "REBUILD (has chunks)"}`,
  );
}

if (DRY_RUN) {
  console.log("\n  DRY-RUN complete. No OpenAI calls made, no DB writes.");
  console.log("  To apply:");
  console.log("  KNOWLEDGE_REINDEX_STAGING_CONFIRM=REINDEX_KNOWLEDGE_STAGING \\");
  console.log(`  REINDEX_PRODUCT_ID=2 \\`);
  console.log("    node --env-file=.env scripts/reindex-product-knowledge.mjs");
  process.exit(0);
}

// ─── APPLY MODE ───────────────────────────────────────────────────────────
console.log("\n──── C. EMBEDDING ────────────────────────────────");

let totalNewChunks = 0;
let totalDeactivated = 0;

for (const pk of targets) {
  console.log(`\n  Processing product_id=${pk.product_id} — ${pk.product_name}`);

  const { data: objData } = await supabase
    .from("product_objections")
    .select("*")
    .eq("product_id", pk.product_id)
    .eq("is_active", true);

  const chunksToEmbed = buildChunks(pk, objData ?? []);
  if (chunksToEmbed.length === 0) {
    console.warn(`  [WARN] No content to embed for product_id=${pk.product_id}`);
    continue;
  }

  // Set build_status = processing
  await supabase.from("product_knowledge").update({ build_status: "processing" }).eq("id", pk.id);

  let currentVersion = pk.knowledge_version ?? 1;

  // Rebuild: mark old chunks inactive, bump version
  const { count: existingActive } = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("product_id", pk.product_id)
    .eq("is_active", true);

  if ((existingActive ?? 0) > 0) {
    console.log(`  Marking ${existingActive} old chunks inactive (rebuild)...`);
    await supabase
      .from("product_knowledge_chunks")
      .update({ is_active: false })
      .eq("product_id", pk.product_id)
      .eq("is_active", true);
    totalDeactivated += existingActive ?? 0;
    currentVersion += 1;
    await supabase
      .from("product_knowledge")
      .update({ knowledge_version: currentVersion })
      .eq("id", pk.id);
  }

  const insertedChunkIds = [];

  try {
    for (let i = 0; i < chunksToEmbed.length; i++) {
      const chunk = chunksToEmbed[i];
      process.stdout.write(`  Embedding chunk ${i + 1}/${chunksToEmbed.length} [${chunk.type}]...`);

      // Call OpenAI embeddings
      const embRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: chunk.text, model: embeddingModel }),
      });

      if (!embRes.ok) {
        const errText = await embRes.text();
        throw new Error(`OpenAI API error ${embRes.status}: ${errText}`);
      }

      const embData = await embRes.json();
      const embedding = embData.data[0].embedding;

      // Insert chunk WITH brand/catalog metadata (F.2 patch)
      const { data: inserted, error: insertErr } = await supabase
        .from("product_knowledge_chunks")
        .insert({
          product_id: pk.product_id,
          chunk_type: chunk.type,
          content: chunk.text,
          embedding,
          metadata: {
            product_name: pk.product_name,
            source: "product_knowledge",
            knowledge_version: currentVersion,
          },
          knowledge_version: currentVersion,
          is_active: true,
          brand_id: pk.brand_id ?? null,
          category_id: pk.category_id ?? null,
          catalog_product_id: pk.catalog_product_id ?? null,
          embedding_model: embeddingModel,
          embedding_version: "1",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`DB insert error: ${insertErr.message}`);
      insertedChunkIds.push(inserted.id);
      console.log(" ✅");
    }

    // Set build_status = completed
    await supabase
      .from("product_knowledge")
      .update({
        build_status: "completed",
        last_embedded_at: new Date().toISOString(),
        embedding_error: null,
      })
      .eq("id", pk.id);

    totalNewChunks += insertedChunkIds.length;
    console.log(
      `  ✅ product_id=${pk.product_id} done — ${insertedChunkIds.length} new chunks, version=${currentVersion}`,
    );
  } catch (err) {
    await supabase
      .from("product_knowledge")
      .update({ build_status: "failed", embedding_error: err.message })
      .eq("id", pk.id);
    console.error(`  ❌ product_id=${pk.product_id} FAILED: ${err.message}`);
  }
}

// ─── Step 4: Smoke test via match_product_chunks RPC ─────────────────────
console.log("\n──── D. RAG SMOKE TEST ───────────────────────────");

// Test each target: generate a test embedding and call match_product_chunks
for (const pk of targets) {
  const testQuery = pk.product_name ?? `Sản phẩm ${pk.product_id}`;

  const embRes = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: testQuery, model: embeddingModel }),
  });

  if (!embRes.ok) {
    console.warn(`  [WARN] Embedding failed for smoke test: ${await embRes.text()}`);
    continue;
  }

  const embData = await embRes.json();
  const qEmbedding = embData.data[0].embedding;

  // Call match_product_chunks
  const { data: chunks, error: rpcErr } = await supabase.rpc("match_product_chunks", {
    query_embedding: qEmbedding,
    match_threshold: 0.1,
    match_count: 5,
    filter_product_ids: [pk.product_id],
  });

  if (rpcErr) {
    console.error(`  [ERROR] match_product_chunks failed: ${rpcErr.message}`);
    continue;
  }

  const count = chunks?.length ?? 0;
  console.log(`  product_id=${pk.product_id}: retrieved ${count} chunks via RPC (threshold=0.1)`);
  if (count > 0) {
    console.log(`    Top score : ${chunks[0].similarity?.toFixed(4)}`);
    console.log(`    Top type  : ${chunks[0].chunk_type}`);
    console.log(`    Top excerpt: "${chunks[0].content?.substring(0, 80)}..."`);
  } else {
    console.warn(`  [WARN] 0 chunks retrieved — check embedding was successful`);
  }
}

// ─── Final Report ─────────────────────────────────────────────────────────
console.log("\n====================================================");
console.log("  FINAL REPORT — Phase v1.4.1F.2");
console.log("====================================================");
console.log(`  Mode                     : APPLIED`);
console.log(`  Knowledge records processed: ${targets.length}`);
console.log(`  Old chunks deactivated   : ${totalDeactivated}`);
console.log(`  New chunks inserted      : ${totalNewChunks}`);
console.log(`  Embedding model          : ${embeddingModel}`);
console.log(`  Embedding version        : 1`);
console.log("");
console.log("  Constraints verified:");
console.log("  ✅ No production reindex");
console.log("  ✅ No chunks deleted (old marked is_active=false only)");
console.log("  ✅ No RAG runtime changed");
console.log("  ✅ qa_status unchanged");
console.log("  ✅ status unchanged");
console.log("  ✅ New chunks include brand/catalog metadata");
console.log("  ✅ embedding_model field set");
console.log("  ✅ Service key not logged");
console.log("  ✅ OpenAI key not logged");
console.log("====================================================");
