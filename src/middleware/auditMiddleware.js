import auditLogger from '../lib/auditLogger.js';

/**
 * Middleware to automatically log API requests for audit purposes
 */
export function auditMiddleware(req, res, next) {
  // Skip audit logging for certain paths
  const skipPaths = [
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/health',
    '/api/super-admin/audit' // Avoid recursive logging
  ];

  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Store original response methods
  const originalSend = res.send;
  const originalJson = res.json;

  let responseBody = null;
  let responseStatus = null;

  // Override response methods to capture response data
  res.send = function(body) {
    responseBody = body;
    responseStatus = res.statusCode;
    return originalSend.call(this, body);
  };

  res.json = function(body) {
    responseBody = body;
    responseStatus = res.statusCode;
    return originalJson.call(this, body);
  };

  // Log the request when response is sent
  res.on('finish', async () => {
    try {
      // Only log if this is a Super Admin route or important action
      if (req.path.startsWith('/api/super-admin') || 
          req.path.startsWith('/api/admin') ||
          req.method !== 'GET') {
        
        const actionType = mapRouteToActionType(req.path, req.method);
        const resourceType = mapRouteToResourceType(req.path);
        
        if (actionType) {
          await auditLogger.logEvent({
            userId: req.user?.id,
            userEmail: req.user?.email,
            userRole: req.user?.role,
            tenantId: req.user?.dealerId,
            actionType,
            resourceType,
            resourceId: extractResourceId(req),
            resourceName: extractResourceName(req, responseBody),
            description: generateDescription(req, responseStatus),
            oldValues: extractOldValues(req),
            newValues: extractNewValues(req, responseBody),
            metadata: {
              method: req.method,
              path: req.path,
              query: req.query,
              userAgent: req.get('User-Agent'),
              responseStatus
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            sessionId: req.sessionID,
            success: responseStatus < 400,
            errorMessage: responseStatus >= 400 ? responseBody?.error || responseBody?.message : null
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to log API request:', error);
    }
  });

  next();
}

/**
 * Map API route and method to action type
 */
function mapRouteToActionType(path, method) {
  const routeMap = {
    // User management
    'POST /api/super-admin/users': 'user_create',
    'PUT /api/super-admin/users': 'user_update',
    'DELETE /api/super-admin/users': 'user_delete',
    'POST /api/super-admin/users/.*/role': 'user_role_change',
    
    // Dealer management
    'POST /api/super-admin/dealers': 'dealer_create',
    'PUT /api/super-admin/dealers': 'dealer_update',
    'DELETE /api/super-admin/dealers': 'dealer_delete',
    'POST /api/super-admin/dealers/.*/suspend': 'dealer_suspend',
    
    // Lead management
    'POST /api/super-admin/leads': 'lead_create',
    'PUT /api/super-admin/leads': 'lead_update',
    'DELETE /api/super-admin/leads': 'lead_delete',
    'POST /api/super-admin/leads/.*/assign': 'lead_assign',
    'POST /api/super-admin/leads/import': 'lead_import',
    'GET /api/super-admin/leads/export': 'lead_export',
    'POST /api/super-admin/leads/bulk': 'bulk_operation',
    
    // Subscription management
    'POST /api/super-admin/stripe/customer': 'subscription_create',
    'POST /api/super-admin/stripe/subscription': 'subscription_create',
    'PUT /api/super-admin/stripe/subscription': 'subscription_update',
    'DELETE /api/super-admin/stripe/subscription': 'subscription_cancel',
    
    // Settings management
    'POST /api/super-admin/settings': 'settings_update',
    'PUT /api/super-admin/settings': 'settings_update',
    'POST /api/super-admin/.*/test': 'integration_test',
    'POST /api/super-admin/.*/configure': 'integration_configure',
    
    // Marketing journeys
    'POST /api/super-admin/marketing/journeys': 'journey_create',
    'PUT /api/super-admin/marketing/journeys': 'journey_update',
    'DELETE /api/super-admin/marketing/journeys': 'journey_delete',
    'POST /api/super-admin/marketing/journeys/.*/enroll': 'journey_enroll',
    
    // Authentication
    'POST /api/auth/login': 'login',
    'POST /api/auth/logout': 'logout',
    'POST /api/auth/password': 'password_change',
    
    // Profile updates
    'PUT /api/auth/profile': 'profile_update'
  };

  const key = `${method} ${path}`;
  
  // Try exact match first
  if (routeMap[key]) {
    return routeMap[key];
  }
  
  // Try pattern matching
  for (const [pattern, actionType] of Object.entries(routeMap)) {
    if (pattern.includes('.*')) {
      const regex = new RegExp(pattern.replace(/\.\*/g, '.*'));
      if (regex.test(key)) {
        return actionType;
      }
    }
  }
  
  return null;
}

/**
 * Map API route to resource type
 */
function mapRouteToResourceType(path) {
  if (path.includes('/users')) return 'user';
  if (path.includes('/dealers')) return 'dealer';
  if (path.includes('/leads')) return 'lead';
  if (path.includes('/stripe')) return 'subscription';
  if (path.includes('/settings')) return 'settings';
  if (path.includes('/marketing')) return 'journey';
  if (path.includes('/auth')) return 'user';
  return null;
}

/**
 * Extract resource ID from request
 */
function extractResourceId(req) {
  // Try to get ID from URL params
  const pathSegments = req.path.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // Check if last segment looks like a UUID
  if (lastSegment && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lastSegment)) {
    return lastSegment;
  }
  
  // Try to get from request body
  if (req.body && req.body.id) {
    return req.body.id;
  }
  
  return null;
}

/**
 * Extract resource name from request and response
 */
function extractResourceName(req, responseBody) {
  // Try to get name from response
  if (responseBody && responseBody.name) {
    return responseBody.name;
  }
  
  // Try to get name from request body
  if (req.body && req.body.name) {
    return req.body.name;
  }
  
  // Try to get email for user resources
  if (req.body && req.body.email) {
    return req.body.email;
  }
  
  return null;
}

/**
 * Generate description for the audit log
 */
function generateDescription(req, responseStatus) {
  const method = req.method;
  const path = req.path;
  const resourceType = mapRouteToResourceType(path);
  
  let action = '';
  switch (method) {
    case 'POST':
      action = 'Created';
      break;
    case 'PUT':
    case 'PATCH':
      action = 'Updated';
      break;
    case 'DELETE':
      action = 'Deleted';
      break;
    case 'GET':
      action = 'Accessed';
      break;
    default:
      action = 'Performed action on';
  }
  
  const resource = resourceType ? `${resourceType} resource` : 'resource';
  const status = responseStatus >= 400 ? ' (failed)' : '';
  
  return `${action} ${resource} via ${path}${status}`;
}

/**
 * Extract old values for update operations
 */
function extractOldValues(req) {
  // For update operations, we might want to store the previous state
  // This would require additional logic to fetch the previous state
  // For now, return null as we don't have easy access to previous state
  return null;
}

/**
 * Extract new values from request and response
 */
function extractNewValues(req, responseBody) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    // Return sanitized request body (remove sensitive fields)
    const sanitizedBody = { ...req.body };
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.secret;
    return sanitizedBody;
  }
  
  return null;
}

/**
 * Middleware specifically for Super Admin routes
 */
export function superAdminAuditMiddleware(req, res, next) {
  // Add additional context for Super Admin actions
  req.auditContext = {
    isSuperAdminAction: true,
    actionScope: 'global'
  };
  
  return auditMiddleware(req, res, next);
}

/**
 * Middleware for logging specific actions
 */
export function logSpecificAction(actionType, resourceType, getDescription) {
  return async (req, res, next) => {
    try {
      const originalSend = res.send;
      let responseBody = null;
      
      res.send = function(body) {
        responseBody = body;
        return originalSend.call(this, body);
      };
      
      res.on('finish', async () => {
        try {
          const description = typeof getDescription === 'function' 
            ? getDescription(req, responseBody)
            : getDescription;
            
          await auditLogger.logEvent({
            userId: req.user?.id,
            userEmail: req.user?.email,
            userRole: req.user?.role,
            tenantId: req.user?.dealerId,
            actionType,
            resourceType,
            resourceId: extractResourceId(req),
            resourceName: extractResourceName(req, responseBody),
            description,
            newValues: extractNewValues(req, responseBody),
            metadata: {
              method: req.method,
              path: req.path,
              customAction: true
            },
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            sessionId: req.sessionID,
            success: res.statusCode < 400,
            errorMessage: res.statusCode >= 400 ? responseBody?.error || responseBody?.message : null
          });
        } catch (error) {
          console.error('❌ Failed to log specific action:', error);
        }
      });
      
      next();
    } catch (error) {
      console.error('❌ Failed to setup specific action logging:', error);
      next();
    }
  };
}
