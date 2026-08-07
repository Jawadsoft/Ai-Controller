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
 * - dealer-{dealerId}/vehicle-images/
 * - dealer-{dealerId}/staff-photos/
 * - dealer-{dealerId}/qr-codes/
 * - dealer-{dealerId}/deal-sheets/
 * - dealer-{dealerId}/credit-applications/
 * - dealer-{dealerId}/carfax-pdfs/
 * - dealer-{dealerId}/etl-documents/
 * - dealer-{dealerId}/daive-audio/
 * 
 * Each dealership gets its own organized folder structure
 */
