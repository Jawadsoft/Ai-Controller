/**
 * Conversation Context Service
 * Handles database operations for the optimized conversation context structure
 */

import { pool } from '../database/connection.js';

class ConversationContextService {
  constructor() {
    this.tableName = 'conversation_context_optimized';
  }

  /**
   * Create or update a conversation context
   * @param {Object} contextData - The conversation context data
   * @returns {Promise<Object>} - The created/updated context
   */
  async upsertConversationContext(contextData) {
    try {
      const {
        session_id,
        user_id,
        dealer_id,
        current_step,
        daivesteps,
        step_completion,
        shared_vehicles,
        rejected_vehicles,
        selected_vehicles,
        lead_qualification_score,
        lead_status,
        customer_profile,
        budget_info,
        vehicle_preferences,
        test_drive_info,
        appointment_info,
        finance_info,
        purchase_commitment,
        delivery_info,
        csi_followup,
        conversation_duration,
        message_count,
        handoff_requested,
        handoff_to_user_id
      } = contextData;

      const query = `
        INSERT INTO ${this.tableName} (
          session_id, user_id, dealer_id, current_step, daivesteps, step_completion,
          shared_vehicles, rejected_vehicles, selected_vehicles, lead_qualification_score,
          lead_status, customer_profile, budget_info, vehicle_preferences, test_drive_info,
          appointment_info, finance_info, purchase_commitment, delivery_info, csi_followup,
          conversation_duration, message_count, handoff_requested, handoff_to_user_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )
        ON CONFLICT (session_id) 
        DO UPDATE SET
          user_id = EXCLUDED.user_id,
          dealer_id = EXCLUDED.dealer_id,
          current_step = EXCLUDED.current_step,
          daivesteps = EXCLUDED.daivesteps,
          step_completion = EXCLUDED.step_completion,
          shared_vehicles = EXCLUDED.shared_vehicles,
          rejected_vehicles = EXCLUDED.rejected_vehicles,
          selected_vehicles = EXCLUDED.selected_vehicles,
          lead_qualification_score = EXCLUDED.lead_qualification_score,
          lead_status = EXCLUDED.lead_status,
          customer_profile = EXCLUDED.customer_profile,
          budget_info = EXCLUDED.budget_info,
          vehicle_preferences = EXCLUDED.vehicle_preferences,
          test_drive_info = EXCLUDED.test_drive_info,
          appointment_info = EXCLUDED.appointment_info,
          finance_info = EXCLUDED.finance_info,
          purchase_commitment = EXCLUDED.purchase_commitment,
          delivery_info = EXCLUDED.delivery_info,
          csi_followup = EXCLUDED.csi_followup,
          conversation_duration = EXCLUDED.conversation_duration,
          message_count = EXCLUDED.message_count,
          handoff_requested = EXCLUDED.handoff_requested,
          handoff_to_user_id = EXCLUDED.handoff_to_user_id,
          last_updated = NOW()
        RETURNING *
      `;

      const values = [
        session_id, user_id, dealer_id, current_step, 
        JSON.stringify(daivesteps), JSON.stringify(step_completion),
        JSON.stringify(shared_vehicles || []), 
        JSON.stringify(rejected_vehicles || []), 
        JSON.stringify(selected_vehicles || []),
        lead_qualification_score || 0, lead_status || 'new',
        JSON.stringify(customer_profile || {}), 
        JSON.stringify(budget_info || {}), 
        JSON.stringify(vehicle_preferences || {}),
        JSON.stringify(test_drive_info || {}), 
        JSON.stringify(appointment_info || {}),
        JSON.stringify(finance_info || {}), 
        JSON.stringify(purchase_commitment || {}),
        JSON.stringify(delivery_info || {}), 
        JSON.stringify(csi_followup || {}),
        conversation_duration || 0, message_count || 0,
        handoff_requested || false, handoff_to_user_id
      ];

      const result = await pool.query(query, values);
      return this.formatContextData(result.rows[0]);
    } catch (error) {
      console.error('Error upserting conversation context:', error);
      throw error;
    }
  }

