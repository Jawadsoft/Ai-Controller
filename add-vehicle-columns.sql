-- Migration script to add columns for CSV import
-- Based on the CSV structure: Make, Model, Series, New/Used Stock #, Autowriter Body, Certified, Color, Interior, Engine, Disp, Features, Odometer, Price, Other Price, Photo Url List, Transmissi, Vehicle De MSRP, Dealer Dis, Consumer, Dlr Access, Total Cust, Total Dealer Rebate

-- Add new columns to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS series TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS stock_number TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS body_style TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS certified BOOLEAN DEFAULT false;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS interior_color TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS engine_type TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS displacement TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS transmission TEXT;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS msrp DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS dealer_discount DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS consumer_rebate DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS dealer_accessories DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS total_customer_savings DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS total_dealer_rebate DECIMAL(10,2);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS other_price DECIMAL(10,2);
-- Add photo_url_list column as TEXT array
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_url_list TEXT[];
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS import_source TEXT DEFAULT 'manual';
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS import_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS reference_dealer_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vehicles_stock_number ON vehicles(stock_number);
CREATE INDEX IF NOT EXISTS idx_vehicles_series ON vehicles(series);
CREATE INDEX IF NOT EXISTS idx_vehicles_body_style ON vehicles(body_style);
CREATE INDEX IF NOT EXISTS idx_vehicles_certified ON vehicles(certified);
CREATE INDEX IF NOT EXISTS idx_vehicles_transmission ON vehicles(transmission);
CREATE INDEX IF NOT EXISTS idx_vehicles_import_source ON vehicles(import_source);
CREATE INDEX IF NOT EXISTS idx_vehicles_import_date ON vehicles(import_date);
CREATE INDEX IF NOT EXISTS idx_vehicles_reference_dealer_id ON vehicles(reference_dealer_id);

-- Add comments for documentation
COMMENT ON COLUMN vehicles.series IS 'Vehicle series (e.g., Grand Touring)';
COMMENT ON COLUMN vehicles.stock_number IS 'Dealer stock number (e.g., H0102718)';
COMMENT ON COLUMN vehicles.body_style IS 'Vehicle body style (e.g., 2D Convertible)';
COMMENT ON COLUMN vehicles.certified IS 'Whether the vehicle is certified';
COMMENT ON COLUMN vehicles.interior_color IS 'Interior color (e.g., Auburn)';
COMMENT ON COLUMN vehicles.engine_type IS 'Engine type (e.g., I4)';
COMMENT ON COLUMN vehicles.displacement IS 'Engine displacement (e.g., R)';
COMMENT ON COLUMN vehicles.transmission IS 'Transmission type (e.g., 6-Speed Manual)';
COMMENT ON COLUMN vehicles.msrp IS 'Manufacturer suggested retail price';
COMMENT ON COLUMN vehicles.dealer_discount IS 'Dealer discount amount';
COMMENT ON COLUMN vehicles.consumer_rebate IS 'Consumer rebate amount';
COMMENT ON COLUMN vehicles.dealer_accessories IS 'Dealer accessories cost';
COMMENT ON COLUMN vehicles.total_customer_savings IS 'Total customer savings';
COMMENT ON COLUMN vehicles.total_dealer_rebate IS 'Total dealer rebate';
COMMENT ON COLUMN vehicles.other_price IS 'Alternative price';
COMMENT ON COLUMN vehicles.photo_url_list IS 'Comma-separated list of photo URLs';
COMMENT ON COLUMN vehicles.odometer IS 'Vehicle mileage';
COMMENT ON COLUMN vehicles.import_source IS 'Source of import (manual, csv, api, etc.)';
COMMENT ON COLUMN vehicles.import_date IS 'Date when vehicle was imported';
COMMENT ON COLUMN vehicles.reference_dealer_id IS 'Original dealer ID from CSV file (for reference)';

-- Update the updated_at trigger to include new columns
-- (The existing trigger will automatically handle the new columns)

-- Create a view for easy CSV export
CREATE OR REPLACE VIEW vehicle_export_view AS
SELECT 
    v.id,
    v.vin,
    v.make,
    v.model,
    v.series,
    v.year,
    v.trim,
    v.stock_number,
    v.body_style,
    v.certified,
    v.color,
    v.interior_color,
    v.engine_type,
    v.displacement,
    v.transmission,
    v.odometer,
    v.price,
    v.other_price,
    v.msrp,
    v.dealer_discount,
    v.consumer_rebate,
    v.dealer_accessories,
    v.total_customer_savings,
    v.total_dealer_rebate,
    v.photo_url_list,
    v.features,
    v.status,
    v.import_source,
    v.import_date,
    d.business_name as dealer_name
