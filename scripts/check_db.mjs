import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wmhfvggbthyikqvlyqup.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtaGZ2Z2didGh5aWtxdmx5cXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYzMjg5NCwiZXhwIjoyMDk2MjA4ODk0fQ.3Wwb6DB767BDbZlqAjPxlZUlPhtdCKfqRv7uBEFQyK0";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabase.from('system_ai_provider_settings').select('*');
  console.log("system_ai_provider_settings:", data, error);
}

check();
