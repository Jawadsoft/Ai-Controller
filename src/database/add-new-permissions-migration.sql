-- =====================================================
-- Add New Permissions Migration
-- =====================================================
-- This migration adds new permissions for Finance, Rebates, 
-- Daive Settings, Follow-up Settings, and Customer Management
-- Run this migration after deploying the new code
-- =====================================================

-- Add new permissions for ADMIN role
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('finance_management'),
        ('rebate_management'),
        ('daive_settings_management'),
        ('followup_settings_management'),
        ('customer_management')
) AS permissions(permission_name)
WHERE ds.staff_role = 'admin'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- Add new permissions for SALES role
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('rebate_management'),
        ('followup_settings_management'),
        ('customer_management')
) AS permissions(permission_name)
WHERE ds.staff_role = 'sales'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- Add new permissions for FINANCE role
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('finance_management'),
        ('rebate_management'),
        ('customer_management')
) AS permissions(permission_name)
WHERE ds.staff_role = 'finance'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- Add new permissions for SERVICE role
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('followup_settings_management'),
        ('customer_management')
) AS permissions(permission_name)
WHERE ds.staff_role = 'service'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- INVENTORY role doesn't get any new permissions (stays the same)

-- Verify the migration
SELECT 
    ds.staff_role,
    COUNT(DISTINCT sp.permission_name) as permission_count,
    ARRAY_AGG(DISTINCT sp.permission_name ORDER BY sp.permission_name) as permissions
FROM dealership_staff ds
LEFT JOIN staff_permissions sp ON ds.id = sp.staff_id
WHERE sp.permission_value = true
GROUP BY ds.staff_role
ORDER BY ds.staff_role;

-- Show count of new permissions added
SELECT 
    'New Permissions Added' as status,
    COUNT(*) as total_permissions_added
FROM staff_permissions
WHERE permission_name IN (
    'finance_management',
    'rebate_management',
    'daive_settings_management',
    'followup_settings_management',
    'customer_management'
);

-- Migration completed
SELECT 'New permissions migration completed successfully' as status;

