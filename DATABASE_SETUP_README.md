# 🗄️ Database Setup for Render.com PostgreSQL

This guide will help you set up your PostgreSQL database on Render.com with all the required tables and sample data.

## 📋 **Prerequisites**

1. ✅ **Render.com PostgreSQL service** is running
2. ✅ **Environment variables** are set in your backend service
3. ✅ **Backend service** is deployed and running

## 🔧 **Step 1: Test Database Connection**

First, let's test if we can connect to your Render.com PostgreSQL database:

```bash
# Test the database connection
node test-database-connection.js
```

**Expected Output:**
```
🧪 Testing database connection to Render.com PostgreSQL...
✅ Successfully connected to Render.com PostgreSQL database
✅ Database query successful
   Current time: 2025-08-26T04:00:00.000Z
   Database version: PostgreSQL 15.4 on x86_64-pc-linux-gnu
📋 Existing tables in database:
   (No tables found for new database)
🎉 Database connection test completed successfully!
```

## 🚀 **Step 2: Set Up Database Schema**

Once the connection test passes, run the database setup script:

```bash
# Set up the complete database with tables and sample data
node setup-render-database.js
```

**Expected Output:**
```
🚀 Starting database setup for Render.com PostgreSQL...
✅ Connected to Render.com PostgreSQL database
📖 Reading database schema...
🔨 Creating database tables...
✅ Database tables created successfully
📝 Inserting sample data...
✅ Sample subscription plans inserted
✅ Sample dealer inserted
✅ Sample vehicles inserted
✅ Sample AI prompts inserted
🎉 Database setup completed successfully!
📊 Database now contains:
   - Users and authentication tables
   - Dealers and vehicles tables
   - Subscription plans
   - Sample data for testing
   - AI prompt templates
```

## 📊 **What Gets Created**

### **Database Tables:**
- `users` - User authentication
- `user_roles` - User role management
- `subscription_plans` - Subscription tiers
- `dealers` - Dealership information
- `vehicles` - Vehicle inventory
- `leads` - Customer leads
- `dealer_prompts` - AI prompt templates
- And more...

### **Sample Data:**
- **Subscription Plans**: Basic, Premium, Enterprise
- **Sample Dealer**: "Sample Dealership" for testing
- **Sample Vehicles**: Honda Civic, Hyundai Tucson, Ford Escape
- **AI Prompts**: Greeting, vehicle inquiry, pricing inquiry

## 🧪 **Step 3: Test Your Application**

After database setup, test your application:

```bash
# Test backend health (should show database as connected)
curl "https://vehicle-management-backend-ypsa.onrender.com/api/health/detailed"

# Test login endpoint (should work now)
curl -X POST "https://vehicle-management-backend-ypsa.onrender.com/api/auth/login" \
     -H "Content-Type: application/json" \
     -d "{\"email\":\"test@test.com\",\"password\":\"test123\"}"
```

## 🔍 **Troubleshooting**

### **Connection Issues:**
```bash
# Check if your backend is running
curl "https://vehicle-management-backend-ypsa.onrender.com/api/health"

# Check Render.com logs for database connection errors
```

### **Common Error Codes:**
- **ECONNREFUSED**: Database service not accessible
- **28P01**: Authentication failed (wrong username/password)
- **3D000**: Database doesn't exist (wrong database name)

### **SSL Issues:**
Make sure your `DATABASE_URL` includes SSL parameters:
```
postgresql://username:password@host:port/database?sslmode=require
```

## 📝 **Environment Variables Required**

Make sure these are set in your Render.com backend service:

```bash
DATABASE_URL=postgresql://dealeriq_1_user:16C0SbqpdAnGwl3O2mRBfY1Ecq0wYe02@dpg-d2mbt1ndiees7386nee0-a/dealeriq_1
JWT_SECRET=your-super-secret-jwt-key-here-2024-vehicle-app
NODE_ENV=production
```

## 🎯 **Next Steps After Setup**

1. **Test Authentication**: Try logging in/registering
2. **Test Vehicle Management**: Add/view vehicles
3. **Test AI Features**: Use the D.A.I.V.E. system
4. **Monitor Logs**: Watch for any remaining errors

## 🚨 **Important Notes**

- **Never commit** database credentials to Git
- **Use environment variables** for sensitive data
- **Test locally** before deploying to production
- **Backup your data** regularly

## 🎉 **Success Indicators**

Your database is properly set up when:
- ✅ Connection test passes
- ✅ Schema creation succeeds
- ✅ Sample data is inserted
- ✅ Backend health check shows "database: connected"
- ✅ Auth endpoints respond without 500 errors

---

**Need Help?** Check the Render.com logs and ensure all environment variables are properly set in your backend service.
