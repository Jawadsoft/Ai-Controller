-- Migration: Create dealer_knowledge_base table
-- Description: Stores scraped information from dealership websites for enhanced AI context

-- Create dealer_knowledge_base table
CREATE TABLE IF NOT EXISTS dealer_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL, -- 'about', 'services', 'hours', 'promotions', 'team', 'programs'
  data_key VARCHAR(100) NOT NULL,
  data_value TEXT,
  scraped_at TIMESTAMP DEFAULT NOW(),
  source_url TEXT,
  confidence_score DECIMAL(3,2) DEFAULT 0.80, -- 0.00 to 1.00
  is_verified BOOLEAN DEFAULT false, -- Manual verification flag
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dealer_knowledge_dealer ON dealer_knowledge_base(dealer_id);
CREATE INDEX IF NOT EXISTS idx_dealer_knowledge_category ON dealer_knowledge_base(dealer_id, category);
CREATE INDEX IF NOT EXISTS idx_dealer_knowledge_updated ON dealer_knowledge_base(updated_at);

-- Create unique constraint to prevent duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_dealer_knowledge_unique 
ON dealer_knowledge_base(dealer_id, category, data_key);

-- Add comment
COMMENT ON TABLE dealer_knowledge_base IS 'Stores scraped information from dealership websites to enhance AI responses';

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dealer_knowledge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_dealer_knowledge_updated_at
  BEFORE UPDATE ON dealer_knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION update_dealer_knowledge_updated_at();

-- Create view for easy querying
CREATE OR REPLACE VIEW dealer_knowledge_summary AS
SELECT 
  d.id as dealer_id,
  d.business_name,
  d.website,
  COUNT(dk.id) as total_knowledge_entries,
  COUNT(DISTINCT dk.category) as categories_count,
  MAX(dk.scraped_at) as last_scraped_at,
  COUNT(CASE WHEN dk.is_verified = true THEN 1 END) as verified_entries
FROM dealers d
LEFT JOIN dealer_knowledge_base dk ON d.id = dk.dealer_id
GROUP BY d.id, d.business_name, d.website;

COMMENT ON VIEW dealer_knowledge_summary IS 'Summary of scraped knowledge by dealer';

-- Insert sample data for testing (optional)
-- This can be removed in production
INSERT INTO dealer_knowledge_base (dealer_id, category, data_key, data_value, is_verified) 
SELECT 
  id,
  'about',
  'description',
  'Sample dealership with years of experience serving the community.',
  true
FROM dealers 
WHERE website IS NOT NULL 
LIMIT 1
ON CONFLICT (dealer_id, category, data_key) DO NOTHING;
