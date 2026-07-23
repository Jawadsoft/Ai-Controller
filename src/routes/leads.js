import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../database/connection.js';
import { sendNewLeadNotification } from '../lib/notificationHelper.js';

const router = express.Router();

function leadNeedsCreditPipelineEmail(row) {
  const e = row.customer_email;
  if (e == null) return true;
  const t = String(e).trim();
  return !t || t.toLowerCase() === 'no-email@example.com';
}

/** Fill placeholder lead emails from credit_applications / tokens / customers linked via daive_conversations.lead_id */
async function enrichLeadCustomerEmailsFromCreditPipeline(rows) {
  if (!rows.length) return;
  const need = rows.filter(leadNeedsCreditPipelineEmail);
  if (!need.length) return;
  const ids = need.map((r) => r.id);
  try {
    const enriched = await query(
      `SELECT DISTINCT ON (dc.lead_id)
         dc.lead_id,
         COALESCE(
           NULLIF(TRIM(ca.customer_email), ''),
           NULLIF(TRIM(cat.customer_email), ''),
           NULLIF(TRIM(c.email), '')
         ) AS customer_email
       FROM daive_conversations dc
       LEFT JOIN customers c ON c.id = dc.customer_id
       LEFT JOIN LATERAL (
         SELECT customer_email FROM credit_applications
         WHERE conversation_id = dc.id
         ORDER BY updated_at DESC NULLS LAST, created_at DESC
         LIMIT 1
       ) ca ON true
       LEFT JOIN LATERAL (
         SELECT customer_email FROM credit_application_tokens
         WHERE conversation_id = dc.id
         ORDER BY created_at DESC
         LIMIT 1
       ) cat ON true
       WHERE dc.lead_id = ANY($1::uuid[])
       ORDER BY dc.lead_id`,
      [ids]
    );
    const byLead = new Map(
      enriched.rows
        .filter((r) => r.customer_email && String(r.customer_email).trim())
        .map((r) => [r.lead_id, String(r.customer_email).trim()])
    );
    for (const row of rows) {
      if (!leadNeedsCreditPipelineEmail(row)) continue;
      const replacement = byLead.get(row.id);
      if (replacement) row.customer_email = replacement;
    }
  } catch (err) {
    console.error('enrichLeadCustomerEmailsFromCreditPipeline:', err.message);
  }
}

// Get all leads for the authenticated dealer
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    
    let sqlQuery;
    let params;
    
    // Super admin should NOT see dealership leads
    if (req.user.dealer_id) {
      // Staff can see leads by dealer_id, but sales agents only see their assigned leads
      if (req.user.staff_role === 'sales' && req.user.staff_id) {
        sqlQuery = `
          SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name,
                 ds_assigned.user_id as assigned_user_id, u_assigned.name as assigned_agent_name,
                 u_assigned.email as assigned_agent_email
          FROM leads l 
          LEFT JOIN vehicles v ON l.vehicle_id = v.id 
          LEFT JOIN dealers d ON l.dealer_id = d.id 
          LEFT JOIN dealership_staff ds_assigned ON l.assigned_to = ds_assigned.id
          LEFT JOIN users u_assigned ON ds_assigned.user_id = u_assigned.id
          WHERE l.dealer_id = $1 AND l.assigned_to = $2
          ORDER BY l.created_at DESC
        `;
        params = [req.user.dealer_id, req.user.staff_id];
      } else {
        // Admin and other staff can see all leads for their dealer
        sqlQuery = `
          SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name,
                 ds_assigned.user_id as assigned_user_id, u_assigned.name as assigned_agent_name,
                 u_assigned.email as assigned_agent_email
          FROM leads l 
          LEFT JOIN vehicles v ON l.vehicle_id = v.id 
          LEFT JOIN dealers d ON l.dealer_id = d.id 
          LEFT JOIN dealership_staff ds_assigned ON l.assigned_to = ds_assigned.id
          LEFT JOIN users u_assigned ON ds_assigned.user_id = u_assigned.id
          WHERE l.dealer_id = $1 
          ORDER BY l.created_at DESC
        `;
        params = [req.user.dealer_id];
      }
    } else {
      // No dealer_id means no lead access (including super admin)
      return res.json([]);
    }
    
    const result = await query(sqlQuery, params);
    await enrichLeadCustomerEmailsFromCreditPipeline(result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ error: 'Failed to fetch leads', details: error.message });
  }
});

