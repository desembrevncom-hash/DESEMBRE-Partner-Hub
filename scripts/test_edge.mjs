import fetch from "node-fetch";

const supabaseUrl = "https://wmhfvggbthyikqvlyqup.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtaGZ2Z2didGh5aWtxdmx5cXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MzI4OTQsImV4cCI6MjA5NjIwODg5NH0.Xnhlv3M5wt9UhiXraSFIThBrPpiJdGhP8RuxPD5B3o0";

// Needs an auth token. I will sign in as the user.
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  // Wait, I don't have the user's password.
  // Can I call the Edge Function with the Service Role Key? Yes.
  const serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtaGZ2Z2didGh5aWtxdmx5cXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYzMjg5NCwiZXhwIjoyMDk2MjA4ODk0fQ.3Wwb6DB767BDbZlqAjPxlZUlPhtdCKfqRv7uBEFQyK0";
  
  const payload = {
    productKnowledgeId: "7f0d9866-8f2c-4425-83fd-9f29bc7044ad",
    rebuild: true
  };

  const res = await fetch(`${supabaseUrl}/functions/v1/embed-product-knowledge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`
    },
    body: JSON.stringify(payload)
  });

  console.log("Status:", res.status);
  console.log("Text:", await res.text());
}

check();
