import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getProviderReadinessReport,
  ProviderReadinessReport,
} from "@/lib/marketing/providerReadiness";
import {
  runProviderConfigAudit,
  ProviderConfigAuditResult,
} from "@/lib/marketing/providerConfigAudit";
import {
  getProviderSandboxPlan,
  SandboxPlanResult,
} from "@/lib/marketing/providerSandboxPlan";
import { SecretGateResult, getFallbackSecretGateState } from "@/lib/marketing/providerSecretGate";
import {
  getSandboxExecutionPlan,
  ExecutionPlanResult,
} from "@/lib/marketing/sandboxExecutionPlan";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/marketing/provider-readiness")({
  component: ProviderReadinessPage,
});

function ProviderReadinessPage() {
  const [report, setReport] = useState<ProviderReadinessReport | null>(null);
  const [configAudit, setConfigAudit] = useState<ProviderConfigAuditResult[]>([]);
  const [sandboxPlan, setSandboxPlan] = useState<SandboxPlanResult[]>([]);
  const [secretGate, setSecretGate] = useState<SecretGateResult[]>([]);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlanResult[]>([]);
  const [secretGateErrorMsg, setSecretGateErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    runDryValidation();
  }, []);

  const runDryValidation = async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const nextReport = await getProviderReadinessReport();
      setReport(nextReport);
      setConfigAudit(runProviderConfigAudit());
      setSandboxPlan(getProviderSandboxPlan());
      setExecutionPlan(getSandboxExecutionPlan());

      // M25 Edge Function call
      try {
        const { data, error: secretGateError } = await supabase.functions.invoke(
          "provider-secret-gate"
        );
        if (secretGateError || !data) {
          setSecretGateErrorMsg("Server-side secret gate is not deployed or unavailable. Real sends remain disabled.");
          setSecretGate(getFallbackSecretGateState());
        } else {
          setSecretGate(data);
        }
      } catch (invokeError) {
        setSecretGateErrorMsg("Server-side secret gate is not deployed or unavailable. Real sends remain disabled.");
        setSecretGate(getFallbackSecretGateState());
      }
    } catch (error: any) {
      setErrorMessage(error?.message || "Failed to run provider readiness validation.");
    } finally {
      setLoading(false);
    }
  };

  const statusBadgeClass =
    report?.summary.status === "pass"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : "bg-amber-100 text-amber-700 border-amber-200";

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Server className="h-6 w-6 text-indigo-600" />
              <Badge className="border-indigo-200 bg-indigo-50 text-indigo-700">
                M19 Dry Validation
              </Badge>
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              Provider Readiness
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Validate provider adapters and marketing safety settings without
              sending real messages and without calling external provider APIs.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
  to="/marketing"
  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
>
  Back to Marketing
