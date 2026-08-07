import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import cloudinaryService from './cloudinaryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Cloudinary for QR codes
const USE_CLOUDINARY = process.env.USE_CLOUDINARY !== 'false'; // Default to true

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const qrCodesDir = path.join(uploadsDir, 'qr-codes');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(qrCodesDir)) {
  fs.mkdirSync(qrCodesDir, { recursive: true });
}

// Secret key for encryption (in production, this should be in environment variables)
const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY || 'dealer-iq-qr-secret-key-2024';
const ALGORITHM = 'aes-256-cbc';

// Generate a proper 32-byte key from the encryption key
const getEncryptionKey = () => {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

// Encrypt vehicle and dealer data
export const encryptVehicleData = (vehicleId, dealerId, vin = null) => {
  try {
    const data = JSON.stringify({ 
      vehicleId, 
      dealerId, 
      vin,
      timestamp: Date.now() 
    });
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data (IV:encrypted)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback to simple hash if encryption fails
    return crypto.createHash('sha256').update(`${vehicleId}-${dealerId}-${vin || 'unknown'}`).digest('hex').substring(0, 16);
  }
};

// Decrypt vehicle data
export const decryptVehicleData = (encryptedData) => {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Generate a secure hash for vehicle and dealer identification
export const generateVehicleHash = (vehicleId, dealerId, vin = null) => {
  const data = `${vehicleId}-${dealerId}-${vin || 'unknown'}-${ENCRYPTION_KEY}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

export const generateVehicleQRCode = async (vehicleId, vehicleData) => {
  try {
    // Create QR code data - this will be the URL that customers scan
    const qrData = {
      vehicleId,
      type: 'vehicle',
      timestamp: new Date().toISOString(),
      // Add any other data you want to include in the QR code
    };

    // Convert to JSON string
    const qrString = JSON.stringify(qrData);

    // Generate QR code as data URL
    const qrDataURL = await QRCode.toDataURL(qrString, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 300
    });

    // Convert data URL to buffer
    const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filename
    const filename = `vehicle-${vehicleId}-qr.png`;
    const filepath = path.join(qrCodesDir, filename);

    // Save file
    fs.writeFileSync(filepath, buffer);

    // Return the relative URL for the frontend
    return `/uploads/qr-codes/${filename}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

export const generateVehicleQRCodeWithURL = async (vehicleId, frontendBaseURL, vehicleData = null) => {
  try {
    let vehicleURL;
    let filename;
    
    // Ensure we have dealer_id from vehicleData
    const dealerId = vehicleData?.dealer_id || vehicleData?.dealerId;
    const vin = vehicleData?.vin;
    
    if (!dealerId) {
      throw new Error('Dealer ID is required for QR code generation');
    }
    
    // Generate encrypted data with vehicle_id, dealer_id, and VIN
    const encryptedData = encryptVehicleData(vehicleId, dealerId, vin);
    const vehicleHash = generateVehicleHash(vehicleId, dealerId, vin);
    
    // Use encrypted identifier in URL
    vehicleURL = `${frontendBaseURL}/vehicle/qr/${vehicleHash}`;
    filename = `vehicle-${vehicleHash}-qr.png`;
    
    // Generate QR code as data URL with higher error correction for outdoor use
    const qrDataURL = await QRCode.toDataURL(vehicleURL, {
      errorCorrectionLevel: 'H', // High error correction for outdoor/printed use
      type: 'image/png',
      quality: 0.92,
      margin: 2, // Slightly larger margin for better scanning
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 400 // Larger size for better scanning from car windows
    });

    // Convert data URL to buffer
    const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filepath
    const filepath = path.join(qrCodesDir, filename);

    // Save file locally first
    fs.writeFileSync(filepath, buffer);

    // Upload to Cloudinary if enabled
    if (USE_CLOUDINARY) {
      try {
        const result = await cloudinaryService.uploadImage(
          filepath,
          'qr-codes',
          { 
            public_id: `vehicle-${vehicleHash}-qr`,
            deleteLocal: true // Delete local file after upload
          }
        );
        console.log(`✅ QR code uploaded to Cloudinary: ${result.url}`);
        return result.url;
      } catch (error) {
        console.error('❌ Cloudinary upload failed for QR code, using local:', error);
        // Fallback to local URL if Cloudinary fails
        return `/uploads/qr-codes/${filename}`;
      }
    }

    // Return the relative URL for the frontend (local)
    return `/uploads/qr-codes/${filename}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

export const deleteQRCode = async (vehicleId, dealerId, vin = null) => {
  try {
    const vehicleHash = generateVehicleHash(vehicleId, dealerId, vin);
    const filename = `vehicle-${vehicleHash}-qr.png`;
    const filepath = path.join(qrCodesDir, filename);
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error deleting QR code:', error);
    return false;
  }
};

export const getQRCodePath = (vehicleId, dealerId, vin = null) => {
  const vehicleHash = generateVehicleHash(vehicleId, dealerId, vin);
  const filename = `vehicle-${vehicleHash}-qr.png`;
  return path.join(qrCodesDir, filename);
};

// Dealer Profile QR Code Functions

// Encrypt dealer profile data
export const encryptDealerData = (dealerId, stockNumber = null) => {
  try {
    const data = JSON.stringify({ 
      dealerId, 
      stockNumber,
      type: 'dealer_profile',
      timestamp: Date.now() 
    });
    
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data (IV:encrypted)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Dealer encryption error:', error);
    // Fallback to simple hash if encryption fails
    return crypto.createHash('sha256').update(`${dealerId}-${stockNumber || 'default'}`).digest('hex').substring(0, 16);
  }
};

// Decrypt dealer data
export const decryptDealerData = (encryptedData) => {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Dealer decryption error:', error);
    return null;
  }
};

// Generate a secure hash for dealer profile identification
export const generateDealerHash = (dealerId, stockNumber = null) => {
  const data = `${dealerId}-${stockNumber || 'default'}-${ENCRYPTION_KEY}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

// Generate dealer profile QR code with encrypted URL
export const generateDealerProfileQRCode = async (dealerId, frontendBaseURL, stockNumber = null) => {
  try {
    // Generate encrypted data with dealer_id and stock number
    const encryptedData = encryptDealerData(dealerId, stockNumber);
    const dealerHash = generateDealerHash(dealerId, stockNumber);
    
    // Use encrypted identifier in URL - should go to AI Bot, not dealer profile
    const dealerURL = `${frontendBaseURL}/aibot/dealer/qr/${dealerHash}${stockNumber ? `?stk=${stockNumber}` : ''}`;
    const filename = `dealer-${dealerHash}-qr.png`;
    
    // Generate QR code as data URL with higher error correction for outdoor use
    const qrDataURL = await QRCode.toDataURL(dealerURL, {
      errorCorrectionLevel: 'H', // High error correction for outdoor/printed use
      type: 'image/png',
      quality: 0.92,
      margin: 2, // Slightly larger margin for better scanning
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 400 // Larger size for better scanning
    });

    // Convert data URL to buffer
    const base64Data = qrDataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate filepath
    const filepath = path.join(qrCodesDir, filename);

    // Save file locally first
    fs.writeFileSync(filepath, buffer);

    // Upload to Cloudinary if enabled
    if (USE_CLOUDINARY) {
      try {
        const result = await cloudinaryService.uploadImage(
          filepath,
          'qr-codes',
          { 
            public_id: `dealer-${dealerHash}-qr`,
            deleteLocal: true // Delete local file after upload
          }
        );
        console.log(`✅ Dealer QR code uploaded to Cloudinary: ${result.url}`);
        return result.url;
      } catch (error) {
        console.error('❌ Cloudinary upload failed for dealer QR code, using local:', error);
        // Fallback to local URL if Cloudinary fails
        return `/uploads/qr-codes/${filename}`;
      }
    }

    // Return the relative URL for the frontend (local)
    return `/uploads/qr-codes/${filename}`;
  } catch (error) {
    console.error('Error generating dealer profile QR code:', error);
    throw new Error('Failed to generate dealer profile QR code');
  }
}; 