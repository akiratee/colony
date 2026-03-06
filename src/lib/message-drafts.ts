// Message Draft Management for Colony
// Allows users to save draft messages and resume editing later

import type { Message, Author } from './types';

// In-memory draft storage (keyed by channelId + userId)
interface Draft {
  channelId: string;
  content: string;
  authorName: string;
  parentId?: string; // For threaded reply drafts
  savedAt: Date;
}

const drafts = new Map<string, Draft>();

// Generate draft key from channelId and authorName
function getDraftKey(channelId: string, authorName: string): string {
  return `${channelId}:${authorName}`;
}

// Save a message draft
export function saveDraft(
  channelId: string,
  content: string,
  authorName: string,
  parentId?: string
): Draft {
  const key = getDraftKey(channelId, authorName);
  const draft: Draft = {
    channelId,
    content,
    authorName,
    parentId,
    savedAt: new Date(),
  };
  drafts.set(key, draft);
  return draft;
}

// Get a draft for a specific channel and user
export function getDraft(channelId: string, authorName: string): Draft | null {
  const key = getDraftKey(channelId, authorName);
  return drafts.get(key) || null;
}

// Get all drafts for a user (across all channels)
export function getAllDrafts(authorName: string): Draft[] {
  const userDrafts: Draft[] = [];
  for (const draft of drafts.values()) {
    if (draft.authorName === authorName) {
      userDrafts.push(draft);
    }
  }
  return userDrafts;
}

// Delete a draft
export function deleteDraft(channelId: string, authorName: string): boolean {
  const key = getDraftKey(channelId, authorName);
  return drafts.delete(key);
}

// Clear all drafts for a user
export function clearAllDrafts(authorName: string): number {
  let count = 0;
  const keysToDelete: string[] = [];
  
  for (const [key, draft] of drafts.entries()) {
    if (draft.authorName === authorName) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    drafts.delete(key);
    count++;
  }
  
  return count;
}

// Check if there's a draft for a channel
export function hasDraft(channelId: string, authorName: string): boolean {
  const draft = getDraft(channelId, authorName);
  return draft !== null;
}

// Get draft count for a user
export function getDraftCount(authorName: string): number {
  let count = 0;
  for (const draft of drafts.values()) {
    if (draft.authorName === authorName) {
      count++;
    }
  }
  return count;
}

// Clean up old drafts (older than specified hours)
export function cleanupOldDrafts(maxAgeHours: number = 24): number {
  const now = new Date();
  let cleaned = 0;
  const keysToDelete: string[] = [];
  
  for (const [key, draft] of drafts.entries()) {
    const age = now.getTime() - draft.savedAt.getTime();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    if (age > maxAgeMs) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    drafts.delete(key);
    cleaned++;
  }
  
  return cleaned;
}
