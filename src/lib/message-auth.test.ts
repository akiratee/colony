import { describe, it, expect, beforeEach } from 'vitest';
import { editMessage, deleteMessage, addMessage, getMessages, getMessageCount, getMessageStore, deleteMessagesByChannel } from './messageStore';

describe('Message Authorization', () => {
  beforeEach(() => {
    // Reset message store
    const store = getMessageStore();
    store.length = 0;
    
    // Add test messages
    addMessage('channel1', 'Hello from Alice', { name: 'Alice', avatar: '👩' });
    addMessage('channel1', 'Hello from Bob', { name: 'Bob', avatar: '👨' });
  });

  describe('editMessage', () => {
    it('should allow editing message without author verification', () => {
      const messages = getMessages('channel1');
      const messageId = messages[0].id;
      
      const result = editMessage(messageId, 'Updated content');
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Updated content');
    });

    it('should allow author to edit their own message', () => {
      const messages = getMessages('channel1');
      const messageId = messages[0].id;
      const authorName = messages[0].author.name;
      
      const result = editMessage(messageId, 'Updated by author', authorName);
      expect(result).not.toBeNull();
      expect(result?.content).toBe('Updated by author');
    });

    it('should deny non-author from editing message', () => {
      const messages = getMessages('channel1');
      const messageId = messages[0].id;
      
      // Alice wrote this message, but Bob is trying to edit it
      const result = editMessage(messageId, 'Bob trying to edit', 'Bob');
      expect(result).toBeNull();
    });

    it('should return null when edit fails due to authorization', () => {
      const messages = getMessages('channel1');
      const messageId = messages[0].id;
      
      const result = editMessage(messageId, 'Hacked!', 'OtherUser');
      expect(result).toBeNull();
    });
  });

  describe('deleteMessage', () => {
    it('should allow deleting message without author verification', () => {
      const messages = getMessages('channel1');
      const messageId = messages[0].id;
      const countBefore = getMessageCount('channel1');
      
      const result = deleteMessage(messageId);
      expect(result).not.toBeNull();
      expect(getMessageCount('channel1')).toBe(countBefore - 1);
    });

    it('should allow author to delete their own message', () => {
      const messages = getMessages('channel1');
      const messageId = messages[0].id;
      const authorName = messages[0].author.name;
      const countBefore = getMessageCount('channel1');
      
      const result = deleteMessage(messageId, authorName);
      expect(result).not.toBeNull();
      expect(getMessageCount('channel1')).toBe(countBefore - 1);
    });

    it('should deny non-author from deleting message', () => {
      const messages = getMessages('channel1');
      const messageId = messages[0].id;
      const countBefore = getMessageCount('channel1');
      
      // Alice wrote this message, but Bob is trying to delete it
      const result = deleteMessage(messageId, 'Bob');
      expect(result).toBeNull();
      expect(getMessageCount('channel1')).toBe(countBefore);
    });
  });

  describe('deleteMessagesByChannel', () => {
    it('should delete all messages in a channel', () => {
      // Add messages to multiple channels
      addMessage('channel1', 'Message 1 in channel1', { name: 'Alice', avatar: '👩' });
      addMessage('channel1', 'Message 2 in channel1', { name: 'Bob', avatar: '👨' });
      addMessage('channel2', 'Message in channel2', { name: 'Charlie', avatar: '🧑' });
      
      expect(getMessageCount('channel1')).toBe(4); // 2 from before + 2 new
      expect(getMessageCount('channel2')).toBe(1);
      
      const deletedCount = deleteMessagesByChannel('channel1');
      
      expect(deletedCount).toBe(4);
      expect(getMessageCount('channel1')).toBe(0);
      expect(getMessageCount('channel2')).toBe(1); // channel2 unaffected
    });

    it('should return 0 when deleting messages from empty channel', () => {
      const deletedCount = deleteMessagesByChannel('non-existent-channel');
      expect(deletedCount).toBe(0);
    });
  });
});
