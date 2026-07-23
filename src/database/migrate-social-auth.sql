-- Migration to add social authentication fields to users table

-- Add social authentication columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS facebook_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS github_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

-- Create indexes for social authentication
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);

-- Update existing users to have email_verified = true if they have a password_hash
UPDATE users SET email_verified = true WHERE password_hash IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.google_id IS 'Google OAuth ID for social authentication';
COMMENT ON COLUMN users.facebook_id IS 'Facebook OAuth ID for social authentication';
COMMENT ON COLUMN users.github_id IS 'GitHub OAuth ID for social authentication';
COMMENT ON COLUMN users.email_verified IS 'Whether the user email has been verified'; 