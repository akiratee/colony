// Mentions Utilities Tests
import { describe, it, expect } from 'vitest';
import {
  extractMentions,
  hasMention,
  hasAnyMention,
  highlightMentions,
  validateMentions,
  getAllMentions,
} from './mentions';

describe('Mentions Utilities', () => {
  describe('extractMentions', () => {
    it('should extract single mention', () => {
      const result = extractMentions('Hello @john!');
      expect(result).toEqual(['john']);
    });

    it('should extract multiple mentions', () => {
      const result = extractMentions('Hey @alice and @bob, how are you?');
      expect(result).toEqual(['alice', 'bob']);
    });

    it('should return unique mentions only', () => {
      const result = extractMentions('@john said hi to @john');
      expect(result).toEqual(['john']);
    });

    it('should handle usernames with underscores and hyphens', () => {
      const result = extractMentions('Thanks @john_doe and @jane-doe!');
      expect(result).toEqual(['john_doe', 'jane-doe']);
    });

    it('should return empty array for no mentions', () => {
      const result = extractMentions('Hello everyone!');
      expect(result).toEqual([]);
    });

    it('should handle empty string', () => {
      const result = extractMentions('');
      expect(result).toEqual([]);
    });

    it('should handle null/undefined', () => {
      expect(extractMentions(null as unknown as string)).toEqual([]);
      expect(extractMentions(undefined as unknown as string)).toEqual([]);
    });
  });

  describe('hasMention', () => {
    it('should return true when user is mentioned', () => {
      expect(hasMention('Hello @john!', 'john')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(hasMention('Hello @John!', 'john')).toBe(true);
      expect(hasMention('Hello @JOHN!', 'john')).toBe(true);
    });

    it('should return false when user is not mentioned', () => {
      expect(hasMention('Hello @alice!', 'bob')).toBe(false);
    });
  });

  describe('hasAnyMention', () => {
    it('should return true when message has mentions', () => {
      expect(hasAnyMention('Hello @john!')).toBe(true);
    });

    it('should return false when message has no mentions', () => {
      expect(hasAnyMention('Hello everyone!')).toBe(false);
    });
  });

  describe('highlightMentions', () => {
    it('should wrap mentions in span tags', () => {
      const result = highlightMentions('Hello @john!');
      expect(result).toBe('Hello <span class="mention">@john</span>!');
    });

    it('should handle multiple mentions', () => {
      const result = highlightMentions('Hey @alice and @bob');
      expect(result).toBe('Hey <span class="mention">@alice</span> and <span class="mention">@bob</span>');
    });

    it('should handle empty string', () => {
      const result = highlightMentions('');
      expect(result).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(highlightMentions(null as unknown as string)).toBe(null);
      expect(highlightMentions(undefined as unknown as string)).toBe(undefined);
    });
  });

  describe('validateMentions', () => {
    it('should validate mentions within limit', () => {
      const result = validateMentions('Hey @user1 @user2 @user3');
      expect(result.valid).toBe(true);
    });

    it('should reject too many mentions', () => {
      const content = Array.from({ length: 11 }, (_, i) => `@user${i}`).join(' ');
      const result = validateMentions(content);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Too many mentions (max 10)');
    });
  });

  describe('getAllMentions', () => {
    it('should extract unique mentions from multiple messages', () => {
      const contents = ['Hello @alice and @bob', '@charlie said hi to @alice'];
      const result = getAllMentions(contents);
      expect(result).toContain('alice');
      expect(result).toContain('bob');
      expect(result).toContain('charlie');
      expect(result.length).toBe(3);
    });

    it('should return empty array for empty input', () => {
      const result = getAllMentions([]);
      expect(result).toEqual([]);
    });
  });
});
