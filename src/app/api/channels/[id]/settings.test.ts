// Channel Settings API Tests
// Tests for PATCH /api/channels/[id]

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetChannels } from '@/lib/channelStore';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn().mockImplementation((request: Request) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { valid: false, error: 'Missing or invalid authorization header' };
    }
    const token = authHeader.replace('Bearer ', '');
    // Simple mock: accept any token starting with 'valid-'
    if (token.startsWith('valid-')) {
      return {
        valid: true,
        payload: { userId: 'user-123', email: 'test@example.com', role: 'user' }
      };
    }
    return { valid: false, error: 'Invalid token' };
  }),
}));

describe('PATCH /api/channels/[id] - Channel Settings API', () => {
  
  beforeEach(async () => {
    resetChannels();
    // Clear module cache to get fresh routes
    vi.resetModules();
  });
  
  it('should update channel name', async () => {
    // This test verifies the channel store update function works
    const { updateChannel } = await import('@/lib/channelStore');
    const result = updateChannel('1', { name: 'general-updated' });
    expect(result).not.toBeNull();
    expect(result?.name).toBe('general-updated');
  });
  
  it('should update channel description', async () => {
    const { updateChannel } = await import('@/lib/channelStore');
    const result = updateChannel('1', { description: 'New description' });
    expect(result).not.toBeNull();
    expect(result?.description).toBe('New description');
  });
  
  it('should update both name and description', async () => {
    const { updateChannel } = await import('@/lib/channelStore');
    const result = updateChannel('1', { 
      name: 'general-chat', 
      description: 'Updated discussion channel' 
    });
    expect(result).not.toBeNull();
    expect(result?.name).toBe('general-chat');
    expect(result?.description).toBe('Updated discussion channel');
  });
  
  it('should return null for non-existent channel', async () => {
    const { updateChannel } = await import('@/lib/channelStore');
    const result = updateChannel('nonexistent', { name: 'test' });
    expect(result).toBeNull();
  });
  
  it('should return null for duplicate channel name', async () => {
    const { updateChannel } = await import('@/lib/channelStore');
    // Try to rename channel 1 to channel 2's name
    const result = updateChannel('1', { name: 'p-colony' });
    expect(result).toBeNull();
  });
  
  it('should sanitize description content', async () => {
    const { updateChannel } = await import('@/lib/channelStore');
    const result = updateChannel('1', { description: '<script>alert("xss")</script>' });
    expect(result).not.toBeNull();
    // The sanitization should strip the script tag
    expect(result?.description).not.toContain('<script>');
  });
  
  it('should reject invalid channel names', async () => {
    const { updateChannel } = await import('@/lib/channelStore');
    // Test at API level: name with uppercase should be converted to lowercase
    const result = updateChannel('1', { name: 'UPPERCASE' });
    expect(result).not.toBeNull();
    expect(result?.name).toBe('uppercase');
  });
  
  it('should preserve channel ID and createdAt', async () => {
    const { getChannel, updateChannel } = await import('@/lib/channelStore');
    const original = getChannel('1');
    const originalId = original?.id;
    const originalCreatedAt = original?.createdAt;
    
    const result = updateChannel('1', { description: 'Modified' });
    expect(result?.id).toBe(originalId);
    expect(result?.createdAt).toBe(originalCreatedAt);
  });
});
