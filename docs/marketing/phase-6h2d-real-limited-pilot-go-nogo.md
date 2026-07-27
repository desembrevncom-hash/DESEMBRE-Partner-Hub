# Phase 6H.2D: Real Limited Pilot Go/No-Go Runbook

This document is the **Final Operational Go/No-Go Runbook** for executing the 5-recipient Real Limited Pilot.

> [!CAUTION]
> **BULK MARKETING REMAINS STRICTLY NO-GO.**
> This runbook and the procedures within it are explicitly authorized **ONLY** for the 5-recipient limited pilot test segment. Any attempt to send bulk emails is currently forbidden and blocked by system safety guards.

## 1. Current Verified Status (PASS Evidence)

All preliminary and safety checks have been successfully cleared:

- [x] **Consent Capture**: `PASS` (customer_consents has valid email opt-in proof for the 5 selected recipients)
- [x] **Prepare Limited Pilot Audience**: `PASS` (campaign audience_count = 5)
- [x] **Segment Mapping**: `PASS` (customer_segments_map mapped_customers = 5, segment exists in both `customer_segments` and `marketing_segments`)
- [x] **Edge Function Dry-Run**: `PASS` (raw_audience_count = 5, static_audience_count = 5, eligible_count = 5)
- [x] **Safety Exclusion Counts**: `PASS` (suppressed: 0, consent_blocked: 0, consent_missing: 0, duplicate_blocked: 0, invalid_contact: 0, blocked_or_inactive: 0)
- [x] **Idempotency Proof**: `PASS` (marketing_delivery_logs created after dry-run = 0)
- [x] **No Ghost Emails**: `PASS` (No email sent during testing phases)

## 2. Pre-send Checklist

Before issuing the final `GO` command, verify the following:

| Mục | Check ở đâu | Ghi chú |
| :--- | :--- | :--- |
| 1. Campaign content / subject / from đúng | Local UI + Production DB | Local UI được, miễn là đang trỏ tới project `xhfq...` |
| 2. Unsubscribe link có trong email | Preview/Test email hoặc function render email | Nên xem preview/live hoặc gửi test nội bộ trước, không dùng khách thật |
| 3. 5 recipients đúng người/đã consent | Production Supabase SQL | Đây là source of truth |
| 4. Resend webhook đang bật | Resend Dashboard + Production `webhook_events` | Không check ở local |
| 5. Suppression list sạch | Production Supabase SQL | Source of truth |
| 6. `MARKETING_PRODUCTION_SENDING_ENABLED` bật tạm thời | Supabase Dashboard → Edge Function Secrets project `xhfq...` | Không phải `.env.local` |
| 7. Gửi xong tắt lại false | Supabase Dashboard → Edge Function Secrets project `xhfq...` | Tắt ngay sau khi function trả kết quả |

## 3. SQL Verification Queries

Run the following queries in the **Production Supabase SQL Editor** (Project `xhfq...`) to confirm the exact DB state prior to sending.

**1. Check Campaign status/content cơ bản**
```sql
select
  id,
  name,
  status,
  approval_status,
  final_confirmed_at,
  channel,
  audience_count,
  segment_id,
  updated_at
from public.marketing_campaigns
where id = '240009e1-48e9-4be8-9bef-d8d28f413990';
```
*Cần thấy: `approval_status = approved`, `final_confirmed_at not null`, `channel = email`, `audience_count = 5`, `segment_id not null`.*

**2. Check 5 recipients đã map**
```sql
select
  count(*) as mapped_customers
from public.customer_segments_map
where segment_id = (
  select segment_id
  from public.marketing_campaigns
  where id = '240009e1-48e9-4be8-9bef-d8d28f413990'
);
```
*Cần thấy: `mapped_customers = 5`.*

**3. Check consent proof 5 người**
```sql
select
  left(c.email, 2) || '***@' || split_part(c.email, '@', 2) as masked_email,
  cc.channel,
  cc.is_opt_in,
  cc.source,
  cc.opt_in_at,
  cc.opt_out_at
from public.marketing_campaigns mc
join public.customer_segments_map csm on csm.segment_id = mc.segment_id
join public.customers c on c.id = csm.customer_id
join public.customer_consents cc on cc.customer_id = c.id
where mc.id = '240009e1-48e9-4be8-9bef-d8d28f413990'
  and cc.channel = 'email'
  and cc.is_opt_in = true
  and cc.opt_out_at is null;
```
*Cần thấy: Trả về đúng 5 rows.*

**4. Check suppression sạch**
```sql
select
  count(*) as suppressed_recipients
from public.marketing_campaigns mc
join public.customer_segments_map csm on csm.segment_id = mc.segment_id
join public.customers c on c.id = csm.customer_id
join public.marketing_suppression_list msl
  on lower(msl.normalized_contact_value) = lower(trim(c.email))
where mc.id = '240009e1-48e9-4be8-9bef-d8d28f413990'
  and msl.is_active = true;
```
*Cần thấy: `suppressed_recipients = 0`.*

