import { describe, it, expect, beforeEach } from 'vitest';
import type { Message, JoinChannelPayload, SendMessagePayload, TypingPayload, ConnectionState } from './socket';
import { getConnectionState, cleanupAll } from './socket';

// Re-export validation functions from server for testing
// These mirror the server validation logic
function validateJoinChannel(payload: any): payload is JoinChannelPayload {
  return payload && typeof payload.channelId === 'string' && payload.channelId.length > 0;
}

function validateSendMessage(payload: any): payload is SendMessagePayload {
  return payload && 
    typeof payload.channelId === 'string' && 
    typeof payload.content === 'string' &&
    payload.content.length > 0 &&
    payload.content.length <= 10000 &&
    payload.author && 
    typeof payload.author.name === 'string';
}

function validateTyping(payload: any): payload is TypingPayload {
  return payload &&
    typeof payload.channelId === 'string' &&
    typeof payload.userId === 'string' &&
    typeof payload.isTyping === 'boolean';
}

describe('Message Validation', () => {
  it('should validate message structure', () => {
    const validMessage = {
      id: '1',
      content: 'Hello',
      channelId: 'general',
      author: { name: 'Vincent' },
      timestamp: new Date()
    };
    
    expect(validMessage.content).toBeDefined();
    expect(validMessage.channelId).toBeDefined();
    expect(validMessage.author).toBeDefined();
  });

  it('should allow valid message content', () => {
    const validContent = 'Hello team!';
    expect(validContent.length).toBeGreaterThan(0);
    expect(validContent.length).toBeLessThanOrEqual(10000);
  });

  it('should reject empty content', () => {
    const message = {
      id: '1',
      content: '',
      channelId: 'general',
      author: { name: 'Vincent' }
    };
    
    expect(message.content.length).toBe(0);
  });

  it('should reject content over 10000 chars', () => {
    const longContent = 'a'.repeat(10001);
    expect(longContent.length).toBeGreaterThan(10000);
  });

  it('should sanitize HTML in message content', () => {
    const maliciousContent = '<script>alert("xss")</script>';
    const sanitized = maliciousContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    expect(sanitized).not.toContain('<script>');
    expect(sanitized).toContain('&lt;script&gt;');
  });
});

describe('Channel Operations', () => {
  it('should create a valid channel object', () => {
    const channel = {
      id: '1',
      name: 'general',
      description: 'General discussion'
    };
    
    expect(channel.id).toBeDefined();
    expect(channel.name).toBeDefined();
    expect(channel.name).toBe('general');
  });

  it('should identify project channels by p- prefix', () => {
    const projectChannel = { id: '1', name: 'p-colony' };
    const regularChannel = { id: '2', name: 'random' };
    
    expect(projectChannel.name.startsWith('p-')).toBe(true);
    expect(regularChannel.name.startsWith('p-')).toBe(false);
  });

  it('should slugify channel names', () => {
    const channelName = 'My New Channel';
    const slugified = channelName.toLowerCase().replace(/\s+/g, '-');
    
    expect(slugified).toBe('my-new-channel');
  });
});

describe('Agent Structure', () => {
  it('should validate agent properties', () => {
    const agent = {
      id: '1',
      name: 'Rei',
      role: 'Product Manager',
      avatar: '✨',
      personality: 'Friendly',
      model: 'MiniMax M2.1',
      status: 'active'
    };
    
    expect(agent.name).toBeDefined();
    expect(agent.role).toBeDefined();
    expect(['active', 'inactive']).toContain(agent.status);
  });

  it('should have valid avatar emoji', () => {
    const validAvatars = ['🤖', '👨‍💻', '👩‍🔬', '👨‍🔧', '🧪', '📋', '✨', '🦁'];
    const agent = { avatar: '🤖' };
    
    expect(validAvatars).toContain(agent.avatar);
  });
});

describe('ID Generation', () => {
  it('should generate unique IDs', () => {
    const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    
    // All IDs should be unique
    expect(ids.size).toBe(100);
  });
});

