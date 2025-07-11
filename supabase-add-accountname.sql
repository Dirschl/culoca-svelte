-- Add accountname field to profiles table for permalink functionality
-- Run this in Supabase SQL Editor

-- Add accountname column
ALTER TABLE profiles ADD COLUMN accountname TEXT;

-- Add unique constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_accountname_unique UNIQUE (accountname);

-- Add index for performance
CREATE INDEX profiles_accountname_idx ON profiles (accountname);

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'accountname'; 