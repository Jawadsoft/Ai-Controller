# 🚀 Server Integration Guide for SQL Migration Tool

This guide explains how to integrate the SQL Migration Tool into your existing Express.js server at `vehicle-management-backend-ypsa.onrender.com`.

## 📋 What We've Created

1. **`src/routes/migration.js`** - Migration API routes
2. **`public/sql-migration-tool.html`** - Frontend interface
3. **Updated HTML file** - Now uses relative URLs for server deployment

## 🔧 Integration Steps

### Step 1: Add Migration Routes to Your Server

In your `src/server.js` file, add this import and route:

```javascript
// Add this import with your other route imports
import migrationRoutes from './routes/migration.js';

// Add this line after your other app.use statements
app.use('/api/migration', migrationRoutes);
```

### Step 2: Ensure Dependencies Are Installed

Your `package.json` already has the required dependencies:
- ✅ `express` - Web framework
- ✅ `pg` - PostgreSQL client
- ✅ `multer` - File upload handling
- ✅ `cors` - Cross-origin support

### Step 3: Create Uploads Directory

Create an `uploads/` directory in your project root for temporary file storage:

```bash
mkdir uploads
```

### Step 4: Update CORS Settings (if needed)

Your current CORS settings should work, but if you need to allow file uploads from specific origins, you can update them.

## 🌐 Access the Tool

After integration, your migration tool will be available at:

```
https://vehicle-management-backend-ypsa.onrender.com/sql-migration-tool.html
```

## 🔌 API Endpoints

The tool will provide these endpoints:

- **`POST /api/migration/test-connection`** - Test database connectivity
- **`POST /api/migration/execute-migration`** - Execute SQL migrations
- **`GET /api/migration/migration-history`** - Get migration history

## 🚀 Deployment

### For Render.com:

1. **Push your changes** to your Git repository
2. **Render will automatically deploy** the updated server
3. **The migration tool will be available** at your server URL

### For Other Platforms:

1. **Install dependencies**: `npm install`
2. **Start the server**: `npm start`
3. **Access the tool** at your server URL

## 🔒 Security Considerations

- **File Validation**: Only .sql files accepted (max 10MB)
- **Connection Pooling**: Efficient database connection management
- **Transaction Safety**: Automatic rollback on errors
- **Input Sanitization**: SQL content validation

## 📁 File Structure After Integration

```
your-project/
├── src/
│   ├── routes/
│   │   └── migration.js          # New migration routes
│   └── server.js                 # Updated with migration routes
├── public/
│   └── sql-migration-tool.html   # Migration tool interface
├── uploads/                       # Temporary file storage
└── package.json                   # Already has required dependencies
```

## 🧪 Testing the Integration

1. **Deploy to your server**
2. **Navigate to**: `https://your-server.com/sql-migration-tool.html`
3. **Test connection** with your database credentials
4. **Upload a test SQL file** and execute it

## 🐛 Troubleshooting

### Common Issues:

1. **404 Errors**: Ensure migration routes are properly imported and mounted
2. **CORS Issues**: Check your CORS configuration allows file uploads
3. **File Upload Failures**: Verify the `uploads/` directory exists and is writable
4. **Database Connection Errors**: Check database credentials and network access

### Debug Steps:

1. **Check server logs** for error messages
2. **Verify route mounting** in server.js
3. **Test API endpoints** directly with tools like Postman
4. **Check file permissions** for uploads directory

## 🔄 Alternative: Quick Test

If you want to test quickly without full integration:

1. **Copy the migration routes** to a new file
2. **Test locally** with a simple Express server
3. **Verify functionality** before integrating with main server

## 📞 Support

If you encounter issues:

1. **Check server logs** for detailed error messages
2. **Verify all dependencies** are installed
3. **Test API endpoints** individually
4. **Ensure database connectivity** works from your server

---

**Your SQL Migration Tool is now ready for server deployment! 🎉**
