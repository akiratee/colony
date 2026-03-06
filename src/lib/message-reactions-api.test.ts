// Message Reactions API Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { addMessage, addReaction, getMessage, __resetForTesting } from './messageStore';
import type { Author } from './types';

describe('Message Reactions API', () => {
  beforeEach(() => {
    __resetForTesting();
  });
  
  const testAuthor: Author = { name: 'Vincent', avatar: '👨‍💻' };
  
  it('should add a new reaction to a message', () => {
    const message = addMessage('general', 'Hello team', testAuthor);
    const result = addReaction(message.id, '👍', 'Vincent');
    
    expect(result).not.toBeNull();
    expect(result?.reactions).toBeDefined();
    expect(result?.reactions?.length).toBe(1);
    expect(result?.reactions?.[0].emoji).toBe('👍');
    expect(result?.reactions?.[0].users).toContain('Vincent');
    expect(result?.reactions?.[0].count).toBe(1);
  });
  
  it('should toggle off a reaction when user reacts again', () => {
    const message = addMessage('general', 'Hello team', testAuthor);
    addReaction(message.id, '👍', 'Vincent');
    const result = addReaction(message.id, '👍', 'Vincent');
    
    expect(result?.reactions?.length).toBe(0);
  });
  
  it('should allow multiple users to react with the same emoji', () => {
    const message = addMessage('general', 'Hello team', testAuthor);
    addReaction(message.id, '👍', 'Vincent');
    const result = addReaction(message.id, '👍', 'Yilong');
    
    expect(result?.reactions?.length).toBe(1);
    expect(result?.reactions?.[0].count).toBe(2);
    expect(result?.reactions?.[0].users).toContain('Vincent');
    expect(result?.reactions?.[0].users).toContain('Yilong');
  });
  
  it('should support multiple different emojis on one message', () => {
    const message = addMessage('general', 'Hello team', testAuthor);
    addReaction(message.id, '👍', 'Vincent');
    addReaction(message.id, '❤️', 'Yilong');
    addReaction(message.id, '😂', 'Dan');
    
    const result = getMessage(message.id);
    
    expect(result?.reactions?.length).toBe(3);
    // Check that all 3 emojis are present (sort order may vary by Unicode)
    const emojis = result?.reactions?.map(r => r.emoji) || [];
    expect(emojis).toContain('👍');
    expect(emojis).toContain('❤️');
    expect(emojis).toContain('😂');
  });
  
  it('should return null for non-existent message', () => {
    const result = addReaction('non-existent', '👍', 'Vincent');
    expect(result).toBeNull();
  });
  
  it('should handle reaction on message with no prior reactions', () => {
    const message = addMessage('general', 'Hello team', testAuthor);
    expect(message.reactions).toBeUndefined();
    
    const result = addReaction(message.id, '🚀', 'Vincent');
    expect(result?.reactions?.length).toBe(1);
    expect(result?.reactions?.[0].emoji).toBe('🚀');
  });
  
  it('should remove reaction when last user removes it', () => {
    const message = addMessage('general', 'Hello team', testAuthor);
    addReaction(message.id, '👍', 'Vincent');
    addReaction(message.id, '👍', 'Yilong');
    
    // Vincent removes their reaction
    const result = addReaction(message.id, '👍', 'Vincent');
    
    // Should still have 1 user (Yilong)
    expect(result?.reactions?.length).toBe(1);
    expect(result?.reactions?.[0].users).toContain('Yilong');
    expect(result?.reactions?.[0].users).not.toContain('Vincent');
    
    // Yilong removes their reaction
    const final = addReaction(message.id, '👍', 'Yilong');
    
    // Should have no reactions
    expect(final?.reactions?.length).toBe(0);
  });
});
