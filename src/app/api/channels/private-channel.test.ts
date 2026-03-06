// Private Channel API Tests
// Tests for private channel functionality in /api/channels

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './route';
import { resetChannels, getChannel, addChannel, canAccessChannel, inviteUserToChannel, removeUserFromChannel, getAccessibleChannels } from '@/lib/channelStore';

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
    // Support different user IDs based on token
    if (token.startsWith('valid-')) {
      const userId = token.replace('valid-', '') || 'user-123';
      return {
        valid: true,
        payload: { userId, email: 'test@example.com', role: 'user' }
      };
    }
    return { valid: false, error: 'Invalid token' };
  }),
  extractTokenFromHeader: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 0 })),
}));

vi.mock('@/lib/metrics', () => ({
  incrementMetric: vi.fn(),
}));

describe('Private Channels', () => {
  beforeEach(() => {
    resetChannels();
    vi.clearAllMocks();
  });

  describe('Channel Store Functions', () => {
    it('should create a private channel', () => {
      const channel = addChannel('private-team', 'Secret channel', true, ['user-1', 'user-2']);
      
      expect(channel.isPrivate).toBe(true);
      expect(channel.allowedUsers).toContain('user-1');
      expect(channel.allowedUsers).toContain('user-2');
    });

    it('should create a public channel', () => {
      const channel = addChannel('public-channel', 'Open channel', false);
      
      expect(channel.isPrivate).toBe(false);
      expect(channel.allowedUsers).toBeUndefined();
    });

    it('should not allow duplicate channel names', () => {
      addChannel('unique-channel', 'First channel', false);
      
      expect(() => {
        addChannel('unique-channel', 'Duplicate channel', false);
      }).toThrow("Channel 'unique-channel' already exists");
    });

    it('should check access to private channel - allowed user', () => {
      addChannel('secret', 'Top secret', true, ['user-1', 'user-2']);
      const secretChannel = getChannel('secret');
      
      expect(canAccessChannel(secretChannel!.id, 'user-1')).toBe(true);
      expect(canAccessChannel(secretChannel!.id, 'user-2')).toBe(true);
    });

    it('should deny access to private channel - non-allowed user', () => {
      addChannel('secret', 'Top secret', true, ['user-1', 'user-2']);
      const secretChannel = getChannel('secret');
      
      expect(canAccessChannel(secretChannel!.id, 'user-3')).toBe(false);
      expect(canAccessChannel(secretChannel!.id, 'anonymous')).toBe(false);
    });

    it('should allow access to public channel for everyone', () => {
      const publicChannel = getChannel('general');
      
      expect(canAccessChannel(publicChannel!.id, 'user-1')).toBe(true);
      expect(canAccessChannel(publicChannel!.id, 'user-999')).toBe(true);
      expect(canAccessChannel(publicChannel!.id, 'anonymous')).toBe(true);
    });

    it('should invite user to private channel', () => {
      const channel = addChannel('team-channel', 'Team only', true, ['user-1']);
      
      const success = inviteUserToChannel(channel.id, 'user-3');
      expect(success).toBe(true);
      
      const updatedChannel = getChannel(channel.id);
      expect(updatedChannel!.allowedUsers).toContain('user-3');
    });

    it('should not invite to public channel', () => {
      const channel = addChannel('open-channel', 'Open', false);
      
      const success = inviteUserToChannel(channel.id, 'user-1');
      expect(success).toBe(false);
    });

    it('should remove user from private channel', () => {
      const channel = addChannel('team', 'Team', true, ['user-1', 'user-2', 'user-3']);
      
      const success = removeUserFromChannel(channel.id, 'user-2');
      expect(success).toBe(true);
      
      const updatedChannel = getChannel(channel.id);
      expect(updatedChannel!.allowedUsers).not.toContain('user-2');
      expect(updatedChannel!.allowedUsers).toContain('user-1');
      expect(updatedChannel!.allowedUsers).toContain('user-3');
    });

    it('should get accessible channels for user', () => {
      // Add various channels (use unique names since resetChannels adds 'general')
      addChannel('public-one', 'Public channel', false);
      addChannel('secret-project', 'Private', true, ['user-1', 'user-2']);
      addChannel('confidential', 'Very Private', true, ['user-1']);
      addChannel('team-only', 'Team', true, ['user-2', 'user-3']);
      
      const user1Channels = getAccessibleChannels('user-1');
      const user1ChannelNames = user1Channels.map(c => c.name);
      
      expect(user1ChannelNames).toContain('public-one');
      expect(user1ChannelNames).toContain('secret-project');
      expect(user1ChannelNames).toContain('confidential');
      expect(user1ChannelNames).not.toContain('team-only');
    });
  });

  describe('POST /api/channels - Private Channel Creation', () => {
    it('should create a private channel', async () => {
      const request = new Request('http://localhost/api/channels', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'private-alpha',
          description: 'Private channel for alpha team',
          isPrivate: true,
          allowedUsers: ['user-1', 'user-2'],
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('private-alpha');
      expect(data.isPrivate).toBe(true);
      expect(data.allowedUsers).toContain('user-1');
      expect(data.allowedUsers).toContain('user-2');
    });

    it('should create a private channel without allowedUsers (creator only)', async () => {
      const request = new Request('http://localhost/api/channels', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'private-beta',
          description: 'Private channel',
          isPrivate: true,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.isPrivate).toBe(true);
      expect(data.allowedUsers).toEqual([]);
    });

    it('should reject invalid allowedUsers for private channel', async () => {
      const request = new Request('http://localhost/api/channels', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer valid-token-123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'bad-channel',
          description: 'Bad channel',
          isPrivate: true,
          allowedUsers: 'not-an-array',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('should require authentication for private channel', async () => {
      const request = new Request('http://localhost/api/channels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'private-channel',
          isPrivate: true,
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/channels - Private Channel Filtering', () => {
    beforeEach(() => {
      resetChannels();
      addChannel('public-1', 'Public channel', false);
      addChannel('private-a', 'Private A', true, ['user-1', 'user-2']);
      addChannel('private-b', 'Private B', true, ['user-3']);
    });

    it('should return all channels for user with access', async () => {
      const request = new Request('http://localhost/api/channels', {
        headers: { 'Authorization': 'Bearer valid-user-1' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const channelNames = data.map((c: any) => c.name);
      expect(channelNames).toContain('public-1');
      expect(channelNames).toContain('private-a');
      // user-1 doesn't have access to private-b
      expect(channelNames).not.toContain('private-b');
    });

    it('should hide allowedUsers from unauthenticated requests', async () => {
      const request = new Request('http://localhost/api/channels');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Find private channel in results
      const privateChannel = data.find((c: any) => c.name === 'private-a');
      expect(privateChannel).toBeDefined();
      expect(privateChannel.isPrivate).toBe(true);
      expect(privateChannel.allowedUsers).toBeUndefined();
    });
  });
});
