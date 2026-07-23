const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    this.initializeClient();
  }

  initializeClient() {
    // Check if Twilio credentials are configured
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER) {
      this.client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      console.log('✅ Twilio SMS service configured');
    } else {
      console.log('❌ Twilio SMS not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER in your .env file');
    }
  }

  async sendSMS(to, message, from = null) {
    if (!this.client) {
      throw new Error('SMS service not configured. Please check Twilio credentials.');
    }

    try {
      const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;
      
      console.log(`📱 Sending SMS to ${to} from ${fromNumber}`);
      console.log(`📱 Message: ${message}`);

      const result = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: to
      });

      console.log(`✅ SMS sent successfully. SID: ${result.sid}`);
      
      return {
        success: true,
        sid: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
        body: result.body,
        dateCreated: result.dateCreated
      };
    } catch (error) {
      console.error('❌ SMS sending failed:', error);
      throw new Error(`SMS sending failed: ${error.message}`);
    }
  }

  async validatePhoneNumber(phoneNumber) {
    // Basic phone number validation
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/[\s\-\(\)]/g, ''));
  }

  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // If it starts with 1 and has 11 digits, it's US format
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // If it has 10 digits, assume US and add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // Otherwise, add + if not present
    return phoneNumber.startsWith('+') ? phoneNumber : `+${digits}`;
  }

  // Get SMS delivery status
  async getMessageStatus(sid) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    try {
      const message = await this.client.messages(sid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated
      };
    } catch (error) {
      console.error('Error fetching message status:', error);
      throw new Error(`Failed to fetch message status: ${error.message}`);
    }
  }

  // Get SMS usage statistics
  async getUsageStats(startDate, endDate) {
    if (!this.client) {
      throw new Error('SMS service not configured');
    }

    try {
      const messages = await this.client.messages.list({
        dateSentAfter: startDate,
        dateSentBefore: endDate
      });

      const stats = {
        total: messages.length,
        sent: messages.filter(m => m.status === 'sent').length,
        delivered: messages.filter(m => m.status === 'delivered').length,
        failed: messages.filter(m => m.status === 'failed').length,
        undelivered: messages.filter(m => m.status === 'undelivered').length
      };

      return stats;
    } catch (error) {
      console.error('Error fetching SMS usage stats:', error);
      throw new Error(`Failed to fetch usage stats: ${error.message}`);
    }
  }
}

module.exports = new SMSService();
