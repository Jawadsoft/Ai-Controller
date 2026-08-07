/**
 * Cloudinary Configuration
 * 
 * Cloud storage configuration for images, files, and QR codes
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'xnct4ilr',
  api_key: process.env.CLOUDINARY_API_KEY || '891874126258663',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'x-mcKZewgiEal6mEbJ3m_7Q4wTA',
  secure: true
});

export default cloudinary;

/**
 * Cloudinary folder structure:
 * - vehicle-images/
 * - staff-photos/
 * - qr-codes/
 * - deal-sheets/
 * - credit-applications/
 * - carfax-pdfs/
 * - etl-documents/
 * - daive-audio/
 */