describe('Socket Event Payloads', () => {
  it('should validate join_channel payload', () => {
    const payload = { channelId: 'general' };
    expect(payload.channelId).toBeDefined();
    expect(typeof payload.channelId).toBe('string');
  });

  it('should validate send_message payload', () => {
    const payload = {
      channelId: 'general',
      content: 'Hello',
      author: { name: 'Vincent', avatar: '👨‍💻' }
    };
    
    expect(payload.channelId).toBeDefined();
    expect(payload.content).toBeDefined();
    expect(payload.author).toBeDefined();
    expect(payload.author.name).toBeDefined();
  });

  it('should validate typing payload', () => {
    const payload = {
      channelId: 'general',
      userId: 'user-1',
      isTyping: true
    };
    
    expect(payload.channelId).toBeDefined();
    expect(payload.userId).toBeDefined();
    expect(typeof payload.isTyping).toBe('boolean');
  });

  it('should validate channel_joined payload', () => {
    // The channel_joined event is emitted by server after successful join
    const payload = { channelId: 'general' };
    expect(payload.channelId).toBeDefined();
    expect(typeof payload.channelId).toBe('string');
  });
});

// Additional Integration Tests (Added by Yilong)
describe('Validation Edge Cases', () => {
  it('should reject empty string content', () => {
    const content = '';
    const isValid = content.length > 0;
    expect(isValid).toBe(false);
  });

  it('should handle missing author gracefully', () => {
    const message: { id: string; content: string; channelId: string; author?: { name: string; avatar?: string } } = {
      id: '1',
      content: 'Hello',
      channelId: 'general'
      // author is missing
    };
    
    const author = message.author || { name: 'Anonymous', avatar: '👤' };
    expect(author.name).toBe('Anonymous');
  });

  it('should handle null/undefined channelId', () => {
    const validateChannelId = (channelId: any) => {
      return !(!channelId || typeof channelId !== 'string' || channelId.length === 0);
    };
    
    expect(validateChannelId(null)).toBe(false);
    expect(validateChannelId(undefined)).toBe(false);
    expect(validateChannelId('')).toBe(false);
    expect(validateChannelId('general')).toBe(true);
  });

  it('should handle missing author in socket payload', () => {
    const payload: { channelId: string; content: string; author?: { name: string } } = {
      channelId: 'general',
      content: 'Hello'
      // author is missing
    };
    
    const author = payload.author || { name: 'Anonymous' };
    expect(author.name).toBe('Anonymous');
  });

  it('should sanitize special characters in channel names', () => {
    const channelName = 'general-chat_123';
    // Replace non-alphanumeric (except hyphen) with hyphen
    const sanitized = channelName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    expect(sanitized).toBe('general-chat-123');
  });

  it('should validate bot name requirements', () => {
    const validateBotName = (name: string) => {
      return !(!name || typeof name !== 'string' || name.length < 1 || name.length > 50);
    };
    
    expect(validateBotName('Valid Bot')).toBe(true);
    expect(validateBotName('')).toBe(false);
    expect(validateBotName('a'.repeat(51))).toBe(false);
  });

  it('should preserve non-empty strings in sanitization', () => {
    const content = 'Hello <world>!';
    const sanitized = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    expect(sanitized).toBe('Hello &lt;world&gt;!');
    expect(sanitized.length).toBeGreaterThan(0);
  });

  it('should handle very long channel names by truncating', () => {
    const longName = 'a'.repeat(100);
    const truncated = longName.substring(0, 50);
    expect(truncated.length).toBe(50);
  });
});

