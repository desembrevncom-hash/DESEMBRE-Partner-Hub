import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://wmhfvggbthyikqvlyqup.supabase.co";
// From scripts/test_edge.mjs
const serviceKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtaGZ2Z2didGh5aWtxdmx5cXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYzMjg5NCwiZXhwIjoyMDk2MjA4ODk0fQ.3Wwb6DB767BDbZlqAjPxlZUlPhtdCKfqRv7uBEFQyK0";

const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function createSaleUser() {
  const email = "sale.test@desembre.com";
  const password = "Password123!";

  console.log(`Creating user: ${email}...`);

  // 1. Create the user in Auth
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });

  if (authErr) {
    if (authErr.message.includes("already registered")) {
      console.log("User already exists in Auth.");
      // Find the user ID
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users.users.find((u) => u.email === email);
      if (existingUser) {
        await assignRole(existingUser.id, email);
      }
    } else {
      console.error("❌ Error creating auth user:", authErr);
      process.exit(1);
    }
  } else {
    console.log(`✅ Auth user created with ID: ${authData.user.id}`);
    await assignRole(authData.user.id, email);
  }
}

async function assignRole(userId, email) {
  console.log(`Assigning 'sale' role to ${userId}...`);
  const { error: roleErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role: "sale" }, { onConflict: "user_id" });

  if (roleErr) {
    console.error("❌ Error assigning role:", roleErr);
  } else {
    console.log("✅ Role 'sale' assigned successfully!");
  }
}

createSaleUser();
