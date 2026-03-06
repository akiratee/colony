import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: () => Promise.resolve(false),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ allowed: true, resetIn: 60000 }),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: (request: Request) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return { valid: true, payload: { userId: 'test-user', name: 'Test User' } };
    }
    return { valid: false, error: 'Unauthorized' };
  },
}));

vi.mock('@/lib/messageStore', () => {
  const messages: Map<string, any[]> = new Map();
  
  return {
    getMessages: vi.fn((channelId: string) => messages.get(channelId) || []),
    getMessageCount: vi.fn((channelId: string) => messages.get(channelId)?.length || 0),
    __resetForTesting: () => messages.clear(),
    __addMessageForTesting: (channelId: string, msg: any) => {
      if (!messages.has(channelId)) {messages.set(channelId, []);}
      messages.get(channelId)!.push(msg);
    },
  };
});

vi.mock('@/lib/channelStore', () => {
  const channels: Map<string, any> = new Map();
  
  return {
    getChannels: vi.fn(() => Array.from(channels.values())),
    getChannel: vi.fn((id: string) => channels.get(id)),
    createChannel: vi.fn((name: string, desc: string, userId: string) => {
      const channel = { id: `channel-${Date.now()}`, name, description: desc, members: [userId] };
      channels.set(channel.id, channel);
      return channel;
    }),
    addMemberToChannel: vi.fn(),
    resetChannels: () => channels.clear(),
  };
});

// Mock request helper
function createMockRequest(url: string) {
  return new Request(url, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer test-token',
      'Content-Type': 'application/json',
    },
  });
}

describe('Channel Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return stats for all channels', async () => {
    const { getChannels } = await import('@/lib/channelStore');
    const { getMessages } = await import('@/lib/messageStore');
    
    // Setup
    const channel = { id: 'channel-1', name: 'general', description: 'General', members: ['user-1'] };
    (getChannels as any).mockReturnValue([channel]);
    (getMessages as any).mockReturnValue([
      {
        id: 'msg-1',
        content: 'Hello world',
        author: { id: 'user-1', name: 'testuser', isBot: false },
        channelId: 'channel-1',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        content: 'Second message',
        author: { id: 'user-1', name: 'testuser', isBot: false },
        channelId: 'channel-1',
        timestamp: new Date().toISOString(),
      }
    ]);

    const request = createMockRequest('http://localhost/api/channels/stats');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.channels).toBeGreaterThan(0);
    expect(data.summary).toBeDefined();
  });

  it('should filter by channelId', async () => {
    const { getChannel } = await import('@/lib/channelStore');
    const { getMessages } = await import('@/lib/messageStore');
    
    // Setup
    const channel = { id: 'channel-1', name: 'general', description: 'General', members: ['user-1'] };
    (getChannel as any).mockReturnValue(channel);
    (getMessages as any).mockReturnValue([{
      id: 'msg-1',
      content: 'Message in general',
      author: { id: 'user-1', name: 'testuser', isBot: false },
      channelId: 'channel-1',
      timestamp: new Date().toISOString(),
    }]);

    const request = createMockRequest('http://localhost/api/channels/stats?channelId=channel-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.channelId).toBe('channel-1');
    expect(data.totalMessages).toBe(1);
  });

  it('should filter by timeframe', async () => {
    const { getChannels } = await import('@/lib/channelStore');
    const { getMessages } = await import('@/lib/messageStore');
    
    // Setup
    (getChannels as any).mockReturnValue([{ id: 'channel-1', name: 'test', description: 'Test', members: ['user-1'] }]);
    (getMessages as any).mockReturnValue([{
      id: 'msg-1',
      content: 'Recent message',
      author: { id: 'user-1', name: 'testuser', isBot: false },
      channelId: 'channel-1',
      timestamp: new Date().toISOString(),
    }]);

    const request = createMockRequest('http://localhost/api/channels/stats?timeframe=24h');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.timeframe).toBe('24h');
  });

  it('should return 404 for non-existent channel', async () => {
    const { getChannel } = await import('@/lib/channelStore');
    (getChannel as any).mockReturnValue(undefined);

    const request = createMockRequest('http://localhost/api/channels/stats?channelId=non-existent');
    const response = await GET(request);

    expect(response.status).toBe(404);
  });

  it('should track bot vs human messages', async () => {
    const { getChannels } = await import('@/lib/channelStore');
    const { getMessages } = await import('@/lib/messageStore');
    
    // Setup
    const channel = { id: 'channel-1', name: 'test', description: 'Test', members: ['user-1'] };
    (getChannels as any).mockReturnValue([channel]);
    (getMessages as any).mockReturnValue([
      {
        id: 'msg-1',
        content: 'Human message',
        author: { id: 'user-1', name: 'testuser', isBot: false },
        channelId: 'channel-1',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'msg-2',
        content: 'Bot message',
        author: { id: 'bot-1', name: 'TestBot', isBot: true },
        channelId: 'channel-1',
        timestamp: new Date().toISOString(),
      },
    ]);

    const request = createMockRequest('http://localhost/api/channels/stats?channelId=channel-1');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.humanMessages).toBe(1);
    expect(data.botMessages).toBe(1);
  });

  it('should require authentication', async () => {
    const request = new Request('http://localhost/api/channels/stats', {
      method: 'GET',
    });
    
    const response = await GET(request);
    
    expect(response.status).toBe(401);
  });
});
