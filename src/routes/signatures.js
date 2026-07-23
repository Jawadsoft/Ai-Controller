/**
 * E-Signature API Routes
 * Handles signature request creation, webhooks, and status tracking
 */

import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import signatureService from '../lib/signatureService.js';
import financeNotificationService from '../lib/financeNotificationService.js';
import { authenticateToken } from '../middleware/auth.js';
import { attachTenantContext } from '../middleware/tenantIsolation.js';

const router = express.Router();

// Note: PUBLIC routes must come FIRST to be matched before protected routes

// =====================================================
// PUBLIC CUSTOMER ENDPOINTS (NO AUTH REQUIRED)
// =====================================================
// These MUST be defined first so they're matched before protected routes

/**
 * GET /api/signatures/public/:id
 * Get signature request by ID (public access for customers)
 */
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const signatureRequest = await signatureService.getSignatureRequest(id);

    if (!signatureRequest) {
      return res.status(404).json({ 
        success: false,
        error: 'Signature request not found',
        message: 'This signature request does not exist or has been removed.'
      });
    }

    // Check if expired
    if (signatureRequest.expires_at && new Date(signatureRequest.expires_at) < new Date()) {
      // Update status to expired if not already
      if (!['expired', 'signed', 'completed'].includes(signatureRequest.status)) {
        await signatureService.updateSignatureStatus(id, 'expired');
        signatureRequest.status = 'expired';
      }
    }

    res.json({
      success: true,
      data: signatureRequest
    });
  } catch (error) {
    console.error('Error getting public signature request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get signature request',
      message: error.message 
    });
  }
});

/**
 * POST /api/signatures/public/:id/viewed
 * Mark signature request as viewed
 */
router.post('/public/:id/viewed', async (req, res) => {
  try {
    const { id } = req.params;

    const signatureRequest = await signatureService.getSignatureRequest(id);

    if (!signatureRequest) {
      return res.status(404).json({ 
        success: false,
        error: 'Signature request not found' 
      });
    }

    // Only update if not already viewed/signed
    if (['sent', 'delivered'].includes(signatureRequest.status)) {
      await signatureService.updateSignatureStatus(id, 'viewed');
      
      // Log event
      await query(
        `INSERT INTO signature_events (signature_request_id, event_type, ip_address, user_agent)
         VALUES ($1, $2, $3, $4)`,
        [id, 'viewed', req.ip, req.headers['user-agent']]
      );
    }

    res.json({
      success: true,
      message: 'Marked as viewed'
    });
  } catch (error) {
    console.error('Error marking signature as viewed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to mark as viewed',
      message: error.message 
    });
  }
});

/**
 * POST /api/signatures/public/:id/sign
 * Submit signature for a signature request
 */
