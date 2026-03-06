// Message Store Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  addMessage, 
  editMessage, 
  deleteMessage, 
  getMessages, 
  getMessage,
  getMessageCount,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  getThreadReplies,
  deleteMessagesByChannel,
  addReaction,
  searchMessages,
  markMessageSeen,
  markChannelSeen,
  resetMessageStore,
  getMessageStore
} from './messageStore';
import type { Author } from './types';

describe('Message Store', () => {
  const testAuthor: Author = { name: 'TestUser', avatar: '👤' };
  const botAuthor: Author = { name: 'TestBot', avatar: '🤖', isBot: true };

  beforeEach(() => {
    resetMessageStore();
  });

  describe('addMessage', () => {
    it('should add a message to the store', () => {
      const message = addMessage('general', 'Hello world', testAuthor);
      
      expect(message).toBeDefined();
      expect(message.content).toBe('Hello world');
      expect(message.channelId).toBe('general');
      expect(message.author.name).toBe('TestUser');
    });

    it('should generate unique IDs for messages', () => {
      const msg1 = addMessage('general', 'Message 1', testAuthor);
      const msg2 = addMessage('general', 'Message 2', testAuthor);
      
      expect(msg1.id).not.toBe(msg2.id);
    });

    it('should sanitize message content', () => {
      const message = addMessage('general', '<script>alert("xss")</script>', testAuthor);
      
      expect(message.content).not.toContain('<script>');
    });

    it('should support threading with parentId', () => {
      const parent = addMessage('general', 'Parent message', testAuthor);
      const reply = addMessage('general', 'Reply message', testAuthor, parent.id);
      
      expect(reply.parentId).toBe(parent.id);
    });

    it('should respect max messages per channel limit', () => {
      // Add many messages to exceed limit (1000)
      for (let i = 0; i < 1005; i++) {
        addMessage('general', `Message ${i}`, testAuthor);
      }
      
      const count = getMessageCount('general');
      expect(count).toBeLessThanOrEqual(1000);
    });
  });

  describe('editMessage', () => {
    it('should edit an existing message', () => {
      const original = addMessage('general', 'Original', testAuthor);
      const edited = editMessage(original.id, 'Edited');
      
      expect(edited).not.toBeNull();
      expect(edited?.content).toBe('Edited');
      expect(edited?.editedAt).toBeDefined();
    });

    it('should return null for non-existent message', () => {
      const result = editMessage('nonexistent', 'New content');
      
      expect(result).toBeNull();
    });

    it('should verify author ownership when provided', () => {
      const message = addMessage('general', 'Original', testAuthor);
      const edited = editMessage(message.id, 'Hacked', 'DifferentUser');
      
      expect(edited).toBeNull();
    });

    it('should allow edit with correct author', () => {
      const message = addMessage('general', 'Original', testAuthor);
      const edited = editMessage(message.id, 'Updated', 'TestUser');
      
      expect(edited?.content).toBe('Updated');
    });

    it('should reject content exceeding length limit', () => {
      const message = addMessage('general', 'Short', testAuthor);
      const longContent = 'a'.repeat(10001);
      const edited = editMessage(message.id, longContent);
      
      expect(edited).toBeNull();
    });
  });

  describe('deleteMessage', () => {
    it('should delete an existing message', () => {
      const message = addMessage('general', 'To delete', testAuthor);
      const deleted = deleteMessage(message.id);
      
      expect(deleted).not.toBeNull();
      expect(getMessage(message.id)).toBeUndefined();
    });

    it('should return null for non-existent message', () => {
      const result = deleteMessage('nonexistent');
      
      expect(result).toBeNull();
    });

    it('should verify author ownership when provided', () => {
      const message = addMessage('general', 'Test', testAuthor);
      const deleted = deleteMessage(message.id, 'DifferentUser');
      
      expect(deleted).toBeNull();
    });
  });

  describe('getMessages', () => {
    it('should return all messages when no channel specified', () => {
      // There are 4 default messages
      addMessage('general', 'Msg1', testAuthor);
      addMessage('general', 'Msg2', testAuthor);
      addMessage('random', 'Msg3', testAuthor);
      
      const messages = getMessages();
      
      // 4 default + 3 added = 7
      expect(messages.length).toBe(7);
    });

    it('should filter by channelId', () => {
      addMessage('general', 'General msg', testAuthor);
      addMessage('random', 'Random msg', testAuthor);
      
      const generalMsgs = getMessages('general');
      
      expect(generalMsgs.length).toBe(1);
      expect(generalMsgs[0].channelId).toBe('general');
    });

    it('should support pagination with limit and offset', () => {
      for (let i = 0; i < 10; i++) {
        addMessage('general', `Msg${i}`, testAuthor);
      }
      
      const messages = getMessages('general', 3, 2);
      
      expect(messages.length).toBe(3);
      expect(messages[0].content).toBe('Msg2');
    });

    it('should return messages in chronological order', () => {
      addMessage('general', 'First', testAuthor);
      addMessage('general', 'Second', testAuthor);
      addMessage('general', 'Third', testAuthor);
      
      const messages = getMessages('general');
      
      expect(messages[0].content).toBe('First');
      expect(messages[2].content).toBe('Third');
    });
  });

  describe('getMessage', () => {
    it('should return message by ID', () => {
      const added = addMessage('general', 'Test', testAuthor);
      const found = getMessage(added.id);
      
      expect(found).toBeDefined();
      expect(found?.content).toBe('Test');
    });

    it('should return undefined for non-existent ID', () => {
      const result = getMessage('nonexistent');
      
      expect(result).toBeUndefined();
    });
  });

  describe('getMessageCount', () => {
    it('should return total count without channel filter', () => {
      const initialCount = getMessageCount();
      addMessage('general', 'Msg1', testAuthor);
      addMessage('random', 'Msg2', testAuthor);
      
      expect(getMessageCount()).toBe(initialCount + 2);
    });

    it('should return count for specific channel', () => {
      const initialGeneralCount = getMessageCount('general');
      addMessage('general', 'Msg1', testAuthor);
      addMessage('general', 'Msg2', testAuthor);
      addMessage('random', 'Msg3', testAuthor);
      
      expect(getMessageCount('general')).toBe(initialGeneralCount + 2);
    });
  });

  describe('pinMessage', () => {
    it('should pin a message', () => {
      const message = addMessage('general', 'Important!', testAuthor);
      const pinned = pinMessage(message.id);
      
      expect(pinned?.pinnedAt).toBeDefined();
    });

    it('should return null for non-existent message', () => {
      const result = pinMessage('nonexistent');
      
      expect(result).toBeNull();
    });
  });

  describe('unpinMessage', () => {
    it('should unpin a pinned message', () => {
      const message = addMessage('general', 'Important!', testAuthor);
      pinMessage(message.id);
      const unpinned = unpinMessage(message.id);
      
      expect(unpinned?.pinnedAt).toBeUndefined();
    });
  });

  describe('getPinnedMessages', () => {
    it('should return all pinned messages without filter', () => {
      const msg1 = addMessage('general', 'Pinned1', testAuthor);
      const msg2 = addMessage('random', 'Pinned2', testAuthor);
      pinMessage(msg1.id);
      pinMessage(msg2.id);
      
      const pinned = getPinnedMessages();
      
      expect(pinned.length).toBe(2);
    });

    it('should filter pinned messages by channel', () => {
      const msg1 = addMessage('general', 'Pinned1', testAuthor);
      const msg2 = addMessage('random', 'Pinned2', testAuthor);
      pinMessage(msg1.id);
      pinMessage(msg2.id);
      
      const pinned = getPinnedMessages('general');
      
      expect(pinned.length).toBe(1);
    });
  });

  describe('getThreadReplies', () => {
    it('should return replies to a parent message', () => {
      const parent = addMessage('general', 'Parent', testAuthor);
      addMessage('general', 'Reply1', testAuthor, parent.id);
      addMessage('general', 'Reply2', testAuthor, parent.id);
      
      const replies = getThreadReplies(parent.id);
      
      expect(replies.length).toBe(2);
    });

    it('should return empty array for message with no replies', () => {
      const parent = addMessage('general', 'Parent', testAuthor);
      
      const replies = getThreadReplies(parent.id);
      
      expect(replies.length).toBe(0);
    });
  });

  describe('deleteMessagesByChannel', () => {
    it('should delete all messages in a channel', () => {
      addMessage('general', 'Msg1', testAuthor);
      addMessage('general', 'Msg2', testAuthor);
      addMessage('random', 'Msg3', testAuthor);
      
      const deleted = deleteMessagesByChannel('general');
      
      expect(deleted).toBe(2);
      expect(getMessageCount('general')).toBe(0);
      expect(getMessageCount('random')).toBe(1);
    });
  });

  describe('reactions', () => {
    it('should add a reaction to a message', () => {
      const message = addMessage('general', 'Test', testAuthor);
      const result = addReaction(message.id, '👍', 'User1');
      
      expect(result?.reactions).toBeDefined();
      const reaction = result?.reactions?.find((r: any) => r.emoji === '👍');
      expect(reaction).toBeDefined();
      expect(reaction?.users).toContain('User1');
    });
  });

  describe('markMessageSeen', () => {
    it('should mark a message as seen', () => {
      const message = addMessage('general', 'Test', testAuthor);
      const result = markMessageSeen(message.id, 'Viewer');
      
      expect(result?.seenBy).toContain('Viewer');
    });
  });

  describe('markChannelSeen', () => {
    it('should mark channel as seen up to message', () => {
      const msg1 = addMessage('general', 'Msg1', testAuthor);
      const msg2 = addMessage('general', 'Msg2', testAuthor);
      
      const count = markChannelSeen('general', 'Viewer', msg2.id);
      
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('searchMessages', () => {
    it('should find messages containing query', () => {
      addMessage('general', 'Hello world', testAuthor);
      addMessage('general', 'Goodbye world', testAuthor);
      addMessage('general', 'No match here', testAuthor);
      
      const results = searchMessages('world');
      
      expect(results.length).toBe(2);
    });

    it('should be case insensitive', () => {
      addMessage('general', 'HELLO world', testAuthor);
      
      const results = searchMessages('hello');
      
      expect(results.length).toBe(1);
    });

    it('should filter by channel when specified', () => {
      addMessage('general', 'Hello world', testAuthor);
      addMessage('random', 'Hello world', testAuthor);
      
      const results = searchMessages('hello', 'general');
      
      expect(results.length).toBe(1);
    });
  });

  describe('getMessageStore', () => {
    it('should return current message store', () => {
      addMessage('general', 'Test', testAuthor);
      const store = getMessageStore();
      
      expect(store.length).toBeGreaterThan(0);
    });
  });
});
