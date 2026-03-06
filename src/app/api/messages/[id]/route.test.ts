import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DELETE } from './route';
import { deleteMessage as deleteStoredMessage, getMessage } from '@/lib/messageStore';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';

// Mock dependencies
vi.mock('@/lib/messageStore', () => ({
  deleteMessage: vi.fn(),
  getMessage: vi.fn(),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, payload: { userId: 'user-123', userName: 'Test User' } })),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 30, resetIn: 60000 })),
}));

// Mock fetch for socket broadcast
global.fetch = vi.fn();

describe('DELETE /api/messages/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should delete message with valid id and author', async () => {
    const deletedMessage = { 
      id: 'msg-delete-success', 
      author: { name: 'Test User' }, 
      channelId: 'channel-1',
      timestamp: new Date() 
    };
    vi.mocked(deleteStoredMessage).mockReturnValue(deletedMessage as any);
    
    const request = new Request('http://localhost:3000/api/messages/msg-delete-success?author=Test+User', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'msg-delete-success' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBeDefined();
    expect(data.message.id).toBe('msg-delete-success');
  });

  it('should return 400 when message id is missing', async () => {
    const request = new Request('http://localhost:3000/api/messages?author=Test+User', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Message ID is required');
  });

  it('should return 400 when authorName is missing', async () => {
    const request = new Request('http://localhost:3000/api/messages/msg-123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'msg-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('authorName is required for message deletion');
  });

  it('should return 404 when message not found', async () => {
    vi.mocked(deleteStoredMessage).mockReturnValue(undefined as any);
    vi.mocked(getMessage).mockReturnValue(undefined as any);
    
    const request = new Request('http://localhost:3000/api/messages/msg-not-found?author=Test+User', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'msg-not-found' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Message not found');
  });

  it('should return 403 when user is not authorized to delete', async () => {
    // First delete returns undefined (not authorized), but message exists
    vi.mocked(deleteStoredMessage).mockReturnValue(undefined as any);
    vi.mocked(getMessage).mockReturnValue({ 
      id: 'msg-exists', 
      content: 'Test message',
      author: { name: 'Someone Else' }, 
      channelId: 'channel-1',
      timestamp: new Date()
    });
    
    const request = new Request('http://localhost:3000/api/messages/msg-exists?author=Test+User', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'msg-exists' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(403);
    expect(data.error).toBe('Not authorized to delete this message');
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValueOnce({ valid: false, error: 'Unauthorized' });
    
    const request = new Request('http://localhost:3000/api/messages/msg-123?author=Test+User', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'msg-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    
    const request = new Request('http://localhost:3000/api/messages/msg-123?author=Test+User', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'msg-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
  });

  it('should return 400 for invalid request', async () => {
    vi.mocked(deleteStoredMessage).mockImplementationOnce(() => {
      throw new Error('Invalid operation');
    });
    
    const request = new Request('http://localhost:3000/api/messages/msg-123?author=Test+User', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'msg-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request');
  });
});
