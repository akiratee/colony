// WhatsApp Message Status API Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  initMessageStatus, 
  updateMessageStatus, 
  getMessageStatus, 
  getPendingCount, 
  getFailedMessages,
  __resetMessageStatusForTesting 
} from '@/lib/whatsapp-message-status';

describe('WhatsApp Message Status API Logic', () => {
  beforeEach(() => {
    __resetMessageStatusForTesting();
  });

  describe('Message Status Initialization', () => {
    it('should initialize message status with pending state', () => {
      const status = initMessageStatus('test-msg-1', 'channel-1');
      
      expect(status.colonyMessageId).toBe('test-msg-1');
      expect(status.channelId).toBe('channel-1');
      expect(status.status).toBe('pending');
      expect(status.retryCount).toBe(0);
    });

    it('should store status and allow retrieval', () => {
      initMessageStatus('test-msg-2', 'channel-1');
      const retrieved = getMessageStatus('test-msg-2');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.colonyMessageId).toBe('test-msg-2');
    });
  });

  describe('Status Updates', () => {
    it('should update status to sent', () => {
      initMessageStatus('msg-sent', 'channel-1');
      const updated = updateMessageStatus('msg-sent', 'sent', 'wa-123');
      
      expect(updated?.status).toBe('sent');
      expect(updated?.whatsappMessageId).toBe('wa-123');
    });

    it('should update status to delivered', () => {
      initMessageStatus('msg-delivered', 'channel-1');
      updateMessageStatus('msg-delivered', 'sent', 'wa-456');
      const delivered = updateMessageStatus('msg-delivered', 'delivered');
      
      expect(delivered?.status).toBe('delivered');
    });

    it('should handle failure with error message', () => {
      initMessageStatus('msg-failed', 'channel-1');
      const failed = updateMessageStatus('msg-failed', 'failed', undefined, 'Rate limit exceeded');
      
      expect(failed?.status).toBe('failed');
      expect(failed?.error).toBe('Rate limit exceeded');
      expect(failed?.retryCount).toBe(1);
    });

    it('should return null for non-existent message', () => {
      const result = updateMessageStatus('non-existent', 'sent');
      expect(result).toBeNull();
    });
  });

  describe('Status Flow', () => {
    it('should track complete message lifecycle', () => {
      // 1. Message created in Colony, queued for WhatsApp
      const status = initMessageStatus('msg-lifecycle', 'channel-1');
      expect(status.status).toBe('pending');
      
      // 2. Message sent to WhatsApp
      const sent = updateMessageStatus('msg-lifecycle', 'sent', 'wa-msg-001');
      expect(sent?.status).toBe('sent');
      expect(sent?.whatsappMessageId).toBe('wa-msg-001');
      
      // 3. WhatsApp confirms delivery
      const delivered = updateMessageStatus('msg-lifecycle', 'delivered');
      expect(delivered?.status).toBe('delivered');
      
      // 4. User reads message in WhatsApp
      const read = updateMessageStatus('msg-lifecycle', 'read');
      expect(read?.status).toBe('read');
    });

    it('should handle failure and retry', () => {
      // Initialize first
      initMessageStatus('msg-retry', 'channel-1');
      
      // 1. Initial send fails
      const failed1 = updateMessageStatus('msg-retry', 'failed', undefined, 'Rate limit');
      expect(failed1?.status).toBe('failed');
      expect(failed1?.error).toBe('Rate limit');
      expect(failed1?.retryCount).toBe(1);
      
      // 2. Retry succeeds
      const retry = updateMessageStatus('msg-retry', 'sent', 'wa-msg-retry');
      expect(retry?.status).toBe('sent');
    });

    it('should increment retry count on multiple failures', () => {
      initMessageStatus('msg-multi-fail', 'channel-1');
      
      updateMessageStatus('msg-multi-fail', 'failed', undefined, 'Error 1');
      expect(getMessageStatus('msg-multi-fail')?.retryCount).toBe(1);
      
      updateMessageStatus('msg-multi-fail', 'failed', undefined, 'Error 2');
      expect(getMessageStatus('msg-multi-fail')?.retryCount).toBe(2);
    });
  });

  describe('Query Functions', () => {
    it('getMessageStatus should return null for unknown message', () => {
      const result = getMessageStatus('unknown-message');
      expect(result).toBeNull();
    });

    it('getPendingCount should return correct count', () => {
      initMessageStatus('p1', 'ch1');
      initMessageStatus('p2', 'ch1');
      initMessageStatus('p3', 'ch2');
      
      updateMessageStatus('p1', 'delivered');
      
      expect(getPendingCount('ch1')).toBe(1);
      expect(getPendingCount('ch2')).toBe(1);
      expect(getPendingCount('ch3')).toBe(0);
    });

    it('getFailedMessages should return all failed', () => {
      initMessageStatus('f1', 'ch1');
      initMessageStatus('f2', 'ch1');
      initMessageStatus('s1', 'ch1');
      
      updateMessageStatus('f1', 'failed', undefined, 'Error');
      updateMessageStatus('f2', 'failed', undefined, 'Error');
      updateMessageStatus('s1', 'sent');
      
      const failed = getFailedMessages();
      expect(failed).toHaveLength(2);
    });
  });
});
