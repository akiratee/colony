import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from './route';

// Mock dependencies
vi.mock('@/lib/scheduled-messages', () => ({
  scheduledMessageStore: {
    getScheduledMessages: vi.fn(),
    getMessage: vi.fn(),
    scheduleMessage: vi.fn(),
    cancelMessage: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/lib/validation', () => ({
  sanitizeContent: vi.fn((content) => content.trim()),
  sanitizeAuthor: vi.fn((author) => author),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((request) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader === 'Bearer valid-token') {
      return { valid: true, payload: { userId: 'user-123', name: 'Test User' } };
    }
    return { valid: false, error: 'Invalid token' };
  }),
}));

vi.mock('@/lib/channelStore', () => ({
  canAccessChannel: vi.fn(() => true),
}));

import { scheduledMessageStore } from '@/lib/scheduled-messages';

describe('Scheduled Messages API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduledMessageStore.clear();
  });

  describe('GET /api/messages/scheduled', () => {
    it('should return 401 without auth', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled');
      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should return scheduled messages', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          channelId: 'channel-1',
          content: 'Hello world',
          author: { id: 'user-123', name: 'Test User', avatar: null },
          scheduledAt: new Date('2026-03-07T10:00:00Z'),
          status: 'pending' as const,
          createdAt: new Date(),
        },
      ];
      
      vi.mocked(scheduledMessageStore.getScheduledMessages).mockReturnValue(mockMessages);
      
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.messages).toHaveLength(1);
      expect(data.count).toBe(1);
    });

    it('should filter by channelId', async () => {
      vi.mocked(scheduledMessageStore.getScheduledMessages).mockReturnValue([]);
      
      const request = new NextRequest('http://localhost/api/messages/scheduled?channelId=channel-1', {
        headers: { authorization: 'Bearer valid-token' },
      });
      const response = await GET(request);
      
      expect(response.status).toBe(200);
      expect(scheduledMessageStore.getScheduledMessages).toHaveBeenCalledWith('channel-1');
    });
  });

  describe('POST /api/messages/scheduled', () => {
    it('should return 401 without auth', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'POST',
        body: JSON.stringify({ channelId: 'c1', content: 'Hi', scheduledAt: '2026-03-07T10:00:00Z' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should reject missing channelId', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ content: 'Hi', scheduledAt: '2026-03-07T10:00:00Z' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('channelId');
    });

    it('should reject missing content', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ channelId: 'c1', scheduledAt: '2026-03-07T10:00:00Z' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('content');
    });

    it('should reject missing scheduledAt', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ channelId: 'c1', content: 'Hi' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('scheduledAt');
    });

    it('should reject past scheduledAt', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ channelId: 'c1', content: 'Hi', scheduledAt: pastDate.toISOString() }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('future');
    });

    it('should reject invalid scheduledAt format', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ channelId: 'c1', content: 'Hi', scheduledAt: 'not-a-date' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid');
    });

    it('should schedule message successfully', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 2);
      
      vi.mocked(scheduledMessageStore.scheduleMessage).mockReturnValue({
        id: 'sched-1',
        channelId: 'channel-1',
        content: 'Hello',
        author: { id: 'user-123', name: 'Test User', avatar: null },
        scheduledAt: futureDate,
        status: 'pending' as const,
        createdAt: new Date(),
      });
      
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'POST',
        headers: { authorization: 'Bearer valid-token' },
        body: JSON.stringify({ channelId: 'channel-1', content: 'Hello', scheduledAt: futureDate.toISOString() }),
      });
      const response = await POST(request);
      
      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBe('sched-1');
      expect(data.status).toBe('pending');
    });
  });

  describe('DELETE /api/messages/scheduled', () => {
    it('should return 401 without auth', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled?id=msg-1');
      const response = await DELETE(request);
      expect(response.status).toBe(401);
    });

    it('should reject missing message id', async () => {
      const request = new NextRequest('http://localhost/api/messages/scheduled', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      });
      const response = await DELETE(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('ID');
    });

    it('should reject non-existent message', async () => {
      vi.mocked(scheduledMessageStore.getMessage).mockReturnValue(undefined);
      
      const request = new NextRequest('http://localhost/api/messages/scheduled?id=non-existent', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      });
      const response = await DELETE(request);
      expect(response.status).toBe(404);
    });

    it('should reject cancelling another user\'s message', async () => {
      vi.mocked(scheduledMessageStore.getMessage).mockReturnValue({
        id: 'msg-1',
        channelId: 'channel-1',
        content: 'Hello',
        author: { id: 'other-user', name: 'Other User', avatar: null },
        scheduledAt: new Date('2026-03-07T10:00:00Z'),
        status: 'pending' as const,
        createdAt: new Date(),
      });
      
      const request = new NextRequest('http://localhost/api/messages/scheduled?id=msg-1', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      });
      const response = await DELETE(request);
      expect(response.status).toBe(403);
    });

    it('should cancel own message successfully', async () => {
      vi.mocked(scheduledMessageStore.getMessage).mockReturnValue({
        id: 'msg-1',
        channelId: 'channel-1',
        content: 'Hello',
        author: { id: 'user-123', name: 'Test User', avatar: null },
        scheduledAt: new Date('2026-03-07T10:00:00Z'),
        status: 'pending' as const,
        createdAt: new Date(),
      });
      
      vi.mocked(scheduledMessageStore.cancelMessage).mockReturnValue(true);
      
      const request = new NextRequest('http://localhost/api/messages/scheduled?id=msg-1', {
        method: 'DELETE',
        headers: { authorization: 'Bearer valid-token' },
      });
      const response = await DELETE(request);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });
});
