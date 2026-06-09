# Production Promotion Checklist — DESEMBRE Partner Hub OS

> **This document is the operator runbook for every Production release.**
> Follow every step in order. Do not skip sections. Do not automate DB migrations.

---

## Phase 1 — Pre-Promotion Gate

### 1.1 Confirm Staging UAT Passed

- [ ] Feature branch Vercel Preview tested by at least 1 operator
- [ ] Admin / Sub-admin flow verified on Staging
- [ ] Sale / Telesale view-only flow verified on Staging
- [ ] All `npm run test` — 217 tests pass on release branch
- [ ] `npm run build` — clean build on release branch
- [ ] `npm run staging:preflight` — passes on release branch

### 1.2 Run Release Readiness Check

```bash
git checkout release/vX.X.X-your-feature
npm run release:check
```

Expected output: `✅ RELEASE READY`

### 1.3 Run Production Readiness Check (READ-ONLY)

```bash
npm run prod:readiness
```

Expected output:
- Branch: `release/**` or `master`
- Env target: Production (`xhfqjupiidexvlltstal`)
- Pending migrations listed
- `READ-ONLY CHECK ONLY. This script does not deploy, migrate, or touch Production.`

---

## Phase 2 — Production DB Preparation

> **WARNING: All DB migrations must be applied manually via Supabase Dashboard SQL Editor.
> Never use `supabase db push` targeting Production without explicit approval.**

### 2.1 Take a Production DB Backup

In Supabase Dashboard → Project `xhfqjupiidexvlltstal` → Database → Backups:
- [ ] Confirm latest automatic backup is recent (< 24h)
- [ ] Trigger a manual snapshot if last backup is older than 12h

### 2.2 Run Pre-Check SQL

Open the release's `production_db_migration_pack_final.md` and run **Section A — Pre-Check SQL** in Supabase SQL Editor.

Document the results here before proceeding:

| Check | Result |
|-------|--------|
| Required tables exist | |
| Helper functions exist | |
| New columns already exist? | |
| RPC already exists? | |

### 2.3 Apply Migration Blocks (Manual, In Order)

Run each block separately. Wait for `Success` before proceeding to the next.

| Block | Content | Status |
|-------|---------|--------|
| Block 1 | Document Templates Table & Seeds | ⬜ |
| Block 2 | Product Sales Sheets Table | ⬜ |
| Block 3 | Add Versioning & is_current | ⬜ |
| Block 4 | RPC + NOTIFY pgrst | ⬜ |

### 2.4 Run Post-Check SQL

Run **Section C — Post-Check SQL** from the migration pack. All checks must pass:

- [ ] Required tables exist
- [ ] `version` and `is_current` columns exist
- [ ] Unique index `uidx_*` present with `IS NOT NULL` clause
- [ ] RPC `set_current_product_sales_sheet` exists
- [ ] Zero products with more than one `is_current = true` sheet
- [ ] 4 default templates exist with `html_length > 0`

---

## Phase 3 — Code Promotion

### 3.1 Create Release Branch (if not already created)

```bash
git checkout master
git pull origin master
git checkout -b release/vX.X.X-your-feature
git merge feature/your-feature
npm run build     # must pass
npm run test      # must pass
git push -u origin release/vX.X.X-your-feature
```

### 3.2 Merge Release Branch into master

```bash
git checkout master
git pull origin master
git merge --no-ff release/vX.X.X-your-feature -m "release(vX.X.X): description"
git push origin master
```

Vercel will automatically deploy Production from `master`.

### 3.3 Confirm Vercel Deployment

- [ ] Go to Vercel Dashboard → Project → Deployments → Production
- [ ] Wait for status: **Ready**
- [ ] Note the deployment URL and commit SHA

---

## Phase 4 — Production Smoke Test

### 4.1 Admin / Sub-admin

- [ ] Login at `https://hub.desembre-vn.com` as Admin/Sub-admin
- [ ] Open `/admin/products`
- [ ] Open ProductSalesSheetDialog from a product row
- [ ] Confirm approved template list loads
- [ ] Confirm `product_sales_sheet_premium_v1` exists in template list
- [ ] Save a version (status = approved)
- [ ] Click "Đặt mặc định" → confirm RPC call succeeds (no error toast)
- [ ] Reload page → confirm current version persists
- [ ] Confirm catalog badge reflects current sheet
- [ ] Confirm A4 preview renders correctly
- [ ] Confirm "In / Xuất PDF" opens browser print dialog

### 4.2 Sale / Telesale

- [ ] Login as Sale/Telesale user
- [ ] Open `/admin/products`
- [ ] Open Product Sales Sheet from a product row
- [ ] Confirm: **only view-only A4 popup appears**
- [ ] Confirm: no editor panel visible
- [ ] Confirm: no template selector
- [ ] Confirm: no "Tạo bằng AI", "Lưu", "Đặt mặc định" buttons
- [ ] Confirm: footer only shows "In / Xuất PDF" and "Đóng"
- [ ] Confirm print works

---

## Phase 5 — Rollback Plan

### Frontend Rollback (instant)

In Vercel Dashboard → Deployments → find the previous Production deployment → click **"Promote to Production"**.

### DB Rollback

All schema changes in v1.4.1 are **additive** — tables, columns, and indexes can remain safely.

If only the RPC is causing issues:
```sql
DROP FUNCTION IF EXISTS public.set_current_product_sales_sheet(uuid);
NOTIFY pgrst, 'reload schema';
```

The `version` and `is_current` columns and indexes can remain — they are non-breaking additions.

---

## Sign-off

| Role | Name | Confirmed |
|------|------|-----------|
| Operator | | ⬜ |
| Tech Lead | | ⬜ |

**Release version:** ___________
**Deploy date/time:** ___________
**Vercel deployment SHA:** ___________
