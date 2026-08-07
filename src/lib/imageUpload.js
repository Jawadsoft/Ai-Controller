import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cloudinaryService from './cloudinaryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Cloudinary for uploads (set to true to enable)
const USE_CLOUDINARY = process.env.USE_CLOUDINARY !== 'false'; // Default to true

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const vehicleImagesDir = path.join(uploadsDir, 'vehicle-images');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(vehicleImagesDir)) {
  fs.mkdirSync(vehicleImagesDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vehicleImagesDir);
  },
  filename: (req, file, cb) => {
    const vehicleId = req.params.vehicleId || 'temp';
    const timestamp = Date.now();
    const fileExt = path.extname(file.originalname);
    const fileName = `vehicle-${vehicleId}-${timestamp}${fileExt}`;
    cb(null, fileName);
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files
  }
});

/**
 * Upload image to Cloudinary after multer processes it
 * @param {string} localPath - Local file path
 * @param {string} vehicleId - Vehicle ID for organization
 * @param {string} dealerId - Dealer ID for folder organization
 * @returns {Promise<string>} Cloudinary URL
 */
export const uploadToCloudinary = async (localPath, vehicleId = 'temp', dealerId = null) => {
  try {
    if (!USE_CLOUDINARY) {
      // Return local URL if Cloudinary is disabled
      const filename = path.basename(localPath);
      return `/uploads/vehicle-images/${filename}`;
    }

    const result = await cloudinaryService.uploadImage(
      localPath,
      'vehicle-images',
      { 
        public_id: `vehicle-${vehicleId}-${Date.now()}`,
        deleteLocal: true, // Delete local file after upload
        dealerId: dealerId // Organize by dealer folder
      }
    );

    console.log(`✅ Uploaded to Cloudinary: ${result.url}`);
    return result.url;
  } catch (error) {
    console.error('❌ Cloudinary upload failed, keeping local file:', error);
    // Fallback to local URL if Cloudinary fails
    const filename = path.basename(localPath);
    return `/uploads/vehicle-images/${filename}`;
  }
};

export const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl) return false;
    
    // Check if it's a Cloudinary URL
    if (imageUrl.includes('cloudinary.com')) {
      // Extract public ID from Cloudinary URL
      const parts = imageUrl.split('/');
      const filename = parts[parts.length - 1].split('.')[0];
      const folder = parts[parts.length - 2];
      const publicId = `${folder}/${filename}`;
      
      const result = await cloudinaryService.deleteImage(publicId);
      return result.success;
    }
    
    // Handle local file deletion
    const filename = path.basename(imageUrl);
    const filepath = path.join(vehicleImagesDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
};

export const deleteVehicleImages = async (vehicleId) => {
  try {
    const files = fs.readdirSync(vehicleImagesDir);
    const vehicleFiles = files.filter(file => file.startsWith(`vehicle-${vehicleId}-`));
    
    for (const file of vehicleFiles) {
      const filepath = path.join(vehicleImagesDir, file);
      fs.unlinkSync(filepath);
    }
    
    return vehicleFiles.length;
  } catch (error) {
    console.error('Error deleting vehicle images:', error);
    return 0;
  }
}; 