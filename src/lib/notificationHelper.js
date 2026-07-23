import { pool } from '../database/connection.js';

// Helper function to send desktop notifications for new leads
export const sendNewLeadNotification = async (leadData, customerName, customerEmail, vehicleId) => {
  try {
    // Import the notification functions dynamically to avoid circular dependencies
    const { sendNotificationToDealers, sendNotificationToSuperAdmin } = await import('../server.js');
    
    const notification = {
      title: 'New Lead Received! 🎯',
      message: `New lead from ${customerName} for vehicle inquiry`,
      type: 'new_lead',
      data: {
        leadId: leadData.id,
        customerName: customerName,
        customerEmail: customerEmail,
        vehicleId: vehicleId
      }
    };
    
    // Send to all connected dealers (real-time WebSocket push)
    sendNotificationToDealers(notification);
    
    // Send to super admin
    sendNotificationToSuperAdmin(notification);

    // Persist to DB so it shows in the bell notification panel
    if (leadData.dealer_id) {
      try {
        await pool.query(`
          INSERT INTO notifications (dealer_id, type, title, message, data, read, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, false, NOW(), NOW())
        `, [
          leadData.dealer_id,
          'new_lead',
          'New Lead Received! 🎯',
          `New lead from ${customerName} for vehicle inquiry`,
          JSON.stringify({ leadId: leadData.id, customerName, customerEmail, vehicleId })
        ]);
        console.log('🔔 Bell notification inserted for new lead:', leadData.id);
      } catch (dbErr) {
        if (dbErr.code === '42P01') {
          console.warn('⚠️ notifications table does not exist yet — skipping bell insert for lead');
        } else {
          console.error('Error inserting lead notification:', dbErr);
        }
      }
    }
    
    console.log('✅ Desktop notification sent for new lead:', leadData.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending desktop notification:', error);
    return false;
  }
}; 