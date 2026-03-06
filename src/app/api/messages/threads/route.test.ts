import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';

// Mock dependencies using vi.hoisted
const { mockGetThreadReplies, mockGetMessage, mockAddMessage, mockWithAuth, mockRateLimit, mockValidateMessageInput, mockSanitizeContent, mockIncrementMetric } = vi.hoisted(() => ({
  mockGetThreadReplies: vi.fn(),
  mockGetMessage: vi.fn(),
  mockAddMessage: vi.fn(),
  mockWithAuth: vi.fn(),
  mockRateLimit: vi.fn().mockReturnValue({ allowed: true, resetIn: 60000 }),
  mockValidateMessageInput: vi.fn().mockReturnValue({ valid: true }),
  mockSanitizeContent: vi.fn((content: string) => content),
  mockIncrementMetric: vi.fn(),
}));

vi.mock('@/lib/messageStore', () => ({
  getThreadReplies: mockGetThreadReplies,
  getMessage: mockGetMessage,
  addMessage: mockAddMessage,
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: mockWithAuth,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('@/lib/validation', () => ({
  validateMessageInput: mockValidateMessageInput,
  sanitizeContent: mockSanitizeContent,
}));

vi.mock('@/lib/metrics', () => ({
  incrementMetric: mockIncrementMetric,
}));

describe('GET /api/messages/threads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false, error: 'Unauthorized' });

    const request = new Request('http://localhost:3000/api/messages/threads?parentId=msg-123');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if parentId is missing', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });

    const request = new Request('http://localhost:3000/api/messages/threads');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('parentId query parameter is required');
  });

  it('should return 404 if parent message not found', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
    mockGetMessage.mockReturnValue(undefined);

    const request = new Request('http://localhost:3000/api/messages/threads?parentId=non-existent');
    const response = await GET(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Parent message not found');
  });

  it('should return thread replies for valid parentId', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
    
    const parentMessage = {
      id: 'msg-parent',
      channelId: 'channel-1',
      content: 'Parent message',
      author: { name: 'Vincent', avatar: '👨‍💻' },
      timestamp: new Date('2026-02-27T10:00:00Z'),
      reactions: [],
    };
    
    const replies = [
      {
        id: 'msg-reply-1',
        channelId: 'channel-1',
        content: 'First reply',
        author: { name: 'Alice', avatar: '👩' },
        timestamp: new Date('2026-02-27T10:05:00Z'),
        reactions: [],
        parentId: 'msg-parent',
      },
      {
        id: 'msg-reply-2',
        channelId: 'channel-1',
        content: 'Second reply',
        author: { name: 'Bob', avatar: '👨' },
        timestamp: new Date('2026-02-27T10:06:00Z'),
        reactions: [],
        parentId: 'msg-parent',
      },
    ];

    mockGetMessage.mockReturnValue(parentMessage);
    mockGetThreadReplies.mockReturnValue(replies);

    const request = new Request('http://localhost:3000/api/messages/threads?parentId=msg-parent');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.parent.id).toBe('msg-parent');
    expect(data.parent.content).toBe('Parent message');
    expect(data.replies).toHaveLength(2);
    expect(data.totalReplies).toBe(2);
    expect(data.replies[0].content).toBe('First reply');
    expect(data.replies[1].content).toBe('Second reply');
  });

  it('should return empty array for message with no replies', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
    
    const parentMessage = {
      id: 'msg-no-replies',
      channelId: 'channel-1',
      content: 'Message with no replies',
      author: { name: 'Vincent', avatar: '👨‍💻' },
      timestamp: new Date('2026-02-27T10:00:00Z'),
      reactions: [],
    };

    mockGetMessage.mockReturnValue(parentMessage);
    mockGetThreadReplies.mockReturnValue([]);

    const request = new Request('http://localhost:3000/api/messages/threads?parentId=msg-no-replies');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    expect(data.parent.id).toBe('msg-no-replies');
    expect(data.replies).toHaveLength(0);
    expect(data.totalReplies).toBe(0);
  });

  it('should serialize timestamps to ISO strings', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
    
    const parentMessage = {
      id: 'msg-123',
      channelId: 'channel-1',
      content: 'Parent',
      author: { name: 'Vincent', avatar: '👨‍💻' },
      timestamp: new Date('2026-02-27T10:00:00Z'),
      reactions: [],
    };

    const replyWithDates = {
      id: 'reply-1',
      channelId: 'channel-1',
      content: 'Reply',
      author: { name: 'Alice', avatar: '👩' },
      timestamp: new Date('2026-02-27T10:05:00Z'),
      editedAt: new Date('2026-02-27T10:06:00Z'),
      pinnedAt: new Date('2026-02-27T10:07:00Z'),
      reactions: [],
      parentId: 'msg-123',
    };

    mockGetMessage.mockReturnValue(parentMessage);
    mockGetThreadReplies.mockReturnValue([replyWithDates]);

    const request = new Request('http://localhost:3000/api/messages/threads?parentId=msg-123');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Check ISO string serialization
    expect(data.parent.timestamp).toBe('2026-02-27T10:00:00.000Z');
    expect(data.replies[0].timestamp).toBe('2026-02-27T10:05:00.000Z');
    expect(data.replies[0].editedAt).toBe('2026-02-27T10:06:00.000Z');
    expect(data.replies[0].pinnedAt).toBe('2026-02-27T10:07:00.000Z');
  });
});

