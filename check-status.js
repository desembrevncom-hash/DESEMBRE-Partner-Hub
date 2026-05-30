const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if(parts.length >= 2) {
    const k = parts[0].trim();
    const v = parts.slice(1).join('=').replace(/"/g, '').trim();
    if(k && v) env[k] = v;
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const { data, error } = await supabase.from('customers').select('status, lifecycle_stage, ownership_status').limit(10);
  console.log(data);
}
run();
