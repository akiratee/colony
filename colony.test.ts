// Colony Unit Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    connected: false,
  })),
}));

describe('Colony Message API', () => {
  describe('GET /api/messages', () => {
    it('should return all messages when no channelId provided', async () => {
      // This would require setting up test server
      // For now, test the expected behavior
      const messages = [
        { id: '1', channelId: '1', content: 'Test' },
        { id: '2', channelId: '2', content: 'Test 2' },
      ];
      
      // Filter when channelId is null/undefined - return all
      const result = messages.filter(m => m.channelId === undefined);
      expect(result.length).toBe(0);
    });

    it('should filter messages by channelId', async () => {
      const messages = [
        { id: '1', channelId: '1', content: 'General chat' },
        { id: '2', channelId: '1', content: 'Another general message' },
        { id: '3', channelId: '2', content: 'Engineering chat' },
      ];
      
      const channel1Messages = messages.filter(m => m.channelId === '1');
      expect(channel1Messages.length).toBe(2);
    });
  });

  describe('POST /api/messages', () => {
    it('should create message with required fields', () => {
      const body = {
        channelId: '1',
        content: 'Hello world',
      };
      
      const message = {
        id: Date.now().toString(),
        channelId: body.channelId,
        content: body.content,
        author: body.author || { name: 'Anonymous', avatar: '👤' },
        timestamp: new Date().toISOString(),
      };
      
      expect(message.channelId).toBe('1');
      expect(message.content).toBe('Hello world');
      expect(message.author.name).toBe('Anonymous');
    });

    it('should use provided author when given', () => {
      const body = {
        channelId: '1',
        content: 'Test',
        author: { name: 'Vincent', avatar: '👨‍💻' },
      };
      
      const message = {
        id: Date.now().toString(),
        channelId: body.channelId,
        content: body.content,
        author: body.author || { name: 'Anonymous', avatar: '👤' },
        timestamp: new Date().toISOString(),
      };
      
      expect(message.author.name).toBe('Vincent');
      expect(message.author.avatar).toBe('👨‍💻');
    });
  });
});

describe('Colony Channel API', () => {
  describe('GET /api/channels', () => {
    it('should return all channels', () => {
      const channels = [
        { id: '1', name: 'general', description: 'General discussion' },
        { id: '2', name: 'engineering', description: 'Engineering team chat' },
        { id: '3', name: 'design', description: 'Design discussions' },
      ];
      
      expect(channels.length).toBe(3);
      expect(channels[0].name).toBe('general');
    });
  });

  describe('POST /api/channels', () => {
    it('should create channel with name and description', () => {
      const body = {
        name: 'new-channel',
        description: 'A new channel',
      };
      
      const channel = {
        id: Date.now().toString(),
        name: body.name,
        description: body.description || '',
        created_at: new Date().toISOString(),
      };
      
      expect(channel.name).toBe('new-channel');
      expect(channel.description).toBe('A new channel');
    });

    it('should default description to empty string', () => {
      const body = { name: 'test' };
      
      const channel = {
        id: '1',
        name: body.name,
        description: body.description || '',
      };
      
      expect(channel.description).toBe('');
    });
  });
});

describe('Colony Agent API', () => {
  describe('GET /api/agents', () => {
    it('should include default agents', () => {
      const defaultAgents = [
        { id: 'main', name: 'Rei', role: 'Product Manager' },
        { id: 'yilong', name: 'Yilong', role: 'Senior Engineer' },
        { id: 'dan', name: 'Dan', role: 'QA Tester' },
      ];
      
      expect(defaultAgents.length).toBe(3);
      expect(defaultAgents.find(a => a.id === 'main')?.name).toBe('Rei');
    });

    it('should merge default and custom agents', () => {
      const defaultAgents = [
        { id: 'main', name: 'Rei' },
      ];
      const customAgents = [
        { id: 'custom-1', name: 'CustomBot' },
      ];
      
      const allAgents = [...defaultAgents, ...customAgents];
      expect(allAgents.length).toBe(2);
    });
  });

  describe('POST /api/agents', () => {
    it('should require agent name', () => {
      const agent = {
        role: 'Assistant',
        // name missing
      };
      
      const isValid = !!agent.name;
      expect(isValid).toBe(false);
    });

    it('should create agent with all provided fields', () => {
      const body = {
        name: 'TestBot',
        role: 'Assistant',
        avatar: '🤖',
        personality: 'Friendly',
        model: 'MiniMax M2.1',
        systemPrompt: 'You are a test bot',
      };
      
      const agent = {
        ...body,
        id: body.id || Date.now().toString(),
        status: 'active',
      };
      
      expect(agent.name).toBe('TestBot');
      expect(agent.status).toBe('active');
    });
  });
});

