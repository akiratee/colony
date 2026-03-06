// Channel Mute API Tests
// Tests for GET/POST/DELETE /api/channels/mute

import { NextRequest } from 'next/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, DELETE } from './route';

// Mock dependencies
vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
}));

vi.mock('@/lib/channel-mute', () => ({
  muteChannel: vi.fn(),
  unmuteChannel: vi.fn(),
  isChannelMuted: vi.fn(),
  getMutedChannels: vi.fn(),
  getChannelMuteStatus: vi.fn(),
}));

import { withAuth } from '@/lib/jwt-auth';
import { 
  muteChannel, 
  unmuteChannel, 
  isChannelMuted, 
  getMutedChannels,
  getChannelMuteStatus 
} from '@/lib/channel-mute';

const mockWithAuth = withAuth as ReturnType<typeof vi.fn>;
const mockMuteChannel = muteChannel as ReturnType<typeof vi.fn>;
const mockUnmuteChannel = unmuteChannel as ReturnType<typeof vi.fn>;
const mockIsChannelMuted = isChannelMuted as ReturnType<typeof vi.fn>;
const mockGetMutedChannels = getMutedChannels as ReturnType<typeof vi.fn>;
const mockGetChannelMuteStatus = getChannelMuteStatus as ReturnType<typeof vi.fn>;

describe('GET /api/channels/mute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false, error: 'Unauthorized' });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return muted channels for authenticated user', async () => {
    const mockMutes = [
      { channelId: 'general', mutedAt: new Date('2026-02-27'), expiresAt: null },
      { channelId: 'random', mutedAt: new Date('2026-02-27'), expiresAt: new Date('2026-02-28') },
    ];
    
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockGetMutedChannels.mockReturnValue(mockMutes);
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.mutedChannels).toHaveLength(2);
    expect(data.mutedChannels[0].channelId).toBe('general');
    expect(data.mutedChannels[0].isPermanent).toBe(true);
    expect(data.mutedChannels[1].channelId).toBe('random');
    expect(data.mutedChannels[1].isPermanent).toBe(false);
  });

  it('should return empty array when no channels muted', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockGetMutedChannels.mockReturnValue([]);
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.mutedChannels).toHaveLength(0);
  });

  it('should return 500 on server error', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockGetMutedChannels.mockImplementation(() => {
      throw new Error('Database error');
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute');
    const response = await GET(request);
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to get muted channels');
  });
});

describe('POST /api/channels/mute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false, error: 'Unauthorized' });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'general' }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if channelId is missing', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('channelId is required');
  });

  it('should return 400 if channelId is not a string', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 123 }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('channelId is required');
  });

  it('should return 400 if durationMinutes is invalid', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'general', durationMinutes: -5 }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('durationMinutes must be a positive number');
  });

  it('should return 400 if durationMinutes is zero', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'general', durationMinutes: 0 }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('durationMinutes must be a positive number');
  });

  it('should return message if channel already muted', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockIsChannelMuted.mockReturnValue(true);
    mockGetChannelMuteStatus.mockReturnValue({
      channelId: 'general',
      mutedAt: new Date('2026-02-27'),
      expiresAt: null,
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'general' }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.message).toBe('Channel already muted');
    expect(data.mute.channelId).toBe('general');
    expect(data.mute.isPermanent).toBe(true);
  });

  it('should successfully mute a channel permanently', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockIsChannelMuted.mockReturnValue(false);
    mockMuteChannel.mockReturnValue({
      channelId: 'general',
      mutedAt: new Date('2026-02-27'),
      expiresAt: null,
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'general' }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.message).toBe('Channel muted successfully');
    expect(data.mute.channelId).toBe('general');
    expect(data.mute.isPermanent).toBe(true);
    expect(data.mute.expiresAt).toBeNull();
  });

  it('should successfully mute a channel with duration', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockIsChannelMuted.mockReturnValue(false);
    const expiresAt = new Date('2026-02-27T12:00:00Z');
    mockMuteChannel.mockReturnValue({
      channelId: 'general',
      mutedAt: new Date('2026-02-27T11:00:00Z'),
      expiresAt: expiresAt,
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'general', durationMinutes: 60 }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.message).toBe('Channel muted successfully');
    expect(data.mute.channelId).toBe('general');
    expect(data.mute.isPermanent).toBe(false);
    expect(data.mute.expiresAt).not.toBeNull();
    expect(mockMuteChannel).toHaveBeenCalledWith('user-123', 'general', 60);
  });

  it('should return 500 on server error', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockIsChannelMuted.mockImplementation(() => {
      throw new Error('Database error');
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute', {
      method: 'POST',
      body: JSON.stringify({ channelId: 'general' }),
    });
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to mute channel');
  });
});

describe('DELETE /api/channels/mute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false, error: 'Unauthorized' });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute?channelId=general');
    const response = await DELETE(request);
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if channelId query param is missing', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute');
    const response = await DELETE(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('channelId query parameter is required');
  });

  it('should return 404 if channel was not muted', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockUnmuteChannel.mockReturnValue(false);
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute?channelId=general');
    const response = await DELETE(request);
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Channel was not muted');
  });

  it('should successfully unmute a channel', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockUnmuteChannel.mockReturnValue(true);
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute?channelId=general');
    const response = await DELETE(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.message).toBe('Channel unmuted successfully');
    expect(mockUnmuteChannel).toHaveBeenCalledWith('user-123', 'general');
  });

  it('should return 500 on server error', async () => {
    mockWithAuth.mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123', email: 'test@example.com' } 
    });
    mockUnmuteChannel.mockImplementation(() => {
      throw new Error('Database error');
    });
    
    const request = new NextRequest('http://localhost:3000/api/channels/mute?channelId=general');
    const response = await DELETE(request);
    const data = await response.json();
    
    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to unmute channel');
  });
});
