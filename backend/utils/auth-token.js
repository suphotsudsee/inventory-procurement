const crypto = require('crypto');
const { ROLE_PERMISSIONS } = require('./rbac');

const TOKEN_SECRET = process.env.JWT_SECRET || 'inventory-procurement-secret';

function base64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signToken(payload) {
  const body = {
    ...payload,
    permissions: ROLE_PERMISSIONS[payload.role] || [],
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encodedPayload = base64urlEncode(JSON.stringify(body));
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = crypto.createHmac('sha256', TOKEN_SECRET).update(encodedPayload).digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  const payload = JSON.parse(base64urlDecode(encodedPayload));
  if (!payload.exp || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

module.exports = {
  signToken,
  verifyToken,
};
