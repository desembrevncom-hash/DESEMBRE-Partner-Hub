import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { resolve } from "path";
import { PRODUCTS, CATEGORIES } from "../src/data/products";

// Manual dotenv parser
const env: Record<string, string> = {};
try {
  const envPath = resolve(process.cwd(), ".env");
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

const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
// Use anon/publishable key for dry-run select queries, service role key for apply mode
const supabaseAnonKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

const targetMode = env.TARGET_ENV || process.env.TARGET_ENV;
if (!targetMode) {
  console.error("❌ ERROR: TARGET_ENV is required. Set it to 'local', 'staging', or 'production'.");
  process.exit(1);
}

const confirmPhrase = env.CATALOG_SEED_CONFIRM || process.env.CATALOG_SEED_CONFIRM;
const isApplyMode = targetMode && confirmPhrase === "SEED_DESEMBRE_CATALOG_STAGING";

async function run() {
  console.log("=== CATALOG DATA MIGRATION ENGINE ===");
  console.log("Supabase URL:", supabaseUrl);
  console.log("Project ID:", process.env.VITE_SUPABASE_PROJECT_ID || "Unknown");

  console.log("Target Mode (TARGET_ENV):", targetMode);
  console.log("Confirm Phrase (CATALOG_SEED_CONFIRM):", confirmPhrase || "None");
  console.log(
    "Execution Mode:",
    isApplyMode ? "APPLY (Writes to DB)" : "ANALYZE/DRY-RUN (Read-only)",
  );

  if (isApplyMode) {
    if (targetMode === "production") {
      const confirmProd = env.CONFIRM_PROD_DANGEROUS_ACTION || process.env.CONFIRM_PROD_DANGEROUS_ACTION;
      if (confirmProd !== "YES") {
        console.error("❌ ERROR: TARGET_ENV is 'production'. You must set CONFIRM_PROD_DANGEROUS_ACTION='YES' to run this script.");
        process.exit(1);
      }
      console.warn("⚠️ WARNING: Running against PRODUCTION database!");
    } else if (targetMode !== "local" && targetMode !== "staging") {
      console.error(
        "❌ ERROR: Only 'local', 'staging', or 'production' targets are permitted.",
      );
      process.exit(1);
    }

    if (!supabaseServiceKey) {
      console.error(
        "❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is required for Apply mode writes.",
      );
      process.exit(1);
    }
    console.log("⚠️ WARNING: Writing changes to target:", targetMode);
  }

  // Initialize Supabase Client
  const clientKey = isApplyMode ? supabaseServiceKey : supabaseAnonKey;
  if (!supabaseUrl || !clientKey) {
    console.error("❌ ERROR: Missing Supabase URL or credentials.");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, clientKey, {
    auth: { persistSession: false },
  });

  // A. Fetch existing overrides from database (public select is allowed)
  console.log("\n--- Fetching database overrides ---");
  const { data: overrides, error: overridesError } = await supabase
    .from("product_overrides")
    .select("*");

  if (overridesError) {
    console.warn(
      "⚠️ Warning: Could not fetch product_overrides (or table does not exist yet). Proceeding with empty overrides.",
      overridesError.message,
    );
  }
  const overrideMap = new Map();
  if (overrides) {
    overrides.forEach((o) => overrideMap.set(o.no, o));
  }

  // B. Data Source Audit
  console.log("\n--- Data Source Audit ---");
  console.log("Static PRODUCTS count:", PRODUCTS.length);
  console.log("Static CATEGORIES count:", CATEGORIES.length);

  let hasRetail = 0;
  let hasSalon = 0;
  let both = 0;
  let neither = 0;
  let missingRetail = 0;
  let missingSalon = 0;
  let negativePrices = 0;
  let emptySizeLabels = 0;

  const productIds = new Set();
  const productCodes = new Set();
  const skus = new Set();
  const duplicateProductCodes = [];
  const duplicateSKUs = [];

  PRODUCTS.forEach((p) => {
    if (productIds.has(p.id)) {
      duplicateProductCodes.push(p.id);
    }
    productIds.add(p.id);

    const hasR = p.variants.some((v) => v.type === "retail");
    const hasS = p.variants.some((v) => v.type === "salon");

    if (hasR && hasS) {
      both++;
    } else if (hasR) {
      hasRetail++;
      missingSalon++;
    } else if (hasS) {
      hasSalon++;
      missingRetail++;
    } else {
      neither++;
      missingRetail++;
      missingSalon++;
    }

    p.variants.forEach((v) => {
      const override = overrideMap.get(p.id);
      let price = v.price;
      let size = v.size;

      if (override) {
        if (v.type === "retail") {
          price =
            override.retail_price !== undefined && override.retail_price !== null
              ? override.retail_price
              : price;
          size = override.retail_size || size;
        } else {
          price =
            override.salon_price !== undefined && override.salon_price !== null
              ? override.salon_price
              : price;
          size = override.salon_size || size;
        }
      }

      if (price < 0 || price === null || price === undefined) {
        negativePrices++;
      }
      if (!size || size.trim() === "") {
        emptySizeLabels++;
      }

      const generatedSku = `DESEMBRE-${p.id}-${v.type.toUpperCase()}`;
      if (skus.has(generatedSku)) {
        duplicateSKUs.push(generatedSku);
      }
      skus.add(generatedSku);
    });
  });

  const overridesCount = overrides ? overrides.length : 0;
  const overridesWithImage = overrides
    ? overrides.filter((o) => o.image_url && o.image_url.trim() !== "").length
    : 0;
  const overridesWithLink = overrides
    ? overrides.filter((o) => o.link_url && o.link_url.trim() !== "").length
    : 0;

  console.log("- Products with Retail (only):", hasRetail);
  console.log("- Products with Salon (only):", hasSalon);
  console.log("- Products with both Retail/Salon:", both);
  console.log("- Products missing Retail variant:", missingRetail);
  console.log("- Products missing Salon variant:", missingSalon);
  console.log("- product_overrides count:", overridesCount);
  console.log("- Overrides with image_url:", overridesWithImage);
  console.log("- Overrides with link_url/catalog_url:", overridesWithLink);
  console.log(
    "- Duplicate product id/no:",
    duplicateProductCodes.length > 0 ? duplicateProductCodes : "None",
  );
  console.log("- Duplicate generated sku:", duplicateSKUs.length > 0 ? duplicateSKUs : "None");
  console.log("- Price negative/null:", negativePrices);
  console.log("- Size_label empty:", emptySizeLabels);

  if (isApplyMode) {
    console.log("\n--- EXECUTING DATABASE WRITES (Apply Mode) ---");

    // 1. Get Desembre Brand
    console.log("Fetching Desembre brand ID...");
    const { data: brandData, error: brandError } = await supabase
      .from("product_brands")
      .select("id")
      .eq("slug", "desembre")
      .single();

    if (brandError || !brandData) {
      console.error(
        "❌ ERROR: Desembre brand not found. Please ensure the migration for product_brands is applied and seeded.",
      );
      process.exit(1);
    }
    const desembreBrandId = brandData.id;
    console.log("Desembre Brand ID:", desembreBrandId);

    // 2. Seed Categories
    console.log("Seeding categories...");
    const categoryMap = new Map();
    for (const cat of CATEGORIES) {
      const slug = cat.id.toLowerCase().trim().replace(/\s+/g, "-");
      const name = cat.nameVi || cat.name;

      const { data: categoryRow, error: catError } = await supabase
        .from("product_categories")
        .upsert(
          {
            brand_id: desembreBrandId,
            name: name,
            slug: slug,
            is_active: true,
          },
          { onConflict: "brand_id,slug" },
        )
        .select("id")
        .single();

      if (catError || !categoryRow) {
        console.error(`❌ ERROR: Seeding category ${cat.id} failed:`, catError?.message);
        process.exit(1);
      }
      categoryMap.set(cat.id, categoryRow.id);
    }
    console.log(`Seeded ${categoryMap.size} categories successfully.`);

    // 3. Seed Products and Variants
    console.log("Seeding products, variants and inventory stocks...");
    let productSuccess = 0;
    let variantSuccess = 0;
    let stockSuccess = 0;

    const productMappingReport = [];
    const variantMappingReport = [];

    for (const p of PRODUCTS) {
      const override = overrideMap.get(p.id);
      const categoryUuid = categoryMap.get(p.categoryId);

      const name = override?.name || p.name;
      const description = override?.desc || p.description;
      const image_url = override?.image_url || null;
      const catalog_url = override?.link_url || null;
      const isDeleted = p.isDeleted || override?.deleted || false;

      // Safe Upsert: Check if exists by brand_id + product_code
      const productCode = p.id.toString();
      let productId = "";

      const { data: existingProd } = await supabase
        .from("catalog_products")
        .select("id")
        .eq("brand_id", desembreBrandId)
        .eq("product_code", productCode)
        .maybeSingle();

      if (existingProd) {
        // Update
        const { data: updatedProd, error: updateError } = await supabase
          .from("catalog_products")
          .update({
            category_id: categoryUuid,
            name: name,
            description: description,
            image_url: image_url,
            catalog_url: catalog_url,
            status: isDeleted ? "archived" : "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingProd.id)
          .select("id")
          .single();

        if (updateError || !updatedProd) {
          console.error(`❌ ERROR: Updating product ${productCode} failed:`, updateError?.message);
          process.exit(1);
        }
        productId = updatedProd.id;
      } else {
        // Insert
        const { data: insertedProd, error: insertError } = await supabase
          .from("catalog_products")
          .insert({
            brand_id: desembreBrandId,
            category_id: categoryUuid,
            product_code: productCode,
            name: name,
            description: description,
            image_url: image_url,
            catalog_url: catalog_url,
            status: isDeleted ? "archived" : "active",
          })
          .select("id")
          .single();

        if (insertError || !insertedProd) {
          console.error(`❌ ERROR: Inserting product ${productCode} failed:`, insertError?.message);
          process.exit(1);
        }
        productId = insertedProd.id;
      }

      productSuccess++;
      productMappingReport.push({
        old_id: p.id,
        new_uuid: productId,
        name: name,
      });

      // Seeding Variants for this product
      for (const v of p.variants) {
        let price = v.price;
        let size = v.size;

        if (override) {
          if (v.type === "retail") {
            price =
              override.retail_price !== undefined && override.retail_price !== null
                ? override.retail_price
                : price;
            size = override.retail_size || size;
          } else {
            price =
              override.salon_price !== undefined && override.salon_price !== null
                ? override.salon_price
                : price;
            size = override.salon_size || size;
          }
        }

        const sku = `DESEMBRE-${p.id}-${v.type.toUpperCase()}`;

        const { data: variantRow, error: varError } = await supabase
          .from("catalog_product_variants")
          .upsert(
            {
              product_id: productId,
              brand_id: desembreBrandId,
              sku: sku,
              channel: v.type,
              size_label: size,
              price: price,
              currency: "VND",
              inventory_tracking_enabled: false,
              stock_policy: "untracked",
              is_active: true,
            },
            { onConflict: "brand_id,sku" },
          )
          .select("id")
          .single();

        if (varError || !variantRow) {
          console.error(`❌ ERROR: Upserting variant ${sku} failed:`, varError?.message);
          process.exit(1);
        }

        variantSuccess++;
        variantMappingReport.push({
          old_id: p.id,
          channel: v.type,
          variant_uuid: variantRow.id,
          sku: sku,
        });

        // Seed inventory stocks
        const { error: stockError } = await supabase.from("inventory_stocks").upsert(
          {
            variant_id: variantRow.id,
            sku: sku,
            stock_on_hand: 0,
            stock_reserved: 0,
            status: "untracked",
          },
          { onConflict: "variant_id" },
        );

        if (stockError) {
          console.error(
            `❌ ERROR: Upserting inventory stock for variant ${sku} failed:`,
            stockError.message,
          );
          process.exit(1);
        }
        stockSuccess++;
      }
    }

    console.log(`\n=== Migration Successful! ===`);
    console.log(`Seeded Products: ${productSuccess}`);
    console.log(`Seeded Variants: ${variantSuccess}`);
    console.log(`Seeded Inventory Stocks: ${stockSuccess}`);

    console.log("\nMapping Report (Sample 5 Products):");
    console.table(productMappingReport.slice(0, 5));

    console.log("\nVariant Mapping Report (Sample 5 Variants):");
    console.table(variantMappingReport.slice(0, 5));

    // Post-migration validation checks
    console.log("\n--- Post-migration verification ---");
    const { count: prodCount } = await supabase
      .from("catalog_products")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", desembreBrandId);
    console.log("Desembre products count in DB:", prodCount);

    const { count: catCount } = await supabase
      .from("product_categories")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", desembreBrandId);
    console.log("Categories count in DB:", catCount);

    const { count: retailCount } = await supabase
      .from("catalog_product_variants")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", desembreBrandId)
      .eq("channel", "retail");
    console.log("Retail variants in DB:", retailCount);

    const { count: salonCount } = await supabase
      .from("catalog_product_variants")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", desembreBrandId)
      .eq("channel", "salon");
    console.log("Salon variants in DB:", salonCount);

    const { count: trackedCount } = await supabase
      .from("catalog_product_variants")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", desembreBrandId)
      .eq("inventory_tracking_enabled", true);
    console.log("Tracked variants in DB (should be 0):", trackedCount);

    console.log("✅ Seed execution completed.");
  } else {
    console.log("\nRun in ANALYZE/DRY-RUN mode only. No changes written to database.");
    console.log("To apply changes, set the following environment variables in .env:");
    console.log("CATALOG_SEED_TARGET=local");
    console.log("CATALOG_SEED_CONFIRM=SEED_DESEMBRE_CATALOG_STAGING");
    console.log("And make sure SUPABASE_SERVICE_ROLE_KEY is set in your .env file.");
  }
}

run().catch((e) => {
  console.error("❌ Fatal execution error:", e);
  process.exit(1);
});
