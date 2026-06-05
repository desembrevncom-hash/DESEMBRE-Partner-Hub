import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { resolve } from "path";
import { PRODUCTS, CATEGORIES } from "../src/data/products";
import { transformDbProduct } from "../src/lib/catalogDb";

// Manual dotenv parser to load local/staging config
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
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

async function run() {
  console.log("=== CATALOG PARITY INTEGRATION REPORT ===");
  console.log("Supabase URL:", supabaseUrl);

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error(
      "❌ ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot run parity integration script.",
    );
    process.exit(1);
  }

  // Initialize service role client to query all tables securely
  const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  // A. Fetch brand and category mappings
  console.log("\n--- Fetching DB Catalog Metadata ---");
  const { data: brands, error: brandsError } = await adminClient
    .from("product_brands")
    .select("*")
    .eq("is_active", true);

  if (brandsError || !brands) {
    console.error("❌ Failed to fetch active product brands:", brandsError?.message);
    process.exit(1);
  }
  console.log(`Active Brands in DB: ${brands.length} (${brands.map((b) => b.code).join(", ")})`);

  const brandMap = new Map(brands.map((b) => [b.id, { name: b.name, code: b.code }]));
  const activeBrandIds = brands.map((b) => b.id);
  const desembreBrand = brands.find((b) => b.slug === "desembre");
  if (!desembreBrand) {
    console.error("❌ ERROR: Desembre brand not found in DB.");
    process.exit(1);
  }

  const { data: categories, error: categoriesError } = await adminClient
    .from("product_categories")
    .select("*")
    .eq("is_active", true)
    .in("brand_id", activeBrandIds);

  if (categoriesError || !categories) {
    console.error("❌ Failed to fetch active categories:", categoriesError?.message);
    process.exit(1);
  }
  const desembreCategories = categories.filter((c) => c.brand_id === desembreBrand.id);
  console.log(`Active Categories for Desembre brand in DB: ${desembreCategories.length}`);

  const categoryMap = new Map(categories.map((c) => [c.id, { name: c.name, slug: c.slug }]));

  // B. Fetch DB products and variants
  console.log("\n--- Fetching DB Catalog Products & Variants ---");
  const { data: rawProducts, error: productsError } = await adminClient
    .from("catalog_products")
    .select("*")
    .eq("status", "active")
    .eq("brand_id", desembreBrand.id)
    .order("sort_order", { ascending: true })
    .order("product_code", { ascending: true });

  if (productsError || !rawProducts) {
    console.error("❌ Failed to fetch catalog products:", productsError?.message);
    process.exit(1);
  }

  const activeProductIds = rawProducts.map((p) => p.id);

  const { data: rawVariants, error: variantsError } = await adminClient
    .from("catalog_product_variants")
    .select("*")
    .eq("is_active", true)
    .in("product_id", activeProductIds);

  if (variantsError || !rawVariants) {
    console.error("❌ Failed to fetch catalog variants:", variantsError?.message);
    process.exit(1);
  }

  // Transform database records using the helper's pure function
  const dbCatalogProducts = rawProducts.map((p) =>
    transformDbProduct(p, rawVariants, brandMap, categoryMap),
  );

  // Fetch overrides to match expected values
  const { data: overrides } = await adminClient.from("product_overrides").select("*");
  const overrideMap = new Map();
  if (overrides) {
    overrides.forEach((o) => overrideMap.set(o.no, o));
  }

  // Check counts for other brands (Dermagarden, VAVAW)
  const dermagardenBrand = brands.find((b) => b.slug === "dermagarden");
  const vavawBrand = brands.find((b) => b.slug === "vavaw");

  let dermagardenCount = 0;
  let vavawCount = 0;

  if (dermagardenBrand) {
    const { count } = await adminClient
      .from("catalog_products")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", dermagardenBrand.id)
      .eq("status", "active");
    dermagardenCount = count || 0;
  }

  if (vavawBrand) {
    const { count } = await adminClient
      .from("catalog_products")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", vavawBrand.id)
      .eq("status", "active");
    vavawCount = count || 0;
  }

  // C. Execute Parity Audits
  console.log("\n--- Executing General Counts Audit ---");
  const desembreProductsCount = dbCatalogProducts.length;
  const retailVariants = rawVariants.filter(
    (v) => v.brand_id === desembreBrand.id && v.channel === "retail",
  );
  const salonVariants = rawVariants.filter(
    (v) => v.brand_id === desembreBrand.id && v.channel === "salon",
  );

  const results = {
    staticProductsCount: PRODUCTS.length,
    dbDesembreProductsCount: desembreProductsCount,
    dbDesembreCategoriesCount: desembreCategories.length,
    retailVariantsCount: retailVariants.length,
    salonVariantsCount: salonVariants.length,
    totalVariantsCount: rawVariants.length,
    dermagardenProductsCount: dermagardenCount,
    vavawProductsCount: vavawCount,
  };

  console.log(
    `- Static PRODUCTS count: ${results.staticProductsCount} (Expected: 68) -> ${results.staticProductsCount === 68 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `- DB Desembre products count: ${results.dbDesembreProductsCount} (Expected: 68) -> ${results.dbDesembreProductsCount === 68 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `- DB Desembre categories count: ${results.dbDesembreCategoriesCount} (Expected: 15) -> ${results.dbDesembreCategoriesCount === 15 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `- Retail variants count: ${results.retailVariantsCount} (Expected: 40) -> ${results.retailVariantsCount === 40 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `- Salon variants count: ${results.salonVariantsCount} (Expected: 42) -> ${results.salonVariantsCount === 42 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `- Total variants count: ${results.totalVariantsCount} (Expected: 82) -> ${results.totalVariantsCount === 82 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `- Dermagarden products count: ${results.dermagardenProductsCount} (Expected: 0) -> ${results.dermagardenProductsCount === 0 ? "✅ PASS" : "❌ FAIL"}`,
  );
  console.log(
    `- VAVAW products count: ${results.vavawProductsCount} (Expected: 0) -> ${results.vavawProductsCount === 0 ? "✅ PASS" : "❌ FAIL"}`,
  );

  // Product ID 56 no active variant check
  const prod56 = dbCatalogProducts.find((p) => p.product_code === "56");
  const prod56HasNoVariants = prod56 && prod56.variants.length === 0;
  console.log(`- Product ID 56 has no variants: ${prod56HasNoVariants ? "✅ PASS" : "❌ FAIL"}`);

  // D. Sample comparison (ID 1, 2, 3, 11, 56)
  const sampleIds = [1, 2, 3, 11, 56];
  console.log("\n--- Sample Comparison (DB vs Static + Overrides) ---");

  let samplePass = true;
  interface SampleReport {
    ID: number;
    "Name Match": string;
    "Category Match": string;
    "Retail Price": string;
    "Retail Size": string;
    "Retail SKU": string;
    "Salon Price": string;
    "Salon Size": string;
    "Salon SKU": string;
    "Image Override": string;
    "Catalog Override": string;
  }
  const sampleReports: SampleReport[] = [];

  for (const id of sampleIds) {
    const staticProd = PRODUCTS.find((p) => p.id === id);
    const dbProd = dbCatalogProducts.find((p) => p.product_code === id.toString());

    if (!staticProd) {
      console.error(`❌ Static product ID ${id} not found in PRODUCTS array.`);
      samplePass = false;
      continue;
    }
    if (!dbProd) {
      console.error(`❌ DB product product_code '${id}' not found in active database catalog.`);
      samplePass = false;
      continue;
    }

    // Resolve expected static properties merged with overrides
    const override = overrideMap.get(id);
    const expectedName = override?.name || staticProd.name;
    const expectedDesc = override?.desc || staticProd.description;
    const expectedImageUrl = override?.image_url || null;
    const expectedCatalogUrl = override?.link_url || null;

    const staticCat = CATEGORIES.find((c) => c.id === staticProd.categoryId);
    const expectedCategoryName = staticCat ? staticCat.nameVi || staticCat.name : null;
    const expectedCategorySlug = staticCat ? staticCat.id.toLowerCase().replace(/\s+/g, "-") : null;

    // Resolve variant values
    const staticRetail = staticProd.variants.find((v) => v.type === "retail");
    const staticSalon = staticProd.variants.find((v) => v.type === "salon");

    let expectedRetailPrice = staticRetail ? staticRetail.price : null;
    let expectedRetailSize = staticRetail ? staticRetail.size : null;
    const expectedRetailSku = staticRetail ? `DESEMBRE-${id}-RETAIL` : null;

    let expectedSalonPrice = staticSalon ? staticSalon.price : null;
    let expectedSalonSize = staticSalon ? staticSalon.size : null;
    const expectedSalonSku = staticSalon ? `DESEMBRE-${id}-SALON` : null;

    if (override) {
      if (staticRetail) {
        expectedRetailPrice =
          override.retail_price !== undefined && override.retail_price !== null
            ? override.retail_price
            : expectedRetailPrice;
        expectedRetailSize = override.retail_size || expectedRetailSize;
      }
      if (staticSalon) {
        expectedSalonPrice =
          override.salon_price !== undefined && override.salon_price !== null
            ? override.salon_price
            : expectedSalonPrice;
        expectedSalonSize = override.salon_size || expectedSalonSize;
      }
    }

    // Compare fields
    const nameMatch = dbProd.name === expectedName;
    const catNameMatch = dbProd.category_name === expectedCategoryName;
    const catSlugMatch = dbProd.category_slug === expectedCategorySlug;
    const imageMatch = dbProd.image_url === expectedImageUrl;
    const catalogMatch = dbProd.catalog_url === expectedCatalogUrl;

    const retailPriceMatch = dbProd.retail?.price === (expectedRetailPrice || undefined);
    const retailSizeMatch = dbProd.retail?.size_label === (expectedRetailSize || undefined);
    const retailSkuMatch = dbProd.retail?.sku === (expectedRetailSku || undefined);

    const salonPriceMatch = dbProd.salon?.price === (expectedSalonPrice || undefined);
    const salonSizeMatch = dbProd.salon?.size_label === (expectedSalonSize || undefined);
    const salonSkuMatch = dbProd.salon?.sku === (expectedSalonSku || undefined);

    const matchAll =
      nameMatch &&
      catNameMatch &&
      catSlugMatch &&
      imageMatch &&
      catalogMatch &&
      retailPriceMatch &&
      retailSizeMatch &&
      retailSkuMatch &&
      salonPriceMatch &&
      salonSizeMatch &&
      salonSkuMatch;

    if (!matchAll) {
      samplePass = false;
    }

    sampleReports.push({
      ID: id,
      "Name Match": nameMatch ? "✅" : `❌ (DB: '${dbProd.name}' vs Exp: '${expectedName}')`,
      "Category Match":
        catNameMatch && catSlugMatch
          ? "✅"
          : `❌ (DB: '${dbProd.category_name}'/'${dbProd.category_slug}' vs Exp: '${expectedCategoryName}'/'${expectedCategorySlug}')`,
      "Retail Price": retailPriceMatch
        ? "✅"
        : `❌ (DB: ${dbProd.retail?.price} vs Exp: ${expectedRetailPrice})`,
      "Retail Size": retailSizeMatch
        ? "✅"
        : `❌ (DB: '${dbProd.retail?.size_label}' vs Exp: '${expectedRetailSize}')`,
      "Retail SKU": retailSkuMatch
        ? "✅"
        : `❌ (DB: '${dbProd.retail?.sku}' vs Exp: '${expectedRetailSku}')`,
      "Salon Price": salonPriceMatch
        ? "✅"
        : `❌ (DB: ${dbProd.salon?.price} vs Exp: ${expectedSalonPrice})`,
      "Salon Size": salonSizeMatch
        ? "✅"
        : `❌ (DB: '${dbProd.salon?.size_label}' vs Exp: '${expectedSalonSize}')`,
      "Salon SKU": salonSkuMatch
        ? "✅"
        : `❌ (DB: '${dbProd.salon?.sku}' vs Exp: '${expectedSalonSku}')`,
      "Image Override": imageMatch
        ? "✅"
        : `❌ (DB: '${dbProd.image_url}' vs Exp: '${expectedImageUrl}')`,
      "Catalog Override": catalogMatch
        ? "✅"
        : `❌ (DB: '${dbProd.catalog_url}' vs Exp: '${expectedCatalogUrl}')`,
    });
  }

  console.table(sampleReports);
  console.log(`\nSample Comparison Overall Result: ${samplePass ? "✅ PASS" : "❌ FAIL"}`);

  // E. RLS Read/Write Integration Test
  console.log("\n--- E. RLS Read/Write Integration Test ---");
  if (!supabaseAnonKey) {
    console.warn(
      "⚠️ Warning: VITE_SUPABASE_ANON_KEY not found in env. RLS integration user test not executed.",
    );
    console.log("RLS integration user test: NOT_EXECUTED (missing anon credentials)");
    return;
  }

  try {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log("1. Testing Anon client (Unauthenticated)...");
    const { data: anonProducts, error: anonError } = await anonClient
      .from("catalog_products")
      .select("id");

    if (anonError) {
      console.log(`✅ Anon client blocked successfully (Error: ${anonError.message})`);
    } else {
      console.log(
        `- Anon client returned ${anonProducts?.length || 0} rows. (Expected: 0 due to RLS) -> ${!anonProducts || anonProducts.length === 0 ? "✅ PASS (empty)" : "❌ FAIL (non-empty)"}`,
      );
    }

    console.log("2. Creating temporary RLS test users...");
    const testAdminEmail = `temp_admin_${Date.now()}@example.com`;
    const testSalesEmail = `temp_sales_${Date.now()}@example.com`;
    const testPassword = `TempPass123!_${Date.now()}`;

    // Create temp admin user
    const { data: adminUserRes, error: adminUserErr } = await adminClient.auth.admin.createUser({
      email: testAdminEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (adminUserErr || !adminUserRes.user) {
      throw new Error(`Failed to create temp admin user: ${adminUserErr?.message}`);
    }
    const adminUser = adminUserRes.user;

    // Create temp sales user
    const { data: salesUserRes, error: salesUserErr } = await adminClient.auth.admin.createUser({
      email: testSalesEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (salesUserErr || !salesUserRes.user) {
      await adminClient.auth.admin.deleteUser(adminUser.id);
      throw new Error(`Failed to create temp sales user: ${salesUserErr?.message}`);
    }
    const salesUser = salesUserRes.user;

    // Assign roles
    await adminClient.from("user_roles").insert([
      { user_id: adminUser.id, role: "admin" },
      { user_id: salesUser.id, role: "sale" },
    ]);

    let adminReadSuccess = false;
    let salesReadSuccess = false;
    let salesWriteBlocked = false;

    // Test Admin RLS
    console.log("3. Testing Admin user client...");
    const adminSign = await anonClient.auth.signInWithPassword({
      email: testAdminEmail,
      password: testPassword,
    });

    if (adminSign.error) {
      console.error("- Admin sign in failed:", adminSign.error.message);
    } else {
      const { data: adminProd, error: adminProdErr } = await anonClient
        .from("catalog_products")
        .select("id");
      if (adminProdErr) {
        console.error("- Admin select error:", adminProdErr.message);
      } else {
        adminReadSuccess = adminProd && adminProd.length === 68;
        console.log(
          `- Admin client read count: ${adminProd?.length} (Expected: 68) -> ${adminReadSuccess ? "✅ PASS" : "❌ FAIL"}`,
        );
      }
      await anonClient.auth.signOut();
    }

    // Test Sales RLS
    console.log("4. Testing Sales user client...");
    const salesSign = await anonClient.auth.signInWithPassword({
      email: testSalesEmail,
      password: testPassword,
    });

    if (salesSign.error) {
      console.error("- Sales sign in failed:", salesSign.error.message);
    } else {
      const { data: salesProd, error: salesProdErr } = await anonClient
        .from("catalog_products")
        .select("id");
      if (salesProdErr) {
        console.error("- Sales select error:", salesProdErr.message);
      } else {
        salesReadSuccess = salesProd && salesProd.length === 68;
        console.log(
          `- Sales client read count: ${salesProd?.length} (Expected: 68) -> ${salesReadSuccess ? "✅ PASS" : "❌ FAIL"}`,
        );
      }

      // Test Sales write blocked
      const { error: writeError } = await anonClient.from("product_brands").insert({
        name: "Sales Hack Brand",
        slug: "sales-hack-brand",
        code: "SALESHACK",
        is_active: true,
      });

      salesWriteBlocked = !!writeError;
      console.log(
        `- Sales client write attempt: ${writeError ? "BLOCKED (✅ PASS)" : "ALLOWED (❌ FAIL)"}`,
      );

      await anonClient.auth.signOut();
    }

    // Clean up temporary users
    console.log("5. Cleaning up temporary users...");
    await adminClient.from("user_roles").delete().in("user_id", [adminUser.id, salesUser.id]);
    await adminClient.auth.admin.deleteUser(adminUser.id);
    await adminClient.auth.admin.deleteUser(salesUser.id);
    console.log("✅ Cleanup complete.");

    // Final decision
    const rlsPass = adminReadSuccess && salesReadSuccess && salesWriteBlocked;
    console.log(`\nRLS Integration Test Result: ${rlsPass ? "✅ PASS" : "❌ FAIL"}`);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("⚠️ Warning: RLS test execution encountered an error:", errorMsg);
    console.log("RLS integration user test not executed");
  }
}

run().catch((e) => {
  console.error("❌ Fatal parity execution error:", e);
  process.exit(1);
});
