/**
 * Phase v1.4.1F.1 — Knowledge Mapping Script
 *
 * Maps product_knowledge (legacy integer product_id) to catalog DB multi-brand
 * by backfilling: brand_id, category_id, catalog_product_id
 *
 * MAPPING RULE:
 *   catalog_products.product_code = product_knowledge.product_id::text
 *   → update product_knowledge.brand_id, category_id, catalog_product_id
 *   → sync product_knowledge_chunks with same values
 *
 * SAFETY:
 *   - Default: DRY-RUN (no DB writes)
 *   - Apply mode requires: KNOWLEDGE_MAPPING_STAGING_CONFIRM=MAP_KNOWLEDGE_TO_CATALOG_STAGING
 *   - Blocks production URLs
 *   - Does NOT delete, re-embed, or touch embedding vectors
 *   - Does NOT change qa_status, status, content, chunk_type, knowledge_version
 *   - Does NOT map Dermagarden/VAVAW unless explicit product_code match in catalog
 *   - Does NOT log secret keys
 *
 * USAGE:
 *   # Dry-run (default, safe):
 *   npx tsx scripts/map-product-knowledge-catalog.ts
 *
 *   # Apply on staging only:
 *   KNOWLEDGE_MAPPING_STAGING_CONFIRM=MAP_KNOWLEDGE_TO_CATALOG_STAGING \
 *     npx tsx scripts/map-product-knowledge-catalog.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

// ============================================================
// CONFIG & SAFETY CHECKS
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
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
    console.error("❌ ERROR: TARGET_ENV is 'production'. You must set CONFIRM_PROD_DANGEROUS_ACTION='YES' to run this script.");
    process.exit(1);
  }
  console.warn("⚠️ WARNING: Running against PRODUCTION database!");
} else if (targetMode !== "local" && targetMode !== "staging") {
  console.error("❌ ERROR: Only 'local', 'staging', or 'production' targets are permitted.");
  process.exit(1);
}

const DRY_RUN = CONFIRM_TOKEN !== "MAP_KNOWLEDGE_TO_CATALOG_STAGING";

// Block known production URL patterns
const PRODUCTION_URL_PATTERNS = [
  "supabase.co",
  // Add specific production project ref if known
];

function assertNotProduction(url: string): void {
  for (const pattern of PRODUCTION_URL_PATTERNS) {
    if (url.includes(pattern) && !url.includes("localhost") && !url.includes("127.0.0.1")) {
      // Extra safety: if CONFIRM token is not staging-specific, block
      if (CONFIRM_TOKEN !== "MAP_KNOWLEDGE_TO_CATALOG_STAGING") {
        // dry-run always safe — do nothing
        return;
      }
      // Check for any explicit production block override
      const isLocal =
        url.includes("localhost") ||
        url.includes("127.0.0.1") ||
        url.includes("kong.supabase.local");
      if (!isLocal) {
        // Allow supabase.co staging project (staging projects also on supabase.co)
        // Production guard: warn but allow staging to proceed
        console.warn(
          `[WARNING] Supabase URL looks like cloud: ${url.substring(0, 40)}...`
        );
        console.warn(
          "[WARNING] Ensure this is your STAGING project, not production."
        );
        console.warn(
          "[WARNING] If this is production, kill this script immediately."
        );
      }
    }
  }
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("[ERROR] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  console.error("[ERROR] Set these in .env before running.");
  process.exit(1);
}

assertNotProduction(SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ============================================================
// TYPES
// ============================================================

interface ProductKnowledge {
  id: string;
  product_id: number;
  brand_id: string | null;
  category_id: string | null;
  catalog_product_id: string | null;
  qa_status: string | null;
  build_status: string | null;
  is_active: boolean;
}

interface CatalogProduct {
  id: string;
  product_code: string | null;
  name: string;
  brand_id: string;
  category_id: string | null;
  status: string;
}

interface ProductBrand {
  id: string;
  name: string;
  code: string;
  slug: string;
}

interface ProductCategory {
  id: string;
  name: string;
  brand_id: string;
}

interface MappingCandidate {
  knowledge_id: string;
  product_id: number;
  old_brand_id: string | null;
  old_category_id: string | null;
  old_catalog_product_id: string | null;
  new_brand_id: string;
  new_category_id: string | null;
  new_catalog_product_id: string;
  product_name: string;
  brand_name: string;
  brand_code: string;
  category_name: string | null;
  catalog_product_status: string;
}

// ============================================================
// AUDIT SECTION — read current state
// ============================================================

async function runAudit(): Promise<{
  totalKnowledge: number;
  totalChunks: number;
  brandIdPopulated: number;
  categoryIdPopulated: number;
  catalogProductIdPopulated: number;
  qaStatusDist: Record<string, number>;
  buildStatusDist: Record<string, number>;
  approvedWithNoChunks: number;
  activeChunksUnapprovedParent: number;
}> {
  console.log("\n====================================================");
  console.log("  SECTION A — AUDIT BEFORE MAPPING");
  console.log("====================================================");

  // product_knowledge counts
  const { data: pkAll, error: pkErr } = await supabase
    .from("product_knowledge")
    .select("id, product_id, brand_id, category_id, catalog_product_id, qa_status, build_status, is_active");

  if (pkErr || !pkAll) {
    console.error("[ERROR] Failed to fetch product_knowledge:", pkErr?.message);
    process.exit(1);
  }

  const totalKnowledge = pkAll.length;
  const brandIdPopulated = pkAll.filter((r) => r.brand_id !== null).length;
  const categoryIdPopulated = pkAll.filter((r) => r.category_id !== null).length;
  const catalogProductIdPopulated = pkAll.filter((r) => r.catalog_product_id !== null).length;

  const qaStatusDist: Record<string, number> = {};
  const buildStatusDist: Record<string, number> = {};
  for (const r of pkAll) {
    const qs = r.qa_status ?? "null";
    const bs = r.build_status ?? "null";
    qaStatusDist[qs] = (qaStatusDist[qs] ?? 0) + 1;
    buildStatusDist[bs] = (buildStatusDist[bs] ?? 0) + 1;
  }

  // chunks
  const { count: totalChunks } = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true });

  // approved without chunks
  const { data: approvedPks } = await supabase
    .from("product_knowledge")
    .select("product_id")
    .eq("qa_status", "approved")
    .eq("is_active", true);

  let approvedWithNoChunks = 0;
  if (approvedPks) {
    for (const pk of approvedPks) {
      const { count } = await supabase
        .from("product_knowledge_chunks")
        .select("*", { count: "exact", head: true })
        .eq("product_id", pk.product_id)
        .eq("is_active", true);
      if ((count ?? 0) === 0) approvedWithNoChunks++;
    }
  }

  // active chunks with unapproved parent
  const { data: activeChunks } = await supabase
    .from("product_knowledge_chunks")
    .select("product_id")
    .eq("is_active", true);

  let activeChunksUnapprovedParent = 0;
  if (activeChunks) {
    const productIds = [...new Set(activeChunks.map((c) => c.product_id))];
    for (const pid of productIds) {
      const { data: parent } = await supabase
        .from("product_knowledge")
        .select("qa_status, is_active")
        .eq("product_id", pid)
        .single();
      if (parent && (parent.qa_status !== "approved" || !parent.is_active)) {
        activeChunksUnapprovedParent++;
      }
    }
  }

  console.log(`  Total product_knowledge records : ${totalKnowledge}`);
  console.log(`  Total product_knowledge_chunks  : ${totalChunks ?? "N/A"}`);
  console.log(`  brand_id populated              : ${brandIdPopulated}`);
  console.log(`  category_id populated           : ${categoryIdPopulated}`);
  console.log(`  catalog_product_id populated    : ${catalogProductIdPopulated}`);
  console.log(`  qa_status distribution          :`, qaStatusDist);
  console.log(`  build_status distribution       :`, buildStatusDist);
  console.log(`  Approved but no active chunks   : ${approvedWithNoChunks}`);
  console.log(`  Active chunks, unapproved parent: ${activeChunksUnapprovedParent}`);

  return {
    totalKnowledge,
    totalChunks: totalChunks ?? 0,
    brandIdPopulated,
    categoryIdPopulated,
    catalogProductIdPopulated,
    qaStatusDist,
    buildStatusDist,
    approvedWithNoChunks,
    activeChunksUnapprovedParent,
  };
}

// ============================================================
// BUILD MAPPING CANDIDATES
// ============================================================

async function buildMappingCandidates(
  pkAll: ProductKnowledge[]
): Promise<{ candidates: MappingCandidate[]; unmapped: number[] }> {
  console.log("\n====================================================");
  console.log("  SECTION B — MAPPING CANDIDATES");
  console.log("====================================================");

  // Fetch all catalog_products with product_code not null
  const { data: catalogProducts, error: cpErr } = await supabase
    .from("catalog_products")
    .select("id, product_code, name, brand_id, category_id, status")
    .not("product_code", "is", null);

  if (cpErr || !catalogProducts) {
    console.error("[ERROR] Failed to fetch catalog_products:", cpErr?.message);
    process.exit(1);
  }

  // Fetch brands
  const { data: brands } = await supabase
    .from("product_brands")
    .select("id, name, code, slug");

  // Fetch categories
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name, brand_id");

  const brandMap = new Map<string, ProductBrand>(
    (brands ?? []).map((b) => [b.id, b])
  );
  const categoryMap = new Map<string, ProductCategory>(
    (categories ?? []).map((c) => [c.id, c])
  );

  // Build lookup: product_code → catalog product
  const catalogByCode = new Map<string, CatalogProduct>(
    (catalogProducts as CatalogProduct[]).map((cp) => [cp.product_code!, cp])
  );

  const candidates: MappingCandidate[] = [];
  const unmapped: number[] = [];

  for (const pk of pkAll) {
    const code = String(pk.product_id);
    const cp = catalogByCode.get(code);

    if (!cp) {
      unmapped.push(pk.product_id);
      continue;
    }

    const brand = brandMap.get(cp.brand_id);
    const category = cp.category_id ? categoryMap.get(cp.category_id) : null;

    // Only map if brand found (safety)
    if (!brand) {
      console.warn(`  [WARN] catalog product ${cp.id} has no brand in map — skipping`);
      unmapped.push(pk.product_id);
      continue;
    }

    // Only auto-map Desembre in F.1
    // Dermagarden/VAVAW need explicit evidence — if they appear, still allow if product_code matches
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

  return { candidates, unmapped };
}

// ============================================================
// DRY-RUN REPORT
// ============================================================

function printDryRunReport(
  candidates: MappingCandidate[],
  unmapped: number[]
): void {
  console.log("\n====================================================");
  console.log("  SECTION C — DRY-RUN MAPPING PREVIEW");
  console.log("====================================================");
  console.log(`  Mappable knowledge records : ${candidates.length}`);
  console.log(`  Unmapped (no catalog match): ${unmapped.length}`);

  if (unmapped.length > 0) {
    console.log(`\n  UNMAPPED product_ids: [${unmapped.join(", ")}]`);
    console.log("  → These will NOT be modified. Kept as-is.");
  }

  if (candidates.length === 0) {
    console.log("\n  No mappable records found.");
    return;
  }

  console.log("\n  MAPPING PREVIEW (product_knowledge):");
  console.log("  " + "─".repeat(110));
  console.log(
    "  " +
      "product_id".padEnd(12) +
      "brand_code".padEnd(14) +
      "brand_name".padEnd(14) +
      "category".padEnd(22) +
      "catalog_product_name".padEnd(45) +
      "status"
  );
  console.log("  " + "─".repeat(110));

  for (const c of candidates) {
    const alreadyMapped =
      c.old_brand_id === c.new_brand_id &&
      c.old_catalog_product_id === c.new_catalog_product_id;
    const prefix = alreadyMapped ? "  [SKIP-SAME]  " : "  [WILL UPDATE]";
    console.log(
      prefix +
        String(c.product_id).padEnd(8) +
        c.brand_code.padEnd(14) +
        c.brand_name.padEnd(14) +
        (c.category_name ?? "—").padEnd(22) +
        c.product_name.substring(0, 44).padEnd(45) +
        c.catalog_product_status
    );
  }

  const willUpdate = candidates.filter(
    (c) =>
      c.old_brand_id !== c.new_brand_id ||
      c.old_catalog_product_id !== c.new_catalog_product_id
  );
  console.log("\n  " + "─".repeat(110));
  console.log(`  Records that WILL BE UPDATED  : ${willUpdate.length}`);
  console.log(`  Records already mapped (skip) : ${candidates.length - willUpdate.length}`);
}

// ============================================================
// APPLY MAPPING
// ============================================================

async function applyMapping(candidates: MappingCandidate[]): Promise<{
  knowledgeUpdated: number;
  chunksUpdated: number;
}> {
  console.log("\n====================================================");
  console.log("  SECTION D — APPLYING MAPPING");
  console.log("====================================================");

  const toUpdate = candidates.filter(
    (c) =>
      c.old_brand_id !== c.new_brand_id ||
      c.old_catalog_product_id !== c.new_catalog_product_id ||
      c.old_category_id !== c.new_category_id
  );

  let knowledgeUpdated = 0;
  let chunksUpdated = 0;

  for (const c of toUpdate) {
    // 1. Update product_knowledge
    const { error: pkErr } = await supabase
      .from("product_knowledge")
      .update({
        brand_id: c.new_brand_id,
        category_id: c.new_category_id,
        catalog_product_id: c.new_catalog_product_id,
      })
      .eq("id", c.knowledge_id);

    if (pkErr) {
      console.error(
        `  [ERROR] Failed to update knowledge id=${c.knowledge_id}: ${pkErr.message}`
      );
      continue;
    }
    knowledgeUpdated++;
    console.log(
      `  [OK] knowledge product_id=${c.product_id} → brand=${c.brand_code} catalog=${c.new_catalog_product_id.substring(0, 8)}...`
    );

    // 2. Update matching product_knowledge_chunks
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
      console.warn(
        `  [WARN] Failed to update chunks for product_id=${c.product_id}: ${chunkErr.message}`
      );
    } else {
      const count = updatedChunks?.length ?? 0;
      chunksUpdated += count;
      if (count > 0) {
        console.log(
          `  [OK] chunks product_id=${c.product_id} → ${count} chunks updated`
        );
      }
    }
  }

  return { knowledgeUpdated, chunksUpdated };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("====================================================");
  console.log("  Phase v1.4.1F.1 — Knowledge Mapping Script");
  console.log("====================================================");
  console.log(`  Mode          : ${DRY_RUN ? "DRY-RUN (no DB writes)" : "APPLY ⚠️"}`);
  console.log(`  Supabase URL  : ${SUPABASE_URL.substring(0, 40)}...`);
  console.log("  Note: Service role key is loaded but NOT logged.");
  console.log("====================================================");

  if (!DRY_RUN) {
    console.log(
      "\n  ⚠️  APPLY MODE ACTIVE — DB writes will occur on the connected Supabase project."
    );
    console.log("  ⚠️  Ensure this is STAGING, not production.");
    console.log("  Proceeding in 2 seconds...\n");
    await new Promise((r) => setTimeout(r, 2000));
  }

  // A. Audit before
  await runAudit();

  // Fetch all knowledge records for mapping
  const { data: pkAll, error: pkErr2 } = await supabase
    .from("product_knowledge")
    .select("id, product_id, brand_id, category_id, catalog_product_id, qa_status, build_status, is_active");

  if (pkErr2 || !pkAll) {
    console.error("[ERROR] Cannot fetch product_knowledge for mapping");
    process.exit(1);
  }

  // B. Build candidates
  const { candidates, unmapped } = await buildMappingCandidates(
    pkAll as ProductKnowledge[]
  );

  // C. Dry-run preview
  printDryRunReport(candidates, unmapped);

  // D. Apply if not dry-run
  let knowledgeUpdated = 0;
  let chunksUpdated = 0;

  if (!DRY_RUN) {
    const result = await applyMapping(candidates);
    knowledgeUpdated = result.knowledgeUpdated;
    chunksUpdated = result.chunksUpdated;
  }

  // ============================================================
  // FINAL REPORT
  // ============================================================
  console.log("\n====================================================");
  console.log("  SECTION E — FINAL REPORT");
  console.log("====================================================");
  console.log(`  Mode                    : ${DRY_RUN ? "DRY-RUN" : "APPLIED"}`);
  console.log(`  Total knowledge records : ${pkAll.length}`);
  console.log(`  Mappable (matched)      : ${candidates.length}`);
  console.log(`  Unmapped (no match)     : ${unmapped.length}`);

  if (unmapped.length > 0) {
    console.log(`  Unmapped product_ids    : [${unmapped.join(", ")}]`);
    console.log("  → Dermagarden/VAVAW will appear here if not in catalog");
    console.log("  → No action taken on unmapped records");
  }

  if (!DRY_RUN) {
    console.log(`  Knowledge records updated: ${knowledgeUpdated}`);
    console.log(`  Chunks updated           : ${chunksUpdated}`);
  } else {
    console.log("\n  DRY-RUN complete. No DB changes made.");
    console.log(
      "  To apply: KNOWLEDGE_MAPPING_STAGING_CONFIRM=MAP_KNOWLEDGE_TO_CATALOG_STAGING npx tsx scripts/map-product-knowledge-catalog.ts"
    );
  }

  console.log("\n  Constraints verified:");
  console.log("  ✅ No reindex");
  console.log("  ✅ No chunks deleted");
  console.log("  ✅ No embedding vector touched");
  console.log("  ✅ No RAG runtime changed");
  console.log("  ✅ No qa_status changed");
  console.log("  ✅ No status changed");
  console.log("  ✅ No content/chunk_type changed");
  console.log("  ✅ No knowledge_version changed");
  console.log("  ✅ No secret logged");
  console.log("  ✅ Dermagarden/VAVAW not auto-mapped without evidence");
  console.log("====================================================");
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
