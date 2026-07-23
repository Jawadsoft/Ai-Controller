import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { authenticateToken, requireDealerAccess, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(requireDealerAccess);

// Get all CrewAI agent assignments for current dealer
router.get('/assignments', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        caa.*,
        ds.id as staff_id,
        u.name as staff_name,
        u.email as staff_email,
        ds.staff_role,
        CASE 
            WHEN caa.current_conversations < caa.max_concurrent_conversations 
            AND caa.is_active = true 
            THEN true 
            ELSE false 
        END as is_available
       FROM crew_ai_agent_assignments caa
       LEFT JOIN dealership_staff ds ON caa.staff_id = ds.id
       LEFT JOIN users u ON ds.user_id = u.id
       WHERE caa.dealer_id = $1
       ORDER BY caa.agent_priority, caa.performance_score DESC`,
      [req.user.dealer_id]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Error fetching agent assignments:', error);
    res.status(500).json({ error: 'Failed to fetch agent assignments' });
  }
});

// Get available agents for assignment
router.get('/available', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM get_available_agents_for_dealer($1)',
      [req.user.dealer_id]
    );

    res.json({ agents: result.rows });
  } catch (error) {
    console.error('Error fetching available agents:', error);
    res.status(500).json({ error: 'Failed to fetch available agents' });
  }
});

// Assign agent to staff member
router.post('/assign', [
  body('agent_type').isIn(['sales_consultant', 'product_specialist', 'finance_manager', 'service_advisor', 'inventory_specialist']),
  body('staff_id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { agent_type, staff_id } = req.body;

    // Verify staff member belongs to current dealer
    const staffCheck = await query(
      'SELECT id FROM dealership_staff WHERE id = $1 AND dealer_id = $2',
      [staff_id, req.user.dealer_id]
    );

    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Assign agent to staff
    const result = await query(
      'SELECT assign_agent_to_staff($1, $2, $3) as success',
      [req.user.dealer_id, agent_type, staff_id]
    );

    if (result.rows[0].success) {
      res.json({ message: 'Agent assigned successfully' });
    } else {
      res.status(500).json({ error: 'Failed to assign agent' });
    }
  } catch (error) {
    console.error('Error assigning agent:', error);
    res.status(500).json({ error: 'Failed to assign agent' });
  }
});

// Unassign agent from staff member
router.post('/unassign', [
  body('agent_type').isIn(['sales_consultant', 'product_specialist', 'finance_manager', 'service_advisor', 'inventory_specialist'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { agent_type } = req.body;

    // Unassign agent
    const result = await query(
      'SELECT unassign_agent_from_staff($1, $2) as success',
      [req.user.dealer_id, agent_type]
    );

    if (result.rows[0].success) {
      res.json({ message: 'Agent unassigned successfully' });
    } else {
      res.status(500).json({ error: 'Failed to unassign agent' });
    }
  } catch (error) {
    console.error('Error unassigning agent:', error);
    res.status(500).json({ error: 'Failed to unassign agent' });
  }
});

// Update agent configuration
router.put('/assignments/:assignmentId', [
  body('max_concurrent_conversations').optional().isInt({ min: 1, max: 50 }),
  body('is_active').optional().isBoolean(),
  body('auto_assignment').optional().isBoolean(),
  body('agent_priority').optional().isInt({ min: 1, max: 10 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { assignmentId } = req.params;
    const { max_concurrent_conversations, is_active, auto_assignment, agent_priority } = req.body;

    // Verify assignment belongs to current dealer
    const assignmentCheck = await query(
      'SELECT id FROM crew_ai_agent_assignments WHERE id = $1 AND dealer_id = $2',
      [assignmentId, req.user.dealer_id]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent assignment not found' });
    }

    // Update assignment
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (max_concurrent_conversations !== undefined) {
      updateFields.push(`max_concurrent_conversations = $${paramCount++}`);
      updateValues.push(max_concurrent_conversations);
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      updateValues.push(is_active);
    }

    if (auto_assignment !== undefined) {
      updateFields.push(`auto_assignment = $${paramCount++}`);
      updateValues.push(auto_assignment);
    }

    if (agent_priority !== undefined) {
      updateFields.push(`agent_priority = $${paramCount++}`);
      updateValues.push(agent_priority);
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(assignmentId);

    const result = await query(
      `UPDATE crew_ai_agent_assignments 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramCount} AND dealer_id = $${paramCount + 1}
       RETURNING *`,
      [...updateValues, req.user.dealer_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent assignment not found' });
    }

    res.json({
      message: 'Agent assignment updated successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating agent assignment:', error);
    res.status(500).json({ error: 'Failed to update agent assignment' });
  }
});

// Get agent performance summary
router.get('/performance', async (req, res) => {
  try {
    const daysBack = parseInt(req.query.days) || 30;
    
    const result = await query(
      'SELECT * FROM get_agent_performance_summary($1, $2)',
      [req.user.dealer_id, daysBack]
    );

    res.json({ performance: result.rows });
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    res.status(500).json({ error: 'Failed to fetch agent performance' });
  }
});

// Get agent performance details
router.get('/performance/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const daysBack = parseInt(req.query.days) || 30;

    // Verify assignment belongs to current dealer
    const assignmentCheck = await query(
      'SELECT id FROM crew_ai_agent_assignments WHERE id = $1 AND dealer_id = $2',
      [assignmentId, req.user.dealer_id]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent assignment not found' });
    }

    const result = await query(
      `SELECT 
        cap.*,
        caa.agent_name,
        caa.agent_type,
        u.name as staff_name
       FROM crew_ai_agent_performance cap
       JOIN crew_ai_agent_assignments caa ON cap.assignment_id = caa.id
       LEFT JOIN dealership_staff ds ON caa.staff_id = ds.id
       LEFT JOIN users u ON ds.user_id = u.id
       WHERE cap.assignment_id = $1 
       AND cap.created_at >= NOW() - INTERVAL '1 day' * $2
       ORDER BY cap.created_at DESC`,
      [assignmentId, daysBack]
    );

    res.json({ performance: result.rows });
  } catch (error) {
    console.error('Error fetching agent performance details:', error);
    res.status(500).json({ error: 'Failed to fetch agent performance details' });
  }
});

// Set agent availability schedule
router.post('/availability/:assignmentId', [
  body('schedule').isArray(),
  body('schedule.*.day_of_week').isInt({ min: 0, max: 6 }),
  body('schedule.*.start_time').optional().isString(),
  body('schedule.*.end_time').optional().isString(),
  body('schedule.*.is_available').isBoolean(),
  body('schedule.*.max_conversations').optional().isInt({ min: 1, max: 50 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { assignmentId } = req.params;
    const { schedule } = req.body;

    // Verify assignment belongs to current dealer
    const assignmentCheck = await query(
      'SELECT id FROM crew_ai_agent_assignments WHERE id = $1 AND dealer_id = $2',
      [assignmentId, req.user.dealer_id]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent assignment not found' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Clear existing schedule
      await query(
        'DELETE FROM crew_ai_agent_availability WHERE assignment_id = $1',
        [assignmentId]
      );

      // Insert new schedule
      for (const daySchedule of schedule) {
        await query(
          `INSERT INTO crew_ai_agent_availability (
            assignment_id, day_of_week, start_time, end_time, 
            is_available, max_conversations
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            assignmentId,
            daySchedule.day_of_week,
            daySchedule.start_time || null,
            daySchedule.end_time || null,
            daySchedule.is_available,
            daySchedule.max_conversations || 5
          ]
        );
      }

      await query('COMMIT');

      res.json({ message: 'Agent availability schedule updated successfully' });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating agent availability:', error);
    res.status(500).json({ error: 'Failed to update agent availability' });
  }
});

