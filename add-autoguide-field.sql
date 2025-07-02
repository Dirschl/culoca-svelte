-- Add autoguide field to profiles table
ALTER TABLE profiles ADD COLUMN autoguide BOOLEAN DEFAULT FALSE; 