// Get available sales agents for assignment
router.get('/sales-agents', async (req, res) => {
  try {
    const userId = req.user.id;

    // Only admin can see sales agents
    if (req.user.staff_role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can view sales agents' });
    }

    let sqlQuery;
    let params;

    // Super admin should NOT see dealership sales agents
    if (req.user.dealer_id) {
      // Admin can see sales agents for their dealer
      sqlQuery = `
        SELECT ds.id, u.name, ds.staff_role, u.email
        FROM dealership_staff ds
        JOIN users u ON ds.user_id = u.id
        WHERE ds.dealer_id = $1 AND ds.staff_role = 'sales' AND ds.is_active = true
        ORDER BY u.name
      `;
      params = [req.user.dealer_id];
    } else {
      // No dealer access
      return res.json([]);
    }

    const result = await query(sqlQuery, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get sales agents error:', error);
    res.status(500).json({ error: 'Failed to fetch sales agents' });
  }
});

// Lead + DAIVE analytics (must be registered before /:id or "analytics" is treated as a lead id)
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defaultEndDate = new Date().toISOString().split('T')[0];

    const start = startDate || defaultStartDate;
    const end = endDate || defaultEndDate;

    const emptyPayload = {
      success: true,
      data: {
        daily: [],
        summary: {},
        period: { startDate: start, endDate: end },
        totals: {
          total_conversations: 0,
          total_qualified_leads: 0,
          total_handoff_requests: 0,
          overall_avg_lead_score: 0,
        },
        messages: [],
        additional_metrics: {
          total_conversations: 0,
          total_voice_sessions: 0,
          total_leads_generated: 0,
          avg_lead_score: 0,
          handoff_requested: 0,
          handoff_accepted: 0,
          status_breakdown: { new: 0, hot: 0, warm: 0, cold: 0 },
        },
        conversations_sample: [],
      },
    };

    if (!req.user.dealer_id) {
      return res.json(emptyPayload);
    }

    const dealerId = req.user.dealer_id;

    const dailySql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_leads,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads,
        COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_leads,
        AVG(CASE WHEN interest_level = 'low' THEN 1 WHEN interest_level = 'medium' THEN 2 WHEN interest_level = 'high' THEN 3 END) as avg_interest_score
      FROM leads 
      WHERE dealer_id = $1 AND created_at::date >= $2::date AND created_at::date <= $3::date
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const dailyStats = await query(dailySql, [dealerId, start, end]);

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as total_new_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as total_contacted_leads,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as total_qualified_leads,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as total_converted_leads,
        COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as total_assigned_leads,
        AVG(CASE WHEN interest_level = 'low' THEN 1 WHEN interest_level = 'medium' THEN 2 WHEN interest_level = 'high' THEN 3 END) as overall_avg_interest_score
      FROM leads 
      WHERE dealer_id = $1 AND created_at::date >= $2::date AND created_at::date <= $3::date
    `;
    const summaryStats = await query(summaryQuery, [dealerId, start, end]);
    const s = summaryStats.rows[0] || {};

    let daiveDaily = { rows: [] };
    let daiveAgg = { rows: [{}] };
    let sampleRows = [];
    try {
      daiveDaily = await query(
        `
        SELECT 
          DATE(dc.created_at) as date,
          COUNT(*)::int as total_conversations,
          COUNT(*) FILTER (WHERE dc.lead_qualification_score >= 60)::int as qualified_leads,
          COUNT(*) FILTER (WHERE dc.handoff_requested = true)::int as handoff_requests,
          COALESCE(AVG(dc.lead_qualification_score), 0)::float as avg_lead_score
        FROM daive_conversations dc
        WHERE dc.dealer_id = $1
          AND dc.created_at::date >= $2::date
          AND dc.created_at::date <= $3::date
        GROUP BY DATE(dc.created_at)
        ORDER BY date DESC
        `,
        [dealerId, start, end]
      );

      daiveAgg = await query(
        `
        SELECT 
          COUNT(*)::int as total_conversations,
          COUNT(*) FILTER (WHERE LOWER(COALESCE(conversation_type, '')) = 'voice')::int as total_voice_sessions,
          COUNT(*) FILTER (WHERE lead_id IS NOT NULL)::int as leads_from_daive,
          COALESCE(AVG(lead_qualification_score), 0)::numeric as avg_lead_score,
          COUNT(*) FILTER (WHERE handoff_requested = true)::int as handoff_requested,
          COUNT(*) FILTER (WHERE handoff_accepted_at IS NOT NULL)::int as handoff_accepted,
          COUNT(*) FILTER (WHERE lead_status = 'hot')::int as hot,
          COUNT(*) FILTER (WHERE lead_status = 'warm')::int as warm,
          COUNT(*) FILTER (WHERE lead_status = 'cold')::int as cold,
          COUNT(*) FILTER (WHERE COALESCE(lead_status, 'new') = 'new')::int as new_status
        FROM daive_conversations
        WHERE dealer_id = $1
          AND created_at::date >= $2::date
          AND created_at::date <= $3::date
        `,
        [dealerId, start, end]
      );

      const sampleResult = await query(
        `
        SELECT dc.id, dc.customer_name, dc.customer_email, dc.lead_qualification_score, dc.lead_status,
               dc.handoff_requested, dc.created_at, v.make, v.model, v.year
        FROM daive_conversations dc
        LEFT JOIN vehicles v ON dc.vehicle_id = v.id
        WHERE dc.dealer_id = $1
          AND dc.created_at::date >= $2::date
          AND dc.created_at::date <= $3::date
        ORDER BY dc.created_at DESC
        LIMIT 20
        `,
        [dealerId, start, end]
      );
      sampleRows = sampleResult.rows;
    } catch (daiveErr) {
      console.error('DAIVE analytics queries failed (optional):', daiveErr.message);
    }

    const dg = daiveAgg.rows[0] || {};
    const totalConv = Number(dg.total_conversations) || 0;
    const avgFromInterest =
      s.overall_avg_interest_score != null
        ? Math.round((Number(s.overall_avg_interest_score) / 3) * 100)
        : 0;
    const avgLeadScore = totalConv > 0 ? Math.round(Number(dg.avg_lead_score)) : avgFromInterest;

    const statusFromLeads = {
      new: Number(s.total_new_leads) || 0,
      hot: (Number(s.total_qualified_leads) || 0) + (Number(s.total_converted_leads) || 0),
      warm: Number(s.total_contacted_leads) || 0,
      cold: 0,
    };

    const additional_metrics = {
      total_conversations: totalConv,
      total_voice_sessions: Number(dg.total_voice_sessions) || 0,
      total_leads_generated: Number(s.total_leads) || 0,
      avg_lead_score: avgLeadScore,
      handoff_requested: Number(dg.handoff_requested) || 0,
      handoff_accepted: Number(dg.handoff_accepted) || 0,
      status_breakdown:
        totalConv > 0
          ? {
              new: Number(dg.new_status) || 0,
              hot: Number(dg.hot) || 0,
              warm: Number(dg.warm) || 0,
              cold: Number(dg.cold) || 0,
            }
          : statusFromLeads,
    };

    const daily =
      daiveDaily.rows.length > 0
        ? daiveDaily.rows.map((row) => ({
            date: row.date,
            total_conversations: Number(row.total_conversations) || 0,
            qualified_leads: Number(row.qualified_leads) || 0,
            handoff_requests: Number(row.handoff_requests) || 0,
            avg_lead_score: row.avg_lead_score != null ? Number(row.avg_lead_score) : 0,
          }))
        : dailyStats.rows.map((row) => ({
            date: row.date,
            total_conversations: Number(row.total_leads) || 0,
            qualified_leads: Number(row.qualified_leads) || 0,
            handoff_requests: 0,
            avg_lead_score:
              row.avg_interest_score != null
                ? Math.round((Number(row.avg_interest_score) / 3) * 100)
                : 0,
          }));

    const conversations_sample = sampleRows.map((r) => ({
      id: r.id,
      customer_name: r.customer_name,
      customer_email: r.customer_email,
      lead_qualification_score: r.lead_qualification_score ?? 0,
      lead_status: r.lead_status || 'new',
      handoff_requested: !!r.handoff_requested,
      created_at: r.created_at,
      make: r.make,
      model: r.model,
      year: r.year,
    }));

    res.json({
      success: true,
      data: {
        daily,
        summary: s,
        period: { startDate: start, endDate: end },
        totals: {
          total_conversations: additional_metrics.total_conversations,
          total_qualified_leads: daily.reduce((acc, d) => acc + (d.qualified_leads || 0), 0),
          total_handoff_requests: additional_metrics.handoff_requested,
          overall_avg_lead_score: additional_metrics.avg_lead_score,
        },
        messages: [],
        additional_metrics,
        conversations_sample,
      },
    });
  } catch (error) {
    console.error('Get leads analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch leads analytics' });
  }
});

// Get single lead
router.get('/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    
    let sqlQuery;
    let params;
    
    // Super admin should NOT access individual leads
    if (req.user.dealer_id) {
      sqlQuery = `
        SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name
        FROM leads l 
        LEFT JOIN vehicles v ON l.vehicle_id = v.id 
        LEFT JOIN dealers d ON l.dealer_id = d.id 
        WHERE l.id = $1 AND l.dealer_id = $2
      `;
      params = [leadId, req.user.dealer_id];
    } else {
      sqlQuery = `
        SELECT l.*, v.make, v.model, v.year, v.vin, d.business_name as dealer_name
        FROM leads l 
        LEFT JOIN vehicles v ON l.vehicle_id = v.id 
        LEFT JOIN dealers d ON l.dealer_id = d.id 
        WHERE l.id = $1 AND d.user_id = $2
      `;
      params = [leadId, userId];
    }
    
    const result = await query(sqlQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await enrichLeadCustomerEmailsFromCreditPipeline(result.rows);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Create new lead (public endpoint - no auth required)
router.post('/public', [
  body('vehicle_id').isUUID(),
  body('customer_name').notEmpty().trim(),
  body('customer_email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vehicle_id, customer_name, customer_email, customer_phone, message, interest_level = 'medium' } = req.body;
    
    // Get dealer ID from vehicle
    const vehicleResult = await query('SELECT dealer_id FROM vehicles WHERE id = $1', [vehicle_id]);
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    const dealerId = vehicleResult.rows[0].dealer_id;
    
    const result = await query(
      `INSERT INTO leads 
       (dealer_id, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [dealerId, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, 'new']
    );

    const lead = result.rows[0];
    sendNewLeadNotification(lead, customer_name, customer_email, vehicle_id).catch(() => {});
    
    res.status(201).json(lead);
  } catch (error) {
    console.error('Create public lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Create new lead (authenticated)
router.post('/', [
  body('vehicle_id').isUUID(),
  body('customer_name').notEmpty().trim(),
  body('customer_email').isEmail().normalizeEmail()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { vehicle_id, customer_name, customer_email, customer_phone, message, interest_level = 'medium' } = req.body;
    
    // Get dealer ID for this user (prefer staff dealer_id)
    let dealerId = req.user.dealer_id;
    if (!dealerId) {
      const dealerResult = await query('SELECT id FROM dealers WHERE user_id = $1', [userId]);
      if (dealerResult.rows.length === 0) {
        return res.status(404).json({ error: 'Dealer profile not found' });
      }
      dealerId = dealerResult.rows[0].id;
    }
    
    const result = await query(
      `INSERT INTO leads 
       (dealer_id, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [dealerId, vehicle_id, customer_name, customer_email, customer_phone, message, interest_level, 'new']
    );

    const lead = result.rows[0];
    sendNewLeadNotification(lead, customer_name, customer_email, vehicle_id).catch(() => {});
    
    res.status(201).json(lead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Update lead
router.put('/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    const { status, interest_level, message } = req.body;
    
    // Check if lead belongs to this dealer
    let leadCheck;
    if (req.user.dealer_id) {
      leadCheck = await query('SELECT id FROM leads WHERE id = $1 AND dealer_id = $2', [leadId, req.user.dealer_id]);
    } else {
      leadCheck = await query(
        'SELECT l.id FROM leads l JOIN dealers d ON l.dealer_id = d.id WHERE l.id = $1 AND d.user_id = $2',
        [leadId, userId]
      );
    }
    
    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    const result = await query(
      `UPDATE leads SET 
       status = COALESCE($1, status),
       interest_level = COALESCE($2, interest_level),
       message = COALESCE($3, message),
       updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, interest_level, message, leadId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Delete lead
router.delete('/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    
    // Check if lead belongs to this dealer
    let deleteQuery;
    let params;
    
    if (req.user.dealer_id) {
      deleteQuery = 'DELETE FROM leads WHERE id = $1 AND dealer_id = $2 RETURNING id';
      params = [leadId, req.user.dealer_id];
    } else {
      deleteQuery = `
        DELETE FROM leads 
        WHERE id = $1 AND dealer_id IN (
          SELECT id FROM dealers WHERE user_id = $2
        ) 
        RETURNING id
      `;
      params = [leadId, userId];
    }
    
    const result = await query(deleteQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }
    
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Assign lead to sales agent (admin only)
router.post('/:id/assign', [
  body('staff_id').isUUID()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const leadId = req.params.id;
    const userId = req.user.id;
    const { staff_id } = req.body;

    // Only admin and super_admin can assign leads
    if (req.user.role !== 'super_admin' && req.user.staff_role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can assign leads' });
    }

    // Check if lead exists and belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const leadCheck = await query('SELECT id, dealer_id FROM leads WHERE id = $1 AND dealer_id = $2', [leadId, req.user.dealer_id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const leadDealerId = leadCheck.rows[0].dealer_id;

    // Verify the staff member exists and belongs to the same dealer
    const staffCheck = await query(
      'SELECT ds.id, u.name, ds.staff_role FROM dealership_staff ds JOIN users u ON ds.user_id = u.id WHERE ds.id = $1 AND ds.dealer_id = $2 AND ds.staff_role = $3',
      [staff_id, leadDealerId, 'sales']
    );

    if (staffCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sales agent not found or not valid for this dealer' });
    }

    // Assign the lead
    const result = await query(
      `UPDATE leads SET 
       assigned_to = $1,
       assigned_at = NOW(),
       assigned_by = $2,
       updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [staff_id, userId, leadId]
    );

    res.json({
      message: 'Lead assigned successfully',
      lead: result.rows[0],
      assigned_agent: staffCheck.rows[0]
    });
  } catch (error) {
    console.error('Assign lead error:', error);
    res.status(500).json({ error: 'Failed to assign lead', details: error.message });
  }
});

// Unassign lead (admin only)
router.post('/:id/unassign', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;

    // Only admin and super_admin can unassign leads
    if (req.user.role !== 'super_admin' && req.user.staff_role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can unassign leads' });
    }

    // Check if lead exists and belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const leadCheck = await query('SELECT id FROM leads WHERE id = $1 AND dealer_id = $2', [leadId, req.user.dealer_id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Unassign the lead
    const result = await query(
      `UPDATE leads SET 
       assigned_to = NULL,
       assigned_at = NULL,
       assigned_by = NULL,
       updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [leadId]
    );

    res.json({
      message: 'Lead unassigned successfully',
      lead: result.rows[0]
    });
  } catch (error) {
    console.error('Unassign lead error:', error);
    res.status(500).json({ error: 'Failed to unassign lead' });
  }
});

// Get conversation history for a lead
router.get('/:id/conversations', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;

    // Check if lead exists and belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ error: 'Dealer access required' });
    }

    const leadCheck = await query('SELECT id, dealer_id FROM leads WHERE id = $1 AND dealer_id = $2', [leadId, req.user.dealer_id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const leadDealerId = leadCheck.rows[0].dealer_id;

    // Get conversations related to this lead by customer email or phone
    const leadDetails = await query('SELECT customer_email, customer_phone FROM leads WHERE id = $1', [leadId]);
    const lead = leadDetails.rows[0];

    // Find conversations by customer email or phone
    const conversationsQuery = `
      SELECT 
        dc.id,
        dc.session_id,
        dc.customer_name,
        dc.customer_email,
        dc.customer_phone,
        dc.conversation_type,
        dc.lead_qualification_score,
        dc.lead_status,
        dc.handoff_requested,
        dc.handoff_reason,
        dc.handoff_requested_at,
        dc.created_at,
        dc.updated_at,
        v.make,
        v.model,
        v.year,
        v.vin,
        v.price
      FROM daive_conversations dc
      LEFT JOIN vehicles v ON dc.vehicle_id = v.id
      WHERE dc.dealer_id = $1 
      AND (dc.customer_email = $2 OR dc.customer_phone = $3)
      ORDER BY dc.created_at DESC
    `;

    const conversations = await query(conversationsQuery, [
      leadDealerId, 
      lead.customer_email, 
      lead.customer_phone
    ]);

    // Get messages for each conversation
    const conversationsWithMessages = await Promise.all(
      conversations.rows.map(async (conversation) => {
        const messagesQuery = `
          SELECT 
            id,
            role,
            content,
            created_at as timestamp
          FROM conversation_messages
          WHERE conversation_id = $1
          ORDER BY created_at ASC
        `;
        
        const messages = await query(messagesQuery, [conversation.id]);
        
        return {
          ...conversation,
          messages: messages.rows
        };
      })
    );

    res.json({
      success: true,
      data: {
        lead_id: leadId,
        conversations: conversationsWithMessages,
        total_conversations: conversationsWithMessages.length
      }
    });

  } catch (error) {
    console.error('Get lead conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// Send SMS to lead
router.post('/:id/sms', async (req, res) => {
  try {
    const leadId = req.params.id;
    const userId = req.user.id;
    const { message, phone, customer_name } = req.body;

    if (!message || !phone) {
      return res.status(400).json({ 
        success: false,
        error: 'Message and phone number are required' 
      });
    }

    // Check if lead exists and belongs to this dealer
    if (!req.user.dealer_id) {
      return res.status(403).json({ 
        success: false,
        error: 'Dealer access required' 
      });
    }

    const leadCheck = await query('SELECT id, dealer_id, customer_name FROM leads WHERE id = $1 AND dealer_id = $2', [leadId, req.user.dealer_id]);

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Lead not found' 
      });
    }

    const lead = leadCheck.rows[0];

    // Import SMS service
    const smsService = require('../lib/smsService');

    // Validate phone number
    const isValidPhone = await smsService.validatePhoneNumber(phone);
    if (!isValidPhone) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid phone number format' 
      });
    }

    // Format phone number
    const formattedPhone = smsService.formatPhoneNumber(phone);

    // Send SMS
    const smsResult = await smsService.sendSMS(formattedPhone, message);

    // Log SMS activity in lead notes
    const smsLog = `SMS sent to ${customer_name || lead.customer_name} (${formattedPhone}) on ${new Date().toLocaleString()}:\n"${message}"\n\nSMS SID: ${smsResult.sid}`;
    
    await query(
      'UPDATE leads SET notes = COALESCE(notes, \'\') || $1, updated_at = NOW() WHERE id = $2',
      [`\n\n[SMS Activity]\n${smsLog}`, leadId]
    );

    res.json({
      success: true,
      data: {
        message: 'SMS sent successfully',
        smsResult: smsResult,
        leadId: leadId,
        customerName: customer_name || lead.customer_name,
        phone: formattedPhone
      }
    });

  } catch (error) {
    console.error('Send SMS error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to send SMS' 
    });
  }
});

export default router;
