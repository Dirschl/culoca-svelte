-- Transfer items from wrong user ID to correct user ID
-- Run this in Supabase SQL Editor

-- Transfer items from problematic user to correct user
UPDATE items 
SET 
  user_id = '0ceb2320-0553-463b-971a-a0eef5ecdf09',
  profile_id = '0ceb2320-0553-463b-971a-a0eef5ecdf09'
WHERE 
  user_id = '7fbbc136-e2ce-4d45-8990-a16192e68a7e' 
  OR profile_id = '7fbbc136-e2ce-4d45-8990-a16192e68a7e';

-- Verify the transfer
SELECT 
  COUNT(*) as transferred_items,
  user_id,
  profile_id
FROM items 
WHERE 
  user_id = '0ceb2320-0553-463b-971a-a0eef5ecdf09' 
  OR profile_id = '0ceb2320-0553-463b-971a-a0eef5ecdf09'
GROUP BY user_id, profile_id;

-- Check if any items still have the wrong user ID
SELECT 
  COUNT(*) as remaining_wrong_items
FROM items 
WHERE 
  user_id = '7fbbc136-e2ce-4d45-8990-a16192e68a7e' 
  OR profile_id = '7fbbc136-e2ce-4d45-8990-a16192e68a7e';

-- Show sample of transferred items
SELECT 
  id,
  original_name,
  user_id,
  profile_id,
  created_at
FROM items 
WHERE user_id = '0ceb2320-0553-463b-971a-a0eef5ecdf09'
ORDER BY created_at DESC 
LIMIT 10; 