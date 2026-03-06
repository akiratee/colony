// User Preferences Tests for Colony

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserPreferences,
  updateUserPreferences,
  getChannelNotificationLevel,
  setChannelNotificationLevel,
  resetUserPreferences,
  defaultPreferences,
} from './user-preferences';

describe('User Preferences', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    // Reset preferences before each test
    resetUserPreferences(testUserId);
  });

  describe('getUserPreferences', () => {
    it('should return default preferences for new user', () => {
      const prefs = getUserPreferences(testUserId);
      
      expect(prefs.userId).toBe(testUserId);
      expect(prefs.theme).toBe('system');
      expect(prefs.notificationLevel).toBe('all');
      expect(prefs.messagePreview).toBe(true);
      expect(prefs.soundEnabled).toBe(true);
      expect(prefs.timezone).toBe('America/Los_Angeles');
      expect(prefs.language).toBe('en');
      expect(prefs.channelNotifications).toEqual({});
    });

    it('should return existing preferences for returning user', () => {
      updateUserPreferences(testUserId, { theme: 'dark' });
      const prefs = getUserPreferences(testUserId);
      
      expect(prefs.theme).toBe('dark');
    });
  });

  describe('updateUserPreferences', () => {
    it('should update theme preference', () => {
      const prefs = updateUserPreferences(testUserId, { theme: 'dark' });
      
      expect(prefs.theme).toBe('dark');
      expect(prefs.notificationLevel).toBe('all'); // unchanged
    });

    it('should update notification level', () => {
      const prefs = updateUserPreferences(testUserId, { notificationLevel: 'mentions' });
      
      expect(prefs.notificationLevel).toBe('mentions');
    });

    it('should update multiple preferences at once', () => {
      const prefs = updateUserPreferences(testUserId, {
        theme: 'light',
        soundEnabled: false,
        timezone: 'Europe/London',
      });
      
      expect(prefs.theme).toBe('light');
      expect(prefs.soundEnabled).toBe(false);
      expect(prefs.timezone).toBe('Europe/London');
    });

    it('should merge channel notifications', () => {
      // First update
      updateUserPreferences(testUserId, {
        channelNotifications: { 'channel-1': 'mentions' },
      });
      
      // Second update should merge
      const prefs = updateUserPreferences(testUserId, {
        channelNotifications: { 'channel-2': 'none' },
      });
      
      expect(prefs.channelNotifications).toEqual({
        'channel-1': 'mentions',
        'channel-2': 'none',
      });
    });

    it('should update updatedAt timestamp', () => {
      const before = new Date();
      const prefs = updateUserPreferences(testUserId, { theme: 'dark' });
      const after = new Date();
      
      expect(prefs.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(prefs.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('getChannelNotificationLevel', () => {
    it('should return global notification level by default', () => {
      updateUserPreferences(testUserId, { notificationLevel: 'mentions' });
      
      const level = getChannelNotificationLevel(testUserId, 'any-channel');
      
      expect(level).toBe('mentions');
    });

    it('should return channel-specific override when set', () => {
      updateUserPreferences(testUserId, { notificationLevel: 'all' });
      setChannelNotificationLevel(testUserId, 'specific-channel', 'none');
      
      const globalLevel = getChannelNotificationLevel(testUserId, 'other-channel');
      const specificLevel = getChannelNotificationLevel(testUserId, 'specific-channel');
      
      expect(globalLevel).toBe('all');
      expect(specificLevel).toBe('none');
    });
  });

  describe('setChannelNotificationLevel', () => {
    it('should set channel-specific notification level', () => {
      const prefs = setChannelNotificationLevel(testUserId, 'my-channel', 'none');
      
      expect(prefs.channelNotifications['my-channel']).toBe('none');
    });

    it('should not affect other channels', () => {
      setChannelNotificationLevel(testUserId, 'channel-1', 'none');
      const prefs = setChannelNotificationLevel(testUserId, 'channel-2', 'mentions');
      
      expect(prefs.channelNotifications['channel-1']).toBe('none');
      expect(prefs.channelNotifications['channel-2']).toBe('mentions');
    });
  });

  describe('resetUserPreferences', () => {
    it('should reset preferences to defaults', () => {
      updateUserPreferences(testUserId, {
        theme: 'dark',
        notificationLevel: 'none',
        soundEnabled: false,
      });
      
      const prefs = resetUserPreferences(testUserId);
      
      expect(prefs.theme).toBe('system');
      expect(prefs.notificationLevel).toBe('all');
      expect(prefs.soundEnabled).toBe(true);
    });
  });
});
