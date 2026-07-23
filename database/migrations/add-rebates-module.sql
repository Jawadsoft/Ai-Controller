-- =====================================================
-- REBATES MODULE MIGRATION
-- Vehicle Rebate Management System for USA Dealerships
-- =====================================================

-- Create rebates table
CREATE TABLE IF NOT EXISTS rebates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    
    -- Rebate Details
    rebate_name TEXT NOT NULL,
    rebate_code TEXT,
    description TEXT,
    rebate_type TEXT NOT NULL CHECK (rebate_type IN ('consumer', 'dealer', 'manufacturer', 'promotional')),
    
    -- Financial Details
    rebate_amount NUMERIC(10,2) NOT NULL,
    amount_type TEXT DEFAULT 'fixed' CHECK (amount_type IN ('fixed', 'percentage')),
    
    -- Eligibility Criteria
    eligible_makes TEXT[],  -- NULL means all makes
    eligible_models TEXT[], -- NULL means all models
    eligible_years INTEGER[], -- NULL means all years
    eligible_trims TEXT[], -- NULL means all trims
    eligible_body_styles TEXT[], -- NULL means all body styles
    eligible_vehicle_types TEXT[], -- e.g., ['new', 'used', 'certified']
    min_price NUMERIC(10,2),
    max_price NUMERIC(10,2),
    
    -- Geographic Restrictions
    eligible_states TEXT[], -- e.g., ['CA', 'TX', 'NY'] - NULL means all states
    
    -- Validity Period
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Status and Metadata
    is_active BOOLEAN DEFAULT true,
    is_stackable BOOLEAN DEFAULT true, -- Can be combined with other rebates
    priority INTEGER DEFAULT 0, -- Higher priority rebates apply first
    max_applications INTEGER, -- Maximum number of times this rebate can be applied (NULL = unlimited)
    times_applied INTEGER DEFAULT 0,
    
    -- Terms and Conditions
    terms_and_conditions TEXT,
    requires_financing BOOLEAN DEFAULT false,
    requires_trade_in BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rebate applications tracking table
