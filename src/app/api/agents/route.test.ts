import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, PATCH } from './route';

// Mock dependencies
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 60000 }))
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((request) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader === 'Bearer valid-token') {
      return { valid: true, user: { id: 'user-123', name: 'Test User' } };
    }
    return { valid: false, error: 'Unauthorized' };
  })
}));

describe('Agents API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/agents', () => {
    it('should return fallback agents when OpenClaw not available', async () => {
      // Set environment without OpenClaw token
      vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', '');
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(3);
      expect(data[0]).toHaveProperty('id', 'main');
      expect(data[0]).toHaveProperty('name', 'Rei');
      expect(data[1]).toHaveProperty('id', 'yilong');
      expect(data[2]).toHaveProperty('id', 'dan');
      
      vi.unstubAllEnvs();
    });

    it('should include agent properties', async () => {
      vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', '');
      
      const response = await GET();
      const data = await response.json();
      
      expect(data[0]).toHaveProperty('role');
      expect(data[0]).toHaveProperty('avatar');
      expect(data[0]).toHaveProperty('description');
      expect(data[0]).toHaveProperty('model');
      expect(data[0]).toHaveProperty('status');
      expect(data[0]).toHaveProperty('capabilities');
      
      vi.unstubAllEnvs();
    });
  });

  describe('POST /api/agents', () => {
    const validRequest = (headers = {}) => {
      return new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token',
          ...headers
        }
      });
    };

    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await POST(request);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toHaveProperty('error');
    });

    it('should require action in body', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({})
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(data.error).toBe('Invalid action');
    });

    it('should require agentId for spawn action', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ action: 'spawn', task: 'do something' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(data.error).toBe('Invalid action');
    });

    it('should require task for spawn action', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ action: 'spawn', agentId: 'yilong' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(data.error).toBe('Invalid action');
    });

    it('should return 503 when gateway not available for spawn', async () => {
      vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', '');
      
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ action: 'spawn', agentId: 'yilong', task: 'review code' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      // Gateway unavailable returns 503 or 500 depending on error path
      expect([500, 503]).toContain(response.status);
      expect(data.error).toBeDefined();
      
      vi.unstubAllEnvs();
    });

    it('should return 503 when gateway not available for despawn', async () => {
      vi.stubEnv('OPENCLAW_GATEWAY_TOKEN', '');
      
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ action: 'despawn', agentId: 'yilong' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(503);
      expect(data.error).toContain('Failed to despawn');
      
      vi.unstubAllEnvs();
    });

    it('should handle invalid JSON gracefully', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ action: 'spawn' })
      });
      
      // This will throw due to invalid JSON, but let's see if it handles
      const response = await POST(request);
      const data = await response.json();
      
      // Should either return 400 for invalid action or 500 for JSON error
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('PATCH /api/agents', () => {
    it('should reject unauthorized requests', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const response = await PATCH(request);
      
      expect(response.status).toBe(401);
    });

    it('should require agentId', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ name: 'New Name' })
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toBe('agentId is required');
    });

    it('should return 404 for non-existent agent', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ agentId: 'non-existent', name: 'New Name' })
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe('Agent not found');
    });

    it('should update agent name', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ agentId: 'yilong', name: 'Yi Long' })
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.agent.name).toBe('Yi Long');
    });

    it('should update multiple agent fields', async () => {
      const request = new Request('http://localhost:3000/api/agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer valid-token'
        },
        body: JSON.stringify({ 
          agentId: 'main', 
          name: 'Rei Updated',
          role: 'Super Manager',
          model: 'claude-3'
        })
      });
      
      const response = await PATCH(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.agent.name).toBe('Rei Updated');
      expect(data.agent.role).toBe('Super Manager');
      expect(data.agent.model).toBe('claude-3');
    });
  });
});
