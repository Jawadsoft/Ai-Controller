# Cloudinary Dealer-Specific Folder Structure

## ✅ Updated: Organized by Dealership

Your Cloudinary integration has been updated to organize all files by dealership. Each dealer now has their own isolated folder structure!

## New Folder Structure

```
Cloudinary Root
├── dealer-{dealer_id_1}/
│   ├── vehicle-images/
│   │   ├── vehicle-abc-123.jpg
│   │   └── vehicle-def-456.jpg
│   ├── staff-photos/
│   │   ├── staff-1-timestamp.jpg
│   │   └── staff-2-timestamp.jpg
│   ├── qr-codes/
│   │   ├── vehicle-hash-qr.png
│   │   └── dealer-hash-qr.png
│   ├── deal-sheets/ (future)
│   ├── credit-applications/ (future)
│   └── carfax-pdfs/ (future)
│
├── dealer-{dealer_id_2}/
│   ├── vehicle-images/
│   ├── staff-photos/
│   ├── qr-codes/
│   └── ...
│
└── dealer-{dealer_id_3}/
    ├── vehicle-images/
    ├── staff-photos/
    └── ...
```

## Benefits

### 1. **Multi-Tenancy** 🏢
- Perfect for multi-dealership CRM
- Each dealer's files are completely isolated
- Easy to manage permissions per dealer

### 2. **Organization** 📁
- Find dealer files instantly
- No mixing of dealer assets
- Clear hierarchy

### 3. **Scalability** 📈
- Supports unlimited dealerships
- Easy to add/remove dealers
- No naming conflicts

### 4. **Billing & Usage Tracking** 💰
- Track storage per dealer
- Analyze usage per dealership
- Easy cost allocation

### 5. **Data Export** 📦
- Export one dealer's files easily
- Backup per dealership
- Simple migration if dealer leaves

## Example URLs

### Vehicle Image
```
https://res.cloudinary.com/xnct4ilr/image/upload/
  dealer-uuid-123/vehicle-images/vehicle-abc-456.jpg
```

### Staff Photo
```
https://res.cloudinary.com/xnct4ilr/image/upload/
  dealer-uuid-123/staff-photos/staff-5-1234567890.jpg
```

### QR Code
```
https://res.cloudinary.com/xnct4ilr/image/upload/
  dealer-uuid-123/qr-codes/vehicle-hash-qr.png
```

## How It Works

### Vehicle Image Upload
```javascript
// Automatically organized by dealer
uploadToCloudinary(filePath, vehicleId, req.user.dealer_id)
// → dealer-{dealerId}/vehicle-images/...
```

### Staff Photo Upload
```javascript
// Uses dealer_id from authenticated user
cloudinaryService.uploadImage(filePath, 'staff-photos', { 
  dealerId: dealerId 
})
// → dealer-{dealerId}/staff-photos/...
```

### QR Code Generation
```javascript
// Uses dealer_id from vehicle data
cloudinaryService.uploadImage(filepath, 'qr-codes', { 
  dealerId: dealerId 
})
// → dealer-{dealerId}/qr-codes/...
```

## Migration Note

**For Existing Files:**
- Old files without dealer folders will continue to work
- New uploads will use the dealer folder structure
- Both URL patterns are supported simultaneously

**Old Format:**
```
https://res.cloudinary.com/xnct4ilr/image/upload/vehicle-images/car.jpg
```

**New Format:**
```
https://res.cloudinary.com/xnct4ilr/image/upload/dealer-123/vehicle-images/car.jpg
```

## What's Updated

### Files Modified:
1. ✅ `src/lib/cloudinaryService.js` - Added dealerId folder logic
2. ✅ `src/lib/imageUpload.js` - Pass dealerId for vehicle images
3. ✅ `src/routes/vehicles.js` - Pass dealer_id to upload function
4. ✅ `src/lib/qrCodeGenerator.js` - Use dealerId for QR codes
5. ✅ `src/routes/staff.js` - Use dealerId for staff photos
6. ✅ `src/config/cloudinaryConfig.js` - Updated documentation

## Future Additions

Ready to add with dealer folders:
- Deal sheets: `dealer-{id}/deal-sheets/`
- Credit apps: `dealer-{id}/credit-applications/`
- Carfax PDFs: `dealer-{id}/carfax-pdfs/`
- ETL docs: `dealer-{id}/etl-documents/`
- Audio files: `dealer-{id}/daive-audio/`

## Testing

After deploying, new uploads will automatically use dealer folders:

1. **Upload vehicle image** → Check URL contains `dealer-{uuid}/vehicle-images/`
2. **Upload staff photo** → Check URL contains `dealer-{uuid}/staff-photos/`
3. **Generate QR code** → Check URL contains `dealer-{uuid}/qr-codes/`

## Cloudinary Dashboard

In your Cloudinary dashboard, you'll see:
- Top-level folders named `dealer-{uuid}`
- Each dealer folder contains organized subfolders
- Easy to browse by dealership

---

**Status**: ✅ **Fully Implemented**

All new uploads are now organized by dealership for better multi-tenancy support!
