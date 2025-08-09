import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { generateVehicleQRCodeWithURL, deleteQRCode } from '../lib/qrCodeGenerator.js';
import { upload, deleteImage, deleteVehicleImages } from '../lib/imageUpload.js';

const router = express.Router();

// Get all vehicles for the authenticated dealer
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    let sqlQuery;
    let params;
    
    if (req.user.role === 'super_admin') {
      // Super admin can see all vehicles
      sqlQuery = `
        SELECT v.*, d.business_name as dealer_name 
        FROM vehicles v 
        LEFT JOIN dealers d ON v.dealer_id = d.id 
        ORDER BY v.created_at DESC
      `;
      params = [];
    } else {
      // Regular dealers can only see their own vehicles
      sqlQuery = `
        SELECT v.*, d.business_name as dealer_name 
        FROM vehicles v 
        LEFT JOIN dealers d ON v.dealer_id = d.id 
        WHERE d.user_id = $1 
        ORDER BY v.created_at DESC
      `;
      params = [userId];
    }
    
    const result = await query(sqlQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Get single vehicle
router.get('/:id', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    let sqlQuery;
    let params;
    
    if (req.user.role === 'super_admin') {
      sqlQuery = `
        SELECT v.*, d.business_name as dealer_name 
        FROM vehicles v 
        LEFT JOIN dealers d ON v.dealer_id = d.id 
        WHERE v.id = $1
      `;
      params = [vehicleId];
    } else {
      sqlQuery = `
        SELECT v.*, d.business_name as dealer_name 
        FROM vehicles v 
        LEFT JOIN dealers d ON v.dealer_id = d.id 
        WHERE v.id = $1 AND d.user_id = $2
      `;
      params = [vehicleId, userId];
    }
    
    const result = await query(sqlQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// Create new vehicle
router.post('/', [
  body('vin').notEmpty().trim(),
  body('make').notEmpty().trim(),
  body('model').notEmpty().trim(),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    
    // Get dealer ID for this user
    const dealerResult = await query('SELECT id FROM dealers WHERE user_id = $1', [userId]);
    if (dealerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dealer profile not found' });
    }
    
    const dealerId = dealerResult.rows[0].id;
    
    const {
      vin, make, model, year, status = 'available', new_used = 'used',
      stock_number, series, trim, body_style, color, interior_color,
      mileage, odometer, price, msrp, engine_type, displacement,
      transmission, certified = false, dealer_discount, consumer_rebate,
      dealer_accessories, total_customer_savings, total_dealer_rebate,
      other_price, description, features
    } = req.body;
    
    const result = await query(
      `INSERT INTO vehicles 
       (dealer_id, vin, make, model, year, status, new_used, stock_number, series, trim, 
        body_style, color, interior_color, mileage, odometer, price, msrp, 
        engine_type, displacement, transmission, certified, dealer_discount, 
        consumer_rebate, dealer_accessories, total_customer_savings, 
        total_dealer_rebate, other_price, description, features) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 
               $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29) 
       RETURNING *`,
      [dealerId, vin, make, model, year, status, new_used, stock_number, series, trim,
       body_style, color, interior_color, mileage, odometer, price, msrp,
       engine_type, displacement, transmission, certified, dealer_discount,
       consumer_rebate, dealer_accessories, total_customer_savings,
       total_dealer_rebate, other_price, description, features]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

// Update vehicle
router.put('/:id', [
  body('vin').optional().notEmpty().trim(),
  body('make').optional().notEmpty().trim(),
  body('model').optional().notEmpty().trim(),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);
    } else {
      vehicleCheck = await query(
        'SELECT v.id FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1 AND d.user_id = $2',
        [vehicleId, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const {
      vin, make, model, year, status, new_used, stock_number, series, trim, body_style,
      color, interior_color, mileage, odometer, price, msrp, engine_type,
      displacement, transmission, certified, dealer_discount, consumer_rebate,
      dealer_accessories, total_customer_savings, total_dealer_rebate,
      other_price, description, features
    } = req.body;
    
    const result = await query(
      `UPDATE vehicles SET 
       vin = COALESCE($1, vin),
       make = COALESCE($2, make),
       model = COALESCE($3, model),
       year = COALESCE($4, year),
       status = COALESCE($5, status),
       new_used = COALESCE($6, new_used),
       stock_number = COALESCE($7, stock_number),
       series = COALESCE($8, series),
       trim = COALESCE($9, trim),
       body_style = COALESCE($10, body_style),
       color = COALESCE($11, color),
       interior_color = COALESCE($12, interior_color),
       mileage = COALESCE($13, mileage),
       odometer = COALESCE($14, odometer),
       price = COALESCE($15, price),
       msrp = COALESCE($16, msrp),
       engine_type = COALESCE($17, engine_type),
       displacement = COALESCE($18, displacement),
       transmission = COALESCE($19, transmission),
       certified = COALESCE($20, certified),
       dealer_discount = COALESCE($21, dealer_discount),
       consumer_rebate = COALESCE($22, consumer_rebate),
       dealer_accessories = COALESCE($23, dealer_accessories),
       total_customer_savings = COALESCE($24, total_customer_savings),
       total_dealer_rebate = COALESCE($25, total_dealer_rebate),
       other_price = COALESCE($26, other_price),
       description = COALESCE($27, description),
       features = COALESCE($28, features),
       updated_at = NOW()
       WHERE id = $29
       RETURNING *`,
      [vin, make, model, year, status, new_used, stock_number, series, trim, body_style,
       color, interior_color, mileage, odometer, price, msrp, engine_type,
       displacement, transmission, certified, dealer_discount, consumer_rebate,
       dealer_accessories, total_customer_savings, total_dealer_rebate,
       other_price, description, features, vehicleId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
});

// Delete vehicle
router.delete('/:id', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let deleteQuery;
    let params;
    
    if (req.user.role === 'super_admin') {
      deleteQuery = 'DELETE FROM vehicles WHERE id = $1 RETURNING id';
      params = [vehicleId];
    } else {
      deleteQuery = `
        DELETE FROM vehicles 
        WHERE id = $1 AND dealer_id IN (
          SELECT id FROM dealers WHERE user_id = $2
        ) 
        RETURNING id
      `;
      params = [vehicleId, userId];
    }
    
    const result = await query(deleteQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// Generate QR code for a vehicle
router.post('/:id/qr-code', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);
    } else {
      vehicleCheck = await query(
        'SELECT v.id FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1 AND d.user_id = $2',
        [vehicleId, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Get frontend URL from environment or use default
    const frontendBaseURL = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    // Get vehicle data for VIN-based QR code
    const vehicleData = await query(
      'SELECT v.*, d.business_name FROM vehicles v LEFT JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1',
      [vehicleId]
    );
    
    // Generate QR code with vehicle data
    const qrCodeUrl = await generateVehicleQRCodeWithURL(vehicleId, frontendBaseURL, vehicleData.rows[0]);
    
    // Update vehicle with QR code URL
    await query(
      'UPDATE vehicles SET qr_code_url = $1, updated_at = NOW() WHERE id = $2',
      [qrCodeUrl, vehicleId]
    );
    
    res.json({ 
      success: true, 
      qrCodeUrl,
      message: 'QR code generated successfully' 
    });
  } catch (error) {
    console.error('Generate QR code error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Generate QR codes for multiple vehicles (bulk operation)
router.post('/qr-codes/bulk', async (req, res) => {
  try {
    const { vehicleIds } = req.body;
    const userId = req.user.id;
    
    if (!vehicleIds || !Array.isArray(vehicleIds)) {
      return res.status(400).json({ error: 'Vehicle IDs array is required' });
    }
    
    // Check if vehicles belong to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query(
        'SELECT id FROM vehicles WHERE id = ANY($1)',
        [vehicleIds]
      );
    } else {
      vehicleCheck = await query(
        'SELECT v.id FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = ANY($1) AND d.user_id = $2',
        [vehicleIds, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'No vehicles found' });
    }
    
    const frontendBaseURL = process.env.FRONTEND_URL || 'http://localhost:8080';
    const results = [];
    
    for (const vehicleId of vehicleIds) {
      try {
        // Get vehicle data for VIN-based QR code
        const vehicleData = await query(
          'SELECT v.*, d.business_name FROM vehicles v LEFT JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1',
          [vehicleId]
        );
        
        if (vehicleData.rows.length === 0) {
          results.push({ vehicleId, success: false, error: 'Vehicle not found' });
          continue;
        }
        
        const qrCodeUrl = await generateVehicleQRCodeWithURL(vehicleId, frontendBaseURL, vehicleData.rows[0]);
        await query(
          'UPDATE vehicles SET qr_code_url = $1, updated_at = NOW() WHERE id = $2',
          [qrCodeUrl, vehicleId]
        );
        results.push({ vehicleId, success: true, qrCodeUrl });
      } catch (error) {
        console.error(`Error generating QR code for vehicle ${vehicleId}:`, error);
        results.push({ vehicleId, success: false, error: error.message });
      }
    }
    
    res.json({ 
      success: true, 
      results,
      message: `Generated QR codes for ${results.filter(r => r.success).length} vehicles` 
    });
  } catch (error) {
    console.error('Bulk QR code generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR codes' });
  }
});

// Delete QR code for a vehicle
router.delete('/:id/qr-code', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);
    } else {
      vehicleCheck = await query(
        'SELECT v.id FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1 AND d.user_id = $2',
        [vehicleId, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Get vehicle VIN for QR code deletion
    const vehicleData = await query('SELECT vin FROM vehicles WHERE id = $1', [vehicleId]);
    const vin = vehicleData.rows[0]?.vin;
    
    // Delete QR code file
    await deleteQRCode(vehicleId, vin);
    
    // Update vehicle to remove QR code URL
    await query(
      'UPDATE vehicles SET qr_code_url = NULL, updated_at = NOW() WHERE id = $1',
      [vehicleId]
    );
    
    res.json({ 
      success: true, 
      message: 'QR code deleted successfully' 
    });
  } catch (error) {
    console.error('Delete QR code error:', error);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});




// Upload images for a vehicle
router.post('/:id/images', upload.array('images', 10), async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);
    } else {
      vehicleCheck = await query(
        'SELECT v.id FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1 AND d.user_id = $2',
        [vehicleId, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    
    // Get current images
    const currentResult = await query('SELECT photo_url_list FROM vehicles WHERE id = $1', [vehicleId]);
    const currentImages = currentResult.rows[0]?.photo_url_list || [];
    
    // Create URLs for uploaded files
    const uploadedImages = req.files.map(file => `/uploads/vehicle-images/${file.filename}`);
    
    // Combine with existing images
    const allImages = [...currentImages, ...uploadedImages];
    
    // Update vehicle with new images
    await query(
      'UPDATE vehicles SET photo_url_list = $1, updated_at = NOW() WHERE id = $2',
      [allImages, vehicleId]
    );
    
    res.json({ 
      success: true, 
      images: uploadedImages,
      allImages: allImages,
      message: `${req.files.length} image(s) uploaded successfully` 
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Upload images for a vehicle
router.post('/:id/images', upload.array('images', 10), async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query('SELECT id FROM vehicles WHERE id = $1', [vehicleId]);
    } else {
      vehicleCheck = await query(
        'SELECT v.id FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1 AND d.user_id = $2',
        [vehicleId, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    
    // Get current images
    const currentResult = await query('SELECT photo_url_list FROM vehicles WHERE id = $1', [vehicleId]);
    const currentImages = currentResult.rows[0]?.photo_url_list || [];
    
    // Create URLs for uploaded files
    const uploadedImages = req.files.map(file => `/uploads/vehicle-images/${file.filename}`);
    
    // Combine with existing images
    const allImages = [...currentImages, ...uploadedImages];
    
    // Update vehicle with new images
    await query(
      'UPDATE vehicles SET photo_url_list = $1, updated_at = NOW() WHERE id = $2',
      [allImages, vehicleId]
    );
    
    res.json({ 
      success: true, 
      images: uploadedImages,
      allImages: allImages,
      message: `${req.files.length} image(s) uploaded successfully` 
    });
  } catch (error) {
    console.error('Upload images error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Delete a specific image from a vehicle
router.delete('/:id/images/:imageIndex', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const imageIndex = parseInt(req.params.imageIndex);
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query('SELECT photo_url_list FROM vehicles WHERE id = $1', [vehicleId]);
    } else {
      vehicleCheck = await query(
        'SELECT v.photo_url_list FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1 AND d.user_id = $2',
        [vehicleId, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const currentImages = vehicleCheck.rows[0].photo_url_list || [];
    
    if (imageIndex < 0 || imageIndex >= currentImages.length) {
      return res.status(400).json({ error: 'Invalid image index' });
    }
    
    // Delete the image file
    const imageUrl = currentImages[imageIndex];
    await deleteImage(imageUrl);
    
    // Remove from array
    const updatedImages = currentImages.filter((_, index) => index !== imageIndex);
    
    // Update vehicle
    await query(
      'UPDATE vehicles SET photo_url_list = $1, updated_at = NOW() WHERE id = $2',
      [updatedImages, vehicleId]
    );
    
    res.json({ 
      success: true, 
      message: 'Image deleted successfully',
      images: updatedImages
    });
  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Delete all images for a vehicle
router.delete('/:id/images', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer (unless super admin)
    let vehicleCheck;
    if (req.user.role === 'super_admin') {
      vehicleCheck = await query('SELECT photo_url_list FROM vehicles WHERE id = $1', [vehicleId]);
    } else {
      vehicleCheck = await query(
        'SELECT v.photo_url_list FROM vehicles v JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1 AND d.user_id = $2',
        [vehicleId, userId]
      );
    }
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const currentImages = vehicleCheck.rows[0].photo_url_list || [];
    
    // Delete all image files
    for (const imageUrl of currentImages) {
      await deleteImage(imageUrl);
    }
    
    // Update vehicle to remove all images
    await query(
      'UPDATE vehicles SET photo_url_list = NULL, updated_at = NOW() WHERE id = $1',
      [vehicleId]
    );
    
    res.json({ 
      success: true, 
      message: 'All images deleted successfully'
    });
  } catch (error) {
    console.error('Delete all images error:', error);
    res.status(500).json({ error: 'Failed to delete images' });
  }
});

// Correct feature formats for all vehicles
router.post('/correct-features', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all vehicles for this dealer
    let vehiclesQuery;
    let vehiclesParams;
    
    if (req.user.role === 'super_admin') {
      vehiclesQuery = 'SELECT id, features FROM vehicles WHERE features IS NOT NULL';
      vehiclesParams = [];
    } else {
      vehiclesQuery = `
        SELECT v.id, v.features 
        FROM vehicles v 
        LEFT JOIN dealers d ON v.dealer_id = d.id 
        WHERE d.user_id = $1 AND v.features IS NOT NULL
      `;
      vehiclesParams = [userId];
    }
    
    const vehiclesResult = await query(vehiclesQuery, vehiclesParams);
    let updatedCount = 0;
    
    for (const vehicle of vehiclesResult.rows) {
      let features = vehicle.features;
      let needsUpdate = false;
    
      console.log(`Processing vehicle ${vehicle.id}, original features:`, features);
    
      if (typeof features === 'string' && features.trim() !== '') {
        let originalFeatures = features;
    
        // 1. Remove outer quotes if whole string is quoted
        if (features.startsWith('"') && features.endsWith('"')) {
          features = features.slice(1, -1);
        }
    
        // 2. Remove backslashes and extra quotes
        features = features.replace(/\\/g, ''); // remove all backslashes
        features = features.replace(/"{2,}/g, '"'); // collapse multiple quotes
    
        // 3. Remove surrounding { } or [ ] for now
        features = features.replace(/^[{\[]|[}\]]$/g, '');
    
        // 4. Split by comma or pipe
        let parts = features.split(/[,|]/);
    
        // 5. Trim and wrap each feature in quotes
        parts = parts
          .map(f => f.trim())
          .filter(f => f.length > 0)
          .map(f => `"${f.replace(/^"|"$/g, '')}"`);
    
        // 6. Join back in { ... } format
        features = `{${parts.join(',')}}`;
    
        // Check if it’s different from original
        if (features !== originalFeatures) {
          needsUpdate = true;
          console.log(`Updated features for vehicle ${vehicle.id}:`);
          console.log(`  Before: ${originalFeatures}`);
          console.log(`  After:  ${features}`);
        }
      }
    
      if (needsUpdate) {
        await query(
          'UPDATE vehicles SET features = $1 WHERE id = $2',
          [features, vehicle.id]
        );
        updatedCount++;
      }
    }
    
    
    res.json({
      success: true,
      updatedCount,
      totalVehicles: vehiclesResult.rows.length
    });
  } catch (error) {
    console.error('Correct features error:', error);
    res.status(500).json({ error: 'Failed to correct feature formats' });
  }
});

// Download images from URLs to local server for a specific vehicle
router.post('/:id/download-images', async (req, res) => {
  try {
    const userId = req.user.id;
    const vehicleId = req.params.id;
    const fs = await import('fs');
    const path = await import('path');
    const https = await import('https');
    const http = await import('http');
    
    // Get the specific vehicle
    let vehicleQuery;
    let vehicleParams;
    
    if (req.user.role === 'super_admin') {
      vehicleQuery = 'SELECT id, photo_url_list FROM vehicles WHERE id = $1 AND photo_url_list IS NOT NULL AND photo_url_list != \'{}\'';
      vehicleParams = [vehicleId];
    } else {
      vehicleQuery = `
        SELECT v.id, v.photo_url_list 
        FROM vehicles v 
        LEFT JOIN dealers d ON v.dealer_id = d.id 
        WHERE v.id = $1 AND d.user_id = $2 AND v.photo_url_list IS NOT NULL AND v.photo_url_list != '{}'
      `;
      vehicleParams = [vehicleId, userId];
    }
    
    const vehicleResult = await query(vehicleQuery, vehicleParams);
    
    console.log('Vehicle query result:', vehicleResult);
    console.log('Vehicle data:', vehicleResult.rows[0]);
    
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found or has no images' });
    }
    
    const vehicle = vehicleResult.rows[0];
    console.log('Processing vehicle:', vehicle.id);
    console.log('Photo URL list:', vehicle.photo_url_list);
    console.log('Photo URL list type:', typeof vehicle.photo_url_list);
    console.log('Photo URL list is array:', Array.isArray(vehicle.photo_url_list));
    
    let downloadedCount = 0;
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads', 'vehicle-images');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    let images = vehicle.photo_url_list;
    
    // Handle both array and string formats
    let imageUrls = [];
    console.log('Processing images:', images);
    
    if (Array.isArray(images)) {
      // If it's already an array, use it directly
      imageUrls = images.filter(url => url && typeof url === 'string' && url.includes('http'));
      console.log('Array format - filtered URLs:', imageUrls);
    } else if (typeof images === 'string') {
      // Handle PostgreSQL array string format: {"url1","url2","url3"}
      if (images.startsWith('{') && images.endsWith('}')) {
        // Parse PostgreSQL array format
        const content = images.slice(1, -1); // Remove { and }
        imageUrls = content.split(',').map(url => url.trim().replace(/"/g, '')).filter(url => url.includes('http'));
        console.log('PostgreSQL array format - parsed URLs:', imageUrls);
      } else if (images.includes('http')) {
        // If it's a string, parse comma-separated URLs
        imageUrls = images.split(',').map(url => url.trim()).filter(url => url.startsWith('http'));
        console.log('String format - parsed URLs:', imageUrls);
      }
    } else {
      console.log('No valid image format found');
    }
    
    // Additional check for corrupted array format (individual characters)
    // if (imageUrls.length === 0 && typeof images === 'string' && images.includes('"')) {
    //   console.log('Detected corrupted array format, attempting to extract URLs...');
    //   // Try to extract URLs from the corrupted format
    //   const urlMatches = images.match(/https?:\/\/[^\s"{}]+/g);
    //   if (urlMatches) {
    //     imageUrls = urlMatches;
    //     console.log('Extracted URLs from corrupted format:', imageUrls);
    //   }
    // }
    
    console.log('Final imageUrls:', imageUrls);
    
    if (imageUrls.length === 0) {
      return res.status(404).json({ error: 'No valid image URLs found for this vehicle' });
    }
    
    const localImagePaths = [];
    
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      console.log(`Downloading image ${i + 1}/${imageUrls.length}: ${imageUrl}`);
      
      try {
        // Generate unique filename with unique timestamp for each image
        const urlParts = new URL(imageUrl);
        const extension = path.extname(urlParts.pathname) || '.jpg';
        const uniqueTimestamp = Date.now() + i; // Add index to make each timestamp unique
        const filename = `vehicle-${vehicle.id}-${i + 1}-${uniqueTimestamp}${extension}`;
        const localPath = path.join(uploadsDir, filename);
        
        console.log(`Saving to: ${localPath}`);
        
        // Download image
        await new Promise((resolve, reject) => {
          const client = imageUrl.startsWith('https:') ? https : http;
          const file = fs.createWriteStream(localPath);
          
          client.get(imageUrl, (response) => {
            console.log(`HTTP response for ${imageUrl}: ${response.statusCode}`);
            if (response.statusCode === 200) {
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                console.log(`Successfully downloaded: ${imageUrl}`);
                resolve();
              });
            } else {
              reject(new Error(`HTTP ${response.statusCode}`));
            }
          }).on('error', (err) => {
            console.error(`HTTP error for ${imageUrl}:`, err);
            reject(err);
          });
        });
        
        // Add local path to array
        localImagePaths.push(`/uploads/vehicle-images/${filename}`);
        downloadedCount++;
        console.log(`Added to local paths: /uploads/vehicle-images/${filename}`);
      } catch (error) {
        console.error(`Failed to download image ${imageUrl}:`, error);
        // Keep original URL if download fails
        localImagePaths.push(imageUrl);
        console.log(`Kept original URL: ${imageUrl}`);
      }
    }
    
    console.log('Final local image paths:', localImagePaths);
    console.log('Downloaded count:', downloadedCount);
    console.log('Local image paths type:', typeof localImagePaths);
    console.log('Local image paths is array:', Array.isArray(localImagePaths));
    
    // Update vehicle with local image paths as an array
    // Use manual array construction to ensure proper format
    const arrayString = `{${localImagePaths.map(item => `"${item}"`).join(',')}}`;
    console.log('Array string for database update:', arrayString);
    
    const updateResult = await query(
      'UPDATE vehicles SET photo_url_list = $1::text[] WHERE id = $2',
      [arrayString, vehicle.id]
    );
    
    console.log('Database update result:', updateResult);
    
    // Verify the update by reading back the data
    const verifyResult = await query('SELECT photo_url_list FROM vehicles WHERE id = $1', [vehicle.id]);
    console.log('Verification - photo_url_list after update:', verifyResult.rows[0]?.photo_url_list);
    
    console.log('Database updated successfully');
    
    res.json({
      success: true,
      downloadedCount,
      vehicleId: vehicle.id
    });
  } catch (error) {
    console.error('Download vehicle images error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ 
      error: 'Failed to download vehicle images',
      details: error.message 
    });
  }
});

export default router;
