// Channel [ID] API Tests
// Tests for GET/POST/PATCH /api/channels/[id]

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn().mockImplementation((request: Request) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing or invalid authorization header' };
    }
    const token = authHeader.replace('Bearer ', '');
    // Simple mock: accept any token starting with 'valid-'
    if (token.startsWith('valid-')) {
      return {
        valid: true,
        payload: { userId: 'user-123', email: 'test@example.com', role: 'user', name: 'Test User' }
      };
    }
    return { valid: false, error: 'Invalid token' };
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, resetIn: 0 }),
}));

describe('GET /api/channels/[id] - Get Channel by ID', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return 401 when no auth header provided', async () => {
    const { GET } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1');
    const params = Promise.resolve({ id: '1' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 401 for invalid token', async () => {
    const { GET } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      headers: { 'Authorization': 'Bearer invalid-token' }
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 for non-existent channel', async () => {
    const { GET } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/nonexistent', {
      headers: { 'Authorization': 'Bearer valid-token' }
    });
    const params = Promise.resolve({ id: 'nonexistent' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Channel not found');
  });

  it('should return channel for valid request', async () => {
    const { GET } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      headers: { 'Authorization': 'Bearer valid-token' }
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.id).toBe('1');
    expect(data.name).toBeDefined();
  });
});

describe('POST /api/channels/[id] - Invite User to Channel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return 401 when no auth header provided', async () => {
    const { POST } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-456' }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await POST(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when userId is missing', async () => {
    const { POST } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await POST(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('userId is required');
  });

  it('should return 400 for invalid userId type', async () => {
    const { POST } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ userId: 123 }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await POST(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('userId is required');
  });

  it('should return 404 for non-existent channel', async () => {
    const { POST } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/nonexistent', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ userId: 'user-456' }),
    });
    const params = Promise.resolve({ id: 'nonexistent' });
    
    const response = await POST(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Channel not found');
  });

  it('should return 400 for public channel (cannot invite)', async () => {
    const { POST } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ userId: 'user-456' }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await POST(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Can only invite users to private channels');
  });

  it('should return 400 for invalid JSON', async () => {
    const { POST } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/channels/[id] - Update Channel', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should return 401 when no auth header provided', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'new-name' }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 for non-existent channel', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/nonexistent', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 'new-name' }),
    });
    const params = Promise.resolve({ id: 'nonexistent' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Channel not found');
  });

  it('should return 400 when no valid fields provided', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('No valid fields to update');
  });

  it('should return 400 for invalid name type', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 123 }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Name must be a string');
  });

  it('should return 400 for empty channel name', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: '' }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name must be 1-50 characters');
  });

  it('should return 400 for channel name too long', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 'a'.repeat(51) }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name must be 1-50 characters');
  });

  it('should return 400 for invalid channel name format', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ name: 'invalid name!' }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name must be lowercase alphanumeric with hyphens');
  });

  it('should return 400 for description too long', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ description: 'a'.repeat(501) }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Description too long (max 500 chars)');
  });

  it('should return 400 for invalid description type', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ description: 123 }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Description must be a string');
  });

  it('should return 400 for invalid JSON', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    
    expect(response.status).toBe(400);
  });

  it('should update channel successfully', async () => {
    const { PATCH } = await import('@/app/api/channels/[id]/route');
    
    const request = new Request('http://localhost:3000/api/channels/1', {
      method: 'PATCH',
      headers: { 'Authorization': 'Bearer valid-token' },
      body: JSON.stringify({ description: 'Updated description' }),
    });
    const params = Promise.resolve({ id: '1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.description).toBe('Updated description');
  });
});
