# FTP Import Wizard Field Mapping Fix

## Problem
When clicking the download button in step 2 of the FTP Import Wizard, it would connect to the FTP server but fail to download headers and field mappings properly. The error was:

```
Error selecting file: TypeError: Cannot read properties of undefined (reading 'headers')
```

## Root Cause
The FTP Import Wizard was expecting the API response to have a nested `data` structure like:
```javascript
{
  success: true,
  data: {
    headers: [...],
    fieldMappings: [...]
  }
}
```

But the actual API response structure from `/api/import/preview-csv` is:
```javascript
{
  success: true,
  headers: [...],
  fieldMappings: [...],
  fileName: '...',
  totalRows: 100
}
```

## Solution

### 1. Updated API Response Handling
Modified the `selectFileAndGetHeaders` function to handle the correct API response structure:

**Before:**
```javascript
if (result.success && result.data) {
  const headers = result.data.headers || [];
  const apiFieldMappings = result.data.fieldMappings || [];
  // ...
}
```

**After:**
```javascript
if (result.success) {
  // The API returns fieldMappings directly in the response, not nested under data
  const headers = result.headers || [];
  const apiFieldMappings = result.fieldMappings || [];
  // ...
}
```

### 2. Improved Field Mapping Logic
The component now uses the same field mapping approach as `ImportConfiguration.tsx`:

- **API-Provided Mappings**: Uses field mappings returned from the API when available
- **Fallback Smart Mapping**: Falls back to local smart mapping if API doesn't provide mappings
- **Proper Field Conversion**: Converts API field mapping format to component format

### 3. Enhanced Error Handling
- Added better error message extraction
- Improved null/undefined checks
- Added console logging for debugging

### 4. Updated Other Functions
Also updated `previewFileData` and `executeImport` functions to handle the correct API response structure.

## Key Changes Made

### `selectFileAndGetHeaders` Function
```javascript
// Updated to handle correct API response structure
if (result.success) {
  const headers = result.headers || [];
  const apiFieldMappings = result.fieldMappings || [];
  
  // Use field mappings from API if available, otherwise generate them
  let mappings;
  if (apiFieldMappings.length > 0) {
    // Convert API field mappings to component format
    mappings = apiFieldMappings.map((mapping: any) => ({
      sourceField: mapping.sourceField || mapping.source_field || '',
      targetField: mapping.targetField || mapping.target_field || '',
      fieldType: mapping.fieldType || mapping.field_type || 'string',
      isRequired: mapping.isRequired || mapping.is_required || false,
      isEnabled: (mapping.targetField || mapping.target_field) !== '',
      defaultValue: mapping.defaultValue || mapping.default_value || '',
      transformationRule: mapping.transformationRule || mapping.transformation_rule || ''
    }));
  } else {
    // Fallback to local smart mapping
    mappings = headers.map((header: string, index: number) => ({
      sourceField: header,
      targetField: getSmartMapping(header),
      fieldType: 'string' as const,
      isRequired: getSmartMapping(header) ? true : false,
      isEnabled: getSmartMapping(header) !== '',
      defaultValue: '',
      transformationRule: ''
    }));
  }
  
  setFieldMappings(mappings);
}
```

### Error Handling Improvements
```javascript
// Better error message extraction
toast({
  title: "File Selection Failed",
  description: result.details || result.error || result.message || "Failed to read file headers",
  variant: "destructive"
});
```

## Testing

### Test Script
Created `test-ftp-field-mapping.js` to verify the functionality:

1. **API Response Structure**: Confirms correct handling of API response
2. **Field Mapping Extraction**: Tests extraction from correct location
3. **Header Extraction**: Tests header extraction from correct location
4. **Field Mapping Conversion**: Tests conversion to component format
5. **Error Handling**: Tests improved error handling

### Expected Behavior
1. **Step 1**: Connect to FTP server successfully
2. **Step 2**: Click download button on a file
3. **Step 3**: Headers and field mappings are properly loaded
4. **Step 4**: Field mapping interface shows correct mappings
5. **Step 5**: Continue with import process

## Benefits

1. **Consistent with ImportConfiguration.tsx**: Uses the same field mapping approach
2. **Better Error Handling**: More informative error messages
3. **Robust Fallback**: Works even if API doesn't provide field mappings
4. **Improved User Experience**: Clear feedback on what's happening
5. **Debugging Support**: Better console logging for troubleshooting

## Files Modified

- `src/components/import/FTPImportWizard.tsx`: Main component with field mapping fixes
- `test-ftp-field-mapping.js`: Test script to verify functionality
- `FTP_FIELD_MAPPING_FIX.md`: This documentation

## API Response Structure

The `/api/import/preview-csv` endpoint returns:
```javascript
{
  success: true,
  fileName: "example.csv",
  totalRows: 100,
  headers: ["VIN", "Make", "Model", "Year", "Price"],
  sampleData: [...],
  fieldMappings: [
    {
      sourceField: "VIN",
      targetField: "vin",
      fieldType: "string",
      isRequired: true,
      defaultValue: "",
      transformationRule: "",
      fieldOrder: 1
    },
    // ... more mappings
  ]
}
```

This fix ensures the FTP Import Wizard now properly handles this response structure and provides the same field mapping functionality as the ImportConfiguration component. 