-- =====================================================
-- CLEANUP ORPHANED USERS
-- =====================================================
-- This script finds and deletes users that:
-- 1. Have no dealership_staff association
-- 2. Are not dealer owners
-- 3. Are not super admins
-- =====================================================

-- STEP 1: Review orphaned users (RUN THIS FIRST!)
-- =====================================================
SELECT 
  u.id,
  u.email,
  u.name,
  u.created_at,
  ur.role as system_role,
  'ORPHANED' as status
FROM users u
LEFT JOIN dealership_staff ds ON u.id = ds.user_id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN dealers d ON u.id = d.user_id
WHERE ds.id IS NULL  -- No dealership_staff association
  AND d.id IS NULL   -- Not a dealer owner
  AND (ur.role IS NULL OR ur.role != 'super_admin')  -- Not super admin
ORDER BY u.created_at DESC;

-- STEP 2: Count how many will be deleted
-- =====================================================
SELECT COUNT(*) as orphaned_user_count
FROM users u
LEFT JOIN dealership_staff ds ON u.id = ds.user_id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN dealers d ON u.id = d.user_id
WHERE ds.id IS NULL
  AND d.id IS NULL
  AND (ur.role IS NULL OR ur.role != 'super_admin');

-- STEP 3: Delete orphaned users (RUN CAREFULLY!)
-- =====================================================
-- IMPORTANT: Review the results from STEP 1 before running this!

BEGIN;

-- Delete from user_roles first
DELETE FROM user_roles
WHERE user_id IN (
  SELECT u.id
  FROM users u
  LEFT JOIN dealership_staff ds ON u.id = ds.user_id
  LEFT JOIN dealers d ON u.id = d.user_id
  LEFT JOIN user_roles ur ON u.id = ur.user_id
  WHERE ds.id IS NULL
    AND d.id IS NULL
    AND (ur.role IS NULL OR ur.role != 'super_admin')
);

-- Delete from users
DELETE FROM users
WHERE id IN (
  SELECT u.id
  FROM users u
  LEFT JOIN dealership_staff ds ON u.id = ds.user_id
  LEFT JOIN dealers d ON u.id = d.user_id
  LEFT JOIN user_roles ur ON u.id = ur.user_id
  WHERE ds.id IS NULL
    AND d.id IS NULL
    AND (ur.role IS NULL OR ur.role != 'super_admin')
);

-- If everything looks good, COMMIT. Otherwise, ROLLBACK.
COMMIT;
-- ROLLBACK;  -- Uncomment this line instead of COMMIT if you want to undo

-- STEP 4: Verify cleanup
-- =====================================================
-- Run STEP 1 query again - should return 0 rows
SELECT 
  u.id,
  u.email,
  u.name,
  u.created_at,
  ur.role as system_role,
  'ORPHANED' as status
FROM users u
LEFT JOIN dealership_staff ds ON u.id = ds.user_id
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN dealers d ON u.id = d.user_id
WHERE ds.id IS NULL
  AND d.id IS NULL
  AND (ur.role IS NULL OR ur.role != 'super_admin')
ORDER BY u.created_at DESC;

-- =====================================================
-- ALTERNATIVE: Delete a specific user
-- =====================================================
-- If you want to delete just one specific user:

-- DELETE FROM user_roles WHERE user_id = (SELECT id FROM users WHERE email = 'jawadsyed501@gmail.com');
-- DELETE FROM users WHERE email = 'jawadsyed501@gmail.com';

