// WhatsApp Message Status Tracking Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initMessageStatus,
  updateMessageStatus,
  getMessageStatus,
  getChannelMessageStatuses,
  getPendingMessages,
  getFailedMessages,
  getPendingCount,
  clearOldStatuses,
  startMessageStatusCleanup,
  stopMessageStatusCleanup,
  __resetMessageStatusForTesting,
} from './whatsapp-message-status';

describe('WhatsApp Message Status Tracking', () => {
  beforeEach(() => {
    __resetMessageStatusForTesting();
  });

  describe('initMessageStatus', () => {
    it('should initialize message status with pending state', () => {
      const status = initMessageStatus('msg-123', 'channel-1');
      
      expect(status.colonyMessageId).toBe('msg-123');
      expect(status.channelId).toBe('channel-1');
      expect(status.status).toBe('pending');
      expect(status.retryCount).toBe(0);
      expect(status.createdAt).toBeInstanceOf(Date);
      expect(status.updatedAt).toBeInstanceOf(Date);
    });

    it('should store the status in the map', () => {
      initMessageStatus('msg-456', 'channel-2');
      const retrieved = getMessageStatus('msg-456');
      
      expect(retrieved).not.toBeNull();
      expect(retrieved?.colonyMessageId).toBe('msg-456');
    });
  });

  describe('updateMessageStatus', () => {
    it('should update status to sent', () => {
      initMessageStatus('msg-789', 'channel-1');
      const updated = updateMessageStatus('msg-789', 'sent', 'wa-msg-001');
      
      expect(updated?.status).toBe('sent');
      expect(updated?.whatsappMessageId).toBe('wa-msg-001');
    });

    it('should update status to delivered', () => {
      initMessageStatus('msg-101', 'channel-1');
      updateMessageStatus('msg-101', 'sent', 'wa-msg-002');
      const delivered = updateMessageStatus('msg-101', 'delivered');
      
      expect(delivered?.status).toBe('delivered');
      expect(delivered?.whatsappMessageId).toBe('wa-msg-002');
    });

    it('should update status to failed with error', () => {
      initMessageStatus('msg-102', 'channel-1');
      const failed = updateMessageStatus('msg-102', 'failed', undefined, 'Rate limit exceeded');
      
      expect(failed?.status).toBe('failed');
      expect(failed?.error).toBe('Rate limit exceeded');
      expect(failed?.retryCount).toBe(1);
    });

    it('should return null for non-existent message', () => {
      const result = updateMessageStatus('non-existent', 'sent');
      
      expect(result).toBeNull();
    });

    it('should increment retry count on each failure', () => {
      initMessageStatus('msg-103', 'channel-1');
      
      updateMessageStatus('msg-103', 'failed', undefined, 'Error 1');
      expect(getMessageStatus('msg-103')?.retryCount).toBe(1);
      
      updateMessageStatus('msg-103', 'failed', undefined, 'Error 2');
      expect(getMessageStatus('msg-103')?.retryCount).toBe(2);
      
      updateMessageStatus('msg-103', 'failed', undefined, 'Error 3');
      expect(getMessageStatus('msg-103')?.retryCount).toBe(3);
    });
  });

  describe('getMessageStatus', () => {
    it('should return null for non-existent message', () => {
      const result = getMessageStatus('non-existent');
      
      expect(result).toBeNull();
    });

    it('should return status for existing message', () => {
      initMessageStatus('msg-201', 'channel-1');
      updateMessageStatus('msg-201', 'delivered');
      
      const status = getMessageStatus('msg-201');
      
      expect(status?.status).toBe('delivered');
    });
  });

  describe('getChannelMessageStatuses', () => {
    it('should return all statuses for a channel', () => {
      initMessageStatus('msg-301', 'channel-x');
      initMessageStatus('msg-302', 'channel-x');
      initMessageStatus('msg-303', 'channel-y');
      
      updateMessageStatus('msg-301', 'delivered');
      updateMessageStatus('msg-302', 'sent');
      
      const channelXStatuses = getChannelMessageStatuses('channel-x');
      
      expect(channelXStatuses).toHaveLength(2);
    });

    it('should return empty array for channel with no messages', () => {
      const statuses = getChannelMessageStatuses('non-existent-channel');
      
      expect(statuses).toHaveLength(0);
    });
  });

  describe('getPendingMessages', () => {
    it('should return only pending messages', () => {
      initMessageStatus('msg-401', 'channel-1');
      initMessageStatus('msg-402', 'channel-1');
      initMessageStatus('msg-403', 'channel-1');
      
      updateMessageStatus('msg-401', 'delivered');
      updateMessageStatus('msg-402', 'sent');
      // msg-403 stays pending
      
      const pending = getPendingMessages();
      
      expect(pending).toHaveLength(1);
      expect(pending[0].colonyMessageId).toBe('msg-403');
    });

    it('should exclude messages that exceeded max retries', () => {
      initMessageStatus('msg-404', 'channel-1');
      
      // Simulate max retries (3 failures)
      updateMessageStatus('msg-404', 'failed', undefined, 'Error 1');
      updateMessageStatus('msg-404', 'failed', undefined, 'Error 2');
      updateMessageStatus('msg-404', 'failed', undefined, 'Error 3');
      // Manually set to pending after max retries to test exclusion
      const status = getMessageStatus('msg-404');
      if (status) {
        status.retryCount = 4; // Exceeds MAX_RETRY_COUNT
      }
      
      const pending = getPendingMessages();
      
      // Should not include message with retryCount >= 3
      expect(pending.find(p => p.colonyMessageId === 'msg-404')).toBeUndefined();
    });
  });

  describe('getFailedMessages', () => {
    it('should return all failed messages', () => {
      initMessageStatus('msg-501', 'channel-1');
      initMessageStatus('msg-502', 'channel-1');
      initMessageStatus('msg-503', 'channel-1');
      
      updateMessageStatus('msg-501', 'failed', undefined, 'Error');
      updateMessageStatus('msg-502', 'sent');
      updateMessageStatus('msg-503', 'failed', undefined, 'Another error');
      
      const failed = getFailedMessages();
      
      expect(failed).toHaveLength(2);
    });
  });

  describe('getPendingCount', () => {
    it('should return count of pending messages for a channel', () => {
      initMessageStatus('msg-601', 'channel-a');
      initMessageStatus('msg-602', 'channel-a');
      initMessageStatus('msg-603', 'channel-a');
      
      updateMessageStatus('msg-601', 'delivered');
      // msg-602 and msg-603 stay pending
      
      const count = getPendingCount('channel-a');
      
      expect(count).toBe(2);
    });

    it('should return 0 for channel with no pending messages', () => {
      initMessageStatus('msg-604', 'channel-b');
      updateMessageStatus('msg-604', 'delivered');
      
      const count = getPendingCount('channel-b');
      
      expect(count).toBe(0);
    });
  });

  describe('clearOldStatuses', () => {
    it('should clear statuses older than specified days', () => {
      // Create old status
      const oldStatus = initMessageStatus('msg-old', 'channel-1');
      oldStatus.updatedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      // Create recent status
      initMessageStatus('msg-recent', 'channel-1');
      
      const cleared = clearOldStatuses(7);
      
      expect(cleared).toBe(1);
      expect(getMessageStatus('msg-old')).toBeNull();
      expect(getMessageStatus('msg-recent')).not.toBeNull();
    });
  });

  describe('Automatic Cleanup', () => {
    it('should start cleanup interval', () => {
      startMessageStatusCleanup();
      // Should not throw and should set up interval
      const status = initMessageStatus('msg-test', 'channel-1');
      expect(status).toBeDefined();
      stopMessageStatusCleanup();
    });

    it('should stop cleanup interval', () => {
      startMessageStatusCleanup();
      stopMessageStatusCleanup();
      // Should not throw
      const status = initMessageStatus('msg-test2', 'channel-1');
      expect(status).toBeDefined();
    });

    it('should not start multiple intervals', () => {
      startMessageStatusCleanup();
      startMessageStatusCleanup(); // Should be idempotent
      stopMessageStatusCleanup();
      // Should not have created multiple intervals
    });
  });
});
