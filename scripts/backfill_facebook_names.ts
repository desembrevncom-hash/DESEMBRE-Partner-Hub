import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env.vercel'),
  resolve(process.cwd(), 'supabase', 'functions', '.env')
];

for (const envPath of envPaths) {
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    });
  } catch (e) {
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function extractFacebookDisplayName(item: any): string | null {
  if (!item || typeof item !== 'object') return null;

  const rawName = 
    item.name || 
    item.title || 
    item.fullName || 
    item.profileName || 
    item.displayName || 
    item.facebookName || 
    item.pageName || 
    item.openGraph?.title || 
    item.openGraph?.alt || 
    item.openGraph?.name || 
    item.user?.name || 
    item.user?.title || 
    item.user?.displayName || 
    item.user?.profileName || 
    item.page?.name || 
    item.pageAdLibrary?.pageName || 
    null;

  let cleanName = null;

  if (typeof rawName === 'string') {
    cleanName = rawName.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
  }

  // Fallback to directory tile if still null
  if (!cleanName && typeof item.user?.directory_tile_section_truncation_string?.text === 'string') {
    const text = item.user.directory_tile_section_truncation_string.text.trim();
    if (text.startsWith("See more about ")) {
      cleanName = text.substring("See more about ".length).trim();
    }
  }

  if (!cleanName) return null;

  // Rejection rules
  const lowerName = cleanName.toLowerCase();
  
  if (lowerName === "facebook" || lowerName === "com.facebook.katana") {
    return null; // Rejected openGraph values
  }
  if (lowerName.includes("facebook.com") || lowerName.startsWith("http://") || lowerName.startsWith("https://")) {
    return null; // No URLs
  }
  if (lowerName === "facebook") {
    return null; // Generic words
  }

  // Clean " | Facebook"
  if (cleanName.endsWith(" | Facebook")) {
    cleanName = cleanName.substring(0, cleanName.length - " | Facebook".length).trim();
  }

  if (cleanName.length === 0) return null;

  return cleanName.substring(0, 120);
}

async function run() {
  console.log("Fetching facebook_uid_resolver_results to backfill...");
  
  const { data: results, error: fetchErr } = await supabase
    .from("facebook_uid_resolver_results")
    .select("id, returned_uid, returned_name, response_json")
    .in("provider_status", ["resolved", "cached"])
    .not("returned_uid", "is", null)
    .is("returned_name", null);

  if (fetchErr) {
    console.error("Error fetching results:", fetchErr);
    return;
  }

  console.log(`Found ${results.length} rows to evaluate.`);

  let updatedCount = 0;
  for (const row of results) {
    const name = extractFacebookDisplayName(row.response_json);
    if (name) {
      console.log(`Extracted name '${name}' for UID ${row.returned_uid}`);
      
      // Update facebook_uid_resolver_results
      const { error: err1 } = await supabase
        .from("facebook_uid_resolver_results")
        .update({ returned_name: name })
        .eq("id", row.id);
        
      if (err1) {
        console.error("Error updating result:", err1);
        continue;
      }

      // Update customer_social_profiles
      const { data: profiles, error: err2 } = await supabase
        .from("customer_social_profiles")
        .select("id, facebook_display_name")
        .eq("facebook_uid", row.returned_uid)
        .is("facebook_display_name", null);

      if (err2) {
        console.error("Error fetching profile:", err2);
        continue;
      }

      for (const profile of profiles) {
        const { error: err3 } = await supabase
          .from("customer_social_profiles")
          .update({
            facebook_display_name: name,
            display_name_source: "external_apify_backfill",
            display_name_confidence_score: 70,
            display_name_updated_at: new Date().toISOString()
          })
          .eq("id", profile.id);

        if (err3) {
          console.error("Error updating profile:", err3);
        } else {
          updatedCount++;
        }
      }
    }
  }

  console.log(`Finished backfill. Updated ${updatedCount} profiles.`);
}

run();
