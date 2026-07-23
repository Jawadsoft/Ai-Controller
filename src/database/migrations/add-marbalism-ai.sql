-- Migration: Add Marbalism AI support to dealers table
-- Run this once against your PostgreSQL database

ALTER TABLE dealers
  ADD COLUMN IF NOT EXISTS marbalism_ai_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS marbalism_ai_activated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS marbalism_ai_deactivated_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for fast feature-flag queries
CREATE INDEX IF NOT EXISTS idx_dealers_marbalism_ai_enabled 
  ON dealers (marbalism_ai_enabled) 
  WHERE marbalism_ai_enabled = TRUE;

COMMENT ON COLUMN dealers.marbalism_ai_enabled IS 'Whether this dealer has Marbalism AI activated. Dealers self-activate; super admins can deactivate.';
COMMENT ON COLUMN dealers.marbalism_ai_activated_at IS 'Timestamp when the dealer first activated Marbalism AI.';
COMMENT ON COLUMN dealers.marbalism_ai_deactivated_by IS 'UUID of the super-admin user who last deactivated Marbalism AI for this dealer.';
