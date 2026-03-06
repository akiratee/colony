import { describe, it, expect, beforeEach } from 'vitest';
import { addMessage, markMessageSeen, markChannelSeen, getMessages, __resetForTesting } from './messageStore';
import type { Author } from './types';

describe('Message Read Receipts', () => {
  const testAuthor: Author = { name: 'TestUser', avatar: '👤' };
  const testAuthor2: Author = { name: 'AnotherUser', avatar: '👤' };
  
  beforeEach(() => {
    __resetForTesting();
  });
  
  it('should mark a message as seen by a user', () => {
    const message = addMessage('channel-1', 'Hello world', testAuthor);
    
    const result = markMessageSeen(message.id, 'User1');
    
    expect(result).not.toBeNull();
    expect(result?.seenBy).toContain('User1');
  });
  
  it('should allow multiple users to see the same message', () => {
    const message = addMessage('channel-1', 'Hello world', testAuthor);
    
    markMessageSeen(message.id, 'User1');
    markMessageSeen(message.id, 'User2');
    markMessageSeen(message.id, 'User3');
    
    expect(message.seenBy).toHaveLength(3);
    expect(message.seenBy).toContain('User1');
    expect(message.seenBy).toContain('User2');
    expect(message.seenBy).toContain('User3');
  });
  
  it('should not add duplicate users to seenBy', () => {
    const message = addMessage('channel-1', 'Hello world', testAuthor);
    
    markMessageSeen(message.id, 'User1');
    markMessageSeen(message.id, 'User1');
    markMessageSeen(message.id, 'User1');
    
    expect(message.seenBy).toHaveLength(1);
  });
  
  it('should return null for non-existent message', () => {
    const result = markMessageSeen('non-existent-id', 'User1');
    
    expect(result).toBeNull();
  });
  
  it('should mark all messages in a channel as seen', () => {
    addMessage('channel-1', 'Message 1', testAuthor);
    addMessage('channel-1', 'Message 2', testAuthor2);
    addMessage('channel-1', 'Message 3', testAuthor);
    addMessage('channel-2', 'Different channel', testAuthor);
    
    const markedCount = markChannelSeen('channel-1', 'User1');
    
    expect(markedCount).toBe(3);
    
    const channelMessages = getMessages('channel-1');
    channelMessages.forEach(m => {
      expect(m.seenBy).toContain('User1');
    });
    
    // Channel 2 should not be affected
    const channel2Messages = getMessages('channel-2');
    expect(channel2Messages[0].seenBy).toBeUndefined();
  });
  
  it('should mark messages up to a specific message', () => {
    const msg1 = addMessage('channel-1', 'Message 1', testAuthor);
    const msg2 = addMessage('channel-1', 'Message 2', testAuthor2);
    const msg3 = addMessage('channel-1', 'Message 3', testAuthor);
    
    const markedCount = markChannelSeen('channel-1', 'User1', msg2.id);
    
    expect(markedCount).toBe(2);
    
    // msg1 and msg2 should be seen, msg3 should NOT be seen
    const m1 = getMessages('channel-1').find(m => m.id === msg1.id);
    const m2 = getMessages('channel-1').find(m => m.id === msg2.id);
    const m3 = getMessages('channel-1').find(m => m.id === msg3.id);
    
    expect(m1?.seenBy).toContain('User1');
    expect(m2?.seenBy).toContain('User1');
    expect(m3?.seenBy).toBeUndefined(); // Not seen because it's after the cutoff
  });
  
  it('should handle empty seenBy initially', () => {
    const message = addMessage('channel-1', 'Hello world', testAuthor);
    
    expect(message.seenBy).toBeUndefined();
  });
  
  it('should persist seenBy across multiple operations', () => {
    const message = addMessage('channel-1', 'Hello world', testAuthor);
    
    markMessageSeen(message.id, 'User1');
    markMessageSeen(message.id, 'User2');
    
    // Get the message again (should be the same reference)
    const retrieved = getMessages('channel-1')[0];
    
    expect(retrieved.seenBy).toHaveLength(2);
  });
});
