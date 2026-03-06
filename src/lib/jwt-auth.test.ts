// JWT Authentication Tests
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { validateToken, generateToken, extractTokenFromHeader, withAuth, isProductionAuthRequired, validateSocketToken } from './jwt-auth';

describe('JWT Authentication', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRequireAuth = process.env.REQUIRE_AUTH;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = 'development';
    delete process.env.REQUIRE_AUTH;
    delete process.env.JWT_SECRET;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = originalNodeEnv;
    if (originalRequireAuth) {
      process.env.REQUIRE_AUTH = originalRequireAuth;
    }
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken({ userId: 'user-123', name: 'Vincent', avatar: '👨‍💻' });
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
    });

    it('should use JWT_EXPIRES_IN from environment', () => {
      process.env.JWT_EXPIRES_IN = '7d';
      const token = generateToken({ userId: 'user-123', name: 'Vincent' });
      delete process.env.JWT_EXPIRES_IN;
      
      // Decode payload to check expiration
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      // 7 days from now should be approximately correct
      const expDiff = payload.exp - payload.iat;
      // 7 days = 7 * 24 * 60 * 60 = 604800 seconds
      expect(expDiff).toBe(604800);
    });
  });

  describe('validateToken', () => {
    it('should reject empty token', () => {
      const result = validateToken('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No token provided');
    });

    it('should reject invalid token', () => {
      const result = validateToken('invalid-token');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid token');
    });

    it('should validate a correctly signed token', () => {
      const token = generateToken({ userId: 'user-123', name: 'Vincent' });
      const result = validateToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe('user-123');
      expect(result.payload?.name).toBe('Vincent');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const token = extractTokenFromHeader('Bearer abc123');
      expect(token).toBe('abc123');
    });

    it('should return null for invalid format', () => {
      expect(extractTokenFromHeader('Basic abc123')).toBeNull();
      expect(extractTokenFromHeader('Bearer')).toBeNull();
      expect(extractTokenFromHeader('')).toBeNull();
      expect(extractTokenFromHeader(undefined)).toBeNull();
    });
  });

  describe('isProductionAuthRequired', () => {
    it('should return false in development', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'development';
      expect(isProductionAuthRequired()).toBe(false);
    });

    it('should return true in production', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'production';
      expect(isProductionAuthRequired()).toBe(true);
    });

    it('should return true when REQUIRE_AUTH is set', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'development';
      process.env.REQUIRE_AUTH = 'true';
      expect(isProductionAuthRequired()).toBe(true);
    });
  });

  describe('withAuth', () => {
    it('should allow dev user in development mode', () => {
      const request = new Request('http://localhost/api/test');
      const result = withAuth(request);
      expect(result.valid).toBe(true);
      expect(result.payload?.name).toBe('Developer');
    });

    it('should require token in production', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'production';
      const request = new Request('http://localhost/api/test');
      const result = withAuth(request);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Authorization header required');
    });

    it('should validate token in production', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'production';
      const token = generateToken({ userId: 'user-123', name: 'Vincent' });
      const request = new Request('http://localhost/api/test', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = withAuth(request);
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe('user-123');
    });
  });

  describe('validateSocketToken', () => {
    it('should accept user data in development', () => {
      const result = validateSocketToken(undefined, { id: 'user-1', name: 'Vincent' });
      expect(result.valid).toBe(true);
      expect(result.payload?.name).toBe('Vincent');
    });

    it('should require token in production', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'production';
      const result = validateSocketToken(undefined, { id: 'user-1', name: 'Vincent' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token required');
    });

    it('should validate JWT token in production', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = 'production';
      const token = generateToken({ userId: 'user-123', name: 'Vincent' });
      const result = validateSocketToken(token);
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe('user-123');
    });
  });
});
