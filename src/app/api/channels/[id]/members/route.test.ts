// Channel Members API Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 60000 })),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, payload: { userId: 'test-user-001', email: 'test@test.com' } })),
}));

vi.mock('@/lib/channelStore', () => ({
  getChannel: vi.fn((id: string) => {
    if (id === 'dm-1') {
      return {
        id: 'dm-1',
        name: 'dm-1',
        isDirectMessage: true,
        participantIds: ['test-user-001', 'user-002'],
      };
    }
    if (id === 'private-1') {
      return {
        id: 'private-1',
        name: 'private',
        isPrivate: true,
        allowedUsers: ['test-user-001', 'user-002'],
      };
    }
    if (id === 'public-1') {
      return {
        id: 'public-1',
        name: 'general',
        isPrivate: false,
      };
    }
    return null;
  }),
  canAccessChannel: vi.fn(() => true),
}));

vi.mock('@/lib/user-store', () => ({
  fallbackUsers: new Map([
    ['test@test.com', {
      id: 'test-user-001',
      email: 'test@test.com',
      name: 'Test User',
      password_hash: 'hash',
      avatar: 'https://example.com/avatar.png',
    }],
    ['user2@test.com', {
      id: 'user-002',
      email: 'user2@test.com',
      name: 'User Two',
      password_hash: 'hash2',
      avatar: 'https://example.com/avatar2.png',
    }],
  ]),
}));

describe('Channel Members API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated requests', async () => {
    const { withAuth } = await import('@/lib/jwt-auth');
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });
    
    const request = new NextRequest('http://localhost:3000/api/channels/1/members');
    const response = await GET(request, { params: Promise.resolve({ id: '1' }) });
    
    expect(response.status).toBe(401);
  });

  it('should return 404 for non-existent channel', async () => {
    const { getChannel } = await import('@/lib/channelStore');
    vi.mocked(getChannel).mockReturnValueOnce(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/channels/non-existent/members');
    const response = await GET(request, { params: Promise.resolve({ id: 'non-existent' }) });
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Channel not found');
  });

  it('should return DM participants from fallback store', async () => {
    const request = new NextRequest('http://localhost:3000/api/channels/dm-1/members');
    const response = await GET(request, { params: Promise.resolve({ id: 'dm-1' }) });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe('direct_message');
    expect(data.members).toHaveLength(2);
    expect(data.members[0].name).toBe('Test User');
    expect(data.members[1].name).toBe('User Two');
  });

  it('should return private channel members from fallback store', async () => {
    const request = new NextRequest('http://localhost:3000/api/channels/private-1/members');
    const response = await GET(request, { params: Promise.resolve({ id: 'private-1' }) });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe('private');
    expect(data.members).toHaveLength(2);
  });

  it('should return public channel with empty members', async () => {
    const request = new NextRequest('http://localhost:3000/api/channels/public-1/members');
    const response = await GET(request, { params: Promise.resolve({ id: 'public-1' }) });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.type).toBe('public');
    expect(data.members).toHaveLength(0);
    expect(data.note).toBeDefined();
  });
});
