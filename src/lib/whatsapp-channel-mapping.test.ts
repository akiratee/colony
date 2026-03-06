// WhatsApp Channel Mapping API Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getWhatsAppChannelStore, 
  generateWhatsAppMappingId, 
  isValidNotificationRule, 
  WhatsAppChannelMapping,
  getMappingsByWhatsAppGroup,
  getMappingByColonyChannel,
  getMappingCount,
  clearWhatsAppMappings,
  getMappingsByNotificationRule,
  isChannelMapped,
} from './whatsapp-channel-mapping';

describe('WhatsApp Channel Mapping Store', () => {
  beforeEach(() => {
    // Clear store before each test
    const store = getWhatsAppChannelStore();
    store.clear();
  });

  describe('getWhatsAppChannelStore', () => {
    it('should return a Map instance', () => {
      const store = getWhatsAppChannelStore();
      expect(store).toBeInstanceOf(Map);
    });

    it('should return the same instance on subsequent calls', () => {
      const store1 = getWhatsAppChannelStore();
      const store2 = getWhatsAppChannelStore();
      expect(store1).toBe(store2);
    });
  });

  describe('generateWhatsAppMappingId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateWhatsAppMappingId();
      const id2 = generateWhatsAppMappingId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with whatsapp_ prefix', () => {
      const id = generateWhatsAppMappingId();
      expect(id.startsWith('whatsapp_')).toBe(true);
    });
  });

  describe('isValidNotificationRule', () => {
    it('should return true for valid rules', () => {
      expect(isValidNotificationRule('all')).toBe(true);
      expect(isValidNotificationRule('mentions')).toBe(true);
      expect(isValidNotificationRule('silent')).toBe(true);
      expect(isValidNotificationRule('off')).toBe(true);
    });

    it('should return false for invalid rules', () => {
      expect(isValidNotificationRule('invalid')).toBe(false);
      expect(isValidNotificationRule('')).toBe(false);
      expect(isValidNotificationRule('ALL')).toBe(false);
    });
  });

  describe('CRUD Operations', () => {
    it('should create and retrieve mappings', () => {
      const store = getWhatsAppChannelStore();
      const mapping: WhatsAppChannelMapping = {
        id: generateWhatsAppMappingId(),
        colonyChannelId: 'channel-1',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-123',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      store.set(mapping.id, mapping);
      
      const retrieved = store.get(mapping.id);
      expect(retrieved).toEqual(mapping);
    });

    it('should update mappings', () => {
      const store = getWhatsAppChannelStore();
      const mapping: WhatsAppChannelMapping = {
        id: 'mapping-1',
        colonyChannelId: 'channel-1',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-123',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      store.set(mapping.id, mapping);
      
      // Update
      mapping.notificationRule = 'mentions';
      mapping.updatedAt = new Date();
      store.set(mapping.id, mapping);
      
      const updated = store.get(mapping.id);
      expect(updated?.notificationRule).toBe('mentions');
    });

    it('should delete mappings', () => {
      const store = getWhatsAppChannelStore();
      const mapping: WhatsAppChannelMapping = {
        id: 'mapping-1',
        colonyChannelId: 'channel-1',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-123',
        whatsappGroupName: 'Engineering Team',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      store.set(mapping.id, mapping);
      expect(store.has(mapping.id)).toBe(true);
      
      store.delete(mapping.id);
      expect(store.has(mapping.id)).toBe(false);
    });

    it('should filter by colonyChannelId', () => {
      const store = getWhatsAppChannelStore();
      
      // Add two mappings
      store.set('mapping-1', {
        id: 'mapping-1',
        colonyChannelId: 'channel-1',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-1',
        whatsappGroupName: 'Group 1',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      store.set('mapping-2', {
        id: 'mapping-2',
        colonyChannelId: 'channel-2',
        colonyChannelName: 'general',
        whatsappGroupId: 'group-2',
        whatsappGroupName: 'Group 2',
        notificationRule: 'mentions',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Filter
      const channel1Mappings = Array.from(store.values()).filter(m => m.colonyChannelId === 'channel-1');
      expect(channel1Mappings.length).toBe(1);
      expect(channel1Mappings[0].colonyChannelId).toBe('channel-1');
    });
  });

  describe('Notification Rules', () => {
    it('should accept all valid notification rules', () => {
      const rules: Array<WhatsAppChannelMapping['notificationRule']> = ['all', 'mentions', 'silent', 'off'];
      
      for (const rule of rules) {
        expect(isValidNotificationRule(rule)).toBe(true);
      }
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate colony to whatsapp mappings', () => {
      const store = getWhatsAppChannelStore();
      
      const mapping1: WhatsAppChannelMapping = {
        id: 'mapping-1',
        colonyChannelId: 'channel-1',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-1',
        whatsappGroupName: 'Group 1',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mapping2: WhatsAppChannelMapping = {
        id: 'mapping-2',
        colonyChannelId: 'channel-1', // Same channel
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-1', // Same group
        whatsappGroupName: 'Group 1',
        notificationRule: 'mentions',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      store.set(mapping1.id, mapping1);
      
      // Check for duplicate
      const existingMappings = Array.from(store.values());
      const duplicate = existingMappings.find(
        m => m.colonyChannelId === mapping2.colonyChannelId && m.whatsappGroupId === mapping2.whatsappGroupId
      );
      
      expect(duplicate).toBeDefined();
    });

    it('should allow different channels to same group', () => {
      const store = getWhatsAppChannelStore();
      
      const mapping1: WhatsAppChannelMapping = {
        id: 'mapping-1',
        colonyChannelId: 'channel-1',
        colonyChannelName: 'engineering',
        whatsappGroupId: 'group-1',
        whatsappGroupName: 'Group 1',
        notificationRule: 'all',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      const mapping2: WhatsAppChannelMapping = {
        id: 'mapping-2',
        colonyChannelId: 'channel-2', // Different channel
        colonyChannelName: 'general',
        whatsappGroupId: 'group-1', // Same group
        whatsappGroupName: 'Group 1',
        notificationRule: 'mentions',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      store.set(mapping1.id, mapping1);
      
      // Check for duplicate
      const existingMappings = Array.from(store.values());
      const duplicate = existingMappings.find(
        m => m.colonyChannelId === mapping2.colonyChannelId && m.whatsappGroupId === mapping2.whatsappGroupId
      );
      
      expect(duplicate).toBeUndefined();
    });
  });

  describe('Helper Functions', () => {
    beforeEach(() => {
      clearWhatsAppMappings();
    });

    describe('getMappingsByWhatsAppGroup', () => {
      it('should return all mappings for a specific WhatsApp group', () => {
        const store = getWhatsAppChannelStore();
        
        store.set('mapping-1', {
          id: 'mapping-1',
          colonyChannelId: 'channel-1',
          colonyChannelName: 'engineering',
          whatsappGroupId: 'group-1',
          whatsappGroupName: 'Group 1',
          notificationRule: 'all',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        store.set('mapping-2', {
          id: 'mapping-2',
          colonyChannelId: 'channel-2',
          colonyChannelName: 'general',
          whatsappGroupId: 'group-1',
          whatsappGroupName: 'Group 1',
          notificationRule: 'mentions',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        store.set('mapping-3', {
          id: 'mapping-3',
          colonyChannelId: 'channel-3',
          colonyChannelName: 'random',
          whatsappGroupId: 'group-2',
          whatsappGroupName: 'Group 2',
          notificationRule: 'off',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const group1Mappings = getMappingsByWhatsAppGroup('group-1');
        expect(group1Mappings.length).toBe(2);
        
        const group2Mappings = getMappingsByWhatsAppGroup('group-2');
        expect(group2Mappings.length).toBe(1);
      });

      it('should return empty array for non-existent group', () => {
        const mappings = getMappingsByWhatsAppGroup('non-existent');
        expect(mappings.length).toBe(0);
      });
    });

    describe('getMappingByColonyChannel', () => {
      it('should return mapping for a specific colony channel', () => {
        const store = getWhatsAppChannelStore();
        
        store.set('mapping-1', {
          id: 'mapping-1',
          colonyChannelId: 'channel-1',
          colonyChannelName: 'engineering',
          whatsappGroupId: 'group-1',
          whatsappGroupName: 'Group 1',
          notificationRule: 'all',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const mapping = getMappingByColonyChannel('channel-1');
        expect(mapping).toBeDefined();
        expect(mapping?.colonyChannelId).toBe('channel-1');
      });

      it('should return undefined for non-existent channel', () => {
        const mapping = getMappingByColonyChannel('non-existent');
        expect(mapping).toBeUndefined();
      });
    });

    describe('getMappingCount', () => {
      it('should return correct count of mappings', () => {
        expect(getMappingCount()).toBe(0);
        
        const store = getWhatsAppChannelStore();
        store.set('mapping-1', {
          id: 'mapping-1',
          colonyChannelId: 'channel-1',
          colonyChannelName: 'engineering',
          whatsappGroupId: 'group-1',
          whatsappGroupName: 'Group 1',
          notificationRule: 'all',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        expect(getMappingCount()).toBe(1);
        
        store.set('mapping-2', {
          id: 'mapping-2',
          colonyChannelId: 'channel-2',
          colonyChannelName: 'general',
          whatsappGroupId: 'group-2',
          whatsappGroupName: 'Group 2',
          notificationRule: 'mentions',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        expect(getMappingCount()).toBe(2);
      });
    });

    describe('clearWhatsAppMappings', () => {
      it('should clear all mappings', () => {
        const store = getWhatsAppChannelStore();
        store.set('mapping-1', {
          id: 'mapping-1',
          colonyChannelId: 'channel-1',
          colonyChannelName: 'engineering',
          whatsappGroupId: 'group-1',
          whatsappGroupName: 'Group 1',
          notificationRule: 'all',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        expect(getMappingCount()).toBe(1);
        
        clearWhatsAppMappings();
        
        expect(getMappingCount()).toBe(0);
      });
    });

    describe('getMappingsByNotificationRule', () => {
      it('should return mappings filtered by notification rule', () => {
        const store = getWhatsAppChannelStore();
        
        store.set('mapping-1', {
          id: 'mapping-1',
          colonyChannelId: 'channel-1',
          colonyChannelName: 'engineering',
          whatsappGroupId: 'group-1',
          whatsappGroupName: 'Group 1',
          notificationRule: 'all',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        store.set('mapping-2', {
          id: 'mapping-2',
          colonyChannelId: 'channel-2',
          colonyChannelName: 'general',
          whatsappGroupId: 'group-2',
          whatsappGroupName: 'Group 2',
          notificationRule: 'mentions',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        store.set('mapping-3', {
          id: 'mapping-3',
          colonyChannelId: 'channel-3',
          colonyChannelName: 'random',
          whatsappGroupId: 'group-3',
          whatsappGroupName: 'Group 3',
          notificationRule: 'all',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        const allRule = getMappingsByNotificationRule('all');
        expect(allRule.length).toBe(2);
        
        const mentionsRule = getMappingsByNotificationRule('mentions');
        expect(mentionsRule.length).toBe(1);
      });
    });

    describe('isChannelMapped', () => {
      it('should return true if channel is mapped', () => {
        const store = getWhatsAppChannelStore();
        
        store.set('mapping-1', {
          id: 'mapping-1',
          colonyChannelId: 'channel-1',
          colonyChannelName: 'engineering',
          whatsappGroupId: 'group-1',
          whatsappGroupName: 'Group 1',
          notificationRule: 'all',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        expect(isChannelMapped('channel-1')).toBe(true);
        expect(isChannelMapped('channel-2')).toBe(false);
      });
    });
  });
});
