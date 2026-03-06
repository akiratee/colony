// Shared Message Store
// This module provides a centralized message store that can be imported
// by both the Next.js API routes and the Socket server

import type { Message, Author } from './types';
import { generateId } from './id';
import { sanitizeContent, sanitizeAuthor } from './validation';

export interface MessageStore {
  messages: Message[];
  addMessage(channelId: string, content: string, author: Author): Message;
  editMessage(id: string, content: string): Message | null;
  deleteMessage(id: string): boolean;
  getMessages(channelId?: string, limit?: number, offset?: number): Message[];
  getMessage(id: string): Message | undefined;
  markMessageSeen(messageId: string, userName: string): Message | null;
  markChannelSeen(channelId: string, userName: string, upToMessageId?: string): number;
}

// Default messages for development
const defaultMessages: Message[] = [
  {
    id: '1',
    channelId: '1',
    content: 'Hey team! Just pushed the new authentication flow. Can someone review?',
    author: { name: 'Vincent', avatar: '👨‍💻' },
    timestamp: new Date(Date.now() - 3600000),
  },
  {
    id: '2',
    channelId: '1',
    content: "Sure thing! I'll take a look.",
    author: { name: 'Yilong', avatar: '👨‍🔧' },
    timestamp: new Date(Date.now() - 3000000),
  },
  {
    id: '3',
    channelId: '1',
    content: 'I can run the test suite while Yilong reviews.',
    author: { name: 'Test Bot', avatar: '🧪', isBot: true },
    timestamp: new Date(Date.now() - 2900000),
  },
  {
    id: '4',
    channelId: '1',
    content: "Great! Test Bot found 2 failing tests in auth.spec.ts. Looks like a missing mock.",
    author: { name: 'Test Bot', avatar: '🧪', isBot: true },
    timestamp: new Date(Date.now() - 1800000),
  },
];

// In-memory message store singleton
let messageStore: Message[] = [...defaultMessages];

const MAX_MESSAGES_PER_CHANNEL = 1000;

// Reset function for testing
export function __resetForTesting(): void {
  messageStore = [];
}

// Add a new message - sanitizes content and author for defense in depth
// Supports threading via optional parentId parameter
export function addMessage(
  channelId: string, 
  content: string, 
  author: Author,
  parentId?: string
): Message {
  const message: Message = {
    id: generateId(),
    channelId,
    content: sanitizeContent(content),
    author: sanitizeAuthor(author),
    timestamp: new Date(),
    ...(parentId && { parentId }), // Add parentId if provided for threading
  };
  
  messageStore.push(message);
  
  // Limit messages per channel
  const channelMessages = messageStore.filter(m => m.channelId === channelId);
  if (channelMessages.length > MAX_MESSAGES_PER_CHANNEL) {
    const toRemove = channelMessages
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(0, channelMessages.length - MAX_MESSAGES_PER_CHANNEL);
    
    toRemove.forEach(rm => {
      const idx = messageStore.findIndex(m => m.id === rm.id);
      if (idx !== -1) {messageStore.splice(idx, 1);}
    });
  }
  
  return message;
}

// Edit a message - optionally verify author
export function editMessage(id: string, content: string, authorName?: string): Message | null {
  const messageIndex = messageStore.findIndex(m => m.id === id);
  
  if (messageIndex === -1) {
    return null;
  }
  
  // If authorName provided, verify ownership (for security)
  if (authorName && messageStore[messageIndex].author.name !== authorName) {
    return null; // Not authorized to edit this message
  }
  
  // Sanitize content for defense in depth (API should also sanitize)
  const sanitizedContent = sanitizeContent(content);
  // Validate length after sanitization to prevent bypass (e.g., many '<' chars expand to '&lt;')
  if (sanitizedContent.length > 10000) {
    return null; // Content too long after sanitization
  }
  
  messageStore[messageIndex].content = sanitizedContent;
  messageStore[messageIndex].timestamp = new Date();
  messageStore[messageIndex].editedAt = new Date(); // Track edit timestamp
  
  return messageStore[messageIndex];
}

// Delete a message - optionally verify author
export function deleteMessage(id: string, authorName?: string): Message | null {
  const messageIndex = messageStore.findIndex(m => m.id === id);
  
  if (messageIndex === -1) {
    return null;
  }
  
  // If authorName provided, verify ownership (for security)
  if (authorName && messageStore[messageIndex].author.name !== authorName) {
    return null; // Not authorized to delete this message
  }
  
  const [deleted] = messageStore.splice(messageIndex, 1);
  return deleted;
}

// Pin a message (anyone can pin, for flexibility)
export function pinMessage(id: string): Message | null {
  const messageIndex = messageStore.findIndex(m => m.id === id);
  
  if (messageIndex === -1) {
    return null;
  }
  
  // Already pinned
  if (messageStore[messageIndex].pinnedAt) {
    return messageStore[messageIndex];
  }
  
  messageStore[messageIndex].pinnedAt = new Date();
  return messageStore[messageIndex];
}

// Unpin a message
export function unpinMessage(id: string): Message | null {
  const messageIndex = messageStore.findIndex(m => m.id === id);
  
  if (messageIndex === -1) {
    return null;
  }
  
  // Not pinned
  if (!messageStore[messageIndex].pinnedAt) {
    return messageStore[messageIndex];
  }
  
  delete messageStore[messageIndex].pinnedAt;
  return messageStore[messageIndex];
}

