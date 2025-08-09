import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export const deleteImage = async (imageUrl) => {
  try {
    if (!imageUrl) return false;
    
    // Extract filename from URL
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