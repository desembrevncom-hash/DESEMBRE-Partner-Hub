# M10C Webhook Receiver Runbook

This document describes how to smoke test the Webhook Receivers for Resend and Zalo on the Staging environment.

## 1. Webhook URLs (Staging)

- **Resend**: `https://wmhfvggbthyikqvlyqup.supabase.co/functions/v1/resend-webhook`
- **Zalo**: `https://wmhfvggbthyikqvlyqup.supabase.co/functions/v1/zalo-webhook`

## 2. Required Secrets in Staging

Ensure the following variables are configured in the Supabase Dashboard (`Project Settings` -> `Edge Functions`):

### General
- `SUPABASE_URL`: Your Supabase Staging URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin DB access (needed by receiver to insert `webhook_events`).

### Resend
- `RESEND_WEBHOOK_SECRET`: The webhook secret provided by Resend to verify signatures.

### Zalo
- `ZALO_APP_SECRET`: App secret used for Zalo ZCA/ZNS verification.
- `ZALO_OA_SECRET_KEY`: (Optional if same as App Secret) Used for OA webhook verification.

## 3. How to Run Smoke Tests (Local Machine -> Staging DB)

1. Make sure your local `.env.staging` has the following variables synchronized with Staging:
   ```env
   SUPABASE_URL=https://wmhfvggbthyikqvlyqup.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-staging-service-role-key
   RESEND_WEBHOOK_SECRET=your-resend-webhook-secret
   ZALO_APP_SECRET=your-zalo-app-secret
   ```
2. Run the smoke tests:
   ```bash
   # Run both
   npm run staging:smoke:m10c

   # Or run individually
   npm run staging:smoke:m10c:resend-receiver
   npm run staging:smoke:m10c:zalo-receiver
   ```
3. To inspect test data in the DB instead of cleaning it up, use `KEEP_QA_DATA=true`:
   ```bash
   KEEP_QA_DATA=true npm run staging:smoke:m10c
   ```

## 4. Provider Dashboard Setup Checklist

### Resend
1. Go to Resend Dashboard -> Webhooks.
2. Add Endpoint: `https://wmhfvggbthyikqvlyqup.supabase.co/functions/v1/resend-webhook`
3. Select events: `email.delivered`, `email.bounced`, `email.complained`.
4. Copy the Webhook Secret and set it as `RESEND_WEBHOOK_SECRET` in Supabase.

### Zalo (ZCA / ZNS)
1. Go to Zalo Cloud Account (ZCA) -> Webhooks.
2. Add Endpoint: `https://wmhfvggbthyikqvlyqup.supabase.co/functions/v1/zalo-webhook`
3. Select events (e.g., ZNS Delivery Status).
4. Copy the App Secret and set it as `ZALO_APP_SECRET` in Supabase.

## 5. Troubleshooting Common Errors

- **401 Unauthorized (`missing_signature_headers`, `invalid_signature`)**: 
  - Ensure the webhook provider is actually sending the signature headers (`svix-signature` for Resend, `X-ZECA-Signature` or `mac` for Zalo).
  - Verify that the `RESEND_WEBHOOK_SECRET` or `ZALO_APP_SECRET` in Supabase Edge Functions exactly matches the provider dashboard.
- **403 Forbidden**: Usually Supabase default API block. Check if Edge Function is deployed and accessible to `anon` or public, though webhooks often don't need auth except their own signature.
- **404 Not Found**: Edge function not deployed or URL typo.
- **200 OK but `worker_disabled`**: Set `RESEND_WEBHOOK_WORKER_ENABLED=true` (or Zalo) on Supabase.
- **Duplicate Ignored**: Webhook was retried by the provider but we safely `INSERT IGNORE` (caught Unique Violation) using the `dedupe_key`.
