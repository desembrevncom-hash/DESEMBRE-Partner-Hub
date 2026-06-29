export interface GateContext {
  supabaseUrl: string;
  isSandboxModeEnabled: boolean;
  resendApiKey: string | undefined;
  resendFromEmail: string | undefined;
  resendAllowlist: string | undefined;
  userRole: string | undefined;
  job: any;
}

export interface GateResult {
  allowed: boolean;
  code?: string;
  message?: string;
  httpStatus?: number;
}

export function evaluateSandboxGates(ctx: GateContext): GateResult {
  // 1. Hard block Production ref, require Staging ref
  const isProduction = ctx.supabaseUrl.includes("xhfqjupiidexvlltstal");
  const isStaging = ctx.supabaseUrl.includes("wmhfvggbthyikqvlyqup");

  if (isProduction || !isStaging) {
    return {
      allowed: false,
      code: "invalid_environment",
      message: "Staging Sandbox Execution is strictly prohibited in this environment.",
      httpStatus: 403,
    };
  }

  // 2. Sandbox mode gate
  if (!ctx.isSandboxModeEnabled) {
    return {
      allowed: false,
      code: "sandbox_disabled",
      message: "Sandbox mode is not enabled in environment.",
      httpStatus: 403,
    };
  }

  // 3. Secret gates
  if (!ctx.resendApiKey || !ctx.resendFromEmail || !ctx.resendAllowlist) {
    return {
      allowed: false,
      code: "missing_secrets",
      message: "Provider secrets or allowlist not configured.",
      httpStatus: 400,
    };
  }

  // 4. Admin Role gate
  if (ctx.userRole !== "admin" && ctx.userRole !== "sub_admin") {
    return {
      allowed: false,
      code: "forbidden",
      message: "Forbidden: Admin role required.",
      httpStatus: 403,
    };
  }

  // 5. Job checks
  if (!ctx.job) {
    return {
      allowed: false,
      code: "job_not_found",
      message: "Job not found.",
      httpStatus: 404,
    };
  }

  if (!ctx.job.approved_by) {
    return {
      allowed: false,
      code: "not_approved",
      message: "Job must be approved by admin before sandbox execution.",
      httpStatus: 400,
    };
  }

  if (ctx.job.channel !== "email") {
    return {
      allowed: false,
      code: "channel_blocked",
      message: "Only email channel is supported in Sandbox. Zalo is blocked.",
      httpStatus: 400,
    };
  }

  if (ctx.job.provider !== "resend" && ctx.job.provider !== "mock") {
    return {
      allowed: false,
      code: "invalid_provider",
      message: "Provider must be resend or mock.",
      httpStatus: 400,
    };
  }

  if (!ctx.job.recipient_email) {
    return {
      allowed: false,
      code: "missing_recipient",
      message: "Job recipient_email is missing.",
      httpStatus: 400,
    };
  }

  // 6. Allowlist check
  const allowedEmails = ctx.resendAllowlist.split(",").map((e: string) => e.trim().toLowerCase());
  if (!allowedEmails.includes(ctx.job.recipient_email.toLowerCase())) {
    return {
      allowed: false,
      code: "recipient_not_allowlisted",
      message: "Recipient is not in the sandbox allowlist.",
      httpStatus: 403,
    };
  }

  // 7. Idempotency gate
  if (ctx.job.status === "sent") {
    return {
      allowed: false,
      code: "already_sent",
      message: "Job is already sent.",
      httpStatus: 200, // Returning success but not executing
    };
  }

  return { allowed: true };
}
