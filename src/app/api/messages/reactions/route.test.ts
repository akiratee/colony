import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET } from './route';
import { addReaction, getMessage } from '@/lib/messageStore';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';

// Mock dependencies
vi.mock('@/lib/messageStore', () => ({
  addReaction: vi.fn(),
  getMessage: vi.fn(),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, payload: { userId: 'user-123', userName: 'TestUser' } })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

describe('POST /api/messages/reactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add a reaction to a message', async () => {
    const existingMessage = { 
      id: 'msg-123', 
      content: 'Hello', 
      channelId: 'channel-1',
      reactions: [{ emoji: '👍', users: ['User1'] }]
    };
    vi.mocked(getMessage).mockReturnValue(existingMessage as any);
    
    const updatedMessage = { 
      id: 'msg-123', 
      content: 'Hello', 
      channelId: 'channel-1',
      reactions: [
        { emoji: '👍', users: ['User1', 'TestUser'] },
        { emoji: '❤️', users: ['TestUser'] }
      ]
    };
    vi.mocked(addReaction).mockReturnValue(updatedMessage as any);

    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', emoji: '❤️', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.messageId).toBe('msg-123');
    expect(addReaction).toHaveBeenCalledWith('msg-123', '❤️', 'TestUser');
  });

  it('should reject unauthenticated requests', async () => {
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });

    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', emoji: '👍', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should reject missing messageId', async () => {
    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji: '👍', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('messageId is required');
  });

  it('should reject missing emoji', async () => {
    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('emoji is required');
  });

  it('should reject missing userName', async () => {
    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', emoji: '👍' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('userName is required');
  });

  it('should reject invalid emoji length', async () => {
    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', emoji: 'a'.repeat(11), userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('emoji must be 1-10 characters');
  });

  it('should return 404 for non-existent message', async () => {
    vi.mocked(getMessage).mockReturnValue(undefined);

    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'non-existent', emoji: '👍', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Message not found');
  });

  it('should rate limit when limit exceeded', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', emoji: '👍', userName: 'TestUser' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
  });

  it('should reject invalid JSON body', async () => {
    const request = new Request('http://localhost/api/messages/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid JSON body');
  });
});

describe('GET /api/messages/reactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should get reactions for a message', async () => {
    const existingMessage = { 
      id: 'msg-123', 
      content: 'Hello', 
      reactions: [{ emoji: '👍', users: ['User1', 'User2'] }, { emoji: '❤️', users: ['User1'] }]
    };
    vi.mocked(getMessage).mockReturnValue(existingMessage as any);

    const request = new Request('http://localhost/api/messages/reactions?messageId=msg-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messageId).toBe('msg-123');
    expect(data.reactions).toHaveLength(2);
  });

  it('should return empty reactions array for message with no reactions', async () => {
    const existingMessage = { id: 'msg-123', content: 'Hello', reactions: [] };
    vi.mocked(getMessage).mockReturnValue(existingMessage as any);

    const request = new Request('http://localhost/api/messages/reactions?messageId=msg-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reactions).toEqual([]);
  });

  it('should reject missing messageId query param', async () => {
    const request = new Request('http://localhost/api/messages/reactions');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('messageId query parameter is required');
  });

  it('should return 404 for non-existent message', async () => {
    vi.mocked(getMessage).mockReturnValue(undefined);

    const request = new Request('http://localhost/api/messages/reactions?messageId=non-existent');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Message not found');
  });
});
