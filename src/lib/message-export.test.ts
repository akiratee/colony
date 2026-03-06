import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/messages/export/route';
import { NextRequest } from 'next/server';

describe('Message Export API', () => {
  function createMockRequest(url: string): NextRequest {
    return new NextRequest(url);
  }
  
  it('should export messages in JSON format', async () => {
    const request = createMockRequest('http://localhost:3000/api/messages/export');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.messages).toBeDefined();
    expect(data.total).toBeDefined();
    expect(data.exportedAt).toBeDefined();
  });
  
  it('should filter by channelId when provided', async () => {
    const request = createMockRequest('http://localhost:3000/api/messages/export?channelId=1');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.channelId).toBe('1');
    // All messages should be from channel 1
    if (data.messages.length > 0) {
      expect(data.messages.every((m: any) => m.channelId === '1')).toBe(true);
    }
  });
  
  it('should support pagination with limit and offset', async () => {
    const request = createMockRequest('http://localhost:3000/api/messages/export?limit=5&offset=0');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.returned).toBeLessThanOrEqual(5);
    expect(data.limit).toBe(5);
    expect(data.offset).toBe(0);
  });
  
  it('should enforce maximum limit of 1000', async () => {
    const request = createMockRequest('http://localhost:3000/api/messages/export?limit=5000');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.returned).toBeLessThanOrEqual(1000);
  });
  
  it('should return CSV format when requested', async () => {
    const request = createMockRequest('http://localhost:3000/api/messages/export?format=csv');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('messages');
    expect(response.headers.get('Content-Disposition')).toContain('.csv');
  });
  
  it('should include message metadata in export', async () => {
    const request = createMockRequest('http://localhost:3000/api/messages/export');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    if (data.messages.length > 0) {
      const msg = data.messages[0];
      expect(msg.id).toBeDefined();
      expect(msg.channelId).toBeDefined();
      expect(msg.content).toBeDefined();
      expect(msg.author).toBeDefined();
      expect(msg.timestamp).toBeDefined();
      // Timestamps should be ISO strings
      expect(new Date(msg.timestamp).toISOString()).toBe(msg.timestamp);
    }
  });
  
  it('should include editedAt and pinnedAt fields', async () => {
    const request = createMockRequest('http://localhost:3000/api/messages/export');
    const response = await GET(request);
    
    expect(response.status).toBe(200);
    const data = await response.json();
    
    // Check that the fields are present in the response structure
    expect(data.messages[0]).toHaveProperty('editedAt');
    expect(data.messages[0]).toHaveProperty('pinnedAt');
  });
});
