/**
 * scripts/production-check.mjs
 *
 * READ-ONLY Production readiness check.
 * Run: npm run prod:readiness
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  READ-ONLY CHECK ONLY.                                          │
 * │  This script does NOT deploy, migrate, or touch Production.     │
 * │  It only reads local environment variables and file paths.      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Checks:
 *  1. Current branch is release/** or master
 *  2. VITE_SUPABASE_URL does NOT contain Staging ref
 *  3. VITE_SUPABASE_URL DOES contain Production ref (xhfqjupiidexvlltstal)
 *  4. Lists pending supabase/migrations/ files
 *  5. Prints READY / NOT READY summary
 *
 * This script makes no network calls and does not execute any SQL.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const PROD_PROJECT_REF = "xhfqjupiidexvlltstal";
const STAGING_PROJECT_REF = "wmhfvggbthyikqvlyqup";

function log(msg) {
  console.log(`[prod:readiness] ${msg}`);
}
function ok(msg) {
  console.log(`[prod:readiness] ✅ ${msg}`);
}
function warn(msg) {
  console.warn(`[prod:readiness] ⚠️  ${msg}`);
}
function fail(msg) {
  console.error(`[prod:readiness] ❌ FAIL: ${msg}`);
}
function rule() {
  console.log("─".repeat(64));
}

// ── Disclaimer banner ────────────────────────────────────────────
console.log("");
console.log("┌──────────────────────────────────────────────────────────────┐");
console.log("│  READ-ONLY CHECK ONLY.                                       │");
console.log("│  This script does NOT deploy, migrate, or touch Production.  │");
console.log("│  It only reads local env variables and file paths.           │");
console.log("└──────────────────────────────────────────────────────────────┘");
console.log("");

let exitCode = 0;

// ── 1. Branch check ─────────────────────────────────────────────
rule();
log("Checking current branch...");

const branch =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  (() => {
    try {
      return execSync("git branch --show-current").toString().trim();
    } catch {
      return "";
    }
  })();

log(`Branch: ${branch || "(unknown)"}`);

const isValidBranch = branch === "master" || branch === "main" || branch.startsWith("release/");
if (!isValidBranch) {
  warn(`Branch "${branch}" is not master or a release branch.`);
  warn("prod:readiness is typically run from release/** or master before promotion.");
} else {
  ok(`Branch is valid for production promotion: ${branch}`);
}

// ── 2. Env: must NOT contain Staging ref ──────────────────────────
rule();
log("Checking VITE_SUPABASE_URL for Staging reference (must be absent)...");

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";

if (supabaseUrl.includes(STAGING_PROJECT_REF)) {
  fail("VITE_SUPABASE_URL still points to Staging!");
  fail(`Found ref: ${STAGING_PROJECT_REF}`);
  fail("Switch to Production environment variables before promoting.");
  exitCode = 1;
} else if (!supabaseUrl) {
  warn("VITE_SUPABASE_URL is not set in the current environment.");
  warn("Ensure Production env vars are loaded (e.g. via .env.production or Vercel).");
} else {
  ok("VITE_SUPABASE_URL does not contain the Staging reference.");
}

// ── 3. Env: must contain Production ref ───────────────────────────
log("Checking VITE_SUPABASE_URL for Production reference (must be present)...");

if (supabaseUrl && !supabaseUrl.includes(PROD_PROJECT_REF)) {
  fail("VITE_SUPABASE_URL does not point to Production!");
  fail(`Expected ref: ${PROD_PROJECT_REF}`);
  fail("Load Production environment variables before running this check.");
  exitCode = 1;
} else if (supabaseUrl.includes(PROD_PROJECT_REF)) {
  ok(`VITE_SUPABASE_URL confirmed Production target: ${PROD_PROJECT_REF}`);
}

// ── 4. List pending migrations ────────────────────────────────────
rule();
log("Scanning supabase/migrations/ for migration files...");

const migrationsDir = path.join("supabase", "migrations");
let pendingMigrations = [];

if (fs.existsSync(migrationsDir)) {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    log("No migration files found in supabase/migrations/.");
  } else {
    console.log("");
    console.log("  Migration files in supabase/migrations/ (apply manually if not yet applied):");
    files.forEach((f, i) => {
      console.log(`  ${String(i + 1).padStart(2, " ")}. ${f}`);
    });
    console.log("");
    pendingMigrations = files;
    warn(
      `${files.length} migration file(s) found. Verify which have been applied to Production manually.`,
    );
    warn('Never use "supabase db push" targeting Production without explicit approval.');
  }
} else {
  warn("supabase/migrations/ directory not found. Skipping migration scan.");
}

// ── 5. Summary ────────────────────────────────────────────────────
rule();
console.log("");
console.log("  PRODUCTION READINESS SUMMARY");
console.log("  ────────────────────────────────────────────────────────────");
console.log(`  Branch                    : ${branch || "UNKNOWN"}`);
console.log(
  `  Branch valid              : ${isValidBranch ? "✅ Yes" : "⚠️  Warning (not release/master)"}`,
);
console.log(
  `  Supabase URL (prod ref)   : ${supabaseUrl.includes(PROD_PROJECT_REF) ? "✅ Confirmed" : supabaseUrl ? "❌ Missing" : "⚠️  Not set"}`,
);
console.log(
  `  Supabase URL (no staging) : ${supabaseUrl.includes(STAGING_PROJECT_REF) ? "❌ Still staging" : "✅ Clean"}`,
);
console.log(
  `  Migration files           : ${pendingMigrations.length} file(s) — verify applied status manually`,
);
console.log("  ────────────────────────────────────────────────────────────");
console.log("");

if (exitCode === 0) {
  console.log("  ✅ PRODUCTION READY (env check passed)");
  console.log("  → Proceed to docs/production-promotion-checklist.md Phase 2.");
} else {
  console.log("  ❌ NOT READY — fix the issues above before promoting.");
}

console.log("");
console.log("  READ-ONLY CHECK ONLY. This script does not deploy, migrate, or touch Production.");
console.log("");
rule();

process.exit(exitCode);
