-- Add provider_secret to store App Passwords or API Keys for personal accounts
ALTER TABLE public.user_communication_accounts 
ADD COLUMN IF NOT EXISTS provider_secret text;

-- Update schema cache
NOTIFY pgrst, 'reload schema';
