import express from 'express';
import { query } from '../database/connection.js';

const router = express.Router();

// Get all follow-ups for a lead
router.get('/:leadId/follow-ups', async (req, res) => {
  try {
    const { leadId } = req.params;
    
    const result = await query(`
      SELECT 
        fu.*,
        u1.name as created_by_name,
        u2.name as completed_by_name
      FROM lead_follow_ups fu
      LEFT JOIN users u1 ON fu.created_by = u1.id
      LEFT JOIN users u2 ON fu.completed_by = u2.id
      WHERE fu.lead_id = $1
      ORDER BY fu.scheduled_date ASC
    `, [leadId]);
    
    res.json({
      success: true,
      followUps: result.rows
    });
  } catch (error) {
    console.error('Error fetching follow-ups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch follow-ups'
    });
  }
});

// Create a new follow-up
router.post('/:leadId/follow-ups', async (req, res) => {
  try {
    const { leadId } = req.params;
    const { 
      scheduled_date, 
      follow_up_type = 'call', 
      notes = null,
      created_by 
    } = req.body;
    
    if (!scheduled_date) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled date is required'
      });
    }
    
    const result = await query(`
      INSERT INTO lead_follow_ups (
        lead_id, scheduled_date, follow_up_type, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [leadId, scheduled_date, follow_up_type, notes, created_by]);
    
    res.status(201).json({
      success: true,
      followUp: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating follow-up:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create follow-up'
    });
  }
});

// Update a follow-up
router.put('/follow-ups/:followUpId', async (req, res) => {
  try {
    const { followUpId } = req.params;
    const { 
      scheduled_date, 
      follow_up_type, 
      status, 
      notes, 
      outcome,
      completed_by 
    } = req.body;
    
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (scheduled_date !== undefined) {
      updateFields.push(`scheduled_date = $${paramCount++}`);
      values.push(scheduled_date);
    }
    
    if (follow_up_type !== undefined) {
      updateFields.push(`follow_up_type = $${paramCount++}`);
      values.push(follow_up_type);
    }
    
    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(status);
      
      // If marking as completed, set completed_at and completed_by
      if (status === 'completed') {
        updateFields.push(`completed_at = NOW()`);
        if (completed_by) {
          updateFields.push(`completed_by = $${paramCount++}`);
          values.push(completed_by);
        }
      }
    }
    
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      values.push(notes);
    }
    
    if (outcome !== undefined) {
      updateFields.push(`outcome = $${paramCount++}`);
      values.push(outcome);
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(followUpId);
    
    if (updateFields.length === 1) { // Only updated_at
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }
    
    const result = await query(`
      UPDATE lead_follow_ups 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Follow-up not found'
      });
    }
    
    res.json({
      success: true,
      followUp: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating follow-up:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update follow-up'
    });
  }
});

// Delete a follow-up
router.delete('/follow-ups/:followUpId', async (req, res) => {
  try {
    const { followUpId } = req.params;
    
    const result = await query(`
      DELETE FROM lead_follow_ups 
      WHERE id = $1
      RETURNING id
    `, [followUpId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Follow-up not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Follow-up deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting follow-up:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete follow-up'
    });
  }
});

// Get upcoming follow-ups for dashboard
router.get('/follow-ups/upcoming', async (req, res) => {
  try {
    const { days = 7, userId } = req.query;
    
    let queryStr = `
      SELECT 
        fu.*,
        l.customer_name,
        l.customer_email,
        l.customer_phone,
        v.year,
        v.make,
        v.model,
        u.name as created_by_name
      FROM lead_follow_ups fu
      JOIN leads l ON fu.lead_id = l.id
      LEFT JOIN vehicles v ON l.vehicle_id = v.id
      LEFT JOIN users u ON fu.created_by = u.id
      WHERE fu.status = 'scheduled'
        AND fu.scheduled_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
    `;
    
    const params = [];
    if (userId) {
      queryStr += ` AND fu.created_by = $1`;
      params.push(userId);
    }
    
    queryStr += ` ORDER BY fu.scheduled_date ASC`;
    
    const result = await query(queryStr, params);
    
    res.json({
      success: true,
      followUps: result.rows
    });
  } catch (error) {
    console.error('Error fetching upcoming follow-ups:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming follow-ups'
    });
  }
});

export default router;
