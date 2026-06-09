import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("=== F.5 PRODUCTION RAG AUDIT ===");

  // 1. Data Counts
  const pk = await supabase.from("product_knowledge").select("*", { count: "exact" });
  console.log("total product_knowledge:", pk.count);

  const pkc = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true });
  console.log("total product_knowledge_chunks:", pkc.count);

  const approvedPk = await supabase
    .from("product_knowledge")
    .select("id, product_id, brand_id", { count: "exact" })
    .eq("qa_status", "approved");
  console.log("approved knowledge count:", approvedPk.count);

  // Unmapped knowledge (brand_id is null)
  const unmappedPk = await supabase
    .from("product_knowledge")
    .select("id, product_id, product_name")
    .is("brand_id", null);
  console.log("unmapped knowledge count:", unmappedPk.data?.length);

  // Chunks missing mapping
  const chunksNoBrand = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .is("brand_id", null);
  console.log("chunks missing brand_id:", chunksNoBrand.count);

  const chunksNoCat = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .is("category_id", null);
  console.log("chunks missing category_id:", chunksNoCat.count);

  const chunksNoCatalog = await supabase
    .from("product_knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .is("catalog_product_id", null);
  console.log("chunks missing catalog_product_id:", chunksNoCatalog.count);

  // 2. OpenAI Estimate (Dry Run)
  let totalTokensEstimate = 0;
  let chunksToCreateEstimate = 0;

  if (approvedPk.data) {
    for (const item of approvedPk.data) {
      chunksToCreateEstimate += 5;
      totalTokensEstimate += 1500;
    }
  }

  console.log("\n=== OPENAI ESTIMATE ===");
  console.log("Estimated chunks to create:", chunksToCreateEstimate);
  console.log("Estimated total tokens:", totalTokensEstimate);
  console.log("Model: text-embedding-3-small");
  console.log("Estimated cost: < $0.01");
}

runAudit().catch(console.error);