  /**
   * Get conversation context by session ID
   * @param {string} sessionId - The session ID
   * @returns {Promise<Object|null>} - The conversation context or null
   */
  async getConversationContext(sessionId) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE session_id = $1`;
      const result = await pool.query(query, [sessionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return this.formatContextData(result.rows[0]);
    } catch (error) {
      console.error('Error getting conversation context:', error);
      throw error;
    }
  }

  /**
   * Get all conversation contexts for a dealer
   * @param {string} dealerId - The dealer ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of conversation contexts
   */
  async getConversationContextsByDealer(dealerId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        status = null,
        step = null,
        sortBy = 'last_updated',
        sortOrder = 'DESC'
      } = options;

      let query = `SELECT * FROM ${this.tableName} WHERE dealer_id = $1`;
      const values = [dealerId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        query += ` AND lead_status = $${paramCount}`;
        values.push(status);
      }

      if (step) {
        paramCount++;
        query += ` AND current_step = $${paramCount}`;
        values.push(step);
      }

      query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      values.push(limit, offset);

      const result = await pool.query(query, values);
      return result.rows.map(row => this.formatContextData(row));
    } catch (error) {
      console.error('Error getting conversation contexts by dealer:', error);
      throw error;
    }
  }

  /**
   * Get live leads for monitoring (real-time data)
   * @param {string} dealerId - The dealer ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of live lead data
   */
  async getLiveLeads(dealerId, options = {}) {
    try {
      const {
        limit = 100,
        status = null,
        step = null,
        timeRange = '24h' // '1h', '24h', '7d', '30d'
      } = options;

      let timeFilter = '';
      switch (timeRange) {
        case '1h':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '1 hour'";
          break;
        case '24h':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '24 hours'";
          break;
        case '7d':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '7 days'";
          break;
        case '30d':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '30 days'";
          break;
      }

      let query = `
        SELECT 
          session_id,
          user_id,
          dealer_id,
          created_at,
          last_updated,
          current_step,
          daivesteps,
          lead_qualification_score,
          lead_status,
          customer_profile,
          budget_info,
          vehicle_preferences,
          conversation_duration,
          message_count,
          handoff_requested
        FROM ${this.tableName} 
        WHERE dealer_id = $1 ${timeFilter}
      `;

      const values = [dealerId];
      let paramCount = 1;

      if (status) {
        paramCount++;
        query += ` AND lead_status = $${paramCount}`;
        values.push(status);
      }

      if (step) {
        paramCount++;
        query += ` AND current_step = $${paramCount}`;
        values.push(step);
      }

      query += ` ORDER BY last_updated DESC LIMIT $${paramCount + 1}`;
      values.push(limit);

      const result = await pool.query(query, values);
      return result.rows.map(row => this.formatContextData(row));
    } catch (error) {
      console.error('Error getting live leads:', error);
      throw error;
    }
  }

  /**
   * Update specific step data in conversation context
   * @param {string} sessionId - The session ID
   * @param {string} stepName - The step name to update
   * @param {Object} stepData - The step data to update
   * @returns {Promise<Object>} - The updated context
   */
  async updateStepData(sessionId, stepName, stepData) {
    try {
      const query = `
        UPDATE ${this.tableName} 
        SET daivesteps = jsonb_set(daivesteps, $1, $2, true),
            last_updated = NOW()
        WHERE session_id = $3
        RETURNING *
      `;

      const path = `{${stepName}}`;
      const result = await pool.query(query, [path, JSON.stringify(stepData), sessionId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Conversation context not found for session: ${sessionId}`);
      }
      
      return this.formatContextData(result.rows[0]);
    } catch (error) {
      console.error('Error updating step data:', error);
      throw error;
    }
  }

  /**
   * Update vehicle arrays (shared, rejected, selected)
   * @param {string} sessionId - The session ID
   * @param {string} arrayType - 'shared_vehicles', 'rejected_vehicles', or 'selected_vehicles'
   * @param {Array} vehicles - The vehicle array
   * @returns {Promise<Object>} - The updated context
   */
  async updateVehicleArray(sessionId, arrayType, vehicles) {
    try {
      const validArrayTypes = ['shared_vehicles', 'rejected_vehicles', 'selected_vehicles'];
      if (!validArrayTypes.includes(arrayType)) {
        throw new Error(`Invalid array type. Must be one of: ${validArrayTypes.join(', ')}`);
      }

      const query = `
        UPDATE ${this.tableName} 
        SET ${arrayType} = $1,
            last_updated = NOW()
        WHERE session_id = $2
        RETURNING *
      `;

      const result = await pool.query(query, [JSON.stringify(vehicles), sessionId]);
      
      if (result.rows.length === 0) {
        throw new Error(`Conversation context not found for session: ${sessionId}`);
      }
      
      return this.formatContextData(result.rows[0]);
    } catch (error) {
      console.error('Error updating vehicle array:', error);
      throw error;
    }
  }

  /**
   * Update lead status and qualification score
   * @param {string} sessionId - The session ID
   * @param {string} leadStatus - The new lead status
   * @param {number} qualificationScore - The qualification score
   * @returns {Promise<Object>} - The updated context
   */
  async updateLeadStatus(sessionId, leadStatus, qualificationScore = null) {
    try {
      let query = `UPDATE ${this.tableName} SET lead_status = $1, last_updated = NOW()`;
      const values = [leadStatus, sessionId];
      
      if (qualificationScore !== null) {
        query = `UPDATE ${this.tableName} SET lead_status = $1, lead_qualification_score = $2, last_updated = NOW()`;
        values.splice(1, 0, qualificationScore);
      }
      
      query += ` WHERE session_id = $${values.length} RETURNING *`;

      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error(`Conversation context not found for session: ${sessionId}`);
      }
      
      return this.formatContextData(result.rows[0]);
    } catch (error) {
      console.error('Error updating lead status:', error);
      throw error;
    }
  }

  /**
   * Delete conversation context
   * @param {string} sessionId - The session ID
   * @returns {Promise<boolean>} - Success status
   */
  async deleteConversationContext(sessionId) {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE session_id = $1`;
      const result = await pool.query(query, [sessionId]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting conversation context:', error);
      throw error;
    }
  }

  /**
   * Get conversation context statistics for a dealer
   * @param {string} dealerId - The dealer ID
   * @param {string} timeRange - Time range for statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getConversationStats(dealerId, timeRange = '24h') {
    try {
      let timeFilter = '';
      switch (timeRange) {
        case '1h':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '1 hour'";
          break;
        case '24h':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '24 hours'";
          break;
        case '7d':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '7 days'";
          break;
        case '30d':
          timeFilter = "AND last_updated >= NOW() - INTERVAL '30 days'";
          break;
      }

      const query = `
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN lead_status = 'hot' THEN 1 END) as hot_leads,
          COUNT(CASE WHEN lead_status = 'warm' THEN 1 END) as warm_leads,
          COUNT(CASE WHEN lead_status = 'cold' THEN 1 END) as cold_leads,
          COUNT(CASE WHEN handoff_requested = true THEN 1 END) as handoff_requests,
          AVG(lead_qualification_score) as avg_qualification_score,
          AVG(conversation_duration) as avg_conversation_duration,
          AVG(message_count) as avg_message_count
        FROM ${this.tableName} 
        WHERE dealer_id = $1 ${timeFilter}
      `;

      const result = await pool.query(query, [dealerId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting conversation stats:', error);
      throw error;
    }
  }

  /**
   * Format context data for API response
   * @param {Object} row - Database row
   * @returns {Object} - Formatted context data
   */
  formatContextData(row) {
    if (!row) return null;

    return {
      id: row.id,
      session_id: row.session_id,
      user_id: row.user_id,
      dealer_id: row.dealer_id,
      created_at: row.created_at,
      last_updated: row.last_updated,
      Currentstep: row.current_step,
      currentJourneyStep: (() => {
        const _map = {
          'Inquiry': 'inquiry', 'Lead Capture': 'lead_capture', 'Vehicle Selection': 'vehicle_selection',
          'Test Drive': 'test_drive', 'Trade Evaluation': 'trade_evaluation', 'Qualification': 'qualification',
          'Purchase Commitment': 'purchase_commitment', 'Vehicle Prep': 'vehicle_preparation',
          'Finance Manager': 'finance_manager', 'Delivery': 'delivery', 'CSI & Follow-ups': 'csi_followup'
        };
        return _map[row.current_step] ||
          (row.current_step ? String(row.current_step).toLowerCase().replace(/\s+/g, '_') : 'inquiry');
      })(),
      Daivesteps: row.daivesteps || {},
      step_completion: row.step_completion || {},
      shared_vehicles: row.shared_vehicles || [],
      rejected_vehicles: row.rejected_vehicles || [],
      selected_vehicles: row.selected_vehicles || [],
      lead_qualification_score: row.lead_qualification_score || 0,
      lead_status: row.lead_status || 'new',
      customer_profile: row.customer_profile || {},
      budget_info: row.budget_info || {},
      vehicle_preferences: row.vehicle_preferences || {},
      inventory_browse_pending: row.vehicle_preferences?.inventory_browse_pending || null,
      last_browsed_inventory: row.vehicle_preferences?.last_browsed_inventory || null,
      test_drive_info: row.test_drive_info || {},
      appointment_info: row.appointment_info || {},
      finance_info: row.finance_info || {},
      purchase_commitment: row.purchase_commitment || {},
      delivery_info: row.delivery_info || {},
      csi_followup: row.csi_followup || {},
      conversation_duration: row.conversation_duration || 0,
      message_count: row.message_count || 0,
      handoff_requested: row.handoff_requested || false,
      handoff_to_user_id: row.handoff_to_user_id
    };
  }
}

export default ConversationContextService;
