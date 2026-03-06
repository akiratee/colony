// User Preferences API Route Tests
// GET /api/users/me/preferences - Get user preferences
// PATCH /api/users/me/preferences - Update user preferences

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from './route';
import { getUserPreferences, updateUserPreferences } from '@/lib/user-preferences';
import type { UserPreferences } from '@/lib/user-preferences';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';

// Mock dependencies
vi.mock('@/lib/user-preferences', () => ({
  getUserPreferences: vi.fn(),
  updateUserPreferences: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 20, resetIn: 60000 })),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((): { valid: boolean; payload?: Record<string, unknown>; error?: string } => ({ 
    valid: true, 
    payload: { userId: 'user-123', name: 'Test User', email: 'test@example.com', avatar: '' } 
  })),
}));

describe('GET /api/users/me/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user preferences', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User', email: 'test@example.com', avatar: '' } 
    });

    const mockPrefs: UserPreferences = {
      userId: 'user-123',
      theme: 'dark',
      notificationLevel: 'all',
      messagePreview: true,
      soundEnabled: false,
      timezone: 'America/Los_Angeles',
      language: 'en',
      channelNotifications: {},
      updatedAt: new Date('2026-02-27T10:00:00Z'),
    };
    vi.mocked(getUserPreferences).mockReturnValue(mockPrefs);

    const response = await GET(new Request('http://localhost/api/users/me/preferences'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.preferences.theme).toBe('dark');
    expect(data.preferences.notificationLevel).toBe('all');
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: false, 
      error: 'Unauthorized' 
    });

    const response = await GET(new Request('http://localhost/api/users/me/preferences'));

    expect(response.status).toBe(401);
  });

  it('should return 401 when no auth payload', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: undefined 
    });

    const response = await GET(new Request('http://localhost/api/users/me/preferences'));

    expect(response.status).toBe(401);
  });
});

describe('PATCH /api/users/me/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update preferences successfully', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User', email: 'test@example.com', avatar: '' } 
    });
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 20, resetIn: 60000 });

    const updatedPrefs = {
      theme: 'light',
      notificationLevel: 'mentions',
      messagePreview: true,
      soundEnabled: true,
      timezone: 'America/New_York',
      language: 'es',
      channelNotifications: {},
      updatedAt: new Date(),
    };
    vi.mocked(updateUserPreferences).mockReturnValue(updatedPrefs as UserPreferences);

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'light', notificationLevel: 'mentions' }),
    }));

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('Preferences updated successfully');
    expect(data.preferences.theme).toBe('light');
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: false, 
      error: 'Unauthorized' 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'light' }),
    }));

    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid theme', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'invalid-theme' }),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Theme');
  });

  it('should return 400 for invalid notificationLevel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationLevel: 'invalid' }),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('notificationLevel');
  });

  it('should return 400 for non-boolean messagePreview', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messagePreview: 'yes' }),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('messagePreview');
  });

  it('should return 400 for non-boolean soundEnabled', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ soundEnabled: 1 }),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('soundEnabled');
  });

  it('should return 400 for timezone too long', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone: 'a'.repeat(101) }),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('timezone');
  });

  it('should return 400 for invalid language code', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'invalidlang' }),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('language');
  });

  it('should accept valid language codes', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User', email: 'test@example.com', avatar: '' } 
    });
    vi.mocked(updateUserPreferences).mockReturnValue({
      userId: 'user-123',
      theme: 'dark',
      notificationLevel: 'all',
      messagePreview: true,
      soundEnabled: true,
      timezone: 'UTC',
      language: 'es',
      channelNotifications: {},
      updatedAt: new Date(),
    } as UserPreferences);

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'es' }),
    }));

    expect(response.status).toBe(200);
  });

  it('should accept en-US format language codes', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User', email: 'test@example.com', avatar: '' } 
    });
    vi.mocked(updateUserPreferences).mockReturnValue({
      userId: 'user-123',
      theme: 'dark',
      notificationLevel: 'all',
      messagePreview: true,
      soundEnabled: true,
      timezone: 'UTC',
      language: 'en-US',
      channelNotifications: {},
      updatedAt: new Date(),
    } as UserPreferences);

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'en-US' }),
    }));

    expect(response.status).toBe(200);
  });

  it('should handle channel-specific notifications', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User', email: 'test@example.com', avatar: '' } 
    });
    vi.mocked(updateUserPreferences).mockReturnValue({
      userId: 'user-123',
      theme: 'dark',
      notificationLevel: 'all',
      messagePreview: true,
      soundEnabled: true,
      timezone: 'UTC',
      language: 'en',
      channelNotifications: { 'general': 'mentions', 'alerts': 'none' },
      updatedAt: new Date(),
    } as UserPreferences);

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        channelNotifications: { 'general': 'mentions', 'alerts': 'none' } 
      }),
    }));

    expect(response.status).toBe(200);
  });

  it('should return 400 for invalid channel notification level', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        channelNotifications: { 'general': 'invalid' } 
      }),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('Invalid notification level');
  });

  it('should return 400 when no valid fields to update', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('No valid preference');
  });

  it('should return 429 for rate limiting', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User', email: 'test@example.com', avatar: '' } 
    });
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60000 });

    const response = await PATCH(new Request('http://localhost/api/users/me/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'light' }),
    }));

    expect(response.status).toBe(429);
  });
});