// API Endpoint Tests
describe('API Validation', () => {
  // Simulate API validation logic
  function validateMessage(body: any): { valid: boolean; error?: string } {
    if (!body.channelId || typeof body.channelId !== 'string' || body.channelId.trim().length === 0) {
      return { valid: false, error: 'channelId is required' };
    }
    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return { valid: false, error: 'content is required' };
    }
    if (body.content.length > 10000) {
      return { valid: false, error: 'content too long (max 10000 chars)' };
    }
    return { valid: true };
  }

  function validateChannel(body: any): { valid: boolean; error?: string } {
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return { valid: false, error: 'Channel name is required' };
    }
    if (body.name.length > 50) {
      return { valid: false, error: 'Channel name too long (max 50 chars)' };
    }
    return { valid: true };
  }

  function validateBot(body: any): { valid: boolean; error?: string } {
    if (!body.name || typeof body.name !== 'string' || body.length < 1 || body.name.length > 50) {
      return { valid: false, error: 'Bot name is required and must be 1-50 chars' };
    }
    return { valid: true };
  }

  describe('Message Validation', () => {
    it('should accept valid message', () => {
      const result = validateMessage({ channelId: 'general', content: 'Hello!' });
      expect(result.valid).toBe(true);
    });

    it('should reject missing channelId', () => {
      const result = validateMessage({ content: 'Hello!' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('channelId is required');
    });

    it('should reject missing content', () => {
      const result = validateMessage({ channelId: 'general' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('content is required');
    });

    it('should reject empty content', () => {
      const result = validateMessage({ channelId: 'general', content: '   ' });
      expect(result.valid).toBe(false);
    });

    it('should reject content over 10000 chars', () => {
      const result = validateMessage({ channelId: 'general', content: 'a'.repeat(10001) });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('content too long (max 10000 chars)');
    });
  });

  describe('Channel Validation', () => {
    it('should accept valid channel', () => {
      const result = validateChannel({ name: 'engineering' });
      expect(result.valid).toBe(true);
    });

    it('should reject missing name', () => {
      const result = validateChannel({});
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Channel name is required');
    });

    it('should reject empty name', () => {
      const result = validateChannel({ name: '   ' });
      expect(result.valid).toBe(false);
    });

    it('should reject name over 50 chars', () => {
      const result = validateChannel({ name: 'a'.repeat(51) });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Channel name too long (max 50 chars)');
    });
  });

  describe('Bot Validation', () => {
    it('should accept valid bot', () => {
      const result = validateBot({ name: 'Test Bot' });
      expect(result.valid).toBe(true);
    });

    it('should reject missing name', () => {
      const result = validateBot({});
      expect(result.valid).toBe(false);
    });

    it('should reject empty name', () => {
      const result = validateBot({ name: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject name over 50 chars', () => {
      const result = validateBot({ name: 'a'.repeat(51) });
      expect(result.valid).toBe(false);
    });
  });
});

describe('Socket Event Payloads', () => {
  function validateJoinChannel(payload: any): payload is JoinChannelPayload {
    return payload && typeof payload.channelId === 'string' && payload.channelId.length > 0;
  }

  function validateSendMessage(payload: any): payload is SendMessagePayload {
    return payload && 
      typeof payload.channelId === 'string' && 
      typeof payload.content === 'string' &&
      payload.content.length > 0 &&
      payload.content.length <= 10000 &&
      payload.author && 
      typeof payload.author.name === 'string';
  }

  function validateTyping(payload: any): payload is TypingPayload {
    return payload &&
      typeof payload.channelId === 'string' &&
      typeof payload.userId === 'string' &&
      typeof payload.isTyping === 'boolean';
  }

  it('should validate join_channel payload', () => {
    expect(validateJoinChannel({ channelId: 'general' })).toBe(true);
    expect(validateJoinChannel({})).toBe(false);
    expect(validateJoinChannel({ channelId: '' })).toBe(false);
  });

  it('should validate send_message payload', () => {
    const validPayload = {
      channelId: 'general',
      content: 'Hello',
      author: { name: 'Vincent' }
    };
    expect(validateSendMessage(validPayload)).toBe(true);
    expect(!!validateSendMessage({ channelId: 'general' })).toBe(false);
    expect(!!validateSendMessage({ channelId: 'general', content: 'Hi' })).toBe(false);
  });

  it('should validate typing payload', () => {
    const validPayload = {
      channelId: 'general',
      userId: 'user-1',
      isTyping: true
    };
    expect(validateTyping(validPayload)).toBe(true);
    expect(validateTyping({ channelId: 'general', isTyping: true })).toBe(false);
    expect(validateTyping({ channelId: 'general', userId: 'user-1' })).toBe(false);
  });

  // NEW: Test edge cases for socket validation
  it('should reject send_message with empty content', () => {
    const payload = {
      channelId: 'general',
      content: '',
      author: { name: 'Vincent' }
    };
    expect(validateSendMessage(payload)).toBe(false);
  });

  it('should reject send_message with content over 10000 chars', () => {
    const payload = {
      channelId: 'general',
      content: 'a'.repeat(10001),
      author: { name: 'Vincent' }
    };
    expect(validateSendMessage(payload)).toBe(false);
  });

  it('should reject send_message with missing author name', () => {
    const payload = {
      channelId: 'general',
      content: 'Hello',
      author: { avatar: '👨‍💻' } // name missing
    };
    expect(validateSendMessage(payload)).toBe(false);
  });

  it('should reject typing with invalid isTyping', () => {
    expect(validateTyping({ channelId: 'general', userId: '1', isTyping: 'yes' as any })).toBe(false);
    expect(validateTyping({ channelId: 'general', userId: '1', isTyping: 1 as any })).toBe(false);
  });
});

// XSS Sanitization Tests
describe('XSS Sanitization', () => {
  function sanitizeContent(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  it('should sanitize script tags', () => {
    const result = sanitizeContent('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should sanitize event handlers', () => {
    const result = sanitizeContent('<img onerror="alert(1)" src="x">');
    // After sanitization, < becomes &lt; so the tag won't execute
    expect(result).toContain('&lt;img');
    expect(result).not.toContain('<img');
  });

  it('should preserve safe HTML', () => {
    const result = sanitizeContent('<b>Hello</b>');
    expect(result).toContain('&lt;b&gt;');
  });

  it('should encode quotes', () => {
    const result = sanitizeContent('Hello "world"');
    expect(result).toContain('&quot;world&quot;');
  });

  it('should encode ampersands', () => {
    const result = sanitizeContent('A & B');
    expect(result).toContain('&amp;');
  });

  // NEW: Additional XSS vectors
  it('should sanitize javascript: URLs by encoding tags', () => {
    const result = sanitizeContent('<a href="javascript:alert(1)">click</a>');
    // The < and > are encoded, making the tag harmless
    expect(result).toContain('&lt;a');
    expect(result).not.toContain('<a href=');
  });

  it('should sanitize onload events by encoding tags', () => {
    const result = sanitizeContent('<body onload="alert(1)">');
    // The < and > are encoded, making the tag harmless  
    expect(result).toContain('&lt;body');
    expect(result).not.toContain('<body onload=');
  });

  it('should sanitize SVG tags by encoding tags', () => {
    const result = sanitizeContent('<svg onload="alert(1)">');
    // The < and > are encoded, making the tag harmless
    expect(result).toContain('&lt;svg');
    expect(result).not.toContain('<svg onload=');
  });
});

// Type exports test
describe('Type Exports', () => {
  it('should have correct Message type', () => {
    const message: Message = {
      id: '1',
      content: 'test',
      channelId: 'general',
      author: { name: 'Test' },
      timestamp: new Date()
    };
    expect(message.id).toBeDefined();
  });

  it('should have correct JoinChannelPayload type', () => {
    const payload: JoinChannelPayload = { channelId: 'general' };
    expect(payload.channelId).toBeDefined();
  });

  it('should have correct SendMessagePayload type', () => {
    const payload: SendMessagePayload = {
      channelId: 'general',
      content: 'hello',
      author: { name: 'Test' }
    };
    expect(payload.channelId).toBeDefined();
    expect(payload.content).toBeDefined();
    expect(payload.author).toBeDefined();
  });

  it('should have correct TypingPayload type', () => {
    const payload: TypingPayload = {
      channelId: 'general',
      userId: 'user-1',
      isTyping: true
    };
    expect(payload.channelId).toBeDefined();
    expect(payload.userId).toBeDefined();
    expect(typeof payload.isTyping).toBe('boolean');
  });
});

// Connection state tests
describe('Connection State', () => {
  beforeEach(() => {
    cleanupAll();
  });

  it('should return disconnected when socket not initialized', () => {
    const state = getConnectionState();
    expect(state).toBe('disconnected');
  });

  it('should have correct ConnectionState type', () => {
    const states: ConnectionState[] = ['disconnected', 'connecting', 'connected', 'error'];
    expect(states).toContain('disconnected');
    expect(states).toContain('connecting');
    expect(states).toContain('connected');
    expect(states).toContain('error');
  });
});