</Link>

            <Button onClick={runDryValidation} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Run Dry Validation
            </Button>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Running dry validation...
          </div>
        )}

        {!loading && report && (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-500">Summary</p>
                  <Badge className={statusBadgeClass}>
                    {report.summary.status.toUpperCase()}
                  </Badge>
                </div>

                <p className="mt-3 text-sm text-slate-700">
                  {report.summary.message}
                </p>

                <p className="mt-3 text-xs text-slate-400">
                  Generated at: {new Date(report.generated_at).toLocaleString()}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                  <p className="font-semibold text-emerald-800">No Real Send</p>
                </div>

                <p className="mt-3 text-sm text-emerald-700">
                  real_send_enabled ={" "}
                  <span className="font-mono">
                    {String(report.summary.real_send_enabled)}
                  </span>
                </p>

                <p className="mt-1 text-sm text-emerald-700">
                  external_provider_calls_enabled ={" "}
                  <span className="font-mono">
                    {String(report.summary.external_provider_calls_enabled)}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  {report.safety.fail_closed ? (
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <p className="font-semibold text-slate-900">
                    Fail-Closed Safety
                  </p>
                </div>

                <p className="mt-3 text-sm text-slate-700">
                  fail_closed ={" "}
                  <span className="font-mono">
                    {String(report.safety.fail_closed)}
                  </span>
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-slate-700" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Safety Settings Checklist
                </h2>
              </div>

              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <SafetyValue label="Global Kill Switch" value={report.safety.global_kill_switch} />
                <SafetyValue label="Email Enabled" value={report.safety.email_enabled} />
                <SafetyValue label="Zalo Enabled" value={report.safety.zalo_enabled} />
                <SafetyValue label="Daily Quota" value={report.safety.daily_send_quota} />
                <SafetyValue label="Per-Campaign Quota" value={report.safety.per_campaign_quota} />
                <SafetyValue label="Require Admin Approval" value={report.safety.require_admin_approval} />
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-semibold text-emerald-700">
                    Checks
                  </p>
                  <ul className="space-y-2">
                    {report.safety.checks.map((check) => (
                      <li key={check} className="flex gap-2 text-sm text-slate-700">
                        <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600" />
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-amber-700">
                    Warnings
                  </p>
                  {report.safety.warnings.length === 0 ? (
                    <p className="text-sm text-slate-500">No warnings.</p>
                  ) : (
                    <ul className="space-y-2">
                      {report.safety.warnings.map((warning) => (
                        <li key={warning} className="flex gap-2 text-sm text-slate-700">
                          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                          {warning}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {report.providers.map((provider) => (
                <div
                  key={provider.provider}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">
                        {provider.label}
                      </p>
                      <p className="text-sm text-slate-500">
                        Channel: {provider.channel}
                      </p>
                    </div>

                    <Badge
                      className={
                        provider.status === "pass"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-700"
                      }
                    >
                      {provider.status}
                    </Badge>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <p>
                      dry_run_only:{" "}
                      <span className="font-mono">{String(provider.dry_run_only)}</span>
                    </p>
                    <p>
                      real_send_enabled:{" "}
                      <span className="font-mono">{String(provider.real_send_enabled)}</span>
                    </p>
                    <p>
                      can_initialize_adapter:{" "}
                      <span className="font-mono">{String(provider.can_initialize_adapter)}</span>
                    </p>
                  </div>

                  <div className="mt-4">
                    <p className="mb-2 text-sm font-semibold text-slate-700">
                      Dry checks
                    </p>
                    <ul className="space-y-2">
                      {provider.checks.map((check) => (
                        <li key={check} className="flex gap-2 text-sm text-slate-600">
                          <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600" />
                          {check}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {provider.warnings.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <ul className="space-y-2">
                        {provider.warnings.map((warning) => (
                          <li key={warning} className="flex gap-2 text-sm text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4" />
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-700" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Provider Config Audit (M22)
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {configAudit.map((audit) => (
                  <div
                    key={audit.provider}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {audit.label}
                        </p>
                        <p className="text-sm text-slate-500">
                          Channel: {audit.channel}
                        </p>
                      </div>
                      <Badge
                        className={
                          audit.status === "ready_for_dry_run_only"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }
                      >
                        {audit.status}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs font-mono text-slate-700">
                      <p>real_send_enabled: {String(audit.real_send_enabled)}</p>
                      <p>external_provider_calls_enabled: {String(audit.external_provider_calls_enabled)}</p>
                      <p>secrets_read: {String(audit.secrets_read)}</p>
                      <p>secret_values_exposed: {String(audit.secret_values_exposed)}</p>
                      <p>provider_api_called: {String(audit.provider_api_called)}</p>
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        Checklist
                      </p>
                      <ul className="space-y-2">
                        {audit.checklist.map((check, idx) => (
                          <li key={idx} className="flex gap-2 text-sm text-slate-600">
                            <CheckCircle className="mt-0.5 h-4 w-4 text-emerald-600 flex-shrink-0" />
                            {check}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {audit.required_env_names.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm font-semibold text-slate-700">
                          Required Env Names (Names Only)
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {audit.required_env_names.map((envName) => (
                            <Badge key={envName} variant="outline" className="font-mono text-xs text-slate-600 border-slate-300">
                              {envName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-700" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Provider Sandbox Credential Planning (M24)
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {sandboxPlan.map((plan) => (
                  <div
                    key={plan.provider}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {plan.display_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          Sandbox Supported: {plan.sandbox_supported ? "Yes" : "No"}
                        </p>
                      </div>
                      <Badge
                        className={
                          plan.setup_status === "dry_run_only"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }
                      >
                        {plan.setup_status}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs font-mono text-slate-700 mb-4">
                      <p>Secret Owner Role: <span className="font-semibold">{plan.secret_owner_role}</span></p>
                      <p>Production Gate Required: <span className="font-semibold">{String(plan.production_gate_required)}</span></p>
                    </div>

                    <div className="mt-auto">
                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        Allowed Test Recipients
                      </p>
                      <p className="text-xs text-slate-600 mb-4 border-l-2 border-slate-300 pl-2">
                        {plan.allowed_test_recipient_policy}
                      </p>

                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        Safety Notes
                      </p>
                      <ul className="space-y-2 mb-4">
                        {plan.safety_notes.map((note, idx) => (
                          <li key={idx} className="flex gap-2 text-xs text-slate-600">
                            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                            {note}
                          </li>
                        ))}
                      </ul>

                      {plan.required_env_names.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-semibold text-slate-700">
                            Required Sandbox Env Names
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {plan.required_env_names.map((envName) => (
                              <Badge key={envName} variant="outline" className="font-mono text-[10px] text-slate-600 border-slate-300">
                                {envName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-700" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Provider Sandbox Secret Gate (M25)
                </h2>
              </div>

              {secretGateErrorMsg && (
                <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900">
                        Function Unavailable
                      </p>
                      <p className="mt-1 text-sm text-amber-700">
                        {secretGateErrorMsg}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {secretGate.length === 0 && !secretGateErrorMsg ? (
                <div className="text-sm text-slate-500 italic">
                  Loading server-side gate evaluation...
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {secretGate.map((gate) => (
                    <div
                      key={gate.provider_id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <p className="text-lg font-semibold text-slate-900">
                          {gate.provider_id.toUpperCase()}
                        </p>
                        <Badge
                          className={
                            gate.configured
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          }
                        >
                          {gate.configured ? "Configured" : "Missing Config"}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-xs font-mono text-slate-700 mb-4">
                        <p>secret_values_exposed: {String(gate.secret_values_exposed)}</p>
                        <p>provider_api_called: {String(gate.provider_api_called)}</p>
                        <p>real_send_enabled: {String(gate.real_send_enabled)}</p>
                        <p>external_provider_calls_enabled: {String(gate.external_provider_calls_enabled)}</p>
                        <p>production_gate_required: {String(gate.production_gate_required)}</p>
                      </div>

                      {gate.missing_env_names.length > 0 && (
                        <div className="mt-auto pt-4 border-t border-slate-200">
                          <p className="mb-2 text-sm font-semibold text-red-700 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Missing Env Names
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {gate.missing_env_names.map((envName) => (
                              <Badge key={envName} variant="outline" className="font-mono text-[10px] text-red-600 border-red-300 bg-red-50">
                                {envName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {gate.configured && gate.checked_env_names.length > 0 && (
                        <div className="mt-auto pt-4 border-t border-slate-200">
                          <p className="mb-2 text-sm font-semibold text-emerald-700 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Checked Env Names
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {gate.checked_env_names.map((envName) => (
                              <Badge key={envName} variant="outline" className="font-mono text-[10px] text-emerald-600 border-emerald-300 bg-emerald-50">
                                {envName}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-700" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Controlled Sandbox Execution Design (M26)
                </h2>
              </div>
              
              <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  No sandbox or real provider execution is enabled in M26.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {executionPlan.map((plan) => (
                  <div
                    key={plan.provider_id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm flex flex-col"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <p className="text-lg font-semibold text-slate-900">
                        {plan.provider_id.toUpperCase()}
                      </p>
                      <Badge
                        className={
                          plan.current_execution_mode === "dry_run_only"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }
                      >
                        {plan.current_execution_mode}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs font-mono text-slate-700 mb-4 pb-4 border-b border-slate-200">
                      <p>Blocked Reason: <span className="font-semibold text-red-600">{plan.blocked_reason}</span></p>
                      <p>provider_api_called: {String(plan.provider_api_called)}</p>
                      <p>real_send_enabled: {String(plan.real_send_enabled)}</p>
                      <p>external_provider_calls_enabled: {String(plan.external_provider_calls_enabled)}</p>
                      <p>production_gate_open: {String(plan.production_gate_open)}</p>
                    </div>

                    <div className="mt-auto">
                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        Allowed Recipient Policy
                      </p>
                      <p className="text-xs text-slate-600 mb-4 border-l-2 border-slate-300 pl-2">
                        {plan.allowed_recipient_policy}
                      </p>

                      {plan.required_gates.length > 0 && (
                        <div className="mb-4">
                          <p className="mb-2 text-sm font-semibold text-amber-700 flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> Required Gates
                          </p>
                          <ul className="space-y-1">
                            {plan.required_gates.map((gate, idx) => (
                              <li key={idx} className="text-[10px] font-mono text-amber-900 bg-amber-50 p-1 rounded border border-amber-200">
                                {gate}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {plan.future_m27_requirements.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-semibold text-indigo-700 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> Future M27 Req
                          </p>
                          <ul className="space-y-1">
                            {plan.future_m27_requirements.map((req, idx) => (
                              <li key={idx} className="text-[10px] text-slate-600 italic">
                                - {req}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SafetyValue({ label, value }: { label: string; value: boolean | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-slate-900">{String(value)}</p>
    </div>
  );
}