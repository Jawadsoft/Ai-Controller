# Cloudinary URL Handling Documentation

## Overview
This document explains how the application handles both Cloudinary URLs (absolute) and local file URLs (relative) across all components.

## The Core Fix

### `buildBackendAssetUrl` Function (src/lib/config.ts)

The central function that handles ALL asset URLs in the frontend:

```typescript
export const buildBackendAssetUrl = (path: string) => {
  // If path is already an absolute URL (Cloudinary, S3, etc.), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // In production, use the backend URL from environment or construct it
  if (import.meta.env.MODE === 'production') {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://vehicle-management-backend-ypsa.onrender.com';
    return `${backendUrl}/${cleanPath}`;
  }
  
  // Development: same-origin via Vite /uploads proxy
  return `/${cleanPath}`;
};
```

**Key Feature**: Automatically detects if a URL is already absolute (Cloudinary) and returns it unchanged.

---

## URL Handling by Component

### 1. Vehicle Images

#### **VehicleGrid.tsx** (Vehicle Cards)
- Uses `cleanImageUrl()` helper function
- Cleans corrupted URLs and handles both absolute and relative paths
- Images from Cloudinary: **Already absolute** → Displayed directly
- Local images: **Relative path** → Prepended with backend URL

#### **VehicleDetail.tsx** (Vehicle Detail Page)
- Uses `ImageCarousel` component
- Passes `photo_url_list` array directly
- `ImageCarousel` uses `cleanImageUrl()` to handle all URLs

#### **ImageCarousel.tsx** (Image Display Component)
- Uses `cleanImageUrl()` and `cleanImageUrls()` helpers
- Automatically detects absolute URLs (Cloudinary)
- Returns them unchanged if they start with `http://` or `https://`
- Cleans and validates all image URLs

#### **ImageUpload.tsx** (Image Upload Component)
- Uses `cleanImageUrl()` for all image URLs
- Handles both Cloudinary and local image previews
- Uploads return Cloudinary URLs which are stored as absolute paths

#### **VehicleForm.tsx** (Vehicle Edit Form)
- Uses `ImageUpload` component
- All images handled automatically by `ImageUpload`

---

### 2. QR Codes

#### **QRCodeGenerator.tsx**
```typescript
<img src={buildBackendAssetUrl(qrCodeUrl)} />
```
- Uses `buildBackendAssetUrl()` to handle both Cloudinary and local QR codes
- Cloudinary QR codes: **Absolute URL** → Returned as-is
- Local QR codes: **Relative path** → Prepended with backend URL

#### **QRCodeStickerModal.tsx**
```typescript
<img src={buildBackendAssetUrl(vehicle.qr_code_url)} />
```
- Same pattern: Uses `buildBackendAssetUrl()`
- Works for both Cloudinary and local QR codes

---

### 3. Staff Photos

#### **StaffManagement.tsx**
```typescript
const getStaffPhotoUrl = (photoUrl?: string | null) => {
  if (!photoUrl) return '';
  // Check if already absolute (Cloudinary)
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) 
    return photoUrl;
  // Otherwise, use backend URL builder
  return buildBackendAssetUrl(photoUrl);
};
```
- Has its own helper that mirrors `buildBackendAssetUrl` logic
- Explicitly checks for absolute URLs first
- Uses `buildBackendAssetUrl` for relative paths

#### **SalespersonProfile.tsx**
- Uses the same `getStaffPhotoUrl` helper
- Consistent URL handling across all staff photos

#### **DealerProfileSticker.tsx**
- Uses `buildBackendAssetUrl()` for all image URLs
- Handles both Cloudinary and local dealer photos

---

## URL Processing Flow

### Upload Flow:
1. **File Upload** → Backend receives file
2. **Cloudinary Upload** → Backend uploads to Cloudinary (if enabled)
3. **Database Storage** → Absolute Cloudinary URL saved to database
   - Example: `https://res.cloudinary.com/xnct4ilr/image/upload/v1234/dealer-123/vehicle-images/vehicle-456.jpg`
4. **Frontend Retrieval** → Gets absolute URL from API
5. **Display** → `buildBackendAssetUrl()` detects it's absolute → Returns unchanged

### Local Storage Flow (Fallback):
1. **File Upload** → Backend receives file
2. **Local Storage** → Saved to `/uploads/...` directory
3. **Database Storage** → Relative path saved
   - Example: `/uploads/vehicle-images/vehicle-456.jpg`
