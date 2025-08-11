import express from 'express';
import { query } from '../database/connection.js';
import { decryptVehicleData } from '../lib/qrCodeGenerator.js';

const router = express.Router();

// Public endpoint to get vehicle details by ID (for QR code scanning)
router.get('/:id', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    
    const sqlQuery = `
      SELECT v.*, d.business_name as dealer_name 
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      WHERE v.id = $1 AND v.status = 'available'
    `;
    
    const result = await query(sqlQuery, [vehicleId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or not available' });
    }
    
    res.json(result.rows[0]);
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
      SELECT v.*, d.business_name as dealer_name 
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      WHERE v.vin = $1 AND v.status = 'available'
    `;
    
    const result = await query(sqlQuery, [vin]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or not available' });
    }
    
    res.json(result.rows[0]);
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

// Public endpoint to get vehicle details by encrypted QR code hash
router.get('/qr/:hash', async (req, res) => {
  try {
    const hash = req.params.hash;
    
    // Find vehicle by hash - we need to check all vehicles to find the matching hash
    const sqlQuery = `
      SELECT v.*, d.business_name as dealer_name 
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      WHERE v.status = 'available'
    `;
    
    const result = await query(sqlQuery);
    
    // Find the vehicle that matches this hash
    let vehicle = null;
    for (const row of result.rows) {
      // Generate hash for this vehicle and check if it matches
      const crypto = await import('crypto');
      const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY || 'dealer-iq-qr-secret-key-2024';
      const vehicleHash = crypto.createHash('sha256')
        .update(`${row.id}-${row.vin}-${ENCRYPTION_KEY}`)
        .digest('hex')
        .substring(0, 16);
      
      if (vehicleHash === hash) {
        vehicle = row;
        break;
      }
    }
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found or QR code is invalid' });
    }
    
    res.json(vehicle);
  } catch (error) {
    console.error('Get public vehicle by QR hash error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

export default router; 