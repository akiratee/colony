// Auth Me API Route Tests
// GET /api/auth/me - Get current authenticated user

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/lib/jwt-auth';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null, // Default to null (fallback mode)
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
}));

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should return current user from fallback token', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { 
        userId: 'user-123', 
        name: 'Test User',
        email: 'test@example.com',
        avatar: '👤'
      } 
    });

    // No Supabase - use fallback
    const response = await GET(new Request('http://localhost/api/auth/me'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual({
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      avatar: '👤',
    });
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: false, 
      error: 'Invalid token' 
    });

    const response = await GET(new Request('http://localhost/api/auth/me'));
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid token');
  });

  it('should return 401 when no auth payload', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: undefined 
    });

    const response = await GET(new Request('http://localhost/api/auth/me'));
    const data = await response.json();

    expect(response.status).toBe(401);
  });
});
