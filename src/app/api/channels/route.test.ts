// Channel API Tests
// Tests for GET/POST /api/channels

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './route';
import { getChannels, addChannel } from '@/lib/channelStore';

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
    if (token.startsWith('valid-')) {
      return {
        valid: true,
        payload: { userId: 'user-123', email: 'test@example.com', role: 'user' }
      };
    }
    return { valid: false, error: 'Invalid token' };
  }),
  extractTokenFromHeader: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

describe('GET /api/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return channels list for authenticated user', async () => {
    const request = new Request('http://localhost/api/channels', {
      headers: { 'Authorization': 'Bearer valid-token-123' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return channels for unauthenticated user (with limited data)', async () => {
    const request = new Request('http://localhost/api/channels');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });
});

describe('POST /api/channels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new channel with valid data', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ name: 'test-channel', description: 'Test channel' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.name).toBe('test-channel');
    expect(data.description).toBe('Test channel');
  });

  it('should create a private channel', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ 
        name: 'private-channel', 
        isPrivate: true,
        allowedUsers: ['user-123', 'user-456'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.isPrivate).toBe(true);
  });

  it('should reject unauthenticated requests', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'test-channel' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it('should reject missing channel name', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ description: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name is required');
  });

  it('should reject empty channel name', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ name: '   ' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name must be 1-50 characters');
  });

  it('should reject channel name over 50 characters', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ name: 'a'.repeat(51) }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name must be 1-50 characters');
  });

  it('should reject invalid channel name (uppercase)', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ name: 'TestChannel' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name must be lowercase alphanumeric with hyphens');
  });

  it('should reject invalid channel name (special chars)', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ name: 'test_channel' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Channel name must be lowercase alphanumeric with hyphens');
  });

  it('should reject description over 500 characters', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ name: 'test-channel', description: 'a'.repeat(501) }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Description too long (max 500 chars)');
  });

  it('should reject invalid allowedUsers for private channel', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ 
        name: 'private-channel',
        isPrivate: true,
        allowedUsers: 'not-an-array',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('allowedUsers must be an array');
  });

  it('should rate limit requests', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: JSON.stringify({ name: 'test-channel' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
  });

  it('should reject invalid JSON body', async () => {
    const request = new Request('http://localhost/api/channels', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token-123',
      },
      body: 'not-valid-json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON body');
  });
});
