const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://xhfqjupiidexvlltstal.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoZnFqdXBpaWRleHZsbHRzdGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NDMzMDAsImV4cCI6MjA5NDExOTMwMH0.UckKHrotYJwbFYpwbIfLWnCysoH3sFEAzX1O--SLR5o";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSenders() {
  // Sign in as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'desembrevn.com@gmail.com',
    password: '12345678'
  });

  if (authError) {
    console.error("Auth error:", authError);
    return;
  }

  console.log(`Signed in successfully as ${authData.user.email}`);

  const { data, error } = await supabase
    .from("sender_accounts")
    .select("id, name, provider, channel, is_active, status, health_status, last_error, provider_secret");

  if (error) {
    console.error("Error fetching senders:", error);
    return;
  }

  console.log("Sender Accounts:");
  data.forEach(s => {
    console.log(`- Name: ${s.name}`);
    console.log(`  ID: ${s.id}`);
    console.log(`  Provider: ${s.provider}`);
    console.log(`  Channel: ${s.channel}`);
    console.log(`  Active: ${s.is_active}`);
    console.log(`  Status: ${s.status}`);
    console.log(`  Health: ${s.health_status}`);
    console.log(`  Last Error: ${s.last_error}`);
    console.log(`  Secret Length: ${s.provider_secret ? s.provider_secret.length : 0}`);
    if (s.provider_secret) {
      console.log(`  Secret Preview: ${s.provider_secret.substring(0, 50)}...`);
    }
    console.log("");
  });
}

checkSenders();
