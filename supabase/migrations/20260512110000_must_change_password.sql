-- Add must_change_password column to profiles table

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Update existing trigger to default must_change_password to true for non-admin signups if needed,
-- or allow Edge Function to manage it via UPDATE.
