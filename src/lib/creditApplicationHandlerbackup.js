/**
 * Credit Application Handler
 * Handles credit application link generation and email sending in the DAIVE conversation flow
 */

import { generateCreditApplicationToken } from './creditApplicationTokens.js';
import emailService from './daiveEmailService.js';
import { query } from '../database/connection.js';

/**
 * Extract customer email from various sources
 * Priority: 1. Authenticated customer, 2. Conversation email, 3. Message extraction
 */
export function extractCustomerEmail(conversationContext, customerInfo = {}) {
  // 1. Check authenticated customer info first
  if (customerInfo?.email) {
    console.log('✅ Using authenticated customer email:', customerInfo.email);
    return customerInfo.email;
  }

  // 2. Check conversation context
  if (conversationContext?.customer_email) {
    console.log('✅ Using conversation context email:', conversationContext.customer_email);
    return conversationContext.customer_email;
  }

  // 3. Extract from messages
  const messages = conversationContext?.messages || [];
  for (const msg of messages) {
    if (msg.role === 'user' && msg.content) {
      const emailMatch = msg.content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        console.log('✅ Extracted email from messages:', emailMatch[0]);
        return emailMatch[0];
      }
    }
  }

  console.log('⚠️ No customer email found');
  return null;
}

/**
 * Extract customer name from various sources
 */
export function extractCustomerName(conversationContext, customerInfo = {}) {
  if (customerInfo?.customer_name) {
    return customerInfo.customer_name;
  }

  if (conversationContext?.customer_name) {
    return conversationContext.customer_name;
  }

  // Try to extract from lead capture step
  const leadCaptureStep = conversationContext?.Daivesteps?.[2];
  if (leadCaptureStep?.slots?.customer_name) {
    return leadCaptureStep.slots.customer_name;
  }

  return null;
}

/**
 * Check if Step 6 qualification is complete and email has been collected
 */
export function shouldGenerateCreditApplicationLink(conversationContext) {
  const step6 = conversationContext?.Daivesteps?.[6];
  
  if (!step6) {
    return false;
  }

  // Check if step is completed or has necessary slots
  const hasFinancingMethod = step6.slots?.qualification?.financing_method;
  const hasDownPayment = step6.slots?.finance?.down_payment;
  const hasCreditScore = step6.slots?.qualification?.credit_score;
  
  // Check if link was already sent
  const linkAlreadySent = step6.slots?.application?.link_sent;
  
  return (hasFinancingMethod || hasDownPayment || hasCreditScore) && !linkAlreadySent;
}

/**
 * Generate and send credit application link
 */
