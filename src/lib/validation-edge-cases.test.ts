import { describe, it, expect } from 'vitest';
import { validateMessageInput } from './validation';

describe('API Integration Tests', () => {
  describe('Message Input Validation Edge Cases', () => {
    it('should reject message with only whitespace content', () => {
      const result = validateMessageInput({ channelId: '1', content: '   ' });
      expect(result.valid).toBe(false);
    });

    it('should reject message with newline-only content', () => {
      const result = validateMessageInput({ channelId: '1', content: '\n\n' });
      expect(result.valid).toBe(false);
    });

    it('should reject message with tab-only content', () => {
      const result = validateMessageInput({ channelId: '1', content: '\t\t' });
      expect(result.valid).toBe(false);
    });

    it('should accept message with leading/trailing whitespace that is not just whitespace', () => {
      const result = validateMessageInput({ channelId: '1', content: '  Hello World  ' });
      expect(result.valid).toBe(true);
    });

    it('should reject message with null channelId', () => {
      const result = validateMessageInput({ channelId: null, content: 'test' });
      expect(result.valid).toBe(false);
    });

    it('should reject message with undefined channelId', () => {
      const result = validateMessageInput({ content: 'test' });
      expect(result.valid).toBe(false);
    });

    it('should reject message with non-string channelId', () => {
      const result = validateMessageInput({ channelId: 123, content: 'test' });
      expect(result.valid).toBe(false);
    });

    it('should accept message with exactly 10000 chars', () => {
      const result = validateMessageInput({ channelId: '1', content: 'a'.repeat(10000) });
      expect(result.valid).toBe(true);
    });

    it('should reject message with 10001 chars', () => {
      const result = validateMessageInput({ channelId: '1', content: 'a'.repeat(10001) });
      expect(result.valid).toBe(false);
    });
  });
});
