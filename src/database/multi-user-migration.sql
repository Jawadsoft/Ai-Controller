-- =====================================================
-- Multi-User System Migration
-- =====================================================
-- This migration adds support for multiple users per dealership
-- Run this after the main schema migration

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Add new user roles for dealership staff
DO $$ 
BEGIN
    -- Add new enum values if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'dealer_admin' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'dealer_admin';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sales_agent' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'sales_agent';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'finance_manager' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'finance_manager';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'service_advisor' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'service_advisor';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'inventory_manager' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
        ALTER TYPE user_role ADD VALUE 'inventory_manager';
    END IF;
END $$;

-- 2. Create dealership staff table
CREATE TABLE IF NOT EXISTS dealership_staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    staff_role VARCHAR(50) NOT NULL CHECK (staff_role IN ('admin', 'sales', 'finance', 'service', 'inventory')),
    permissions TEXT[] DEFAULT '{}', -- Custom permissions array
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id), -- Who created this staff member
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one user can only be staff at one dealership
    UNIQUE(user_id),
    -- Ensure one admin per dealership (deferred constraint)
    CONSTRAINT unique_admin_per_dealer UNIQUE(dealer_id, staff_role) DEFERRABLE INITIALLY DEFERRED
);

-- 3. Create staff permissions table for granular control
CREATE TABLE IF NOT EXISTS staff_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    staff_id UUID NOT NULL REFERENCES dealership_staff(id) ON DELETE CASCADE,
    permission_name VARCHAR(100) NOT NULL,
    permission_value BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(staff_id, permission_name)
);

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_dealership_staff_dealer_id ON dealership_staff(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealership_staff_user_id ON dealership_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_dealership_staff_role ON dealership_staff(staff_role);
CREATE INDEX IF NOT EXISTS idx_dealership_staff_active ON dealership_staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff_id ON staff_permissions(staff_id);

-- 5. Create triggers for updated_at
CREATE TRIGGER update_dealership_staff_updated_at 
    BEFORE UPDATE ON dealership_staff
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_permissions_updated_at 
    BEFORE UPDATE ON staff_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Insert default permissions for each role
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('qr_code_generation'),
        ('lead_management'),
        ('vehicle_import'),
        ('analytics_dashboard'),
        ('bulk_actions'),
        ('staff_management'),
        ('user_management'),
        ('custom_branding'),
        ('api_access'),
        ('priority_support')
) AS permissions(permission_name)
WHERE ds.staff_role = 'admin'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- Insert sales agent permissions
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('qr_code_generation'),
        ('lead_management'),
        ('vehicle_import')
) AS permissions(permission_name)
WHERE ds.staff_role = 'sales'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- Insert finance manager permissions
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('lead_management'),
        ('analytics_dashboard')
) AS permissions(permission_name)
WHERE ds.staff_role = 'finance'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- Insert service advisor permissions
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('lead_management')
) AS permissions(permission_name)
WHERE ds.staff_role = 'service'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- Insert inventory manager permissions
INSERT INTO staff_permissions (staff_id, permission_name, permission_value) 
SELECT 
    ds.id,
    permission_name,
    true
FROM dealership_staff ds
CROSS JOIN (
    VALUES 
        ('vehicle_import'),
        ('qr_code_generation')
) AS permissions(permission_name)
WHERE ds.staff_role = 'inventory'
ON CONFLICT (staff_id, permission_name) DO NOTHING;

-- 7. Create a view for easy staff querying
CREATE OR REPLACE VIEW staff_with_details AS
SELECT 
    ds.*,
    u.email,
    u.name,
    u.created_at as user_created_at,
    creator.email as created_by_email,
    d.business_name as dealer_name
FROM dealership_staff ds
JOIN users u ON ds.user_id = u.id
LEFT JOIN users creator ON ds.created_by = creator.id
JOIN dealers d ON ds.dealer_id = d.id;

-- 8. Create function to get user's dealer access
CREATE OR REPLACE FUNCTION get_user_dealer_access(user_uuid UUID)
RETURNS TABLE(
    dealer_id UUID,
    business_name TEXT,
    staff_role VARCHAR(50),
    permissions TEXT[],
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.dealer_id,
        d.business_name,
        ds.staff_role,
        ds.permissions,
        ds.is_active
    FROM dealership_staff ds
    JOIN dealers d ON ds.dealer_id = d.id
    WHERE ds.user_id = user_uuid AND ds.is_active = true;
END;
$$ LANGUAGE plpgsql;

-- 9. Create function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(user_uuid UUID, permission_name_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    staff_role VARCHAR(50);
    has_permission BOOLEAN := false;
BEGIN
    -- Get user's role
    SELECT ur.role INTO user_role
    FROM user_roles ur
    WHERE ur.user_id = user_uuid;
    
    -- Super admin has all permissions
    IF user_role = 'super_admin' THEN
        RETURN true;
    END IF;
    
    -- Get staff role and check permissions
    SELECT ds.staff_role INTO staff_role
    FROM dealership_staff ds
    WHERE ds.user_id = user_uuid AND ds.is_active = true;
    
    -- Check if permission exists in staff permissions
    SELECT EXISTS(
        SELECT 1 FROM staff_permissions sp
        JOIN dealership_staff ds ON sp.staff_id = ds.id
        WHERE ds.user_id = user_uuid 
        AND sp.permission_name = permission_name_param 
        AND sp.permission_value = true
        AND ds.is_active = true
    ) INTO has_permission;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- 10. Add comments for documentation
COMMENT ON TABLE dealership_staff IS 'Manages staff members for each dealership with role-based access';
COMMENT ON TABLE staff_permissions IS 'Granular permissions for each staff member';
COMMENT ON VIEW staff_with_details IS 'Complete staff information with user and dealer details';
COMMENT ON FUNCTION get_user_dealer_access IS 'Returns dealer access information for a user';
COMMENT ON FUNCTION user_has_permission IS 'Checks if a user has a specific permission';

-- Migration completed
SELECT 'Multi-user migration completed successfully' as status;
