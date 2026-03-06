import { describe, it, expect, beforeEach } from 'vitest';
import { validateChannelInput, validateBotInput, sanitizeChannelName, generateId } from './validation';

describe('Channel Validation', () => {
  describe('validateChannelInput', () => {
    it('should accept valid channel input', () => {
      const result = validateChannelInput({ name: 'general', description: 'General chat' });
      expect(result.valid).toBe(true);
    });

    it('should reject empty channel name', () => {
      const result = validateChannelInput({ name: '' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject channel name with uppercase', () => {
      const result = validateChannelInput({ name: 'General' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should reject channel name with special characters', () => {
      const result = validateChannelInput({ name: 'general!' });
      expect(result.valid).toBe(false);
    });

    it('should reject channel name over 50 chars', () => {
      const result = validateChannelInput({ name: 'a'.repeat(51) });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject description over 500 chars', () => {
      const result = validateChannelInput({ name: 'test', description: 'a'.repeat(501) });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Description');
    });

    it('should accept valid hyphenated channel names', () => {
      const result = validateChannelInput({ name: 'project-colony' });
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeChannelName', () => {
    it('should convert to lowercase', () => {
      expect(sanitizeChannelName('GENERAL')).toBe('general');
    });

    it('should replace spaces with hyphens', () => {
      expect(sanitizeChannelName('general chat')).toBe('general-chat');
    });

    it('should truncate at 50 chars', () => {
      expect(sanitizeChannelName('a'.repeat(60)).length).toBe(50);
    });
  });
});

describe('Bot Validation', () => {
  describe('validateBotInput', () => {
    it('should accept valid bot input', () => {
      const result = validateBotInput({ name: 'Test Bot', description: 'Runs tests' });
      expect(result.valid).toBe(true);
    });

    it('should reject empty bot name', () => {
      const result = validateBotInput({ name: '' });
      expect(result.valid).toBe(false);
    });

    it('should reject bot name over 50 chars', () => {
      const result = validateBotInput({ name: 'a'.repeat(51) });
      expect(result.valid).toBe(false);
    });

    it('should reject description over 500 chars', () => {
      const result = validateBotInput({ name: 'Bot', description: 'a'.repeat(501) });
      expect(result.valid).toBe(false);
    });
  });
});

describe('ID Generation', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });

    it('should generate valid UUIDs', () => {
      const id = generateId();
      // UUID format: 8-4-4-4-12 hex digits
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });
});
