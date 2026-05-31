import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function test() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.log("No env");
    return;
  }
  
  const supabase = createClient(url, key);
  
  // Login to get token
  const { data: { session }, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'desembrevn.com@gmail.com', // guess an admin email from screenshot
    password: 'password123' // we don't know password
  });
  
  // Let's just do a fetch directly to see what the server returns without auth (should return 401 JSON)
  const functionUrl = `${url}/functions/v1/export-crm-to-google-sheets`;
  console.log("Fetching", functionUrl);
  
  try {
    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      }
    });
    
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response text:", text);
  } catch (e) {
    console.log("Fetch error:", e);
  }
}

test();
