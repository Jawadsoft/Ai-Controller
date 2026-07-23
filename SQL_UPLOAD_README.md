# SQL File Upload System

This system allows you to upload SQL files to your server and execute them directly on your database.

## Features

- **Drag & Drop Interface**: Modern, responsive HTML interface with drag-and-drop file upload
- **File Validation**: Accepts only `.sql` and `.txt` files
- **Secure Processing**: Files are processed and immediately cleaned up from the server
- **Real-time Execution**: SQL is executed immediately after upload
- **Detailed Results**: Shows execution results for each SQL statement
- **Progress Tracking**: Visual progress bar during upload and execution
- **Error Handling**: Comprehensive error reporting and validation

## How to Use

### 1. Access the Upload Page

Open `sql-upload.html` in your web browser. The page will be served from your server at the root level.

### 2. Upload a SQL File

- **Drag & Drop**: Simply drag your SQL file onto the upload area
- **Click to Browse**: Click the upload area to open a file browser
- **Supported Formats**: `.sql` and `.txt` files only
- **File Size Limit**: Maximum 5MB per file

### 3. Execute SQL

- Once a file is selected, the "Upload & Execute SQL" button becomes active
- Click the button to upload and execute the SQL file
- The system will:
  1. Upload the file to the server
  2. Extract the SQL content
  3. Execute each SQL statement
  4. Display detailed results

### 4. View Results

Results are displayed for each SQL statement:
- **SELECT statements**: Show row count and sample data
- **INSERT/UPDATE/DELETE**: Show rows affected
- **CREATE/DROP**: Show success confirmation
- **Errors**: Display detailed error messages

## API Endpoints

### POST `/api/database-admin/upload-sql`
Uploads and processes a SQL file.

**Request:**
- `Content-Type`: `multipart/form-data`
- Body: Form data with `sqlFile` field containing the SQL file

**Response:**
```json
{
  "success": true,
  "message": "SQL file uploaded and processed successfully",
  "fileName": "example.sql",
  "fileSize": 1024,
  "sqlContent": "SELECT * FROM users;"
}
```

### POST `/api/database-admin/execute-sql`
Executes SQL commands.

**Request:**
```json
{
  "sql": "SELECT * FROM users;",
  "source": "File: example.sql"
}
```

**Response:**
```json
{
  "success": true,
  "message": "SQL execution completed from File: example.sql",
  "results": [...],
  "totalStatements": 1
}
```

## Security Features

- **File Type Validation**: Only SQL and text files are accepted
- **File Size Limits**: 5MB maximum file size
- **Automatic Cleanup**: Uploaded files are immediately deleted after processing
- **SQL Injection Protection**: Uses parameterized queries where applicable
- **Authentication**: Can be integrated with your existing auth system

## File Structure

```
├── sql-upload.html          # Main upload interface
├── test-sample.sql          # Sample SQL file for testing
├── src/
│   └── routes/
│       └── database-admin.js # Backend API endpoints
└── uploads/
    └── sql-files/           # Temporary upload directory (auto-created)
```

## Testing

1. **Start your server** (make sure the database-admin routes are loaded)
2. **Open** `sql-upload.html` in your browser
3. **Upload** the `test-sample.sql` file
4. **Verify** that the SQL executes successfully
5. **Check** the results display correctly

## Sample SQL File

The `test-sample.sql` file contains:
- Table creation
- Data insertion
- SELECT queries
- Schema inspection

This provides a comprehensive test of the system's capabilities.

## Troubleshooting

### Common Issues

1. **File not uploading**: Check file size and format
2. **SQL execution errors**: Verify SQL syntax and database permissions
3. **CORS errors**: Ensure your server CORS settings allow the frontend domain
4. **Database connection**: Verify database connection string and credentials

### Error Messages

- **"No SQL file uploaded"**: No file was selected
- **"SQL file is empty"**: File contains no content
- **"Only SQL and text files are allowed"**: Invalid file type
- **"File too large"**: File exceeds 5MB limit

## Integration

This system can be easily integrated with:
- Existing authentication systems
- Database management tools
- CI/CD pipelines
- Backup and restore processes

## Requirements

- Node.js server with Express
- PostgreSQL database
- Multer middleware for file uploads
- Proper CORS configuration
- Database connection pool

## Browser Support

- Modern browsers with ES6+ support
- Drag and drop functionality
- File API support
- Fetch API support
