// Auth Logout API Tests
// POST /api/auth/logout

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

// Mock dependencies
vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
  extractTokenFromHeader: vi.fn(),
  invalidateToken: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, resetIn: 0 }),
}));

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if no authorization header', async () => {
    const { withAuth } = await import('@/lib/jwt-auth');
    vi.mocked(withAuth).mockReturnValue({
      valid: false,
      error: 'No authorization header',
    });

    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('No authorization header');
  });

  it('should return 401 if token is invalid', async () => {
    const { withAuth } = await import('@/lib/jwt-auth');
    vi.mocked(withAuth).mockReturnValue({
      valid: false,
      error: 'Invalid token',
    });

    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer invalid-token' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid token');
  });

  it('should return 401 if token is expired', async () => {
    const { withAuth } = await import('@/lib/jwt-auth');
    vi.mocked(withAuth).mockReturnValue({
      valid: false,
      error: 'Token expired',
    });

    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer expired-token' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Token expired');
  });

  it('should return 200 and invalidate token on successful logout', async () => {
    const { withAuth, extractTokenFromHeader, invalidateToken } = await import('@/lib/jwt-auth');
    
    vi.mocked(withAuth).mockReturnValue({
      valid: true,
      payload: {
        userId: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
      },
    });
    vi.mocked(extractTokenFromHeader).mockReturnValue('valid-token');
    vi.mocked(invalidateToken).mockReturnValue(undefined);

    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-token' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logged out successfully');
    expect(invalidateToken).toHaveBeenCalledWith('valid-token');
  });

  it('should handle logout without token in header gracefully', async () => {
    const { withAuth, extractTokenFromHeader, invalidateToken } = await import('@/lib/jwt-auth');
    
    vi.mocked(withAuth).mockReturnValue({
      valid: true,
      payload: {
        userId: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
      },
    });
    vi.mocked(extractTokenFromHeader).mockReturnValue(null);
    vi.mocked(invalidateToken).mockReturnValue(undefined);

    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Logged out successfully');
    // invalidateToken should not be called if no token
    expect(invalidateToken).not.toHaveBeenCalled();
  });

  it('should include user info in console log on successful logout', async () => {
    const { withAuth, extractTokenFromHeader, invalidateToken } = await import('@/lib/jwt-auth');
    const consoleSpy = vi.spyOn(console, 'log');
    
    vi.mocked(withAuth).mockReturnValue({
      valid: true,
      payload: {
        userId: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
      },
    });
    vi.mocked(extractTokenFromHeader).mockReturnValue('valid-token');
    vi.mocked(invalidateToken).mockReturnValue(undefined);

    const request = new Request('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer valid-token' },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('User logged out:')
    );
  });
});
