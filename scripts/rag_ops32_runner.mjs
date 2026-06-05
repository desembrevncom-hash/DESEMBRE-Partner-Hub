import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load from .env
const env = fs.readFileSync(".env", "utf8").split("\n").reduce((acc, line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length) acc[key.trim()] = val.join("=").trim();
  return acc;
}, {});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseUrl.includes("wmhfvggbthyikqvlyqup")) {
  console.error("FATAL: Target is not Staging.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== A. Verify Target ===");
  const { count: prodCount } = await supabase.from('catalog_products').select('*', { count: 'exact', head: true });
  const { count: varCount } = await supabase.from('catalog_product_variants').select('*', { count: 'exact', head: true });
  const { count: invCount } = await supabase.from('inventory_stocks').select('*', { count: 'exact', head: true });
  console.log(`Products: ${prodCount}, Variants: ${varCount}, Stocks: ${invCount}`);

  console.log("=== B. Verify AI settings ===");
  const { data: settings } = await supabase.from('system_ai_provider_settings').select('*').eq('provider', 'openai').single();
  console.log("Configured:", !!settings?.encrypted_api_key, "Chat Model:", settings?.chat_model, "RAG Filter:", settings?.rag_use_rpc_brand_filter);

  console.log("=== C. Seed product_knowledge mẫu ===");
  // Find products in product_knowledge
  const { data: pk1 } = await supabase.from('product_knowledge').select('id, product_id').eq('product_id', 1).single();
  const { data: pk2 } = await supabase.from('product_knowledge').select('id, product_id').eq('product_id', 2).single();

  const { data: p1 } = await supabase.from('catalog_products').select('id, brand_id, category_id').ilike('name', '%MILK ESSENTIAL CLEANSER%').single();
  const { data: p2 } = await supabase.from('catalog_products').select('id, brand_id, category_id').ilike('name', '%WATER CLEANSER%').single();

  if (pk1 && p1) {
    await supabase.from('product_knowledge').update({
      catalog_product_id: p1.id,
      brand_id: p1.brand_id,
      category_id: p1.category_id,
      qa_status: 'approved',
      is_active: true,
      build_status: 'pending'
    }).eq('id', pk1.id);
  }

  if (pk2 && p2) {
    await supabase.from('product_knowledge').update({
      catalog_product_id: p2.id,
      brand_id: p2.brand_id,
      category_id: p2.category_id,
      qa_status: 'approved',
      is_active: true,
      build_status: 'pending'
    }).eq('id', pk2.id);
  }
  
  console.log("Seeded product_knowledge.");

  console.log("=== D. Real reindex ===");
  // Trigger embed-product-knowledge edge function for each seeded record
  if (pk1?.id) {
    console.log("Reindexing p1:", pk1.id);
    const res1 = await supabase.functions.invoke("embed-product-knowledge", {
      body: { productKnowledgeId: pk1.id, rebuild: true }
    });
    console.log("Result 1:", res1.data || res1.error?.message);
  }

  if (pk2?.id) {
    console.log("Reindexing p2:", pk2.id);
    const res2 = await supabase.functions.invoke("embed-product-knowledge", {
      body: { productKnowledgeId: pk2.id, rebuild: true }
    });
    console.log("Result 2:", res2.data || res2.error?.message);
  }

  const { count: chunkCount } = await supabase.from('product_knowledge_chunks').select('*', { count: 'exact', head: true });
  console.log("Chunks count:", chunkCount);
}

run().catch(console.error);
