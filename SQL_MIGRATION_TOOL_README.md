# 🚀 SQL Database Migration Tool

A modern, web-based tool for executing SQL migration files on PostgreSQL databases with a beautiful UI and robust backend API.

## ✨ Features

- **📁 File Upload**: Drag & drop or browse for SQL files
- **🔌 Connection Testing**: Test database connectivity before execution
- **🔄 Transaction Safety**: Automatic rollback on errors
- **📊 Progress Tracking**: Real-time execution progress
- **🎨 Modern UI**: Beautiful, responsive interface
- **🔒 Security**: Secure file handling and connection management
- **📝 SQL Preview**: Review SQL content before execution
- **⚡ Fast Execution**: Efficient statement parsing and execution

## 🛠️ Prerequisites

- Node.js 16+ installed
- PostgreSQL database server running
- Database credentials with appropriate permissions

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install --package-lock-only package-migration.json
npm install

# Or install manually
npm install express pg multer cors
npm install --save-dev nodemon
```

### 2. Start the Migration Server

```bash
# Start the server
npm start

# Or for development with auto-restart
npm run dev
```

The server will start on port 3001 by default.

### 3. Access the Tool

Open your browser and navigate to:
```
http://localhost:3001/sql-migration-tool.html
```

## 📋 Usage Guide

### Step 1: Configure Database Connection

1. **Host**: Database server address (default: localhost)
2. **Port**: Database port (default: 5432 for PostgreSQL)
3. **Database Name**: Target database name
4. **Username**: Database user
5. **Password**: Database password
6. **SSL Mode**: Choose appropriate SSL setting

**Quick Presets Available:**
- **Local Development**: Pre-configured for local PostgreSQL
- **Production**: Template for production environments

### Step 2: Test Connection

Click the **"🔌 Test Connection"** button to verify:
- Database connectivity
- Credential validity
- SSL configuration
- Server version information

### Step 3: Upload SQL File

1. **Drag & Drop**: Simply drag your .sql file onto the upload area
2. **Browse**: Click "Choose SQL File" to select from file system
3. **Review**: The tool will display file information and SQL preview

### Step 4: Execute Migration

1. Click **"🚀 Execute Migration"** button
2. Monitor progress in real-time
3. View detailed results for each SQL statement
4. Check execution status and row counts

## 🔧 API Endpoints

### Test Connection
```http
POST /api/test-connection
Content-Type: application/json

{
  "host": "localhost",
  "port": 5432,
  "database": "your_db",
  "user": "your_user",
  "password": "your_password",
  "ssl": "false"
}
```

### Execute Migration
```http
POST /api/execute-migration
Content-Type: multipart/form-data

sqlFile: [SQL file]
host: localhost
port: 5432
database: your_db
user: your_user
password: your_password
ssl: false
```

### Migration History
```http
GET /api/migration-history?host=localhost&port=5432&database=your_db&user=your_user&password=your_password&ssl=false
```

### Health Check
```http
GET /api/health
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   HTML Frontend │    │  Express.js API  │    │  PostgreSQL DB  │
│                 │    │                  │    │                 │
│ • File Upload   │◄──►│ • File Handling  │◄──►│ • Execute SQL   │
│ • UI Controls   │    │ • DB Connection  │    │ • Transactions  │
│ • Progress Bar  │    │ • SQL Parsing    │    │ • Rollback      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🔒 Security Features

- **File Validation**: Only .sql files accepted
- **File Size Limits**: 10MB maximum file size
- **Connection Pooling**: Efficient database connection management
- **Transaction Safety**: Automatic rollback on errors
- **Input Sanitization**: SQL content validation
- **CORS Protection**: Configurable cross-origin settings

## 📁 File Structure

```
sql-migration-tool/
├── sql-migration-tool.html    # Frontend interface
├── sql-migration-api.js       # Backend API server
├── package-migration.json     # Dependencies
├── uploads/                   # Temporary file storage
└── README.md                  # This file
```

## 🚨 Safety Warnings

⚠️ **IMPORTANT**: Always follow these safety practices:

1. **Backup First**: Create database backups before running migrations
2. **Test Environment**: Test migrations on development databases first
3. **Review SQL**: Carefully review SQL content before execution
4. **Permissions**: Ensure database user has appropriate permissions
5. **Production**: Use extra caution in production environments

## 🐛 Troubleshooting

### Connection Issues
- Verify database server is running
- Check firewall settings
- Confirm credentials are correct
- Verify SSL configuration

### File Upload Issues
- Ensure file is valid .sql format
- Check file size (max 10MB)
- Verify file permissions

### Execution Errors
- Check SQL syntax
- Verify table/column existence
- Check user permissions
- Review error messages in console

## 🔧 Configuration

### Environment Variables
```bash
PORT=3001                    # Server port
NODE_ENV=development         # Environment mode
```

### Database SSL Options
- `false`: No SSL
- `true`: SSL enabled
- `require`: SSL required

## 📊 Performance

- **Connection Pooling**: Up to 20 concurrent connections
- **Statement Parsing**: Efficient SQL parsing and validation
- **Transaction Management**: Optimized transaction handling
- **Memory Management**: Automatic file cleanup

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
1. Check the troubleshooting section
2. Review error logs in console
3. Verify database connectivity
4. Check file permissions and format

---

**Built with ❤️ for safe and efficient database migrations**
