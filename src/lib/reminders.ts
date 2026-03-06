// Reminder Store - In-memory store for message reminders

import { generateId } from './id';
import type { Reminder, ReminderResponse } from './types';

class ReminderStore {
  private reminders: Map<string, Reminder> = new Map();

  /**
   * Create a new reminder
   */
  createReminder(
    messageId: string,
    channelId: string,
    userId: string,
    userName: string,
    remindAt: Date,
    note?: string
  ): Reminder {
    const reminder: Reminder = {
      id: generateId(),
      messageId,
      channelId,
      userId,
      userName,
      remindAt,
      note,
      createdAt: new Date(),
      triggered: false,
    };

    this.reminders.set(reminder.id, reminder);
    return reminder;
  }

  /**
   * Get reminder by ID
   */
  getReminder(id: string): Reminder | undefined {
    return this.reminders.get(id);
  }

  /**
   * Get all reminders for a user
   */
  getRemindersByUser(userId: string): Reminder[] {
    return Array.from(this.reminders.values())
      .filter((r) => r.userId === userId && !r.triggered)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }

  /**
   * Get all reminders for a channel
   */
  getRemindersByChannel(channelId: string): Reminder[] {
    return Array.from(this.reminders.values())
      .filter((r) => r.channelId === channelId && !r.triggered)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }

  /**
   * Get reminders that are due
   */
  getDueReminders(): Reminder[] {
    const now = new Date();
    return Array.from(this.reminders.values())
      .filter((r) => !r.triggered && r.remindAt <= now)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime());
  }

  /**
   * Get all upcoming reminders (not yet triggered)
   */
  getUpcomingReminders(limit = 50): Reminder[] {
    const now = new Date();
    return Array.from(this.reminders.values())
      .filter((r) => !r.triggered && r.remindAt > now)
      .sort((a, b) => a.remindAt.getTime() - b.remindAt.getTime())
      .slice(0, limit);
  }

  /**
   * Mark a reminder as triggered
   */
  triggerReminder(id: string): Reminder | null {
    const reminder = this.reminders.get(id);
    if (!reminder) {return null;}

    reminder.triggered = true;
    this.reminders.set(id, reminder);
    return reminder;
  }

  /**
   * Delete a reminder
   */
  deleteReminder(id: string): boolean {
    return this.reminders.delete(id);
  }

  /**
   * Delete all reminders for a message
   */
  deleteRemindersByMessage(messageId: string): number {
    const toDelete = Array.from(this.reminders.entries())
      .filter(([, r]) => r.messageId === messageId)
      .map(([id]) => id);

    toDelete.forEach((id) => this.reminders.delete(id));
    return toDelete.length;
  }

  /**
   * Get reminder count
   */
  getCount(): number {
    return this.reminders.size;
  }

  /**
   * Convert reminder to response format
   */
  toResponse(reminder: Reminder): ReminderResponse {
    return {
      id: reminder.id,
      messageId: reminder.messageId,
      channelId: reminder.channelId,
      userId: reminder.userId,
      userName: reminder.userName,
      remindAt: reminder.remindAt.toISOString(),
      note: reminder.note,
      createdAt: reminder.createdAt.toISOString(),
      triggered: reminder.triggered,
    };
  }

  /**
   * Clear all reminders (useful for testing)
   */
  clear(): void {
    this.reminders.clear();
  }
}

// Export singleton instance
export const reminderStore = new ReminderStore();
