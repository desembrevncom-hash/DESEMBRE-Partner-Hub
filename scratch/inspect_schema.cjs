const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  console.log("Inspecting database schema...");
  
  // Check tables/views in information_schema
  const { data: tables, error: e1 } = await supabase.rpc('get_stale_chunks'); // just to test connection
  
  // Let's run a generic query on information_schema.columns for our tables
  // Wait, we don't have direct SQL execution RPC unless defined, but we can query them via standard selects if RLS permits, or query pg_catalog views.
  // Let's check if we can query columns of ai_conversations
  const { data: columns1, error: ce1 } = await supabase
    .from('ai_conversations')
    .select('*')
    .limit(0);
  console.log("ai_conversations columns check:", ce1 ? ce1.message : "Success (queried)");

  const { data: columns2, error: ce2 } = await supabase
    .from('ai_conversation_logs')
    .select('*')
    .limit(0);
  console.log("ai_conversation_logs columns check:", ce2 ? ce2.message : "Success (queried)");

  const { data: columns3, error: ce3 } = await supabase
    .from('ai_feedback')
    .select('*')
    .limit(0);
  console.log("ai_feedback columns check:", ce3 ? ce3.message : "Success (queried)");
}

inspect();
