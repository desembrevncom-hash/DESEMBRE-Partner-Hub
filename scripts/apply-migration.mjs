import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').replace(/\"/g, '').replace(/\'/g, '').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing URL or SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function run() {
  const migrationPath = 'supabase/migrations/20260811000000_product_sales_sheets.sql';
  console.log(`Reading migration file: ${migrationPath}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log("Applying migration via exec_sql RPC...");
  const { data, error } = await sb.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error("Error applying migration:", error);
    process.exit(1);
  } else {
    console.log("Migration applied successfully! Result:", data);
  }
}
run();
