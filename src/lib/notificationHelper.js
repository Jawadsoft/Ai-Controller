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
    
    // Send to all connected dealers
    sendNotificationToDealers(notification);
    
    // Send to super admin
    sendNotificationToSuperAdmin(notification);
    
    console.log('✅ Desktop notification sent for new lead:', leadData.id);
    return true;
  } catch (error) {
    console.error('❌ Error sending desktop notification:', error);
    return false;
  }
}; 