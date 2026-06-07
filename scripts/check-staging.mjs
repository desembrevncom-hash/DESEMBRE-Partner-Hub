import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const STAGING_PROJECT_REF = 'wmhfvggbthyikqvlyqup';

function log(msg) {
  console.log(`[smoke] ${msg}`);
}

function logError(msg) {
  console.error(`[smoke] ❌ ERROR: ${msg}`);
}

async function run() {
  log("Starting staging smoke test...");

  // 1. Read environment variables
  let env = {};
  if (fs.existsSync('.env')) {
    const envText = fs.readFileSync('.env', 'utf8');
    envText.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        env[parts[0].trim()] = parts.slice(1).join('=').replace(/\"/g, '').replace(/\'/g, '').trim();
      }
    });
  }

  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const adminTestJwt = env.ADMIN_TEST_JWT || '';

  // 2. Validate URL target
  log(`Supabase URL: ${supabaseUrl}`);
  if (!supabaseUrl.includes(STAGING_PROJECT_REF)) {
    logError(`Supabase URL must point to Staging ref (${STAGING_PROJECT_REF})`);
    process.exit(1);
  }

  if (!serviceRoleKey) {
    logError("SUPABASE_SERVICE_ROLE_KEY missing from env!");
    process.exit(1);
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  // 3. Check target tables
  const tablesToCheck = [
    'product_sales_sheets',
    'document_templates',
    'system_ai_provider_settings',
    'catalog_products',
    'product_knowledge'
  ];

  log("Checking database tables existence...");
  let allTablesExist = true;
  for (const table of tablesToCheck) {
    const { error } = await sb.from(table).select('*').limit(1);
    if (error && error.code === 'PGRST116') {
      // PGRST116 is single row expected but 0 returned. That's fine, the table exists.
      log(`✅ Table '${table}' exists (empty).`);
    } else if (error) {
      if (error.message.includes("Could not find the table") || error.code === '42P01') {
        logError(`Table '${table}' does not exist! Error: ${error.message}`);
        allTablesExist = false;
      } else {
        // Table exists, but returned some other error (like RLS or policy warning, but service role usually bypasses RLS)
        log(`✅ Table '${table}' exists. Status detail: ${error.message}`);
      }
    } else {
      log(`✅ Table '${table}' exists.`);
    }
  }

  if (!allTablesExist) {
    logError("One or more tables are missing! Please apply migrations.");
    process.exit(1);
  }

  // 4. Check Edge Function if ADMIN_TEST_JWT is available
  if (adminTestJwt) {
    log("ADMIN_TEST_JWT found. Testing Edge Function invocation...");
    try {
      const clientSb = createClient(supabaseUrl, env.VITE_SUPABASE_ANON_KEY || '', {
        auth: { persistSession: false }
      });
      const { data, error } = await clientSb.functions.invoke('generate-product-sales-sheet', {
        headers: {
          Authorization: `Bearer ${adminTestJwt}`
        },
        body: { catalogProductId: 'test-smoke-test' }
      });

      if (error) {
        logError(`Edge Function returned error: ${JSON.stringify(error)}`);
        process.exit(1);
      } else {
        log("✅ Edge Function invocation succeeded!");
        log(`Response: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      logError(`Failed to invoke Edge Function: ${err.message}`);
      process.exit(1);
    }
  } else {
    log("ℹ️ ADMIN_TEST_JWT is empty. Skipping Edge Function invocation check.");
  }

  log("✅ Staging smoke test completed successfully.");
}

run();
