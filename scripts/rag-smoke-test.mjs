import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// Load from .env
const env = fs.readFileSync(".env", "utf8").split("\n").reduce((acc, line) => {
  const [key, ...val] = line.split("=");
  if (key && val.length) acc[key.trim()] = val.join("=").trim();
  return acc;
}, {});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery(query) {
  console.log(`\nQ: ${query}`);
  const { data, error } = await supabase.functions.invoke("ai-sales-assistant", {
    body: {
      messages: [{ role: "user", content: query }],
      userId: "test-user"
    }
  });

  if (error) {
    console.error(`Error:`, error.message);
  } else {
    // If stream, we have to handle it.
    // ai-sales-assistant uses stream if not told otherwise?
    // Wait, ai-sales-assistant returns text or stream? Let's assume it returns text if we don't ask for stream,
    // or maybe it's always returning a string?
    if (data?.error) {
      console.log(`Error Response:`, data.error);
    } else {
      console.log(`A:`, data);
    }
  }
}

async function run() {
  console.log("=== E. RAG Smoke Test thật ===");
  const questions = [
    "Desembre Milk Essential dùng cho da gì?",
    "Desembre Water Cleanser có tác dụng gì?",
    "Dermagarden có sản phẩm nào cho da khô?",
    "VAVAW có màu son nào hợp da ngăm?",
    "Dermagarden Milk Essential có gì?",
    "Sản phẩm XYZ không tồn tại dùng thế nào?"
  ];

  for (const q of questions) {
    await testQuery(q);
  }
}

run().catch(console.error);
