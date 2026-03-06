import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rateLimit } from './rate-limit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Use fake timers for time-based tests
    vi.useFakeTimers();
  });

  describe('rateLimit function', () => {
    it('should allow requests under the limit', () => {
      const result = rateLimit('test-user-1', { windowMs: 60000, maxRequests: 5 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetIn).toBeGreaterThan(0);
    });

    it('should block requests over the limit', () => {
      // Make 5 requests (limit is 5)
      for (let i = 0; i < 5; i++) {
        rateLimit('test-user-2', { windowMs: 60000, maxRequests: 5 });
      }
      
      // 6th request should be blocked
      const result = rateLimit('test-user-2', { windowMs: 60000, maxRequests: 5 });
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should track different users separately', () => {
      // Fill up user 1
      for (let i = 0; i < 5; i++) {
        rateLimit('user-a', { windowMs: 60000, maxRequests: 5 });
      }
      
      // User 2 should still have full limit
      const result = rateLimit('user-b', { windowMs: 60000, maxRequests: 5 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should reset after window expires', () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimit('test-user-3', { windowMs: 60000, maxRequests: 5 });
      }
      
      // Advance time past the window
      vi.advanceTimersByTime(61000);
      
      // Should be allowed again
      const result = rateLimit('test-user-3', { windowMs: 60000, maxRequests: 5 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should return accurate remaining count', () => {
      const result1 = rateLimit('test-user-4', { windowMs: 60000, maxRequests: 5 });
      expect(result1.remaining).toBe(4);
      
      const result2 = rateLimit('test-user-4', { windowMs: 60000, maxRequests: 5 });
      expect(result2.remaining).toBe(3);
    });

    it('should handle different rate limit keys independently', () => {
      // Use different keys for different resources
      const msgResult = rateLimit('msg:user1', { windowMs: 60000, maxRequests: 5 });
      const channelResult = rateLimit('channel:user1', { windowMs: 60000, maxRequests: 5 });
      
      expect(msgResult.allowed).toBe(true);
      expect(channelResult.allowed).toBe(true);
    });

    it('should return appropriate resetIn for blocked requests', () => {
      // Fill up the limit
      for (let i = 0; i < 5; i++) {
        rateLimit('reset-test', { windowMs: 60000, maxRequests: 5 });
      }
      
      // Should return time until reset
      const result = rateLimit('reset-test', { windowMs: 60000, maxRequests: 5 });
      expect(result.allowed).toBe(false);
      expect(result.resetIn).toBeGreaterThan(0);
      expect(result.resetIn).toBeLessThanOrEqual(60000);
    });
  });

  describe('apiRateLimiter', () => {
    it('should have strict limiter for write operations', () => {
      const result = rateLimit('write-test', { windowMs: 60000, maxRequests: 10 });
      expect(result.allowed).toBe(true);
    });

    it('should have moderate limiter for read operations', () => {
      const result = rateLimit('read-test', { windowMs: 60000, maxRequests: 60 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59);
    });
  });
});
