/**
 * Cloudinary Upload Service
 * 
 * Handles file uploads to Cloudinary cloud storage
 */

import cloudinary from '../config/cloudinaryConfig.js';
import fs from 'fs';
import path from 'path';

class CloudinaryService {
  /**
   * Upload an image to Cloudinary
   * @param {string} filePath - Local file path
   * @param {string} folder - Cloudinary folder (e.g., 'vehicle-images')
   * @param {object} options - Additional upload options
   * @returns {Promise<object>} Upload result with secure_url
   */
  async uploadImage(filePath, folder = 'uploads', options = {}) {
    try {
      // If dealerId is provided, organize by dealer folder
      const finalFolder = options.dealerId 
        ? `dealer-${options.dealerId}/${folder}` 
        : folder;

      const result = await cloudinary.uploader.upload(filePath, {
        folder: finalFolder,
        resource_type: 'image',
        ...options
      });

      // Delete local file after successful upload (optional)
      if (options.deleteLocal !== false) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted local file: ${filePath}`);
        } catch (err) {
          console.warn(`⚠️ Could not delete local file: ${filePath}`, err.message);
        }
      }

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        width: result.width,
        height: result.height,
        size: result.bytes
      };
    } catch (error) {
      console.error('❌ Cloudinary upload error:', error);
      throw new Error(`Failed to upload to Cloudinary: ${error.message}`);
    }
  }

  /**
   * Upload a file (PDF, document, etc.) to Cloudinary
   * @param {string} filePath - Local file path
   * @param {string} folder - Cloudinary folder
   * @param {object} options - Additional upload options
   * @returns {Promise<object>} Upload result
   */
  async uploadFile(filePath, folder = 'documents', options = {}) {
    try {
      // If dealerId is provided, organize by dealer folder
      const finalFolder = options.dealerId 
        ? `dealer-${options.dealerId}/${folder}` 
        : folder;

      const result = await cloudinary.uploader.upload(filePath, {
        folder: finalFolder,
        resource_type: 'raw', // For non-image files
        ...options
      });

      // Delete local file after successful upload (optional)
      if (options.deleteLocal !== false) {
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted local file: ${filePath}`);
        } catch (err) {
          console.warn(`⚠️ Could not delete local file: ${filePath}`, err.message);
        }
      }

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes
      };
    } catch (error) {
      console.error('❌ Cloudinary file upload error:', error);
      throw new Error(`Failed to upload file to Cloudinary: ${error.message}`);
    }
  }

  /**
   * Upload multiple images at once
   * @param {Array<string>} filePaths - Array of local file paths
   * @param {string} folder - Cloudinary folder
   * @param {object} options - Additional upload options
   * @returns {Promise<Array>} Array of upload results
   */
  async uploadMultipleImages(filePaths, folder = 'uploads', options = {}) {
    try {
      const uploadPromises = filePaths.map(filePath => 
        this.uploadImage(filePath, folder, options)
      );
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('❌ Multiple upload error:', error);
      throw error;
    }
  }

  /**
   * Delete an image from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<object>} Deletion result
   */
  async deleteImage(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return {
        success: result.result === 'ok',
        result: result.result
      };
    } catch (error) {
      console.error('❌ Cloudinary delete error:', error);
      throw new Error(`Failed to delete from Cloudinary: ${error.message}`);
    }
  }

  /**
   * Delete a file (non-image) from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @returns {Promise<object>} Deletion result
   */
  async deleteFile(publicId) {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'raw'
      });
      return {
        success: result.result === 'ok',
        result: result.result
      };
    } catch (error) {
      console.error('❌ Cloudinary file delete error:', error);
      throw new Error(`Failed to delete file from Cloudinary: ${error.message}`);
    }
  }

  /**
   * Get optimized image URL with transformations
   * @param {string} publicId - Cloudinary public ID
   * @param {object} transformations - Transformation options
   * @returns {string} Optimized image URL
   */
  getOptimizedUrl(publicId, transformations = {}) {
    return cloudinary.url(publicId, {
      fetch_format: 'auto',
      quality: 'auto',
      ...transformations
    });
  }

  /**
   * Generate thumbnail URL
   * @param {string} publicId - Cloudinary public ID
   * @param {number} width - Thumbnail width
   * @param {number} height - Thumbnail height
   * @returns {string} Thumbnail URL
   */
  getThumbnailUrl(publicId, width = 200, height = 200) {
    return cloudinary.url(publicId, {
      width: width,
      height: height,
      crop: 'fill',
      fetch_format: 'auto',
      quality: 'auto'
    });
  }
}

export default new CloudinaryService();
