-- Add import_config_id to vehicles table to track which import configuration imported each vehicle
ALTER TABLE vehicles 
ADD COLUMN IF NOT EXISTS import_config_id INTEGER REFERENCES import_configs(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_vehicles_import_config_id ON vehicles(import_config_id);

-- Add comment for documentation
COMMENT ON COLUMN vehicles.import_config_id IS 'Reference to the import configuration that imported this vehicle';