router.post('/public/:id/sign', [
  body('signature_data').notEmpty().withMessage('Signature data is required'),
  body('signer_name').notEmpty().trim().withMessage('Signer name is required'),
  body('signer_email').isEmail().withMessage('Valid signer email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }

    const { id } = req.params;
    const { signature_data, signer_name, signer_email } = req.body;

    const signatureRequest = await signatureService.getSignatureRequest(id);

    if (!signatureRequest) {
      return res.status(404).json({ 
        success: false,
        error: 'Signature request not found',
        message: 'This signature request does not exist or has been removed.'
      });
    }

    // Check if expired
    if (signatureRequest.expires_at && new Date(signatureRequest.expires_at) < new Date()) {
      return res.status(400).json({ 
        success: false,
        error: 'Signature request expired',
        message: 'This signature request has expired. Please contact the dealer for a new request.'
      });
    }

    // Check if already signed
    if (['signed', 'completed'].includes(signatureRequest.status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Already signed',
        message: 'This document has already been signed.'
      });
    }

    // Verify signer email matches
    if (signatureRequest.signer_email.toLowerCase() !== signer_email.toLowerCase()) {
      return res.status(403).json({ 
        success: false,
        error: 'Invalid signer',
        message: 'The email address does not match the signature request.'
      });
    }

    // Update signature request with signature data
    const signatureMetadata = {
      signature_data,
      signer_name,
      signer_email,
      signed_at: new Date().toISOString(),
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    };

    await query(
      `UPDATE signature_requests 
       SET status = $1, 
           signed_at = NOW(), 
           signature_metadata = $2,
           updated_at = NOW()
       WHERE id = $3`,
      ['signed', JSON.stringify(signatureMetadata), id]
    );

    // Log signature event
    await query(
      `INSERT INTO signature_events (signature_request_id, event_type, event_data, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        'signed',
        JSON.stringify({ signer_name, signer_email }),
        req.ip,
        req.headers['user-agent']
      ]
    );

    // Update the deal signature status
    await query(
      `UPDATE finance_deals 
       SET signature_status = $1, signature_completed_at = NOW()
       WHERE id = $2`,
      ['signed', signatureRequest.deal_id]
    );

    // Get updated signature request
    const updatedRequest = await signatureService.getSignatureRequest(id);

    // Send notification emails to dealer and customer
    try {
      console.log('📧 Sending signature completion notifications...');
      
      // Get deal and application details for email
      const dealResult = await query(
        'SELECT id, application_id, monthly_payment, term_months FROM finance_deals WHERE id = $1',
        [signatureRequest.deal_id]
      );
      
      if (dealResult.rows.length > 0 && dealResult.rows[0].application_id) {
        const appResult = await query(
          'SELECT customer_name, customer_email FROM credit_applications WHERE id = $1',
          [dealResult.rows[0].application_id]
        );
        
        if (appResult.rows.length > 0) {
          const deal = dealResult.rows[0];
          const application = appResult.rows[0];
          
          // Import notification service
          const financeNotificationService = await import('../lib/financeNotificationService.js').then(m => m.default);
          
          // Notify customer
          await financeNotificationService.notifySignatureCompleted(
            deal,
            application,
            signatureRequest.dealer_id,
            'customer'
          );
          
          // Notify dealer
          await financeNotificationService.notifySignatureCompleted(
            deal,
            application,
            signatureRequest.dealer_id,
            'dealer'
          );
          
          console.log('✅ Signature completion notifications sent');
        }
      }
    } catch (notifError) {
      console.error('⚠️ Error sending signature completion notification (non-critical):', notifError.message);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      data: updatedRequest,
      message: 'Document signed successfully'
    });
  } catch (error) {
    console.error('Error submitting signature:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to submit signature',
      message: error.message 
    });
  }
});

// =====================================================
// SIGNATURE REQUEST ENDPOINTS (PROTECTED)
// =====================================================

/**
 * POST /api/signatures/request
 * Create a new signature request
 */
router.post('/request', authenticateToken, attachTenantContext, [
  body('deal_id').isUUID().withMessage('Valid deal_id is required'),
  body('signer_name').notEmpty().trim().withMessage('Signer name is required'),
  body('signer_email').isEmail().withMessage('Valid signer email is required'),
  body('document_url').notEmpty().withMessage('Document URL is required'),
  body('document_name').notEmpty().withMessage('Document name is required'),
  body('expires_in_days').optional().isInt({ min: 1, max: 90 })
], async (req, res) => {
  console.log('\n🟢 ===== SIGNATURE REQUEST START =====');
  console.log('📍 Endpoint: POST /api/signatures/request');
  console.log('⏰ Timestamp:', new Date().toISOString());
  console.log('📋 Request Details:', {
    body: {
      ...req.body,
      signer_email: req.body.signer_email ? '[PRESENT]' : '[MISSING]'
    },
    headers: {
      authorization: req.headers.authorization ? 'Bearer [PRESENT]' : 'MISSING',
      'content-type': req.headers['content-type']
    }
  });

  try {
    // Check validation
    console.log('🔍 Running validation...');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation failed:', errors.array());
      return res.status(400).json({ 
        success: false,
        errors: errors.array() 
      });
    }
    console.log('✅ Validation passed');

    // Check authentication
    console.log('👤 User authentication check...');
    if (!req.user) {
      console.log('❌ No user object found - authentication failed');
      return res.status(401).json({ 
        success: false,
        error: 'Authentication required' 
      });
    }
    console.log('✅ User authenticated:', { userId: req.user.id, email: req.user.email });

    const dealerId = req.user.dealer_id;
    const userId = req.user.id;
    
    console.log('🏢 Dealer ID:', dealerId);
    console.log('👤 User ID:', userId);

    if (!dealerId) {
      console.log('❌ No dealer_id found in user object');
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const {
      deal_id,
      deal_sheet_id,
      signer_name,
      signer_email,
      signer_phone,
      document_url,
      document_name,
      message,
      expires_in_days
    } = req.body;

    console.log('📄 Creating signature request:', {
      deal_id,
      deal_sheet_id: deal_sheet_id || 'none',
      signer_name,
      signer_email,
      document_name,
      expires_in_days: expires_in_days || 30
    });

    console.log('🔧 Calling signatureService.createSignatureRequest...');
    const startTime = Date.now();
    const signatureRequest = await signatureService.createSignatureRequest({
      dealId: deal_id,
      dealerId,
      dealSheetId: deal_sheet_id || null,
      signerName: signer_name,
      signerEmail: signer_email,
      signerPhone: signer_phone,
      documentUrl: document_url,
      documentName: document_name,
      message,
      expiresInDays: expires_in_days || 30,
      userId
    });
    const duration = Date.now() - startTime;
    console.log(`✅ Signature request created in ${duration}ms`);
    console.log('📧 Signature request details:', {
      id: signatureRequest.id,
      status: signatureRequest.status,
      provider: signatureRequest.provider,
      envelope_id: signatureRequest.envelope_id || 'none'
    });

    // Send notification to customer
    console.log('📬 Sending signature request notification...');
    try {
      // Get deal details
      const dealResult = await query(
        'SELECT id, application_id, monthly_payment, term_months FROM finance_deals WHERE id = $1',
        [deal_id]
      );
      
      if (dealResult.rows.length > 0 && dealResult.rows[0].application_id) {
        // Get application details
        const appResult = await query(
          'SELECT customer_name, customer_email, customer_phone FROM credit_applications WHERE id = $1',
          [dealResult.rows[0].application_id]
        );
        
        if (appResult.rows.length > 0) {
          // Construct signature URL (adjust based on your frontend setup)
          const signatureUrl = signatureRequest.signature_url || 
                               `${process.env.FRONTEND_URL || 'http://localhost:8080'}/signature/${signatureRequest.id}`;
          
          await financeNotificationService.notifySignatureRequest(
            dealResult.rows[0],   // deal
            appResult.rows[0],    // application
            signatureUrl,          // signature URL
            dealerId               // dealer ID
          );
          
          console.log('✅ Signature request notification sent to:', appResult.rows[0].customer_email);
        } else {
          console.log('⚠️ No customer application found - skipping notification');
        }
      } else {
        console.log('⚠️ No deal or application_id found - skipping notification');
      }
    } catch (notifError) {
      console.error('⚠️ Error sending signature notification (non-critical):', notifError.message);
      // Don't fail the request if notification fails
    }

    const responseMessage = signatureService.isConfigured 
      ? 'Signature request sent successfully'
      : 'Signature request created. Configure e-signature provider to send automatically.';
    
    console.log('📬 Provider configured:', signatureService.isConfigured);
    console.log('💬 Response message:', responseMessage);
    console.log('🟢 ===== SIGNATURE REQUEST END (SUCCESS) =====\n');

    res.status(201).json({
      success: true,
      data: signatureRequest,
      message: responseMessage
    });
  } catch (error) {
    console.error('🔴 ===== ERROR IN SIGNATURE REQUEST =====');
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.log('🔴 ===== SIGNATURE REQUEST END (ERROR) =====\n');
    
    res.status(500).json({ 
      success: false,
      error: 'Failed to create signature request',
      message: error.message 
    });
  }
});

/**
 * GET /api/signatures/:id
 * Get signature request by ID
 */
router.get('/:id', authenticateToken, attachTenantContext, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const signatureRequest = await signatureService.getSignatureRequest(id);

    if (!signatureRequest) {
      return res.status(404).json({ 
        success: false,
        error: 'Signature request not found' 
      });
    }

    // Verify belongs to dealer
    if (signatureRequest.dealer_id !== dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied' 
      });
    }

    res.json({
      success: true,
      data: signatureRequest
    });
  } catch (error) {
    console.error('Error getting signature request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get signature request',
      message: error.message 
    });
  }
});

/**
 * GET /api/signatures/deal/:dealId
 * Get all signature requests for a deal
 */
router.get('/deal/:dealId', authenticateToken, attachTenantContext, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { dealId } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify deal belongs to dealer
    const dealCheck = await query('SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2', [dealId, dealerId]);
    
    if (dealCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Deal not found or access denied' 
      });
    }

    const signatureRequests = await signatureService.getDealSignatureRequests(dealId);

    res.json({
      success: true,
      data: signatureRequests
    });
  } catch (error) {
    console.error('Error getting deal signature requests:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get signature requests',
      message: error.message 
    });
  }
});

/**
 * GET /api/signatures/:id/events
 * Get events for a signature request
 */
router.get('/:id/events', authenticateToken, attachTenantContext, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify signature request belongs to dealer
    const signatureRequest = await signatureService.getSignatureRequest(id);
    
    if (!signatureRequest || signatureRequest.dealer_id !== dealerId) {
      return res.status(404).json({ 
        success: false,
        error: 'Signature request not found or access denied' 
      });
    }

    const events = await signatureService.getSignatureEvents(id);

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    console.error('Error getting signature events:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get signature events',
      message: error.message 
    });
  }
});

/**
 * POST /api/signatures/:id/cancel
 * Cancel a signature request
 */
router.post('/:id/cancel', authenticateToken, attachTenantContext, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify signature request belongs to dealer
    const signatureRequest = await signatureService.getSignatureRequest(id);
    
    if (!signatureRequest || signatureRequest.dealer_id !== dealerId) {
      return res.status(404).json({ 
        success: false,
        error: 'Signature request not found or access denied' 
      });
    }

    const updated = await signatureService.cancelSignatureRequest(id);

    res.json({
      success: true,
      data: updated,
      message: 'Signature request cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling signature request:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to cancel signature request',
      message: error.message 
    });
  }
});

/**
 * POST /api/signatures/:id/remind
 * Send reminder for pending signature
 */
router.post('/:id/remind', authenticateToken, attachTenantContext, async (req, res) => {
  try {
    const dealerId = req.user.dealer_id;
    const { id } = req.params;

    if (!dealerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    // Verify signature request belongs to dealer
    const signatureRequest = await signatureService.getSignatureRequest(id);
    
    if (!signatureRequest || signatureRequest.dealer_id !== dealerId) {
      return res.status(404).json({ 
        success: false,
        error: 'Signature request not found or access denied' 
      });
    }

    const updated = await signatureService.sendReminder(id);

    res.json({
      success: true,
      data: updated,
      message: 'Reminder sent successfully'
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to send reminder',
      message: error.message 
    });
  }
});

// =====================================================
// WEBHOOK ENDPOINTS (PUBLIC - NO AUTH)
// =====================================================

/**
 * POST /api/signatures/webhook/docusign
 * Handle DocuSign webhook events
 */
router.post('/webhook/docusign', express.json(), async (req, res) => {
  try {
    // Verify webhook signature if configured
    // const signature = req.headers['x-docusign-signature-1'];
    // if (!verifyDocuSignSignature(req.body, signature)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }

    const event = req.body;
    
    // Parse DocuSign event
    const eventData = {
      envelopeId: event.envelopeId || event.data?.envelopeId,
      event: event.event || event.status,
      recipientEmail: event.recipientEmail || event.data?.recipientEmail,
      ipAddress: event.ipAddress || req.ip
    };

    await signatureService.handleWebhookEvent(eventData);

    res.json({ success: true });
  } catch (error) {
    console.error('Error handling DocuSign webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/signatures/webhook/hellosign
 * Handle HelloSign webhook events
 */
router.post('/webhook/hellosign', express.json(), async (req, res) => {
  try {
    const event = req.body.event;
    
    // Parse HelloSign event
    const eventData = {
      envelopeId: event.signature_request_id,
      event: event.event_type,
      recipientEmail: event.reported_for_account_id,
      ipAddress: req.ip
    };

    await signatureService.handleWebhookEvent(eventData);

    res.json({ hello_sign: 'received' });
  } catch (error) {
    console.error('Error handling HelloSign webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;