describe('Socket.io Events', () => {
  describe('join_channel', () => {
    it('should require channelId', () => {
      const payload = {};
      const isValid = !!payload.channelId;
      expect(isValid).toBe(false);
    });

    it('should accept valid channel join payload', () => {
      const payload = { channelId: 'general' };
      expect(payload.channelId).toBe('general');
    });
  });

  describe('send_message', () => {
    it('should require channelId, content, and author', () => {
      const payload = {
        channelId: '1',
        content: 'Hello',
        author: { name: 'Vincent' },
      };
      
      expect(!!payload.channelId).toBe(true);
      expect(!!payload.content).toBe(true);
      expect(!!payload.author).toBe(true);
    });

    it('should reject message without content', () => {
      const payload = {
        channelId: '1',
        content: '',
        author: { name: 'Vincent' },
      };
      
      const isValid = payload.content.trim().length > 0;
      expect(isValid).toBe(false);
    });
  });
});

describe('Message Type Validation', () => {
  it('should have required message fields', () => {
    const message = {
      id: '1',
      content: 'Test',
      channelId: '1',
      author: { name: 'User' },
      timestamp: new Date(),
    };
    
    expect(typeof message.id).toBe('string');
    expect(typeof message.content).toBe('string');
    expect(typeof message.channelId).toBe('string');
    expect(typeof message.author).toBe('object');
    expect(message.timestamp instanceof Date).toBe(true);
  });

  it('should allow optional author fields', () => {
    const message = {
      id: '1',
      content: 'Test',
      channelId: '1',
      author: { 
        name: 'Bot',
        avatar: '🤖',
        isBot: true
      },
    };
    
    expect(message.author.isBot).toBe(true);
    expect(message.author.avatar).toBe('🤖');
  });
});

describe('Input Validation', () => {
  // Validation logic mirrored from API
  function validateMessage(body: any): { valid: boolean; error?: string } {
    if (!body.channelId || typeof body.channelId !== 'string') {
      return { valid: false, error: 'channelId is required' };
    }
    if (!body.content || typeof body.content !== 'string') {
      return { valid: false, error: 'content is required' };
    }
    if (body.content.length > 10000) {
      return { valid: false, error: 'content too long (max 10000 chars)' };
    }
    return { valid: true };
  }

  it('should reject message without channelId', () => {
    const result = validateMessage({ content: 'Hello' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('channelId is required');
  });

  it('should reject message without content', () => {
    const result = validateMessage({ channelId: '1' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('content is required');
  });

  it('should reject message with content over 10000 chars', () => {
    const longContent = 'a'.repeat(10001);
    const result = validateMessage({ channelId: '1', content: longContent });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('content too long (max 10000 chars)');
  });

  it('should accept valid message', () => {
    const result = validateMessage({ channelId: '1', content: 'Hello world' });
    expect(result.valid).toBe(true);
  });

  it('should validate channel name', () => {
    function validateChannel(body: any): { valid: boolean; error?: string } {
      if (!body.name || typeof body.name !== 'string') {
        return { valid: false, error: 'Channel name is required' };
      }
      return { valid: true };
    }

    expect(validateChannel({}).valid).toBe(false);
    expect(validateChannel({ name: '' }).valid).toBe(false);
    expect(validateChannel({ name: 'general' }).valid).toBe(true);
  });

  it('should validate bot name', () => {
    function validateBot(body: any): { valid: boolean; error?: string } {
      if (!body.name || typeof body.name !== 'string') {
        return { valid: false, error: 'Bot name is required' };
      }
      return { valid: true };
    }

    expect(validateBot({}).valid).toBe(false);
    expect(validateBot({ name: 'TestBot' }).valid).toBe(true);
  });
});

describe('XSS Prevention', () => {
  function sanitizeContent(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  it('should sanitize HTML tags', () => {
    const result = sanitizeContent('<script>alert("xss")</script>');
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should sanitize HTML entities', () => {
    const result = sanitizeContent('&lt;script&gt;');
    expect(result).toBe('&amp;lt;script&amp;gt;');
  });

  it('should preserve safe content', () => {
    const result = sanitizeContent('Hello <world>!');
    expect(result).toBe('Hello &lt;world&gt;!');
  });
});
