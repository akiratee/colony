// Message Delete API Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { addMessage, deleteMessage, getMessage, __resetForTesting } from './messageStore';

describe('Message DELETE API', () => {
  beforeEach(() => {
    __resetForTesting();
  });

  describe('deleteMessage function', () => {
    it('should delete a message by id', () => {
      const msg = addMessage('channel-1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      expect(getMessage(msg.id)).toBeDefined();
      
      const deleted = deleteMessage(msg.id);
      expect(deleted).toBeDefined();
      expect(deleted?.id).toBe(msg.id);
      expect(getMessage(msg.id)).toBeUndefined();
    });

    it('should return null for non-existent message', () => {
      const deleted = deleteMessage('non-existent-id');
      expect(deleted).toBeNull();
    });

    it('should verify ownership before deletion', () => {
      const msg = addMessage('channel-1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      
      // Try to delete with wrong author
      const deleted = deleteMessage(msg.id, 'OtherUser');
      expect(deleted).toBeNull();
      
      // Message should still exist
      expect(getMessage(msg.id)).toBeDefined();
    });

    it('should allow owner to delete their message', () => {
      const msg = addMessage('channel-1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      
      // Delete with correct author
      const deleted = deleteMessage(msg.id, 'Vincent');
      expect(deleted).toBeDefined();
      expect(getMessage(msg.id)).toBeUndefined();
    });
  });
});
