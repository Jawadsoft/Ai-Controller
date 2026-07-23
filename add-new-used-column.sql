-- Migration script to add new_used column to vehicles table
-- This column will store whether the vehicle is 'new' or 'used'

-- Add new_used column to vehicles table
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS new_used VARCHAR(10) DEFAULT 'used';

-- Add check constraint to ensure only 'new' or 'used' values
-- Note: PostgreSQL doesn't support IF NOT EXISTS for constraints in older versions
-- So we'll use DO block to handle this
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'vehicles_new_used_check'
    ) THEN
        ALTER TABLE vehicles ADD CONSTRAINT vehicles_new_used_check 
            CHECK (new_used IN ('new', 'used'));
    END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_vehicles_new_used ON vehicles(new_used);

-- Add comment for documentation
COMMENT ON COLUMN vehicles.new_used IS 'Whether the vehicle is new or used';

-- Update the existing view to include the new column
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
    v.new_used,
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

-- Update the CSV import function to include new_used parameter
CREATE OR REPLACE FUNCTION import_vehicle_from_csv(
    p_dealer_id UUID,
    p_vin TEXT,
    p_make TEXT,
    p_model TEXT,
    p_series TEXT DEFAULT NULL,
    p_stock_number TEXT DEFAULT NULL,
    p_new_used TEXT DEFAULT 'used',
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
            new_used = p_new_used,
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
            dealer_id, vin, make, model, series, stock_number, new_used, body_style, certified,
            color, interior_color, engine_type, displacement, features, odometer,
            price, other_price, transmission, msrp, dealer_discount, consumer_rebate,
            dealer_accessories, total_customer_savings, total_dealer_rebate,
            photo_url_list, year, import_source, import_date, reference_dealer_id
        ) VALUES (
            p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_new_used, p_body_style, p_certified,
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