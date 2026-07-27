# Phase 6H.2C: Consent Capture Runbook

## Overview
This runbook guides Admins on how to safely capture and record email marketing consent for customers, establishing the **Source of Truth** in the `customer_consents` table. 

As part of Phase 6H.2C, the system enforce that a customer **cannot** be added to a Limited Pilot Audience unless they have a verifiable record in the `customer_consents` table. 

## 1. Consent Proof Requirements
A valid consent record MUST include:
- A recognized **source** (e.g., internal test account, written permission, or customer form).
- A descriptive **note** or reference providing context (e.g., "Confirmed via Zalo on YYYY-MM-DD").

## 2. What Counts as a Valid Source?
- **Internal Test Account:** For internal QA and staging. Use this ONLY for accounts owned by staff or explicitly designated as testers.
- **Written Permission:** Explicit consent obtained via email, Zalo, SMS, or written agreement.
- **Customer Form:** Standard opt-in via a public checkout or booking form (if integrated).

## 3. What NOT to do
- Do **NOT** manipulate the `customers.marketing_opt_in` flag via raw SQL. It is a secondary denormalized flag and will NOT bypass the new security filter.
- Do **NOT** insert fake consent records directly via SQL. 
- Do **NOT** capture consent for customers who are actively on the Suppression List for `unsubscribe` or `complaint` reasons (the system will block this).

## 4. How to Record Consent (UI Flow)
We have implemented a safe **Consent Capture UI** embedded directly within the Customer Detail page.

1. Navigate to the **Customer Detail Page** (`/customers/[id]`).
2. In the "Thông tin cơ bản" (Overview) tab, locate the **Email** field.
3. Click the **Record Marketing Consent** button next to their email.
4. Fill out the form:
   - Select the `Consent Source`.
   - Enter a `Note / Proof Reference`.
   - Type exactly `RECORD_EMAIL_MARKETING_CONSENT` to confirm.
5. Click **Xác nhận Ghi nhận Consent**.

The system will safely upsert the record into `customer_consents`, ensuring `is_opt_in = true` and `opt_out_at = null`, and then sync the legacy `marketing_opt_in` flag.

## 5. How to Verify with SQL
You can verify that your 5–10 candidates have successfully captured consent by running this safe `SELECT` query:

```sql
SELECT 
    c.id, 
    c.name, 
    c.email, 
    cc.source, 
    cc.note, 
    cc.opt_in_at
FROM public.customers c
INNER JOIN public.customer_consents cc ON c.id = cc.customer_id
WHERE cc.channel = 'email' 
  AND cc.is_opt_in = true 
  AND cc.opt_out_at IS NULL;
```
Ensure this returns between 5 and 10 rows before proceeding to the Limited Pilot phase.

## 6. Duplicate Diagnostic Query
If you encounter issues or need to verify if there are duplicate consent records for the same customer and channel, run this safe query:

```sql
SELECT 
  customer_id, 
  channel, 
  count(*) as consent_count
FROM public.customer_consents
GROUP BY customer_id, channel
HAVING count(*) > 1;
```
*Note: The `admin_record_email_marketing_consent` RPC uses an `UPDATE` then `INSERT` fallback rather than `ON CONFLICT` to safely bypass unique constraint errors while preserving `source` and `note`.*

## 7. How to Proceed to Prepare Limited Pilot Audience
Once you have captured consent for 5–10 valid customers:
1. Navigate to your approved **Campaign Detail Page**.
2. Use the **Limited Pilot Audience Preparation** section to search for and select these specific customers.
3. Because they now have valid records in `customer_consents`, the `Consent` badge will show **PASS**.
4. Generate the Pilot Segment and run the Dry-Run to verify.

## 8. Schema Architecture Note: Segments
For future reference, the system uses a dual-segment mapping architecture to satisfy legacy dependencies and the Edge Function:
- **`marketing_campaigns.segment_id`** is a Foreign Key pointing to `marketing_segments(id)`.
- **Edge Function (`process-marketing-campaign`)** reads mapping from `customer_segments_map`, which enforces a Foreign Key `segment_id` pointing to `customer_segments(id)`.
- Therefore, the RPC `admin_prepare_limited_pilot_audience` generates a single UUID and inserts it into BOTH `customer_segments` and `marketing_segments` before mapping customers in `customer_segments_map`.
