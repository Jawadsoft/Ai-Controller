/**
 * E-Signature Service
 * Handles e-signature requests via DocuSign or other providers
 * Falls back to manual signature workflow if no provider configured
 */

import { query } from '../database/connection.js';
import crypto from 'crypto';

class SignatureService {
  constructor() {
    // DocuSign configuration
    this.provider = process.env.SIGNATURE_PROVIDER || 'manual';  // 'docusign', 'hellosign', 'manual'
    this.docusign = {
      integrationKey: process.env.DOCUSIGN_INTEGRATION_KEY,
      secretKey: process.env.DOCUSIGN_SECRET_KEY,
      accountId: process.env.DOCUSIGN_ACCOUNT_ID,
      baseUrl: process.env.DOCUSIGN_BASE_URL || 'https://demo.docusign.net/restapi',
      userId: process.env.DOCUSIGN_USER_ID
    };
    
    this.isConfigured = this.checkConfiguration();
  }

  /**
   * Check if e-signature provider is properly configured
   */
  checkConfiguration() {
    if (this.provider === 'manual') {
      return false;
    }
    
    if (this.provider === 'docusign') {
      return !!(
        this.docusign.integrationKey &&
        this.docusign.secretKey &&
        this.docusign.accountId
      );
    }
    
    return false;
  }

  /**
   * Get DocuSign access token
   * @returns {Promise<string>} Access token
   */
  async getDocuSignAccessToken() {
    if (!this.isConfigured) {
      throw new Error('DocuSign not configured');
    }

    try {
      // In production, implement proper OAuth flow
      // For now, return placeholder or use JWT grant
      console.log('DocuSign authentication would happen here');
      
      // This is a placeholder - in production you'd call DocuSign OAuth API
      // const response = await fetch(`${this.docusign.baseUrl}/oauth/token`, {...});
      
      throw new Error('DocuSign integration requires OAuth setup. Configure environment variables.');
    } catch (error) {
      console.error('DocuSign authentication error:', error);
      throw error;
    }
  }