// Get agent availability schedule
router.get('/availability/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Verify assignment belongs to current dealer
    const assignmentCheck = await query(
      'SELECT id FROM crew_ai_agent_assignments WHERE id = $1 AND dealer_id = $2',
      [assignmentId, req.user.dealer_id]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Agent assignment not found' });
    }

    const result = await query(
      'SELECT * FROM crew_ai_agent_availability WHERE assignment_id = $1 ORDER BY day_of_week',
      [assignmentId]
    );

    res.json({ availability: result.rows });
  } catch (error) {
    console.error('Error fetching agent availability:', error);
    res.status(500).json({ error: 'Failed to fetch agent availability' });
  }
});

// Get staff members available for agent assignment
router.get('/staff-available', async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        ds.id,
        ds.staff_role,
        u.name,
        u.email,
        ds.is_active,
        COUNT(caa.id) as current_assignments
       FROM dealership_staff ds
       JOIN users u ON ds.user_id = u.id
       LEFT JOIN crew_ai_agent_assignments caa ON ds.id = caa.staff_id
       WHERE ds.dealer_id = $1 AND ds.is_active = true
       GROUP BY ds.id, ds.staff_role, u.name, u.email, ds.is_active
       ORDER BY ds.staff_role, u.name`,
      [req.user.dealer_id]
    );

    res.json({ staff: result.rows });
  } catch (error) {
    console.error('Error fetching available staff:', error);
    res.status(500).json({ error: 'Failed to fetch available staff' });
  }
});

export default router;
