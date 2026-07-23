-- Sample SQL file for testing upload functionality
-- This file contains some basic SQL statements to test the system

-- Create a test table
CREATE TABLE IF NOT EXISTS test_upload (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some test data
INSERT INTO test_upload (name, description) VALUES 
    ('Test Item 1', 'This is a test item for upload testing'),
    ('Test Item 2', 'Another test item to verify the system works');

-- Query to verify the data
SELECT * FROM test_upload ORDER BY created_at DESC;

-- Show table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'test_upload' 
ORDER BY ordinal_position;
