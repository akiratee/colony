// WhatsApp Outbound Service Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getChannelWhatsAppMapping, 
  shouldSendToWhatsApp, 
  getWhatsAppGroupId,
  sendColonyMessageToWhatsApp,
  syncDeleteToWhatsApp,
  syncEditToWhatsApp,
  syncReactionToWhatsApp,
  getQueueStatus,
  WhatsAppOutboundMessage
} from './whatsapp-outbound';
import { getWhatsAppChannelStore } from './whatsapp-channel-mapping';

describe('WhatsApp Outbound Service', () => {
  beforeEach(() => {
    // Clear store before each test
    const store = getWhatsAppChannelStore();
    store.clear();
    
    // Clear any queued messages by re-importing
    vi.resetModules();
  });

  describe('getChannelWhatsAppMapping', () => {
    it('should return mapping for mapped channel', () => {
      const store = getWhatsAppChannelStore();
      store.set('mapping-1', {
        id: 'mapping-1',
        colonyChannelId: 'channel-123',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-456',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const mapping = getChannelWhatsAppMapping('channel-123');
      expect(mapping).not.toBeNull();
      expect(mapping?.whatsappGroupId).toBe('group-456');
    });

    it('should return null for unmapped channel', () => {
      const mapping = getChannelWhatsAppMapping('nonexistent-channel');
      expect(mapping).toBeNull();
    });
  });

  describe('shouldSendToWhatsApp', () => {
    it('should send always when rule is "all"', () => {
      const mapping = {
        id: '1',
        colonyChannelId: 'ch1',
        colonyChannelName: 'test',
        whatsappGroupId: 'group1',
        whatsappGroupName: 'Test',
        notificationRule: 'all' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldSendToWhatsApp(mapping, 'Hello', false)).toBe(true);
      expect(shouldSendToWhatsApp(mapping, 'Hello', true)).toBe(true);
    });

    it('should send only with mentions when rule is "mentions"', () => {
      const mapping = {
        id: '1',
        colonyChannelId: 'ch1',
        colonyChannelName: 'test',
        whatsappGroupId: 'group1',
        whatsappGroupName: 'Test',
        notificationRule: 'mentions' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldSendToWhatsApp(mapping, 'Hello', false)).toBe(false);
      expect(shouldSendToWhatsApp(mapping, 'Hello @john', true)).toBe(true);
    });

    it('should send but not notify when rule is "silent"', () => {
      const mapping = {
        id: '1',
        colonyChannelId: 'ch1',
        colonyChannelName: 'test',
        whatsappGroupId: 'group1',
        whatsappGroupName: 'Test',
        notificationRule: 'silent' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldSendToWhatsApp(mapping, 'Hello', false)).toBe(true);
    });

    it('should never send when rule is "off"', () => {
      const mapping = {
        id: '1',
        colonyChannelId: 'ch1',
        colonyChannelName: 'test',
        whatsappGroupId: 'group1',
        whatsappGroupName: 'Test',
        notificationRule: 'off' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(shouldSendToWhatsApp(mapping, 'Hello', false)).toBe(false);
      expect(shouldSendToWhatsApp(mapping, 'Hello @john', true)).toBe(false);
    });
  });

  describe('getWhatsAppGroupId', () => {
    it('should return the WhatsApp group ID from mapping', () => {
      const mapping = {
        id: '1',
        colonyChannelId: 'ch1',
        colonyChannelName: 'test',
        whatsappGroupId: 'group-123456',
        whatsappGroupName: 'Test Group',
        notificationRule: 'all' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(getWhatsAppGroupId(mapping)).toBe('group-123456');
    });
  });

  describe('sendColonyMessageToWhatsApp', () => {
    it('should skip sending if no mapping exists', async () => {
      const result = await sendColonyMessageToWhatsApp({
        channelId: 'unmapped-channel',
        content: 'Hello',
        authorName: 'Vincent',
        timestamp: new Date().toISOString(),
      });

      expect(result.sent).toBe(false);
      expect(result.queued).toBe(false);
      expect(result.reason).toBe('no_mapping');
    });

    it('should skip sending if notification rule blocks it', async () => {
      const store = getWhatsAppChannelStore();
      store.set('mapping-1', {
        id: 'mapping-1',
        colonyChannelId: 'channel-off',
        colonyChannelName: 'off-topic',
        whatsappGroupId: 'group-off',
        whatsappGroupName: 'Off Topic',
        notificationRule: 'off',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await sendColonyMessageToWhatsApp({
        channelId: 'channel-off',
        content: 'Hello',
        authorName: 'Vincent',
        timestamp: new Date().toISOString(),
      });

      expect(result.sent).toBe(false);
      expect(result.queued).toBe(false);
      expect(result.reason).toBe('notification_rule_blocked');
    });

    it('should send when mapping exists and rule allows', async () => {
      const store = getWhatsAppChannelStore();
      store.set('mapping-2', {
        id: 'mapping-2',
        colonyChannelId: 'channel-123',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-456',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await sendColonyMessageToWhatsApp({
        channelId: 'channel-123',
        content: 'Hello team!',
        authorName: 'Vincent',
        authorAvatar: '👤',
        timestamp: new Date().toISOString(),
        messageId: 'msg-123',
      });

      // Without actual API credentials, it returns true (stub mode)
      expect(result.sent).toBe(true);
      expect(result.queued).toBe(false);
    });

    it('should respect mentions rule', async () => {
      const store = getWhatsAppChannelStore();
      store.set('mapping-3', {
        id: 'mapping-3',
        colonyChannelId: 'channel-mentions',
        colonyChannelName: 'alerts',
        whatsappGroupId: 'group-alerts',
        whatsappGroupName: 'Alerts',
        notificationRule: 'mentions',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Without @mention, should be blocked
      const result1 = await sendColonyMessageToWhatsApp({
        channelId: 'channel-mentions',
        content: 'Regular message',
        authorName: 'Vincent',
        timestamp: new Date().toISOString(),
      });
      expect(result1.reason).toBe('notification_rule_blocked');

      // With @mention, should send
      const result2 = await sendColonyMessageToWhatsApp({
        channelId: 'channel-mentions',
        content: 'Hey @team check this!',
        authorName: 'Vincent',
        timestamp: new Date().toISOString(),
      });
      expect(result2.sent).toBe(true);
    });
  });

  describe('syncDeleteToWhatsApp', () => {
    it('should log deletion for mapped channel', async () => {
      const store = getWhatsAppChannelStore();
      store.set('mapping-4', {
        id: 'mapping-4',
        colonyChannelId: 'channel-123',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-456',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Should not throw
      await expect(syncDeleteToWhatsApp('channel-123', 'msg-123', 'Vincent')).resolves.not.toThrow();
    });

    it('should do nothing for unmapped channel', async () => {
      await expect(syncDeleteToWhatsApp('unmapped', 'msg-123', 'Vincent')).resolves.not.toThrow();
    });
  });

  describe('syncEditToWhatsApp', () => {
    it('should send edited message to mapped channel', async () => {
      const store = getWhatsAppChannelStore();
      store.set('mapping-5', {
        id: 'mapping-5',
        colonyChannelId: 'channel-123',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-456',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const message: WhatsAppOutboundMessage = {
        channelId: 'channel-123',
        content: 'Updated message',
        authorName: 'Vincent',
        timestamp: new Date().toISOString(),
        messageId: 'msg-123',
      };

      const result = await syncEditToWhatsApp(message);
      // Stub mode returns true
      expect(result.sent).toBe(true);
    });

    it('should do nothing for unmapped channel', async () => {
      const message: WhatsAppOutboundMessage = {
        channelId: 'unmapped',
        content: 'Updated message',
        authorName: 'Vincent',
        timestamp: new Date().toISOString(),
      };

      const result = await syncEditToWhatsApp(message);
      expect(result.sent).toBe(false);
    });
  });

  describe('getQueueStatus', () => {
    it('should return empty queue initially', () => {
      const status = getQueueStatus();
      expect(status.size).toBe(0);
      expect(status.oldestMessage).toBeNull();
    });
  });

  describe('syncReactionToWhatsApp', () => {
    it('should send reaction notification to mapped channel', async () => {
      const store = getWhatsAppChannelStore();
      store.set('mapping-1', {
        id: 'mapping-1',
        colonyChannelId: 'channel-123',
        colonyChannelName: 'Engineering',
        whatsappGroupId: 'group-456',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await syncReactionToWhatsApp(
        'channel-123',
        'msg-123',
        'Vincent',
        '👍'
      );
      // Stub mode returns true
      expect(result.sent).toBe(true);
    });

    it('should do nothing for unmapped channel', async () => {
      const result = await syncReactionToWhatsApp(
        'unmapped',
        'msg-123',
        'Vincent',
        '🎉'
      );
      expect(result.sent).toBe(false);
    });
  });
});
