// Message Format Utilities Tests
import { describe, it, expect } from 'vitest';
import {
  extractUrls,
  extractEmails,
  linkify,
  parseMarkdown,
  formatMessage,
  stripFormatting,
  validateFormattedMessage,
} from './message-format';

describe('Message Format Utilities', () => {
  describe('extractUrls', () => {
    it('should extract URLs from text', () => {
      const result = extractUrls('Check out https://example.com');
      expect(result).toEqual(['https://example.com']);
    });

    it('should extract multiple URLs', () => {
      const result = extractUrls('Visit https://foo.com and http://bar.com');
      expect(result).toEqual(['https://foo.com', 'http://bar.com']);
    });

    it('should return unique URLs', () => {
      const result = extractUrls('Check https://example.com and https://example.com');
      expect(result).toEqual(['https://example.com']);
    });

    it('should return empty array for no URLs', () => {
      const result = extractUrls('Hello world');
      expect(result).toEqual([]);
    });
  });

  describe('extractEmails', () => {
    it('should extract emails from text', () => {
      const result = extractEmails('Contact test@example.com');
      expect(result).toEqual(['test@example.com']);
    });

    it('should extract multiple emails', () => {
      const result = extractEmails('Email foo@bar.com and baz@qux.com');
      expect(result).toEqual(['foo@bar.com', 'baz@qux.com']);
    });

    it('should return empty array for no emails', () => {
      const result = extractEmails('Hello world');
      expect(result).toEqual([]);
    });
  });

  describe('linkify', () => {
    it('should convert URLs to clickable links', () => {
      const result = linkify('Visit https://example.com');
      expect(result).toContain('<a href="https://example.com"');
    });

    it('should convert emails to mailto links', () => {
      const result = linkify('Email test@example.com');
      expect(result).toContain('<a href="mailto:test@example.com"');
    });

    it('should escape HTML', () => {
      const result = linkify('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should handle empty string', () => {
      const result = linkify('');
      expect(result).toBe('');
    });
  });

  describe('parseMarkdown', () => {
    it('should parse bold text', () => {
      const result = parseMarkdown('This is **bold** text');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('should parse italic text', () => {
      const result = parseMarkdown('This is *italic* text');
      expect(result).toContain('<em>italic</em>');
    });

    it('should parse strikethrough', () => {
      const result = parseMarkdown('This is ~~strikethrough~~');
      expect(result).toContain('<del>strikethrough</del>');
    });

    it('should parse inline code', () => {
      const result = parseMarkdown('Use `const x = 1`');
      expect(result).toContain('<code class="message-inline-code">const x = 1</code>');
    });

    it('should parse code blocks', () => {
      const result = parseMarkdown('```\nconsole.log("test")\n```');
      expect(result).toContain('<pre class="message-code-block">');
    });

    it('should convert newlines to br', () => {
      const result = parseMarkdown('Line 1\nLine 2');
      expect(result).toContain('<br>');
    });

    it('should escape HTML', () => {
      const result = parseMarkdown('<script>alert("xss")</script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should handle empty string', () => {
      const result = parseMarkdown('');
      expect(result).toBe('');
    });
  });

  describe('formatMessage', () => {
    it('should apply markdown by default', () => {
      const result = formatMessage('This is **bold**');
      expect(result).toContain('<strong>bold</strong>');
    });

    it('should disable markdown when specified', () => {
      const result = formatMessage('This is **bold**', false);
      expect(result).not.toContain('<strong>');
    });

    it('should handle empty string', () => {
      const result = formatMessage('');
      expect(result).toBe('');
    });
  });

  describe('stripFormatting', () => {
    it('should remove bold markers', () => {
      const result = stripFormatting('This is **bold**');
      expect(result).toBe('This is bold');
    });

    it('should remove italic markers', () => {
      const result = stripFormatting('This is *italic*');
      expect(result).toBe('This is italic');
    });

    it('should remove code blocks', () => {
      const result = stripFormatting('```\ncode\n```');
      expect(result).toBe('code');
    });

    it('should remove HTML tags', () => {
      const result = stripFormatting('<strong>bold</strong>');
      expect(result).toBe('bold');
    });

    it('should decode HTML entities', () => {
      const result = stripFormatting('&lt;script&gt;');
      expect(result).toBe('<script>');
    });

    it('should handle empty string', () => {
      const result = stripFormatting('');
      expect(result).toBe('');
    });
  });

  describe('validateFormattedMessage', () => {
    it('should validate message within length', () => {
      const result = validateFormattedMessage('Short message');
      expect(result).toBe(true);
    });

    it('should reject message over default limit', () => {
      const longMessage = 'a'.repeat(10001);
      const result = validateFormattedMessage(longMessage);
      expect(result).toBe(false);
    });

    it('should use custom max length', () => {
      const message = 'a'.repeat(101);
      const result = validateFormattedMessage(message, 100);
      expect(result).toBe(false);
    });

    it('should count stripped length for validation', () => {
      // Bold markers add 4 chars each, so "**a**" becomes "a" (2 chars stripped)
      const message = '**' + 'a'.repeat(9998) + '**';
      const result = validateFormattedMessage(message, 10000);
      expect(result).toBe(true);
    });
  });
});
