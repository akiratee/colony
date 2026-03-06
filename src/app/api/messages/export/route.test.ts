// Messages Export API Route Tests
// GET /api/messages/export - Export messages in JSON or CSV format

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { getMessages } from '@/lib/messageStore';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';

// Mock dependencies
vi.mock('@/lib/messageStore', () => ({
  getMessages: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetIn: 60000 })),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, payload: { userId: 'user-123', name: 'Test User' } })),
}));

describe('GET /api/messages/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export all messages in JSON format', async () => {
    const mockMessages = [
      {
        id: 'msg-1',
        channelId: 'general',
        content: 'Hello world',
        author: { id: 'user-1', name: 'Alice', avatar: '👩' },
        timestamp: new Date('2026-02-27T10:00:00Z'),
        reactions: [],
        seenBy: [],
      },
      {
        id: 'msg-2',
        channelId: 'general',
        content: 'Hi there',
        author: { id: 'user-2', name: 'Bob', avatar: '👨' },
        timestamp: new Date('2026-02-27T11:00:00Z'),
        reactions: [{ emoji: '👍', users: ['user-1'], count: 1 }],
        seenBy: [],
      },
    ];
    vi.mocked(getMessages).mockReturnValue(mockMessages);

    const response = await GET(new Request('http://localhost/api/messages/export'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(2);
    expect(data.total).toBe(2);
    expect(data.returned).toBe(2);
    expect(data.channelId).toBe('all');
    expect(data.format).toBeUndefined();
  });

  it('should filter messages by channelId', async () => {
    vi.mocked(getMessages).mockReturnValue([]);

    const response = await GET(new Request('http://localhost/api/messages/export?channelId=general'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getMessages).toHaveBeenCalledWith('general');
    expect(data.channelId).toBe('general');
  });

  it('should apply pagination with limit and offset', async () => {
    const allMessages = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      channelId: 'general',
      content: `Message ${i}`,
      author: { id: 'user-1', name: 'Alice', avatar: '👩' },
      timestamp: new Date(),
      reactions: [],
    }));
    vi.mocked(getMessages).mockReturnValue(allMessages);

    const response = await GET(new Request('http://localhost/api/messages/export?limit=10&offset=20'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.messages).toHaveLength(10);
    expect(data.returned).toBe(10);
    expect(data.limit).toBe(10);
    expect(data.offset).toBe(20);
    expect(data.total).toBe(50);
  });

  it('should cap limit at 1000', async () => {
    vi.mocked(getMessages).mockReturnValue([]);

    const response = await GET(new Request('http://localhost/api/messages/export?limit=5000'));
    const data = await response.json();

    expect(data.limit).toBe(1000);
  });

  it('should export in CSV format when requested', async () => {
    const testDate = new Date('2026-02-27T10:00:00Z');
    const mockMessages = [
      {
        id: 'msg-1',
        channelId: 'general',
        content: 'Hello world',
        author: { id: 'user-1', name: 'Alice', avatar: '👩' },
        timestamp: testDate,
        editedAt: undefined,
        pinnedAt: undefined,
        reactions: [],
        seenBy: [],
      },
    ];
    vi.mocked(getMessages).mockReturnValue(mockMessages);

    const response = await GET(new Request('http://localhost/api/messages/export?format=csv'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('messages-');
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: false, 
      error: 'Unauthorized' 
    });

    const response = await GET(new Request('http://localhost/api/messages/export'));

    expect(response.status).toBe(401);
  });

  it('should return 429 for rate limiting', async () => {
    // Auth passes, but rate limit fails
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60000 });

    const response = await GET(new Request('http://localhost/api/messages/export'));

    expect(response.status).toBe(429);
  });

  it('should serialize timestamps to ISO strings', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', name: 'Test User' } 
    });
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 10, resetIn: 60000 });
    
    const testDate = new Date('2026-02-27T10:00:00Z');
    const mockMessages = [
      {
        id: 'msg-1',
        channelId: 'general',
        content: 'Test',
        author: { id: 'user-1', name: 'Alice', avatar: '👩' },
        timestamp: testDate,
        editedAt: testDate,
        pinnedAt: undefined,
        reactions: [],
        seenBy: [],
      },
    ];
    vi.mocked(getMessages).mockReturnValue(mockMessages);

    const response = await GET(new Request('http://localhost/api/messages/export'));
    const data = await response.json();

    expect(data.messages[0].timestamp).toBe('2026-02-27T10:00:00.000Z');
    expect(data.messages[0].editedAt).toBe('2026-02-27T10:00:00.000Z');
    expect(data.messages[0].pinnedAt).toBeNull();
  });
});
