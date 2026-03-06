import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST, GET, DELETE } from './route';
import { withAuth } from '@/lib/jwt-auth';
import { 
  getChannel, 
  canAccessChannel, 
  getChannelRole, 
  setChannelRole, 
  removeChannelMember,
  getChannelMembers,
  canManageChannel
} from '@/lib/channelStore';

vi.mock('@/lib/jwt-auth');
vi.mock('@/lib/channelStore');
vi.mock('@/lib/supabase', () => ({
  supabase: null
}));

describe('GET /api/channels/[id]/roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: false } as any);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles');
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await GET(request, { params });
    
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('should return 404 for non-existent channel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue(undefined);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles');
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await GET(request, { params });
    
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Channel not found' });
  });

  it('should return 403 if user cannot access channel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canAccessChannel).mockReturnValue(false);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles');
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await GET(request, { params });
    
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Access denied' });
  });

  it('should return members for authorized user', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canAccessChannel).mockReturnValue(true);
    vi.mocked(getChannelMembers).mockReturnValue([
      { userId: 'user-123', role: 'admin', joinedAt: new Date() },
      { userId: 'user-456', role: 'member', joinedAt: new Date() }
    ]);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles');
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await GET(request, { params });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.members).toHaveLength(2);
  });
});

describe('POST /api/channels/[id]/roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: false } as any);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-456', role: 'moderator' })
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(401);
  });

  it('should return 404 for non-existent channel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue(undefined);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-456', role: 'moderator' })
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(404);
  });

  it('should return 403 if user cannot manage channel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canManageChannel).mockReturnValue(false);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-456', role: 'moderator' })
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Only moderators and admins can manage roles' });
  });

  it('should return 400 for missing userId', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canManageChannel).mockReturnValue(true);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'POST',
      body: JSON.stringify({ role: 'moderator' })
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'userId is required' });
  });

  it('should return 400 for invalid role', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canManageChannel).mockReturnValue(true);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-456', role: 'invalid' })
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'role must be admin, moderator, or member' });
  });

  it('should successfully set role', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canManageChannel).mockReturnValue(true);
    vi.mocked(getChannelRole).mockReturnValue('admin');
    vi.mocked(getChannelMembers).mockReturnValue([
      { userId: 'user-123', role: 'admin', joinedAt: new Date() },
      { userId: 'user-456', role: 'member', joinedAt: new Date() }
    ]);
    vi.mocked(setChannelRole).mockReturnValue(true);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-456', role: 'moderator' })
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(setChannelRole).toHaveBeenCalledWith('channel-123', 'user-456', 'moderator');
  });

  it('should prevent self-demotion when only admin', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canManageChannel).mockReturnValue(true);
    vi.mocked(getChannelRole).mockReturnValue('admin');
    vi.mocked(getChannelMembers).mockReturnValue([
      { userId: 'user-123', role: 'admin', joinedAt: new Date() }
    ]);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'POST',
      body: JSON.stringify({ userId: 'user-123', role: 'member' })
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await POST(request, { params });
    
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Cannot demote yourself - you are the only admin' });
  });
});

describe('DELETE /api/channels/[id]/roles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 for unauthenticated request', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: false } as any);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles?userId=user-456', {
      method: 'DELETE'
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await DELETE(request, { params });
    
    expect(response.status).toBe(401);
  });

  it('should return 404 for non-existent channel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue(undefined);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles?userId=user-456', {
      method: 'DELETE'
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await DELETE(request, { params });
    
    expect(response.status).toBe(404);
  });

  it('should return 400 for missing userId param', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles', {
      method: 'DELETE'
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await DELETE(request, { params });
    
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'userId query parameter is required' });
  });

  it('should return 403 if non-admin tries to remove admin', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    // User is a moderator who can manage channel
    vi.mocked(canManageChannel).mockReturnValue(true);
    // First call: target user (user-456) is admin
    // Second call: current user (user-123) is moderator (not admin)
    vi.mocked(getChannelRole)
      .mockReturnValueOnce('admin')
      .mockReturnValueOnce('moderator');
    
    const request = new Request('http://localhost/api/channels/channel-123/roles?userId=user-456', {
      method: 'DELETE'
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await DELETE(request, { params });
    
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Cannot remove an admin' });
  });

  it('should successfully remove user from channel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(getChannelRole).mockReturnValue('member');
    vi.mocked(canManageChannel).mockReturnValue(true);
    vi.mocked(removeChannelMember).mockReturnValue(true);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles?userId=user-456', {
      method: 'DELETE'
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await DELETE(request, { params });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(removeChannelMember).toHaveBeenCalledWith('channel-123', 'user-456');
  });

  it('should allow user to remove themselves', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(removeChannelMember).mockReturnValue(true);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles?userId=user-123', {
      method: 'DELETE'
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await DELETE(request, { params });
    
    expect(response.status).toBe(200);
    expect(removeChannelMember).toHaveBeenCalledWith('channel-123', 'user-123');
  });

  it('should return 404 if user not found in channel', async () => {
    vi.mocked(withAuth).mockReturnValue({ 
      valid: true, 
      payload: { userId: 'user-123' } 
    } as any);
    vi.mocked(getChannel).mockReturnValue({ id: 'channel-123', name: 'test' } as any);
    vi.mocked(canManageChannel).mockReturnValue(true);
    vi.mocked(removeChannelMember).mockReturnValue(false);
    
    const request = new Request('http://localhost/api/channels/channel-123/roles?userId=user-999', {
      method: 'DELETE'
    });
    const params = Promise.resolve({ id: 'channel-123' });
    
    const response = await DELETE(request, { params });
    
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'User not found in channel' });
  });
});
