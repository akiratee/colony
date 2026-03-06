// WhatsApp Channel Mapping [ID] API Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from '@/app/api/whatsapp/channels/[id]/route';

// Helper to create NextRequest
function createNextRequest(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}): NextRequest {
  return new NextRequest(url, {
    method: options.method,
    headers: options.headers,
    body: options.body,
  });
}

// Mock dependencies
vi.mock('@/lib/whatsapp-channel-mapping', () => ({
  getWhatsAppChannelStore: vi.fn(() => {
    const store = new Map();
    store.set('mapping-1', {
      id: 'mapping-1',
      colonyChannelId: 'channel-1',
      colonyChannelName: 'general',
      whatsappGroupId: 'group-123',
      whatsappGroupName: 'Engineering Team',
      notificationRule: 'all',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    });
    return store;
  }),
  isValidNotificationRule: vi.fn((rule: string) => {
    return ['all', 'mentions', 'silent', 'off'].includes(rule);
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
}));

describe('PUT /api/whatsapp/channels/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update notification rule successfully', async () => {
    const request = createNextRequest('http://localhost/api/whatsapp/channels/mapping-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationRule: 'mentions' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'mapping-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mapping.notificationRule).toBe('mentions');
  });

  it('should return 404 for non-existent mapping', async () => {
    const request = createNextRequest('http://localhost/api/whatsapp/channels/non-existent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationRule: 'all' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'non-existent' }) });
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Mapping not found');
  });

  it('should return 400 for invalid notification rule', async () => {
    const request = createNextRequest('http://localhost/api/whatsapp/channels/mapping-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationRule: 'invalid' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'mapping-1' }) });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('notificationRule must be one of: all, mentions, silent, off');
  });

  it('should update colonyChannelName successfully', async () => {
    const request = createNextRequest('http://localhost/api/whatsapp/channels/mapping-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ colonyChannelName: 'engineering' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'mapping-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mapping.colonyChannelName).toBe('engineering');
  });

  it('should update whatsappGroupName successfully', async () => {
    const request = createNextRequest('http://localhost/api/whatsapp/channels/mapping-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ whatsappGroupName: 'New Team Name' }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: 'mapping-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mapping.whatsappGroupName).toBe('New Team Name');
  });
});

describe('DELETE /api/whatsapp/channels/[id]', () => {
  it('should delete mapping successfully', async () => {
    const request = createNextRequest('http://localhost/api/whatsapp/channels/mapping-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'mapping-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Mapping deleted successfully');
  });

  it('should return 404 for non-existent mapping', async () => {
    const request = createNextRequest('http://localhost/api/whatsapp/channels/non-existent', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: 'non-existent' }) });
    
    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Mapping not found');
  });
});
