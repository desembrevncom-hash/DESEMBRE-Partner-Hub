import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

function parseEnv(filePath) {
  const config = {};
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let key = match[1];
        let value = match[2] || '';
        // Remove quotes if present
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        if (value.length > 0 && value.charAt(0) === "'" && value.charAt(value.length - 1) === "'") {
          value = value.substring(1, value.length - 1);
        }
        config[key] = value.trim();
      }
    });
  }
  return config;
}

const envConfig = parseEnv('.env');
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log('Inspecting functions on Staging database...');
  
  const query = `
    SELECT routine_name, routine_definition 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name IN ('is_admin_or_sub_admin', 'is_sales_member', 'is_sales_member_v2');
  `;
  
  // Wait, we don't have exec_sql RPC on staging according to the summary!
  // Let's check if we can query it or if we can use a direct table select or if there's any other way.
  // Wait, is there a custom RPC in the DB we can use? Let's check.
  // Let's run a select on user_roles and profiles using different users to see if RLS blocks them.
  console.log('To check if RLS blocks, we will fetch catalog_products with a simulated authenticated user or check if there is an error.');
  
  // Let's query catalog_products directly.
  const { data, error } = await supabase.from('catalog_products').select('id');
  console.log('Query catalog_products using service role:', { count: data?.length, error });
  
  // Let's clean up the script or run what we can.
}

run();
