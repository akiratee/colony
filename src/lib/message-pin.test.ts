import { describe, it, expect, beforeEach } from 'vitest';
import { addMessage, pinMessage, unpinMessage, getPinnedMessages, getMessage, __resetForTesting } from './messageStore';

describe('Message Pinning', () => {
  beforeEach(() => {
    __resetForTesting();
  });

  it('should pin a message', () => {
    const msg = addMessage('general', 'Test message', { name: 'Vincent' });
    
    const pinned = pinMessage(msg.id);
    
    expect(pinned).not.toBeNull();
    expect(pinned?.pinnedAt).toBeDefined();
    expect(pinned?.pinnedAt).toBeInstanceOf(Date);
  });

  it('should return null for non-existent message', () => {
    const result = pinMessage('non-existent-id');
    
    expect(result).toBeNull();
  });

  it('should not change pinnedAt if already pinned', () => {
    const msg = addMessage('general', 'Test message', { name: 'Vincent' });
    
    const firstPin = pinMessage(msg.id);
    const firstPinnedAt = firstPin?.pinnedAt;
    
    const secondPin = pinMessage(msg.id);
    
    expect(secondPin?.pinnedAt).toEqual(firstPinnedAt);
  });

  it('should unpin a message', () => {
    const msg = addMessage('general', 'Test message', { name: 'Vincent' });
    
    pinMessage(msg.id);
    const unpinned = unpinMessage(msg.id);
    
    expect(unpinned).not.toBeNull();
    expect(unpinned?.pinnedAt).toBeUndefined();
  });

  it('should return null for unpin non-existent message', () => {
    const result = unpinMessage('non-existent-id');
    
    expect(result).toBeNull();
  });

  it('should handle unpin if not pinned (idempotent)', () => {
    const msg = addMessage('general', 'Test message', { name: 'Vincent' });
    
    const result = unpinMessage(msg.id);
    
    expect(result).not.toBeNull();
    expect(result?.pinnedAt).toBeUndefined();
  });

  it('should get all pinned messages', () => {
    const msg1 = addMessage('general', 'Message 1', { name: 'Vincent' });
    const msg2 = addMessage('general', 'Message 2', { name: 'Yilong' });
    const msg3 = addMessage('engineering', 'Message 3', { name: 'Dan' });
    
    pinMessage(msg1.id);
    pinMessage(msg2.id);
    pinMessage(msg3.id);
    
    const pinned = getPinnedMessages();
    
    expect(pinned).toHaveLength(3);
  });

  it('should filter pinned messages by channel', () => {
    const msg1 = addMessage('general', 'Message 1', { name: 'Vincent' });
    const msg2 = addMessage('general', 'Message 2', { name: 'Yilong' });
    const msg3 = addMessage('engineering', 'Message 3', { name: 'Dan' });
    
    pinMessage(msg1.id);
    pinMessage(msg2.id);
    pinMessage(msg3.id);
    
    const pinnedGeneral = getPinnedMessages('general');
    
    expect(pinnedGeneral).toHaveLength(2);
  });

  it('should return empty array when no pinned messages', () => {
    const pinned = getPinnedMessages();
    
    expect(pinned).toHaveLength(0);
  });

  it('should sort pinned messages by pinnedAt descending', () => {
    const msg1 = addMessage('general', 'Message 1', { name: 'Vincent' });
    const msg2 = addMessage('general', 'Message 2', { name: 'Yilong' });
    
    pinMessage(msg1.id);
    
    // Small delay to ensure different timestamps
    const pinned1 = getPinnedMessages()[0];
    const msg1PinnedAt = pinned1.pinnedAt;
    
    // Add a delay so msg2 gets a later pinnedAt
    const start = Date.now();
    while (Date.now() - start < 10) { /* busy wait */ }
    
    pinMessage(msg2.id);
    
    const pinned = getPinnedMessages('general');
    
    // Most recently pinned should be first
    expect(pinned[0].id).toBe(msg2.id);
    expect(pinned[1].id).toBe(msg1.id);
    // Verify msg2 was pinned later
    expect(pinned[0].pinnedAt?.getTime()).toBeGreaterThan(pinned[1].pinnedAt?.getTime() || 0);
  });

  it('should preserve message content and other fields when pinning', () => {
    const msg = addMessage('general', 'Important message', { name: 'Vincent', avatar: '👨‍💻' });
    
    const pinned = pinMessage(msg.id);
    
    expect(pinned?.content).toBe('Important message');
    expect(pinned?.author.name).toBe('Vincent');
    expect(pinned?.channelId).toBe('general');
    expect(pinned?.pinnedAt).toBeDefined();
  });
});