4. **Frontend Retrieval** → Gets relative path from API
5. **Display** → `buildBackendAssetUrl()` detects it's relative → Prepends backend URL
   - Result: `https://vehicle-management-backend-ypsa.onrender.com/uploads/vehicle-images/vehicle-456.jpg`

---

## Cloudinary Folder Structure

All uploads are organized by dealer:

```
Cloudinary Root
├── dealer-{dealerId}/
│   ├── vehicle-images/
│   ├── staff-photos/
│   ├── qr-codes/
│   ├── deal-sheets/
│   ├── credit-applications/
│   ├── carfax-pdfs/
│   ├── etl-documents/
│   └── daive-audio/
```

---

## Helper Functions Summary

### Frontend Helpers:

1. **`buildBackendAssetUrl(path)`** (config.ts)
   - Main URL builder
   - Detects absolute URLs
   - Adds backend URL for relative paths

2. **`cleanImageUrl(url)`** (Multiple components)
   - Cleans corrupted URLs
   - Removes @ symbols, prefixes, encoding issues
   - Returns absolute URLs unchanged

3. **`getStaffPhotoUrl(photoUrl)`** (Staff components)
   - Specific helper for staff photos
   - Checks for absolute URLs first
   - Falls back to `buildBackendAssetUrl`

---

## Environment Variables

### Frontend (.env or Vite config):
```env
VITE_BACKEND_URL=https://vehicle-management-backend-ypsa.onrender.com
```

### Backend (.env):
```env
CLOUDINARY_CLOUD_NAME=xnct4ilr
CLOUDINARY_API_KEY=891874126258663
CLOUDINARY_API_SECRET=x-mcKZewgiEal6mEbJ3m_7Q4wTA
USE_CLOUDINARY=true
```

---

## Testing Checklist

✅ **Vehicle Images**
- [x] Display correctly in Vehicle Grid
- [x] Display correctly in Vehicle Detail
- [x] Display correctly in Vehicle Edit Form
- [x] Upload to Cloudinary successfully
- [x] Organized in dealer-specific folders

✅ **QR Codes**
- [x] Generate and upload to Cloudinary
- [x] Display correctly in QR Code Generator
- [x] Display correctly in Sticker Modal
- [x] Download functionality works
- [x] Organized in dealer-specific folders

✅ **Staff Photos**
- [x] Upload to Cloudinary successfully
- [x] Display correctly in Staff Management
- [x] Display correctly in Salesperson Profile
- [x] Organized in dealer-specific folders

---

## Common Issues & Solutions

### Issue: Double URL (Backend URL + Cloudinary URL)
**Example**: `https://backend.com/https://cloudinary.com/image.jpg`

**Solution**: Fixed by updating `buildBackendAssetUrl()` to detect absolute URLs

### Issue: Image not loading
**Possible Causes**:
1. Missing Cloudinary environment variables
2. Invalid Cloudinary credentials
3. CORS issues (handled by `crossOrigin="anonymous"`)

**Solution**: Verify environment variables and check browser console

### Issue: Old images still showing local path
**Cause**: Images uploaded before Cloudinary integration

**Solution**: Re-upload images or run migration script to move existing images to Cloudinary

---

## Migration Notes

To migrate existing local images to Cloudinary:

1. Run the backend migration script (if available)
2. Or manually re-upload images through the UI
3. Old local images will continue to work (fallback mechanism)
4. New uploads automatically go to Cloudinary

---

## Performance Benefits

1. **CDN Delivery**: Cloudinary provides global CDN
2. **Automatic Optimization**: Images automatically compressed and optimized
3. **Transformations**: Can add image transformations via URL parameters
4. **Reduced Server Load**: Backend doesn't serve static files
5. **Better Scalability**: No disk space concerns on backend server

---

## Security

1. **Environment Variables**: Cloudinary credentials stored securely
2. **Dealer Isolation**: Each dealer has their own folder
3. **No Public Access**: Images are served through Cloudinary's secure URLs
4. **CORS Headers**: Properly configured for cross-origin image access

---

## Future Improvements

1. **Image Transformations**: Add responsive image sizes using Cloudinary transformations
2. **Lazy Loading**: Implement lazy loading for better performance
3. **Placeholder Images**: Use Cloudinary's blur placeholder feature
4. **Video Support**: Extend to support video uploads to Cloudinary
5. **Migration Script**: Automated script to move all existing local images to Cloudinary

---

Last Updated: Saturday, Aug 8, 2026