**5. Check chưa có delivery logs**
```sql
select
  count(*) as existing_delivery_logs
from public.marketing_delivery_logs
where campaign_id = '240009e1-48e9-4be8-9bef-d8d28f413990';
```
*Cần thấy: `existing_delivery_logs = 0`.*

## 4. Exact Dry-Run Command

Perform a final dry-run to ensure the Edge Function still validates the audience perfectly.

**Step 4.1: Get Admin JWT**
To execute these commands safely, you must provide an `ADMIN_JWT_ACCESS_TOKEN` belonging to an Admin user.
1. Open Partner Hub in your browser and log in with an Admin account.
2. Open Developer Tools (F12) -> Application -> Local Storage.
3. Find your Supabase auth token and copy the `access_token` value.
4. In your PowerShell terminal, set it as a variable:
```powershell
$AdminJwt = "eyJhb..."
```

**Step 4.2: Create `dry-run-body.json`**
Create a file named `dry-run-body.json` in your working directory:
```json
{
  "campaign_id": "240009e1-48e9-4be8-9bef-d8d28f413990",
  "provider_mode": "resend_limited_pilot",
  "confirm": "CONFIRM_LIMITED_PILOT",
  "dry_run": true
}
```

**Step 4.3: Execute Dry-Run via PowerShell**
```powershell
Invoke-RestMethod -Uri "https://xhfqjupiidexvlltstal.supabase.co/functions/v1/process-marketing-campaign" `
  -Method Post `
  -Headers @{
      "Authorization" = "Bearer $AdminJwt"
      "Content-Type"  = "application/json"
  } `
  -InFile .\dry-run-body.json
```
*Expected Output: `eligible_count: 5` and all other blocked/excluded counts must be `0`.*

## 5. Execution Environment Variable

The safety kill switch must be temporarily lifted.

1. Go to **Supabase Dashboard** -> **Settings** -> **Edge Functions** -> **Secrets**.
2. Set `MARKETING_PRODUCTION_SENDING_ENABLED` to `true`.

## 6. Exact Real Send Command

> [!WARNING]
> **DO NOT RUN UNTIL FINAL GO DECISION IS MADE.**
> Running this command with `MARKETING_PRODUCTION_SENDING_ENABLED=true` will execute live sends via Resend and consume real email quota.

**Step 6.1: Create `real-send-body.json`**
Create a file named `real-send-body.json` in your working directory:
```json
{
  "campaign_id": "240009e1-48e9-4be8-9bef-d8d28f413990",
  "provider_mode": "resend_limited_pilot",
  "confirm": "CONFIRM_LIMITED_PILOT",
  "dry_run": false
}
```

**Step 6.2: Execute Real Send via PowerShell**
```powershell
Invoke-RestMethod -Uri "https://xhfqjupiidexvlltstal.supabase.co/functions/v1/process-marketing-campaign" `
  -Method Post `
  -Headers @{
      "Authorization" = "Bearer $AdminJwt"
      "Content-Type"  = "application/json"
  } `
  -InFile .\real-send-body.json
```

## 7. Immediate Rollback

Immediately after the script returns a success response for the 5 emails, **re-engage the safety lock**.

1. Go to **Supabase Dashboard** -> **Settings** -> **Edge Functions** -> **Secrets**.
2. Set `MARKETING_PRODUCTION_SENDING_ENABLED` to `false`.

## 8. Post-Send Monitoring

Monitor the following components to track the real-world flow of the limited pilot.

- **Delivery Logs**: Check `marketing_delivery_logs`. The 5 rows should progress from `sent` -> `delivered`.
  ```sql
  SELECT status, count(*) FROM public.marketing_delivery_logs 
  WHERE campaign_id = '240009e1-48e9-4be8-9bef-d8d28f413990' 
  GROUP BY status;
  ```
- **Webhook Events**: Verify that `webhook_events` is logging incoming payloads from Resend.
- **Suppression/Bounces**: Check `marketing_suppression_list` if any of the 5 emails bounced or filed complaints.
- **Unsubscribes**: Check if `customer_consents` updates `opt_out_at` correctly if a recipient clicks Unsubscribe.

## 9. Go/No-Go Decision Matrix

| Condition | Assessment | Action |
| :--- | :--- | :--- |
| Any Pre-send checklist item fails | NO-GO | Stop execution. Resolve the failing check. |
| Dry-run shows `eligible_count` != 5 | NO-GO | Stop execution. Investigate mapping or consent loss. |
| Dry-run shows `suppressed` > 0 | NO-GO | Ensure suppression list is clean or swap recipient. |
| `marketing_delivery_logs` > 0 | NO-GO | Idempotency risk. Do not send duplicate emails. |
| **All Checks PASS & Metrics verified** | **GO** | Set kill switch, execute send, lock kill switch immediately. |
