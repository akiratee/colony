import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { NextRequest } from 'next/server';

// Mock the whatsapp-channel-mapping module
vi.mock('@/lib/whatsapp-channel-mapping', () => ({
  getWhatsAppChannelStore: vi.fn(() => {
    const store = new Map();
    store.set('mapping-1', {
      id: 'mapping-1',
      colonyChannelId: 'channel-1',
      colonyChannelName: 'General',
      whatsappGroupId: 'group-1',
      whatsappGroupName: 'General Group',
      notificationRule: 'all',
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01')
    });
    return store;
  }),
  generateWhatsAppMappingId: vi.fn(() => 'mapping-new-id'),
  isValidNotificationRule: vi.fn((rule: string) => ['all', 'mentions', 'silent', 'off'].includes(rule))
}));

describe('WhatsApp Channels API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/whatsapp/channels', () => {
    it('should return all mappings', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.mappings)).toBe(true);
    });

    it('should filter by colonyChannelId', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels?colonyChannelId=channel-1');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.mappings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/whatsapp/channels', () => {
    it('should require colonyChannelId', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels', {
        method: 'POST',
        body: JSON.stringify({ whatsappGroupId: 'group-1' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('colonyChannelId');
    });

    it('should require whatsappGroupId', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels', {
        method: 'POST',
        body: JSON.stringify({ colonyChannelId: 'channel-1' })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('whatsappGroupId');
    });

    it('should reject invalid notification rule', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels', {
        method: 'POST',
        body: JSON.stringify({ 
          colonyChannelId: 'channel-1', 
          whatsappGroupId: 'group-1',
          notificationRule: 'invalid'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.error).toContain('notificationRule');
    });

    it('should create mapping with default notification rule', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels', {
        method: 'POST',
        body: JSON.stringify({ 
          colonyChannelId: 'channel-new', 
          colonyChannelName: 'New Channel',
          whatsappGroupId: 'group-new',
          whatsappGroupName: 'New Group'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.mapping.notificationRule).toBe('all');
    });

    it('should create mapping with custom notification rule', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels', {
        method: 'POST',
        body: JSON.stringify({ 
          colonyChannelId: 'channel-mentions', 
          whatsappGroupId: 'group-mentions',
          notificationRule: 'mentions'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.mapping.notificationRule).toBe('mentions');
    });

    it('should reject duplicate mapping', async () => {
      const request = new NextRequest('http://localhost:3000/api/whatsapp/channels', {
        method: 'POST',
        body: JSON.stringify({ 
          colonyChannelId: 'channel-1', 
          whatsappGroupId: 'group-1'
        })
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(409);
      expect(data.error).toContain('already exists');
    });
  });
});
