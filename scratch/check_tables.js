const { createClient } = require("@supabase/supabase-client");
require("dotenv").config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  console.log("Checking tables...");

  const { data: convs, error: e1 } = await supabase.from("ai_conversations").select("*").limit(1);
  if (e1) {
    console.error("ai_conversations error:", e1.message);
  } else {
    console.log("ai_conversations exists! Row sample:", convs);
  }

  const { data: logs, error: e2 } = await supabase
    .from("ai_conversation_logs")
    .select("*")
    .limit(1);
  if (e2) {
    console.error("ai_conversation_logs error:", e2.message);
  } else {
    console.log("ai_conversation_logs exists! Row sample:", logs);
  }

  const { data: feedback, error: e3 } = await supabase.from("ai_feedback").select("*").limit(1);
  if (e3) {
    console.error("ai_feedback error:", e3.message);
  } else {
    console.log("ai_feedback exists! Row sample:", feedback);
  }
}

check();
