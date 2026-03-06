// Message Threading Tests
// Tests for threaded/conversation message support

import { describe, it, expect, beforeEach } from 'vitest';
import { addMessage, getMessages, editMessage, deleteMessage, searchMessages, __resetForTesting } from './messageStore';

describe('Message Threading', () => {
  beforeEach(() => {
    // Reset message store for clean test state
    __resetForTesting?.();
  });

  it('should add a message with parentId for threading', () => {
    // First add a parent message
    const parentMessage = addMessage(
      'general',
      'Parent message',
      { name: 'User1', avatar: '' }
    );

    // Add a reply with parentId
    const replyMessage = addMessage(
      'general',
      'Reply message',
      { name: 'User2', avatar: '' },
      parentMessage.id
    );

    expect(replyMessage.parentId).toBe(parentMessage.id);
  });

  it('should retrieve thread replies for a parent message', () => {
    const parentMessage = addMessage(
      'general',
      'Thread starter',
      { name: 'User1', avatar: '' }
    );

    // Add multiple replies
    addMessage(
      'general',
      'Reply 1',
      { name: 'User2', avatar: '' },
      parentMessage.id
    );

    addMessage(
      'general',
      'Reply 2',
      { name: 'User3', avatar: '' },
      parentMessage.id
    );

    const allMessages = getMessages('general');
    const threadReplies = allMessages.filter(m => m.parentId === parentMessage.id);

    expect(threadReplies.length).toBe(2);
  });

  it('should handle nested threads (reply to reply)', () => {
    const parentMessage = addMessage(
      'general',
      'Original',
      { name: 'User1', avatar: '' }
    );

    const reply1 = addMessage(
      'general',
      'First reply',
      { name: 'User2', avatar: '' },
      parentMessage.id
    );

    const reply2 = addMessage(
      'general',
      'Reply to reply',
      { name: 'User3', avatar: '' },
      reply1.id
    );

    expect(reply1.parentId).toBe(parentMessage.id);
    expect(reply2.parentId).toBe(reply1.id);
  });

  it('should filter messages by parentId (exclude threads)', () => {
    addMessage(
      'general',
      'Top level 1',
      { name: 'User1', avatar: '' }
    );

    const parent = addMessage(
      'general',
      'Top level 2',
      { name: 'User1', avatar: '' }
    );

    addMessage(
      'general',
      'Reply',
      { name: 'User2', avatar: '' },
      parent.id
    );

    const allMessages = getMessages('general');
    const topLevel = allMessages.filter(m => !m.parentId);

    expect(topLevel.length).toBe(2);
  });

  it('should handle thread in different channels separately', () => {
    const msg1ChannelA = addMessage(
      'channel-a',
      'Thread in A',
      { name: 'User1', avatar: '' }
    );

    const msg1ChannelB = addMessage(
      'channel-b',
      'Thread in B',
      { name: 'User1', avatar: '' }
    );

    addMessage(
      'channel-a',
      'Reply in A',
      { name: 'User2', avatar: '' },
      msg1ChannelA.id
    );

    const messagesA = getMessages('channel-a');
    const messagesB = getMessages('channel-b');

    expect(messagesA.find(m => m.parentId === msg1ChannelA.id)).toBeDefined();
    expect(messagesB.find(m => m.parentId === msg1ChannelB.id)).toBeUndefined();
  });
});
