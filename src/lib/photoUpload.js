import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const vehiclePhotosDir = path.join(uploadsDir, 'vehicle-photos');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(vehiclePhotosDir)) {
  fs.mkdirSync(vehiclePhotosDir, { recursive: true });
}

// Configure multer for photo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, vehiclePhotosDir);
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

export const deletePhoto = async (photoUrl) => {
  try {
    if (!photoUrl) return false;
    
    // Extract filename from URL
    const filename = path.basename(photoUrl);
    const filepath = path.join(vehiclePhotosDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting photo:', error);
    return false;
  }
};

export const deleteVehiclePhotos = async (vehicleId) => {
  try {
    const files = fs.readdirSync(vehiclePhotosDir);
    const vehicleFiles = files.filter(file => file.startsWith(`vehicle-${vehicleId}-`));
    
    for (const file of vehicleFiles) {
      const filepath = path.join(vehiclePhotosDir, file);
      fs.unlinkSync(filepath);
    }
    
    return vehicleFiles.length;
  } catch (error) {
    console.error('Error deleting vehicle photos:', error);
    return 0;
  }
}; 