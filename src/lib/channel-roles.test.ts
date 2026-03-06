import { describe, it, expect, beforeEach } from 'vitest';
import {
  getChannelRole,
  hasChannelRole,
  canManageChannel,
  canDeleteChannel,
  setChannelRole,
  removeChannelMember,
  getChannelMembers,
  promoteChannelMember,
  demoteChannelMember,
  canInviteToChannel,
  addChannel,
  resetChannels
} from './channelStore';

describe('Channel Role-Based Permissions', () => {
  beforeEach(() => {
    resetChannels();
  });

  describe('getChannelRole', () => {
    it('should return null for user not in channel', () => {
      const channel = addChannel('test-channel', 'Test channel');
      const role = getChannelRole(channel.id, 'user-1');
      expect(role).toBeNull();
    });

    it('should return correct role for member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      const role = getChannelRole(channel.id, 'user-1');
      expect(role).toBe('member');
    });

    it('should return correct role for moderator', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      const role = getChannelRole(channel.id, 'user-1');
      expect(role).toBe('moderator');
    });

    it('should return correct role for admin', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      const role = getChannelRole(channel.id, 'user-1');
      expect(role).toBe('admin');
    });
  });

  describe('hasChannelRole', () => {
    it('should return false for user not in channel', () => {
      const channel = addChannel('test-channel', 'Test channel');
      expect(hasChannelRole(channel.id, 'user-1', 'member')).toBe(false);
    });

    it('should allow member to access member actions', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      expect(hasChannelRole(channel.id, 'user-1', 'member')).toBe(true);
    });

    it('should allow moderator to access member actions', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      expect(hasChannelRole(channel.id, 'user-1', 'member')).toBe(true);
    });

    it('should allow admin to access member actions', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      expect(hasChannelRole(channel.id, 'user-1', 'member')).toBe(true);
    });

    it('should allow moderator to access moderator actions', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      expect(hasChannelRole(channel.id, 'user-1', 'moderator')).toBe(true);
    });

    it('should allow admin to access moderator actions', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      expect(hasChannelRole(channel.id, 'user-1', 'moderator')).toBe(true);
    });

    it('should not allow member to access moderator actions', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      expect(hasChannelRole(channel.id, 'user-1', 'moderator')).toBe(false);
    });

    it('should not allow member to access admin actions', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      expect(hasChannelRole(channel.id, 'user-1', 'admin')).toBe(false);
    });
  });

  describe('canManageChannel', () => {
    it('should return false for non-member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      expect(canManageChannel(channel.id, 'user-1')).toBe(false);
    });

    it('should return false for member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      expect(canManageChannel(channel.id, 'user-1')).toBe(false);
    });

    it('should return true for moderator', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      expect(canManageChannel(channel.id, 'user-1')).toBe(true);
    });

    it('should return true for admin', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      expect(canManageChannel(channel.id, 'user-1')).toBe(true);
    });
  });

  describe('canDeleteChannel', () => {
    it('should return false for member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      expect(canDeleteChannel(channel.id, 'user-1')).toBe(false);
    });

    it('should return false for moderator', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      expect(canDeleteChannel(channel.id, 'user-1')).toBe(false);
    });

    it('should return true for admin', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      expect(canDeleteChannel(channel.id, 'user-1')).toBe(true);
    });
  });

  describe('setChannelRole', () => {
    it('should add new member with role', () => {
      const channel = addChannel('test-channel', 'Test channel');
      const success = setChannelRole(channel.id, 'user-1', 'member');
      expect(success).toBe(true);
      expect(getChannelRole(channel.id, 'user-1')).toBe('member');
    });

    it('should update existing member role', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      const success = setChannelRole(channel.id, 'user-1', 'moderator');
      expect(success).toBe(true);
      expect(getChannelRole(channel.id, 'user-1')).toBe('moderator');
    });

    it('should return false for non-existent channel', () => {
      const success = setChannelRole('non-existent', 'user-1', 'admin');
      expect(success).toBe(false);
    });
  });

  describe('removeChannelMember', () => {
    it('should remove member from channel', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      const success = removeChannelMember(channel.id, 'user-1');
      expect(success).toBe(true);
      expect(getChannelRole(channel.id, 'user-1')).toBeNull();
    });

    it('should return false for non-existent member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      const success = removeChannelMember(channel.id, 'non-existent');
      expect(success).toBe(false);
    });
  });

  describe('getChannelMembers', () => {
    it('should return empty array for channel with no members', () => {
      const channel = addChannel('test-channel', 'Test channel');
      const members = getChannelMembers(channel.id);
      expect(members).toEqual([]);
    });

    it('should return all members with roles', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      setChannelRole(channel.id, 'user-2', 'moderator');
      setChannelRole(channel.id, 'user-3', 'member');
      
      const members = getChannelMembers(channel.id);
      expect(members).toHaveLength(3);
      expect(members.map(m => m.role).sort()).toEqual(['admin', 'member', 'moderator']);
    });
  });

  describe('promoteChannelMember', () => {
    it('should promote member to moderator', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      const success = promoteChannelMember(channel.id, 'user-1');
      expect(success).toBe(true);
      expect(getChannelRole(channel.id, 'user-1')).toBe('moderator');
    });

    it('should promote moderator to admin', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      const success = promoteChannelMember(channel.id, 'user-1');
      expect(success).toBe(true);
      expect(getChannelRole(channel.id, 'user-1')).toBe('admin');
    });

    it('should not promote admin further', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      const success = promoteChannelMember(channel.id, 'user-1');
      expect(success).toBe(false);
      expect(getChannelRole(channel.id, 'user-1')).toBe('admin');
    });

    it('should return false for non-member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      const success = promoteChannelMember(channel.id, 'user-1');
      expect(success).toBe(false);
    });
  });

  describe('demoteChannelMember', () => {
    it('should demote admin to moderator', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      const success = demoteChannelMember(channel.id, 'user-1');
      expect(success).toBe(true);
      expect(getChannelRole(channel.id, 'user-1')).toBe('moderator');
    });

    it('should demote moderator to member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      const success = demoteChannelMember(channel.id, 'user-1');
      expect(success).toBe(true);
      expect(getChannelRole(channel.id, 'user-1')).toBe('member');
    });

    it('should not demote member further', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      const success = demoteChannelMember(channel.id, 'user-1');
      expect(success).toBe(false);
      expect(getChannelRole(channel.id, 'user-1')).toBe('member');
    });
  });

  describe('canInviteToChannel', () => {
    it('should return false for non-member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      expect(canInviteToChannel(channel.id, 'user-1')).toBe(false);
    });

    it('should return false for member', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'member');
      expect(canInviteToChannel(channel.id, 'user-1')).toBe(false);
    });

    it('should return true for moderator', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'moderator');
      expect(canInviteToChannel(channel.id, 'user-1')).toBe(true);
    });

    it('should return true for admin', () => {
      const channel = addChannel('test-channel', 'Test channel');
      setChannelRole(channel.id, 'user-1', 'admin');
      expect(canInviteToChannel(channel.id, 'user-1')).toBe(true);
    });
  });
});
