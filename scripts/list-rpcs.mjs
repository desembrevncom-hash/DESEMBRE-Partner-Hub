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
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const anonKey = envConfig.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${serviceRoleKey}`;
  console.log("Fetching PostgREST OpenAPI spec from:", supabaseUrl);
  try {
    const res = await fetch(url);
    const schema = await res.json();
    console.log("Title:", schema.info?.title);
    console.log("Version:", schema.info?.version);

    const paths = Object.keys(schema.paths || {});
    const rpcs = paths.filter((p) => p.startsWith("/rpc/"));
    console.log(`Found ${rpcs.length} RPCs:`);
    rpcs.forEach((r) => console.log("  ", r));
  } catch (err) {
    console.error("Error fetching PostgREST schema:", err);
  }
}

run();
