import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 100, resetIn: 60000 })),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(() => ({ valid: true, payload: { userId: 'user-123', name: 'Test User' } })),
}));

vi.mock('@/lib/botStore', () => ({
  getBot: vi.fn(),
  botExists: vi.fn(),
  updateBot: vi.fn(),
  deleteBot: vi.fn(),
  getBots: vi.fn(() => []),
}));

vi.mock('@/lib/validation', () => ({
  sanitizeContent: vi.fn((content) => content),
  validateBotInput: vi.fn(() => ({ valid: true })),
}));

import { GET, PATCH, DELETE } from './route';
import { getBot, botExists, updateBot, deleteBot, getBots } from '@/lib/botStore';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';

describe('GET /api/bots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return bot when found in fallback mode', async () => {
    const mockBot = { id: 'bot-123', name: 'Test Bot', description: 'A test bot', status: 'online' as const, avatar: '/bots/test.png', created_at: '2026-01-01' };
    vi.mocked(getBot).mockReturnValue(mockBot);

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123');
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockBot);
  });

  it('should return 404 when bot not found', async () => {
    vi.mocked(getBot).mockReturnValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123');
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Bot not found');
  });

  it('should return 400 when bot ID is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/bots/');
    const params = Promise.resolve({ id: '' });
    
    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Bot ID is required');
  });
});

describe('PATCH /api/bots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 100, resetIn: 60000 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
  });

  it('should update bot successfully in fallback mode', async () => {
    vi.mocked(botExists).mockReturnValue(true);
    vi.mocked(updateBot).mockReturnValue({ id: 'bot-123', name: 'Updated Bot', description: 'Updated', status: 'online', avatar: '/bots/test.png', created_at: '2026-01-01' });

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Bot' }),
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Updated Bot');
    expect(updateBot).toHaveBeenCalledWith('bot-123', { name: 'Updated Bot' });
  });

  it('should return 404 when bot not found for update', async () => {
    vi.mocked(botExists).mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Bot' }),
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Bot not found');
  });

  it('should return 400 when no valid fields to update', async () => {
    vi.mocked(botExists).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('No valid fields to update');
  });

  it('should return 400 for invalid status value', async () => {
    vi.mocked(botExists).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'invalid' }),
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Status must be online or offline');
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: false, error: 'Unauthorized' });

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Bot' }),
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Bot' }),
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
  });
});

describe('DELETE /api/bots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 100, resetIn: 60000 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-123', name: 'Test User' } });
  });

  it('should delete bot successfully in fallback mode', async () => {
    vi.mocked(botExists).mockReturnValue(true);
    vi.mocked(deleteBot).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.id).toBe('bot-123');
    expect(deleteBot).toHaveBeenCalledWith('bot-123');
  });

  it('should return 404 when bot not found for deletion', async () => {
    vi.mocked(botExists).mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Bot not found');
  });

  it('should return 400 when bot ID is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/bots/', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: '' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Bot ID is required');
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: false, error: 'Unauthorized' });

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 429 when rate limited', async () => {
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new NextRequest('http://localhost:3000/api/bots/bot-123', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'bot-123' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
  });
});
