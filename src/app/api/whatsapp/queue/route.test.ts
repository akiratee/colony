// WhatsApp Queue API Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/whatsapp-outbound', () => ({
  processMessageQueue: vi.fn(),
  getQueueStatus: vi.fn(),
}));

vi.mock('@/lib/metrics', () => ({
  incrementMetric: vi.fn(),
}));

import { processMessageQueue, getQueueStatus } from '@/lib/whatsapp-outbound';
import { incrementMetric } from '@/lib/metrics';

describe('WhatsApp Queue API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/whatsapp/queue', () => {
    it('should process queue and return results', async () => {
      vi.mocked(processMessageQueue).mockResolvedValue({ processed: 5, failed: 1 });
      
      const request = new NextRequest('http://localhost/api/whatsapp/queue', {
        method: 'POST',
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.processed).toBe(5);
      expect(data.failed).toBe(1);
      expect(processMessageQueue).toHaveBeenCalled();
      expect(incrementMetric).toHaveBeenCalledWith('requests');
    });

    it('should handle queue processing errors', async () => {
      vi.mocked(processMessageQueue).mockRejectedValue(new Error('Queue error'));
      
      const request = new NextRequest('http://localhost/api/whatsapp/queue', {
        method: 'POST',
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Queue processing failed');
    });
  });

  describe('GET /api/whatsapp/queue', () => {
    it('should return queue status', async () => {
      vi.mocked(getQueueStatus).mockReturnValue({
        size: 10,
        oldestMessage: new Date('2026-03-05T10:00:00Z'),
      });
      
      const request = new NextRequest('http://localhost/api/whatsapp/queue', {
        method: 'GET',
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.queueSize).toBe(10);
      expect(data.maxRetries).toBe(3);
      expect(data.oldestMessage).toBe('2026-03-05T10:00:00.000Z');
    });

    it('should return empty queue status when no messages', async () => {
      vi.mocked(getQueueStatus).mockReturnValue({
        size: 0,
        oldestMessage: null,
      });
      
      const request = new NextRequest('http://localhost/api/whatsapp/queue', {
        method: 'GET',
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.queueSize).toBe(0);
      expect(data.oldestMessage).toBeNull();
    });
  });
});
