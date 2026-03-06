import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST, PATCH, DELETE } from './route';

// Mock dependencies at module level
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetIn: 60000 })),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, user: { id: 'user-123', name: 'Test User' } })),
}));

vi.mock('@/lib/messageStore', () => ({
  addMessage: vi.fn((channelId, content, author) => ({ 
    id: 'msg-new-123', 
    channelId, 
    content, 
    author,
    timestamp: new Date().toISOString() 
  })),
  editMessage: vi.fn((id, content) => ({ id, content, editedAt: new Date().toISOString(), channelId: 'channel-1' })),
  deleteMessage: vi.fn(() => ({ id: 'msg-1', channelId: 'channel-1' })),
  getMessages: vi.fn(() => [
    { id: 'msg-1', content: 'Hello', channelId: 'channel-1', author: { id: 'user-1', name: 'User1' }, timestamp: '2026-02-27T10:00:00.000Z' },
    { id: 'msg-2', content: 'World', channelId: 'channel-1', author: { id: 'user-2', name: 'User2' }, timestamp: '2026-02-27T10:01:00.000Z' },
  ]),
  getMessageCount: vi.fn(() => 2),
  getMessage: vi.fn((id) => (id === 'msg-1' ? { id: 'msg-1', content: 'Hello', channelId: 'channel-1', author: { id: 'user-1', name: 'User1' } } : null)),
}));

vi.mock('@/lib/validation', () => ({
  validateMessageInput: vi.fn(() => ({ valid: true })),
  sanitizeContent: vi.fn((content) => content),
}));

vi.mock('@/lib/whatsapp-outbound', () => ({
  sendColonyMessageToWhatsApp: vi.fn().mockResolvedValue(undefined),
  syncDeleteToWhatsApp: vi.fn().mockResolvedValue(undefined),
  syncEditToWhatsApp: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/channelStore', () => ({
  getChannel: vi.fn((id) => (id === 'channel-1' ? { id: 'channel-1', name: 'general' } : null)),
}));

describe('Messages API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return messages for a channel', async () => {
    const request = new Request('http://localhost:3000/api/messages?channelId=channel-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);
    expect(data.total).toBe(2);
  });

  it('should apply limit parameter', async () => {
    const request = new Request('http://localhost:3000/api/messages?channelId=channel-1&limit=1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.limit).toBe(1);
  });

  it('should apply offset parameter', async () => {
    const request = new Request('http://localhost:3000/api/messages?channelId=channel-1&offset=1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.offset).toBe(1);
  });

  it('should cap limit at 100', async () => {
    const request = new Request('http://localhost:3000/api/messages?channelId=channel-1&limit=200');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.limit).toBe(100);
  });

  it('should require authentication', async () => {
    const { withAuth } = await import('@/lib/jwt-auth');
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });
    
    const request = new Request('http://localhost:3000/api/messages?channelId=channel-1');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});

describe('Messages API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject missing author object', async () => {
    const request = new Request('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Hello',
        channelId: 'channel-1',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should reject missing author name', async () => {
    const request = new Request('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Hello',
        channelId: 'channel-1',
        author: { id: 'user-1' },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should rate limit requests', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    
    const request = new Request('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'Hello',
        channelId: 'channel-1',
        author: { id: 'user-1', name: 'Test User' },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
  });

  it('should handle invalid JSON', async () => {
    const request = new Request('http://localhost:3000/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-valid-json',
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe('Messages API - PATCH', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject patch without message id', async () => {
    const request = new Request('http://localhost:3000/api/messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Updated content' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
  });

  it('should reject patch without content', async () => {
    const request = new Request('http://localhost:3000/api/messages?id=msg-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-1' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
  });

  it('should reject patch without authorName', async () => {
    const request = new Request('http://localhost:3000/api/messages?id=msg-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-1', content: 'Updated content' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
  });

  it('should reject empty content', async () => {
    const request = new Request('http://localhost:3000/api/messages?id=msg-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-1', content: '   ', authorName: 'User1' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
  });

  it('should rate limit patch requests', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    
    const request = new Request('http://localhost:3000/api/messages?id=msg-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'msg-1', content: 'Updated', authorName: 'User1' }),
    });

    const response = await PATCH(request);

    expect(response.status).toBe(429);
  });
});

describe('Messages API - DELETE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject delete without message id', async () => {
    const request = new Request('http://localhost:3000/api/messages', {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(400);
  });

  it('should reject delete without authorName', async () => {
    const request = new Request('http://localhost:3000/api/messages?id=msg-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(400);
  });

  it('should rate limit delete requests', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    
    const request = new Request('http://localhost:3000/api/messages?id=msg-1&authorName=User1', {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(429);
  });

  it('should require authentication for delete', async () => {
    const { withAuth } = await import('@/lib/jwt-auth');
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });
    
    const request = new Request('http://localhost:3000/api/messages?id=msg-1&authorName=User1', {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(401);
  });
});
