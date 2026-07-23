-- Test the login query directly in your database (vehicle_management)
-- Replace 'your-email@example.com' with an actual email from your users table

-- First, check if tables exist
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles
UNION ALL
SELECT 'dealership_staff', COUNT(*) FROM dealership_staff
UNION ALL
SELECT 'dealers', COUNT(*) FROM dealers;

-- Test the actual login query (replace email with real email)
SELECT 
  u.id, 
  u.email, 
  u.password_hash, 
  ur.role, 
  COALESCE(d_staff.id, d_owner.id) AS dealer_id,
  COALESCE(d_staff.business_name, d_owner.business_name) AS business_name,
  COALESCE(d_staff.contact_name, d_owner.contact_name) AS contact_name,
  ds.id as staff_id,
  ds.staff_role,
  ds.permissions as staff_permissions,
  ds.is_active as staff_active
FROM users u 
LEFT JOIN user_roles ur ON u.id = ur.user_id 
LEFT JOIN dealership_staff ds ON u.id = ds.user_id
LEFT JOIN dealers d_staff ON ds.dealer_id = d_staff.id
LEFT JOIN dealers d_owner ON d_owner.user_id = u.id
WHERE u.email = 'your-email@example.com';  -- CHANGE THIS!

-- Check column types
SELECT 
  table_name,
  column_name,
  data_type,
  udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name IN ('users', 'user_roles', 'dealership_staff', 'dealers')
AND column_name IN ('id', 'email', 'password_hash', 'user_id', 'role', 'staff_role', 'permissions', 'is_active', 'dealer_id', 'business_name', 'contact_name')
ORDER BY table_name, ordinal_position;

