import { supabase } from "@/integrations/supabase/client";
import {
  dryValidateProviderAdapter,
  getSupportedProviderNames,
  ProviderDryValidationResult,
} from "./providers";

export interface ProviderReadinessSafetySnapshot {
  global_kill_switch: boolean;
  email_enabled: boolean;
  zalo_enabled: boolean;
  daily_send_quota: number;
  per_campaign_quota: number;
  require_admin_approval: boolean;
  fail_closed: boolean;
  checks: string[];
  warnings: string[];
}

export interface ProviderReadinessReport {
  generated_at: string;
  mode: "dry_run_only";
  safety: ProviderReadinessSafetySnapshot;
  providers: ProviderDryValidationResult[];
  summary: {
    status: "pass" | "warning";
    real_send_enabled: false;
    external_provider_calls_enabled: false;
    message: string;
  };
}

const DEFAULT_FAIL_CLOSED_SETTINGS = {
  global_kill_switch: true,
  email_enabled: false,
  zalo_enabled: false,
  daily_send_quota: 0,
  per_campaign_quota: 0,
  require_admin_approval: true,
};

function toBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function evaluateSafetySettings(settings: any): ProviderReadinessSafetySnapshot {
  const snapshot = {
    global_kill_switch: toBoolean(settings?.global_kill_switch, true),
    email_enabled: toBoolean(settings?.email_enabled, false),
    zalo_enabled: toBoolean(settings?.zalo_enabled, false),
    daily_send_quota: toNumber(settings?.daily_send_quota, 0),
    per_campaign_quota: toNumber(settings?.per_campaign_quota, 0),
    require_admin_approval: toBoolean(settings?.require_admin_approval, true),
  };

  const checks: string[] = [];
  const warnings: string[] = [];

  if (snapshot.global_kill_switch) {
    checks.push("Global Kill Switch is ON.");
  } else {
    warnings.push("Global Kill Switch is OFF.");
  }

  if (!snapshot.email_enabled) {
    checks.push("Email sending is disabled.");
  } else {
    warnings.push("Email sending is enabled.");
  }

  if (!snapshot.zalo_enabled) {
    checks.push("Zalo sending is disabled.");
  } else {
    warnings.push("Zalo sending is enabled.");
  }

  if (snapshot.daily_send_quota === 0) {
    checks.push("Daily send quota is 0.");
  } else {
    warnings.push(`Daily send quota is ${snapshot.daily_send_quota}.`);
  }

  if (snapshot.per_campaign_quota === 0) {
    checks.push("Per-campaign send quota is 0.");
  } else {
    warnings.push(`Per-campaign send quota is ${snapshot.per_campaign_quota}.`);
  }

  if (snapshot.require_admin_approval) {
    checks.push("Admin approval is required.");
  } else {
    warnings.push("Admin approval is not required.");
  }

  const failClosed =
    snapshot.global_kill_switch === true &&
    snapshot.email_enabled === false &&
    snapshot.zalo_enabled === false &&
    snapshot.daily_send_quota === 0 &&
    snapshot.per_campaign_quota === 0 &&
    snapshot.require_admin_approval === true;

  return {
    ...snapshot,
    fail_closed: failClosed,
    checks,
    warnings,
  };
}

export async function getProviderReadinessReport(): Promise<ProviderReadinessReport> {
  const { data, error } = await supabase
    .from("marketing_ops_safety_settings")
    .select(
      "global_kill_switch,email_enabled,zalo_enabled,daily_send_quota,per_campaign_quota,require_admin_approval"
    )
    .eq("is_default", true)
    .single();

  const settings = error || !data ? DEFAULT_FAIL_CLOSED_SETTINGS : data;
  const safety = evaluateSafetySettings(settings);

  const providers = getSupportedProviderNames().map((providerName) =>
    dryValidateProviderAdapter(providerName)
  );

  const dryRunOnly = providers.every(
    (provider) => provider.dry_run_only && provider.real_send_enabled === false
  );

  const status = safety.fail_closed && dryRunOnly ? "pass" : "warning";

  return {
    generated_at: new Date().toISOString(),
    mode: "dry_run_only",
    safety,
    providers,
    summary: {
      status,
      real_send_enabled: false,
      external_provider_calls_enabled: false,
      message:
        status === "pass"
          ? "Provider readiness dry validation passed. Real sends and external provider calls remain disabled."
          : "Provider readiness completed with warnings. Real sends remain disabled.",
    },
  };
}