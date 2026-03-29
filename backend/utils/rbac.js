const ROLE_PERMISSIONS = {
  admin: [
    'dashboard:read',
    'products:read',
    'products:write',
    'stock:read',
    'stock:write',
    'stock:adjust',
    'purchase-orders:read',
    'purchase-orders:write',
    'purchase-orders:approve',
    'reports:read',
    'users:read',
    'users:write',
  ],
  manager: [
    'dashboard:read',
    'products:read',
    'products:write',
    'stock:read',
    'stock:write',
    'stock:adjust',
    'purchase-orders:read',
    'purchase-orders:write',
    'purchase-orders:approve',
    'reports:read',
    'users:read',
  ],
  staff: [
    'dashboard:read',
    'products:read',
    'stock:read',
    'stock:write',
    'purchase-orders:read',
    'reports:read',
  ],
  viewer: [
    'dashboard:read',
    'products:read',
    'stock:read',
    'purchase-orders:read',
    'reports:read',
  ],
};

module.exports = {
  ROLE_PERMISSIONS,
};
