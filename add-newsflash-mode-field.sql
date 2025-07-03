-- Add newsflash_mode field to profiles table
ALTER TABLE profiles 
ADD COLUMN newsflash_mode TEXT DEFAULT 'alle' CHECK (newsflash_mode IN ('aus', 'eigene', 'alle'));

-- Update existing profiles to have default value
UPDATE profiles SET newsflash_mode = 'alle' WHERE newsflash_mode IS NULL; 