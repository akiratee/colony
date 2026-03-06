import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';

// Mock dependencies
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 60000 }))
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((request) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader === 'Bearer valid-token') {
      return { 
        valid: true, 
        payload: { userId: 'user-123', name: 'Test User' } 
      };
    }
    return { valid: false, error: 'Unauthorized' };
  })
}));

vi.mock('@/lib/supabase', () => ({
  supabase: null
}));

vi.mock('@/lib/channelStore', () => ({
  findDirectMessage: vi.fn(),
  createDirectMessage: vi.fn(),
  getDirectMessages: vi.fn()
}));

import { findDirectMessage, createDirectMessage, getDirectMessages } from '@/lib/channelStore';

describe('Direct Messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/direct-messages', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'GET'
      });
      
      const response = await GET(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Authentication required');
    });

    it('should return DMs from fallback store', async () => {
      const mockDMs = [
        { id: 'dm-1', name: 'dm-user-123-user-456', description: 'Direct message', participantIds: ['user-123', 'user-456'], createdAt: new Date('2026-01-01') }
      ];
      vi.mocked(getDirectMessages).mockReturnValue(mockDMs);
      
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /api/direct-messages', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(401);
    });

    it('should require target user ID', async () => {
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({})
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Target user ID is required');
    });

    it('should reject creating DM with yourself', async () => {
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-123' }) // Same as in mock auth
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('Cannot create DM with yourself');
    });

    it('should return existing DM if already exists', async () => {
      const existingDM = {
        id: 'dm-existing',
        name: 'dm-123-456',
        description: 'Direct message',
        isDirectMessage: true,
        participantIds: ['user-123', 'user-456'],
        createdAt: new Date('2026-01-01')
      };
      vi.mocked(findDirectMessage).mockReturnValue(existingDM);
      
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-456' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBe('dm-existing');
    });

    it('should create new DM if does not exist', async () => {
      vi.mocked(findDirectMessage).mockReturnValue(undefined);
      vi.mocked(createDirectMessage).mockReturnValue({
        id: 'dm-new',
        name: 'dm-123-456',
        description: 'Direct message',
        isDirectMessage: true,
        participantIds: ['user-123', 'user-456'],
        createdAt: new Date('2026-01-01')
      });
      
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-456' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.id).toBe('dm-new');
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/direct-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: 'not-valid-json'
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });
  });
});
