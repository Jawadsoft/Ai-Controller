-- Fix the import_vehicle_from_csv function
-- This script will drop all existing functions and create the correct one

-- First, drop all existing functions with this name
DROP FUNCTION IF EXISTS import_vehicle_from_csv CASCADE;

-- Now create the correct function with 28 parameters
CREATE OR REPLACE FUNCTION import_vehicle_from_csv(
    p_dealer_id UUID,
    p_vin TEXT,
    p_make TEXT,
    p_model TEXT,
    p_series TEXT DEFAULT NULL,
    p_stock_number TEXT DEFAULT NULL,
    p_new_used TEXT DEFAULT 'used',
    p_body_style TEXT DEFAULT NULL,
    p_vehicle_type TEXT DEFAULT NULL,
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
            make = COALESCE(p_make, make),
            model = COALESCE(p_model, model),
            series = COALESCE(p_series, series),
            stock_number = COALESCE(p_stock_number, stock_number),
            new_used = COALESCE(p_new_used, new_used),
            body_style = COALESCE(p_body_style, body_style),
            vehicle_type = COALESCE(p_vehicle_type, vehicle_type),
            certified = COALESCE(p_certified, certified),
            color = COALESCE(p_color, color),
            interior_color = COALESCE(p_interior_color, interior_color),
            engine_type = COALESCE(p_engine_type, engine_type),
            displacement = COALESCE(p_displacement, displacement),
            features = CASE WHEN p_features IS NOT NULL THEN string_to_array(p_features, ',') ELSE features END,
            odometer = COALESCE(p_odometer, odometer),
            price = COALESCE(p_price, price),
            other_price = COALESCE(p_other_price, other_price),
            transmission = COALESCE(p_transmission, transmission),
            msrp = COALESCE(p_msrp, msrp),
            dealer_discount = COALESCE(p_dealer_discount, dealer_discount),
            consumer_rebate = COALESCE(p_consumer_rebate, consumer_rebate),
            dealer_accessories = COALESCE(p_dealer_accessories, dealer_accessories),
            total_customer_savings = COALESCE(p_total_customer_savings, total_customer_savings),
            total_dealer_rebate = COALESCE(p_total_dealer_rebate, total_dealer_rebate),
            photo_url_list = COALESCE(v_photo_urls, photo_url_list),
            year = COALESCE(p_year, year),
            reference_dealer_id = COALESCE(p_reference_dealer_id, reference_dealer_id),
            updated_at = NOW()
        WHERE id = v_vehicle_id;
    ELSE
        -- Insert new vehicle
        INSERT INTO vehicles (
            dealer_id, vin, make, model, series, stock_number, new_used, body_style, vehicle_type, certified,
            color, interior_color, engine_type, displacement, features, odometer,
            price, other_price, transmission, msrp, dealer_discount, consumer_rebate,
            dealer_accessories, total_customer_savings, total_dealer_rebate,
            photo_url_list, year, import_source, import_date, reference_dealer_id
        ) VALUES (
            p_dealer_id, p_vin, p_make, p_model, p_series, p_stock_number, p_new_used, p_body_style, p_vehicle_type, p_certified,
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

-- Verify the function was created correctly
SELECT 
    proname,
    pronargs,
    proargnames
FROM pg_proc 
WHERE proname = 'import_vehicle_from_csv';
