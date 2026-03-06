// Channel Store Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getChannels,
  getChannel,
  addChannel,
  updateChannel,
  deleteChannel,
  channelExists,
  getChannelsByCategory,
  getDirectMessages,
  resetChannels
} from './channelStore';

describe('Channel Store', () => {
  beforeEach(() => {
    resetChannels();
  });

  describe('getChannels', () => {
    it('should return all channels', () => {
      const channels = getChannels();
      expect(channels.length).toBeGreaterThan(0);
    });
  });

  describe('getChannel', () => {
    it('should return channel by id', () => {
      const channels = getChannels();
      const channel = getChannel(channels[0].id);
      expect(channel).toBeDefined();
    });

    it('should return undefined for non-existent channel', () => {
      const channel = getChannel('nonexistent');
      expect(channel).toBeUndefined();
    });
  });

  describe('addChannel', () => {
    it('should add a new public channel', () => {
      const added = addChannel('new-channel', 'A new channel');
      
      expect(added.name).toBe('new-channel');
      expect(added.description).toBe('A new channel');
      expect(added.isPrivate).toBe(false);
    });

    it('should add a private channel', () => {
      const added = addChannel('private-channel', 'Private', true, ['user1', 'user2']);
      
      expect(added.isPrivate).toBe(true);
      expect(added.allowedUsers).toEqual(['user1', 'user2']);
    });

    it('should sanitize description', () => {
      const added = addChannel('test', '<script>alert("xss")</script>');
      
      expect(added.description).not.toContain('<script>');
    });

    it('should reject duplicate channel names (case insensitive)', () => {
      addChannel('duplicate', 'First');
      
      expect(() => addChannel('DUPLICATE', 'Second')).toThrow();
    });

    it('should store name in lowercase', () => {
      const added = addChannel('UPPERCASE', 'Test');
      
      expect(added.name).toBe('uppercase');
    });

    it('should accept categoryId', () => {
      const added = addChannel('test-channel', 'Test', false, undefined, 'category-1');
      
      expect(added.categoryId).toBe('category-1');
    });
  });

  describe('updateChannel', () => {
    it('should update channel name', () => {
      const channels = getChannels();
      const updated = updateChannel(channels[0].id, { name: 'updated-name' });
      
      expect(updated?.name).toBe('updated-name');
    });

    it('should update channel description', () => {
      const channels = getChannels();
      const updated = updateChannel(channels[0].id, { description: 'New description' });
      
      expect(updated?.description).toBe('New description');
    });

    it('should return null for non-existent channel', () => {
      const updated = updateChannel('nonexistent', { name: 'test' });
      
      expect(updated).toBeNull();
    });
  });

  describe('deleteChannel', () => {
    it('should delete an existing channel by id', () => {
      const channel = addChannel('to-delete', 'Test');
      const initialCount = getChannels().length;
      const deleted = deleteChannel(channel.id);
      
      expect(deleted).toBe(true);
      expect(getChannels().length).toBe(initialCount - 1);
    });

    it('should return false for non-existent channel', () => {
      const deleted = deleteChannel('nonexistent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('channelExists', () => {
    it('should return true for existing channel by name', () => {
      addChannel('test-channel-exists', 'Test');
      expect(channelExists('test-channel-exists')).toBe(true);
    });

    it('should return false for non-existent channel', () => {
      expect(channelExists('nonexistent')).toBe(false);
    });
  });

  describe('getChannelsByCategory', () => {
    it('should return channels with specific category', () => {
      addChannel('cat-channel-1', 'Test', false, undefined, 'cat-1');
      addChannel('cat-channel-2', 'Test', false, undefined, 'cat-1');
      addChannel('other-channel', 'Test', false, undefined, 'cat-2');
      
      const channels = getChannelsByCategory('cat-1');
      
      expect(channels.length).toBe(2);
    });
  });

  describe('getDirectMessages', () => {
    it('should return only DM channels', () => {
      const dms = getDirectMessages('user-1');
      
      // Check all returned are DM channels
      expect(dms.every(c => c.isDirectMessage === true)).toBe(true);
    });
  });
});