FROM vehicles v
LEFT JOIN dealers d ON v.dealer_id = d.id;

-- Create a function to handle CSV import
CREATE OR REPLACE FUNCTION import_vehicle_from_csv(
    p_dealer_id UUID,
    p_vin TEXT,
    p_make TEXT,
    p_model TEXT,
    p_series TEXT DEFAULT NULL,
    p_stock_number TEXT DEFAULT NULL,
    p_body_style TEXT DEFAULT NULL,
    p_certified BOOLEAN DEFAULT false,
    p_color TEXT DEFAULT NULL,
    p_interior_color TEXT DEFAULT NULL,
    p_engine_type TEXT DEFAULT NULL,
    p_displacement TEXT DEFAULT NULL,
    p_features TEXT DEFAULT NULL,
    p_odometer INTEGER DEFAULT NULL,
    p_price DECIMAL DEFAULT NULL,
    p_other_price DECIMAL DEFAULT NULL,
    p_transmission TEXT DEFAULT NULL,
    p_msrp DECIMAL DEFAULT NULL,
    p_dealer_discount DECIMAL DEFAULT NULL,
    p_consumer_rebate DECIMAL DEFAULT NULL,
    p_dealer_accessories DECIMAL DEFAULT NULL,
    p_total_customer_savings DECIMAL DEFAULT NULL,
    p_total_dealer_rebate DECIMAL DEFAULT NULL,
    p_photo_url_list TEXT DEFAULT NULL,
    p_year INTEGER DEFAULT NULL,
    p_reference_dealer_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_vehicle_id UUID;
    v_photo_urls TEXT[];
BEGIN
    -- Convert photo_url_list from formatted string to array
    IF p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN
        -- Remove curly brackets and split by comma
        v_photo_urls := string_to_array(
            trim(both '{}' from p_photo_url_list), 
            ','
        );
        -- Trim whitespace from each URL
        SELECT array_agg(trim(url)) INTO v_photo_urls 
        FROM unnest(v_photo_urls) AS url 
        WHERE trim(url) != '';
    ELSE
        v_photo_urls := NULL;
    END IF;

    -- Check if vehicle already exists by VIN
    SELECT id INTO v_vehicle_id
    FROM vehicles 
    WHERE vin = p_vin AND dealer_id = p_dealer_id;
    
    IF v_vehicle_id IS NOT NULL THEN
        -- Update existing vehicle
        UPDATE vehicles SET
            make = p_make,
            model = p_model,
            series = p_series,
            stock_number = p_stock_number,
            body_style = p_body_style,
            certified = p_certified,
            color = p_color,
            interior_color = p_interior_color,
            engine_type = p_engine_type,
            displacement = p_displacement,
            features = CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE features END,
            odometer = p_odometer,
            price = p_price,
            other_price = p_other_price,
            transmission = p_transmission,
            msrp = p_msrp,
            dealer_discount = p_dealer_discount,
            consumer_rebate = p_consumer_rebate,
            dealer_accessories = p_dealer_accessories,
            total_customer_savings = p_total_customer_savings,
            total_dealer_rebate = p_total_dealer_rebate,
            photo_url_list = v_photo_urls,
            year = p_year,
            reference_dealer_id = p_reference_dealer_id,
            updated_at = NOW()
        WHERE id = v_vehicle_id;
    ELSE
        -- Insert new vehicle
        INSERT INTO vehicles (
            dealer_id, vin, make, model, series, stock_number, body_style, certified,
            color, interior_color, engine_type, displacement, features, odometer,
            price, other_price, transmission, msrp, dealer_discount, consumer_rebate,
            dealer_accessories, total_customer_savings, total_dealer_rebate,
            photo_url_list, year, import_source, import_date, reference_dealer_id
        ) VALUES (
            p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_body_style, p_certified,
            p_color, p_interior_color, p_engine_type, p_displacement, 
            CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE NULL END,
            p_odometer, p_price, p_other_price, p_transmission, p_msrp, p_dealer_discount,
            p_consumer_rebate, p_dealer_accessories, p_total_customer_savings, p_total_dealer_rebate,
            v_photo_urls, p_year, 'csv', NOW(), p_reference_dealer_id
        ) RETURNING id INTO v_vehicle_id;
    END IF;
    
    RETURN v_vehicle_id;
END;
$$ LANGUAGE plpgsql; 