import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const STAGING_PROJECT_REF = 'wmhfvggbthyikqvlyqup';
const PROD_PROJECT_REF = 'xhfqjupiidexvlltstal';

function log(msg) {
  console.log(`[preflight] ${msg}`);
}

function logError(msg) {
  console.error(`[preflight] ❌ ERROR: ${msg}`);
}

async function run() {
  log("Starting preflight env target checks...");

  // 1. Check current branch
  try {
    const currentBranch = execSync("git branch --show-current").toString().trim();
    log(`Current branch: ${currentBranch}`);
    if (currentBranch === 'master' || currentBranch === 'main') {
      logError("Cannot run staging operations on master or main branches!");
      process.exit(1);
    }
  } catch (err) {
    logError(`Failed to retrieve git branch: ${err.message}`);
    process.exit(1);
  }

  // 2. Check supabase linked project ref
  const projectRefPath = path.join('supabase', '.temp', 'project-ref');
  if (fs.existsSync(projectRefPath)) {
    const projectRef = fs.readFileSync(projectRefPath, 'utf8').trim();
    log(`Linked project reference: ${projectRef}`);
    if (projectRef !== STAGING_PROJECT_REF) {
      logError(`Project ref must be Staging (${STAGING_PROJECT_REF}). Found: ${projectRef}`);
      process.exit(1);
    }
  } else {
    log("No supabase linked project ref found (.temp/project-ref missing). Skipping strict ref check.");
  }

  // 3. Scan all env and backup files for production reference
  try {
    const files = fs.readdirSync('.');
    const envFiles = files.filter(f => {
      const name = f.toLowerCase();
      return name === '.env' || 
             name === '.env.local' || 
             name === '.env.staging' || 
             name === '.env.production' || 
             name === '.env.backup' || 
             (name.startsWith('.env.') && name.endsWith('.backup'));
    });

    log(`Scanning ${envFiles.length} configuration file(s) for Production target...`);
    for (const file of envFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes(PROD_PROJECT_REF)) {
        logError(`File ${file} contains Production project reference (${PROD_PROJECT_REF})!`);
        process.exit(1);
      }
    }
    log("All configuration files cleared of Production references.");
  } catch (err) {
    logError(`Failed to scan env files: ${err.message}`);
    process.exit(1);
  }

  // 4. Check git tracking for env files
  try {
    const envToCheck = ['.env', '.env.local', '.env.staging', '.env.production', '.env.backup'];
    const trackedFiles = [];
    for (const file of envToCheck) {
      if (fs.existsSync(file)) {
        const output = execSync(`git ls-files ${file}`).toString().trim();
        if (output) {
          trackedFiles.push(file);
        }
      }
    }

    if (trackedFiles.length > 0) {
      logError(`The following sensitive env file(s) are tracked by Git: ${trackedFiles.join(', ')}`);
      logError("Please remove them from git history and add them to .gitignore!");
      process.exit(1);
    }
    log("No sensitive env files are tracked by Git.");
  } catch (err) {
    logError(`Failed to check Git tracking: ${err.message}`);
    process.exit(1);
  }

  log("✅ Preflight env target checks PASSED.");
}

run();
