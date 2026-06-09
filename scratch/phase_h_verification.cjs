const fs = require("fs");

const envText = fs.readFileSync(".env", "utf8");
const envVars = {};
envText.split("\n").forEach((line) => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*"?([^"]*)"?\s*$/);
  if (m) envVars[m[1]] = m[2];
});

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

const results = [];
function report(section, name, pass, detail) {
  const tag = pass ? "✅ PASS" : "❌ FAIL";
  const line = `[${section}] ${tag} — ${name}${detail ? ": " + detail : ""}`;
  console.log(line);
  results.push({ section, name, pass, detail });
}

async function sbRest(path, options = {}) {
  const { method = "GET", body, token, headers: extraHeaders = {}, prefer } = options;
  const hdrs = {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token || ANON_KEY}`,
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (prefer) hdrs["Prefer"] = prefer;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: hdrs,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, ok: res.ok };
}

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return await res.json();
}

async function triggerEdgeFunction(token, productKnowledgeId, rebuild = false) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/embed-product-knowledge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productKnowledgeId, rebuild }),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, ok: res.ok };
}

async function main() {
  console.log("\n══════════════════════════════════════════════");
  console.log("  Phase H — Build Chunks Verification");
  console.log("══════════════════════════════════════════════\n");

  // 0. Login as admin
  const adminAuth = await login("desembrevn.com@gmail.com", "12345678");
  if (!adminAuth.access_token) {
    report("AUTH", "Admin Login", false, JSON.stringify(adminAuth));
    return;
  }
  const adminToken = adminAuth.access_token;
  report("AUTH", "Admin Login", true, "Success");

  // Login as sales (we use admin to insert a test sale user if needed, or just skip if none exists)
  // Note: we just verify RLS on edge function using anon token to simulate unprivileged user
  const anonEdgeRes = await triggerEdgeFunction(ANON_KEY, "test", false);
  report(
    "PERMISSION",
    "Anon cannot build",
    !anonEdgeRes.ok,
    `Got status: ${anonEdgeRes.status}, Error: ${anonEdgeRes.data?.error || "unknown"}`,
  );

  // Create a test product
  const testProductId = 88801;
  await sbRest(`product_knowledge?product_id=eq.${testProductId}`, {
    method: "DELETE",
    token: adminToken,
  });

  const insertRes = await sbRest("product_knowledge", {
    method: "POST",
    token: adminToken,
    body: {
      product_id: testProductId,
      benefits: "Phase H Test Product Benefits",
      usage_instructions: "Use daily",
      sales_pitch: "Great product",
      qa_status: "draft",
      is_active: true,
    },
    prefer: "return=representation",
  });
  const testPk = insertRes.data?.[0];
  if (!testPk) {
    report("SETUP", "Create test product", false, "Failed");
    return;
  }
  report("SETUP", "Created test product (draft)", true, `PK ID: ${testPk.id}`);

  // 1. Try to build draft -> should fail
  const draftBuildRes = await triggerEdgeFunction(adminToken, testPk.id, false);
  report(
    "VALIDATION",
    "Draft product cannot be built",
    !draftBuildRes.ok,
    `Got error: ${draftBuildRes.data?.error}`,
  );

  // 2. Update to approved and active
  await sbRest(`product_knowledge?id=eq.${testPk.id}`, {
    method: "PATCH",
    token: adminToken,
    body: { qa_status: "approved", is_active: true },
  });
  report("SETUP", "Approved test product", true);

  // 3. Build embedding
  console.log("Building embeddings (this may take a few seconds)...");
  const buildRes = await triggerEdgeFunction(adminToken, testPk.id, false);
  report(
    "BUILD",
    "Build embedding for approved product",
    buildRes.ok,
    buildRes.ok ? `Created ${buildRes.data?.chunkCount} chunks` : JSON.stringify(buildRes.data),
  );

  // Check DB state after build
  const stateRes = await sbRest(
    `product_knowledge?id=eq.${testPk.id}&select=build_status,knowledge_version,last_embedded_at`,
    { token: adminToken },
  );
  const state = stateRes.data?.[0];
  report(
    "DB_STATE",
    "Build status is completed",
    state?.build_status === "completed",
    `Got ${state?.build_status}`,
  );
  report(
    "DB_STATE",
    "Knowledge version is set",
    !!state?.knowledge_version,
    `Got v${state?.knowledge_version}`,
  );
  report("DB_STATE", "Last embedded at is set", !!state?.last_embedded_at);

  // 4. Check chunks
  const chunksRes = await sbRest(
    `product_knowledge_chunks?product_id=eq.${testProductId}&select=id,is_active,knowledge_version`,
    { token: adminToken },
  );
  report(
    "CHUNKS",
    "Chunks created and active",
    chunksRes.data?.length > 0 && chunksRes.data[0].is_active === true,
    `Found ${chunksRes.data?.length} chunks`,
  );

  // 5. Rebuild embedding
  console.log("Rebuilding embeddings...");
  const rebuildRes = await triggerEdgeFunction(adminToken, testPk.id, true);
  report(
    "REBUILD",
    "Rebuild embedding successful",
    rebuildRes.ok,
    rebuildRes.ok
      ? `Created ${rebuildRes.data?.chunkCount} new chunks`
      : JSON.stringify(rebuildRes.data),
  );

  // Check chunks after rebuild
  const chunksRes2 = await sbRest(
    `product_knowledge_chunks?product_id=eq.${testProductId}&select=id,is_active,knowledge_version`,
    { token: adminToken },
  );
  const activeChunks = chunksRes2.data?.filter((c) => c.is_active === true) || [];
  const inactiveChunks = chunksRes2.data?.filter((c) => c.is_active === false) || [];

  report(
    "REBUILD_STATE",
    "Old chunks are inactive",
    inactiveChunks.length > 0,
    `Found ${inactiveChunks.length} inactive chunks`,
  );
  report(
    "REBUILD_STATE",
    "New chunks are active",
    activeChunks.length > 0,
    `Found ${activeChunks.length} active chunks`,
  );

  const newStateRes = await sbRest(
    `product_knowledge?id=eq.${testPk.id}&select=knowledge_version`,
    { token: adminToken },
  );
  const newVer = newStateRes.data?.[0]?.knowledge_version;
  report(
    "REBUILD_STATE",
    "Knowledge version incremented",
    newVer > state?.knowledge_version,
    `Version went from ${state?.knowledge_version} to ${newVer}`,
  );

  // Cleanup
  await sbRest(`product_knowledge?product_id=eq.${testProductId}`, {
    method: "DELETE",
    token: adminToken,
  });

  printSummary();
}

function printSummary() {
  console.log("\n══════════════════════════════════════════════");
  console.log("  VERIFICATION SUMMARY");
  console.log("══════════════════════════════════════════════");

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`\nTOTAL: ${passed}/${total} PASSED\n`);
}

main();
