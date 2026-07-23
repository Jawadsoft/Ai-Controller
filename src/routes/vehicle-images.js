import express from 'express';
import { pool } from '../database/connection.js';

const router = express.Router();

// GET /api/vehicle-images/:vehicleId - Get all images for a specific vehicle
router.get('/:vehicleId', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    console.log(`🖼️ API: Fetching images for vehicle: ${vehicleId}`);
    
    // Validate vehicle ID
    if (!vehicleId || typeof vehicleId !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid vehicle ID',
        message: 'Vehicle ID must be a valid string'
      });
    }
    
    // Query vehicle photo from existing vehicles table
    const imageQuery = `
      SELECT 
        id, 
        photo_image_url, 
        make, 
        model, 
        year, 
        trim
      FROM vehicles 
      WHERE id = $1 AND photo_image_url IS NOT NULL
    `;
    
    const imageResult = await pool.query(imageQuery, [vehicleId]);
    const vehicle = imageResult.rows[0];
    
    if (!vehicle || !vehicle.photo_image_url) {
      return res.status(404).json({
        error: 'No images found',
        message: 'This vehicle has no photos available'
      });
    }
    
    // Split the photo_image_url if it contains multiple URLs (comma-separated)
    const imageUrls = vehicle.photo_image_url.split(',').map(url => url.trim()).filter(url => url);
    
    console.log(`🖼️ API: Found ${imageUrls.length} images for vehicle ${vehicleId}`);
    
    // Create image objects for each URL
    const formattedImages = imageUrls.map((url, index) => ({
      id: `${vehicleId}-img-${index}`,
      url: url,
      type: index === 0 ? 'exterior' : 'additional',
      caption: index === 0 ? 'Main Photo' : `Additional View ${index + 1}`,
      sortOrder: index,
      vehicleInfo: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim
      }
    }));
    
    res.json({
      success: true,
      vehicleId: vehicleId,
      imageCount: formattedImages.length,
      images: formattedImages,
      vehicleInfo: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim
      }
    });
    
  } catch (error) {
    console.error('❌ API Error fetching vehicle images:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch vehicle images',
      details: error.message
    });
  }
});

// GET /api/vehicle-images/:vehicleId/thumbnail - Get thumbnail image for a vehicle
router.get('/:vehicleId/thumbnail', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    console.log(`🖼️ API: Fetching thumbnail for vehicle: ${vehicleId}`);
    
    // Get the first available image as thumbnail from vehicles table
    const thumbnailQuery = `
      SELECT 
        id, 
        photo_image_url, 
        make, 
        model, 
        year, 
        trim
      FROM vehicles 
      WHERE id = $1 AND photo_image_url IS NOT NULL
    `;
    
    const thumbnailResult = await pool.query(thumbnailQuery, [vehicleId]);
    const vehicle = thumbnailResult.rows[0];
    
    if (!vehicle || !vehicle.photo_image_url) {
      return res.status(404).json({
        error: 'No thumbnail found',
        message: 'This vehicle has no photos available'
      });
    }
    
    // Get the first image URL (before first comma if multiple)
    const firstImageUrl = vehicle.photo_image_url.split(',')[0].trim();
    
    res.json({
      success: true,
      vehicleId: vehicleId,
      thumbnail: {
        id: `${vehicleId}-thumb`,
        url: firstImageUrl,
        type: 'exterior',
        caption: 'Main Photo'
      },
      vehicleInfo: {
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        trim: vehicle.trim
      }
    });
    
  } catch (error) {
    console.error('❌ API Error fetching vehicle thumbnail:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch vehicle thumbnail',
      details: error.message
    });
  }
});

// GET /api/vehicle-images/:vehicleId/count - Get image count for a vehicle
router.get('/:vehicleId/count', async (req, res) => {
  try {
    const { vehicleId } = req.params;
    
    console.log(`🖼️ API: Getting image count for vehicle: ${vehicleId}`);
    
    const countQuery = `
      SELECT photo_image_url
      FROM vehicles 
      WHERE id = $1 AND photo_image_url IS NOT NULL
    `;
    
    const countResult = await pool.query(countQuery, [vehicleId]);
    const vehicle = countResult.rows[0];
    
    if (!vehicle || !vehicle.photo_image_url) {
      return res.json({
        success: true,
        vehicleId: vehicleId,
        imageCount: 0
      });
    }
    
    // Count URLs by splitting on commas
    const imageUrls = vehicle.photo_image_url.split(',').map(url => url.trim()).filter(url => url);
    const imageCount = imageUrls.length;
    
    res.json({
      success: true,
      vehicleId: vehicleId,
      imageCount: imageCount
    });
    
  } catch (error) {
    console.error('❌ API Error getting vehicle image count:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get vehicle image count',
      details: error.message
    });
  }
});

export default router;
