import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const dummyEmbedding = new Array(1536).fill(0.1);
  const { data, error } = await supabase.rpc("match_product_chunks", {
    query_embedding: dummyEmbedding,
    match_threshold: 0.1,
    match_count: 1,
    filter_brand_ids: ["5e99bbca-06c8-41f1-9ac7-60c75b6364c7"],
  });
  console.log("Result with UUID array:", { data, error });
}
test();
