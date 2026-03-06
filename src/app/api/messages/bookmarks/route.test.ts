import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, DELETE, __resetForTesting } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((request) => {
    // Return valid auth for test user
    return {
      valid: true,
      payload: { userId: 'test-user-123', name: 'Test User' }
    };
  })
}));

vi.mock('@/lib/id', () => ({
  generateId: vi.fn(() => 'test-bookmark-id-' + Math.random().toString(36).substr(2, 9))
}));

describe('Message Bookmarks API', () => {
  beforeEach(() => {
    __resetForTesting();
  });

  describe('GET /api/messages/bookmarks', () => {
    it('should return empty array for new user', async () => {
      const request = new NextRequest('http://localhost/api/messages/bookmarks');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookmarks).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should return user bookmarks', async () => {
      // First create a bookmark
      const createRequest = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-123',
          channelId: 'channel-1',
          messagePreview: 'Test message content'
        })
      });
      await POST(createRequest);

      // Then get bookmarks
      const getRequest = new NextRequest('http://localhost/api/messages/bookmarks');
      const response = await GET(getRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bookmarks.length).toBe(1);
      expect(data.bookmarks[0].messageId).toBe('msg-123');
      expect(data.bookmarks[0].channelId).toBe('channel-1');
    });
  });

  describe('POST /api/messages/bookmarks', () => {
    it('should create a new bookmark', async () => {
      const request = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-456',
          channelId: 'channel-2',
          messagePreview: 'Important message'
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.bookmark).toBeDefined();
      expect(data.bookmark.messageId).toBe('msg-456');
      expect(data.bookmark.channelId).toBe('channel-2');
      expect(data.bookmark.userId).toBe('test-user-123');
      expect(data.bookmark.createdAt).toBeDefined();
    });

    it('should reject bookmark without messageId', async () => {
      const request = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          channelId: 'channel-1'
        })
      });

      const response = await POST(request);
      
      expect(response.status).toBe(400);
    });

    it('should reject duplicate bookmark', async () => {
      const createRequest = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-duplicate',
          channelId: 'channel-1',
          messagePreview: 'Test'
        })
      });
      await POST(createRequest);

      // Create a new request for the second call
      const duplicateRequest = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-duplicate',
          channelId: 'channel-1',
          messagePreview: 'Test'
        })
      });
      const response = await POST(duplicateRequest);
      
      expect(response.status).toBe(409);
    });

    it('should limit preview length to 200 chars', async () => {
      const longPreview = 'A'.repeat(300);
      const request = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-long',
          channelId: 'channel-1',
          messagePreview: longPreview
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.bookmark.messagePreview.length).toBe(200);
    });
  });

  describe('DELETE /api/messages/bookmarks', () => {
    it('should delete a bookmark by messageId', async () => {
      // First create a bookmark
      const createRequest = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'POST',
        body: JSON.stringify({
          messageId: 'msg-to-delete',
          channelId: 'channel-1',
          messagePreview: 'Test'
        })
      });
      await POST(createRequest);

      // Then delete it
      const deleteRequest = new NextRequest('http://localhost/api/messages/bookmarks?messageId=msg-to-delete', {
        method: 'DELETE'
      });
      const deleteResponse = await DELETE(deleteRequest);
      
      expect(deleteResponse.status).toBe(200);
      
      // Verify it's gone
      const getRequest = new NextRequest('http://localhost/api/messages/bookmarks');
      const getResponse = await GET(getRequest);
      const getData = await getResponse.json();
      
      expect(getData.bookmarks.length).toBe(0);
    });

    it('should require messageId parameter', async () => {
      const request = new NextRequest('http://localhost/api/messages/bookmarks', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      
      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent bookmark', async () => {
      const request = new NextRequest('http://localhost/api/messages/bookmarks?messageId=non-existent', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      
      expect(response.status).toBe(404);
    });
  });
});
