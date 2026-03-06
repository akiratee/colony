// Rate Limiting Middleware
// Simple in-memory rate limiter for API routes

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean every minute

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export function rateLimit(key: string, options: RateLimitOptions): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  
  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs
    });
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetIn: options.windowMs
    };
  }
  
  if (entry.count >= options.maxRequests) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now
    };
  }
  
  // Increment count
  entry.count++;
  
  return {
    allowed: true,
    remaining: options.maxRequests - entry.count,
    resetIn: entry.resetTime - now
  };
}

// Pre-configured rate limiters
export const apiRateLimiter = {
  // Strict: 10 requests per minute (for write operations)
  strict: (key: string) => rateLimit(key, { windowMs: 60000, maxRequests: 10 }),
  
  // Moderate: 60 requests per minute (for read operations)
  moderate: (key: string) => rateLimit(key, { windowMs: 60000, maxRequests: 60 }),
  
  // lenient: 200 requests per minute (for bulk operations)
  lenient: (key: string) => rateLimit(key, { windowMs: 60000, maxRequests: 200 }),
};
