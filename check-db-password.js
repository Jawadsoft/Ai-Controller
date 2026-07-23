/**
 * Check database connection and help identify password issue
 */

import dotenv from 'dotenv';
dotenv.config();

console.log('\n🔍 Checking Database Configuration...\n');

console.log('Environment Variables:');
console.log(`  DATABASE_URL: ${process.env.DATABASE_URL ? 'Set (hidden)' : 'Not set'}`);
console.log(`  DB_USER: ${process.env.DB_USER || 'Not set (default: postgres)'}`);
console.log(`  DB_HOST: ${process.env.DB_HOST || 'Not set (default: localhost)'}`);
console.log(`  DB_NAME: ${process.env.DB_NAME || 'Not set (default: vehicle_management)'}`);
console.log(`  DB_PORT: ${process.env.DB_PORT || 'Not set (default: 5432)'}`);
console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? 'Set (hidden)' : 'Not set (default: Dealeriq)'}`);

console.log('\n📝 Solution:');
console.log('  1. Find your actual PostgreSQL password');
console.log('  2. Create/update .env file in project root with:');
console.log('     DB_PASSWORD=your_actual_password');
console.log('  3. Restart your server');

console.log('\n🧪 To test your password manually:');
console.log('   psql -U postgres -d vehicle_management');
console.log('   (Enter your password when prompted)');

