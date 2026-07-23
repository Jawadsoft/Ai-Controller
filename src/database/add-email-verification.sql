-- Add email verification fields to users table
-- This migration adds fields needed for email verification functionality

-- Add verification token field
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE;

-- Add index for verification token lookup
CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(verification_token);

-- Add comment for documentation
COMMENT ON COLUMN users.verification_token IS 'Token used for email verification';
COMMENT ON COLUMN users.verification_token_expires IS 'Expiration time for verification token';

-- Update existing users to have email_verified = true (for backward compatibility)
UPDATE users SET email_verified = true WHERE email_verified IS NULL;

-- Ensure email_verified column exists and has default value
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;
