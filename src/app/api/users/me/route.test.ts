// Tests for /api/users/me endpoint
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({ data: null, error: null }))
          }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null }))
        }))
      }))
    }))
  },
  isSupabaseConfigured: vi.fn(() => Promise.resolve(false))
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((request: Request) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader === 'Bearer valid-token') {
      return { valid: true, payload: { userId: 'user-123', email: 'test@example.com' } };
    }
    return { valid: false, error: 'Unauthorized' };
  })
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 30, resetIn: 60000 }))
}));

vi.mock('@/lib/user-store', () => ({
  fallbackUsers: new Map([['test@example.com', { id: 'user-123', email: 'test@example.com', name: 'Test User', avatar: null, bio: 'Test bio', password: 'hash' }]]),
  getFallbackUser: vi.fn((email: string) => {
    if (email === 'test@example.com') {
      return { id: 'user-123', email: 'test@example.com', name: 'Test User', avatar: null, bio: 'Test bio' };
    }
    return null;
  })
}));

describe('GET /api/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without authorization', async () => {
    const { GET } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return user profile with valid auth (fallback)', async () => {
    const { GET } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      headers: { 'Authorization': 'Bearer valid-token' }
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('test@example.com');
  });

  it('should return 404 for non-existent user', async () => {
    const { GET } = await import('./route');
    // Override the mock for this test
    const { getFallbackUser } = await import('@/lib/user-store');
    vi.mocked(getFallbackUser).mockReturnValueOnce(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      headers: { 'Authorization': 'Bearer valid-token' }
    });
    const response = await GET(request);
    expect(response.status).toBe(404);
  });
});

describe('PATCH /api/users/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without authorization', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'New Name' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 for empty update', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({})
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('No valid fields');
  });

  it('should return 400 for invalid name type', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 123 })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Name must be a string');
  });

  it('should return 400 for empty name', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: '   ' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('empty');
  });

  it('should return 400 for name too long', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 'a'.repeat(101) })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('too long');
  });

  it('should return 400 for invalid avatar URL', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ avatar: 'not-a-valid-url' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('valid URL');
  });

  it('should return 400 when trying to change email', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ email: 'new@example.com' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Email cannot be changed');
  });

  it('should return 400 when trying to change password', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ password: 'newpassword' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Password cannot be changed');
  });

  it('should update user profile successfully (fallback)', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 'Updated Name' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toContain('updated');
    expect(data.user.name).toBe('Updated Name');
  });

  it('should accept valid avatar URLs', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ avatar: 'https://example.com/avatar.png' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
  });

  it('should accept data URI for avatar', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ avatar: 'data:image/png;base64,iVBORw0KGgo=' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
  });

  it('should return 429 when rate limited', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 'Test' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(429);
  });

  it('should update user bio', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ bio: 'Hello, I am a Colony user!' })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.bio).toBe('Hello, I am a Colony user!');
  });

  it('should return 400 for bio too long', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ bio: 'a'.repeat(501) })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Bio too long');
  });

  it('should return 400 for invalid bio type', async () => {
    const { PATCH } = await import('./route');
    const request = new NextRequest('http://localhost:3000/api/users/me', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ bio: 123 })
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Bio must be a string');
  });
});
