const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const lines = env.split('\n');
const vars = {};
lines.forEach(l => {
  const match = l.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    vars[key] = value;
  }
});

const url = vars.VITE_SUPABASE_URL;
const key = vars.VITE_SUPABASE_ANON_KEY || vars.VITE_SUPABASE_PUBLISHABLE_KEY || vars.SUPABASE_PUBLISHABLE_KEY;

async function check() {
  try {
    const resRoles = await fetch(`${url}/rest/v1/user_roles?select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const roles = await resRoles.json();
    console.log("Roles:", JSON.stringify(roles, null, 2));

    const resProfiles = await fetch(`${url}/rest/v1/profiles?select=*`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const profiles = await resProfiles.json();
    console.log("Profiles:", JSON.stringify(profiles, null, 2));
  } catch (err) {
    console.error(err);
  }
}

check();