describe('POST /api/messages/threads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false, error: 'Unauthorized' });

    const request = new Request('http://localhost:3000/api/messages/threads', {
      method: 'POST',
      body: JSON.stringify({ parentId: 'msg-123', channelId: 'channel-1', content: 'Reply', author: { name: 'Test' } }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if parentId is missing', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });

    const request = new Request('http://localhost:3000/api/messages/threads', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'channel-1', content: 'Reply', author: { name: 'Test' } }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('parentId is required in request body');
  });

  it('should return 400 if channelId is missing', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });

    const request = new Request('http://localhost:3000/api/messages/threads', {
      method: 'POST',
      body: JSON.stringify({ parentId: 'msg-123', content: 'Reply', author: { name: 'Test' } }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('channelId is required and must be a string');
  });

  it('should return 400 if content is missing', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });

    const request = new Request('http://localhost:3000/api/messages/threads', {
      method: 'POST',
      body: JSON.stringify({ parentId: 'msg-123', channelId: 'channel-1', author: { name: 'Test' } }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('content is required and must be a non-empty string');
  });

  it('should return 404 if parent message not found', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
    mockGetMessage.mockReturnValue(undefined);

    const request = new Request('http://localhost:3000/api/messages/threads', {
      method: 'POST',
      body: JSON.stringify({ parentId: 'non-existent', channelId: 'channel-1', content: 'Reply', author: { name: 'Test' } }),
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Parent message not found');
  });

  it('should return 400 if parent message is in different channel', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
    mockGetMessage.mockReturnValue({
      id: 'msg-123',
      channelId: 'channel-1',
      content: 'Parent',
      author: { name: 'Vincent', avatar: '👨‍💻' },
      timestamp: new Date('2026-02-27T10:00:00Z'),
      reactions: [],
    });

    const request = new Request('http://localhost:3000/api/messages/threads', {
      method: 'POST',
      body: JSON.stringify({ parentId: 'msg-123', channelId: 'channel-2', content: 'Reply', author: { name: 'Test' } }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Parent message must be in the same channel');
  });

  it('should create thread reply successfully', async () => {
    mockWithAuth.mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
    mockGetMessage.mockReturnValue({
      id: 'msg-parent',
      channelId: 'channel-1',
      content: 'Parent message',
      author: { name: 'Vincent', avatar: '👨‍💻' },
      timestamp: new Date('2026-02-27T10:00:00Z'),
      reactions: [],
    });
    mockAddMessage.mockReturnValue({
      id: 'msg-reply-new',
      channelId: 'channel-1',
      content: 'This is a reply',
      author: { name: 'Alice', avatar: '👩' },
      timestamp: new Date('2026-02-27T10:05:00Z'),
      reactions: [],
      parentId: 'msg-parent',
    });

    const request = new Request('http://localhost:3000/api/messages/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentId: 'msg-parent',
        channelId: 'channel-1',
        content: 'This is a reply',
        author: { name: 'Alice', avatar: '👩' },
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.reply.id).toBe('msg-reply-new');
    expect(data.reply.content).toBe('This is a reply');
    expect(data.reply.parentId).toBe('msg-parent');
    expect(data.parent.id).toBe('msg-parent');
  });
});
