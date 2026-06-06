import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wmhfvggbthyikqvlyqup.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtaGZ2Z2didGh5aWtxdmx5cXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYzMjg5NCwiZXhwIjoyMDk2MjA4ODk0fQ.3Wwb6DB767BDbZlqAjPxlZUlPhtdCKfqRv7uBEFQyK0";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data: cols, error: e1 } = await supabase.rpc('get_ai_settings_masked');
  console.log("get_ai_settings_masked:", Object.keys(cols || {}), e1);
  
  const { data: doc, error: e2 } = await supabase.from('document_templates').select('id').limit(1);
  console.log("document_templates count:", doc?.length, e2);

  const { data: sys, error: e3 } = await supabase.from('system_settings').select('routing_city_km, routing_near_km, routing_far_km').limit(1);
  console.log("system_settings routing cols:", sys, e3);
}

check();
