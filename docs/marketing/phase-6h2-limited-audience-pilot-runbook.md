# Phase 6H.2 Limited Audience Pilot Runbook

## Overview
This runbook defines the exact manual steps to execute a controlled, limited marketing pilot to a real customer audience (max 5-10 recipients).

## Pre-conditions
- Target campaign must have `approval_status = 'approved'`.
- `MARKETING_PRODUCTION_SENDING_ENABLED` must be set to `true`.
- The audience must explicitly have `customer_consents.is_opt_in = true`.
- Audience must not exist in `marketing_suppression_list` with `is_active = true`.

## Execution Steps

### 1. Identify 5-10 Opt-in Customers
Run the provided SQL (in `phase-6h2-limited-pilot-sql-checks.sql`) to find 5-10 real customers who have opted in. Note their customer IDs.

### 2. Map Customers to Campaign Segment
If the campaign relies on a segment, ensure those 5-10 customer IDs are mapped in `customer_segments_map` for the target `segment_id`.

### 3. Dry-Run Verification
Before enabling production, run the campaign process with:
- `MARKETING_PRODUCTION_SENDING_ENABLED = false` or `MARKETING_PROVIDER_MODE = mock`
- Verify the mock delivery logs reflect the expected 5-10 recipients.

### 4. Enable Production (Temporary)
Update Supabase Edge Function Secrets:
```bash
npx supabase secrets set MARKETING_PRODUCTION_SENDING_ENABLED=true
npx supabase secrets set MARKETING_PROVIDER_MODE=resend_limited_pilot
```
*(Note: Requires code update to support `resend_limited_pilot` mode first. See Blockers.)*

### 5. Execute the Small Batch
Trước tiên, deploy hàm với project-ref đúng của Partner Hub:
```bash
npx supabase functions deploy process-marketing-campaign --project-ref xhfqjupiidexvlltstal --no-verify-jwt
```

Bạn có thể kích hoạt Dry-run qua API POST với URL chính xác:
```bash
curl -i -X POST https://xhfqjupiidexvlltstal.supabase.co/functions/v1/process-marketing-campaign \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "<CAMPAIGN_ID>",
    "confirm": "CONFIRM_LIMITED_PILOT",
    "dry_run": true
  }'
```
Nếu muốn gửi thật (tối đa 10 người), hãy bỏ dòng `"dry_run": true` đi.

### 6. Immediate Rollback / Pause
Immediately after the request returns success:
```bash
npx supabase secrets set MARKETING_PRODUCTION_SENDING_ENABLED=false
npx supabase secrets set MARKETING_PROVIDER_MODE=mock
```

## Monitoring & Post-Pilot
- Check `marketing_delivery_logs` to confirm statuses changed to `sent`.
- Check `webhook_events` to confirm delivery receipts from Resend.
- Check `marketing_suppression_list` for any opt-outs resulting from this pilot.

## Go/No-Go Criteria for Phase 6H.3 (Bulk Production)
- **GO**: 100% of the pilot batch was delivered successfully, webhooks processed without errors, and any unsubscribes were handled cleanly.
- **NO-GO**: Bounces exceed 10%, webhooks fail to process, or unsubscribe logic fails.
