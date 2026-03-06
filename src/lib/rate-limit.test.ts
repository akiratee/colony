import { describe, it, expect } from 'vitest';
import { rateLimit, apiRateLimiter } from './rate-limit';

describe('rateLimit', () => {
  it('should allow first request', () => {
    const result = rateLimit('first-request-' + Math.random(), { windowMs: 60000, maxRequests: 5 });
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should allow second request', () => {
    const key = 'second-request-' + Math.random();
    rateLimit(key, { windowMs: 60000, maxRequests: 5 });
    
    const result = rateLimit(key, { windowMs: 60000, maxRequests: 5 });
    
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('should block requests when limit exceeded', () => {
    const key = 'block-test-' + Math.random();
    
    // Make 5 requests (limit is 5)
    for (let i = 0; i < 5; i++) {
      rateLimit(key, { windowMs: 60000, maxRequests: 5 });
    }
    
    // 6th request should be blocked
    const result = rateLimit(key, { windowMs: 60000, maxRequests: 5 });
    
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should return positive reset time', () => {
    const result = rateLimit('reset-time-' + Math.random(), { windowMs: 60000, maxRequests: 5 });
    
    expect(result.resetIn).toBeGreaterThan(0);
    expect(result.resetIn).toBeLessThanOrEqual(60000);
  });
});

describe('apiRateLimiter', () => {
  it('should have strict limiter with 10 requests', () => {
    const result = apiRateLimiter.strict('strict-' + Math.random());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('should have moderate limiter with 60 requests', () => {
    const result = apiRateLimiter.moderate('moderate-' + Math.random());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it('should have lenient limiter with 200 requests', () => {
    const result = apiRateLimiter.lenient('lenient-' + Math.random());
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(199);
  });
});
