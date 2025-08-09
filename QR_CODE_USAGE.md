# QR Code Usage Guide for Dealers

## Overview
QR codes are generated for each vehicle in your inventory and can be printed as stickers to place on vehicle windows. When customers scan these QR codes with their smartphones, they'll see detailed vehicle information.

## How QR Codes Work

### 1. **Encrypted Vehicle Identification**
- QR codes are generated using encrypted vehicle identifiers (hashes)
- This ensures unique identification while protecting sensitive VIN information
- Vehicle data is encrypted using AES-256-CBC with a secret key

### 2. **QR Code Generation**
- QR codes are automatically generated when you create or update vehicles
- Each QR code contains a direct link to the vehicle's public details page
- QR codes are optimized for outdoor scanning with high error correction

### 3. **Customer Experience**
When customers scan a QR code:
- They're taken to a mobile-friendly vehicle details page
- They can see all vehicle specifications, images, and pricing
- They can contact the dealer directly through the page
- The page shows which dealer the vehicle belongs to

## Printing QR Codes

### Recommended Specifications:
- **Size**: 3" x 3" (minimum) for easy scanning
- **Material**: Weather-resistant vinyl stickers
- **Placement**: Driver's side window or windshield
- **Quantity**: One QR code per vehicle

### QR Code File Location:
- QR codes are saved as PNG files in `/uploads/qr-codes/`
- Filename format: `vehicle-{hash}-qr.png` (encrypted)
- Access via: `http://localhost:3000/uploads/qr-codes/vehicle-{hash}-qr.png`

## Managing QR Codes

### Generate QR Code:
1. Go to Vehicles page
2. Click the QR code icon on any vehicle
3. QR code will be generated and saved automatically

### Bulk Generate QR Codes:
1. Select multiple vehicles using checkboxes
2. Click "Generate QR Codes" in bulk actions
3. All selected vehicles will get QR codes generated

### Delete QR Code:
1. Click the delete icon on the QR code
2. QR code file will be removed from server
3. Vehicle will no longer have an associated QR code

## Technical Details

### QR Code URL Format:
- **Encrypted**: `http://localhost:8080/vehicle/qr/{hash}` (secure)
- **VIN-based**: `http://localhost:8080/vehicle/vin/{VIN}` (legacy)
- **ID-based**: `http://localhost:8080/vehicle/{ID}` (fallback)

### QR Code Specifications:
- **Error Correction**: High (H) - for outdoor/printed use
- **Size**: 400x400 pixels
- **Format**: PNG
- **Margin**: 2 units for better scanning

## Best Practices

1. **Always include VIN**: Ensure all vehicles have VIN numbers for proper QR code generation (VIN is encrypted in the QR code)
2. **Regular updates**: Regenerate QR codes if vehicle information changes significantly
3. **Quality printing**: Use high-quality printers for clear, scannable QR codes
4. **Placement**: Place QR codes where they're easily accessible but won't obstruct driving
5. **Testing**: Test QR codes with different smartphones before placing on vehicles

## Troubleshooting

### QR Code Not Scanning:
- Check if QR code is printed clearly
- Ensure adequate lighting when scanning
- Verify QR code file exists on server
- Regenerate QR code if needed

### Vehicle Not Found:
- Verify VIN number is correct in database
- Check if vehicle status is "available"
- Ensure vehicle belongs to the correct dealer

### QR Code Generation Fails:
- Check server logs for errors
- Verify vehicle has a VIN number
- Ensure uploads directory has write permissions 