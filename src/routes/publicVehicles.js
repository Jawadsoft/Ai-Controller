import express from 'express';
import { query } from '../database/connection.js';
import { decryptVehicleData } from '../lib/qrCodeGenerator.js';

const router = express.Router();

// Public endpoint to get vehicle details by ID (for QR code scanning)
router.get('/:id', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    
    const sqlQuery = `
      SELECT 
        v.*, 
        d.business_name as dealer_name,
        d.contact_name as dealer_contact_name,
        d.phone as dealer_phone,
        d.email as dealer_email,
        d.address as dealer_address,
        d.city as dealer_city,
        d.state as dealer_state,
        d.zip_code as dealer_zip,
        d.website as dealer_website,
        cr.accident_count,
        cr.service_records,
        cr.owners,
        cr.title_issues,
        cr.structural_damage,
        cr.flood_damage,
        cr.previous_rental,
        cr.previous_fleet,
        cr.previous_lease,
        cr.certified_pre_owned,
        cr.summary as carfax_summary
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      LEFT JOIN LATERAL (
        SELECT * FROM carfax_reports 
        WHERE vehicle_id = v.id 
        ORDER BY uploaded_at DESC 
        LIMIT 1
      ) cr ON true
      WHERE v.id = $1 AND v.status = 'available'
    `;
    
    const result = await query(sqlQuery, [vehicleId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or not available' });
    }
    
    const vehicle = result.rows[0];
    console.log('✅ Returning vehicle with CARFAX data:', vehicle.id, {
      hasCarfax: vehicle.accident_count !== null && vehicle.accident_count !== undefined
    });
    
    res.json(vehicle);
  } catch (error) {
    console.error('Get public vehicle error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// Public endpoint to get vehicle details by VIN (for QR code scanning)
router.get('/vin/:vin', async (req, res) => {
  try {
    const vin = req.params.vin;
    
    const sqlQuery = `
      SELECT 
        v.*, 
        d.business_name as dealer_name,
        d.contact_name as dealer_contact_name,
        d.phone as dealer_phone,
        d.email as dealer_email,
        d.address as dealer_address,
        d.city as dealer_city,
        d.state as dealer_state,
        d.zip_code as dealer_zip,
        d.website as dealer_website,
        cr.accident_count,
        cr.service_records,
        cr.owners,
        cr.title_issues,
        cr.structural_damage,
        cr.flood_damage,
        cr.previous_rental,
        cr.previous_fleet,
        cr.previous_lease,
        cr.certified_pre_owned,
        cr.summary as carfax_summary
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      LEFT JOIN LATERAL (
        SELECT * FROM carfax_reports 
        WHERE vehicle_id = v.id 
        ORDER BY uploaded_at DESC 
        LIMIT 1
      ) cr ON true
      WHERE v.vin = $1 AND v.status = 'available'
    `;
    
    const result = await query(sqlQuery, [vin]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or not available' });
    }
    
    const vehicle = result.rows[0];
    console.log('✅ Returning vehicle with CARFAX data:', vehicle.id, {
      hasCarfax: vehicle.accident_count !== null && vehicle.accident_count !== undefined
    });
    
    res.json(vehicle);
  } catch (error) {
    console.error('Get public vehicle by VIN error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// Public endpoint to get dealer inventory (for AI bot use)
router.get('/dealer/:dealerId', async (req, res) => {
  try {
    const dealerId = req.params.dealerId;
    
    const sqlQuery = `
      SELECT 
        v.id,
        v.vin,
        v.make,
        v.model,
        v.year,
        v.trim,
        v.mileage,
        v.price,
        v.status,
        v.features,
        v.description,
        v.exterior_color,
        v.interior_color,
        v.fuel_type,
        v.transmission,
        v.engine,
        v.doors,
        v.seats,
        v.created_at,
        d.business_name as dealer_name,
        d.address as dealer_address,
        d.city as dealer_city,
        d.state as dealer_state,
        d.phone as dealer_phone
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      WHERE v.dealer_id = $1 AND v.status = 'available'
      ORDER BY v.created_at DESC
    `;
    
    const result = await query(sqlQuery, [dealerId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
      dealer: {
        id: dealerId,
        business_name: result.rows[0]?.dealer_name || 'Unknown',
        address: result.rows[0]?.dealer_address || 'Unknown',
        city: result.rows[0]?.dealer_city || 'Unknown',
        state: result.rows[0]?.dealer_state || 'Unknown',
        phone: result.rows[0]?.dealer_phone || 'Unknown'
      }
    });
  } catch (error) {
    console.error('Get dealer inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch dealer inventory' });
  }
});

// Debug endpoint to check hash generation
router.get('/debug/hash/:vehicleId', async (req, res) => {
  try {
    const vehicleId = req.params.vehicleId;
    
    // Get vehicle data
    const vehicleResult = await query(
      'SELECT v.*, d.business_name as dealer_name FROM vehicles v LEFT JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1',
      [vehicleId]
    );
    
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const vehicle = vehicleResult.rows[0];
    
    // Generate hash the same way as in qrCodeGenerator.js (with vehicle_id, dealer_id, and VIN)
    const crypto = await import('crypto');
    const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY || 'dealer-iq-qr-secret-key-2024';
    const vehicleHash = crypto.createHash('sha256')
      .update(`${vehicle.id}-${vehicle.dealer_id}-${vehicle.vin || 'unknown'}-${ENCRYPTION_KEY}`)
      .digest('hex')
      .substring(0, 16);
    
    // Generate encrypted data to show what's stored
    const { encryptVehicleData } = await import('../lib/qrCodeGenerator.js');
    const encryptedData = encryptVehicleData(vehicle.id, vehicle.dealer_id, vehicle.vin);
    
    res.json({
      vehicleId: vehicle.id,
      dealerId: vehicle.dealer_id,
      vin: vehicle.vin,
      generatedHash: vehicleHash,
      encryptedData: encryptedData,
      expectedUrl: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/vehicle/qr/${vehicleHash}`,
      qrCodeUrl: vehicle.qr_code_url,
      hashComponents: {
        vehicleId: vehicle.id,
        dealerId: vehicle.dealer_id,
        vin: vehicle.vin || 'unknown',
        encryptionKey: ENCRYPTION_KEY.substring(0, 10) + '...'
      }
    });
  } catch (error) {
    console.error('Debug hash generation error:', error);
    res.status(500).json({ error: 'Failed to generate debug info' });
  }
});

// Debug endpoint to decrypt QR code data
router.get('/debug/decrypt/:encryptedData', async (req, res) => {
  try {
    const { encryptedData } = req.params;
    
    // Import the decrypt function
    const { decryptVehicleData } = await import('../lib/qrCodeGenerator.js');
    
    // Decrypt the data
    const decryptedData = decryptVehicleData(encryptedData);
    
    if (!decryptedData) {
      return res.status(400).json({ error: 'Failed to decrypt data' });
    }
    
    res.json({
      encryptedData,
      decryptedData,
      timestamp: new Date(decryptedData.timestamp).toISOString()
    });
  } catch (error) {
    console.error('Debug decryption error:', error);
    res.status(500).json({ error: 'Failed to decrypt data' });
  }
});

// Public endpoint to get vehicle details by encrypted QR code hash
router.get('/qr/:hash', async (req, res) => {
  try {
    const hash = req.params.hash;
    console.log('🔍 Looking up vehicle with hash:', hash);
    
    // Find vehicle by hash - we need to check all vehicles to find the matching hash
    const sqlQuery = `
      SELECT 
        v.*, 
        d.business_name as dealer_name,
        d.contact_name as dealer_contact_name,
        d.phone as dealer_phone,
        d.email as dealer_email,
        d.address as dealer_address,
        d.city as dealer_city,
        d.state as dealer_state,
        d.zip_code as dealer_zip,
        d.website as dealer_website,
        cr.accident_count,
        cr.service_records,
        cr.owners,
        cr.title_issues,
        cr.structural_damage,
        cr.flood_damage,
        cr.previous_rental,
        cr.previous_fleet,
        cr.previous_lease,
        cr.certified_pre_owned,
        cr.summary as carfax_summary
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      LEFT JOIN LATERAL (
        SELECT * FROM carfax_reports 
        WHERE vehicle_id = v.id 
        ORDER BY uploaded_at DESC 
        LIMIT 1
      ) cr ON true
      WHERE v.status = 'available'
    `;
    
    const result = await query(sqlQuery);
    console.log(`🔍 Found ${result.rows.length} available vehicles to check`);
    
    // Find the vehicle that matches this hash
    let vehicle = null;
    const crypto = await import('crypto');
    const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY || 'dealer-iq-qr-secret-key-2024';
    
    for (const row of result.rows) {
      // Generate hash for this vehicle and check if it matches (with vehicle_id, dealer_id, and VIN)
      const vehicleHash = crypto.createHash('sha256')
        .update(`${row.id}-${row.dealer_id}-${row.vin || 'unknown'}-${ENCRYPTION_KEY}`)
        .digest('hex')
        .substring(0, 16);
      
      console.log(`🔍 Checking vehicle ${row.id} (dealer: ${row.dealer_id}, vin: ${row.vin}): generated hash ${vehicleHash}, looking for ${hash}`);
      
      if (vehicleHash === hash) {
        vehicle = row;
        console.log('✅ Found matching vehicle:', vehicle.id, {
          hasCarfax: vehicle.accident_count !== null && vehicle.accident_count !== undefined
        });
        break;
      }
    }
    
    if (!vehicle) {
      console.log('❌ No vehicle found with hash:', hash);
      return res.status(404).json({ error: 'Vehicle not found or QR code is invalid' });
    }
    
    console.log('✅ Returning vehicle data with CARFAX for:', vehicle.id);
    res.json(vehicle);
  } catch (error) {
    console.error('Get public vehicle by QR hash error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// Public: look up a vehicle by stock number (used by AIBotPage QR flow)
router.get('/by-stock/:stockNumber', async (req, res) => {
  try {
    const { stockNumber } = req.params;
    const { dealerId } = req.query;

    console.log('🔍 Looking up vehicle by stock number:', stockNumber, 'dealerId:', dealerId);

    const params = [stockNumber];
    let dealerFilter = '';
    if (dealerId) {
      params.push(dealerId);
      dealerFilter = `AND v.dealer_id = $${params.length}`;
    }

    const result = await query(
      `SELECT 
        v.*,
        d.business_name as dealer_name,
        d.contact_name as dealer_contact_name,
        d.phone as dealer_phone,
        d.email as dealer_email,
        d.address as dealer_address,
        d.city as dealer_city,
        d.state as dealer_state,
        d.zip_code as dealer_zip,
        d.website as dealer_website,
        cr.accident_count,
        cr.service_records,
        cr.owners,
        cr.title_issues,
        cr.structural_damage,
        cr.flood_damage,
        cr.previous_rental,
        cr.previous_fleet,
        cr.previous_lease,
        cr.certified_pre_owned,
        cr.summary as carfax_summary
      FROM vehicles v
      LEFT JOIN dealers d ON v.dealer_id = d.id
      LEFT JOIN LATERAL (
        SELECT * FROM carfax_reports
        WHERE vehicle_id = v.id
        ORDER BY uploaded_at DESC
        LIMIT 1
      ) cr ON true
      WHERE v.stock_number = $1 ${dealerFilter}
      LIMIT 1`,
      params
    );

    if (result.rows.length === 0) {
      console.log('❌ No vehicle found with stock number:', stockNumber);
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    console.log('✅ Found vehicle by stock number:', result.rows[0].id);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get public vehicle by stock number error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

export default router;