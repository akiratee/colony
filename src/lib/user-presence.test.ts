// User Presence Tests for Colony

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setUserStatus,
  getUserPresence,
  getAllPresence,
  getUsersByStatus,
  markUserAway,
  markUserOffline,
  updateLastSeen,
  clearPresenceStore,
  getOnlineCount,
  getPresenceStats,
  type UserStatus,
} from './user-presence';

describe('User Presence', () => {
  const testUserId = 'user-presence-test-123';
  const testUserName = 'Test User';

  beforeEach(() => {
    // Clear presence store before each test
    clearPresenceStore();
  });

  describe('setUserStatus', () => {
    it('should set user online status', () => {
      const presence = setUserStatus(testUserId, testUserName, 'online');

      expect(presence.userId).toBe(testUserId);
      expect(presence.userName).toBe(testUserName);
      expect(presence.status).toBe('online');
      expect(presence.lastSeen).toBeInstanceOf(Date);
    });

    it('should set user offline status', () => {
      const presence = setUserStatus(testUserId, testUserName, 'offline');

      expect(presence.status).toBe('offline');
    });

    it('should set user away status', () => {
      const presence = setUserStatus(testUserId, testUserName, 'away');

      expect(presence.status).toBe('away');
    });

    it('should set platform when provided', () => {
      const presence = setUserStatus(testUserId, testUserName, 'online', 'mobile');

      expect(presence.platform).toBe('mobile');
    });

    it('should update existing user status', () => {
      setUserStatus(testUserId, testUserName, 'online');
      const updated = setUserStatus(testUserId, testUserName, 'away');

      expect(updated.status).toBe('away');
      expect(updated.userId).toBe(testUserId);
    });

    it('should update lastSeen on status change', async () => {
      setUserStatus(testUserId, testUserName, 'online');
      await new Promise(resolve => setTimeout(resolve, 10));
      const updated = setUserStatus(testUserId, testUserName, 'away');

      expect(updated.lastSeen.getTime()).toBeGreaterThanOrEqual(
        new Date().getTime() - 20
      );
    });
  });

  describe('getUserPresence', () => {
    it('should return undefined for non-existent user', () => {
      const presence = getUserPresence('non-existent-user');

      expect(presence).toBeUndefined();
    });

    it('should return user presence for existing user', () => {
      setUserStatus(testUserId, testUserName, 'online');
      const presence = getUserPresence(testUserId);

      expect(presence).toBeDefined();
      expect(presence?.userId).toBe(testUserId);
      expect(presence?.status).toBe('online');
    });

    it('should auto-mark as away after timeout', async () => {
      // Set user online
      setUserStatus(testUserId, testUserName, 'online');

      // Manually manipulate the lastSeen to simulate timeout
      const presence = getUserPresence(testUserId);
      if (presence) {
        const oldLastSeen = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
        (presence as any).lastSeen = oldLastSeen;
      }

      // Get presence again - should auto-update to away
      const updated = getUserPresence(testUserId);
      expect(updated?.status).toBe('away');
    });

    it('should not auto-timeout offline users', () => {
      setUserStatus(testUserId, testUserName, 'offline');
      
      const presence = getUserPresence(testUserId);
      expect(presence?.status).toBe('offline');
    });
  });

  describe('getAllPresence', () => {
    it('should return empty array when no users', () => {
      const all = getAllPresence();

      expect(all).toEqual([]);
    });

    it('should return all user presences', () => {
      setUserStatus('user-1', 'User One', 'online');
      setUserStatus('user-2', 'User Two', 'away');
      setUserStatus('user-3', 'User Three', 'offline');

      const all = getAllPresence();

      expect(all.length).toBe(3);
    });

    it('should filter out expired online users', async () => {
      setUserStatus('user-1', 'User One', 'online');
      
      // Simulate timeout by directly manipulating store
      const presence = getUserPresence('user-1');
      if (presence) {
        (presence as any).lastSeen = new Date(Date.now() - 10 * 60 * 1000);
      }

      const all = getAllPresence();
      expect(all[0].status).toBe('away');
    });
  });

  describe('getUsersByStatus', () => {
    it('should return only online users', () => {
      setUserStatus('user-1', 'User One', 'online');
      setUserStatus('user-2', 'User Two', 'online');
      setUserStatus('user-3', 'User Three', 'away');

      const online = getUsersByStatus('online');

      expect(online.length).toBe(2);
      expect(online.every(p => p.status === 'online')).toBe(true);
    });

    it('should return only offline users', () => {
      setUserStatus('user-1', 'User One', 'offline');
      setUserStatus('user-2', 'User Two', 'online');
      setUserStatus('user-3', 'User Three', 'offline');

      const offline = getUsersByStatus('offline');

      expect(offline.length).toBe(2);
      expect(offline.every(p => p.status === 'offline')).toBe(true);
    });

    it('should return only away users', () => {
      setUserStatus('user-1', 'User One', 'away');
      setUserStatus('user-2', 'User Two', 'online');

      const away = getUsersByStatus('away');

      expect(away.length).toBe(1);
      expect(away[0].userId).toBe('user-1');
    });
  });

  describe('markUserAway', () => {
    it('should mark existing user as away', () => {
      setUserStatus(testUserId, testUserName, 'online');
      const presence = markUserAway(testUserId);

      expect(presence?.status).toBe('away');
    });

    it('should return null for non-existent user', () => {
      const presence = markUserAway('non-existent');

      expect(presence).toBeNull();
    });

    it('should update lastSeen timestamp', async () => {
      setUserStatus(testUserId, testUserName, 'online');
      await new Promise(resolve => setTimeout(resolve, 10));
      const presence = markUserAway(testUserId);

      expect(presence?.lastSeen.getTime()).toBeGreaterThanOrEqual(
        Date.now() - 20
      );
    });
  });

  describe('markUserOffline', () => {
    it('should mark existing user as offline', () => {
      setUserStatus(testUserId, testUserName, 'online');
      const presence = markUserOffline(testUserId);

      expect(presence?.status).toBe('offline');
    });

    it('should return null for non-existent user', () => {
      const presence = markUserOffline('non-existent');

      expect(presence).toBeNull();
    });

    it('should preserve user info when marking offline', () => {
      setUserStatus(testUserId, testUserName, 'online', 'web');
      const presence = markUserOffline(testUserId);

      expect(presence?.userId).toBe(testUserId);
      expect(presence?.userName).toBe(testUserName);
      expect(presence?.platform).toBe('web');
    });
  });

  describe('updateLastSeen', () => {
    it('should update lastSeen timestamp', async () => {
      setUserStatus(testUserId, testUserName, 'online');
      await new Promise(resolve => setTimeout(resolve, 10));
      const presence = updateLastSeen(testUserId);

      expect(presence?.lastSeen).toBeInstanceOf(Date);
    });

    it('should return null for non-existent user', () => {
      const presence = updateLastSeen('non-existent');

      expect(presence).toBeNull();
    });

    it('should restore away user to online', () => {
      setUserStatus(testUserId, testUserName, 'away');
      const presence = updateLastSeen(testUserId);

      expect(presence?.status).toBe('online');
    });

    it('should keep online user as online', () => {
      setUserStatus(testUserId, testUserName, 'online');
      const presence = updateLastSeen(testUserId);

      expect(presence?.status).toBe('online');
    });
  });

  describe('clearPresenceStore', () => {
    it('should clear all presence data', () => {
      setUserStatus('user-1', 'User One', 'online');
      setUserStatus('user-2', 'User Two', 'away');

      clearPresenceStore();

      expect(getAllPresence()).toEqual([]);
    });
  });

  describe('getOnlineCount', () => {
    it('should return 0 when no users', () => {
      const count = getOnlineCount();

      expect(count).toBe(0);
    });

    it('should count only online users', () => {
      setUserStatus('user-1', 'User One', 'online');
      setUserStatus('user-2', 'User Two', 'online');
      setUserStatus('user-3', 'User Three', 'away');
      setUserStatus('user-4', 'User Four', 'offline');

      const count = getOnlineCount();

      expect(count).toBe(2);
    });
  });

  describe('getPresenceStats', () => {
    it('should return correct counts', () => {
      setUserStatus('user-1', 'User One', 'online');
      setUserStatus('user-2', 'User Two', 'online');
      setUserStatus('user-3', 'User Three', 'away');
      setUserStatus('user-4', 'User Four', 'away');
      setUserStatus('user-5', 'User Five', 'offline');

      const stats = getPresenceStats();

      expect(stats.online).toBe(2);
      expect(stats.away).toBe(2);
      expect(stats.offline).toBe(1);
    });

    it('should return zeros when no users', () => {
      const stats = getPresenceStats();

      expect(stats.online).toBe(0);
      expect(stats.away).toBe(0);
      expect(stats.offline).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle many users', () => {
      for (let i = 0; i < 100; i++) {
        setUserStatus(`user-${i}`, `User ${i}`, 'online');
      }

      const count = getOnlineCount();
      expect(count).toBe(100);
    });

    it('should handle status changes', () => {
      setUserStatus(testUserId, testUserName, 'online');
      expect(getUserPresence(testUserId)?.status).toBe('online');

      markUserAway(testUserId);
      expect(getUserPresence(testUserId)?.status).toBe('away');

      updateLastSeen(testUserId);
      expect(getUserPresence(testUserId)?.status).toBe('online');

      markUserOffline(testUserId);
      expect(getUserPresence(testUserId)?.status).toBe('offline');
    });

    it('should handle platform variations', () => {
      const webPresence = setUserStatus('user-1', 'User 1', 'online', 'web');
      const mobilePresence = setUserStatus('user-2', 'User 2', 'online', 'mobile');
      const whatsappPresence = setUserStatus('user-3', 'User 3', 'online', 'whatsapp');

      expect(webPresence.platform).toBe('web');
      expect(mobilePresence.platform).toBe('mobile');
      expect(whatsappPresence.platform).toBe('whatsapp');
    });
  });
});
