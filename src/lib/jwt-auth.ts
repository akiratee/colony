// JWT Authentication Utilities for Colony
// Provides JWT validation for production auth

import jwt from 'jsonwebtoken';

export interface JWTPayload {
  userId: string;
  name: string;
  email?: string;
  avatar?: string;
  iat?: number;
  exp?: number;
}

export interface AuthResult {
  valid: boolean;
  error?: string;
  payload?: JWTPayload;
}

// Token blocklist for logout invalidation (in production, use Redis)
// Set of tokens that have been invalidated
const tokenBlocklist = new Set<string>();

// Add token to blocklist (call on logout)
export function invalidateToken(token: string): void {
  tokenBlocklist.add(token);
}

// Check if token is blocklisted
export function isTokenBlocked(token: string): boolean {
  return tokenBlocklist.has(token);
}

// Clear old expired tokens from blocklist (call periodically)
// Note: Since JWT tokens expire naturally via jwt.verify(), we don't need to track expiration in blocklist
// This function just warns if blocklist grows too large (memory consideration)
export function cleanupBlocklist(): void {
  // In production with Redis, use TTL. For in-memory, just clear periodically
  // For now, just warn if blocklist is getting large
  if (tokenBlocklist.size > 1000) {
    console.warn('Token blocklist is large (' + tokenBlocklist.size + ' tokens), consider using Redis for production');
    // In development, clear the oldest half if blocklist gets too large
    if (process.env.NODE_ENV !== 'production') {
      const tokensArray = Array.from(tokenBlocklist);
      const toRemove = tokensArray.slice(0, Math.floor(tokensArray.length / 2));
      toRemove.forEach(t => tokenBlocklist.delete(t));
      console.log('Cleared ' + toRemove.length + ' tokens from blocklist in dev mode');
    }
  }
}

// Get JWT secret from environment
function getJWTSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('⚠️ JWT_SECRET not set - using default (DO NOT USE IN PRODUCTION)');
    return 'colony-dev-secret-do-not-use-in-production';
  }
  return secret;
}

// Validate a JWT token
export function validateToken(token: string): AuthResult {
  if (!token) {
    return { valid: false, error: 'No token provided' };
  }

  // Check if token has been invalidated (logged out)
  if (isTokenBlocked(token)) {
    return { valid: false, error: 'Token has been invalidated' };
  }

  try {
    const secret = getJWTSecret();
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    if (!decoded.userId || !decoded.name) {
      return { valid: false, error: 'Invalid token payload' };
    }

    return { valid: true, payload: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'Token expired' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Invalid token' };
    }
    return { valid: false, error: 'Token validation failed' };
  }
}

// Get JWT token expiration from environment (default: 24h)
function getJWTExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN || '24h';
}

// Generate a JWT token (for testing and service-to-service auth)
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const secret = getJWTSecret();
  const expiresIn = getJWTExpiresIn();
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

// Extract token from Authorization header
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {return null;}
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}

// Check if production mode requires auth
export function isProductionAuthRequired(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.REQUIRE_AUTH === 'true';
}

// Auth middleware for API routes
export function withAuth(request: Request): AuthResult {
  // Skip auth in development unless explicitly required
  if (!isProductionAuthRequired()) {
    return { valid: true, payload: { userId: 'dev-user', name: 'Developer' } };
  }

  const authHeader = request.headers.get('Authorization');
  const token = extractTokenFromHeader(authHeader || undefined);
  
  if (!token) {
    return { valid: false, error: 'Authorization header required' };
  }

  return validateToken(token);
}

// Validate token for socket authentication
export function validateSocketToken(token?: string, userData?: { id: string; name: string }): AuthResult {
  // In development, accept user data directly
  if (!isProductionAuthRequired() && userData) {
    return { valid: true, payload: { userId: userData.id, name: userData.name } };
  }

  // In production, require valid JWT
  if (!token) {
    return { valid: false, error: 'Token required' };
  }

  return validateToken(token);
}
