import pg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pg;
dotenv.config();

// Parse database connection from DATABASE_URL or use individual parameters
let poolConfig;

if (process.env.DATABASE_URL) {
  try {
    // Parse the connection string
    const url = new URL(process.env.DATABASE_URL);
    
    // Priority: DB_PASSWORD env var -> DATABASE_URL password -> default 'Dealeriq'
    // This allows overriding password in DATABASE_URL with DB_PASSWORD
    // URL decode the password from DATABASE_URL if it exists
    let urlPassword = '';
    if (url.password) {
      try {
        urlPassword = decodeURIComponent(url.password);
      } catch (e) {
        urlPassword = url.password; // Use as-is if decoding fails
      }
    }
    const password = process.env.DB_PASSWORD || urlPassword || 'Dealeriq';
    
    // Ensure password is always a string
    if (typeof password !== 'string') {
      console.error('Warning: Database password is not a string');
    }
    
    // Log connection details (without password) for debugging
    console.log(`Database connection: ${url.username}@${url.hostname}:${url.port || 5432}/${url.pathname.substring(1)}`);
    if (process.env.NODE_ENV === 'development') {
      console.log(`Password source: ${process.env.DB_PASSWORD ? 'DB_PASSWORD env var' : (url.password ? 'DATABASE_URL' : 'default')}`);
    }
    
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.substring(1), // Remove leading slash
      user: url.username,
      password: String(password), // Force to string
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('Database connection configured from DATABASE_URL');
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error);
    // Fallback to default local settings
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'vehicle_management',
      user: process.env.DB_USER || 'postgres',
      password: String(process.env.DB_PASSWORD || 'Dealeriq'),
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
    console.log('Using fallback database configuration');
  }
} else {
  // Use individual environment variables as fallback
  poolConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'vehicle_management',
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD || 'Dealeriq'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  };
  console.log('Database connection configured from environment variables');
}

const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = (text, params) => pool.query(text, params);
export { pool };