// Get pinned messages for a channel
export function getPinnedMessages(channelId?: string): Message[] {
  let pinned = messageStore.filter(m => m.pinnedAt !== undefined);
  
  if (channelId) {
    pinned = pinned.filter(m => m.channelId === channelId);
  }
  
  // Sort by pinnedAt descending (most recently pinned first)
  pinned.sort((a, b) => new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime());
  
  return pinned;
}

// Get messages, optionally filtered by channel
export function getMessages(channelId?: string, limit = 50, offset = 0): Message[] {
  const filtered = channelId 
    ? messageStore.filter(m => m.channelId === channelId)
    : [...messageStore];
  
  // Sort by timestamp ascending (oldest first) - chronological order for chat
  filtered.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  return filtered.slice(offset, offset + limit);
}

// Get a single message by ID
export function getMessage(id: string): Message | undefined {
  return messageStore.find(m => m.id === id);
}

// Get total message count
export function getMessageCount(channelId?: string): number {
  if (channelId) {
    return messageStore.filter(m => m.channelId === channelId).length;
  }
  return messageStore.length;
}

// Get thread replies for a message (messages with parentId = this message's id)
export function getThreadReplies(parentId: string): Message[] {
  return messageStore
    .filter(m => m.parentId === parentId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Delete all messages in a channel (used when channel is deleted)
export function deleteMessagesByChannel(channelId: string): number {
  const initialCount = messageStore.length;
  messageStore = messageStore.filter(m => m.channelId !== channelId);
  return initialCount - messageStore.length;
}

// Add or toggle a reaction to a message
export function addReaction(messageId: string, emoji: string, userName: string): Message | null {
  const message = messageStore.find(m => m.id === messageId);
  if (!message) {return null;}
  
  // Initialize reactions array if not present
  if (!message.reactions) {
    message.reactions = [];
  }
  
  // Find existing reaction with this emoji
  const existingReaction = message.reactions.find(r => r.emoji === emoji);
  
  if (existingReaction) {
    // Check if user already reacted
    if (existingReaction.users.includes(userName)) {
      // Remove user from reaction (toggle off)
      existingReaction.users = existingReaction.users.filter(u => u !== userName);
      existingReaction.count = existingReaction.users.length;
      
      // Remove reaction if no users left
      if (existingReaction.count === 0) {
        message.reactions = message.reactions.filter(r => r.emoji !== emoji);
      }
    } else {
      // Add user to reaction
      existingReaction.users.push(userName);
      existingReaction.count = existingReaction.users.length;
    }
  } else {
    // Add new reaction
    message.reactions.push({ emoji, users: [userName], count: 1 });
  }
  
  return message;
}

// Search messages by content (case-insensitive)
// Supports filtering by channel, date range, and author
export function searchMessages(
  query: string, 
  channelId?: string,
  options?: {
    dateFrom?: Date;
    dateTo?: Date;
    userName?: string;
  }
): Message[] {
  if (!query || query.trim().length === 0) {
    return [];
  }
  
  const searchTerm = query.toLowerCase().trim();
  
  let filtered = messageStore.filter(m => 
    m.content.toLowerCase().includes(searchTerm)
  );
  
  // Optionally filter by channel
  if (channelId) {
    filtered = filtered.filter(m => m.channelId === channelId);
  }
  
  // Optionally filter by date range
  if (options?.dateFrom) {
    filtered = filtered.filter(m => new Date(m.timestamp) >= options.dateFrom!);
  }
  if (options?.dateTo) {
    filtered = filtered.filter(m => new Date(m.timestamp) <= options.dateTo!);
  }
  
  // Optionally filter by author
  if (options?.userName) {
    filtered = filtered.filter(m => 
      m.author.name.toLowerCase().includes(options.userName!.toLowerCase())
    );
  }
  
  // Sort by timestamp descending (newest first) for search results
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return filtered;
}

// Mark a message as seen by a user
export function markMessageSeen(messageId: string, userName: string): Message | null {
  const message = messageStore.find(m => m.id === messageId);
  if (!message) {return null;}
  
  // Initialize seenBy array if not present
  if (!message.seenBy) {
    message.seenBy = [];
  }
  
  // Add user to seenBy if not already present
  if (!message.seenBy.includes(userName)) {
    message.seenBy.push(userName);
  }
  
  return message;
}

// Mark all messages in a channel as seen by a user (up to a certain message)
export function markChannelSeen(channelId: string, userName: string, upToMessageId?: string): number {
  const channelMessages = messageStore
    .filter(m => m.channelId === channelId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  
  let markUpToIndex = channelMessages.length;
  
  // If upToMessageId provided, only mark messages up to that one
  if (upToMessageId) {
    const upToIndex = channelMessages.findIndex(m => m.id === upToMessageId);
    if (upToIndex !== -1) {
      markUpToIndex = upToIndex + 1;
    }
  }
  
  let markedCount = 0;
  for (let i = 0; i < markUpToIndex; i++) {
    const message = channelMessages[i];
    if (!message.seenBy) {
      message.seenBy = [];
    }
    if (!message.seenBy.includes(userName)) {
      message.seenBy.push(userName);
      markedCount++;
    }
  }
  
  return markedCount;
}

// Reset to default messages (useful for testing)
export function resetMessageStore(): void {
  messageStore = [...defaultMessages];
}

// Export the store for direct manipulation if needed
export function getMessageStore(): Message[] {
  return messageStore;
}
