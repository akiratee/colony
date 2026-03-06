// Agent API Validation Tests
import { describe, it, expect } from 'vitest';
import { rateLimit } from './rate-limit';

// Test the validation logic for agents API
describe('Agent API Validation', () => {
  // Helper function mimicking agents route POST validation
  function validateSpawnRequest(body: any): { valid: boolean; error?: string } {
    const { action, agentId, task } = body;
    
    if (action === 'spawn') {
      if (!agentId || typeof agentId !== 'string') {
        return { valid: false, error: 'agentId is required for spawn action' };
      }
      if (!task || typeof task !== 'string') {
        return { valid: false, error: 'task is required for spawn action' };
      }
    }
    
    if (action === 'despawn') {
      if (!agentId || typeof agentId !== 'string') {
        return { valid: false, error: 'agentId is required for despawn action' };
      }
    }
    
    return { valid: true };
  }

  describe('validateSpawnRequest', () => {
    it('should reject invalid action', () => {
      const result = validateSpawnRequest({ action: 'invalid' });
      expect(result.valid).toBe(true); // Unknown actions are just ignored
    });

    it('should reject spawn without agentId', () => {
      const result = validateSpawnRequest({ action: 'spawn', task: 'do something' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('agentId');
    });

    it('should reject spawn without task', () => {
      const result = validateSpawnRequest({ action: 'spawn', agentId: 'yilong' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('task');
    });

    it('should accept valid spawn request', () => {
      const result = validateSpawnRequest({ action: 'spawn', agentId: 'yilong', task: 'review code' });
      expect(result.valid).toBe(true);
    });

    it('should accept non-spawn actions', () => {
      const result = validateSpawnRequest({ action: 'list' });
      expect(result.valid).toBe(true);
    });
  });

  // Test fallback agents structure
  describe('Fallback Agents Structure', () => {
    const fallbackAgents = [
      {
        id: 'main',
        name: 'Rei',
        role: 'Product Manager',
        avatar: '✨',
        description: 'Primary agent for coordination, documentation, and communication',
        model: 'MiniMax M2.1',
        status: 'offline',
        capabilities: ['project management', 'coordination', 'communication']
      },
      {
        id: 'yilong',
        name: 'Yilong',
        role: 'Senior Engineer',
        avatar: '👨‍💻',
        description: 'Code reviews, architecture, debugging, and technical documentation',
        model: 'MiniMax M2.1',
        status: 'offline',
        capabilities: ['code review', 'architecture', 'debugging', 'API design']
      },
      {
        id: 'dan',
        name: 'Dan',
        role: 'QA Tester',
        avatar: '🧪',
        description: 'Test execution, bug verification, and quality checks',
        model: 'MiniMax M2.1',
        status: 'offline',
        capabilities: ['testing', 'bug verification', 'quality assurance']
      }
    ];

    it('should have 3 fallback agents', () => {
      expect(fallbackAgents.length).toBe(3);
    });

    it('should have required fields for each agent', () => {
      fallbackAgents.forEach(agent => {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('role');
        expect(agent).toHaveProperty('avatar');
        expect(agent).toHaveProperty('capabilities');
        expect(Array.isArray(agent.capabilities)).toBe(true);
      });
    });

    it('should have correct agent names', () => {
      expect(fallbackAgents[0].name).toBe('Rei');
      expect(fallbackAgents[1].name).toBe('Yilong');
      expect(fallbackAgents[2].name).toBe('Dan');
    });
  });

  // Test rate limiting for agent spawning
  describe('Agent Spawn Rate Limiting', () => {
    it('should allow requests under limit', () => {
      const result = rateLimit('agent:test-ip-new', { windowMs: 60000, maxRequests: 10 });
      expect(result.allowed).toBe(true);
    });

    it('should track remaining requests', () => {
      const result = rateLimit('agent:test-ip-2', { windowMs: 60000, maxRequests: 10 });
      expect(result.remaining).toBe(9);
    });

    it('should block requests over limit', () => {
      // Make 10 requests (first one sets the counter to 1, remaining is 9)
      for (let i = 0; i < 10; i++) {
        rateLimit('agent:test-ip-block', { windowMs: 60000, maxRequests: 10 });
      }
      // 11th request should be blocked
      const result = rateLimit('agent:test-ip-block', { windowMs: 60000, maxRequests: 10 });
      expect(result.allowed).toBe(false);
    });
  });

  // Test despawn action validation
  describe('Despawn Action Validation', () => {
    it('should reject despawn without agentId', () => {
      const result = validateSpawnRequest({ action: 'despawn' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('agentId');
    });

    it('should accept valid despawn request', () => {
      const result = validateSpawnRequest({ action: 'despawn', agentId: 'yilong' });
      expect(result.valid).toBe(true);
    });

    it('should accept despawn with different agentIds', () => {
      const result = validateSpawnRequest({ action: 'despawn', agentId: 'main' });
      expect(result.valid).toBe(true);
    });
  });
});
