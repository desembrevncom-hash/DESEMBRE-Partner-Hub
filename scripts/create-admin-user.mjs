import { createClient } from "@supabase/supabase-js";
import fs from "fs";

function parseEnv(filePath) {
  const config = {};
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    lines.forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let key = match[1];
        let value = match[2] || "";
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        config[key] = value.trim();
      }
    });
  }
  return config;
}

const envConfig = parseEnv(".env");
for (const k in envConfig) {
  process.env[k] = envConfig[k];
}

// Fallback to defaults or from script
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://wmhfvggbthyikqvlyqup.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtaGZ2Z2didGh5aWtxdmx5cXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDYzMjg5NCwiZXhwIjoyMDk2MjA4ODk0fQ.3Wwb6DB767BDbZlqAjPxlZUlPhtdCKfqRv7uBEFQyK0";

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

async function createAdminUser() {
  const email = "admin.staging@desembre.com";
  const password = "AdminPassword123!";

  console.log(`Creating Admin user: ${email}...`);

  // 1. Create the user in Auth
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });

  let userId = null;
  if (authErr) {
    if (authErr.message.includes("already registered")) {
      console.log("User already exists in Auth.");
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users.users.find((u) => u.email === email);
      if (existingUser) {
        userId = existingUser.id;
      }
    } else {
      console.error("❌ Error creating auth user:", authErr);
      process.exit(1);
    }
  } else {
    console.log(`✅ Auth user created with ID: ${authData.user.id}`);
    userId = authData.user.id;
  }

  if (userId) {
    console.log(`Assigning 'admin' role to ${userId}...`);
    const { error: roleErr } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id" });

    if (roleErr) {
      console.error("❌ Error assigning role:", roleErr);
    } else {
      console.log("✅ Role 'admin' assigned successfully!");
    }
  }
}

createAdminUser();
