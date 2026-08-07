import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { generateVehicleQRCodeWithURL, deleteQRCode } from '../lib/qrCodeGenerator.js';
import { upload, deleteImage, deleteVehicleImages, uploadToCloudinary } from '../lib/imageUpload.js';

const router = express.Router();

// Get all vehicles for the authenticated dealer with pagination
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Default limit of 20
    const offset = limit === -1 ? 0 : (page - 1) * limit; // No offset when showing all
    
    // Parse filter parameters
    const search = req.query.search || '';
    const make = req.query.make || '';
    const model = req.query.model || '';
    const year = req.query.year || '';
    const status = req.query.status || '';
    const inventoryStatus = req.query.inventory_status || '';
    const stickerStatus = req.query.sticker_status || '';
    const newUsed = req.query.new_used || '';
    const stockNumber = req.query.stock_number || '';
    const vehicleType = req.query.vehicle_type || '';
    const featureSearch = req.query.feature_search || '';
    const minPrice = req.query.min_price || '';
    const maxPrice = req.query.max_price || '';
    const importSource = req.query.import_source || '';
    const sortBy = req.query.sort_by || 'created_at';
    const sortOrder = req.query.sort_order || 'DESC';
    
    // Build WHERE conditions
    let whereConditions = [];
    let params = [];
    let paramIndex = 1;
    
    // Base condition for user access - Super admin has NO dealer access
    if (req.user.dealer_id) {
      whereConditions.push(`v.dealer_id = $${paramIndex}`);
      params.push(req.user.dealer_id);
      paramIndex++;
    } else {
      // No dealer_id means no vehicle access (including super admin)
      return res.json({ 
        vehicles: [], 
        total: 0, 
        page: page, 
        totalPages: 0,
        message: 'No dealer context - vehicles are dealer-specific'
      });
    }
    
    // Add search filter - enhanced to handle combined searches like "Hyundai Santa Fe 2024"
    if (search) {
      // Split search terms and create individual conditions
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);
      
      if (searchTerms.length > 0) {
        const searchConditions = [];
        
        // For each search term, check if it matches any field
        searchTerms.forEach(term => {
          const termPattern = `%${term}%`;
          searchConditions.push(`(
            v.make ILIKE $${paramIndex} OR 
            v.model ILIKE $${paramIndex} OR 
            v.year::text ILIKE $${paramIndex} OR 
            v.vin ILIKE $${paramIndex} OR 
            v.stock_number ILIKE $${paramIndex} OR
            CONCAT(v.make, ' ', v.model, ' ', v.year::text) ILIKE $${paramIndex} OR
            CONCAT(v.make, ' ', v.model) ILIKE $${paramIndex}
          )`);
          params.push(termPattern);
          paramIndex++;
        });
        
        // All search terms must match (AND condition)
        whereConditions.push(`(${searchConditions.join(' AND ')})`);
      }
    }
    
    // Add specific filters
    if (make) {
      whereConditions.push(`v.make = $${paramIndex}`);
      params.push(make);
      paramIndex++;
    }
    
    if (model) {
      whereConditions.push(`v.model = $${paramIndex}`);
      params.push(model);
      paramIndex++;
    }
    
    if (year) {
      whereConditions.push(`v.year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }
    
    if (status) {
      whereConditions.push(`v.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    
    if (inventoryStatus) {
      whereConditions.push(`v.inventory_status = $${paramIndex}`);
      params.push(inventoryStatus);
      paramIndex++;
    }
    
    if (stickerStatus) {
      // Handle comma-separated values like "generated,printed"
      if (stickerStatus.includes(',')) {
        const statusValues = stickerStatus.split(',').map(s => s.trim()).filter(s => s);
        if (statusValues.length > 0) {
          const placeholders = statusValues.map(() => `$${paramIndex++}`).join(',');
          whereConditions.push(`v.sticker_generation_status IN (${placeholders})`);
          params.push(...statusValues);
        }
      } else {
        whereConditions.push(`v.sticker_generation_status = $${paramIndex}`);
        params.push(stickerStatus);
        paramIndex++;
      }
    }
    
    if (newUsed) {
      whereConditions.push(`v.new_used = $${paramIndex}`);
      params.push(newUsed);
      paramIndex++;
    }
    
    if (stockNumber) {
      whereConditions.push(`v.stock_number ILIKE $${paramIndex}`);
      params.push(`%${stockNumber}%`);
      paramIndex++;
    }
    
    if (minPrice) {
      whereConditions.push(`v.price >= $${paramIndex}`);
      params.push(parseFloat(minPrice));
      paramIndex++;
    }
    
    if (maxPrice) {
      whereConditions.push(`v.price <= $${paramIndex}`);
      params.push(parseFloat(maxPrice));
      paramIndex++;
    }
    
    if (vehicleType) {
      whereConditions.push(`v.vehicle_type ILIKE $${paramIndex}`);
      params.push(vehicleType);
      paramIndex++;
    }
    
    if (featureSearch) {
      whereConditions.push(`EXISTS (SELECT 1 FROM unnest(v.features) AS f WHERE f ILIKE $${paramIndex})`);
      params.push(`%${featureSearch}%`);
      paramIndex++;
    }
    
    if (importSource) {
      if (importSource.toLowerCase() === 'manual') {
        // Manual vehicles have no import_config_id
        whereConditions.push(`v.import_config_id IS NULL`);
      } else {
        // Filter by import config name
        whereConditions.push(`ic.config_name ILIKE $${paramIndex}`);
        params.push(importSource);
        paramIndex++;
      }
    }
    
    // Build the WHERE clause
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // Validate sort parameters
    const allowedSortFields = ['created_at', 'updated_at', 'make', 'model', 'year', 'price', 'mileage'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const validSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';
    
    // Build main query
    const baseQuery = `
      SELECT v.*, 
             d.business_name as dealer_name, 
             ic.config_name as import_source,
             ih.completed_at as last_sync
      FROM vehicles v 
      LEFT JOIN dealers d ON v.dealer_id = d.id 
      LEFT JOIN import_configs ic ON v.import_config_id = ic.id
      LEFT JOIN LATERAL (
        SELECT completed_at 
        FROM import_history 
        WHERE import_config_id = v.import_config_id 
          AND import_status = 'completed'
        ORDER BY completed_at DESC 
        LIMIT 1
      ) ih ON true
      ${whereClause}
    `;
    
    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    // Get paginated results
    let dataQuery;
    if (limit === -1) {
      // Show all results without pagination
      dataQuery = `
        ${baseQuery}
        ORDER BY v.${validSortBy} ${validSortOrder}
      `;
    } else {
      // Use pagination
      dataQuery = `
        ${baseQuery}
        ORDER BY v.${validSortBy} ${validSortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      params.push(limit, offset);
    }
    
    const result = await query(dataQuery, params);
    
    // Debug: Log first vehicle to check data structure
    if (result.rows.length > 0) {
      console.log('Sample vehicle data:', {
        import_source: result.rows[0].import_source,
        last_sync: result.rows[0].last_sync,
        import_config_id: result.rows[0].import_config_id
      });
    }
    
    // Calculate pagination info
    const totalPages = limit === -1 ? 1 : Math.ceil(total / limit);
    const hasNextPage = limit === -1 ? false : page < totalPages;
    const hasPrevPage = limit === -1 ? false : page > 1;
    
    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        search,
        make,
        model,
        year,
        status,
        inventory_status: inventoryStatus,
        sticker_status: stickerStatus,
        new_used: newUsed,
        stock_number: stockNumber,
        import_source: importSource,
        min_price: minPrice,
        max_price: maxPrice,
        sort_by: validSortBy,
        sort_order: validSortOrder
      }
    });
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
    
    // Super admin should NOT access individual vehicles
    if (req.user.dealer_id) {
      sqlQuery = `
        SELECT v.*, d.business_name as dealer_name 
        FROM vehicles v 
        LEFT JOIN dealers d ON v.dealer_id = d.id 
        WHERE v.id = $1 AND v.dealer_id = $2
      `;
      params = [vehicleId, req.user.dealer_id];
    } else {
      return res.status(403).json({ error: 'Dealer access required - vehicles are dealer-specific' });
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
    
    // Get dealer ID for this user (prefer staff dealer_id)
    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dealerResult = await query('SELECT id FROM dealers WHERE user_id = $1', [userId]);
      if (dealerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Dealer profile not found' });
      }
      dealerId = dealerResult.rows[0].id;
    }
    
    const {
      vin, make, model, year, status = 'available', new_used = 'used',
      stock_number, series, trim, body_style, vehicle_type, color, interior_color,
      mileage, odometer, price, msrp, engine_type, displacement,
      transmission, certified = false, dealer_discount, consumer_rebate,
      dealer_accessories, total_customer_savings, total_dealer_rebate,
      other_price, description, features
    } = req.body;
    
    const result = await query(
      `INSERT INTO vehicles 
       (dealer_id, vin, make, model, year, status, new_used, stock_number, series, trim, 
        body_style, vehicle_type, color, interior_color, mileage, odometer, price, msrp, 
        engine_type, displacement, transmission, certified, dealer_discount, 
        consumer_rebate, dealer_accessories, total_customer_savings, 
        total_dealer_rebate, other_price, description, features) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
               $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30) 
       RETURNING *`,
      [dealerId, vin, make, model, year, status, new_used, stock_number, series, trim,
       body_style, vehicle_type, color, interior_color, mileage, odometer, price, msrp,
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
    
    // Check if vehicle belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT id FROM vehicles WHERE id = $1 AND dealer_id = $2',
      [vehicleId, req.user.dealer_id]
    );
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const {
      vin, make, model, year, status, new_used, stock_number, series, trim, body_style, vehicle_type,
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
       vehicle_type = COALESCE($11, vehicle_type),
       color = COALESCE($12, color),
       interior_color = COALESCE($13, interior_color),
       mileage = COALESCE($14, mileage),
       odometer = COALESCE($15, odometer),
       price = COALESCE($16, price),
       msrp = COALESCE($17, msrp),
       engine_type = COALESCE($18, engine_type),
       displacement = COALESCE($19, displacement),
       transmission = COALESCE($20, transmission),
       certified = COALESCE($21, certified),
       dealer_discount = COALESCE($22, dealer_discount),
       consumer_rebate = COALESCE($23, consumer_rebate),
       dealer_accessories = COALESCE($24, dealer_accessories),
       total_customer_savings = COALESCE($25, total_customer_savings),
       total_dealer_rebate = COALESCE($26, total_dealer_rebate),
       other_price = COALESCE($27, other_price),
       description = COALESCE($28, description),
       features = COALESCE($29, features),
       updated_at = NOW()
       WHERE id = $30
       RETURNING *`,
      [vin, make, model, year, status, new_used, stock_number, series, trim, body_style, vehicle_type,
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
    
    // Check if vehicle belongs to this dealer (super admin should NOT delete)
    let deleteQuery;
    let params;
    
    if (req.user.dealer_id) {
      deleteQuery = 'DELETE FROM vehicles WHERE id = $1 AND dealer_id = $2 RETURNING id';
      params = [vehicleId, req.user.dealer_id];
    } else {
      return res.status(403).json({ error: 'Dealer access required to delete vehicles' });
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
    
    // Check if vehicle belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT id FROM vehicles WHERE id = $1 AND dealer_id = $2',
      [vehicleId, req.user.dealer_id]
    );
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Get frontend URL from environment or use default
    // Note: Since the app uses HashRouter, we need to include the # fragment
    let frontendBaseURL = process.env.FRONTEND_URL || process.env.BACKEND_URL?.replace('/api', '') || 'http://localhost:8080';
    
    // Add hash fragment for HashRouter if not already present
    if (!frontendBaseURL.includes('#')) {
      frontendBaseURL = frontendBaseURL + '#';
    }
    
    // Get vehicle data for VIN-based QR code
    const vehicleData = await query(
      'SELECT v.*, d.business_name FROM vehicles v LEFT JOIN dealers d ON v.dealer_id = d.id WHERE v.id = $1',
      [vehicleId]
    );
    
    // Generate QR code with vehicle data
    const qrCodeUrl = await generateVehicleQRCodeWithURL(vehicleId, frontendBaseURL, vehicleData.rows[0]);
    
    // Update vehicle with QR code URL
    await query(
      'UPDATE vehicles SET qr_code_url = $1, sticker_generation_status = $2, sticker_generated_at = NOW(), updated_at = NOW() WHERE id = $3',
      [qrCodeUrl, 'generated', vehicleId]
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

// Mark sticker as printed for a vehicle
router.post('/:id/mark-sticker-printed', async (req, res) => {
  try {
    const vehicleId = req.params.id;
    const userId = req.user.id;
    
    // Check if vehicle belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT id, qr_code_url FROM vehicles WHERE id = $1 AND dealer_id = $2',
      [vehicleId, req.user.dealer_id]
    );
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const vehicle = vehicleCheck.rows[0];
    
    // Check if vehicle has a QR code
    if (!vehicle.qr_code_url) {
      return res.status(400).json({ error: 'Vehicle must have a QR code before marking sticker as printed' });
    }
    
    // Update vehicle sticker status to 'printed' and set printed timestamp
    await query(
      'UPDATE vehicles SET sticker_generation_status = $1, sticker_printed_at = NOW(), updated_at = NOW() WHERE id = $2',
      ['printed', vehicleId]
    );
    
    res.json({ 
      success: true, 
      message: 'Sticker marked as printed successfully' 
    });
  } catch (error) {
    console.error('Mark sticker as printed error:', error);
    res.status(500).json({ error: 'Failed to mark sticker as printed' });
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
    
    // Check if vehicles belong to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT id FROM vehicles WHERE id = ANY($1) AND dealer_id = $2',
      [vehicleIds, req.user.dealer_id]
    );
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'No vehicles found' });
    }
    
    // Get frontend URL from environment or use default
    // Note: Since the app uses HashRouter, we need to include the # fragment
    let frontendBaseURL = process.env.FRONTEND_URL || process.env.BACKEND_URL?.replace('/api', '') || 'http://localhost:8080';
    
    // Add hash fragment for HashRouter if not already present
    if (!frontendBaseURL.includes('#')) {
      frontendBaseURL = frontendBaseURL + '#';
    }
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
          'UPDATE vehicles SET qr_code_url = $1, sticker_generation_status = $2, sticker_generated_at = NOW(), updated_at = NOW() WHERE id = $3',
          [qrCodeUrl, 'generated', vehicleId]
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
    
    // Check if vehicle belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT id FROM vehicles WHERE id = $1 AND dealer_id = $2',
      [vehicleId, req.user.dealer_id]
    );
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    // Get vehicle data for QR code deletion
    const vehicleData = await query('SELECT vin, dealer_id FROM vehicles WHERE id = $1', [vehicleId]);
    const vin = vehicleData.rows[0]?.vin;
    const dealerId = vehicleData.rows[0]?.dealer_id;
    
    // Delete QR code file
    await deleteQRCode(vehicleId, dealerId, vin);
    
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
    
    // Check if vehicle belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT id FROM vehicles WHERE id = $1 AND dealer_id = $2',
      [vehicleId, req.user.dealer_id]
    );
    
    if (vehicleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' });
    }
    
    // Get current images
    const currentResult = await query('SELECT photo_url_list FROM vehicles WHERE id = $1', [vehicleId]);
    const currentImages = currentResult.rows[0]?.photo_url_list || [];
    
    // Upload to Cloudinary and get URLs
    console.log(`📤 Uploading ${req.files.length} images to Cloudinary for vehicle ${vehicleId}...`);
    const uploadPromises = req.files.map(file => 
      uploadToCloudinary(file.path, vehicleId, req.user.dealer_id)
    );
    const uploadedImages = await Promise.all(uploadPromises);
    
    // Combine with existing images
    const allImages = [...currentImages, ...uploadedImages];
    
    // Update vehicle with new images
    await query(
      'UPDATE vehicles SET photo_url_list = $1, updated_at = NOW() WHERE id = $2',
      [allImages, vehicleId]
    );
    
    console.log(`✅ Successfully uploaded ${uploadedImages.length} images to Cloudinary`);
    
    res.json({ 
      success: true, 
      images: uploadedImages,
      allImages: allImages,
      message: `${req.files.length} image(s) uploaded successfully to Cloudinary` 
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
    
    // Check if vehicle belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT photo_url_list FROM vehicles WHERE id = $1 AND dealer_id = $2',
      [vehicleId, req.user.dealer_id]
    );
    
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
    
    // Check if vehicle belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleCheck = await query(
      'SELECT photo_url_list FROM vehicles WHERE id = $1 AND dealer_id = $2',
      [vehicleId, req.user.dealer_id]
    );
    
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
    console.log('Correct features endpoint called');
    const userId = req.user.id;
    console.log('User ID:', userId, 'Role:', req.user.role);
    
    // Get all vehicles for this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehiclesQuery = `
      SELECT id, features 
      FROM vehicles 
      WHERE dealer_id = $1 AND features IS NOT NULL
    `;
    const vehiclesParams = [req.user.dealer_id];
    
    console.log('Executing query:', vehiclesQuery, 'with params:', vehiclesParams);
    const vehiclesResult = await query(vehiclesQuery, vehiclesParams);
    console.log('Found vehicles:', vehiclesResult.rows.length);
    
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
    
    
    console.log('Processing complete. Updated count:', updatedCount);
    
    res.json({
      success: true,
      updatedCount,
      totalVehicles: vehiclesResult.rows.length
    });
  } catch (error) {
    console.error('Correct features error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to correct feature formats',
      details: error.message 
    });
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
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehicleQuery = `
      SELECT id, photo_url_list 
      FROM vehicles 
      WHERE id = $1 AND dealer_id = $2 AND photo_url_list IS NOT NULL AND photo_url_list != '{}'
    `;
    const vehicleParams = [vehicleId, req.user.dealer_id];
    
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

// Update trim and type data for all vehicles
router.post('/update-trim-type', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all vehicles for this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const vehiclesQuery = `
      SELECT id, make, model, trim, vehicle_type, body_style, price 
      FROM vehicles 
      WHERE dealer_id = $1
    `;
    const vehiclesParams = [req.user.dealer_id];
    
    const vehiclesResult = await query(vehiclesQuery, vehiclesParams);
    const vehicles = vehiclesResult.rows;
    
    let updatedType = 0;
    let updatedTrim = 0;
    
    for (const vehicle of vehicles) {
      let needsTypeUpdate = !vehicle.vehicle_type || vehicle.vehicle_type.trim() === '';
      let needsTrimUpdate = !vehicle.trim || vehicle.trim.trim() === '';
      
      if (needsTypeUpdate || needsTrimUpdate) {
        let updateFields = [];
        let updateValues = [];
        let paramIndex = 1;
        
        // Update vehicle_type based on body_style if missing
        if (needsTypeUpdate) {
          let vehicleType = 'sedan'; // default
          
          if (vehicle.body_style) {
            switch (vehicle.body_style) {
              case '4D Sport Utility':
                vehicleType = 'SUV';
                break;
              case '4D Sedan':
                vehicleType = 'sedan';
                break;
              case '2D Coupe':
                vehicleType = 'coupe';
                break;
              case '4D Hatchback':
              case '5D Hatchback':
                vehicleType = 'hatchback';
                break;
              case '2D Convertible':
                vehicleType = 'convertible';
                break;
              case '4D Crew Cab':
              case '2D Standard Cab':
              case '4D SuperCrew':
                vehicleType = 'truck';
                break;
              case '4D Passenger Van':
                vehicleType = 'van';
                break;
            }
          }
          
          updateFields.push(`vehicle_type = $${paramIndex}`);
          updateValues.push(vehicleType);
          paramIndex++;
          updatedType++;
        }
        
        // Update trim based on make, model, and price if missing
        if (needsTrimUpdate) {
          let trim = 'Base'; // default
          
          if (vehicle.make && vehicle.model && vehicle.price) {
            const make = vehicle.make.toLowerCase();
            const model = vehicle.model.toLowerCase();
            const price = parseFloat(vehicle.price) || 0;
            
            // Toyota models
            if (make.includes('toyota')) {
              if (model.includes('rav4')) {
                if (price >= 40000) trim = 'Limited';
                else if (price >= 35000) trim = 'XLE Premium';
                else if (price >= 30000) trim = 'XLE';
                else if (price >= 25000) trim = 'LE';
              } else if (model.includes('camry')) {
                if (price >= 40000) trim = 'XSE V6';
                else if (price >= 35000) trim = 'XLE';
                else if (price >= 30000) trim = 'SE';
                else if (price >= 25000) trim = 'LE';
              } else if (model.includes('corolla')) {
                if (price >= 30000) trim = 'SE';
                else if (price >= 25000) trim = 'LE';
              } else if (model.includes('highlander')) {
                if (price >= 50000) trim = 'Platinum';
                else if (price >= 45000) trim = 'Limited';
                else if (price >= 40000) trim = 'XLE';
                else if (price >= 35000) trim = 'LE';
              }
            }
            // Honda models
            else if (make.includes('honda')) {
              if (model.includes('cr-v')) {
                if (price >= 40000) trim = 'Touring';
                else if (price >= 35000) trim = 'EX-L';
                else if (price >= 30000) trim = 'EX';
                else if (price >= 25000) trim = 'LX';
              } else if (model.includes('accord')) {
                if (price >= 40000) trim = 'Touring';
                else if (price >= 35000) trim = 'EX-L';
                else if (price >= 30000) trim = 'EX';
                else if (price >= 25000) trim = 'LX';
              } else if (model.includes('pilot')) {
                if (price >= 50000) trim = 'Elite';
                else if (price >= 45000) trim = 'Touring';
                else if (price >= 40000) trim = 'EX-L';
                else if (price >= 35000) trim = 'EX';
              }
            }
            // Hyundai models
            else if (make.includes('hyundai')) {
              if (model.includes('tucson')) {
                if (price >= 40000) trim = 'Limited';
                else if (price >= 35000) trim = 'SEL Convenience';
                else if (price >= 30000) trim = 'SEL';
                else if (price >= 25000) trim = 'SE';
              } else if (model.includes('santa fe')) {
                if (price >= 50000) trim = 'Calligraphy';
                else if (price >= 45000) trim = 'Limited';
                else if (price >= 40000) trim = 'SEL Premium';
                else if (price >= 35000) trim = 'SEL';
              } else if (model.includes('palisade')) {
                if (price >= 55000) trim = 'Calligraphy';
                else if (price >= 50000) trim = 'Limited';
                else if (price >= 45000) trim = 'SEL Premium';
                else if (price >= 40000) trim = 'SEL';
              }
            }
            // Ford models
            else if (make.includes('ford')) {
              if (model.includes('escape')) {
                if (price >= 40000) trim = 'Titanium';
                else if (price >= 35000) trim = 'SE';
                else if (price >= 30000) trim = 'S';
              } else if (model.includes('explorer')) {
                if (price >= 50000) trim = 'Platinum';
                else if (price >= 45000) trim = 'Limited';
                else if (price >= 40000) trim = 'XLT';
              } else if (model.includes('f-150')) {
                if (price >= 60000) trim = 'Platinum';
                else if (price >= 50000) trim = 'Lariat';
                else if (price >= 40000) trim = 'XLT';
                else if (price >= 35000) trim = 'STX';
              }
            }
            // Default logic based on price
            else {
              if (price >= 50000) trim = 'Premium';
              else if (price >= 40000) trim = 'Limited';
              else if (price >= 35000) trim = 'SE';
              else if (price >= 30000) trim = 'LE';
              else if (price >= 25000) trim = 'Base';
            }
          }
          
          updateFields.push(`trim = $${paramIndex}`);
          updateValues.push(trim);
          paramIndex++;
          updatedTrim++;
        }
        
        if (updateFields.length > 0) {
          updateFields.push(`updated_at = NOW()`);
          updateValues.push(vehicle.id);
          
          await query(
            `UPDATE vehicles SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
            updateValues
          );
        }
      }
    }
    
    res.json({
      success: true,
      stats: {
        updatedType,
        updatedTrim,
        totalVehicles: vehicles.length
      },
      message: `Updated ${updatedType} vehicle types and ${updatedTrim} vehicle trims`
    });
  } catch (error) {
    console.error('Update trim type error:', error);
    res.status(500).json({ 
      error: 'Failed to update vehicle trim and type data',
      details: error.message 
    });
  }
});

