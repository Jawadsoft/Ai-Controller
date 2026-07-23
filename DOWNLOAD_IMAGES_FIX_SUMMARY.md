# Download Images Functionality Fix

## Issues Fixed

1. **Array vs String Format Handling**: The `photo_url_list` field is stored as a PostgreSQL array (`TEXT[]`), but the download implementation was treating it as a string and trying to split by comma.

2. **PostgreSQL Array Format**: PostgreSQL returns arrays as string representations like `{"url1","url2","url3"}`, which needed proper parsing.

3. **PostgreSQL Array Corruption**: Fixed issue where arrays were being stored as individual characters instead of proper strings.

4. **Database Query Conditions**: Updated the SQL queries to properly check for array length instead of string comparison.

5. **Delete All Images Bug**: Fixed a bug where the delete all images endpoint was using the wrong field name (`images` instead of `photo_url_list`).

6. **File Path Consistency**: Fixed the upload directory path to match the existing upload functionality (`/uploads/vehicle-images/` instead of `/uploads/vehicles/`).

7. **Unique Filename Generation**: Fixed the timestamp issue where all images were getting the same filename by adding the index to make each timestamp unique.

## Changes Made

### 1. Updated Download Images Endpoint (`src/routes/vehicles.js`)

**Before:**
```javascript
let images = vehicle.photo_url_list;
if (typeof images === 'string' && images.includes('http')) {
  // Parse comma-separated URLs
  const imageUrls = images.split(',').map(url => url.trim()).filter(url => url.startsWith('http'));
  // ... download logic
  const updatedImages = localImagePaths.join(',');
  await query('UPDATE vehicles SET photo_url_list = $1 WHERE id = $2', [updatedImages, vehicle.id]);
}
```

**After:**
```javascript
let images = vehicle.photo_url_list;

// Handle both array and string formats
let imageUrls = [];
if (Array.isArray(images)) {
  // If it's already an array, use it directly
  imageUrls = images.filter(url => url && typeof url === 'string' && url.includes('http'));
} else if (typeof images === 'string') {
  // Handle PostgreSQL array string format: {"url1","url2","url3"}
  if (images.startsWith('{') && images.endsWith('}')) {
    // Parse PostgreSQL array format
    const content = images.slice(1, -1); // Remove { and }
    imageUrls = content.split(',').map(url => url.trim().replace(/"/g, '')).filter(url => url.includes('http'));
  } else if (images.includes('http')) {
    // If it's a string, parse comma-separated URLs
    imageUrls = images.split(',').map(url => url.trim()).filter(url => url.startsWith('http'));
  }
}

// Additional check for corrupted array format (individual characters)
if (imageUrls.length === 0 && typeof images === 'string' && images.includes('"')) {
  // Try to extract URLs from the corrupted format
  const urlMatches = images.match(/https?:\/\/[^\s"{}]+/g);
  if (urlMatches) {
    imageUrls = urlMatches;
  }
}

// ... download logic for each URL with unique timestamps
const uniqueTimestamp = Date.now() + i; // Add index to make each timestamp unique

// Update vehicle with local image paths as proper PostgreSQL array
const arrayString = `{${localImagePaths.map(item => `"${item}"`).join(',')}}`;
await query('UPDATE vehicles SET photo_url_list = $1::text[] WHERE id = $2', [arrayString, vehicle.id]);
```

### 2. Updated Database Query Conditions

**Before:**
```sql
WHERE v.id = $1 AND d.user_id = $2 AND v.photo_url_list IS NOT NULL AND v.photo_url_list != ''
```

**After:**
```sql
WHERE v.id = $1 AND d.user_id = $2 AND v.photo_url_list IS NOT NULL AND v.photo_url_list != '{}'
```

### 3. Fixed File Path Consistency

**Before:**
```javascript
const uploadsDir = path.join(process.cwd(), 'uploads', 'vehicles');
localImagePaths.push(`/uploads/vehicles/${filename}`);
```

**After:**
```javascript
const uploadsDir = path.join(process.cwd(), 'uploads', 'vehicle-images');
localImagePaths.push(`/uploads/vehicle-images/${filename}`);
```

### 4. Fixed Delete All Images Endpoint

**Before:**
```javascript
const currentImages = vehicleCheck.rows[0].images || [];
await query('UPDATE vehicles SET photo_url_list = NULL, updated_at = NOW() WHERE id = $2', [vehicleId]);
```

**After:**
```javascript
const currentImages = vehicleCheck.rows[0].photo_url_list || [];
await query('UPDATE vehicles SET photo_url_list = NULL, updated_at = NOW() WHERE id = $1', [vehicleId]);
```

## How It Works Now

1. **Multiple Image Support**: The endpoint now properly handles multiple images stored as a PostgreSQL array
2. **PostgreSQL Array Parsing**: Correctly parses PostgreSQL array format `{url1,url2,url3}`
3. **Corruption Recovery**: Handles corrupted array formats by extracting URLs using regex
4. **Format Flexibility**: Supports both array and string formats for backward compatibility
5. **Individual Downloads**: Downloads each image URL one by one with unique filenames
6. **Error Handling**: If a download fails, it keeps the original URL
7. **Database Update**: Updates the vehicle record with local file paths as a proper PostgreSQL array
8. **Path Consistency**: Uses the same upload directory as the existing upload functionality

## Testing Results

✅ **Database Array Handling**: Confirmed that PostgreSQL properly stores and retrieves arrays
✅ **PostgreSQL Array Parsing**: Successfully parses `{url1,url2,url3}` format
✅ **Corruption Recovery**: Can extract URLs from corrupted array formats
✅ **Unique Filenames**: Each image gets a unique timestamp-based filename
✅ **Database Updates**: Local image paths are correctly saved as PostgreSQL arrays
✅ **File Path Consistency**: Uses `/uploads/vehicle-images/` directory
✅ **No Character Corruption**: Arrays are stored as proper strings, not individual characters

## API Endpoint

```
POST /api/vehicles/:id/download-images
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "downloadedCount": 3,
  "vehicleId": "vehicle-uuid"
}
```

## Error Handling

- Returns 404 if vehicle not found or has no images
- Returns 404 if no valid image URLs found
- Returns 500 for server errors during download
- Keeps original URLs if individual downloads fail
- Properly handles PostgreSQL array format parsing
- Recovers from corrupted array formats

## Database Schema

The `photo_url_list` field is defined as `TEXT[]` in the database:
```sql
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS photo_url_list TEXT[];
```

This allows storing multiple image URLs as a PostgreSQL array, which is properly handled by the updated download functionality.

## Key Fix for Array Corruption

The main issue was that PostgreSQL arrays were being stored as individual characters instead of proper strings. The fix uses manual array construction:

```javascript
// Proper way to store PostgreSQL arrays
const arrayString = `{${localImagePaths.map(item => `"${item}"`).join(',')}}`;
await query('UPDATE vehicles SET photo_url_list = $1::text[] WHERE id = $2', [arrayString, vehicle.id]);
```

This ensures that arrays are stored correctly as `{"/path1","/path2"}` instead of individual characters. 