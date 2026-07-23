-- Debug Toyota Rebate Matching
-- Run this to see which vehicles SHOULD match

-- Your rebate criteria:
-- Make: Toyota
-- Models configured: GR86, Camry, 4Runner, Grand Highlander Hybrid
-- Years: 2025, 2026
-- Type: new
-- State: CA

-- 1. Check all Toyota vehicles in inventory
SELECT 
    id,
    stock_number,
    make,
    model,
    year,
    new_used,
    price,
    status,
    consumer_rebate,
    -- Check each criteria
    CASE WHEN make = 'Toyota' THEN '✅' ELSE '❌' END as make_match,
    CASE WHEN year IN (2025, 2026) THEN '✅' ELSE '❌' END as year_match,
    CASE 
        WHEN new_used = 'N' THEN '✅ new'
        WHEN new_used = 'U' THEN '❌ used'
        ELSE '❌ ' || new_used 
    END as type_match,
    CASE WHEN status = 'available' THEN '✅' ELSE '❌' END as status_match,
    CASE 
        WHEN model IN ('GR86', 'Camry', '4Runner', 'Grand Highlander Hybrid') THEN '✅ configured'
        ELSE '❌ not in config'
    END as model_configured
FROM vehicles
WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
AND make = 'Toyota'
ORDER BY model, year;

-- 2. Check if rebate already applied
SELECT 
    v.stock_number,
    v.make,
    v.model,
    v.year,
    ra.applied_amount,
    ra.applied_at,
    ra.is_active
FROM rebate_applications ra
JOIN vehicles v ON ra.vehicle_id = v.id
WHERE ra.rebate_id = 'f1d889a3-2a50-4fbd-a4a2-7da98d683c53'
AND ra.dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f';

-- 3. Exact model name check
SELECT DISTINCT 
    model,
    COUNT(*) as count,
    CASE 
        WHEN model = 'GR86' THEN '✅ Exact match'
        WHEN model = 'Camry' THEN '✅ Exact match'
        WHEN model = '4Runner' THEN '✅ Exact match'
        WHEN model = 'Grand Highlander Hybrid' THEN '✅ Exact match'
        WHEN LOWER(model) = 'gr86' THEN '⚠️ Case mismatch'
        WHEN LOWER(model) = 'camry' THEN '⚠️ Case mismatch'
        WHEN LOWER(model) = '4runner' THEN '⚠️ Case mismatch'
        WHEN LOWER(model) = 'grand highlander hybrid' THEN '⚠️ Case mismatch'
        ELSE '❌ No match'
    END as match_status
FROM vehicles
WHERE dealer_id = '0aa94346-ed1d-420e-8823-bcd97bf6456f'
AND make = 'Toyota'
GROUP BY model
ORDER BY model;