CREATE TABLE IF NOT EXISTS rebate_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rebate_id UUID REFERENCES rebates(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
    dealer_id UUID REFERENCES dealers(id) ON DELETE CASCADE,
    
    -- Application Details
    applied_amount NUMERIC(10,2) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by UUID REFERENCES users(id),
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed', 'expired')),
    removed_at TIMESTAMP WITH TIME ZONE,
    removed_by UUID REFERENCES users(id),
    removal_reason TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rebates_dealer_id ON rebates(dealer_id);
CREATE INDEX IF NOT EXISTS idx_rebates_active ON rebates(is_active, valid_until);
CREATE INDEX IF NOT EXISTS idx_rebates_makes ON rebates USING GIN(eligible_makes);
CREATE INDEX IF NOT EXISTS idx_rebates_models ON rebates USING GIN(eligible_models);
CREATE INDEX IF NOT EXISTS idx_rebate_applications_vehicle ON rebate_applications(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_rebate_applications_rebate ON rebate_applications(rebate_id);
CREATE INDEX IF NOT EXISTS idx_rebate_applications_status ON rebate_applications(status);
CREATE INDEX IF NOT EXISTS idx_rebate_applications_dealer ON rebate_applications(dealer_id);

-- Create function to calculate eligible rebates for a vehicle
CREATE OR REPLACE FUNCTION get_eligible_rebates_for_vehicle(
    p_vehicle_id UUID,
    p_dealer_id UUID
)
RETURNS TABLE (
    rebate_id UUID,
    rebate_name TEXT,
    rebate_amount NUMERIC,
    amount_type TEXT,
    rebate_type TEXT,
    calculated_amount NUMERIC
) AS $$
DECLARE
    v_vehicle RECORD;
BEGIN
    -- Get vehicle details
    SELECT * INTO v_vehicle
    FROM vehicles
    WHERE id = p_vehicle_id AND dealer_id = p_dealer_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Find eligible rebates
    RETURN QUERY
    SELECT 
        r.id,
        r.rebate_name,
        r.rebate_amount,
        r.amount_type,
        r.rebate_type,
        CASE 
            WHEN r.amount_type = 'percentage' THEN 
                ROUND((v_vehicle.price * r.rebate_amount / 100), 2)
            ELSE 
                r.rebate_amount
        END as calculated_amount
    FROM rebates r
    WHERE r.dealer_id = p_dealer_id
        AND r.is_active = true
        AND (r.valid_from IS NULL OR r.valid_from <= NOW())
        AND (r.valid_until IS NULL OR r.valid_until >= NOW())
        AND (r.max_applications IS NULL OR r.times_applied < r.max_applications)
        -- Check make eligibility
        AND (r.eligible_makes IS NULL OR v_vehicle.make = ANY(r.eligible_makes))
        -- Check model eligibility
        AND (r.eligible_models IS NULL OR v_vehicle.model = ANY(r.eligible_models))
        -- Check year eligibility
        AND (r.eligible_years IS NULL OR v_vehicle.year = ANY(r.eligible_years))
        -- Check vehicle type eligibility
        AND (r.eligible_vehicle_types IS NULL OR v_vehicle.new_used = ANY(r.eligible_vehicle_types))
        -- Check price range
        AND (r.min_price IS NULL OR v_vehicle.price >= r.min_price)
        AND (r.max_price IS NULL OR v_vehicle.price <= r.max_price)
    ORDER BY r.priority DESC, r.rebate_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to apply rebates to matching vehicles
CREATE OR REPLACE FUNCTION apply_rebate_to_vehicles(
    p_rebate_id UUID,
    p_dealer_id UUID,
    p_applied_by UUID
)
RETURNS TABLE (
    vehicle_id UUID,
    vehicle_info TEXT,
    applied_amount NUMERIC,
    status TEXT
) AS $$
DECLARE
    v_rebate RECORD;
    v_vehicle RECORD;
    v_calculated_amount NUMERIC;
    v_application_id UUID;
BEGIN
    -- Get rebate details
    SELECT * INTO v_rebate
    FROM rebates
    WHERE id = p_rebate_id AND dealer_id = p_dealer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rebate not found';
    END IF;
    
    IF NOT v_rebate.is_active THEN
        RAISE EXCEPTION 'Rebate is not active';
    END IF;
    
    -- Loop through eligible vehicles
    FOR v_vehicle IN
        SELECT v.*
        FROM vehicles v
        WHERE v.dealer_id = p_dealer_id
            AND v.status = 'available'
            -- Check eligibility criteria
            AND (v_rebate.eligible_makes IS NULL OR v.make = ANY(v_rebate.eligible_makes))
            AND (v_rebate.eligible_models IS NULL OR v.model = ANY(v_rebate.eligible_models))
            AND (v_rebate.eligible_years IS NULL OR v.year = ANY(v_rebate.eligible_years))
            AND (v_rebate.eligible_vehicle_types IS NULL OR v.new_used = ANY(v_rebate.eligible_vehicle_types))
            AND (v_rebate.min_price IS NULL OR v.price >= v_rebate.min_price)
            AND (v_rebate.max_price IS NULL OR v.price <= v_rebate.max_price)
    LOOP
        -- Calculate rebate amount
        IF v_rebate.amount_type = 'percentage' THEN
            v_calculated_amount := ROUND((v_vehicle.price * v_rebate.rebate_amount / 100), 2);
        ELSE
            v_calculated_amount := v_rebate.rebate_amount;
        END IF;
        
        -- Check if rebate already applied to this vehicle
        IF EXISTS (
            SELECT 1 FROM rebate_applications 
            WHERE rebate_id = p_rebate_id 
                AND vehicle_id = v_vehicle.id 
                AND status = 'active'
        ) THEN
            vehicle_id := v_vehicle.id;
            vehicle_info := v_vehicle.year || ' ' || v_vehicle.make || ' ' || v_vehicle.model;
            applied_amount := v_calculated_amount;
            status := 'already_applied';
            RETURN NEXT;
            CONTINUE;
        END IF;
        
        -- Create rebate application record
        INSERT INTO rebate_applications (
            rebate_id, vehicle_id, dealer_id, applied_amount, applied_by, status
        )
        VALUES (
            p_rebate_id, v_vehicle.id, p_dealer_id, v_calculated_amount, p_applied_by, 'active'
        )
        RETURNING id INTO v_application_id;
        
        -- Update vehicle rebate fields based on rebate type
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
        
        -- Increment times applied counter
        UPDATE rebates
        SET times_applied = times_applied + 1,
            updated_at = NOW()
        WHERE id = p_rebate_id;
        
        vehicle_id := v_vehicle.id;
        vehicle_info := v_vehicle.year || ' ' || v_vehicle.make || ' ' || v_vehicle.model;
        applied_amount := v_calculated_amount;
        status := 'applied';
        RETURN NEXT;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Rebates module migration completed successfully!';
    RAISE NOTICE '📋 Created tables: rebates, rebate_applications';
    RAISE NOTICE '🔧 Created functions: get_eligible_rebates_for_vehicle, apply_rebate_to_vehicles';
END $$;

