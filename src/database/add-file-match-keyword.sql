-- Add file_match_keyword for smart pattern matching
ALTER TABLE import_connection_settings 
ADD COLUMN IF NOT EXISTS file_match_keyword VARCHAR(255);

-- Add comment for documentation
COMMENT ON COLUMN import_connection_settings.file_match_keyword IS 'Keyword pattern to match files (e.g., "claycooleyhyundaisherman") - automatically finds matching files even with changing timestamps';
