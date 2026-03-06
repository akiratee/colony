import { describe, it, expect } from 'vitest';
import { 
  validateMessagePayload, 
  validateChannelPayload, 
} from './types';
import { 
  validateTypingPayload,
  sanitizeContent,
  sanitizeChannelName
} from './validation';

describe('Type Validation Functions', () => {
  describe('validateMessagePayload', () => {
    it('should validate a correct message payload', () => {
      const payload = {
        channelId: 'general',
        content: 'Hello world',
        author: { name: 'Vincent', avatar: '👨‍💻' }
      };
      expect(validateMessagePayload(payload)).toBe(true);
    });

    it('should reject payload missing channelId', () => {
      const payload = { content: 'Hello', author: { name: 'Vincent' } };
      expect(validateMessagePayload(payload)).toBe(false);
    });

    it('should reject payload with empty content', () => {
      const payload = { channelId: 'general', content: '', author: { name: 'Vincent' } };
      expect(validateMessagePayload(payload)).toBe(false);
    });

    it('should reject payload with content over 10000 chars', () => {
      const payload = { 
        channelId: 'general', 
        content: 'a'.repeat(10001), 
        author: { name: 'Vincent' } 
      };
      expect(validateMessagePayload(payload)).toBe(false);
    });

    it('should reject payload missing author', () => {
      const payload = { channelId: 'general', content: 'Hello' };
      expect(validateMessagePayload(payload)).toBe(false);
    });

    it('should reject payload with null author', () => {
      const payload = { channelId: 'general', content: 'Hello', author: null as any };
      expect(validateMessagePayload(payload)).toBe(false);
    });
  });

  describe('validateChannelPayload', () => {
    it('should validate correct channel payload', () => {
      const payload = { channelId: 'general' };
      expect(validateChannelPayload(payload)).toBe(true);
    });

    it('should reject empty channelId', () => {
      const payload = { channelId: '' };
      expect(validateChannelPayload(payload)).toBe(false);
    });

    it('should reject missing channelId', () => {
      const payload = {};
      expect(validateChannelPayload(payload)).toBe(false);
    });
  });

  describe('validateTypingPayload', () => {
    it('should validate correct typing payload', () => {
      const payload = { channelId: 'general', userId: 'user-1', isTyping: true };
      expect(validateTypingPayload(payload)).toBe(true);
    });

    it('should reject payload missing isTyping', () => {
      const payload = { channelId: 'general', userId: 'user-1' };
      expect(validateTypingPayload(payload)).toBe(false);
    });

    it('should reject payload with non-boolean isTyping', () => {
      const payload = { channelId: 'general', userId: 'user-1', isTyping: 'yes' as any };
      expect(validateTypingPayload(payload)).toBe(false);
    });
  });

  describe('sanitizeContent', () => {
    it('should sanitize script tags', () => {
      const result = sanitizeContent('<script>alert(1)</script>');
      expect(result).not.toContain('<script>');
    });

    it('should sanitize HTML tags', () => {
      const result = sanitizeContent('<div>Hello</div>');
      expect(result).toContain('&lt;div&gt;');
    });

    it('should encode quotes', () => {
      const result = sanitizeContent('Say "hello"');
      expect(result).toContain('&quot;');
    });

    it('should encode ampersands', () => {
      const result = sanitizeContent('A & B');
      expect(result).toContain('&amp;');
    });

    it('should handle empty string', () => {
      expect(sanitizeContent('')).toBe('');
    });

    it('should handle string with no special characters', () => {
      expect(sanitizeContent('Hello World')).toBe('Hello World');
    });
  });

  describe('sanitizeChannelName', () => {
    it('should convert spaces to hyphens', () => {
      expect(sanitizeChannelName('my channel')).toBe('my-channel');
    });

    it('should convert to lowercase', () => {
      expect(sanitizeChannelName('MY-CHANNEL')).toBe('my-channel');
    });

    it('should remove special characters', () => {
      expect(sanitizeChannelName('test@channel#123')).toBe('test-channel-123');
    });

    it('should truncate long names', () => {
      const longName = 'a'.repeat(100);
      expect(sanitizeChannelName(longName).length).toBe(50);
    });

    it('should handle empty string', () => {
      expect(sanitizeChannelName('')).toBe('');
    });
  });
});
