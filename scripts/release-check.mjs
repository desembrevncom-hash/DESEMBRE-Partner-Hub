/**
 * scripts/release-check.mjs
 * 
 * Local release readiness gate.
 * Run: npm run release:check
 * 
 * Checks:
 *  1. Current branch is a release/** branch
 *  2. No env files point to Production Supabase ref
 *  3. Runs vitest and reports pass/fail count
 *  4. Prints summary table
 * 
 * This script does NOT deploy, migrate, or touch any database.
 */

import { execSync } from 'child_process';
import fs from 'fs';

const PROD_PROJECT_REF = 'xhfqjupiidexvlltstal';

function log(msg) { console.log(`[release:check] ${msg}`); }
function ok(msg)  { console.log(`[release:check] ✅ ${msg}`); }
function fail(msg){ console.error(`[release:check] ❌ FAIL: ${msg}`); }
function rule()   { console.log('─'.repeat(60)); }

let exitCode = 0;

// ── 1. Branch check ─────────────────────────────────────────────
rule();
log('Checking current branch...');

const branch =
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  (() => { try { return execSync('git branch --show-current').toString().trim(); } catch { return ''; } })();

log(`Branch: ${branch}`);

if (!branch) {
  fail('Could not determine current branch.');
  exitCode = 1;
} else if (!branch.startsWith('release/')) {
  fail(`Expected a release/** branch. Got: "${branch}"`);
  fail('Please run this from a release branch: git checkout release/vX.X.X-...');
  exitCode = 1;
} else {
  ok(`Branch is a valid release branch: ${branch}`);
}

// ── 2. Env file scan ────────────────────────────────────────────
rule();
log('Scanning env files for Production reference...');

const envFiles = ['.env', '.env.local', '.env.staging', '.env.production', '.env.backup'];
let envClean = true;
for (const file of envFiles) {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes(PROD_PROJECT_REF)) {
      fail(`${file} contains Production project ref (${PROD_PROJECT_REF})!`);
      envClean = false;
      exitCode = 1;
    }
  }
}
if (envClean) ok('No env files contain the Production project reference.');

// ── 3. Run tests ─────────────────────────────────────────────────
rule();
log('Running test suite (vitest)...');

let testsPassed = false;
let testOutput = '';
try {
  testOutput = execSync('npm run test -- --reporter=verbose 2>&1', {
    encoding: 'utf8',
    timeout: 120_000,
  });
  testsPassed = true;
  // Extract summary line
  const summaryMatch = testOutput.match(/Tests\s+(\d+)\s+passed/);
  if (summaryMatch) {
    ok(`Tests passed: ${summaryMatch[1]}`);
  } else {
    ok('Test suite completed without errors.');
  }
} catch (err) {
  fail('Test suite failed. Fix failing tests before promoting to Production.');
  console.error(err.stdout || err.message);
  exitCode = 1;
}

// ── 4. Summary table ─────────────────────────────────────────────
rule();
console.log('');
console.log('  RELEASE READINESS SUMMARY');
console.log('  ─────────────────────────────────────────────────');
console.log(`  Branch          : ${branch || 'UNKNOWN'}`);
console.log(`  Branch valid    : ${branch?.startsWith('release/') ? '✅ Yes' : '❌ No'}`);
console.log(`  Env clean       : ${envClean ? '✅ Yes' : '❌ No — Production ref found'}`);
console.log(`  Tests           : ${testsPassed ? '✅ Passed' : '❌ Failed'}`);
console.log('  ─────────────────────────────────────────────────');
console.log('');

if (exitCode === 0) {
  console.log('  ✅ RELEASE READY — proceed to Production DB migration and code promotion.');
} else {
  console.log('  ❌ NOT READY — fix the issues above before promoting to Production.');
}

console.log('');
rule();

process.exit(exitCode);
