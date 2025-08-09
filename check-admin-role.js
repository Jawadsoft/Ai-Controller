import dotenv from 'dotenv';
import { query } from './src/database/connection.js';

dotenv.config();

const checkAdminRole = async () => {
  try {
    console.log('Checking admin user role...');
    
    // First, check if the admin user exists
    const userResult = await query(
      'SELECT id, email FROM users WHERE email = $1',
      ['admin@example.com']
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ Admin user not found!');
      return;
    }
    
    const adminUser = userResult.rows[0];
    console.log('✅ Admin user found:', adminUser);
    
    // Check if user has a role in user_roles table
    const roleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [adminUser.id]
    );
    
    if (roleResult.rows.length === 0) {
      console.log('❌ No role found for admin user. Creating super_admin role...');
      
      // Insert super_admin role
      await query(
        'INSERT INTO user_roles (user_id, role) VALUES ($1, $2)',
        [adminUser.id, 'super_admin']
      );
      
      console.log('✅ Super admin role created successfully!');
    } else {
      const currentRole = roleResult.rows[0].role;
      console.log('Current role:', currentRole);
      
      if (currentRole !== 'super_admin') {
        console.log('❌ Role is not super_admin. Updating to super_admin...');
        
        // Update role to super_admin
        await query(
          'UPDATE user_roles SET role = $1 WHERE user_id = $2',
          ['super_admin', adminUser.id]
        );
        
        console.log('✅ Role updated to super_admin!');
      } else {
        console.log('✅ Role is already super_admin!');
      }
    }
    
    // Verify the final state
    const finalRoleResult = await query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [adminUser.id]
    );
    
    console.log('Final role:', finalRoleResult.rows[0]?.role);
    
  } catch (error) {
    console.error('Error checking admin role:', error);
  } finally {
    process.exit(0);
  }
};

checkAdminRole(); 