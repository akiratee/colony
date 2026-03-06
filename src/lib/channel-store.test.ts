// Channel Store Tests
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getChannels, 
  getChannel, 
  getChannelByName, 
  addChannel, 
  updateChannel, 
  deleteChannel, 
  channelExists,
  getChannelCount,
  resetChannels,
  generateChannelId
} from './channelStore';

describe('Channel Store', () => {
  beforeEach(() => {
    resetChannels();
  });

  describe('getChannels', () => {
    it('should return all channels', () => {
      const channels = getChannels();
      expect(channels.length).toBe(4);
    });

    it('should return a copy, not the original', () => {
      const channels = getChannels();
      channels.push({ id: 'test', name: 'test', description: 'test', createdAt: new Date() });
      const channels2 = getChannels();
      expect(channels2.length).toBe(4);
    });
  });

  describe('getChannel', () => {
    it('should get channel by id', () => {
      const channel = getChannel('1');
      expect(channel).toBeDefined();
      expect(channel?.name).toBe('general');
    });

    it('should get channel by name', () => {
      const channel = getChannel('general');
      expect(channel).toBeDefined();
      expect(channel?.id).toBe('1');
    });

    it('should return undefined for non-existent channel', () => {
      const channel = getChannel('non-existent');
      expect(channel).toBeUndefined();
    });
  });

  describe('getChannelByName', () => {
    it('should find channel by exact name', () => {
      const channel = getChannelByName('engineering');
      expect(channel).toBeDefined();
      expect(channel?.description).toBe('Engineering team chat');
    });

    it('should be case insensitive', () => {
      const channel = getChannelByName('ENGINEERING');
      expect(channel).toBeDefined();
    });
  });

  describe('addChannel', () => {
    it('should add a new channel', () => {
      const initialCount = getChannelCount();
      const newChannel = addChannel('test-channel', 'A test channel');
      
      expect(newChannel).toBeDefined();
      expect(newChannel.name).toBe('test-channel');
      expect(newChannel.description).toBe('A test channel');
      expect(getChannelCount()).toBe(initialCount + 1);
    });

    it('should convert name to lowercase', () => {
      const channel = addChannel('UPPER-CASE', 'Test');
      expect(channel.name).toBe('upper-case');
    });

    it('should throw if channel already exists', () => {
      expect(() => addChannel('general', 'Duplicate')).toThrow();
    });

    it('should allow empty description', () => {
      const channel = addChannel('new-channel');
      expect(channel.description).toBe('');
    });
  });

  describe('updateChannel', () => {
    it('should update channel description', () => {
      const updated = updateChannel('1', { description: 'Updated description' });
      expect(updated).toBeDefined();
      expect(updated?.description).toBe('Updated description');
      expect(updated?.name).toBe('general'); // name unchanged
    });

    it('should return null for non-existent channel', () => {
      const updated = updateChannel('non-existent', { description: 'Test' });
      expect(updated).toBeNull();
    });

    it('should prevent duplicate channel names when updating', () => {
      // Add a new channel first
      addChannel('my-channel', 'My channel');
      
      // Try to rename channel '1' to 'my-channel' (already exists)
      const updated = updateChannel('1', { name: 'my-channel' });
      expect(updated).toBeNull(); // Should fail - duplicate name
      
      // Verify original channel still exists
      expect(getChannel('1')?.name).toBe('general');
    });

    it('should allow updating channel name to unique value', () => {
      const updated = updateChannel('1', { name: 'new-general' });
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('new-general');
    });
  });

  describe('deleteChannel', () => {
    it('should delete a channel', () => {
      const initialCount = getChannelCount();
      const deleted = deleteChannel('1');
      
      expect(deleted).toBe(true);
      expect(getChannelCount()).toBe(initialCount - 1);
      expect(getChannel('1')).toBeUndefined();
    });

    it('should return false for non-existent channel', () => {
      const deleted = deleteChannel('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('channelExists', () => {
    it('should return true for existing channel', () => {
      expect(channelExists('general')).toBe(true);
    });

    it('should return false for non-existent channel', () => {
      expect(channelExists('non-existent')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(channelExists('GENERAL')).toBe(true);
    });
  });

  describe('generateChannelId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateChannelId();
      const id2 = generateChannelId();
      expect(id1).not.toBe(id2);
    });

    it('should generate UUID format', () => {
      const id = generateChannelId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('getChannelCount', () => {
    it('should return correct count', () => {
      expect(getChannelCount()).toBe(4);
    });

    it('should update after adding channel', () => {
      addChannel('test-1');
      expect(getChannelCount()).toBe(5);
    });
  });
});
