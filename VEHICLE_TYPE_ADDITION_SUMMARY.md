# Vehicle Type Feature Addition

## Overview
Added a new `vehicle_type` field to the vehicle management system to categorize vehicles by body type (SUV, Sedan, Truck, etc.).

## Changes Made

### 1. Database Schema Update
- **File**: `src/database/add-vehicle-type-column.sql`
- **Action**: Added `vehicle_type` column to the `vehicles` table
- **Type**: TEXT (nullable)
- **Index**: Created index for better query performance

### 2. Type Definition Update
- **File**: `src/types/vehicle.ts`
- **Action**: Added `vehicle_type?: string` to Vehicle interface

### 3. Form Component Updates
- **File**: `src/components/vehicles/VehicleForm.tsx`
- **Action**: Added vehicle type field with dropdown selection
- **Options**: SUV, Sedan, Truck, Hatchback, Coupe, Convertible, Wagon, Van, Minivan, Crossover, Sports Car, Luxury, Hybrid, Electric, Other

### 4. Display Component Updates
- **File**: `src/components/vehicles/VehicleGrid.tsx`
- **Action**: Added vehicle type display in vehicle cards

- **File**: `src/components/vehicles/VehicleTable.tsx`
- **Action**: Added vehicle type column in table view

- **File**: `src/pages/VehicleDetail.tsx`
- **Action**: Added vehicle type display in vehicle detail page

- **File**: `src/pages/Dashboard.tsx`
- **Action**: Added vehicle type display in recent vehicles

### 5. Filtering Updates
- **File**: `src/components/vehicles/VehicleFilters.tsx`
- **Action**: Added vehicle type filter dropdown
- **Search**: Vehicle type is now included in search functionality

### 6. Backend API Updates
- **File**: `src/routes/vehicles.js`
- **Action**: Updated CREATE and UPDATE routes to include vehicle_type field
- **Changes**: Added vehicle_type to parameter destructuring, SQL queries, and parameter arrays

### 7. Import Service Updates
- **File**: `src/routes/import.js`
- **Action**: Added vehicle_type to field mappings for CSV import
- **Mappings**: 'Vehicle Type' → 'vehicle_type', 'Type' → 'vehicle_type'

- **File**: `src/lib/importService333.js`
- **Action**: Updated stored procedure call to include vehicle_type parameter
- **Changes**: Added vehicle_type to queryParams array, updated SQL query, and parameter names

- **File**: `src/lib/importServiceB.js`
- **Action**: Updated stored procedure call to include vehicle_type parameter
- **Changes**: Added vehicle_type to queryParams array, updated SQL query, and parameter names

## Vehicle Type Options
The system now supports the following vehicle types:
- **SUV** - Sport Utility Vehicle
- **Sedan** - Traditional passenger car
- **Truck** - Pickup truck
- **Hatchback** - Compact car with rear door
- **Coupe** - Two-door car
- **Convertible** - Car with retractable roof
- **Wagon** - Station wagon
- **Van** - Passenger van
- **Minivan** - Family minivan
- **Crossover** - SUV-like car
- **Sports Car** - High-performance vehicle
- **Luxury** - Premium vehicle
- **Hybrid** - Hybrid electric vehicle
- **Electric** - Battery electric vehicle
- **Other** - Miscellaneous types

## Migration Instructions

### Option 1: Run Migration Script
```bash
node run-vehicle-type-migration.js
```

### Option 2: Manual SQL Execution
```sql
-- Add vehicle_type column
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_vehicle_type ON vehicles(vehicle_type);

-- Add column comment
COMMENT ON COLUMN vehicles.vehicle_type IS 'Vehicle body type (e.g., SUV, Sedan, Truck, Hatchback, Coupe, Convertible, Wagon, Van, Minivan)';
```

## Testing

### Test Script
Run the test script to verify vehicle_type functionality:
```bash
node test-vehicle-type.js
```

This script will:
1. Verify the vehicle_type column exists
2. Test inserting a vehicle with vehicle_type
3. Test updating vehicle_type
4. Test querying by vehicle_type
5. Clean up test data

## Benefits
1. **Better Categorization**: Vehicles can now be organized by body type
2. **Improved Filtering**: Users can filter vehicles by type
3. **Enhanced Search**: Vehicle type is included in search functionality
4. **Better User Experience**: Clear vehicle classification for customers
5. **Data Organization**: Improved inventory management
6. **Import Support**: CSV imports can now include vehicle type information

## Usage Examples

### Filtering by Vehicle Type
- Users can select specific vehicle types from the filter dropdown
- Search functionality includes vehicle type matching
- Table and grid views display vehicle type information

### Adding/Editing Vehicles
- Vehicle form now includes a dropdown for selecting vehicle type
- Existing vehicles can be updated with vehicle type information
- Vehicle type is saved to the database

### Display
- Vehicle cards show type information
- Vehicle detail pages display type prominently
- Dashboard includes vehicle type in recent vehicles

### Import
- CSV files can include vehicle type column
- Field mapping supports 'Vehicle Type' and 'Type' headers
- Import services handle vehicle_type parameter

## Important Notes

### Stored Procedure Updates
The import services use a stored procedure `import_vehicle_from_csv` that now expects 28 parameters instead of 27. The vehicle_type parameter is inserted at position 9.

### Parameter Order (Updated)
1. p_dealer_id
2. p_vin
3. p_make
4. p_model
5. p_series
6. p_stock_number
7. p_new_used
8. p_body_style
9. **p_vehicle_type** ← NEW
10. p_certified
11. p_color
12. p_interior_color
... (remaining parameters shifted by +1)

## Future Enhancements
1. **Type-based Analytics**: Track sales performance by vehicle type
2. **Type-specific Features**: Show relevant features based on vehicle type
3. **Type-based Pricing**: Different pricing strategies for different types
4. **Type-based Marketing**: Targeted marketing based on vehicle preferences
5. **Type Statistics**: Dashboard showing inventory distribution by type
6. **Type-based Search**: Advanced search with type combinations
7. **Type Templates**: Pre-configured settings for different vehicle types
