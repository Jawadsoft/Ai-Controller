# FTP Import Wizard Edit Functionality

## Overview
The FTP Import Wizard has been enhanced to support editing existing import configurations. When the edit button is clicked in the Import Configuration component, the wizard will load with the existing connection settings pre-filled.

## Changes Made

### 1. FTPImportWizard Component (`src/components/import/FTPImportWizard.tsx`)

#### Props Interface
- Added `FTPImportWizardProps` interface with:
  - `editConfigId?: number` - ID of configuration to edit
  - `onEditComplete?: () => void` - Callback when edit is complete

#### State Management
- Added `isEditMode` state to track edit mode
- Added `editingConfigName` state to display configuration name
- Added `useEffect` to load configuration when `editConfigId` is provided

#### New Functions
- `loadConfigurationForEdit(configId: number)` - Loads existing configuration from API
  - Fetches configuration details from `/api/import/configs/${configId}`
  - Populates connection settings (host, port, username, password, etc.)
  - Loads field mappings if they exist
  - Sets edit mode and configuration name

#### UI Enhancements
- **Edit Mode Badge**: Shows "Edit Mode" badge in step title when editing
- **Configuration Name Badge**: Displays the name of the configuration being edited
- **Loading State**: Shows loading spinner while configuration is being loaded
- **Alert Message**: Displays informative message when in edit mode
- **Button Text**: Changes from "Connect to FTP Server" to "Update Connection" in edit mode

### 2. Import Page (`src/pages/Import.tsx`)

#### State Management
- Added `editConfigId` state to track which configuration is being edited
- Added `activeTab` state to control tab switching

#### Callback Functions
- `handleEditConfig(configId: number)` - Called when edit button is clicked
  - Sets the configuration ID to edit
  - Switches to FTP Import Wizard tab
- `handleEditComplete()` - Called when edit is complete
  - Clears the edit configuration ID
  - Switches back to FTP/SFTP Import tab

#### Tab Integration
- Passes `editConfigId` and `onEditComplete` props to `FTPImportWizard`
- Shows informative message when in edit mode

### 3. ImportConfigurationB Component
- Already had `onEditConfig` prop support
- Edit button calls `onEditConfig(config.id)` when prop is provided
- Falls back to internal edit functionality when prop is not provided

## How It Works

### User Flow
1. User navigates to Import page → "FTP/SFTP Import" tab
2. User clicks edit button (Settings icon) on any configuration
3. User is automatically redirected to "FTP Import Wizard" tab
4. Wizard loads with configuration settings pre-filled
5. User can modify connection settings and proceed through wizard steps
6. When complete, user is redirected back to FTP/SFTP Import tab

### Technical Flow
1. `ImportConfigurationB` edit button calls `onEditConfig(config.id)`
2. `Import.tsx` receives the callback and sets `editConfigId`
3. `FTPImportWizard` receives `editConfigId` prop
4. `useEffect` triggers `loadConfigurationForEdit()`
5. API call fetches configuration details
6. Connection settings and field mappings are populated
7. UI updates to show edit mode indicators

## API Integration

### Endpoint Used
- `GET /api/import/configs/{id}` - Fetches full configuration details
- Returns connection settings, field mappings, and other configuration data

### Data Mapping
- API response (snake_case) → Component state (camelCase)
- Handles password decryption from API
- Maps field mappings with proper type conversion

## UI Features

### Visual Indicators
- **Edit Mode Badge**: Shows when editing an existing configuration
- **Configuration Name Badge**: Displays the name of the configuration
- **Loading Spinner**: Shows while configuration is being loaded
- **Alert Message**: Informs user that settings have been loaded

### Button States
- **Connect Button**: Changes text based on edit mode
  - Normal: "Connect to FTP Server"
  - Edit: "Update Connection"
- **Loading States**: Shows appropriate loading text

## Error Handling
- API error handling with user-friendly toast messages
- Graceful fallback if configuration loading fails
- Proper state cleanup on errors

## Testing
A test script (`test-ftp-wizard-edit.js`) has been created to verify functionality:
- Tests component prop acceptance
- Tests API endpoint accessibility
- Provides step-by-step testing instructions

## Benefits
1. **Seamless Integration**: Edit functionality integrates naturally with existing workflow
2. **User-Friendly**: Clear visual indicators show when in edit mode
3. **Data Preservation**: All existing configuration data is preserved and loaded
4. **Consistent UX**: Maintains the same wizard flow for both new and existing configurations
5. **Error Resilience**: Proper error handling and user feedback

## Future Enhancements
- Save edited configuration back to database
- Support for creating new configurations from existing ones
- Enhanced field mapping validation in edit mode
- Configuration comparison features 