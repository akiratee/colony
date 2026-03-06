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

vi.mock('@/lib/user-presence', () => ({
  setUserStatus: vi.fn(),
  getUserPresence: vi.fn(),
  getAllPresence: vi.fn(),
  getUsersByStatus: vi.fn(),
  markUserOffline: vi.fn(),
  updateLastSeen: vi.fn(),
  getPresenceStats: vi.fn(),
  getOnlineCount: vi.fn()
}));

import { 
  setUserStatus, 
  getUserPresence, 
  getAllPresence, 
  getUsersByStatus,
  markUserOffline,
  updateLastSeen,
  getPresenceStats
} from '@/lib/user-presence';

describe('Users Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/users/status', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'GET'
      });
      
      const response = await GET(request);
      
      expect(response.status).toBe(401);
    });

    it('should return all presences with stats', async () => {
      vi.mocked(getAllPresence).mockReturnValue([
        { userId: 'user-1', userName: 'Alice', status: 'online', platform: 'web', lastSeen: new Date() }
      ]);
      vi.mocked(getPresenceStats).mockReturnValue({ online: 1, away: 0, offline: 0 });
      
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('online');
      expect(data).toHaveProperty('users');
    });

    it('should filter by userId', async () => {
      vi.mocked(getUserPresence).mockReturnValue({
        userId: 'user-1',
        userName: 'Alice',
        status: 'online',
        platform: 'web',
        lastSeen: new Date()
      });
      
      const request = new Request('http://localhost:3000/api/users/status?userId=user-1', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.userId).toBe('user-1');
    });

    it('should return 404 for non-existent user', async () => {
      vi.mocked(getUserPresence).mockReturnValue(undefined);
      
      const request = new Request('http://localhost:3000/api/users/status?userId=nonexistent', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await GET(request);
      
      expect(response.status).toBe(404);
    });

    it('should filter by status', async () => {
      vi.mocked(getUsersByStatus).mockReturnValue([
        { userId: 'user-1', userName: 'Alice', status: 'online', platform: 'web', lastSeen: new Date() }
      ]);
      
      const request = new Request('http://localhost:3000/api/users/status?status=online', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('online');
      expect(data.count).toBe(1);
    });
  });

  describe('POST /api/users/status', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(401);
    });

    it('should require userId', async () => {
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userName: 'Alice', status: 'online' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('userId is required');
    });

    it('should require userName', async () => {
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-1', status: 'online' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('userName is required');
    });

    it('should require valid status', async () => {
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-1', userName: 'Alice', status: 'invalid' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('status must be');
    });

    it('should set user status', async () => {
      vi.mocked(setUserStatus).mockReturnValue({
        userId: 'user-1',
        userName: 'Alice',
        status: 'online',
        platform: 'web',
        lastSeen: new Date()
      });
      
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-1', userName: 'Alice', status: 'online' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('online');
    });

    it('should handle heartbeat action', async () => {
      vi.mocked(updateLastSeen).mockReturnValue({
        userId: 'user-1',
        userName: 'Alice',
        status: 'online',
        platform: 'web',
        lastSeen: new Date()
      });
      
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-1', action: 'heartbeat' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
    });

    it('should handle offline action', async () => {
      vi.mocked(markUserOffline).mockReturnValue({
        userId: 'user-1',
        userName: 'Alice',
        status: 'offline',
        platform: 'web',
        lastSeen: new Date()
      });
      
      const request = new Request('http://localhost:3000/api/users/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ userId: 'user-1', action: 'offline' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/users/status', {
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
