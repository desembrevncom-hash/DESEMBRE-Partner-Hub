import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { resolve } from "path";

// 1. Manual dotenv parser
const env: Record<string, string> = {};
try {
  // try .env.staging first
  let envPath = resolve(process.cwd(), ".env.staging");
  if (!fs.existsSync(envPath)) {
    envPath = resolve(process.cwd(), ".env");
  }
  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, "utf8");
    envText.split("\n").forEach((line) => {
      const parts = line.split("=");
      if (parts.length >= 2) {
        const k = parts[0].trim();
        const v = parts.slice(1).join("=").replace(/"/g, "").trim();
        if (k && v) env[k] = v;
      }
    });
  }
} catch (e) {
  console.warn("⚠️ Warning: Could not manually load .env file", e);
}

const targetEnv = env.TARGET_ENV || process.env.TARGET_ENV;
const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const confirmPhrase = env.STAGING_DEMO_SEED_CONFIRM || process.env.STAGING_DEMO_SEED_CONFIRM;

async function run() {
  console.log("=== STAGING DEMO DATA RESTORE ENGINE ===");

  if (targetEnv !== "staging") {
    console.error("❌ ERROR: TARGET_ENV must be 'staging'. Current:", targetEnv);
    process.exit(1);
  }

  if (supabaseUrl === "https://xhfqjupiidexvlltstal.supabase.co" || supabaseUrl?.includes("xhfqjupiidexvlltstal")) {
    console.error("❌ FATAL: Production URL detected. Aborting.");
    process.exit(1);
  }

  if (confirmPhrase !== "SEED_STAGING_DEMO_DATA") {
    console.error("❌ ERROR: You must set STAGING_DEMO_SEED_CONFIRM='SEED_STAGING_DEMO_DATA'");
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ ERROR: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  // Create Admin Client
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  console.log("Connecting to Staging Supabase...");

  // --- 1. SEED USERS / STAFF ---
  console.log("\n--- Seeding Users/Staff ---");
  const testUsers = [
    { email: "admin.test@desembre.local", name: "Admin Test", role: "admin", password: "Staging@123456" },
    { email: "subadmin.test@desembre.local", name: "Sub Admin Test", role: "sub_admin", password: "Staging@123456" },
    { email: "sales01.test@desembre.local", name: "Sales 01 Test", role: "sale", password: "Staging@123456" },
    { email: "sales02.test@desembre.local", name: "Sales 02 Test", role: "sale", password: "Staging@123456" },
    { email: "telesales01.test@desembre.local", name: "Telesales 01 Test", role: "telesale", password: "Staging@123456" }
  ];

  const userIds: Record<string, string> = {};

  for (const tu of testUsers) {
    let uid = "";
    
    // Check if user exists via admin API
    const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      console.error("❌ Error listing auth users:", listError.message);
      process.exit(1);
    }
    
    const existing = listData?.users.find(u => u.email === tu.email);
    if (existing) {
      uid = existing.id;
      console.log(`[Users] ${tu.email} already exists (${uid})`);
    } else {
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email: tu.email,
        password: tu.password,
        email_confirm: true,
        user_metadata: {
          display_name: tu.name
        }
      });
      if (createError || !created?.user) {
        console.error(`❌ Error creating user ${tu.email}:`, createError?.message);
        process.exit(1);
      }
      uid = created.user.id;
      console.log(`[Users] Created ${tu.email} (${uid})`);
    }
    userIds[tu.email] = uid;

    // Upsert Profile
    await adminClient.from("profiles").upsert({
      id: uid,
      email: tu.email,
      display_name: tu.name,
      avatar_url: null,
      updated_at: new Date().toISOString()
    });

    // Upsert Role
    await adminClient.from("user_roles").upsert({
      user_id: uid,
      role: tu.role
    });
  }

  const sales01Id = userIds["sales01.test@desembre.local"];
  const sales02Id = userIds["sales02.test@desembre.local"];

  // --- 2. SEED CUSTOMERS ---
  console.log("\n--- Seeding Customers ---");
  const customersToSeed = 10;
  let customersSeeded = 0;
  const customerIds: string[] = [];

  for (let i = 1; i <= customersToSeed; i++) {
    const ownerId = (i % 2 === 0) ? sales01Id : sales02Id;
    const phone = `09000000${i.toString().padStart(2, "0")}`;
    const email = `customer${i.toString().padStart(2, "0")}@mock.desembre.local`;
    
    const { data: existingCust } = await adminClient.from("customers").select("id").eq("phone", phone).maybeSingle();
    let custId = "";

    if (existingCust) {
      custId = existingCust.id;
    } else {
      const { data: newCust, error: errCust } = await adminClient.from("customers").insert({
        name: `Mock Customer ${i}`,
        phone: phone,
        email: email,
        address: `123 Mock Street ${i}`,
        user_id: ownerId
      }).select("id").single();
      
      if (!errCust && newCust) {
        custId = newCust.id;
        customersSeeded++;
      } else if (errCust) {
        console.warn(`[Customers] Warning: skip customer ${i}: ${errCust.message}`);
      }
    }
    if (custId) customerIds.push(custId);
  }
  console.log(`[Customers] Seeded ${customersSeeded} new customers.`);

  // --- 3. SEED CATALOG & ORDERS ---
  console.log("\n--- Seeding Orders ---");
  // Get some active products
  const { data: products } = await adminClient.from("catalog_products").select("id, name").eq("status", "active").limit(5);
  let ordersSeeded = 0;

  if (products && products.length > 0 && customerIds.length > 0) {
    for (let i = 0; i < 5; i++) {
      const custId = customerIds[i % customerIds.length];
      const ownerId = (i % 2 === 0) ? sales01Id : sales02Id;
      
      const { data: newOrder, error: errOrder } = await adminClient.from("orders").insert({
        customer_name: `Mock Customer ${i}`,
        customer_phone: `090000000${i}`,
        sale_user_id: ownerId,
        status: "confirmed",
        subtotal: 1500000,
        discount_rate: 0,
        vat_rate: 0.08,
        total: 1620000,
        note: "Mock Order"
      }).select("id").single();

      if (!errOrder && newOrder) {
        ordersSeeded++;
        // We won't insert complex order_items for this mock unless strictly needed, but let's insert 1 item
        const p = products[i % products.length];
        await adminClient.from("order_items").insert({
          order_id: newOrder.id,
          product_name: p.name,
          catalog_product_id: p.id,
          size_type: "retail",
          unit_price: 1500000,
          quantity: 1,
          line_total: 1500000,
          source: "db_catalog"
        });
      }
    }
  } else {
    console.log("No catalog products or customers found to create orders.");
  }
  console.log(`[Orders] Seeded ${ordersSeeded} orders.`);

  // --- 4. SEED INTERACTIONS / APPOINTMENTS ---
  console.log("\n--- Seeding Customer Interactions (Appointments/Tasks) ---");
  let interactionsSeeded = 0;
  
  // Check if customer_interactions table exists
  const { error: ciError } = await adminClient.from("customer_interactions").select("id").limit(1);
  if (!ciError) {
    for (let i = 0; i < 15; i++) {
      const isAppointment = i < 10;
      const custId = customerIds[i % customerIds.length];
      const ownerId = (i % 2 === 0) ? sales01Id : sales02Id;
      
      const date = new Date();
      date.setDate(date.getDate() + (i - 5)); // some past, some future
      
      await adminClient.from("customer_interactions").insert({
        customer_id: custId,
        owner_id: ownerId,
        interaction_type: isAppointment ? "appointment" : "call",
        notes: isAppointment ? "Mock Appointment" : "Mock Call Follow-up",
        status: date > new Date() ? "scheduled" : "completed",
        interaction_date: date.toISOString(),
        created_at: new Date().toISOString()
      });
      interactionsSeeded++;
    }
  } else {
    console.log("[Interactions] Skipping: customer_interactions table not found or error:", ciError.message);
  }
  console.log(`[Interactions] Seeded ${interactionsSeeded} interactions.`);

  // --- 5. SEED TEMPLATES ---
  console.log("\n--- Seeding Templates ---");
  const { error: tplError } = await adminClient.from("document_templates").select("id").limit(1);
  if (!tplError) {
    await adminClient.from("document_templates").upsert([
      {
        id: "11111111-1111-1111-1111-111111111111",
        template_type: "quotation",
        name: "Báo giá tiêu chuẩn (Mock)",
        status: "approved",
        html_template: "<h1>Báo giá</h1><p>Demo Báo giá</p>",
        created_by: userIds["admin.test@desembre.local"]
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        template_type: "product_sales_sheet",
        name: "Tài liệu sản phẩm (Mock)",
        status: "approved",
        html_template: "<h1>{{product.name}}</h1><p>{{product.short_description}}</p>",
        created_by: userIds["admin.test@desembre.local"]
      }
    ]);
    console.log("[Templates] Seeded templates.");
  } else {
    console.log("[Templates] Skipping: document_templates table error:", tplError.message);
  }

  // --- REPORT ---
  console.log("\n=== STAGING RESTORE SUMMARY ===");
  console.log(`Target: Staging (${supabaseUrl})`);
  console.log("Users/Staff verified:", Object.keys(userIds).length);
  console.log("Customers created/upserted:", customersSeeded);
  console.log("Orders created:", ordersSeeded);
  console.log("Interactions created:", interactionsSeeded);
  console.log("\n✅ Staging Demo Data Restore Completed Successfully.");
}

run().catch((e) => {
  console.error("❌ Fatal execution error:", e);
  process.exit(1);
});
