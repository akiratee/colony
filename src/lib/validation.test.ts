// Shared Validation Module Tests

import { describe, it, expect } from 'vitest';
import {
  validateMessageInput,
  validateChannelInput,
  validateBotInput,
  validateSendMessagePayload,
  validateJoinChannelPayload,
  validateTypingPayload,
  sanitizeContent,
  sanitizeChannelName,
  generateId,
  parsePaginationParams,
} from './validation';

describe('validateMessageInput', () => {
  it('should accept valid message', () => {
    const result = validateMessageInput({ channelId: 'general', content: 'Hello!' });
    expect(result.valid).toBe(true);
  });

  it('should reject missing channelId', () => {
    const result = validateMessageInput({ content: 'Hello!' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('channelId is required');
  });

  it('should reject missing content', () => {
    const result = validateMessageInput({ channelId: 'general' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('content is required');
  });

  it('should reject empty content', () => {
    const result = validateMessageInput({ channelId: 'general', content: '' });
    expect(result.valid).toBe(false);
  });

  it('should reject whitespace-only content', () => {
    const result = validateMessageInput({ channelId: 'general', content: '   ' });
    expect(result.valid).toBe(false);
  });

  it('should reject content over 10000 chars', () => {
    const result = validateMessageInput({ channelId: 'general', content: 'a'.repeat(10001) });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('content too long (max 10000 chars)');
  });

  it('should accept exactly 10000 chars', () => {
    const result = validateMessageInput({ channelId: 'general', content: 'a'.repeat(10000) });
    expect(result.valid).toBe(true);
  });
});

describe('validateChannelInput', () => {
  it('should accept valid channel', () => {
    const result = validateChannelInput({ name: 'engineering', description: 'Engineering chat' });
    expect(result.valid).toBe(true);
  });

  it('should reject missing name', () => {
    const result = validateChannelInput({ description: 'Test' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Channel name is required');
  });

  it('should reject empty name', () => {
    const result = validateChannelInput({ name: '' });
    expect(result.valid).toBe(false);
  });

  it('should reject name over 50 chars', () => {
    const result = validateChannelInput({ name: 'a'.repeat(51) });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Channel name too long (max 50 chars)');
  });

  it('should reject uppercase name', () => {
    const result = validateChannelInput({ name: 'Engineering' });
    expect(result.valid).toBe(false);
  });

  it('should accept hyphens in name', () => {
    const result = validateChannelInput({ name: 'front-end-dev' });
    expect(result.valid).toBe(true);
  });

  it('should reject special characters', () => {
    const result = validateChannelInput({ name: 'eng_chat!' });
    expect(result.valid).toBe(false);
  });

  it('should reject description over 500 chars', () => {
    const result = validateChannelInput({ name: 'test', description: 'a'.repeat(501) });
    expect(result.valid).toBe(false);
  });
});

describe('validateBotInput', () => {
  it('should accept valid bot', () => {
    const result = validateBotInput({ name: 'Test Bot', description: 'A helpful bot' });
    expect(result.valid).toBe(true);
  });

  it('should accept bot with just name', () => {
    const result = validateBotInput({ name: 'Simple Bot' });
    expect(result.valid).toBe(true);
  });

  it('should reject missing name', () => {
    const result = validateBotInput({ description: 'A bot' });
    expect(result.valid).toBe(false);
  });

  it('should reject name over 50 chars', () => {
    const result = validateBotInput({ name: 'a'.repeat(51) });
    expect(result.valid).toBe(false);
  });

  it('should accept valid status online', () => {
    const result = validateBotInput({ name: 'Test Bot', status: 'online' });
    expect(result.valid).toBe(true);
  });

  it('should accept valid status offline', () => {
    const result = validateBotInput({ name: 'Test Bot', status: 'offline' });
    expect(result.valid).toBe(true);
  });

  it('should reject invalid status', () => {
    const result = validateBotInput({ name: 'Test Bot', status: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Status must be 'online' or 'offline'");
  });
});

describe('validateSendMessagePayload', () => {
  it('should accept valid payload', () => {
    const payload = {
      channelId: 'general',
      content: 'Hello team!',
      author: { name: 'Vincent' }
    };
    expect(validateSendMessagePayload(payload)).toBe(true);
  });

  it('should reject null', () => {
    expect(validateSendMessagePayload(null)).toBe(false);
  });

  it('should reject missing author', () => {
    const payload = { channelId: 'general', content: 'Hello' };
    expect(validateSendMessagePayload(payload)).toBe(false);
  });

  it('should reject empty content', () => {
    const payload = { channelId: 'general', content: '', author: { name: 'Vincent' } };
    expect(validateSendMessagePayload(payload)).toBe(false);
  });

  it('should reject content over 10000 chars', () => {
    const payload = { channelId: 'general', content: 'a'.repeat(10001), author: { name: 'Vincent' } };
    expect(validateSendMessagePayload(payload)).toBe(false);
  });
});

describe('validateJoinChannelPayload', () => {
  it('should accept valid payload', () => {
    expect(validateJoinChannelPayload({ channelId: 'general' })).toBe(true);
  });

  it('should reject empty channelId', () => {
    expect(validateJoinChannelPayload({ channelId: '' })).toBe(false);
  });

  it('should reject missing channelId', () => {
    expect(validateJoinChannelPayload({})).toBe(false);
    expect(validateJoinChannelPayload({ userId: '123' })).toBe(false);
  });
});

describe('validateTypingPayload', () => {
  it('should accept valid payload', () => {
    const payload = { channelId: 'general', userId: 'user1', isTyping: true };
    expect(validateTypingPayload(payload)).toBe(true);
  });

  it('should reject invalid isTyping', () => {
    const payload = { channelId: 'general', userId: 'user1', isTyping: 'yes' as any };
    expect(validateTypingPayload(payload)).toBe(false);
  });

  it('should reject missing fields', () => {
    expect(validateTypingPayload({ channelId: '1', isTyping: true })).toBe(false);
    expect(validateTypingPayload({ userId: '1', isTyping: true })).toBe(false);
  });
});

describe('sanitizeContent', () => {
  it('should sanitize HTML tags', () => {
    const dirty = '<script>alert("xss")</script>';
    const clean = sanitizeContent(dirty);
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('&lt;script&gt;');
  });

  it('should sanitize event handlers', () => {
    const dirty = '<img onerror="alert(1)" src="x">';
    const clean = sanitizeContent(dirty);
    expect(clean).toContain('&lt;img');
    expect(clean).not.toContain('<img');
  });

  it('should encode quotes', () => {
    const dirty = 'Hello "world" and \'test\'';
    const clean = sanitizeContent(dirty);
    expect(clean).toContain('&quot;world&quot;');
    expect(clean).toContain('&#039;test&#039;');
  });

  it('should preserve unicode', () => {
    const content = 'Hello 🌍 你好 🎉';
    expect(sanitizeContent(content)).toBe(content);
  });
});

describe('sanitizeChannelName', () => {
  it('should convert to lowercase', () => {
    expect(sanitizeChannelName('GENERAL')).toBe('general');
  });

  it('should replace spaces with hyphens', () => {
    expect(sanitizeChannelName('general chat')).toBe('general-chat');
  });

  it('should remove special characters', () => {
    expect(sanitizeChannelName('eng_@#chat')).toBe('eng---chat');
  });

  it('should truncate to 50 chars', () => {
    const longName = 'a'.repeat(60);
    expect(sanitizeChannelName(longName).length).toBe(50);
  });
});

describe('generateId', () => {
  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it('should generate valid UUIDs', () => {
    const id = generateId();
    // UUID format: 8-4-4-4-12 hex digits
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('parsePaginationParams', () => {
  it('should use defaults', () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it('should cap limit at 100', () => {
    const params = new URLSearchParams('limit=200');
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(100);
  });

  it('should parse custom values', () => {
    const params = new URLSearchParams('limit=25&offset=50');
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(25);
    expect(result.offset).toBe(50);
  });
});
