const { createClient } = require('@supabase/supabase-client');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: roles, error } = await supabase
    .from('user_roles')
    .select('*, profiles(display_name)');
  
  if (error) {
    console.error(error);
  } else {
    console.log("Users and Roles:", JSON.stringify(roles, null, 2));
  }
}

check();
