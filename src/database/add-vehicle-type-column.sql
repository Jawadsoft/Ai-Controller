-- Migration: Add vehicle_type column to vehicles table
-- This adds a vehicle type field to categorize vehicles (SUV, Sedan, Truck, etc.)

-- Add vehicle_type column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

-- Create an index on vehicle_type for better query performance
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type ON vehicles(vehicle_type);

-- Add a comment to document the column
COMMENT ON COLUMN vehicles.vehicle_type IS 'Vehicle body type (e.g., SUV, Sedan, Truck, Hatchback, Coupe, Convertible, Wagon, Van, Minivan)';

-- Update existing vehicles with a default type based on make/model if possible
-- This is optional and can be run manually if needed
-- UPDATE vehicles SET vehicle_type = 'Sedan' WHERE vehicle_type IS NULL AND (make ILIKE '%toyota%' OR make ILIKE '%honda%' OR make ILIKE '%ford%');
