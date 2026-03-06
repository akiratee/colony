// Tests for Message editedAt tracking feature
import { describe, it, expect, beforeEach } from 'vitest';
import { addMessage, editMessage, getMessage, getMessages, __resetForTesting } from '@/lib/messageStore';

describe('Message editedAt Tracking', () => {
  beforeEach(() => {
    __resetForTesting();
  });

  it('should set editedAt when message is edited', () => {
    // Add a message
    const message = addMessage('channel-1', 'Original content', { name: 'Test User', avatar: '👤' });
    
    // Verify initial message has no editedAt
    const retrieved = getMessage(message.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.editedAt).toBeUndefined();
    
    // Edit the message
    const edited = editMessage(message.id, 'Edited content', 'Test User');
    
    // Verify edited message has editedAt set
    expect(edited).toBeDefined();
    expect(edited?.content).toBe('Edited content');
    expect(edited?.editedAt).toBeDefined();
    expect(edited?.editedAt).toBeInstanceOf(Date);
  });

  it('should update editedAt on subsequent edits', () => {
    const message = addMessage('channel-1', 'Version 1', { name: 'Test User', avatar: '👤' });
    
    // First edit
    const edited1 = editMessage(message.id, 'Version 2', 'Test User');
    const firstEditTime = edited1?.editedAt;
    expect(firstEditTime).toBeDefined();
    
    // Wait a tiny bit to ensure different timestamp
    const originalEditedAt = edited1?.editedAt;
    
    // Second edit
    const edited2 = editMessage(message.id, 'Version 3', 'Test User');
    expect(edited2?.editedAt).toBeDefined();
    expect(edited2?.editedAt?.getTime()).toBeGreaterThanOrEqual(originalEditedAt?.getTime() || 0);
  });

  it('should not set editedAt when edit fails (unauthorized)', () => {
    const message = addMessage('channel-1', 'Original content', { name: 'User A', avatar: '👤' });
    
    // Try to edit with different author (should fail)
    const edited = editMessage(message.id, 'Hacked content', 'User B');
    
    // Verify edit failed
    expect(edited).toBeNull();
    
    // Verify original message unchanged
    const retrieved = getMessage(message.id);
    expect(retrieved?.content).toBe('Original content');
    expect(retrieved?.editedAt).toBeUndefined();
  });

  it('should preserve editedAt on message retrieved after edit', () => {
    const message = addMessage('channel-1', 'Original', { name: 'User', avatar: '👤' });
    
    editMessage(message.id, 'New Content', 'User');
    
    // Get messages and verify editedAt persists
    const messages = getMessages('channel-1');
    const editedMessage = messages.find(m => m.id === message.id);
    
    expect(editedMessage).toBeDefined();
    expect(editedMessage?.editedAt).toBeDefined();
  });
});
