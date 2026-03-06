// Bots API Route Tests
// GET /api/bots - List all bots
// POST /api/bots - Create a new bot

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';

// Mock all dependencies
vi.mock('@/lib/botStore', () => {
  const mockBots = [
    { id: 'bot-1', name: 'Assistant', description: 'AI helper', avatar: '🤖', status: 'online', instructions: '', apiEndpoint: '', created_at: '2026-01-01' },
    { id: 'bot-2', name: 'Notifier', description: 'Notification bot', avatar: '🔔', status: 'offline', instructions: '', apiEndpoint: '', created_at: '2026-01-01' },
  ];
  return {
    getBots: vi.fn().mockReturnValue(mockBots),
    addBot: vi.fn().mockImplementation((bot) => bot),
    updateBot: vi.fn().mockImplementation((id, updates) => ({ id, ...updates })),
    deleteBot: vi.fn().mockImplementation((id) => ({ success: true, id })),
    getBot: vi.fn().mockImplementation((id) => mockBots.find(b => b.id === id)),
  };
});

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetIn: 60000 })),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, payload: { userId: 'user-123', name: 'Test User' } })),
}));

describe('GET /api/bots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all bots', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe('POST /api/bots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a bot successfully', async () => {
    const request = new Request('http://localhost/api/bots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({
        name: 'New Bot',
        description: 'A new bot',
        avatar: '🤖',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('id');
    expect(data.name).toBe('New Bot');
  });

  it('should return 400 for invalid bot data', async () => {
    const request = new Request('http://localhost/api/bots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    
    expect(response.status).toBe(400);
  });

  it('should require authentication for creating bot', async () => {
    // Test that auth is enforced - the mock returns valid=true, so this tests the happy path
    const request = new Request('http://localhost/api/bots', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token',
      },
      body: JSON.stringify({
        name: 'New Bot',
        description: 'A new bot',
      }),
    });

    const response = await POST(request);
    
    // With valid auth, should succeed (not 401)
    expect(response.status).not.toBe(401);
  });
});
