/**
 * Rate Limiting Middleware
 * Per-tenant rate limiting to prevent abuse
 */

const rateLimit = require('express-rate-limit');
const { query } = require('../db/pool');

/**
 * Tenant-based rate limiter
 * Limits each tenant to a specified number of requests per window
 */
const tenantLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window default
  keyGenerator: (req) => {
    // Use tenant ID as the key for rate limiting
    return req.tenantId ? `tenant:${req.tenantId}` : `ip:${req.ip}`;
  },
  message: {
    success: false,
    message: 'Too many requests from your facility. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // Skip rate limiting for health checks
    if (
      req.path === '/api/health' ||
      req.path === '/health' ||
      req.baseUrl === '/api/dashboard' ||
      req.originalUrl.startsWith('/api/dashboard')
    ) {
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    // Log rate limit exceeded
    const { logTenantAccess } = require('../utils/audit-log');
    logTenantAccess({
      tenant_id: req.tenantId,
      user_id: req.user?.userId,
      action: 'rate_limit_exceeded',
      success: false,
      reason: 'Too many requests',
      ip_address: req.ip,
    });

    res.status(429).json({
      success: false,
      message: 'Too many requests from your facility. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Strict rate limiter for sensitive operations
 * Lower limits for authentication and admin endpoints
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window
  keyGenerator: (req) => {
    return req.tenantId ? `tenant:${req.tenantId}` : `ip:${req.ip}`;
  },
  message: {
    success: false,
    message: 'Too many attempts. Please try again later.',
    code: 'STRICT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Login-specific rate limiter
 * Prevents brute force attacks
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 login attempts per hour
  keyGenerator: (req) => {
    // Use IP address for login attempts (before tenant is known)
    return `login:${req.ip}`;
  },
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 1 hour.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed login attempts
  handler: (req, res) => {
    // Log failed login attempts
    const { logTenantAccess } = require('../utils/audit-log');
    logTenantAccess({
      tenant_id: req.body.tenantId || 1,
      user_id: null,
      action: 'login_rate_limit_exceeded',
      success: false,
      reason: 'Too many login attempts',
      ip_address: req.ip,
    });

    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again in 1 hour.',
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      retryAfter: 3600, // 1 hour
    });
  },
});

/**
 * Export limiter for large data exports
 * Prevents abuse of export functionality
 */
const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 exports per hour
  keyGenerator: (req) => {
    return req.tenantId ? `tenant:${req.tenantId}:export` : `ip:${req.ip}:export`;
  },
  message: {
    success: false,
    message: 'Too many export requests. Please try again later.',
    code: 'EXPORT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Check tenant usage against quota
 * Middleware to enforce tenant quotas
 */
async function checkTenantQuota(req, res, next) {
  if (!req.tenantId) {
    return next();
  }

  try {
    const tenant = await query(
      'SELECT status, subscription_plan, max_users, max_products FROM tenants WHERE id = ? LIMIT 1',
      [req.tenantId]
    );

    if (!tenant || tenant.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found',
      });
    }

    const { status, subscription_plan, max_users, max_products } = tenant[0];

    // Check tenant status
    if (status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your facility account is suspended. Please contact support.',
        code: 'TENANT_SUSPENDED',
      });
    }

    if (status === 'cancelled') {
      return res.status(403).json({
        success: false,
        message: 'Your facility account has been cancelled.',
        code: 'TENANT_CANCELLED',
      });
    }

    // Attach quota info to request for use in routes
    req.tenantQuota = {
      subscription_plan,
      max_users,
      max_products,
    };

    next();
  } catch (error) {
    console.error('Error checking tenant quota:', error);
    next(error);
  }
}

module.exports = {
  tenantLimiter,
  strictLimiter,
  loginLimiter,
  exportLimiter,
  checkTenantQuota,
};
