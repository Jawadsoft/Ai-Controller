-- Add file selection fields to import_connection_settings table
-- This allows storing selected files for automatic sync

ALTER TABLE import_connection_settings 
ADD COLUMN IF NOT EXISTS selected_files TEXT[], -- Array of specific files to import
ADD COLUMN IF NOT EXISTS available_files TEXT[], -- Cached list of available files
ADD COLUMN IF NOT EXISTS last_file_scan TIMESTAMP; -- When files were last scanned

-- Add comment for documentation
COMMENT ON COLUMN import_connection_settings.selected_files IS 'Specific files selected for import from the remote directory';
COMMENT ON COLUMN import_connection_settings.available_files IS 'Cached list of files discovered from last scan';
COMMENT ON COLUMN import_connection_settings.last_file_scan IS 'Timestamp of last file discovery scan';
