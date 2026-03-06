// Auth API Tests for Colony

import { describe, it, expect, vi } from 'vitest';
import { POST as REGISTER_POST } from '../app/api/auth/register/route';
import { POST as LOGIN_POST } from '../app/api/auth/login/route';
import { GET as ME_GET } from '../app/api/auth/me/route';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null, // Use fallback mode
  isSupabaseConfigured: () => Promise.resolve(false),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, resetIn: 60000 }),
}));

vi.mock('@/lib/jwt-auth', () => ({
  generateToken: (payload: any) => `mock-token-${payload.userId}`,
  validateToken: (token: string) => {
    if (token.startsWith('mock-token-')) {
      return { valid: true, payload: { userId: token.replace('mock-token-', ''), name: 'Test User' } };
    }
    return { valid: false, error: 'Invalid token' };
  },
  withAuth: (request: Request) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer mock-token-')) {
      return { valid: true, payload: { userId: authHeader.replace('Bearer mock-token-', ''), name: 'Test User' } };
    }
    return { valid: false, error: 'Unauthorized' };
  },
  extractTokenFromHeader: (authHeader?: string) => {
    if (!authHeader) {return null;}
    const parts = authHeader.split(' ');
    return parts.length === 2 && parts[0] === 'Bearer' ? parts[1] : null;
  },
}));

vi.mock('@/lib/user-store', () => {
  // Track users for testing
  const users = new Map<string, any>();
  users.set('test@test.com', {
    id: 'test-user-001',
    email: 'test@test.com',
    name: 'Test User',
    password_hash: 'hashed-test123',
    avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Test%20User',
  });
  
  return {
    hashPassword: (password: string) => `hashed-${password}`,
    verifyPassword: (password: string, hash: string) => password === hash.replace('hashed-', ''),
    addFallbackUser: vi.fn((email, name, passwordHash) => {
      const user = {
        id: `user-${Date.now()}`,
        email,
        name,
        password_hash: passwordHash,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${name}`,
      };
      users.set(email, user);
      return user;
    }),
    fallbackUserExists: vi.fn((email) => users.has(email)),
    getFallbackUser: vi.fn((email) => users.get(email)),
  };
});

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should reject registration without email', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ password: 'password123', name: 'Test User' }),
      });
      
      const response = await REGISTER_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Email is required');
    });

    it('should reject registration with invalid email', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email', password: 'password123', name: 'Test' }),
      });
      
      const response = await REGISTER_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
    });

    it('should reject registration with short password', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: '123', name: 'Test' }),
      });
      
      const response = await REGISTER_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Password must be at least 6 characters');
    });

    it('should reject registration without name', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      });
      
      const response = await REGISTER_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Name is required');
    });

    it('should successfully register a new user', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          email: 'newuser@example.com', 
          password: 'password123', 
          name: 'New User' 
        }),
      });
      
      const response = await REGISTER_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('newuser@example.com');
      expect(data.user.name).toBe('New User');
      expect(data.token).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          email: 'UPPERCASE@EXAMPLE.COM', 
          password: 'password123', 
          name: 'Test User' 
        }),
      });
      
      const response = await REGISTER_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user.email).toBe('uppercase@example.com');
    });

    it('should allow registered user to login in fallback mode', async () => {
      // First register a new user
      const registerRequest = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ 
          email: 'newuser2@example.com', 
          password: 'password123', 
          name: 'New User 2' 
        }),
      });
      
      const registerResponse = await REGISTER_POST(registerRequest);
      const registerData = await registerResponse.json();
      
      expect(registerResponse.status).toBe(200);
      expect(registerData.user).toBeDefined();
      expect(registerData.token).toBeDefined();
      
      // Now try to login with the same credentials
      const loginRequest = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ 
          email: 'newuser2@example.com', 
          password: 'password123' 
        }),
      });
      
      const loginResponse = await LOGIN_POST(loginRequest);
      const loginData = await loginResponse.json();
      
      expect(loginResponse.status).toBe(200);
      expect(loginData.user).toBeDefined();
      expect(loginData.user.email).toBe('newuser2@example.com');
      expect(loginData.token).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject login without email', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password: 'password123' }),
      });
      
      const response = await LOGIN_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Email is required');
    });

    it('should reject login without password', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });
      
      const response = await LOGIN_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Password is required');
    });

    it('should reject login with invalid credentials', async () => {
      const request = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'nonexistent@example.com', password: 'password123' }),
      });
      
      const response = await LOGIN_POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost/api/auth/me');
      
      const response = await ME_GET(request);
      
      expect(response.status).toBe(401);
    });

    it('should return user info for authenticated requests', async () => {
      const request = new Request('http://localhost/api/auth/me', {
        headers: {
          'Authorization': 'Bearer mock-token-user-123',
        },
      });
      
      const response = await ME_GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe('user-123');
    });
  });
});
