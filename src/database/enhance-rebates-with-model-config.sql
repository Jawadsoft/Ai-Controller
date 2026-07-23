-- =====================================================
-- Enhance Rebates with Model-Specific Configuration
-- =====================================================
-- Allows one rebate per make with different amounts per model
-- Version: 2.0

-- Add model-specific amounts field
ALTER TABLE rebates
  ADD COLUMN IF NOT EXISTS model_specific_amounts JSONB DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN rebates.model_specific_amounts IS 'JSONB object storing per-model rebate amounts. Example: {"Civic": {"amount": 2000, "enabled": true}, "Accord": {"amount": 2500, "enabled": true}}';

-- Drop the existing function first to avoid conflicts
DROP FUNCTION IF EXISTS apply_rebate_to_vehicles(UUID, UUID, UUID);

-- Update the apply_rebate_to_vehicles function to handle model-specific amounts
CREATE OR REPLACE FUNCTION apply_rebate_to_vehicles(
    p_rebate_id UUID,
    p_dealer_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    ret_vehicle_id UUID,
    ret_status TEXT,
    ret_amount NUMERIC,
    ret_model TEXT
) AS $$
DECLARE
    v_rebate RECORD;
    v_vehicle RECORD;
    v_calculated_amount NUMERIC;
    v_model_config JSONB;
    v_model_amount NUMERIC;
    v_model_enabled BOOLEAN;
BEGIN
    -- Get rebate details
    SELECT * INTO v_rebate
    FROM rebates
    WHERE id = p_rebate_id AND dealer_id = p_dealer_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rebate not found or not active';
    END IF;

    -- Loop through eligible vehicles
    FOR v_vehicle IN
        SELECT DISTINCT v.id, v.make, v.model, v.year, v.new_used, v.price
        FROM vehicles v
        WHERE v.dealer_id = p_dealer_id
        AND v.status = 'available'
        AND (v_rebate.eligible_makes IS NULL OR v.make = ANY(v_rebate.eligible_makes))
        AND (v_rebate.eligible_years IS NULL OR v.year = ANY(v_rebate.eligible_years))
        AND (v_rebate.min_price IS NULL OR v.price >= v_rebate.min_price)
        AND (v_rebate.max_price IS NULL OR v.price <= v_rebate.max_price)
        AND (v_rebate.eligible_vehicle_types IS NULL OR 
             (CASE WHEN v.new_used = 'N' THEN 'new'
                   WHEN v.new_used = 'U' THEN 'used'
                   ELSE v.new_used END) = ANY(v_rebate.eligible_vehicle_types))
    LOOP
        -- Check if model-specific amounts are configured
        IF v_rebate.model_specific_amounts IS NOT NULL AND 
           jsonb_typeof(v_rebate.model_specific_amounts) = 'object' AND
           v_rebate.model_specific_amounts ? v_vehicle.model THEN
            
            -- Get model-specific configuration
            v_model_config := v_rebate.model_specific_amounts -> v_vehicle.model;
            v_model_enabled := COALESCE((v_model_config->>'enabled')::boolean, false);
            
            -- Only proceed if model is enabled
            IF NOT v_model_enabled THEN
                CONTINUE;
            END IF;
            
            -- Get model-specific amount
            v_model_amount := COALESCE((v_model_config->>'amount')::numeric, 0);
            
            -- Use model-specific amount if configured
            IF v_rebate.amount_type = 'fixed' THEN
                v_calculated_amount := v_model_amount;
            ELSE
                v_calculated_amount := v_vehicle.price * (v_model_amount / 100);
            END IF;
        ELSE
            -- Use default rebate amount if no model-specific config
            IF v_rebate.amount_type = 'fixed' THEN
                v_calculated_amount := v_rebate.rebate_amount;
            ELSE
                v_calculated_amount := v_vehicle.price * (v_rebate.rebate_amount / 100);
            END IF;
        END IF;

        -- Check if already applied
        IF EXISTS (
            SELECT 1 FROM rebate_applications
            WHERE rebate_id = p_rebate_id
            AND vehicle_id = v_vehicle.id
            AND status = 'active'
        ) THEN
            ret_vehicle_id := v_vehicle.id;
            ret_status := 'already_applied';
            ret_amount := 0;
            ret_model := v_vehicle.model;
            RETURN NEXT;
            CONTINUE;
        END IF;

        -- Apply rebate to vehicle
        IF v_rebate.rebate_type = 'consumer' THEN
            UPDATE vehicles
            SET consumer_rebate = COALESCE(consumer_rebate, 0) + v_calculated_amount,
                total_customer_savings = COALESCE(total_customer_savings, 0) + v_calculated_amount,
                updated_at = NOW()
            WHERE id = v_vehicle.id;
        ELSIF v_rebate.rebate_type IN ('dealer', 'manufacturer') THEN
            UPDATE vehicles
            SET total_dealer_rebate = COALESCE(total_dealer_rebate, 0) + v_calculated_amount,
                updated_at = NOW()
            WHERE id = v_vehicle.id;
        END IF;

        -- Record application
        INSERT INTO rebate_applications (
            rebate_id, vehicle_id, dealer_id, applied_by, applied_amount, status
        ) VALUES (
            p_rebate_id, v_vehicle.id, p_dealer_id, p_user_id, v_calculated_amount, 'active'
        );

        -- Update rebate usage counter
        UPDATE rebates
        SET times_applied = times_applied + 1,
            updated_at = NOW()
        WHERE id = p_rebate_id;

        ret_vehicle_id := v_vehicle.id;
        ret_status := 'applied';
        ret_amount := v_calculated_amount;
        ret_model := v_vehicle.model;
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Success message
SELECT 'Enhanced rebates with model-specific configuration!' as message;

