import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { evaluateMarketingSafety, MarketingSafetySettings, MarketingSafetyContext } from "../src/lib/marketing/safetyRules";

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function (file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      if (file.endsWith(".ts") || file.endsWith(".tsx") || file.endsWith(".js") || file.endsWith(".jsx")) {
        arrayOfFiles.push(path.join(__dirname, "../", dirPath, "/", file));
      }
    }
  });

  return arrayOfFiles;
}

const defaultSettings: MarketingSafetySettings = {
  global_kill_switch: false,
  email_enabled: true,
  zalo_enabled: true,
  require_admin_approval: false,
  daily_send_quota: 100,
  per_campaign_quota: 100,
  cooldown_minutes: 0,
  duplicate_prevention_hours: 24,
};

describe("Marketing Sandbox Send Safety & Consent Gate (M40)", () => {
  it("should not contain any provider secret access or Resend SDK in frontend files", () => {
    const srcPath = "src";
    const files = getAllFiles(srcPath);

    const forbiddenStrings = [
      'from "resend"',
      "from 'resend'",
      "new Resend(",
      "resend.emails.send",
      "Deno.env",
      "process.env.RESEND_API_KEY",
      "process.env.RESEND_FROM_EMAIL",
      "process.env.RESEND_SANDBOX_TO_ALLOWLIST",
      "import.meta.env.RESEND_API_KEY",
      "import.meta.env.RESEND_FROM_EMAIL",
      "import.meta.env.RESEND_SANDBOX_TO_ALLOWLIST",
    ];

    files.forEach((file) => {
      const content = fs.readFileSync(file, "utf8");
      forbiddenStrings.forEach((forbidden) => {
        if (content.includes(forbidden)) {
          throw new Error(`File ${file} contains forbidden string: ${forbidden}`);
        }
      });
    });

    expect(true).toBe(true);
  });

  it("should not introduce new unauthorized sandbox statuses in Edge Function", () => {
    const efPath = path.join(__dirname, "../supabase/functions/marketing-sandbox-send/index.ts");
    const content = fs.readFileSync(efPath, "utf8");

    const forbiddenStatuses = [
      "status: 'sandbox_sent'",
      'status: "sandbox_sent"',
      "status: 'sandbox_failed'",
      'status: "sandbox_failed"',
      "status: 'sandbox_blocked'",
      'status: "sandbox_blocked"',
    ];

    forbiddenStatuses.forEach((forbidden) => {
      if (content.includes(forbidden)) {
        throw new Error(`Edge Function contains forbidden status assignment: ${forbidden}`);
      }
    });

    expect(true).toBe(true);
  });

  // M40 Consent Integration Tests
  it("missing preference row blocks customer email job", () => {
    const ctx: MarketingSafetyContext = {
      channel: "email",
      customer: { id: "c1" },
      is_sandbox_internal: false,
      customer_preferences: null
    };
    const res = evaluateMarketingSafety(defaultSettings, ctx);
    expect(res.allowed).toBe(false);
    expect(res.consent?.allowed).toBe(false);
    expect(res.consent?.code).toBe("MISSING_PREFERENCES");
  });

  it("global opt out blocks email and zalo", () => {
    const ctx: MarketingSafetyContext = {
      channel: "email",
      customer: { id: "c1" },
      is_sandbox_internal: false,
      customer_preferences: {
        customer_id: "c1",
        email_opt_in: true,
        zalo_opt_in: true,
        global_opt_out: true
      }
    };
    const resEmail = evaluateMarketingSafety(defaultSettings, ctx);
    expect(resEmail.allowed).toBe(false);
    expect(resEmail.consent?.code).toBe("GLOBAL_OPT_OUT");

    ctx.channel = "zalo";
    const resZalo = evaluateMarketingSafety(defaultSettings, ctx);
    expect(resZalo.allowed).toBe(false);
    expect(resZalo.consent?.code).toBe("GLOBAL_OPT_OUT");
  });

  it("email_opt_in allows email only when other gates allow", () => {
    const ctx: MarketingSafetyContext = {
      channel: "email",
      customer: { id: "c1" },
      is_sandbox_internal: false,
      customer_preferences: {
        customer_id: "c1",
        email_opt_in: true,
        zalo_opt_in: false,
        global_opt_out: false
      }
    };
    const res = evaluateMarketingSafety(defaultSettings, ctx);
    expect(res.allowed).toBe(true);
    expect(res.consent?.allowed).toBe(true);
  });

  it("email_opt_in does not allow zalo", () => {
    const ctx: MarketingSafetyContext = {
      channel: "zalo",
      customer: { id: "c1" },
      is_sandbox_internal: false,
      customer_preferences: {
        customer_id: "c1",
        email_opt_in: true,
        zalo_opt_in: false,
        global_opt_out: false
      }
    };
    const res = evaluateMarketingSafety(defaultSettings, ctx);
    expect(res.allowed).toBe(false);
    expect(res.consent?.code).toBe("ZALO_OPT_OUT");
  });

  it("zalo_opt_in does not allow email", () => {
    const ctx: MarketingSafetyContext = {
      channel: "email",
      customer: { id: "c1" },
      is_sandbox_internal: false,
      customer_preferences: {
        customer_id: "c1",
        email_opt_in: false,
        zalo_opt_in: true,
        global_opt_out: false
      }
    };
    const res = evaluateMarketingSafety(defaultSettings, ctx);
    expect(res.allowed).toBe(false);
    expect(res.consent?.code).toBe("EMAIL_OPT_OUT");
  });

  it("no customer_id non-sandbox blocks", () => {
    const ctx: MarketingSafetyContext = {
      channel: "email",
      customer: { id: undefined },
      is_sandbox_internal: false,
      customer_preferences: null
    };
    const res = evaluateMarketingSafety(defaultSettings, ctx);
    expect(res.allowed).toBe(false);
    expect(res.reasons.some(r => r.includes("Non-sandbox job requires a valid customer ID"))).toBe(true);
    expect(res.consent?.code).toBe("MISSING_CUSTOMER_ID");
  });

  it("internal sandbox job does not require customer consent and skips global kill switch block", () => {
    const killSwitchSettings = { ...defaultSettings, global_kill_switch: true };
    const ctx: MarketingSafetyContext = {
      channel: "email",
      customer: { id: undefined },
      is_sandbox_internal: true,
      customer_preferences: null
    };
    const res = evaluateMarketingSafety(killSwitchSettings, ctx);
    // Sandbox internal bypasses consent and kill switch block (it gets a warning)
    expect(res.allowed).toBe(true);
    expect(res.consent?.code).toBe("SANDBOX_SKIPPED");
    expect(res.warnings.some(w => w.includes("Global Kill Switch is active, but bypassed"))).toBe(true);
  });
});
