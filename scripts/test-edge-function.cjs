const envPaths = [
  require('path').resolve(process.cwd(), '.env'),
  require('path').resolve(process.cwd(), '.env.local'),
  require('path').resolve(process.cwd(), '.env.vercel')
];

for (const envPath of envPaths) {
  try {
    const envContent = require('fs').readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  } catch (e) {
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);

async function testEdgeFunction() {
  const url = `${supabaseUrl}/functions/v1/resolve-facebook-uid`;
  // Using the duplicate job from the screenshot. Wait, I don't know its UUID. 
  // I will just fetch a job that is duplicate_candidate.
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  const { data: job } = await supabase.from('facebook_identity_resolution_jobs').select('id').limit(1).single();
  
  console.log("Found Job ID:", job.id);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ job_id: job.id })
  });

  const text = await response.text();
  console.log(`HTTP ${response.status}`);
  console.log("Response:", text);
}

testEdgeFunction().catch(console.error);
