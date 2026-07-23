-- Scope inventory reconciliation per import configuration (multi-FTP safe).
-- Vehicles imported from one FTP config must not mark another config's inventory as sold.

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS import_config_id INTEGER REFERENCES import_configs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vehicles_import_config_id ON vehicles(import_config_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_dealer_import_config_status
  ON vehicles(dealer_id, import_config_id, inventory_status);

-- Backfill: assign untagged (legacy) vehicles to the oldest import config per dealer.
-- Newer configs must not inherit historical inventory or they will mark it sold on first run.
UPDATE vehicles v
SET import_config_id = oldest.config_id,
    import_source = COALESCE(NULLIF(v.import_source, ''), oldest.config_name, 'csv'),
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (dealer_id)
    dealer_id,
    id AS config_id,
    config_name
  FROM import_configs
  ORDER BY dealer_id, id ASC
) oldest
WHERE v.dealer_id::text = oldest.dealer_id::text
  AND v.import_config_id IS NULL;

DROP FUNCTION IF EXISTS import_vehicle_from_csv CASCADE;

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
    p_price NUMERIC DEFAULT NULL,
    p_other_price NUMERIC DEFAULT NULL,
    p_transmission TEXT DEFAULT NULL,
    p_msrp NUMERIC DEFAULT NULL,
    p_dealer_discount NUMERIC DEFAULT NULL,
    p_consumer_rebate NUMERIC DEFAULT NULL,
    p_dealer_accessories NUMERIC DEFAULT NULL,
    p_total_customer_savings NUMERIC DEFAULT NULL,
    p_total_dealer_rebate NUMERIC DEFAULT NULL,
    p_photo_url_list TEXT DEFAULT NULL,
    p_year INTEGER DEFAULT NULL,
    p_reference_dealer_id TEXT DEFAULT NULL,
    p_inventory_status TEXT DEFAULT 'available',
    p_import_config_id INTEGER DEFAULT NULL,
    p_import_source TEXT DEFAULT 'csv'
) RETURNS UUID AS $$
DECLARE
    v_vehicle_id UUID;
    v_dealer_exists BOOLEAN;
    v_source TEXT;
BEGIN
    SELECT EXISTS(SELECT 1 FROM dealers WHERE id = p_dealer_id) INTO v_dealer_exists;
    IF NOT v_dealer_exists THEN
      RAISE EXCEPTION 'Dealer with ID % does not exist', p_dealer_id;
    END IF;

    v_source := COALESCE(NULLIF(TRIM(p_import_source), ''), 'csv');

    SELECT id INTO v_vehicle_id FROM vehicles WHERE vin = p_vin AND dealer_id = p_dealer_id;

    IF v_vehicle_id IS NOT NULL THEN
      UPDATE vehicles SET
        make = p_make,
        model = p_model,
        year = COALESCE(p_year, year),
        trim = COALESCE(p_series, trim),
        color = COALESCE(p_color, color),
        mileage = COALESCE(p_odometer, mileage),
        price = COALESCE(p_price, price),
        features = CASE WHEN p_features IS NOT NULL AND p_features != '' THEN string_to_array(trim(both '{}' from p_features), ',') ELSE features END,
        images = CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE images END,
        status = 'available',
        inventory_status = COALESCE(p_inventory_status, 'available'),
        stock_number = COALESCE(p_stock_number, stock_number),
        body_style = COALESCE(p_body_style, body_style),
        certified = COALESCE(p_certified, certified),
        interior_color = COALESCE(p_interior_color, interior_color),
        engine_type = COALESCE(p_engine_type, engine_type),
        displacement = COALESCE(p_displacement, displacement),
        transmission = COALESCE(p_transmission, transmission),
        msrp = COALESCE(p_msrp, msrp),
        dealer_discount = COALESCE(p_dealer_discount, dealer_discount),
        consumer_rebate = COALESCE(p_consumer_rebate, consumer_rebate),
        dealer_accessories = COALESCE(p_dealer_accessories, dealer_accessories),
        total_customer_savings = COALESCE(p_total_customer_savings, total_customer_savings),
        total_dealer_rebate = COALESCE(p_total_dealer_rebate, total_dealer_rebate),
        other_price = COALESCE(p_other_price, other_price),
        photo_url_list = CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE photo_url_list END,
        odometer = COALESCE(p_odometer, odometer),
        import_source = v_source,
        import_config_id = COALESCE(p_import_config_id, import_config_id),
        import_date = NOW(),
        reference_dealer_id = COALESCE(p_reference_dealer_id, reference_dealer_id),
        new_used = COALESCE(p_new_used, new_used),
        vehicle_type = COALESCE(p_vehicle_type, vehicle_type),
        updated_at = NOW()
      WHERE id = v_vehicle_id;
    ELSE
      INSERT INTO vehicles (
        dealer_id, vin, make, model, year, trim, color, mileage, price,
        features, images, status, inventory_status, stock_number, body_style, certified,
        interior_color, engine_type, displacement, transmission, msrp,
        dealer_discount, consumer_rebate, dealer_accessories,
        total_customer_savings, total_dealer_rebate, other_price,
        photo_url_list, odometer, import_source, import_config_id, import_date,
        reference_dealer_id, new_used, vehicle_type, created_at, updated_at
      ) VALUES (
        p_dealer_id, p_vin, p_make, p_model, p_year, p_series, p_color, p_odometer, p_price,
        CASE WHEN p_features IS NOT NULL AND p_features != '' THEN string_to_array(trim(both '{}' from p_features), ',') ELSE NULL END,
        CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE NULL END,
        'available', COALESCE(p_inventory_status, 'available'), p_stock_number, p_body_style, p_certified,
        p_interior_color, p_engine_type, p_displacement, p_transmission, p_msrp,
        p_dealer_discount, p_consumer_rebate, p_dealer_accessories,
        p_total_customer_savings, p_total_dealer_rebate, p_other_price,
        CASE WHEN p_photo_url_list IS NOT NULL AND p_photo_url_list != '' THEN string_to_array(trim(both '{}' from p_photo_url_list), ',') ELSE NULL END,
        p_odometer, v_source, p_import_config_id, NOW(),
        p_reference_dealer_id, p_new_used, p_vehicle_type, NOW(), NOW()
      ) RETURNING id INTO v_vehicle_id;
    END IF;

    RETURN v_vehicle_id;
END;
$$ LANGUAGE plpgsql;
