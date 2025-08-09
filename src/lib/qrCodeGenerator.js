import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Encrypt vehicle data
export const encryptVehicleData = (vehicleId, vin) => {
  try {
    const data = JSON.stringify({ vehicleId, vin, timestamp: Date.now() });
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback to simple hash if encryption fails
    return crypto.createHash('sha256').update(`${vehicleId}-${vin}`).digest('hex').substring(0, 16);
  }
};

// Decrypt vehicle data
export const decryptVehicleData = (encryptedData) => {
  try {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Generate a secure hash for vehicle identification
export const generateVehicleHash = (vehicleId, vin) => {
  const data = `${vehicleId}-${vin}-${ENCRYPTION_KEY}`;
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
    
    if (vehicleData && vehicleData.vin) {
      // Generate encrypted vehicle identifier instead of showing raw VIN
      const encryptedData = encryptVehicleData(vehicleId, vehicleData.vin);
      const vehicleHash = generateVehicleHash(vehicleId, vehicleData.vin);
      
      // Use encrypted identifier in URL
      vehicleURL = `${frontendBaseURL}/vehicle/qr/${vehicleHash}`;
      filename = `vehicle-${vehicleHash}-qr.png`;
    } else {
      // Fallback to vehicle ID with encryption
      const encryptedData = encryptVehicleData(vehicleId, 'unknown');
      const vehicleHash = generateVehicleHash(vehicleId, 'unknown');
      
      vehicleURL = `${frontendBaseURL}/vehicle/qr/${vehicleHash}`;
      filename = `vehicle-${vehicleHash}-qr.png`;
    }
    
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

    // Save file
    fs.writeFileSync(filepath, buffer);

    // Return the relative URL for the frontend
    return `/uploads/qr-codes/${filename}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

export const deleteQRCode = async (vehicleId, vin = null) => {
  try {
    let filename;
    if (vin) {
      const vehicleHash = generateVehicleHash(vehicleId, vin);
      filename = `vehicle-${vehicleHash}-qr.png`;
    } else {
      const vehicleHash = generateVehicleHash(vehicleId, 'unknown');
      filename = `vehicle-${vehicleHash}-qr.png`;
    }
    
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

export const getQRCodePath = (vehicleId) => {
  const vehicleHash = generateVehicleHash(vehicleId, 'unknown');
  const filename = `vehicle-${vehicleHash}-qr.png`;
  return path.join(qrCodesDir, filename);
}; 