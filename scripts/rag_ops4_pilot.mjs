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

const questions = [
  // 1-5: Fact Retrieval (Milk Essential Cleanser)
  "Desembre Milk Essential Cleanser dùng cho loại da nào?",
  "Sữa rửa mặt Milk Essential của Desembre có bọt không?",
  "Thành phần chính của Milk Essential Cleanser là gì?",
  "Khách hàng vừa lăn kim xong có dùng được Milk Essential không?",
  "Cách sử dụng Milk Essential Cleanser như thế nào?",

  // 6-10: Fact Retrieval (Water Cleanser)
  "Desembre Water Cleanser có tác dụng gì?",
  "Water Cleanser của Desembre có dùng cho da mụn được không?",
  "Dùng Water Cleanser xong có cần rửa lại bằng nước không?",
  "Water Cleanser có tẩy được kem chống nắng không?",
  "Water Cleanser có làm cay mắt không?",

  // 11-13: Comparison & Problem Solving
  "Nên chọn Milk Essential hay Water Cleanser cho da khô nhạy cảm?",
  "Quy trình làm sạch dùng cả 2 loại Milk Essential và Water Cleanser thì dùng cái nào trước?",
  "Khách bị đổ dầu nhiều thì nên ưu tiên sản phẩm làm sạch nào của Desembre?",

  // 14-17: Negative Testing (Out-of-scope / Cross-Brand Hallucination Guard)
  "Dermagarden có sản phẩm tẩy trang nào không?",
  "VAVAW có son màu đỏ đất không?",
  "Sữa rửa mặt Dermagarden Milk Essential dùng tốt không?",
  "Tư vấn cho tôi loại kem chống nắng của hãng X-Men",

  // 18-20: Edge Cases & Ambiguity
  "Sản phẩm nào của Desembre giá dưới 500k?", // Not in knowledge base (Missing knowledge expected)
  "Có loại sữa rửa mặt nào trị mụn dứt điểm 100% không?", // Tricky claim (Missing or safe policy expected)
  "Cho tôi biết thông tin chung về thương hiệu Desembre." // Broad question
];

async function testQuery(query, index) {
  console.log(`\n--- Q${index + 1}: ${query} ---`);
  
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ai-sales-assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
        userId: "sales-tester-001"
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Error ${res.status}:`, errText);
      return { q: query, error: errText };
    }

    const data = await res.json();
    const text = data?.message || data; // depending on edge function return format
    console.log(`A:\n${JSON.stringify(text, null, 2)}`);
    return { q: query, a: text };
  } catch (err) {
    console.error("Fetch error:", err.message);
    return { q: query, error: err.message };
  }
}

async function run() {
  console.log("=== STARTING SALES PILOT TEST (20 QUESTIONS) ===");
  const results = [];
  for (let i = 0; i < questions.length; i++) {
    const res = await testQuery(questions[i], i);
    results.push(res);
  }
  
  fs.writeFileSync("ops4_pilot_results.json", JSON.stringify(results, null, 2));
  console.log("\n=== PILOT TEST COMPLETED. Results saved to ops4_pilot_results.json ===");
}

run().catch(console.error);
