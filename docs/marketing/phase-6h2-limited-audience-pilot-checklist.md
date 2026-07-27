# Phase 6H.2 Limited Audience Pilot Checklist

This checklist must be strictly followed before, during, and after executing a limited production test campaign to a controlled subset of real users (5-10 users).

## Pre-Flight Checks
- [ ] **Campaign Approved**: The test campaign content and target audience have been explicitly approved by the project owner.
- [ ] **Dry-Run Pass**: Ensure the campaign successfully ran in dry-run mode (`MARKETING_PRODUCTION_SENDING_ENABLED=false`) and logs look correct.
- [ ] **Consent Checked**: Verify the audience selection logic respects `customer_consents.is_opt_in = true` and `opt_out_at IS NULL`.
- [ ] **Suppression Checked**: Verify the audience selection logic automatically excludes any emails present in `marketing_suppression_list` where `is_active = true`.
- [ ] **Unsubscribe Link Present**: Verify the email template correctly appends the generated unsubscribe URL link in the footer.
- [ ] **Resend Webhook Working**: Ensure the Resend webhook endpoint is live, verified, and functioning correctly to track bounces and complaints.

## Execution Rules
- [ ] **Batch Size Limit**: The campaign audience must be strictly limited to a batch size of **5 to 10** real users max.
- [ ] **Admin Typed CONFIRM**: The admin executing the payload must explicitly type "CONFIRM" (if applicable) or proceed with documented intent.
- [ ] **Enable Sending Temporarily**: Switch `MARKETING_PRODUCTION_SENDING_ENABLED=true` strictly for the duration of this pilot test.
- [ ] **Disable After Sending**: Immediately revert `MARKETING_PRODUCTION_SENDING_ENABLED=false` or pause sending logic once the pilot batch completes.

## Post-Flight
- [ ] **Verify Delivery**: Check `marketing_delivery_logs` to ensure statuses transitioned correctly.
- [ ] **Report After Pilot**: Create the Phase 6H.2 execution report detailing outcomes, any bounces, and any unsubscribe events. No bulk production marketing can start until the report is approved.