export async function generateAndSendCreditApplicationLink(conversationContext, customerInfo = {}) {
  try {
    console.log('🔗 Starting credit application link generation...');
    
    // Extract customer information
    const customerEmail = extractCustomerEmail(conversationContext, customerInfo);
    if (!customerEmail) {
      console.log('⚠️ Cannot generate link: No customer email available');
      return {
        success: false,
        message: 'To send you the credit application, I\'ll need your email address. Could you please provide it?',
        needsEmail: true
      };
    }

    const customerName = extractCustomerName(conversationContext, customerInfo);
    const dealerId = customerInfo?.dealerId || conversationContext?.dealerId;
    const conversationId = conversationContext?.conversationId;

    if (!dealerId || !conversationId) {
      console.log('❌ Missing dealer ID or conversation ID');
      return { success: false, message: 'System error: Missing required identifiers' };
    }

    // Get qualification data from Step 6
    const step6 = conversationContext?.Daivesteps?.[6];
    const qualificationSlots = step6?.slots || {};
    
    // Get selected vehicle from Step 3
    const step3 = conversationContext?.Daivesteps?.[3];
    const selectedVehicle = step3?.slots?.inventory_choice || step3?.slots?.VehicleSelection?.selectedVehicle;
    
    // Prepare prefill data
    const prefillData = {
      financing_type: qualificationSlots.qualification?.financing_method || 'finance',
      down_payment: qualificationSlots.finance?.down_payment,
      credit_score: qualificationSlots.qualification?.credit_score,
      requested_term_months: qualificationSlots.finance?.lease_term || 60,
      vehicle_price: selectedVehicle?.msrp || selectedVehicle?.price
    };

    // Generate token and link
    const tokenData = await generateCreditApplicationToken({
      conversationId,
      dealerId,
      customerEmail,
      customerName,
      vehicleId: selectedVehicle?.id,
      prefillData
    });

    console.log('✅ Credit application token generated:', tokenData.token.substring(0, 16) + '...');

    // Get dealer information for email
    const dealerResult = await query(
      'SELECT business_name, contact_name, phone, email FROM dealers WHERE id = $1',
      [dealerId]
    );
    const dealerInfo = dealerResult.rows[0] || {};

    // Prepare vehicle info string
    const vehicleInfo = selectedVehicle 
      ? `${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model} - ${selectedVehicle.price}`
      : 'Your selected vehicle';

    // Send email (reinitialize to ensure .env is loaded)
    emailService.reinitialize();
    const emailSent = await emailService.sendCreditApplicationLinkEmail({
      customer_email: customerEmail,
      customer_name: customerName || 'Valued Customer',
      vehicle_info: vehicleInfo,
      application_link: tokenData.applicationLink,
      financing_type: prefillData.financing_type,
      down_payment: prefillData.down_payment,
      credit_score: prefillData.credit_score,
      dealer_name: dealerInfo.business_name || 'Our Dealership',
      dealer_phone: dealerInfo.phone,
      dealer_email: dealerInfo.email
    }, dealerId);

    if (emailSent) {
      console.log('✅ Credit application email sent successfully to:', customerEmail);
      
      // Update conversation context with application link info
      if (!step6.slots.application) {
        step6.slots.application = {};
      }
      
      step6.slots.application = {
        created: false, // Customer hasn't submitted yet
        link: tokenData.applicationLink,
        link_sent: true,
        link_sent_at: new Date().toISOString(),
        status: 'link_sent',
        customer_email: customerEmail,
        token_id: tokenData.id,
        expires_at: tokenData.expiresAt
      };

      // Save conversation context
      await saveConversationContext(conversationId, conversationContext);

      return {
        success: true,
        message: `Perfect! I've sent a secure credit application link to ${customerEmail}. Please check your email and complete the application at your convenience. The link is valid for 7 days.\n\nOnce you submit it, our finance team will review your application and contact you within 24 hours with financing options.\n\nIs there anything else I can help you with while you wait?`,
        applicationLink: tokenData.applicationLink,
        linkSent: true
      };
    } else {
      console.log('❌ Failed to send credit application email');
      return {
        success: false,
        message: 'I apologize, but there was an issue sending the email. Please contact our finance team directly, or I can try again if you\'d like.'
      };
    }

  } catch (error) {
    console.error('❌ Error generating credit application link:', error);
    return {
      success: false,
      message: 'I apologize, but I encountered an error. Please try again or contact our finance team directly.'
    };
  }
}

/**
 * Save updated conversation context to database
 */
async function saveConversationContext(conversationId, conversationContext) {
  try {
    await query(
      `UPDATE daive_conversations 
       SET conversation_context = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(conversationContext), conversationId]
    );
    console.log('✅ Conversation context saved with credit application link info');
  } catch (error) {
    console.error('❌ Error saving conversation context:', error);
  }
}

/**
 * Get bot response message for credit application step
 */
export function getCreditApplicationBotMessage(conversationContext, hasEmail) {
  if (!hasEmail) {
    return "Great! To send you the credit application, I'll need your email address. What's the best email to reach you at?";
  }

  const step6 = conversationContext?.Daivesteps?.[6];
  if (step6?.slots?.application?.link_sent) {
    const email = step6.slots.application.customer_email;
    return `I've already sent the credit application link to ${email}. Please check your email (including spam folder). Would you like me to resend it, or is there anything else I can help you with?`;
  }

  return "Let me prepare your credit application link and send it to your email...";
}

export default {
  extractCustomerEmail,
  extractCustomerName,
  shouldGenerateCreditApplicationLink,
  generateAndSendCreditApplicationLink,
  getCreditApplicationBotMessage
};

