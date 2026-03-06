// Scheduled Messages Store
// Manages scheduled messages that will be sent at a specified time

import type { Message, Author } from './types';
import { generateId } from './id';

export interface ScheduledMessage {
  id: string;
  channelId: string;
  content: string;
  author: Author;
  scheduledAt: Date;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: Date;
}

class ScheduledMessageStore {
  private scheduledMessages: Map<string, ScheduledMessage> = new Map();

  /**
   * Schedule a message to be sent at a specific time
   */
  scheduleMessage(channelId: string, content: string, author: Author, scheduledAt: Date): ScheduledMessage {
    const id = generateId();
    const message: ScheduledMessage = {
      id,
      channelId,
      content,
      author,
      scheduledAt,
      status: 'pending',
      createdAt: new Date(),
    };
    this.scheduledMessages.set(id, message);
    return message;
  }

  /**
   * Get all pending scheduled messages that are due to be sent
   */
  getDueMessages(): ScheduledMessage[] {
    const now = new Date();
    const due: ScheduledMessage[] = [];
    for (const message of this.scheduledMessages.values()) {
      if (message.status === 'pending' && new Date(message.scheduledAt) <= now) {
        due.push(message);
      }
    }
    return due;
  }

  /**
   * Get scheduled messages for a specific channel
   */
  getScheduledMessages(channelId?: string): ScheduledMessage[] {
    const messages: ScheduledMessage[] = [];
    for (const message of this.scheduledMessages.values()) {
      if (message.status === 'pending') {
        if (!channelId || message.channelId === channelId) {
          messages.push(message);
        }
      }
    }
    return messages.sort((a, b) => 
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }

  /**
   * Cancel a scheduled message
   */
  cancelMessage(id: string): boolean {
    const message = this.scheduledMessages.get(id);
    if (message && message.status === 'pending') {
      message.status = 'cancelled';
      return true;
    }
    return false;
  }

  /**
   * Mark a message as sent
   */
  markAsSent(id: string): boolean {
    const message = this.scheduledMessages.get(id);
    if (message && message.status === 'pending') {
      message.status = 'sent';
      return true;
    }
    return false;
  }

  /**
   * Get a specific scheduled message
   */
  getMessage(id: string): ScheduledMessage | undefined {
    return this.scheduledMessages.get(id);
  }

  /**
   * Delete a scheduled message
   */
  deleteMessage(id: string): boolean {
    return this.scheduledMessages.delete(id);
  }

  /**
   * Process all due messages - returns messages that should be sent
   */
  processDueMessages(): ScheduledMessage[] {
    const dueMessages = this.getDueMessages();
    for (const message of dueMessages) {
      this.markAsSent(message.id);
    }
    return dueMessages;
  }

  /**
   * Get count of pending scheduled messages
   */
  getPendingCount(): number {
    let count = 0;
    for (const message of this.scheduledMessages.values()) {
      if (message.status === 'pending') {
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all scheduled messages (for testing)
   */
  clear(): void {
    this.scheduledMessages.clear();
  }
}

// Export singleton instance
export const scheduledMessageStore = new ScheduledMessageStore();
