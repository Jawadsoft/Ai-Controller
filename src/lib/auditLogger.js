import { query } from '../database/connection.js';

/**
 * Comprehensive Audit Logging Service for Super Admin System
 * Tracks all admin activities, generates reports, and manages audit trails
 */
class AuditLogger {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize the audit logger
   */
  async initialize() {
    try {
      // Test database connection and audit tables
      await query('SELECT 1 FROM audit_logs LIMIT 1');
      this.isInitialized = true;
      console.log('✅ Audit Logger initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Audit Logger:', error.message);
      throw error;
    }
  }

  /**
   * Log an audit event
   * @param {Object} event - The audit event to log
   * @param {string} event.userId - User ID performing the action
   * @param {string} event.userEmail - User email
   * @param {string} event.userRole - User role
   * @param {string} event.tenantId - Tenant ID (null for global actions)
   * @param {string} event.actionType - Type of action performed
   * @param {string} event.resourceType - Type of resource affected
   * @param {string} event.resourceId - ID of the resource
   * @param {string} event.resourceName - Human-readable name of the resource
   * @param {string} event.description - Description of the action
   * @param {Object} event.oldValues - Previous state (for updates)
   * @param {Object} event.newValues - New state (for creates/updates)
   * @param {Object} event.metadata - Additional context
   * @param {string} event.ipAddress - IP address of the user
   * @param {string} event.userAgent - User agent string
   * @param {string} event.sessionId - Session ID
   * @param {boolean} event.success - Whether the action was successful
   * @param {string} event.errorMessage - Error message if action failed
   */
  async logEvent(event) {
    if (!this.isInitialized) {
      console.warn('⚠️ Audit Logger not initialized, skipping audit log');
      return;
    }

    try {
      const {
        userId,
        userEmail,
        userRole,
        tenantId,
        actionType,
        resourceType,
        resourceId,
        resourceName,
        description,
        oldValues,
        newValues,
        metadata = {},
        ipAddress,
        userAgent,
        sessionId,
        success = true,
        errorMessage
      } = event;

      // Validate required fields
      if (!actionType || !description) {
        throw new Error('actionType and description are required for audit logging');
      }

      const result = await query(`
        INSERT INTO audit_logs (
          user_id, user_email, user_role, tenant_id, action_type,
          resource_type, resource_id, resource_name, description,
          old_values, new_values, metadata, ip_address, user_agent,
          session_id, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING id, created_at
      `, [
        userId, userEmail, userRole, tenantId, actionType,
        resourceType, resourceId, resourceName, description,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        JSON.stringify(metadata),
        ipAddress, userAgent, sessionId, success, errorMessage
      ]);

      const auditLogId = result.rows[0].id;
      
      // Check if this event should trigger an alert
      await this.checkForAlerts(auditLogId, event);

      console.log(`📝 Audit log created: ${actionType} - ${description} (ID: ${auditLogId})`);
      return auditLogId;

    } catch (error) {
      console.error('❌ Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Check if an audit event should trigger an alert
   */
  async checkForAlerts(auditLogId, event) {
    try {
      const { actionType, success, userRole, tenantId } = event;

      // Define alert conditions
      const alertConditions = [
        {
          condition: actionType === 'login' && !success,
          alertType: 'failed_login',
          severity: 2,
          title: 'Failed Login Attempt',
          description: `Failed login attempt for user: ${event.userEmail}`
        },
        {
          condition: actionType === 'user_role_change' && userRole === 'super_admin',
          alertType: 'privilege_escalation',
          severity: 3,
          title: 'Privilege Escalation',
          description: `User ${event.userEmail} granted super admin privileges`
        },
        {
          condition: actionType === 'bulk_operation' && event.resourceType === 'lead',
          alertType: 'bulk_data_access',
          severity: 2,
          title: 'Bulk Data Operation',
          description: `Bulk operation performed on leads by ${event.userEmail}`
        },
        {
          condition: actionType === 'data_export',
          alertType: 'data_export',
          severity: 2,
          title: 'Data Export',
          description: `Data export performed by ${event.userEmail}`
        },
        {
          condition: actionType === 'error_event',
          alertType: 'system_error',
          severity: 3,
          title: 'System Error',
          description: `System error occurred: ${event.description}`
        },
        {
          condition: actionType === 'security_event',
          alertType: 'security_violation',
          severity: 4,
          title: 'Security Violation',
          description: `Security violation detected: ${event.description}`
        }
      ];

      for (const condition of alertConditions) {
        if (condition.condition) {
          await this.createAlert({
            alertType: condition.alertType,
            severityLevel: condition.severity,
            title: condition.title,
            description: condition.description,
            auditLogId,
            userId: event.userId,
            tenantId: event.tenantId,
            metadata: event.metadata
          });
        }
      }

    } catch (error) {
      console.error('❌ Failed to check for alerts:', error);
    }
  }

  /**
   * Create an audit alert
   */
  async createAlert(alertData) {
    try {
      const {
        alertType,
        severityLevel,
        title,
        description,
        auditLogId,
        userId,
        tenantId,
        metadata = {}
      } = alertData;

      // Get severity level ID
      const severityResult = await query(`
        SELECT id FROM audit_severity_levels WHERE level = $1
      `, [severityLevel]);

      const severityId = severityResult.rows[0]?.id;

      const result = await query(`
        INSERT INTO audit_alerts (
          alert_type, severity_id, title, description, audit_log_id,
          user_id, tenant_id, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        alertType, severityId, title, description, auditLogId,
        userId, tenantId, JSON.stringify(metadata)
      ]);

      console.log(`🚨 Audit alert created: ${title} (ID: ${result.rows[0].id})`);
      return result.rows[0].id;

    } catch (error) {
      console.error('❌ Failed to create audit alert:', error);
    }
  }

  /**
   * Get audit logs with filtering and pagination
   */
  async getAuditLogs(filters = {}, pagination = {}) {
    try {
      const {
        startDate,
        endDate,
        userId,
        tenantId,
        actionType,
        resourceType,
        success,
        search,
        category
      } = filters;

      const {
        page = 1,
        limit = 50,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;

      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (startDate) {
        whereConditions.push(`al.created_at >= $${paramIndex}`);
        queryParams.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        whereConditions.push(`al.created_at <= $${paramIndex}`);
        queryParams.push(endDate);
        paramIndex++;
      }

      if (userId) {
        whereConditions.push(`al.user_id = $${paramIndex}`);
        queryParams.push(userId);
        paramIndex++;
      }

      if (tenantId) {
        whereConditions.push(`al.tenant_id = $${paramIndex}`);
        queryParams.push(tenantId);
        paramIndex++;
      }

      if (actionType) {
        whereConditions.push(`al.action_type = $${paramIndex}`);
        queryParams.push(actionType);
        paramIndex++;
      }

      if (resourceType) {
        whereConditions.push(`al.resource_type = $${paramIndex}`);
        queryParams.push(resourceType);
        paramIndex++;
      }

      if (success !== undefined) {
        whereConditions.push(`al.success = $${paramIndex}`);
        queryParams.push(success);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(
          al.description ILIKE $${paramIndex} OR
          al.user_email ILIKE $${paramIndex} OR
          al.resource_name ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (category) {
        whereConditions.push(`al.metadata->>'category' = $${paramIndex}`);
        queryParams.push(category);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_log_details al
        ${whereClause}
      `;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const dataQuery = `
        SELECT *
        FROM audit_log_details al
        ${whereClause}
        ORDER BY al.${sortBy} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);

      const dataResult = await query(dataQuery, queryParams);

      return {
        logs: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      throw error;
    }
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(reportConfig) {
    try {
      const {
        reportType = 'activity_summary',
        startDate,
        endDate,
        filters = {},
        includeCharts = true
      } = reportConfig;

      // Generate the report using the database function
      const reportResult = await query(`
        SELECT generate_audit_report($1, $2, $3, $4) as report_data
      `, [
        reportType,
        startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate || new Date(),
        JSON.stringify(filters)
      ]);

      const reportData = reportResult.rows[0].report_data;

      // Add additional analysis if requested
      if (includeCharts) {
        reportData.charts = await this.generateChartData(startDate, endDate, filters);
      }

      return reportData;

    } catch (error) {
      console.error('❌ Failed to generate audit report:', error);
      throw error;
    }
  }

  /**
   * Generate chart data for reports
   */
  async generateChartData(startDate, endDate, filters = {}) {
    try {
      const charts = {};

      // Activity over time chart
      const activityOverTime = await query(`
        SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE success = true) as success_count,
          COUNT(*) FILTER (WHERE success = false) as error_count
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY date
      `, [startDate, endDate]);

      charts.activityOverTime = activityOverTime.rows;

      // Action type distribution
      const actionDistribution = await query(`
        SELECT 
          action_type,
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE success = true) as success_count
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY action_type
        ORDER BY count DESC
        LIMIT 10
      `, [startDate, endDate]);

      charts.actionDistribution = actionDistribution.rows;

      // User activity
      const userActivity = await query(`
        SELECT 
          COALESCE(user_email, 'System') as user,
          COUNT(*) as count,
          COUNT(DISTINCT action_type) as unique_actions
        FROM audit_logs
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY user_email
        ORDER BY count DESC
        LIMIT 10
      `, [startDate, endDate]);

      charts.userActivity = userActivity.rows;

      return charts;

    } catch (error) {
      console.error('❌ Failed to generate chart data:', error);
      return {};
    }
  }

  /**
   * Get audit alerts
   */
  async getAuditAlerts(filters = {}, pagination = {}) {
    try {
      const {
        alertType,
        severityLevel,
        isResolved,
        userId,
        tenantId
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = pagination;

      const offset = (page - 1) * limit;

      let whereConditions = [];
      let queryParams = [];
      let paramIndex = 1;

      if (alertType) {
        whereConditions.push(`aa.alert_type = $${paramIndex}`);
        queryParams.push(alertType);
        paramIndex++;
      }

      if (severityLevel) {
        whereConditions.push(`asl.level = $${paramIndex}`);
        queryParams.push(severityLevel);
        paramIndex++;
      }

      if (isResolved !== undefined) {
        whereConditions.push(`aa.is_resolved = $${paramIndex}`);
        queryParams.push(isResolved);
        paramIndex++;
      }

      if (userId) {
        whereConditions.push(`aa.user_id = $${paramIndex}`);
        queryParams.push(userId);
        paramIndex++;
      }

      if (tenantId) {
        whereConditions.push(`aa.tenant_id = $${paramIndex}`);
        queryParams.push(tenantId);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_alerts aa
        LEFT JOIN audit_severity_levels asl ON aa.severity_id = asl.id
        ${whereClause}
      `;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const dataQuery = `
        SELECT 
          aa.*,
          asl.name as severity_name,
          asl.level as severity_level,
          asl.color as severity_color,
          u.email as user_email,
          d.name as tenant_name
        FROM audit_alerts aa
        LEFT JOIN audit_severity_levels asl ON aa.severity_id = asl.id
        LEFT JOIN users u ON aa.user_id = u.id
        LEFT JOIN dealers d ON aa.tenant_id = d.id
        ${whereClause}
        ORDER BY aa.${sortBy} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      queryParams.push(limit, offset);

      const dataResult = await query(dataQuery, queryParams);

      return {
        alerts: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('❌ Failed to get audit alerts:', error);
      throw error;
    }
  }

  /**
   * Resolve an audit alert
   */
  async resolveAlert(alertId, resolvedBy, resolutionNotes) {
    try {
      const result = await query(`
        UPDATE audit_alerts
        SET 
          is_resolved = true,
          resolved_by = $2,
          resolved_at = NOW(),
          resolution_notes = $3
        WHERE id = $1
        RETURNING *
      `, [alertId, resolvedBy, resolutionNotes]);

      if (result.rows.length === 0) {
        throw new Error('Alert not found');
      }

      console.log(`✅ Audit alert resolved: ${alertId}`);
      return result.rows[0];

    } catch (error) {
      console.error('❌ Failed to resolve audit alert:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(period = '30d') {
    try {
      const periodDays = parseInt(period.replace('d', ''));
      const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      const stats = await query(`
        SELECT 
          COUNT(*) as total_events,
          COUNT(*) FILTER (WHERE success = true) as successful_events,
          COUNT(*) FILTER (WHERE success = false) as failed_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT tenant_id) as unique_tenants,
          COUNT(*) FILTER (WHERE action_type = 'security_event') as security_events,
          COUNT(*) FILTER (WHERE action_type = 'error_event') as error_events
        FROM audit_logs
        WHERE created_at >= $1
      `, [startDate]);

      return stats.rows[0];

    } catch (error) {
      console.error('❌ Failed to get audit statistics:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs based on retention policies
   */
  async cleanupOldLogs() {
    try {
      const result = await query('SELECT cleanup_audit_logs() as deleted_count');
      const deletedCount = result.rows[0].deleted_count;
      
      console.log(`🧹 Cleaned up ${deletedCount} old audit logs`);
      return deletedCount;

    } catch (error) {
      console.error('❌ Failed to cleanup old audit logs:', error);
      throw error;
    }
  }

  /**
   * Export audit logs to CSV
   */
  async exportAuditLogs(filters = {}, format = 'csv') {
    try {
      const logs = await this.getAuditLogs(filters, { limit: 10000 }); // Large limit for export
      
      if (format === 'csv') {
        return this.convertToCSV(logs.logs);
      } else if (format === 'json') {
        return JSON.stringify(logs.logs, null, 2);
      }

      throw new Error(`Unsupported export format: ${format}`);

    } catch (error) {
      console.error('❌ Failed to export audit logs:', error);
      throw error;
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  convertToCSV(logs) {
    if (logs.length === 0) return '';

    const headers = [
      'ID', 'User Email', 'User Role', 'Tenant', 'Action Type', 'Resource Type',
      'Resource Name', 'Description', 'Success', 'IP Address', 'Created At'
    ];

    const rows = logs.map(log => [
      log.id,
      log.user_email || '',
      log.user_role || '',
      log.tenant_name || 'Global',
      log.action_type,
      log.resource_type || '',
      log.resource_name || '',
      log.description,
      log.success ? 'Yes' : 'No',
      log.ip_address || '',
      log.created_at
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

// Create singleton instance
const auditLogger = new AuditLogger();

export default auditLogger;