// Generate PDF from sticker HTML
router.post('/generate-sticker-pdf', async (req, res) => {
  try {
    const { html, pageWidth, pageHeight } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    const htmlPdf = await import('html-pdf-node');

    const file = { content: html };
    const options = {
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    };

    // Use explicit width/height for custom label sizes (e.g. Phomemo 75mm × 75mm)
    // Fall back to Letter for standard templates
    if (pageWidth && pageHeight) {
      options.width = pageWidth;
      options.height = pageHeight;
    } else {
      options.format = 'Letter';
    }

    const pdfBuffer = await htmlPdf.default.generatePdf(file, options);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="qr-stickers.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating sticker PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
});

// Get unique makes for filter dropdown
router.get('/makes', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.json({ makes: [] });
    }

    const result = await query(`
      SELECT DISTINCT make 
      FROM vehicles 
      WHERE dealer_id = $1 
        AND make IS NOT NULL 
        AND make != ''
      ORDER BY make ASC
    `, [dealerId]);

    res.json({ makes: result.rows.map(row => row.make) });
  } catch (error) {
    console.error('Get makes error:', error);
    res.status(500).json({ error: 'Failed to fetch makes' });
  }
});

// Get unique models for filter dropdown (optionally filtered by make)
router.get('/models', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const make = req.query.make || '';
    
    if (!dealerId) {
      return res.json({ models: [] });
    }

    let queryText = `
      SELECT DISTINCT model 
      FROM vehicles 
      WHERE dealer_id = $1 
        AND model IS NOT NULL 
        AND model != ''
    `;
    const params = [dealerId];

    if (make) {
      queryText += ` AND make = $2`;
      params.push(make);
    }

    queryText += ` ORDER BY model ASC`;

    const result = await query(queryText, params);

    res.json({ models: result.rows.map(row => row.model) });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Get unique years for filter dropdown
router.get('/years', async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    
    if (!dealerId) {
      return res.json({ years: [] });
    }

    const result = await query(`
      SELECT DISTINCT year 
      FROM vehicles 
      WHERE dealer_id = $1 
        AND year IS NOT NULL
      ORDER BY year DESC
    `, [dealerId]);

    res.json({ years: result.rows.map(row => row.year.toString()) });
  } catch (error) {
    console.error('Get years error:', error);
    res.status(500).json({ error: 'Failed to fetch years' });
  }
});

export default router;
