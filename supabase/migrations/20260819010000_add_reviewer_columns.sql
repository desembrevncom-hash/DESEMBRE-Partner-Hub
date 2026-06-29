-- Add missing reviewer tracking columns for manual identity resolution
ALTER TABLE public.facebook_identity_resolution_jobs
ADD COLUMN IF NOT EXISTS reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS reviewer_note text;
