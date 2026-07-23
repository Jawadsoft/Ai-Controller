@echo off
set DATABASE_URL=postgresql://postgres:Dealeriq@localhost:5432/vehicle_management
set JWT_SECRET=SNZQ6TUR3RTK2G72AC
set NODE_ENV=development
set PORT=3000
set FRONTEND_URL=http://localhost:8080
set BACKEND_URL=http://localhost:3000

echo Starting server with environment variables...
echo DATABASE_URL=%DATABASE_URL%
echo JWT_SECRET=%JWT_SECRET%
echo NODE_ENV=%NODE_ENV%
echo PORT=%PORT%

node src/server.js

