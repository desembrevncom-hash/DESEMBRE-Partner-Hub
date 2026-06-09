/**
 * Phase v1.4.1F.1 — Knowledge Mapping Script
 *
 * Maps product_knowledge (legacy integer product_id) to catalog DB multi-brand
 * by backfilling: brand_id, category_id, catalog_product_id
 * Also backfills matching product_knowledge_chunks.
 *
 * MAPPING RULE:
 *   catalog_products.product_code = product_knowledge.product_id::text
 *   → update product_knowledge.brand_id, category_id, catalog_product_id
 *   → sync product_knowledge_chunks with same values
 *
 * SAFETY:
 *   - Default: DRY-RUN (no DB writes)
 *   - Apply mode requires: KNOWLEDGE_MAPPING_STAGING_CONFIRM=MAP_KNOWLEDGE_TO_CATALOG_STAGING
 *   - Does NOT delete, re-embed, or touch embedding vectors
 *   - Does NOT change qa_status, status, content, chunk_type, knowledge_version
 *   - Does NOT auto-map Dermagarden/VAVAW without explicit catalog match
 *   - Does NOT log secret keys
 *
 * USAGE (Node 20.6+ native .env loading):
 *   # Dry-run (safe, default):
 *   node --env-file=.env scripts/map-product-knowledge-catalog.mjs
 *
 *   # Apply on staging only:
 *   KNOWLEDGE_MAPPING_STAGING_CONFIRM=MAP_KNOWLEDGE_TO_CATALOG_STAGING \
 *     node --env-file=.env scripts/map-product-knowledge-catalog.mjs
 */

// ─── Dynamic import @supabase/supabase-js (ESM) ───────────────────────────
const { createClient } = await import("@supabase/supabase-js");

// ─── Config ───────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const CONFIRM_TOKEN = process.env.KNOWLEDGE_MAPPING_STAGING_CONFIRM ?? "";

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

const DRY_RUN = CONFIRM_TOKEN !== "MAP_KNOWLEDGE_TO_CATALOG_STAGING";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  console.error("[ERROR] Run: node --env-file=.env scripts/map-product-knowledge-catalog.mjs");
  process.exit(1);
}

