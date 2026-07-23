import auditLogger from '../lib/auditLogger.js';

// Attach tenant context from authenticated user to the request
export function attachTenantContext(req, _res, next) {
  try {
    const dealerId = req.user?.dealer_id ?? req.user?.dealerId ?? null;
    req.tenantId = dealerId;
  } catch (_e) {
    req.tenantId = null;
  }
  next();
}

// Ensure non-super-admins access only their own tenant resources
export function requireSameTenant(paramKey = 'dealerId') {
  return async (req, res, next) => {
    try {
      // Super admins bypass tenant checks
      if (req.user?.role === 'super_admin') return next();

      const targetTenantId = req.params?.[paramKey] || req.body?.dealer_id || req.body?.tenant_id;
      const requesterTenantId = req.user?.dealer_id ?? req.user?.dealerId ?? null;

      if (!requesterTenantId) {
        await auditLogger.logEvent({
          userId: req.user?.id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          tenantId: null,
          actionType: 'security_event',
          resourceType: 'tenant',
          description: 'Access denied: user without tenant tried to access tenant-scoped resource',
          success: false
        });
        return res.status(403).json({ error: 'Tenant context missing' });
      }

      if (targetTenantId && targetTenantId !== requesterTenantId) {
        await auditLogger.logEvent({
          userId: req.user?.id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          tenantId: requesterTenantId,
          actionType: 'security_event',
          resourceType: 'tenant',
          resourceId: targetTenantId,
          description: `Cross-tenant access attempt blocked (requested ${targetTenantId})`,
          success: false
        });
        return res.status(403).json({ error: 'Cross-tenant access denied' });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Tenant isolation check failed' });
    }
  };
}

// Utility to enforce tenant filter in ad-hoc queries
// Returns { whereClause, params } to append to existing query
export function buildTenantFilter(tenantId, options = { column: 'dealer_id', tableAlias: '' }) {
  const columnRef = options.tableAlias ? `${options.tableAlias}.${options.column}` : options.column;
  if (!tenantId) {
    return { whereClause: '', params: [] };
  }
  return { whereClause: ` AND ${columnRef} = $TENANT_PARAM$`, params: [tenantId] };
}


