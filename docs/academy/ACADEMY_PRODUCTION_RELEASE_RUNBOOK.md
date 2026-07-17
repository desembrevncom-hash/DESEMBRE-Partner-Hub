# Academy Production Release Runbook

This runbook outlines the exact sequence for deploying Academy V1 to production.

> [!WARNING]
> Do NOT execute these commands until all blockers in `ACADEMY_PRODUCTION_READINESS_CHECKLIST.md` are resolved.
> Specifically, confirm the production Supabase project reference and ensure a database backup/PITR is active.

## 1. Database Release Plan

1. **Login**: Login with a production-authorized Supabase account.
   ```bash
   npx supabase login
   ```
2. **Link**: Confirm and link the project reference.
   ```bash
   npx supabase link --project-ref <PRODUCTION_PROJECT_REF>
   ```
3. **Backup Verification**: Verify PITR or a manual backup exists before proceeding. Do NOT assume PITR exists unless explicitly verified in the Dashboard.
4. **Migration List**: Check remote state.
   ```bash
   npx supabase migration list
   ```
5. **Dry-Run**: Preview pending migrations.
   ```bash
   npx supabase db push --dry-run --linked
   ```
6. **Verify Pending Migrations**: Ensure only the expected Academy runtime migrations are listed.
7. **Deploy**:
   ```bash
   npx supabase db push --linked
   ```
8. **Verify Post-Deploy**:
   ```bash
   npx supabase migration list
   ```
9. **Database Smoke Test**: Perform a quick query or RPC test.

### Stop Conditions (Abort deployment if any occur)
- Wrong project reference is linked.
- Unexpected or unauthorized pending migrations appear in the dry-run.
- 403 Forbidden permission error.
- Destructive schema diff that would drop critical CRM data.
- Missing active backup/PITR.
- Unknown production reference.

## 2. Edge Function Release Plan

Deploy the required Academy Edge Functions.

### Functions to Deploy

1. `academy-admin-media-upload`
2. `academy-lesson-media`
3. `link-student-account`
4. `send-otp-zalo-zns`

### Deploy Command

Run the deployment for each function:

```bash
npx supabase functions deploy academy-admin-media-upload --project-ref <PRODUCTION_PROJECT_REF>
npx supabase functions deploy academy-lesson-media --project-ref <PRODUCTION_PROJECT_REF>
npx supabase functions deploy link-student-account --project-ref <PRODUCTION_PROJECT_REF>
npx supabase functions deploy send-otp-zalo-zns --project-ref <PRODUCTION_PROJECT_REF> --no-verify-jwt
```

> [!IMPORTANT]
> `send-otp-zalo-zns` uses `verify_jwt=false` (`--no-verify-jwt`) because it is invoked securely by the Supabase Auth Custom SMS Webhook using `ACADEMY_SMS_HOOK_SECRET`, not a standard user JWT.

### Required Secrets Deployment

```bash
npx supabase secrets set --project-ref <PRODUCTION_PROJECT_REF> ACADEMY_SMS_HOOK_SECRET=value
npx supabase secrets set --project-ref <PRODUCTION_PROJECT_REF> ZALO_ZNS_ACCESS_TOKEN=value
npx supabase secrets set --project-ref <PRODUCTION_PROJECT_REF> ZALO_ZNS_OTP_TEMPLATE_ID=value
```

### Rollback Action
- If an Edge Function breaks, revert the deployment by deploying the previous git commit for the function, or disable the integration in the Supabase Dashboard.

## 3. Frontend Release Plan

### Preparation
1. Confirm production Supabase URL (`VITE_SUPABASE_URL`).
2. Confirm production Supabase anon key (`VITE_SUPABASE_ANON_KEY`).
3. Confirm Auth redirect URLs (`VITE_AUTH_REDIRECT_URL`).

### Pre-Deployment Validation (Read-only repository)
```bash
cd "F:\Downloads\DESEMBRE-Workspace\Desembre Academy"
bun test
npx tsc --noEmit
bun run build
```

### Deployment
- Deploy via the existing Vercel/Cloudflare/hosting pipeline.

### Post-Deployment Smoke Routes
Verify these routes load successfully without crashing:
- `/auth/phone`
- `/auth/verify-otp`
- `/pending-review`
- `/blocked`
- `/student`
- `/admin/courses`

## 4. Rollback & Incident Plan

If a critical issue occurs during or after deployment, execute the following actions based on the failure mode:

| Failure Mode | Immediate Action |
|---|---|
| **Failed migration before apply** | Abort `db push`. Do not retry until root cause is fixed. |
| **Failed migration during transaction** | Database rolls back automatically. Inspect logs. Do not bypass. |
| **Bad RPC behavior after deploy** | Restore database from PITR to the pre-deployment timestamp. |
| **Edge Function broken** | Redeploy previous known-good Edge Function commit. |
| **Frontend broken** | Revert frontend deploy in the hosting dashboard (e.g., rollback deployment). |
| **OTP delivery failure / Zalo Outage** | Disable Send SMS Hook fallback in Supabase Auth to fallback to default/alternative provider. |
| **Accidental wrong project attempt** | Unlink immediately (`npx supabase unlink`). Change credentials. |

### Incident Owner
The deployment executor is the incident communication owner and must notify stakeholders immediately if a rollback is triggered.