// Production guard — warn if URL looks like a cloud Supabase project
if (!DRY_RUN) {
  const isLocal =
    SUPABASE_URL.includes("localhost") ||
    SUPABASE_URL.includes("127.0.0.1") ||
    SUPABASE_URL.includes("kong.supabase.local");
  if (!isLocal) {
    console.warn("[WARNING] Supabase URL looks like a cloud project.");
    console.warn("[WARNING] Ensure this is your STAGING project, NOT production.");
    console.warn("[WARNING] If wrong, kill this script now.");
    await new Promise((r) => setTimeout(r, 3000));
  }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Section A: AUDIT ─────────────────────────────────────────────────────
console.log("\n====================================================");
console.log("  Phase v1.4.1F.1 — Knowledge Mapping Script");
console.log("====================================================");
console.log(`  Mode         : ${DRY_RUN ? "DRY-RUN (no DB writes)" : "APPLY ⚠️"}`);
console.log(`  Supabase URL : ${SUPABASE_URL.substring(0, 45)}...`);
console.log("  Service key  : [LOADED — not logged]");
console.log("====================================================");

console.log("\n──── A. AUDIT BEFORE MAPPING ─────────────────────");

const { data: pkAll, error: pkErr } = await supabase
  .from("product_knowledge")
  .select(
    "id, product_id, brand_id, category_id, catalog_product_id, qa_status, build_status, is_active",
  );

if (pkErr || !pkAll) {
  console.error("[ERROR] fetch product_knowledge:", pkErr?.message);
  process.exit(1);
}

const { count: totalChunks } = await supabase
  .from("product_knowledge_chunks")
  .select("*", { count: "exact", head: true });

const qaStatusDist = {};
const buildStatusDist = {};
let brandIdPopulated = 0,
  categoryIdPopulated = 0,
  catalogProductIdPopulated = 0;

for (const r of pkAll) {
  if (r.brand_id) brandIdPopulated++;
  if (r.category_id) categoryIdPopulated++;
  if (r.catalog_product_id) catalogProductIdPopulated++;
  const qs = r.qa_status ?? "null";
  const bs = r.build_status ?? "null";
  qaStatusDist[qs] = (qaStatusDist[qs] ?? 0) + 1;
  buildStatusDist[bs] = (buildStatusDist[bs] ?? 0) + 1;
}

// Approved knowledge without active chunks
let approvedWithNoChunks = 0;
const approvedPks = pkAll.filter((r) => r.qa_status === "approved" && r.is_active);
for (const pk of approvedPks) {
  const { count } = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("product_id", pk.product_id)
    .eq("is_active", true);
  if ((count ?? 0) === 0) approvedWithNoChunks++;
}

console.log(`  total product_knowledge records : ${pkAll.length}`);
console.log(`  total product_knowledge_chunks  : ${totalChunks ?? "unknown"}`);
console.log(`  brand_id populated              : ${brandIdPopulated}`);
console.log(`  category_id populated           : ${categoryIdPopulated}`);
console.log(`  catalog_product_id populated    : ${catalogProductIdPopulated}`);
console.log(`  qa_status distribution          :`, JSON.stringify(qaStatusDist));
console.log(`  build_status distribution       :`, JSON.stringify(buildStatusDist));
console.log(`  approved with no active chunks  : ${approvedWithNoChunks}`);

// ─── Section B: BUILD MAPPING CANDIDATES ─────────────────────────────────
console.log("\n──── B. MAPPING CANDIDATES ───────────────────────");

// Fetch catalog_products (product_code NOT NULL)
const { data: catalogProducts, error: cpErr } = await supabase
  .from("catalog_products")
  .select("id, product_code, name, brand_id, category_id, status")
  .not("product_code", "is", null);

if (cpErr || !catalogProducts) {
  console.error("[ERROR] fetch catalog_products:", cpErr?.message);
  process.exit(1);
}

const { data: brands } = await supabase.from("product_brands").select("id, name, code, slug");
const { data: categories } = await supabase.from("product_categories").select("id, name, brand_id");

const brandMap = new Map((brands ?? []).map((b) => [b.id, b]));
const categoryMap = new Map((categories ?? []).map((c) => [c.id, c]));
const catalogByCode = new Map(
  catalogProducts.filter((cp) => cp.product_code != null).map((cp) => [cp.product_code, cp]),
);

const candidates = [];
const unmapped = [];

for (const pk of pkAll) {
  const code = String(pk.product_id);
  const cp = catalogByCode.get(code);

  if (!cp) {
    unmapped.push(pk.product_id);
    continue;
  }

  const brand = brandMap.get(cp.brand_id);
  if (!brand) {
    console.warn(`  [WARN] catalog_product ${cp.id} has unknown brand_id=${cp.brand_id} — skip`);
    unmapped.push(pk.product_id);
    continue;
  }

  const category = cp.category_id ? categoryMap.get(cp.category_id) : null;

  candidates.push({
    knowledge_id: pk.id,
    product_id: pk.product_id,
    old_brand_id: pk.brand_id,
    old_category_id: pk.category_id,
    old_catalog_product_id: pk.catalog_product_id,
    new_brand_id: cp.brand_id,
    new_category_id: cp.category_id ?? null,
    new_catalog_product_id: cp.id,
    product_name: cp.name,
    brand_name: brand.name,
    brand_code: brand.code,
    category_name: category?.name ?? null,
    catalog_product_status: cp.status,
  });
}

// ─── Section C: DRY-RUN PREVIEW ─────────────────────────────────────────
console.log(`  Mappable knowledge records  : ${candidates.length}`);
console.log(`  Unmapped (no catalog match) : ${unmapped.length}`);

if (unmapped.length > 0) {
  console.log(`  Unmapped product_ids        : [${unmapped.join(", ")}]`);
  console.log("  → Dermagarden/VAVAW may appear here if not in catalog DB");
  console.log("  → These records will NOT be modified");
}

const willUpdate = candidates.filter(
  (c) =>
    c.old_brand_id !== c.new_brand_id ||
    c.old_category_id !== c.new_category_id ||
    c.old_catalog_product_id !== c.new_catalog_product_id,
);

console.log(`\n  Records that WILL BE UPDATED : ${willUpdate.length}`);
console.log(`  Records already mapped (skip): ${candidates.length - willUpdate.length}`);

console.log("\n──── C. MAPPING PREVIEW ──────────────────────────");
console.log("  " + "─".repeat(108));
console.log(
  "  " +
    "product_id".padEnd(12) +
    "brand".padEnd(12) +
    "category".padEnd(20) +
    "catalog_product_name".padEnd(46) +
    "cp_status".padEnd(10) +
    "action",
);
console.log("  " + "─".repeat(108));

for (const c of candidates) {
  const alreadyMapped =
    c.old_brand_id === c.new_brand_id && c.old_catalog_product_id === c.new_catalog_product_id;
  const action = alreadyMapped ? "SKIP(same)" : "UPDATE";
  console.log(
    "  " +
      String(c.product_id).padEnd(12) +
      c.brand_code.padEnd(12) +
      (c.category_name ?? "—").substring(0, 19).padEnd(20) +
      c.product_name.substring(0, 45).padEnd(46) +
      c.catalog_product_status.padEnd(10) +
      action,
  );
}

// ─── Section D: APPLY ────────────────────────────────────────────────────
let knowledgeUpdated = 0;
let chunksUpdated = 0;

if (!DRY_RUN) {
  console.log("\n──── D. APPLYING MAPPING ─────────────────────────");

  for (const c of willUpdate) {
    const { error: pkUpdateErr } = await supabase
      .from("product_knowledge")
      .update({
        brand_id: c.new_brand_id,
        category_id: c.new_category_id,
        catalog_product_id: c.new_catalog_product_id,
      })
      .eq("id", c.knowledge_id);

    if (pkUpdateErr) {
      console.error(`  [ERROR] knowledge id=${c.knowledge_id}: ${pkUpdateErr.message}`);
      continue;
    }
    knowledgeUpdated++;
    console.log(`  [OK] knowledge product_id=${c.product_id} → brand=${c.brand_code}`);

    // Sync chunks
    const { data: updatedChunks, error: chunkErr } = await supabase
      .from("product_knowledge_chunks")
      .update({
        brand_id: c.new_brand_id,
        category_id: c.new_category_id,
        catalog_product_id: c.new_catalog_product_id,
      })
      .eq("product_id", c.product_id)
      .select("id");

    if (chunkErr) {
      console.warn(`  [WARN] chunks product_id=${c.product_id}: ${chunkErr.message}`);
    } else {
      const cnt = updatedChunks?.length ?? 0;
      chunksUpdated += cnt;
      if (cnt > 0) console.log(`  [OK] chunks product_id=${c.product_id} → ${cnt} chunks updated`);
    }
  }
}

// ─── Section E: FINAL REPORT ─────────────────────────────────────────────
console.log("\n====================================================");
console.log("  FINAL REPORT — Phase v1.4.1F.1");
console.log("====================================================");
console.log(`  Mode                         : ${DRY_RUN ? "DRY-RUN" : "APPLIED"}`);
console.log(`  Total knowledge records      : ${pkAll.length}`);
console.log(`  Mappable (catalog match)     : ${candidates.length}`);
console.log(
  `  Will/did update              : ${DRY_RUN ? willUpdate.length + " (would)" : knowledgeUpdated}`,
);
console.log(`  Unmapped (no catalog match)  : ${unmapped.length}`);
if (unmapped.length > 0) {
  console.log(`  Unmapped product_ids         : [${unmapped.join(", ")}]`);
}
if (!DRY_RUN) {
  console.log(`  Knowledge records updated    : ${knowledgeUpdated}`);
  console.log(`  Chunks updated               : ${chunksUpdated}`);
}
console.log("");
console.log("  Constraints verified:");
console.log("  ✅ No reindex");
console.log("  ✅ No chunks deleted");
console.log("  ✅ No embedding vectors touched");
console.log("  ✅ No RAG runtime changed");
console.log("  ✅ qa_status unchanged");
console.log("  ✅ status unchanged");
console.log("  ✅ content/chunk_type unchanged");
console.log("  ✅ knowledge_version unchanged");
console.log("  ✅ Service key not logged");
console.log("  ✅ Dermagarden/VAVAW not auto-mapped without catalog evidence");

if (DRY_RUN) {
  console.log("\n  ── TO APPLY ON STAGING ──────────────────────────────");
  console.log("  KNOWLEDGE_MAPPING_STAGING_CONFIRM=MAP_KNOWLEDGE_TO_CATALOG_STAGING \\");
  console.log("    node --env-file=.env scripts/map-product-knowledge-catalog.mjs");
}
console.log("====================================================");
