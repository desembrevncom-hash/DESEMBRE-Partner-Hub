# Design System Guidelines (CRM)

This document defines the standard design tokens and shared components for the CRM, ensuring consistency, maintainability, and a premium mobile-first experience.

## 1. Typography Tokens

Do NOT use custom font sizes or weights. Use the following standards:

- **Page Title:** `text-2xl md:text-3xl font-black tracking-tight text-slate-950`
- **Page Subtitle:** `text-xs md:text-sm font-bold uppercase tracking-[0.18em] text-slate-400`
- **Section Title:** `text-sm font-black uppercase tracking-wider text-slate-900`
- **Card Title:** `text-sm md:text-base font-bold text-slate-900`
- **Body Text:** `text-sm font-medium text-slate-700`
- **Caption:** `text-xs font-medium text-slate-500`
- **Mini Label / Badge:** `text-[10px] font-black uppercase tracking-widest`
- **KPI Number:** `text-3xl font-black text-slate-900`

> **Note:** Do NOT abuse `text-[10px]`. It should only be used for mini labels or badges. Readable body text must be `text-xs` or `text-sm` minimum.

## 2. Spacing Tokens

Use consistent spacing for margins and paddings:

- **Page Padding:**
  - Mobile: `px-4 py-4` or `px-4 py-6`
  - Desktop: `px-6 lg:px-8 py-6`
- **Section Gap:** `gap-4 md:gap-6` (or `gap-6 md:gap-8` for major sections)
- **Grid Gap:** `gap-4 md:gap-6`
- **Card Padding:** `p-4 md:p-6`
- **Form Gap:** `gap-4`
- **Button Gap:** `gap-2` or `gap-3`

## 3. Shape & Elevation (Card Tokens)

Do NOT randomly use `rounded-lg` or `shadow-lg` for standard cards.

- **Main Card / Section Card:** `rounded-3xl border border-slate-200/70 bg-white shadow-sm`
- **Inner Card / Widget:** `rounded-2xl border border-slate-100 bg-slate-50/70`
- **Compact Row / Table Item:** `rounded-xl border border-slate-100`

## 4. Badge System (`CRMStatusBadge`)

Supported variants in `CRMStatusBadge`:

- **success:** `emerald` (e.g. Completed, Active)
- **warning:** `amber` (e.g. Pending, Review)
- **danger:** `rose/red` (e.g. Cancelled, Failed, Overdue)
- **info:** `blue` (e.g. Processing, Info)
- **neutral:** `slate` (e.g. Draft, Inactive)
- **premium:** `purple/indigo` (e.g. VIP, Special)

## 5. Shared Components Reference

When building new UI or migrating old UI, ALWAYS prefer these shared components in `src/components/crm/`:

- **CRMPageContainer:** Wrapper for the whole page (handles standard page padding).
- **CRMPageHeader:** Standard page title and subtitle block.
- **CRMSection:** Wrapper for logical page sections (handles section gap).
- **CRMCard:** Standard card wrapper (`variant="main"` or `variant="inner"` or `variant="compact"`).
- **CRMStatusBadge:** Replaces custom colored badges.
- **CRMEmptyState:** Standard UI for empty lists/data.
- **CRMLoadingState:** Standard UI for skeleton loading.
- **CRMTableWrapper:** Wraps `<table>` to ensure `overflow-x-auto` safety on mobile.
- **CRMStickyActionFooter:** Bottom sticky footer for mobile-safe primary actions.

**Do NOT hardcode new styles if a shared component already exists.**
