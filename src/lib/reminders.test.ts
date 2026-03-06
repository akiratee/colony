import { describe, it, expect, beforeEach } from 'vitest';
import { reminderStore } from './reminders';

describe('ReminderStore', () => {
  beforeEach(() => {
    // Clear the store between tests
    reminderStore.clear();
  });

  describe('createReminder', () => {
    it('should create a reminder with all required fields', () => {
      const remindAt = new Date('2029-03-01T10:00:00Z');
      const reminder = reminderStore.createReminder(
        'msg-1',
        'channel-1',
        'user-123',
        'Test User',
        remindAt,
        'Test note'
      );

      expect(reminder.id).toBeDefined();
      expect(reminder.messageId).toBe('msg-1');
      expect(reminder.channelId).toBe('channel-1');
      expect(reminder.userId).toBe('user-123');
      expect(reminder.userName).toBe('Test User');
      expect(reminder.remindAt).toEqual(remindAt);
      expect(reminder.note).toBe('Test note');
      expect(reminder.triggered).toBe(false);
      expect(reminder.createdAt).toBeDefined();
    });

    it('should create a reminder without optional note', () => {
      const remindAt = new Date('2029-03-01T10:00:00Z');
      const reminder = reminderStore.createReminder(
        'msg-1',
        'channel-1',
        'user-123',
        'Test User',
        remindAt
      );

      expect(reminder.note).toBeUndefined();
    });
  });

  describe('getReminder', () => {
    it('should retrieve a reminder by ID', () => {
      const remindAt = new Date('2029-03-01T10:00:00Z');
      const created = reminderStore.createReminder(
        'msg-1',
        'channel-1',
        'user-123',
        'Test User',
        remindAt
      );

      const retrieved = reminderStore.getReminder(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent ID', () => {
      const retrieved = reminderStore.getReminder('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getRemindersByUser', () => {
    it('should return only reminders for the specified user', () => {
      // Create reminders for different users
      reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      reminderStore.createReminder('msg-2', 'channel-1', 'user-2', 'User Two', new Date('2029-03-01T11:00:00Z'));
      reminderStore.createReminder('msg-3', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T12:00:00Z'));

      const userReminders = reminderStore.getRemindersByUser('user-1');
      expect(userReminders).toHaveLength(2);
      expect(userReminders.every((r) => r.userId === 'user-1')).toBe(true);
    });

    it('should not return triggered reminders', () => {
      const reminder = reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      
      // Trigger the reminder
      reminderStore.triggerReminder(reminder.id);

      const userReminders = reminderStore.getRemindersByUser('user-1');
      expect(userReminders).toHaveLength(0);
    });
  });

  describe('getRemindersByChannel', () => {
    it('should return only reminders for the specified channel', () => {
      reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      reminderStore.createReminder('msg-2', 'channel-2', 'user-1', 'User One', new Date('2029-03-01T11:00:00Z'));

      const channelReminders = reminderStore.getRemindersByChannel('channel-1');
      expect(channelReminders).toHaveLength(1);
      expect(channelReminders[0].channelId).toBe('channel-1');
    });
  });

  describe('getDueReminders', () => {
    it('should return reminders that are past their remindAt time', () => {
      // Create a past reminder
      const pastDate = new Date('2020-01-01T10:00:00Z');
      reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', pastDate);

      // Create a future reminder
      const futureDate = new Date('2030-01-01T10:00:00Z');
      reminderStore.createReminder('msg-2', 'channel-1', 'user-1', 'User One', futureDate);

      const dueReminders = reminderStore.getDueReminders();
      expect(dueReminders).toHaveLength(1);
      expect(dueReminders[0].messageId).toBe('msg-1');
    });
  });

  describe('getUpcomingReminders', () => {
    it('should return future reminders sorted by time', () => {
      // Use dates in 2029 to avoid timezone issues (current date is March 2026)
      reminderStore.createReminder('msg-3', 'channel-1', 'user-1', 'User One', new Date('2029-03-03T10:00:00Z'));
      reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      reminderStore.createReminder('msg-2', 'channel-1', 'user-1', 'User One', new Date('2029-03-02T10:00:00Z'));

      const upcoming = reminderStore.getUpcomingReminders();
      expect(upcoming).toHaveLength(3);
      // Should be sorted by remindAt ascending
      expect(upcoming[0].messageId).toBe('msg-1');
      expect(upcoming[1].messageId).toBe('msg-2');
      expect(upcoming[2].messageId).toBe('msg-3');
    });

    it('should respect the limit parameter', () => {
      reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      reminderStore.createReminder('msg-2', 'channel-1', 'user-1', 'User One', new Date('2029-03-02T10:00:00Z'));
      reminderStore.createReminder('msg-3', 'channel-1', 'user-1', 'User One', new Date('2029-03-03T10:00:00Z'));

      const upcoming = reminderStore.getUpcomingReminders(2);
      expect(upcoming).toHaveLength(2);
    });
  });

  describe('triggerReminder', () => {
    it('should mark a reminder as triggered', () => {
      // Use 2029 to avoid timezone issues
      const reminder = reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      
      expect(reminder.triggered).toBe(false);
      
      const triggered = reminderStore.triggerReminder(reminder.id);
      
      expect(triggered?.triggered).toBe(true);
    });

    it('should return null for non-existent reminder', () => {
      const result = reminderStore.triggerReminder('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('deleteReminder', () => {
    it('should delete a reminder', () => {
      const reminder = reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      
      const deleted = reminderStore.deleteReminder(reminder.id);
      
      expect(deleted).toBe(true);
      expect(reminderStore.getReminder(reminder.id)).toBeUndefined();
    });

    it('should return false for non-existent reminder', () => {
      const deleted = reminderStore.deleteReminder('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteRemindersByMessage', () => {
    it('should delete all reminders for a message', () => {
      reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T10:00:00Z'));
      reminderStore.createReminder('msg-1', 'channel-2', 'user-2', 'User Two', new Date('2029-03-01T11:00:00Z'));
      reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', new Date('2029-03-01T12:00:00Z'));

      const deletedCount = reminderStore.deleteRemindersByMessage('msg-1');
      
      expect(deletedCount).toBe(3);
    });
  });

  describe('toResponse', () => {
    it('should convert reminder to response format with ISO dates', () => {
      const remindAt = new Date('2029-03-01T10:00:00Z');
      const createdAt = new Date('2029-02-27T10:00:00Z');
      const reminder = reminderStore.createReminder('msg-1', 'channel-1', 'user-1', 'User One', remindAt);
      reminder.createdAt = createdAt;

      const response = reminderStore.toResponse(reminder);

      expect(response.remindAt).toBe('2029-03-01T10:00:00.000Z');
      expect(response.createdAt).toBe('2029-02-27T10:00:00.000Z');
      expect(typeof response.id).toBe('string');
    });
  });
});
