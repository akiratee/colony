// Edge case tests for Colony
import { describe, it, expect } from 'vitest';
import { validateMessageInput, validateChannelInput, sanitizeContent, generateId } from './validation';
import { rateLimit } from './rate-limit';

describe('Edge Cases - Message Validation', () => {
  it('should handle empty string channelId', () => {
    const result = validateMessageInput({ channelId: '', content: 'Hello' });
    expect(result.valid).toBe(false);
  });

  it('should handle whitespace-only channelId', () => {
    const result = validateMessageInput({ channelId: '   ', content: 'Hello' });
    expect(result.valid).toBe(false);
  });

  it('should handle whitespace-only content', () => {
    const result = validateMessageInput({ channelId: 'general', content: '   ' });
    expect(result.valid).toBe(false);
  });

  it('should handle very long content at boundary', () => {
    const longContent = 'a'.repeat(10000);
    const result = validateMessageInput({ channelId: 'general', content: longContent });
    expect(result.valid).toBe(true);
  });

  it('should reject content exceeding max length', () => {
    const longContent = 'a'.repeat(10001);
    const result = validateMessageInput({ channelId: 'general', content: longContent });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too long');
  });

  it('should handle non-string inputs', () => {
    expect(validateMessageInput({ channelId: 123, content: 'test' }).valid).toBe(false);
    expect(validateMessageInput({ channelId: 'test', content: 123 }).valid).toBe(false);
    // These will not crash but won't validate correctly since they fail type checks
    const result1 = validateMessageInput({} as any);
    expect(result1.valid).toBe(false);
    const result2 = validateMessageInput({ channelId: 'test' } as any);
    expect(result2.valid).toBe(false);
  });
});

describe('Edge Cases - Channel Validation', () => {
  it('should handle channel names with hyphens', () => {
    const result = validateChannelInput({ name: 'my-channel-name' });
    expect(result.valid).toBe(true);
  });

  it('should handle channel names with numbers', () => {
    const result = validateChannelInput({ name: 'channel-123' });
    expect(result.valid).toBe(true);
  });

  it('should reject uppercase letters', () => {
    const result = validateChannelInput({ name: 'MyChannel' });
    expect(result.valid).toBe(false);
  });

  it('should reject special characters', () => {
    expect(validateChannelInput({ name: 'channel@test' }).valid).toBe(false);
    expect(validateChannelInput({ name: 'channel#123' }).valid).toBe(false);
    expect(validateChannelInput({ name: 'channel_name' }).valid).toBe(false);
  });

  it('should handle description at max length', () => {
    const longDesc = 'a'.repeat(500);
    const result = validateChannelInput({ name: 'general', description: longDesc });
    expect(result.valid).toBe(true);
  });

  it('should reject description exceeding max length', () => {
    const longDesc = 'a'.repeat(501);
    const result = validateChannelInput({ name: 'general', description: longDesc });
    expect(result.valid).toBe(false);
  });
});

describe('Edge Cases - Content Sanitization', () => {
  it('should handle empty string', () => {
    expect(sanitizeContent('')).toBe('');
  });

  it('should handle all XSS vectors', () => {
    const malicious = '<script>alert("xss")</script>';
    expect(sanitizeContent(malicious)).not.toContain('<script>');
    expect(sanitizeContent(malicious)).toContain('&lt;script&gt;');
  });

  it('should handle nested quotes', () => {
    const input = 'He said "She said \'hello\'"';
    const result = sanitizeContent(input);
    expect(result).toContain('&quot;');
    expect(result).toContain('&#039;');
  });

  it('should handle Unicode correctly', () => {
    const input = '你好世界 🎉';
    expect(sanitizeContent(input)).toBe(input);
  });
});

describe('Edge Cases - ID Generation', () => {
  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100); // All should be unique
  });

  it('should generate valid UUIDs', () => {
    const id = generateId();
    // UUID format: 8-4-4-4-12 hex digits
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('Edge Cases - Rate Limiter', () => {
  it('should handle rapid successive requests', () => {
    const results = [];
    for (let i = 0; i < 15; i++) {
      results.push(rateLimit('rapid-test', { windowMs: 60000, maxRequests: 10 }));
    }
    // First 10 should be allowed
    expect(results.slice(0, 10).every(r => r.allowed)).toBe(true);
    // Last 5 should be blocked
    expect(results.slice(10).every(r => !r.allowed)).toBe(true);
  });

  it('should return correct remaining count', () => {
    const first = rateLimit('remaining-test', { windowMs: 60000, maxRequests: 5 });
    expect(first.remaining).toBe(4);
    
    const second = rateLimit('remaining-test', { windowMs: 60000, maxRequests: 5 });
    expect(second.remaining).toBe(3);
  });
});
