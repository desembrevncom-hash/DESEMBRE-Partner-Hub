const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

async function run() {
  const envContent = fs.readFileSync(".env", "utf8");
  let supabaseUrl = "";
  let supabaseAnonKey = "";
  const urlMatch = envContent.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
  if (urlMatch) supabaseUrl = urlMatch[1].replace(/['"]/g, "");
  const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/);
  if (keyMatch) supabaseAnonKey = keyMatch[1].replace(/['"]/g, "");

  console.log("URL:", supabaseUrl.substring(0, 20) + "...");

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });

  console.log("Testing RPC from Frontend...");
  // 1. Sign in as Admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "admin@desembre.vn", // Using known admin
    password: "password123",
  });
  if (authError) {
    console.error("Sign in failed", authError);
    return;
  }

  // 2. Create Staging batch
  const { data: batch, error: batchErr } = await supabase
    .from("customer_import_batches")
    .insert({
      file_name: "test_frontend_rpc.xlsx",
      status: "staging",
      total_rows: 1,
      valid_rows: 1,
      created_by: authData.user.id,
    })
    .select()
    .single();
  if (batchErr) {
    console.error("Insert batch error:", batchErr);
    return;
  }

  const { error: rowErr } = await supabase.from("customer_import_rows").insert({
    batch_id: batch.id,
    row_number: 1,
    raw_data: { phone: "0919998888", customer_name: "FE Test RPC" },
    validation_status: "valid",
  });
  if (rowErr) {
    console.error("Insert row error:", rowErr);
    return;
  }

  // 3. Call RPC
  console.log("Calling confirm_customer_import_batch...");
  const { data: rpcData, error: rpcError } = await supabase.rpc("confirm_customer_import_batch", {
    p_batch_id: batch.id,
  });

  console.log("Admin RPC Result:", { rpcData, rpcError });

  // 4. Test non-admin
  await supabase.auth.signOut();

  const { data: nonAuthData, error: nonAuthErr } = await supabase.auth.signInWithPassword({
    email: "user1@desembre.vn", // assuming non-admin
    password: "password123",
  });
  if (!nonAuthErr && nonAuthData.user) {
    console.log("Testing non-admin...");
    const { data: batch2, error: batchErr2 } = await supabase
      .from("customer_import_batches")
      .insert({
        file_name: "test_nonadmin_rpc.xlsx",
        status: "staging",
        total_rows: 1,
        valid_rows: 1,
        created_by: nonAuthData.user.id,
      })
      .select()
      .single();

    if (batch2) {
      const { data: rpcData2, error: rpcError2 } = await supabase.rpc(
        "confirm_customer_import_batch",
        {
          p_batch_id: batch2.id,
        },
      );
      console.log("Non-Admin RPC Result (Should be error):", { rpcData2, rpcError2 });
    }
  } else {
    console.log("Could not sign in as user1");
  }
}
run().catch(console.error);
