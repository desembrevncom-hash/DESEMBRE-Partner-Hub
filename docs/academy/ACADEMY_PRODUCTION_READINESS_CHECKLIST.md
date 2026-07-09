# Academy Production Readiness Checklist

This checklist tracks the external configurations and blockers that must be resolved before deploying Academy V1 to production.

## 1. Production Blockers

| Status | Item | Description |
|---|---|---|
| **BLOCKER** | Project Reference | Academy Production Supabase project ref is not confirmed. |
| **BLOCKER** | Zalo ZNS Credentials | Real Zalo ZNS credentials are not configured. |
| **BLOCKER** | Zalo ZNS Template | Zalo ZNS OTP template approval is not confirmed. |
| **BLOCKER** | SMS Hook Configuration | Supabase Auth Send SMS Hook is not configured for production. |
| **BLOCKER** | OTP Smoke Test | Real OTP smoke has not passed in a live environment. |
| **WARNING** | Provider Configuration | Phone Auth provider/rate limits/CAPTCHA are not confirmed. |
| **WARNING** | Backup Status | Production backup/PITR status is not confirmed. |
| **WARNING** | Domain Configuration | Production domain/Auth redirect URLs are not confirmed. |

## 2. Required Production Secrets

The following secrets must be securely provided to the production environment. **Never hardcode or log these values.**

- `SUPABASE_SMS_HOOK_SECRET`
- `ZALO_ZNS_ACCESS_TOKEN`
- `ZALO_ZNS_OTP_TEMPLATE_ID`
- `ZALO_ZNS_API_BASE_URL` *(optional)*
- Supabase anon key *(for frontend production env)*
- Supabase project URL *(for frontend production env)*

Edge Function Secret Requirements:
- `academy-admin-media-upload`: None (relies on Auth context)
- `academy-lesson-media`: None (relies on Auth context)
- `link-student-account`: None (relies on Auth context)
- `send-otp-zalo-zns`: `SUPABASE_SMS_HOOK_SECRET`, `ZALO_ZNS_ACCESS_TOKEN`, `ZALO_ZNS_OTP_TEMPLATE_ID`

## 3. Supabase Production Checklist

Do not assume Dashboard state. Verify each item manually against the exact production project reference.

- [ ] **Exact Project Ref Confirmed**: Verify organization and project name match production intent.
- [ ] **Migration Baseline**: Confirm `npx supabase migration list` returns expected remote history.
- [ ] **Database Dry-Run**: `npx supabase db push --dry-run --linked` succeeds with only expected pending migrations.
- [ ] **Auth Phone Enabled**: Phone provider is active.
- [ ] **Send SMS Hook Configured**: Custom SMS webhook URL matches the deployed `send-otp-zalo-zns` Edge Function.
- [ ] **Hook Secret**: `SUPABASE_SMS_HOOK_SECRET` matches between Supabase Auth settings and Edge Function secrets.
- [ ] **Rate Limits**: Supabase Auth rate limits are reviewed and adequate for launch volume.
- [ ] **CAPTCHA**: CAPTCHA status is reviewed and disabled for API-only OTP flows if applicable.
- [ ] **Redirect URLs**: Production domain and redirect URLs configured in Supabase Auth.
- [ ] **Site URL**: Site URL configured to production domain.
- [ ] **Templates Review**: Email/SMS templates reviewed.
- [ ] **Storage Verified**: `academy_content` bucket policies and limits verified.
- [ ] **RLS Verified**: RLS is strictly enabled on all tables (`courses`, `modules`, `lessons`, `student_accounts`, `lesson_progress`, `academy_enrollments`).
- [ ] **Edge Functions Deployed**: All Edge Functions are active and mapped.
- [ ] **Secrets Configured**: All Edge Function secrets are configured in production.
- [ ] **Logs Monitored**: Edge Function and Database logs are visible in the Dashboard.
