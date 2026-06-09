## Scope

**What changed and why:**

<!-- Describe the feature/fix/change and its business reason -->

**Related task/ticket:**

<!-- e.g. T.5 — RPC set_current_product_sales_sheet -->

---

## Safety Checklist

> Complete every item before requesting review.

- [ ] I did **not** touch the Production database (`xhfqjupiidexvlltstal`)
- [ ] I did **not** merge into `master` manually
- [ ] I did **not** push any secrets, passwords, or API keys
- [ ] I did **not** enable real Marketing / Zalo / Email sending
- [ ] I did **not** change the Product-to-order flow (unless this PR explicitly covers it)
- [ ] `.env`, `.env.local`, `.env.production` are **not** committed

---

## Verification Checklist

- [ ] `npm run test` — all tests pass locally
- [ ] `npm run build` — clean build with no errors
- [ ] `npm run staging:preflight` — passes on this branch
- [ ] Deployed and tested on **Staging / Vercel Preview** before requesting merge
- [ ] If DB schema changed → Staging migration applied and verified

---

## Production Impact

| Item | Answer |
|------|--------|
| DB migration required? | Yes / No |
| Edge Function deploy required? | Yes / No |
| New environment variables required? | Yes / No |
| Rollback plan | Vercel rollback / `DROP FUNCTION IF EXISTS ...` / N/A |

**If DB migration required**, list the migration files:
<!-- - supabase/migrations/YYYYMMDD_xxxxx.sql -->

---

## Screenshots / Evidence

<!-- Add Staging preview screenshots, test output, or smoke test results here -->
