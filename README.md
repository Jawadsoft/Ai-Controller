# Vehicle Management Backend

PostgreSQL-based backend API for the vehicle management system.

## Setup

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up PostgreSQL database:**
   - Install PostgreSQL on your server
   - Create a new database: `CREATE DATABASE vehicle_management;`
   - Create a user with appropriate permissions

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Run database migration:**
   ```bash
   npm run migrate
   ```

5. **Start the server:**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Vehicles
- `GET /api/vehicles` - Get all vehicles (dealer-specific)
- `GET /api/vehicles/:id` - Get single vehicle
- `POST /api/vehicles` - Create new vehicle
- `PUT /api/vehicles/:id` - Update vehicle
- `DELETE /api/vehicles/:id` - Delete vehicle

### Dealers
- `GET /api/dealers/profile` - Get current dealer profile
- `PUT /api/dealers/profile` - Update dealer profile
- `GET /api/dealers` - Get all dealers (super admin only)
- `GET /api/dealers/:id` - Get single dealer (super admin only)
- `PUT /api/dealers/:id` - Update dealer (super admin only)

### Leads
- `GET /api/leads` - Get all leads (dealer-specific)
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create new lead (authenticated)
- `POST /api/leads/public` - Create new lead (public)
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

## Authentication

All API endpoints (except auth and public lead creation) require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Database Schema

The database includes tables for:
- `users` - User authentication
- `user_roles` - User role assignments
- `dealers` - Dealer profiles and information
- `vehicles` - Vehicle inventory
- `leads` - Customer leads
- `chat_conversations` - Chat conversation logs
- `subscription_plans` - Available subscription plans

## Deployment

1. Set up PostgreSQL on your server
2. Configure environment variables
3. Run database migration
4. Start the application with a process manager like PM2

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start src/server.js --name "vehicle-backend"

# Save PM2 configuration
pm2 save
pm2 startup
```