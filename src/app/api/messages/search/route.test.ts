import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';

// Mock dependencies
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, resetIn: 60000 }),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn().mockReturnValue({ valid: true, user: { id: 'user-1', name: 'Test User' } }),
}));

vi.mock('@/lib/messageStore', () => ({
  searchMessages: vi.fn().mockImplementation((query: string, channelId?: string) => {
    let results = [
      {
        id: '1',
        content: 'Hello team meeting',
        channelId: '1',
        author: { name: 'Vincent', avatar: '👨‍💻' },
        timestamp: new Date('2026-02-27T00:00:00Z'),
      },
      {
        id: '2',
        content: 'Team standup at 10am',
        channelId: '1',
        author: { name: 'Alice', avatar: '👩‍💼' },
        timestamp: new Date('2026-02-27T01:00:00Z'),
      },
      {
        id: '3',
        content: 'Engineering team update',
        channelId: '2',
        author: { name: 'Bob', avatar: '👨‍🔧' },
        timestamp: new Date('2026-02-27T02:00:00Z'),
      },
    ];
    if (channelId) {
      results = results.filter(m => m.channelId === channelId);
    }
    return results;
  }),
}));

describe('GET /api/messages/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return search results for valid query', async () => {
    const request = new Request('http://localhost:3000/api/messages/search?q=team');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(3);
    expect(data.total).toBe(3);
    expect(data.query).toBe('team');
  });

  it('should filter by channel when provided', async () => {
    const request = new Request('http://localhost:3000/api/messages/search?q=team&channelId=1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // All results should be from channel 1
    if (data.messages.length > 0) {
      expect(data.messages.every((m: { channelId: string }) => m.channelId === '1')).toBe(true);
    }
  });

  it('should respect limit parameter', async () => {
    const request = new Request('http://localhost:3000/api/messages/search?q=team&limit=2');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.returned).toBe(2);
    expect(data.messages).toHaveLength(2);
  });

  it('should return 400 if query is missing', async () => {
    const request = new Request('http://localhost:3000/api/messages/search');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Search query (q) is required');
  });

  it('should return 400 if query is empty', async () => {
    const request = new Request('http://localhost:3000/api/messages/search?q=');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Search query (q) is required');
  });

  it('should return 400 if query is only whitespace', async () => {
    const request = new Request('http://localhost:3000/api/messages/search?q=   ');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Search query (q) is required');
  });

  it('should return 401 if not authenticated', async () => {
    // Override the mock for this test
    const { withAuth } = await import('@/lib/jwt-auth');
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });

    const request = new Request('http://localhost:3000/api/messages/search?q=test');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should trim query whitespace', async () => {
    const request = new Request('http://localhost:3000/api/messages/search?q=  team  ');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.query).toBe('team');
  });

  it('should serialize timestamps to ISO strings', async () => {
    const request = new Request('http://localhost:3000/api/messages/search?q=team');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages[0].timestamp).toBe('2026-02-27T00:00:00.000Z');
  });
});
