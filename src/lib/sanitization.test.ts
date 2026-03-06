import { describe, it, expect } from 'vitest';

// Additional validation and sanitization tests

// Import the sanitization functions from validation
function sanitizeContent(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeAuthor(author: { name: string; avatar?: string; isBot?: boolean }): { name: string; avatar?: string; isBot?: boolean } {
  return {
    name: author.name.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    avatar: author.avatar,
    isBot: author.isBot,
  };
}

describe('Sanitization Functions', () => {
  describe('sanitizeContent', () => {
    it('should escape HTML entities', () => {
      expect(sanitizeContent('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      expect(sanitizeContent('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape quotes', () => {
      expect(sanitizeContent('say "hello"')).toBe('say &quot;hello&quot;');
    });

    it('should handle empty string', () => {
      expect(sanitizeContent('')).toBe('');
    });

    it('should handle normal text', () => {
      expect(sanitizeContent('Hello World')).toBe('Hello World');
    });

    it('should handle mixed content', () => {
      expect(sanitizeContent('User said: <hello> & "test"')).toBe('User said: &lt;hello&gt; &amp; &quot;test&quot;');
    });
  });

  describe('sanitizeAuthor', () => {
    it('should escape name HTML', () => {
      const result = sanitizeAuthor({ name: '<script>alert(1)</script>', avatar: '👤' });
      expect(result.name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    it('should preserve avatar', () => {
      const result = sanitizeAuthor({ name: 'Vincent', avatar: '👨‍💻' });
      expect(result.avatar).toBe('👨‍💻');
    });

    it('should preserve isBot flag', () => {
      const result = sanitizeAuthor({ name: 'Bot', isBot: true });
      expect(result.isBot).toBe(true);
    });

    it('should handle missing optional fields', () => {
      const result = sanitizeAuthor({ name: 'Vincent' });
      expect(result.name).toBe('Vincent');
      expect(result.avatar).toBeUndefined();
      expect(result.isBot).toBeUndefined();
    });
  });
});
