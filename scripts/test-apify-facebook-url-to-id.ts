import fs from "fs";

async function main() {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    console.error("APIFY_TOKEN is missing from env.");
    process.exit(1);
  }

  const endpoint = `https://api.apify.com/v2/acts/apify~facebook-url-to-id/run-sync-get-dataset-items?token=${token}&format=json&clean=true`;

  const payloads = {
    A: {
      fbUrls: [{ url: "https://www.facebook.com/nintendo" }]
    },
    B: {
      fbUrls: ["https://www.facebook.com/nintendo"]
    }
  };

  for (const [variant, payload] of Object.entries(payloads)) {
    console.log(`\nTesting Variant ${variant}:`);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const text = await res.text();
      
      if (res.ok) {
        console.log(`✅ Variant ${variant} SUCCESS (HTTP ${res.status})`);
        console.log(`Sample output length: ${text.length}`);
      } else {
        console.log(`❌ Variant ${variant} FAILED (HTTP ${res.status})`);
        console.log(`Error: ${text}`);
      }
    } catch (err) {
      console.error(`Variant ${variant} ERROR:`, err);
    }
  }
}

main().catch(console.error);
