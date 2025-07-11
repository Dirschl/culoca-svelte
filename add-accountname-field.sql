-- Add accountname field to profiles table for permalink functionality
-- This field will be used for clean URLs like /user/johndoe

-- Add the accountname column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS accountname TEXT;

-- Add unique constraint (will be ignored if already exists)
ALTER TABLE profiles 
ADD CONSTRAINT profiles_accountname_key UNIQUE (accountname);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_accountname ON profiles(accountname);

-- Check the result
SELECT id, full_name, accountname FROM profiles LIMIT 10; 