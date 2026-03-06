import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from './route';
import { markMessageSeen, markChannelSeen, getMessage } from '@/lib/messageStore';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';

// Mock dependencies
vi.mock('@/lib/messageStore', () => ({
  markMessageSeen: vi.fn(),
  markChannelSeen: vi.fn(),
  getMessage: vi.fn(),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, user: { userId: 'user-123', userName: 'TestUser' } })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

describe('POST /api/messages/seen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should mark a single message as seen', async () => {
    const mockMessage = { id: 'msg-123', content: 'Hello', seenBy: ['TestUser'] };
    vi.mocked(markMessageSeen).mockReturnValue(mockMessage as any);

    const request = new Request('http://localhost/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(markMessageSeen).toHaveBeenCalledWith('msg-123', 'TestUser');
  });

  it('should mark all messages in a channel as seen', async () => {
    vi.mocked(markChannelSeen).mockReturnValue(5);

    const request = new Request('http://localhost/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: 'channel-123', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.markedCount).toBe(5);
    expect(markChannelSeen).toHaveBeenCalledWith('channel-123', 'TestUser');
  });

  it('should return 400 if neither messageId nor channelId provided', async () => {
    const request = new Request('http://localhost/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Either messageId or channelId is required');
  });

  it('should return 400 if userName is missing', async () => {
    const request = new Request('http://localhost/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('userName is required');
  });

  it('should return 404 if message not found for single message', async () => {
    vi.mocked(markMessageSeen).mockReturnValue(null);

    const request = new Request('http://localhost/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'nonexistent', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Message not found');
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });

    const request = new Request('http://localhost/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 if rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new Request('http://localhost/api/messages/seen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', userName: 'TestUser' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
  });
});

describe('GET /api/messages/seen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get who has seen a message', async () => {
    const mockMessage = { id: 'msg-123', seenBy: ['User1', 'User2'] };
    vi.mocked(getMessage).mockReturnValue(mockMessage as any);

    const request = new Request('http://localhost/api/messages/seen?messageId=msg-123');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messageId).toBe('msg-123');
    expect(data.seenBy).toEqual(['User1', 'User2']);
    expect(data.seenCount).toBe(2);
  });

  it('should return 400 if messageId is missing', async () => {
    const request = new Request('http://localhost/api/messages/seen');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('messageId query parameter is required');
  });

  it('should return 404 if message not found', async () => {
    vi.mocked(getMessage).mockReturnValue(undefined);

    const request = new Request('http://localhost/api/messages/seen?messageId=nonexistent');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Message not found');
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });

    const request = new Request('http://localhost/api/messages/seen?messageId=msg-123');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should handle empty seenBy array', async () => {
    const mockMessage = { id: 'msg-123', seenBy: [] };
    vi.mocked(getMessage).mockReturnValue(mockMessage as any);

    const request = new Request('http://localhost/api/messages/seen?messageId=msg-123');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.seenBy).toEqual([]);
    expect(data.seenCount).toBe(0);
  });
});
