// User Profile API Tests for Colony

import { describe, it, expect, vi } from 'vitest';
import { PATCH, GET } from '../app/api/users/me/route';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null, // Use fallback mode
  isSupabaseConfigured: () => Promise.resolve(false),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, resetIn: 60000 }),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: (request: Request) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer mock-token-')) {
      return { 
        valid: true, 
        payload: { 
          userId: authHeader.replace('Bearer mock-token-', ''), 
          name: 'Test User',
          email: 'test@test.com'
        } 
      };
    }
    return { valid: false, error: 'Unauthorized' };
  },
}));

describe('User Profile API', () => {
  describe('GET /api/users/me', () => {
    it('should return 401 without auth', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'GET',
      });
      
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return user profile with auth', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
      expect(data.user.name).toBe('Test User');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should return 401 without auth', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(401);
    });

    it('should update user name', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.message).toBe('Profile updated successfully');
      expect(data.user.name).toBe('Updated Name');
    });

    it('should update user avatar', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ avatar: 'https://example.com/avatar.png' }),
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.user.avatar).toBe('https://example.com/avatar.png');
    });

    it('should reject invalid name', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ name: '' }),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(400);
    });

    it('should reject empty update', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({}),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(400);
    });

    it('should reject invalid avatar URL', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ avatar: 'not-a-valid-url' }),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('valid URL');
    });

    it('should accept valid avatar URL with https', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Test' }),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });

    it('should accept data URI for avatar', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ avatar: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(200);
    });

    it('should reject email changes', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ email: 'newemail@test.com' }),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Email cannot be changed');
    });

    it('should reject password changes', async () => {
      const request = new Request('http://localhost/api/users/me', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer mock-token-test-user-001' },
        body: JSON.stringify({ password: 'newpassword123' }),
      });
      
      const response = await PATCH(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Password cannot be changed');
    });
  });
});
