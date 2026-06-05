import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function check() {
  const { data: brands } = await supabase.from("product_brands").select("id, name");
  console.log("Brands:", brands);
  const desembreBrand = brands?.find(b => b.name.toLowerCase().includes("desembre"))?.id;
  console.log("Desembre UUID:", desembreBrand);
}
check();
