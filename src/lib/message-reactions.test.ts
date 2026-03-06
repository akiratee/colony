// Message Reactions Tests
import { describe, it, expect, beforeEach } from 'vitest';
import { addMessage, addReaction, getMessage, resetMessageStore } from './messageStore';

describe('Message Reactions', () => {
  beforeEach(() => {
    resetMessageStore();
  });

  describe('addReaction', () => {
    it('should add a new reaction to a message', () => {
      const message = addMessage('1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      expect(message).toBeDefined();
      
      const reacted = addReaction(message!.id, '👍', 'Vincent');
      expect(reacted).toBeDefined();
      expect(reacted!.reactions).toBeDefined();
      expect(reacted!.reactions!.length).toBe(1);
      expect(reacted!.reactions![0].emoji).toBe('👍');
      expect(reacted!.reactions![0].count).toBe(1);
      expect(reacted!.reactions![0].users).toContain('Vincent');
    });

    it('should toggle reaction when user reacts again', () => {
      const message = addMessage('1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      
      // First reaction
      addReaction(message!.id, '👍', 'Vincent');
      let reacted = getMessage(message!.id);
      expect(reacted!.reactions![0].count).toBe(1);
      
      // Second reaction (toggle off)
      addReaction(message!.id, '👍', 'Vincent');
      reacted = getMessage(message!.id);
      expect(reacted!.reactions!.length).toBe(0); // Reaction removed
    });

    it('should allow multiple users to react with same emoji', () => {
      const message = addMessage('1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      
      addReaction(message!.id, '👍', 'Vincent');
      addReaction(message!.id, '👍', 'Yilong');
      addReaction(message!.id, '👍', 'Dan');
      
      const reacted = getMessage(message!.id);
      expect(reacted!.reactions![0].count).toBe(3);
      expect(reacted!.reactions![0].users).toContain('Vincent');
      expect(reacted!.reactions![0].users).toContain('Yilong');
      expect(reacted!.reactions![0].users).toContain('Dan');
    });

    it('should allow multiple different emojis on same message', () => {
      const message = addMessage('1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      
      addReaction(message!.id, '👍', 'Vincent');
      addReaction(message!.id, '❤️', 'Yilong');
      addReaction(message!.id, '😂', 'Dan');
      
      const reacted = getMessage(message!.id);
      expect(reacted!.reactions!.length).toBe(3);
      expect(reacted!.reactions!.find(r => r.emoji === '👍')?.count).toBe(1);
      expect(reacted!.reactions!.find(r => r.emoji === '❤️')?.count).toBe(1);
      expect(reacted!.reactions!.find(r => r.emoji === '😂')?.count).toBe(1);
    });

    it('should return null for non-existent message', () => {
      const result = addReaction('non-existent', '👍', 'Vincent');
      expect(result).toBeNull();
    });

    it('should handle mixed reactions: some users toggle off, new users add', () => {
      const message = addMessage('1', 'Test message', { name: 'Vincent', avatar: '👨‍💻' });
      
      // Vincent adds 👍
      addReaction(message!.id, '👍', 'Vincent');
      // Yilong adds 👍
      addReaction(message!.id, '👍', 'Yilong');
      // Vincent toggles off 👍
      addReaction(message!.id, '👍', 'Vincent');
      
      const reacted = getMessage(message!.id);
      expect(reacted!.reactions!.length).toBe(1);
      expect(reacted!.reactions![0].emoji).toBe('👍');
      expect(reacted!.reactions![0].count).toBe(1);
      expect(reacted!.reactions![0].users).toContain('Yilong');
      expect(reacted!.reactions![0].users).not.toContain('Vincent');
    });
  });
});
