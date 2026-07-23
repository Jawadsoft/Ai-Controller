// test-staff-api.js
import { query } from './src/database/connection.js';
import dotenv from 'dotenv';

dotenv.config();

async function testStaffAPI() {
  console.log('🧪 Testing Staff API Endpoints...');
  
  try {
    // 1. Get all users and their tokens (if any)
    console.log('\n👥 Step 1: Getting all users...');
    const usersResult = await query(`
      SELECT 
        u.id,
        u.email,
        u.name,
        ur.role,
        ds.id as staff_id,
        ds.staff_role,
        ds.is_active as staff_active,
        ds.dealer_id,
        d.business_name
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN dealership_staff ds ON u.id = ds.user_id
      LEFT JOIN dealers d ON ds.dealer_id = d.id
      WHERE ds.is_active = true
      ORDER BY u.email
    `);

    console.log(`Found ${usersResult.rows.length} active users:`);
    usersResult.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'} (${user.email})`);
      console.log(`   - User ID: ${user.id}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Staff Role: ${user.staff_role}`);
      console.log(`   - Dealer: ${user.business_name}`);
    });

    // 2. Generate curl commands for each user
    console.log('\n🔗 Step 2: Generating curl commands...');
    
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    
    usersResult.rows.forEach((user, index) => {
      console.log(`\n--- Test ${index + 1}: ${user.name || 'No name'} (${user.email}) ---`);
      
      // Note: In a real scenario, you'd need to get the actual JWT token
      // For now, we'll show the curl command structure
      console.log(`# Test staff endpoint for ${user.email}`);
      console.log(`curl -X GET "${baseUrl}/api/staff" \\`);
      console.log(`  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \\`);
      console.log(`  -H "Content-Type: application/json" \\`);
      console.log(`  -v`);
      
      console.log(`\n# Expected behavior:`);
      console.log(`# - If user has staff_management permission: 200 OK with staff data`);
      console.log(`# - If user lacks permission: 403 Forbidden`);
      console.log(`# - If token invalid: 401 Unauthorized`);
    });

    // 3. Test the permission function directly
    console.log('\n🧪 Step 3: Testing permission function directly...');
    for (const user of usersResult.rows) {
      console.log(`\n👤 Testing ${user.name || 'No name'} (${user.email}):`);
      
      const testPermissions = ['staff_management'];
      
      for (const permission of testPermissions) {
        try {
          const result = await query(
            'SELECT user_has_permission($1, $2) as has_permission',
            [user.id, permission]
          );
          const hasPermission = result.rows[0].has_permission;
          console.log(`   - ${permission}: ${hasPermission ? '✅' : '❌'}`);
          
          if (hasPermission) {
            console.log(`   ✅ This user SHOULD be able to access staff page`);
          } else {
            console.log(`   ❌ This user will get "Access Denied"`);
          }
        } catch (error) {
          console.log(`   - ${permission}: ❌ Error - ${error.message}`);
        }
      }
    }

    // 4. Show what the API response should look like
    console.log('\n📋 Step 4: Expected API Responses...');
    console.log(`
✅ SUCCESS (200 OK):
{
  "staff": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "staff_role": "admin",
      "permissions": ["staff_management", "lead_management"],
      "is_active": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}

❌ PERMISSION DENIED (403 Forbidden):
{
  "error": "Staff management permission required"
}

❌ AUTHENTICATION REQUIRED (401 Unauthorized):
{
  "error": "Access token required"
}
    `);

    // 5. Generate a complete test script
    console.log('\n📝 Step 5: Complete Test Script...');
    console.log(`
# Complete test script (save as test-staff-api.sh):

#!/bin/bash
BASE_URL="${baseUrl}"

echo "🧪 Testing Staff API..."

# Test 1: Without token (should get 401)
echo "\\n1. Testing without token (should get 401):"
curl -X GET "\${BASE_URL}/api/staff" \\
  -H "Content-Type: application/json" \\
  -w "\\nHTTP Status: %{http_code}\\n" \\
  -s

# Test 2: With invalid token (should get 401)
echo "\\n2. Testing with invalid token (should get 401):"
curl -X GET "\${BASE_URL}/api/staff" \\
  -H "Authorization: Bearer invalid_token" \\
  -H "Content-Type: application/json" \\
  -w "\\nHTTP Status: %{http_code}\\n" \\
  -s

# Test 3: With valid token (should get 200 or 403)
echo "\\n3. Testing with valid token (should get 200 or 403):"
curl -X GET "\${BASE_URL}/api/staff" \\
  -H "Authorization: Bearer YOUR_ACTUAL_JWT_TOKEN" \\
  -H "Content-Type: application/json" \\
  -w "\\nHTTP Status: %{http_code}\\n" \\
  -s

echo "\\n✅ Test completed!"
    `);

    console.log('\n📊 Summary:');
    console.log(`- Total active users: ${usersResult.rows.length}`);
    console.log(`- Users with staff_management permission: ${usersResult.rows.filter(u => {
      // This would need to be tested with actual permission check
      return u.staff_role === 'admin';
    }).length}`);
    console.log(`- Base URL: ${baseUrl}`);

  } catch (error) {
    console.error('❌ Error testing staff API:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
testStaffAPI()
  .then(() => {
    console.log('\n✨ Staff API test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
