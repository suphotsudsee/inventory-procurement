/**
 * Audit Logging Utility
 * Logs all tenant access attempts and sensitive operations
 */

const { query } = require('../db/pool');

/**
 * Log tenant access attempt
 * @param {Object} options - Log options
 * @param {number} options.tenant_id - User's tenant ID
 * @param {number} options.user_id - User ID
 * @param {string} options.action - Action performed
 * @param {string} [options.resource_type] - Type of resource accessed
 * @param {number} [options.resource_id] - ID of resource accessed
 * @param {number} [options.accessed_tenant_id] - Tenant ID accessed (for cross-tenant)
 * @param {boolean} [options.success=true] - Whether access was successful
 * @param {string} [options.reason] - Reason for failure
 * @param {string} [options.ip_address] - Client IP
 * @param {string} [options.user_agent] - User agent string
 */
async function logTenantAccess(options) {
  try {
    const {
      tenant_id,
      user_id,
      action,
      resource_type,
      resource_id,
      accessed_tenant_id,
      success = true,
      reason,
      ip_address,
      user_agent,
    } = options;

    await query(
      `
        INSERT INTO tenant_access_audit (
          tenant_id,
          user_id,
          action,
          resource_type,
          resource_id,
          accessed_tenant_id,
          success,
          reason,
          ip_address,
          user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        tenant_id,
        user_id || null,
        action,
        resource_type || null,
        resource_id || null,
        accessed_tenant_id || tenant_id,
        success,
        reason || null,
        ip_address || null,
        user_agent || null,
      ]
    );
  } catch (error) {
    // Don't fail the request if audit logging fails
    console.error('Failed to log tenant access:', error);
  }
}

/**
 * Log sensitive operation
 * @param {Object} options - Log options
 * @param {number} options.tenant_id - Tenant ID
 * @param {number} options.user_id - User ID
 * @param {string} options.operation - Operation name
 * @param {string} options.details - Operation details (JSON string)
 */
async function logSensitiveOperation(options) {
  try {
    const { tenant_id, user_id, operation, details } = options;

    await query(
      `
        INSERT INTO tenant_access_audit (
          tenant_id,
          user_id,
          action,
          resource_type,
          success,
          ip_address
        ) VALUES (?, ?, ?, ?, TRUE, NULL)
      `,
      [tenant_id, user_id, `SENSITIVE:${operation}`, details]
    );
  } catch (error) {
    console.error('Failed to log sensitive operation:', error);
  }
}

/**
 * Get audit log for a tenant
 * @param {number} tenantId - Tenant ID
 * @param {Object} filters - Query filters
 * @returns {Promise<Array>} Audit log entries
 */
async function getTenantAuditLog(tenantId, filters = {}) {
  const {
    limit = 100,
    offset = 0,
    action,
    user_id,
    success,
    startDate,
    endDate,
  } = filters;

  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (action) {
    where += ' AND action LIKE ?';
    params.push(`%${action}%`);
  }

  if (user_id) {
    where += ' AND user_id = ?';
    params.push(user_id);
  }

  if (success !== undefined) {
    where += ' AND success = ?';
    params.push(success);
  }

  if (startDate) {
    where += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    where += ' AND created_at <= ?';
    params.push(endDate);
  }

  const rows = await query(
    `
      SELECT 
        id,
        tenant_id,
        user_id,
        action,
        resource_type,
        resource_id,
        accessed_tenant_id,
        success,
        reason,
        ip_address,
        created_at
      FROM tenant_access_audit
      ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return rows;
}

/**
 * Get failed access attempts (for security monitoring)
 * @param {number} tenantId - Tenant ID
 * @param {number} hours - Look back hours
 * @returns {Promise<Array>} Failed attempts
 */
async function getFailedAccessAttempts(tenantId, hours = 24) {
  const rows = await query(
    `
      SELECT 
        user_id,
        action,
        accessed_tenant_id,
        reason,
        ip_address,
        created_at
      FROM tenant_access_audit
      WHERE tenant_id = ?
        AND success = FALSE
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [tenantId, hours]
  );

  return rows;
}

module.exports = {
  logTenantAccess,
  logSensitiveOperation,
  getTenantAuditLog,
  getFailedAccessAttempts,
};
