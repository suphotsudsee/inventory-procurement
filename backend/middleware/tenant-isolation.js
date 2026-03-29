/**
 * Tenant Isolation Middleware
 * Ensures users can only access data from their own tenant
 */

const { query } = require('../db/pool');
const { logTenantAccess } = require('../utils/audit-log');

/**
 * Extract tenant_id from request and validate user access
 * Must be used after isAuthenticated middleware
 */
function requireTenant(req, res, next) {
  const user = req.user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const userTenantId = user.tenantId;
  const userRole = user.role;

  // Admin/superuser can access all tenants (for executive view)
  if (userRole === 'admin' || userRole === 'superadmin') {
    // Check if requesting specific tenant context
    const requestedTenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;
    
    if (requestedTenantId) {
      // Validate tenant exists
      validateTenantExists(requestedTenantId)
        .then(exists => {
          if (!exists) {
            logTenantAccess({
              tenant_id: userTenantId,
              user_id: user.userId,
              action: 'tenant_access',
              accessed_tenant_id: requestedTenantId,
              success: false,
              reason: 'Tenant not found',
              ip_address: req.ip,
              user_agent: req.get('user-agent'),
            });
            return res.status(404).json({
              success: false,
              message: 'Tenant not found',
            });
          }

          // Log successful cross-tenant access
          logTenantAccess({
            tenant_id: userTenantId,
            user_id: user.userId,
            action: 'tenant_access',
            accessed_tenant_id: requestedTenantId,
            success: true,
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
          });

          req.tenantId = requestedTenantId;
          req.isCrossTenantAccess = true;
          next();
        })
        .catch(err => {
          console.error('Error validating tenant:', err);
          next(err);
        });
      return;
    }

    // Admin without specific tenant - use their default tenant
    req.tenantId = userTenantId;
    req.isCrossTenantAccess = false;
    return next();
  }

  // Regular users: enforce strict tenant isolation
  const requestedTenantId = req.params.tenantId || req.query.tenantId || req.body.tenantId;

  if (requestedTenantId && String(requestedTenantId) !== String(userTenantId)) {
    // Log unauthorized access attempt
    logTenantAccess({
      tenant_id: userTenantId,
      user_id: user.userId,
      action: 'tenant_access_violation',
      accessed_tenant_id: requestedTenantId,
      success: false,
      reason: 'User attempted to access different tenant',
      ip_address: req.ip,
      user_agent: req.get('user-agent'),
    });

    return res.status(403).json({
      success: false,
      message: 'Access denied to this tenant',
    });
  }

  // Inject tenant_id into request context
  req.tenantId = userTenantId;
  req.isCrossTenantAccess = false;

  next();
}

/**
 * Validate that a tenant exists and is active
 */
async function validateTenantExists(tenantId) {
  try {
    const rows = await query(
      'SELECT id, status FROM tenants WHERE id = ? LIMIT 1',
      [tenantId]
    );
    
    if (!rows || rows.length === 0) {
      return false;
    }

    const tenant = rows[0];
    // Allow access to active and trial tenants
    return tenant.status === 'active' || tenant.status === 'trial';
  } catch (error) {
    console.error('Error validating tenant:', error);
    throw error;
  }
}

/**
 * Check if tenant is active (not suspended/cancelled)
 */
async function requireActiveTenant(req, res, next) {
  if (!req.tenantId) {
    return res.status(400).json({
      success: false,
      message: 'Tenant context not established',
    });
  }

  try {
    const rows = await query(
      'SELECT status, subscription_plan FROM tenants WHERE id = ? LIMIT 1',
      [req.tenantId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    const tenant = rows[0];

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Tenant account is suspended. Please contact support.',
        code: 'TENANT_SUSPENDED',
      });
    }

    if (tenant.status === 'cancelled') {
      return res.status(403).json({
        success: false,
        message: 'Tenant account has been cancelled',
        code: 'TENANT_CANCELLED',
      });
    }

    // Check if trial has expired
    if (tenant.status === 'trial') {
      const rows = await query('SELECT trial_ends_at FROM tenants WHERE id = ?', [req.tenantId]);
      const trialEndsAt = new Date(rows[0].trial_ends_at);
      
      if (trialEndsAt < new Date()) {
        return res.status(403).json({
          success: false,
          message: 'Trial period has expired. Please upgrade to continue.',
          code: 'TRIAL_EXPIRED',
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error checking tenant status:', error);
    next(error);
  }
}

/**
 * Enforce tenant quotas (max products, users, etc.)
 */
function enforceQuota(resourceType) {
  return async (req, res, next) => {
    if (!req.tenantId) {
      return next(); // Skip if no tenant context
    }

    try {
      const rows = await query(
        `SELECT max_products, max_users, subscription_plan 
         FROM tenants 
         WHERE id = ? 
         LIMIT 1`,
        [req.tenantId]
      );

      if (!rows || rows.length === 0) {
        return next();
      }

      const tenant = rows[0];
      let currentCount = 0;
      let maxCount = 0;
      let quotaType = '';

      if (resourceType === 'products') {
        const countRows = await query(
          'SELECT COUNT(*) as count FROM products WHERE tenant_id = ? AND is_active = TRUE',
          [req.tenantId]
        );
        currentCount = countRows[0].count;
        maxCount = tenant.max_products || 5000;
        quotaType = 'products';
      } else if (resourceType === 'users') {
        const countRows = await query(
          'SELECT COUNT(*) as count FROM users WHERE tenant_id = ? AND is_active = TRUE',
          [req.tenantId]
        );
        currentCount = countRows[0].count;
        maxCount = tenant.max_users || 10;
        quotaType = 'users';
      }

      // Check if adding one more would exceed quota
      if (currentCount >= maxCount) {
        return res.status(403).json({
          success: false,
          message: `Quota exceeded: maximum ${maxCount} ${quotaType} for ${tenant.subscription_plan} plan`,
          code: 'QUOTA_EXCEEDED',
          current: currentCount,
          maximum: maxCount,
        });
      }

      next();
    } catch (error) {
      console.error('Error checking quota:', error);
      next(error);
    }
  };
}

/**
 * Helper: Scope a query to tenant_id
 * Returns { query, params } with tenant filter added
 */
function scopeToTenant(sql, params, tenantId) {
  if (!tenantId) {
    return { query: sql, params };
  }

  const upperSql = sql.toUpperCase();
  const hasWhere = upperSql.includes('WHERE');

  if (hasWhere) {
    // Insert tenant_id condition after WHERE
    const modifiedSql = sql.replace(
      /WHERE/i,
      'WHERE tenant_id = ? AND '
    );
    return {
      query: modifiedSql,
      params: [tenantId, ...params],
    };
  } else {
    // Add WHERE clause
    return {
      query: sql + ' WHERE tenant_id = ?',
      params: [...params, tenantId],
    };
  }
}

module.exports = {
  requireTenant,
  requireActiveTenant,
  enforceQuota,
  scopeToTenant,
  validateTenantExists,
};
