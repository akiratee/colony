// ID generation tests
import { describe, it, expect } from 'vitest';

import { generateId, generateShortId } from './id';

describe('ID Generation', () => {
  describe('generateId', () => {
    it('should generate a valid UUID', () => {
      const id = generateId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should return a string', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });

    it('should generate ID with correct version number (4)', () => {
      const id = generateId();
      // Position 14 should be '4' for version 4
      expect(id.charAt(14)).toBe('4');
    });
  });

  describe('generateShortId', () => {
    it('should generate a short ID with timestamp', () => {
      const id = generateShortId();
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });

    it('should generate unique short IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateShortId());
      }
      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should return a string', () => {
      const id = generateShortId();
      expect(typeof id).toBe('string');
    });

    it('should include current timestamp', () => {
      const before = Date.now();
      const id = generateShortId();
      const after = Date.now();
      
      const timestamp = parseInt(id.split('-')[0], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
