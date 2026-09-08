-- Migration: Add extended fields to public.product_knowledge
-- Phase: v1.4.1T.8 — Extended Product Knowledge Fields & Backward Safety

alter table public.product_knowledge
  add column if not exists product_characteristics text,
  add column if not exists full_ingredients text,
  add column if not exists effects text,
  add column if not exists key_ingredients_functions jsonb not null default '[]'::jsonb,
  add column if not exists consultation_notes text;

notify pgrst, 'reload schema';
