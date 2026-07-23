# Ai-Controller
Vehicle Management System with DAIVE AI Integration

An advanced vehicle management system featuring AI-powered chat capabilities, automated lead generation, and comprehensive dealer management tools.

## Features

- **DAIVE AI Integration** - AI-powered chat for vehicle inquiries and customer support
- **Vehicle Management** - Complete inventory management with QR code generation
- **Lead Management** - Automated lead capture and processing
- **Dealer Profiles** - Multi-dealer support with role-based access
- **Import/Export** - CSV import with intelligent field mapping
- **Voice Integration** - Speech-to-text and text-to-speech capabilities
- **ETL Tools** - Data transformation and migration utilities

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up PostgreSQL database:**
   - Install PostgreSQL on your server
   - Create a new database: `CREATE DATABASE vehicle_management;`
   - Create a user with appropriate permissions

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and API keys
   ```

4. **Run database migration:**
   ```bash
   npm run migrate
   ```

5. **Start the application:**
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

### DAIVE AI
- `POST /api/daive/chat` - AI chat interactions
- `POST /api/daive/voice` - Voice input processing
- `GET /api/daive/analytics` - AI usage analytics

### Dealers
- `GET /api/dealers/profile` - Get current dealer profile
- `PUT /api/dealers/profile` - Update dealer profile
- `GET /api/dealers` - Get all dealers (super admin only)

### Leads
- `GET /api/leads` - Get all leads (dealer-specific)
- `POST /api/leads` - Create new lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

## Technology Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **AI:** OpenAI GPT-4, Deepgram, ElevenLabs
- **UI:** Tailwind CSS + shadcn/ui
- **Authentication:** JWT + Passport.js
