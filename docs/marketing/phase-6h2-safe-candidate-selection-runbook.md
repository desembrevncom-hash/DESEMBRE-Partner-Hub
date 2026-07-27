# Phase 6H.2: Safe Candidate Selection Runbook

## Overview
This runbook guides you through safely selecting 5–10 eligible customers for the Limited Audience Pilot without manipulating or forcing production records. 

Safety principle: We do NOT insert dummy data, fake consent, or modify `marketing_delivery_logs`. We must select real candidates who *already* meet all stringent security checks.

## Eligibility Checklist (Patched for 6H.2A)
A candidate must pass ALL of the following:
1. **Consent Proof (Source of Truth)**: Must have an explicit record in the `customer_consents` table with `is_opt_in = true`, `opt_out_at IS NULL`, and the matching `channel` (e.g., 'email'). The denormalized flag `customers.marketing_opt_in` is secondary and MUST NOT be false. Modifying `customers.marketing_opt_in` by hand will NOT bypass the filter.
2. **Not Suppressed**: Must NOT be present in `marketing_suppression_list` (active).
3. **No Prior Log**: Must NOT have a successful or queued record in `marketing_delivery_logs` for this specific `campaign_id`. Do NOT delete existing delivery logs.
4. **Valid Email**: Must have a valid string containing `@`.
5. **Audience Member**: Must be a member of the campaign's `segment_id` (via `customer_segments_map`) OR the campaign targets all users. Do not add customers to the segment if they lack consent proof.
6. **Campaign Status**: Campaign must be `approved` and have a `final_confirmed_at` timestamp.

## Step 1: Run Diagnostics
Execute the SQL in `docs/marketing/phase-6h2-eligible-audience-diagnostics.sql` (remember to replace `<CAMPAIGN_ID>`).
Check the `AUDIENCE FUNNEL STATISTICS` output:
- If `has_consent` is 0, no customers have opted in.
- If `has_duplicate_log` equals the total audience, all candidates have already received this campaign.

## Step 2: Prepare Limited Pilot Audience Tool (UI)
We have implemented a safe **"Limited Pilot Audience Preparation"** tool directly in the Campaign Detail UI.

**How to use it:**
1. Ensure the Campaign is `approved` and has been **Final Confirmed**.
2. Scroll down to the **Limited Pilot Audience Preparation** section.
3. Search for customers by email, name, or phone.
4. Click **Add**. The system will perform real-time eligibility checks (Consent, Suppression, Duplicates, Email).
5. Only if a customer passes ALL checks (All PASS badges), they will be added to the Candidate List.
6. Once you have selected between 1 and 10 valid candidates, click **Xác nhận tạo tệp Pilot**.
7. Type `PREPARE_LIMITED_PILOT_AUDIENCE` to confirm.
8. The system will safely generate a Static Segment, map your candidates to it, and update the campaign's `segment_id`.
*(No emails are sent during this preparation step).*

## Step 3: Run Dry-Run
Once you have prepared the 5-10 candidates (whether organically or via the proposed tool), execute a dry-run to verify:
```bash
curl -i -X POST https://xhfqjupiidexvlltstal.supabase.co/functions/v1/process-marketing-campaign \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "<CAMPAIGN_ID>",
    "provider_mode": "resend_limited_pilot",
    "confirm": "CONFIRM_LIMITED_PILOT",
    "dry_run": true
  }'
```
**Expected Outcome:** `eligible_count` must be exactly the number of your chosen candidates (between 5 and 10), and `step: "dry_run_success"`.

## Step 4: Real Send Consideration
Only after Step 3 succeeds with the exact 5-10 audience count (`eligible_count` is between 5 and 10), AND all of these customers have verifiable consent proof in `customer_consents`, you can proceed to a real send (Real pilot chỉ GO khi dry_run eligible_count từ 5–10 và tất cả có consent proof). Proceed by removing `"dry_run": true` and using the `resend_limited_pilot` provider mode.
