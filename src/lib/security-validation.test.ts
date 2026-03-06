// Additional Edge Case Tests for Colony
// Tests for security, validation edge cases, and error handling

import { describe, it, expect } from 'vitest';
import { 
  validateMessageInput, 
  validateChannelInput, 
  validateBotInput,
  sanitizeContent,
  sanitizeChannelName
} from './validation';

describe('Security: XSS Prevention', () => {
  it('should sanitize script tags in message content', () => {
    const malicious = '<script>alert("xss")</script>Hello';
    const result = sanitizeContent(malicious);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should sanitize HTML tags in message content', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const result = sanitizeContent(malicious);
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('should preserve legitimate content', () => {
    const legitimate = 'Hello <world> & "friends"';
    const result = sanitizeContent(legitimate);
    expect(result).toContain('Hello');
    expect(result).toContain('&lt;world&gt;');
    expect(result).toContain('&amp;');
  });

  it('should escape HTML entities to prevent XSS', () => {
    const malicious = '<div onclick="alert(1)"><script>evil()</script></div>';
    const result = sanitizeContent(malicious);
    // The content is escaped, so it won't execute as HTML
    expect(result).toContain('&lt;div');
    expect(result).toContain('&lt;script&gt;');
    // The onclick attribute is escaped too
    expect(result).toContain('onclick=');
  });
});

describe('Channel Name Sanitization', () => {
  it('should convert uppercase to lowercase', () => {
    expect(sanitizeChannelName('HELLO')).toBe('hello');
  });

  it('should convert spaces to hyphens', () => {
    expect(sanitizeChannelName('hello world')).toBe('hello-world');
  });

  it('should remove special characters', () => {
    // Note: sanitizeChannelName converts special chars to hyphens
    const result = sanitizeChannelName('hello@world!');
    expect(result).toBe('hello-world-');
  });

  it('should truncate to 50 characters', () => {
    const longName = 'a'.repeat(60);
    const result = sanitizeChannelName(longName);
    expect(result.length).toBe(50);
  });

  it('should handle empty input', () => {
    expect(sanitizeChannelName('')).toBe('');
  });

  it('should handle only special characters', () => {
    // Converts to hyphens (minus signs), not empty string
    const result = sanitizeChannelName('!@#$%');
    expect(result).toBe('-----');
  });
});

describe('Validation Edge Cases', () => {
  describe('Message Validation', () => {
    it('should reject whitespace-only content', () => {
      const result = validateMessageInput({ channelId: '1', content: '   ' });
      expect(result.valid).toBe(false);
    });

    it('should reject content over 10000 chars', () => {
      const longContent = 'a'.repeat(10001);
      const result = validateMessageInput({ channelId: '1', content: longContent });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should accept exactly 10000 chars', () => {
      const exactContent = 'a'.repeat(10000);
      const result = validateMessageInput({ channelId: '1', content: exactContent });
      expect(result.valid).toBe(true);
    });

    it('should reject null content', () => {
      const result = validateMessageInput({ channelId: '1', content: null });
      expect(result.valid).toBe(false);
    });

    it('should reject undefined content', () => {
      const result = validateMessageInput({ channelId: '1' });
      expect(result.valid).toBe(false);
    });
  });

  describe('Channel Validation', () => {
    it('should reject channel name over 50 chars', () => {
      const longName = 'a'.repeat(51);
      const result = validateChannelInput({ name: longName });
      expect(result.valid).toBe(false);
    });

    it('should reject uppercase in channel name', () => {
      const result = validateChannelInput({ name: 'HelloWorld' });
      expect(result.valid).toBe(false);
    });

    it('should reject special characters in channel name', () => {
      const result = validateChannelInput({ name: 'hello_world' });
      expect(result.valid).toBe(false);
    });

    it('should accept valid channel name with hyphens', () => {
      const result = validateChannelInput({ name: 'project-alpha' });
      expect(result.valid).toBe(true);
    });

    it('should reject description over 500 chars', () => {
      const longDesc = 'a'.repeat(501);
      const result = validateChannelInput({ name: 'test', description: longDesc });
      expect(result.valid).toBe(false);
    });
  });

  describe('Bot Validation', () => {
    it('should reject bot name over 50 chars', () => {
      const longName = 'a'.repeat(51);
      const result = validateBotInput({ name: longName });
      expect(result.valid).toBe(false);
    });

    it('should reject description over 500 chars', () => {
      const longDesc = 'a'.repeat(501);
      const result = validateBotInput({ name: 'TestBot', description: longDesc });
      expect(result.valid).toBe(false);
    });

    it('should accept valid bot input', () => {
      const result = validateBotInput({ name: 'TestBot', description: 'A test bot' });
      expect(result.valid).toBe(true);
    });
  });
});

describe('Input Sanitization', () => {
  it('should handle unicode characters', () => {
    const unicode = 'Hello 🌍 你好 🔥';
    const result = sanitizeContent(unicode);
    expect(result).toContain('🌍');
    expect(result).toContain('你好');
  });

  it('should handle empty strings', () => {
    expect(sanitizeContent('')).toBe('');
  });

  it('should handle strings with only special chars', () => {
    const result = sanitizeContent('!@#$%^&*()');
    expect(result).toBe('!@#$%^&amp;*()');
  });
});
