import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from './route';
import { pinMessage, unpinMessage, getPinnedMessages, getMessage } from '@/lib/messageStore';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';

// Mock dependencies
vi.mock('@/lib/messageStore', () => ({
  pinMessage: vi.fn(),
  unpinMessage: vi.fn(),
  getPinnedMessages: vi.fn(),
  getMessage: vi.fn(),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, payload: { userId: 'user-123', userName: 'TestUser' } })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

// Mock fetch for socket broadcast
global.fetch = vi.fn();

describe('POST /api/messages/pin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pin a message', async () => {
    const existingMessage = { id: 'msg-123', content: 'Hello', channelId: 'channel-1' };
    vi.mocked(getMessage).mockReturnValue(existingMessage as any);
    
    const pinnedMessage = { 
      id: 'msg-123', 
      content: 'Hello', 
      channelId: 'channel-1',
      pinnedAt: new Date('2026-02-27T01:00:00Z'),
      timestamp: new Date(),
    };
    vi.mocked(pinMessage).mockReturnValue(pinnedMessage as any);

    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-123', action: 'pin' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(pinMessage).toHaveBeenCalledWith('msg-123');
  });

  it('should unpin a message', async () => {
    const existingMessage = { id: 'msg-123', content: 'Hello', channelId: 'channel-1' };
    vi.mocked(getMessage).mockReturnValue(existingMessage as any);
    
    const unpinnedMessage = { 
      id: 'msg-123', 
      content: 'Hello', 
      channelId: 'channel-1',
      pinnedAt: null,
      timestamp: new Date(),
    };
    vi.mocked(unpinMessage).mockReturnValue(unpinnedMessage as any);

    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-123', action: 'unpin' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(unpinMessage).toHaveBeenCalledWith('msg-123');
  });

  it('should return 400 if id is missing', async () => {
    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pin' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Message ID is required');
  });

  it('should return 400 if action is missing', async () => {
    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Action is required (must be "pin" or "unpin")');
  });

  it('should return 400 if action is invalid', async () => {
    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-123', action: 'invalid' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Action is required (must be "pin" or "unpin")');
  });

  it('should return 404 if message not found', async () => {
    vi.mocked(getMessage).mockReturnValue(undefined);

    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'nonexistent', action: 'pin' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Message not found');
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });

    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-123', action: 'pin' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 if rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new Request('http://localhost/api/messages/pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-123', action: 'pin' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
  });
});

describe('GET /api/messages/pin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get pinned messages for a channel', async () => {
    const pinnedMessages = [
      { id: 'msg-1', content: 'Hello', pinnedAt: new Date('2026-02-27T01:00:00Z'), timestamp: new Date() },
      { id: 'msg-2', content: 'World', pinnedAt: new Date('2026-02-27T00:30:00Z'), timestamp: new Date() },
    ];
    vi.mocked(getPinnedMessages).mockReturnValue(pinnedMessages as any);

    const request = new Request('http://localhost/api/messages/pin?channelId=channel-1');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pinned).toHaveLength(2);
    expect(getPinnedMessages).toHaveBeenCalledWith('channel-1');
  });

  it('should get all pinned messages when no channelId provided', async () => {
    const pinnedMessages = [
      { id: 'msg-1', content: 'Hello', pinnedAt: new Date('2026-02-27T01:00:00Z'), timestamp: new Date() },
    ];
    vi.mocked(getPinnedMessages).mockReturnValue(pinnedMessages as any);

    const request = new Request('http://localhost/api/messages/pin');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pinned).toHaveLength(1);
    expect(getPinnedMessages).toHaveBeenCalledWith(undefined);
  });

  it('should handle empty pinned messages', async () => {
    vi.mocked(getPinnedMessages).mockReturnValue([]);

    const request = new Request('http://localhost/api/messages/pin?channelId=channel-1');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pinned).toEqual([]);
  });

  it('should serialize timestamps to ISO strings', async () => {
    const testDate = new Date('2026-02-27T01:00:00Z');
    const pinnedMessages = [
      { id: 'msg-1', content: 'Hello', pinnedAt: testDate, timestamp: testDate, editedAt: testDate },
    ];
    vi.mocked(getPinnedMessages).mockReturnValue(pinnedMessages as any);

    const request = new Request('http://localhost/api/messages/pin');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pinned[0].pinnedAt).toBe('2026-02-27T01:00:00.000Z');
    expect(data.pinned[0].timestamp).toBe('2026-02-27T01:00:00.000Z');
    expect(data.pinned[0].editedAt).toBe('2026-02-27T01:00:00.000Z');
  });
});
