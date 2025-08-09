-- =====================================================
-- COMPREHENSIVE USER ROLES INSERTION QUERIES
-- =====================================================
-- This file contains all types of queries for inserting user roles
-- into the user_roles table in PostgreSQL

-- =====================================================
-- 1. BASIC SINGLE USER ROLE INSERT
-- =====================================================
-- Insert a single user role (replace 'your-user-uuid-here' with actual UUID)
INSERT INTO user_roles (user_id, role) 
VALUES ('your-user-uuid-here', 'dealer');

-- =====================================================
-- 2. MULTIPLE USER ROLES INSERT (BULK INSERT)
-- =====================================================
-- Insert multiple user roles at once
INSERT INTO user_roles (user_id, role) 
VALUES 
    ('user-uuid-1', 'super_admin'),
    ('user-uuid-2', 'dealer'),
    ('user-uuid-3', 'client'),
    ('user-uuid-4', 'dealer'),
    ('user-uuid-5', 'super_admin');

-- =====================================================
-- 3. INSERT WITH CONFLICT HANDLING (UPSERT)
-- =====================================================
-- Insert with conflict handling - won't duplicate if user already has a role
-- Updates existing role if user already exists
INSERT INTO user_roles (user_id, role) 
VALUES ('your-user-uuid-here', 'dealer')
ON CONFLICT (user_id) DO UPDATE SET 
    role = EXCLUDED.role,
    updated_at = NOW();

-- =====================================================
-- 4. INSERT WITH DEFAULT VALUES
-- =====================================================
-- Insert using only user_id (role will default to 'dealer' as per schema)
INSERT INTO user_roles (user_id) 
VALUES ('your-user-uuid-here');

-- =====================================================
-- 5. INSERT WITH EXPLICIT TIMESTAMPS
-- =====================================================
-- Insert with custom timestamps (usually not needed due to defaults)
INSERT INTO user_roles (user_id, role, created_at, updated_at) 
VALUES ('your-user-uuid-here', 'super_admin', NOW(), NOW());

-- =====================================================
-- 6. INSERT FROM SELECT QUERY
-- =====================================================
-- Insert roles for all users who don't already have a role
INSERT INTO user_roles (user_id, role)
SELECT u.id, 'dealer' as role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL;

-- =====================================================
-- 7. CONDITIONAL INSERT BASED ON USER EMAIL
-- =====================================================
-- Insert role based on user email pattern
INSERT INTO user_roles (user_id, role)
SELECT u.id, 
    CASE 
        WHEN u.email LIKE '%admin%' THEN 'super_admin'
        WHEN u.email LIKE '%dealer%' THEN 'dealer'
        ELSE 'client'
    END as role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL;

-- =====================================================
-- 8. INSERT WITH ROLE VALIDATION
-- =====================================================
-- Insert with role validation (PostgreSQL will enforce enum values)
INSERT INTO user_roles (user_id, role) 
VALUES 
    ('user-uuid-1', 'super_admin'),
    ('user-uuid-2', 'dealer'),
    ('user-uuid-3', 'client')
-- Invalid role would cause error: ('user-uuid-4', 'invalid_role')
;

-- =====================================================
-- 9. INSERT WITH RETURNING CLAUSE
-- =====================================================
-- Insert and return the inserted data
INSERT INTO user_roles (user_id, role) 
VALUES ('your-user-uuid-here', 'dealer')
RETURNING id, user_id, role, created_at;

-- =====================================================
-- 10. COMPREHENSIVE EXAMPLE WITH ALL SCENARIOS
-- =====================================================
-- This example shows a complete workflow

-- First, let's create some example users (if they don't exist)
INSERT INTO users (email, password_hash) 
VALUES 
    ('admin@example.com', 'hashed_password_1'),
    ('dealer1@example.com', 'hashed_password_2'),
    ('dealer2@example.com', 'hashed_password_3'),
    ('client1@example.com', 'hashed_password_4')
ON CONFLICT (email) DO NOTHING;

-- Then insert roles for these users
INSERT INTO user_roles (user_id, role)
SELECT u.id, 
    CASE 
        WHEN u.email = 'admin@example.com' THEN 'super_admin'
        WHEN u.email LIKE 'dealer%' THEN 'dealer'
        WHEN u.email LIKE 'client%' THEN 'client'
        ELSE 'dealer' -- default fallback
    END as role
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL
ON CONFLICT (user_id) DO UPDATE SET 
    role = EXCLUDED.role,
    updated_at = NOW();

-- =====================================================
-- QUERIES TO VERIFY AND CHECK ROLES
-- =====================================================

-- Check all user roles
SELECT 
    u.email,
    ur.role,
    ur.created_at,
    ur.updated_at
FROM user_roles ur
JOIN users u ON ur.user_id = u.id
ORDER BY u.email;

-- Check roles by type
SELECT 
    role,
    COUNT(*) as user_count
FROM user_roles
GROUP BY role
ORDER BY user_count DESC;

-- Check users without roles
SELECT 
    u.id,
    u.email,
    u.created_at
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL;

-- =====================================================
-- AVAILABLE ROLE TYPES (from schema)
-- =====================================================
-- 'super_admin' - Super administrator
-- 'dealer'      - Dealer (default role)
-- 'client'      - Client

-- =====================================================
-- NOTES
-- =====================================================
-- 1. Replace 'your-user-uuid-here' with actual UUIDs
-- 2. The user_roles table automatically handles:
--    - UUID generation for the id field
--    - Timestamps (created_at and updated_at)
--    - Foreign key constraints to the users table
--    - Cascade deletion when a user is deleted
-- 3. Role enum values are enforced by PostgreSQL
-- 4. Use ON CONFLICT for upsert operations
-- 5. Use RETURNING clause to get inserted data 