  /**
   * Create signature request
   * @param {object} params - Signature request parameters
   * @returns {Promise<object>} Created signature request
   */
  async createSignatureRequest(params) {
    try {
      const {
        dealId,
        dealerId,
        dealSheetId,
        signerName,
        signerEmail,
        signerPhone,
        documentUrl,
        documentName,
        message,
        expiresInDays = 30,
        userId
      } = params;
      
      // Verify deal belongs to dealer
      const dealCheck = await query(
        'SELECT id FROM finance_deals WHERE id = $1 AND dealer_id = $2',
        [dealId, dealerId]
      );
      
      if (dealCheck.rows.length === 0) {
        throw new Error('Deal not found or access denied');
      }
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
      
      let envelopeId = null;
      let envelopeStatus = 'created';
      let providerResponse = null;
      
      // Try to send via configured provider
      if (this.isConfigured && this.provider === 'docusign') {
        try {
          const docusignResult = await this.sendViaDocuSign({
            signerName,
            signerEmail,
            documentUrl,
            documentName,
            message
          });
          
          envelopeId = docusignResult.envelopeId;
          envelopeStatus = docusignResult.status;
          providerResponse = docusignResult;
        } catch (docusignError) {
          console.error('DocuSign error, falling back to manual:', docusignError);
          // Continue with manual workflow
        }
      }
      
      // Create signature request record
      const insertSql = `
        INSERT INTO signature_requests (
          deal_id, dealer_id, deal_sheet_id, provider, envelope_id, envelope_status,
          signer_name, signer_email, signer_phone, document_name, document_url,
          status, sent_at, expires_at, request_message, created_by, provider_response
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;
      
      const status = envelopeId ? 'sent' : 'pending';
      const sentAt = envelopeId ? new Date() : null;
      
      const result = await query(insertSql, [
        dealId,
        dealerId,
        dealSheetId,
        this.provider,
        envelopeId,
        envelopeStatus,
        signerName,
        signerEmail,
        signerPhone || null,
        documentName,
        documentUrl,
        status,
        sentAt,
        expiresAt,
        message || 'Please review and sign this document',
        userId,
        providerResponse ? JSON.stringify(providerResponse) : null
      ]);
      
      const signatureRequest = result.rows[0];
      
      // Log event
      await this.logEvent(signatureRequest.id, 'created', {
        created_by: userId,
        provider: this.provider
      });
      
      if (envelopeId) {
        await this.logEvent(signatureRequest.id, 'sent', {
          envelope_id: envelopeId,
          sent_to: signerEmail
        });
      }
      
      // Update finance deal with signature request
      await query(
        'UPDATE finance_deals SET signature_request_id = $1, signature_status = $2 WHERE id = $3',
        [signatureRequest.id, status, dealId]
      );
      
      return signatureRequest;
    } catch (error) {
      console.error('Error creating signature request:', error);
      throw error;
    }
  }

  /**
   * Send document via DocuSign
   * @param {object} params - DocuSign parameters
   * @returns {Promise<object>} DocuSign response
   */
  async sendViaDocuSign(params) {
    // This is a placeholder for DocuSign integration
    // In production, implement actual DocuSign API calls
    
    const { signerName, signerEmail, documentUrl, documentName, message } = params;
    
    console.log('DocuSign send would happen here with:', {
      signerName,
      signerEmail,
      documentName
    });
    
    // Placeholder response
    throw new Error('DocuSign integration not fully implemented. Set SIGNATURE_PROVIDER=manual in .env');
    
    /*
    // Production implementation would look like:
    const accessToken = await this.getDocuSignAccessToken();
    
    const envelopeDefinition = {
      emailSubject: `Please sign: ${documentName}`,
      documents: [{
        documentBase64: documentBase64Content,
        name: documentName,
        fileExtension: 'pdf',
        documentId: '1'
      }],
      recipients: {
        signers: [{
          email: signerEmail,
          name: signerName,
          recipientId: '1',
          routingOrder: '1',
          tabs: {
            signHereTabs: [{
              documentId: '1',
              pageNumber: '1',
              xPosition: '100',
              yPosition: '650'
            }]
          }
        }]
      },
      status: 'sent'
    };
    
    const response = await fetch(
      `${this.docusign.baseUrl}/v2.1/accounts/${this.docusign.accountId}/envelopes`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envelopeDefinition)
      }
    );
    
    return await response.json();
    */
  }

  /**
   * Handle webhook event from signature provider
   * @param {object} eventData - Webhook payload
   * @returns {Promise<object>} Updated signature request
   */
  async handleWebhookEvent(eventData) {
    try {
      const { envelopeId, event, recipientEmail, ipAddress } = eventData;
      
      // Find signature request by envelope ID
      const result = await query(
        'SELECT * FROM signature_requests WHERE envelope_id = $1',
        [envelopeId]
      );
      
      if (result.rows.length === 0) {
        console.warn('Signature request not found for envelope:', envelopeId);
        return null;
      }
      
      const signatureRequest = result.rows[0];
      
      // Map event to status
      const statusMap = {
        'sent': 'sent',
        'delivered': 'delivered',
        'viewed': 'viewed',
        'signed': 'signed',
        'completed': 'completed',
        'declined': 'declined',
        'voided': 'cancelled'
      };
      
      const newStatus = statusMap[event] || signatureRequest.status;
      const timestamp = new Date();
      
      // Update signature request
      let updateFields = ['status = $1', 'envelope_status = $2', 'updated_at = NOW()'];
      let updateValues = [newStatus, event];
      let paramIndex = 3;
      
      // Update timestamp fields based on event
      if (event === 'delivered') {
        updateFields.push(`delivered_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
      } else if (event === 'viewed') {
        updateFields.push(`viewed_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
      } else if (event === 'signed') {
        updateFields.push(`signed_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
        
        // Also update finance deal
        await query(
          'UPDATE finance_deals SET signature_status = $1, signature_completed_at = $2 WHERE signature_request_id = $3',
          ['signed', timestamp, signatureRequest.id]
        );
      } else if (event === 'completed') {
        updateFields.push(`completed_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
      }
      
      updateValues.push(signatureRequest.id);
      
      await query(
        `UPDATE signature_requests SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        updateValues
      );
      
      // Log event
      await this.logEvent(signatureRequest.id, event, {
        envelope_id: envelopeId,
        recipient_email: recipientEmail,
        ip_address: ipAddress,
        event_data: eventData
      });
      
      return { ...signatureRequest, status: newStatus };
    } catch (error) {
      console.error('Error handling webhook event:', error);
      throw error;
    }
  }

  /**
   * Log signature event
   * @param {string} signatureRequestId - Signature request UUID
   * @param {string} eventType - Event type
   * @param {object} eventData - Event data
   */
  async logEvent(signatureRequestId, eventType, eventData) {
    try {
      await query(
        `INSERT INTO signature_events (signature_request_id, event_type, event_data, ip_address)
         VALUES ($1, $2, $3, $4)`,
        [
          signatureRequestId,
          eventType,
          JSON.stringify(eventData),
          eventData.ip_address || null
        ]
      );
    } catch (error) {
      console.error('Error logging signature event:', error);
    }
  }

  /**
   * Get signature request by ID
   * @param {string} id - Signature request UUID
   * @returns {Promise<object>} Signature request
   */
  async getSignatureRequest(id) {
    try {
      const result = await query(
        'SELECT * FROM signature_requests WHERE id = $1',
        [id]
      );
      
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting signature request:', error);
      throw error;
    }
  }

  /**
   * Get signature requests for a deal
   * @param {string} dealId - Deal UUID
   * @returns {Promise<Array>} Signature requests
   */
  async getDealSignatureRequests(dealId) {
    try {
      const result = await query(
        `SELECT * FROM signature_requests 
         WHERE deal_id = $1 
         ORDER BY created_at DESC`,
        [dealId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting deal signature requests:', error);
      throw error;
    }
  }

  /**
   * Get signature events for a request
   * @param {string} signatureRequestId - Signature request UUID
   * @returns {Promise<Array>} Signature events
   */
  async getSignatureEvents(signatureRequestId) {
    try {
      const result = await query(
        `SELECT * FROM signature_events 
         WHERE signature_request_id = $1 
         ORDER BY event_timestamp DESC`,
        [signatureRequestId]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting signature events:', error);
      throw error;
    }
  }

  /**
   * Cancel signature request
   * @param {string} id - Signature request UUID
   * @returns {Promise<object>} Updated signature request
   */
  async cancelSignatureRequest(id) {
    try {
      const signatureRequest = await this.getSignatureRequest(id);
      
      if (!signatureRequest) {
        throw new Error('Signature request not found');
      }
      
      // If sent via provider, cancel on provider side too
      if (signatureRequest.envelope_id && this.isConfigured) {
        // Cancel on DocuSign/provider
        console.log('Would cancel envelope on provider:', signatureRequest.envelope_id);
      }
      
      // Update status
      await query(
        `UPDATE signature_requests 
         SET status = 'cancelled', envelope_status = 'voided', updated_at = NOW() 
         WHERE id = $1`,
        [id]
      );
      
      // Update finance deal
      await query(
        'UPDATE finance_deals SET signature_status = NULL WHERE signature_request_id = $1',
        [id]
      );
      
      // Log event
      await this.logEvent(id, 'cancelled', {
        cancelled_at: new Date()
      });
      
      return { ...signatureRequest, status: 'cancelled' };
    } catch (error) {
      console.error('Error cancelling signature request:', error);
      throw error;
    }
  }

  /**
   * Send reminder for pending signature
   * @param {string} id - Signature request UUID
   * @returns {Promise<object>} Updated signature request
   */
  async sendReminder(id) {
    try {
      const signatureRequest = await this.getSignatureRequest(id);
      
      if (!signatureRequest) {
        throw new Error('Signature request not found');
      }
      
      if (!['pending', 'sent', 'delivered', 'viewed'].includes(signatureRequest.status)) {
        throw new Error('Cannot send reminder for this signature status');
      }
      
      // Send reminder via provider if configured
      if (signatureRequest.envelope_id && this.isConfigured) {
        console.log('Would send reminder via provider:', signatureRequest.envelope_id);
      }
      
      // Update reminder count
      await query(
        `UPDATE signature_requests 
         SET reminder_count = reminder_count + 1, last_reminder_at = NOW() 
         WHERE id = $1`,
        [id]
      );
      
      // Log event
      await this.logEvent(id, 'reminder_sent', {
        reminder_count: signatureRequest.reminder_count + 1
      });
      
      return { ...signatureRequest, reminder_count: signatureRequest.reminder_count + 1 };
    } catch (error) {
      console.error('Error sending reminder:', error);
      throw error;
    }
  }

  /**
   * Update signature request status
   * @param {string} id - Signature request UUID
   * @param {string} newStatus - New status
   * @returns {Promise<object>} Updated signature request
   */
  async updateSignatureStatus(id, newStatus) {
    try {
      const timestamp = new Date();
      let updateFields = ['status = $1', 'updated_at = NOW()'];
      let updateValues = [newStatus];
      let paramIndex = 2;

      // Update timestamp fields based on status
      if (newStatus === 'delivered') {
        updateFields.push(`delivered_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
      } else if (newStatus === 'viewed') {
        updateFields.push(`viewed_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
      } else if (newStatus === 'signed') {
        updateFields.push(`signed_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
      } else if (newStatus === 'completed') {
        updateFields.push(`completed_at = $${paramIndex}`);
        updateValues.push(timestamp);
        paramIndex++;
      }

      updateValues.push(id);

      const result = await query(
        `UPDATE signature_requests 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex}
         RETURNING *`,
        updateValues
      );

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error updating signature status:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new SignatureService();

