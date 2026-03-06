import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, PATCH, DELETE } from './route';

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

describe('Agent Actions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agent-actions', () => {
    it('should return all actions without filters', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('actions');
      expect(data).toHaveProperty('total');
      expect(data).toHaveProperty('limit');
      expect(data).toHaveProperty('offset');
    });

    it('should filter by channelId', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions?channelId=channel-123', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data.actions)).toBe(true);
    });

    it('should filter by type', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions?type=event', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
    });

    it('should apply pagination', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions?limit=10&offset=0', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.limit).toBe(10);
      expect(data.offset).toBe(0);
    });

    it('should respect max limit of 100', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions?limit=200', {
        method: 'GET'
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.limit).toBe(100); // Capped at 100
    });

    it('should rate limit requests', async () => {
      const { rateLimit } = await import('@/lib/rate-limit');
      vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
      
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'GET'
      });
      
      const response = await GET(request);
      
      expect(response.status).toBe(429);
    });
  });

  describe('POST /api/agent-actions', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(401);
    });

    it('should require actionType', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ title: 'Test', channelId: 'channel-123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('actionType');
    });

    it('should require valid actionType', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ actionType: 'invalid', title: 'Test', channelId: 'channel-123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('actionType');
    });

    it('should require title', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ actionType: 'event', channelId: 'channel-123' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('title');
    });

    it('should require channelId', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ actionType: 'event', title: 'Test Event' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('channelId');
    });

    it('should create event action', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          actionType: 'event',
          title: 'Team Meeting',
          description: 'Weekly sync',
          channelId: 'channel-123',
          startTime: '2026-03-01T10:00:00Z',
          endTime: '2026-03-01T11:00:00Z',
          location: 'Zoom'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.type).toBe('event');
      expect(data.title).toBe('Team Meeting');
      expect(data.startTime).toBe('2026-03-01T10:00:00Z');
    });

    it('should require startTime for events', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          actionType: 'event',
          title: 'Team Meeting',
          channelId: 'channel-123'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('startTime');
    });

    it('should create task action', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          actionType: 'task',
          title: 'Fix bug',
          description: 'Login issue',
          channelId: 'channel-123',
          assignee: 'user-456',
          dueDate: '2026-03-15',
          priority: 'high'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.type).toBe('task');
      expect(data.status).toBe('pending');
      expect(data.priority).toBe('high');
    });

    it('should create poll action', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          actionType: 'poll',
          title: 'Vote',
          question: 'What should we have for lunch?',
          channelId: 'channel-123',
          options: ['Pizza', 'Tacos', 'Sushi'],
          multipleChoice: false
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(201);
      expect(data.type).toBe('poll');
      expect(data.options).toHaveLength(3);
      expect(data.options[0].votes).toBe(0);
    });

    it('should require at least 2 options for polls', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({
          actionType: 'poll',
          title: 'Vote',
          question: 'What?',
          channelId: 'channel-123',
          options: ['Only One']
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('2 options');
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
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

  describe('PATCH /api/agent-actions', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await PATCH(request);
      
      expect(response.status).toBe(401);
    });

    it('should require actionId', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ action: 'vote', data: {} })
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('actionId');
    });

    it('should return 404 for non-existent action', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ actionId: 'non-existent', action: 'vote', data: {} })
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
    });

    it('should handle invalid JSON', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: 'not-valid-json'
      });
      
      const response = await PATCH(request);
      
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/agent-actions', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions?actionId=test-123', {
        method: 'DELETE'
      });
      
      const response = await DELETE(request);
      
      expect(response.status).toBe(401);
    });

    it('should require actionId', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await DELETE(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('actionId');
    });

    it('should return 404 for non-existent action', async () => {
      const request = new Request('http://localhost:3000/api/agent-actions?actionId=non-existent', {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer valid-token' }
      });
      
      const response = await DELETE(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit GET requests', async () => {
      const { rateLimit } = await import('@/lib/rate-limit');
      vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
      
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'GET'
      });
      
      const response = await GET(request);
      
      expect(response.status).toBe(429);
    });

    it('should rate limit POST requests', async () => {
      const { rateLimit } = await import('@/lib/rate-limit');
      vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
      
      const request = new Request('http://localhost:3000/api/agent-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ actionType: 'task', title: 'Test', channelId: 'ch-1' })
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(429);
    });
  });
});
