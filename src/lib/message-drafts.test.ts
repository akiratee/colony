// Tests for Message Drafts functionality

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveDraft,
  getDraft,
  getAllDrafts,
  deleteDraft,
  clearAllDrafts,
  hasDraft,
  getDraftCount,
  cleanupOldDrafts,
} from './message-drafts';

describe('Message Drafts', () => {
  beforeEach(() => {
    // Clear all drafts before each test
    clearAllDrafts('testuser');
    clearAllDrafts('otheruser');
  });

  describe('saveDraft', () => {
    it('should save a draft for a channel', () => {
      const draft = saveDraft('channel-1', 'Hello world', 'testuser');
      
      expect(draft.channelId).toBe('channel-1');
      expect(draft.content).toBe('Hello world');
      expect(draft.authorName).toBe('testuser');
      expect(draft.savedAt).toBeInstanceOf(Date);
    });

    it('should save a draft with parentId for threaded replies', () => {
      const draft = saveDraft('channel-1', 'Reply content', 'testuser', 'parent-msg-123');
      
      expect(draft.parentId).toBe('parent-msg-123');
    });

    it('should overwrite existing draft for same channel and user', () => {
      saveDraft('channel-1', 'First draft', 'testuser');
      const updated = saveDraft('channel-1', 'Updated draft', 'testuser');
      
      const retrieved = getDraft('channel-1', 'testuser');
      expect(retrieved?.content).toBe('Updated draft');
    });
  });

  describe('getDraft', () => {
    it('should retrieve a saved draft', () => {
      saveDraft('channel-1', 'Test content', 'testuser');
      
      const draft = getDraft('channel-1', 'testuser');
      
      expect(draft).not.toBeNull();
      expect(draft?.content).toBe('Test content');
    });

    it('should return null for non-existent draft', () => {
      const draft = getDraft('nonexistent', 'testuser');
      
      expect(draft).toBeNull();
    });

    it('should return null for draft by different user', () => {
      saveDraft('channel-1', 'Test content', 'testuser');
      
      const draft = getDraft('channel-1', 'otheruser');
      
      expect(draft).toBeNull();
    });
  });

  describe('getAllDrafts', () => {
    it('should return all drafts for a user', () => {
      saveDraft('channel-1', 'Draft 1', 'testuser');
      saveDraft('channel-2', 'Draft 2', 'testuser');
      saveDraft('channel-1', 'Other user draft', 'otheruser');
      
      const drafts = getAllDrafts('testuser');
      
      expect(drafts).toHaveLength(2);
      expect(drafts.map(d => d.channelId)).toContain('channel-1');
      expect(drafts.map(d => d.channelId)).toContain('channel-2');
    });

    it('should return empty array for user with no drafts', () => {
      const drafts = getAllDrafts('nodraftsuser');
      
      expect(drafts).toHaveLength(0);
    });
  });

  describe('deleteDraft', () => {
    it('should delete a draft', () => {
      saveDraft('channel-1', 'Test content', 'testuser');
      
      const deleted = deleteDraft('channel-1', 'testuser');
      
      expect(deleted).toBe(true);
      expect(getDraft('channel-1', 'testuser')).toBeNull();
    });

    it('should return false for non-existent draft', () => {
      const deleted = deleteDraft('nonexistent', 'testuser');
      
      expect(deleted).toBe(false);
    });
  });

  describe('clearAllDrafts', () => {
    it('should clear all drafts for a user', () => {
      saveDraft('channel-1', 'Draft 1', 'testuser');
      saveDraft('channel-2', 'Draft 2', 'testuser');
      saveDraft('channel-1', 'Other user', 'otheruser');
      
      const count = clearAllDrafts('testuser');
      
      expect(count).toBe(2);
      expect(getDraft('channel-1', 'testuser')).toBeNull();
      expect(getDraft('channel-2', 'testuser')).toBeNull();
      // Other user's draft should remain
      expect(getDraft('channel-1', 'otheruser')).not.toBeNull();
    });
  });

  describe('hasDraft', () => {
    it('should return true when draft exists', () => {
      saveDraft('channel-1', 'Test', 'testuser');
      
      expect(hasDraft('channel-1', 'testuser')).toBe(true);
    });

    it('should return false when no draft exists', () => {
      expect(hasDraft('channel-1', 'testuser')).toBe(false);
    });
  });

  describe('getDraftCount', () => {
    it('should return correct count for user', () => {
      saveDraft('channel-1', 'Draft 1', 'testuser');
      saveDraft('channel-2', 'Draft 2', 'testuser');
      saveDraft('channel-1', 'Other user', 'otheruser');
      
      expect(getDraftCount('testuser')).toBe(2);
      expect(getDraftCount('otheruser')).toBe(1);
      expect(getDraftCount('nobody')).toBe(0);
    });
  });

  describe('cleanupOldDrafts', () => {
    it('should not delete recent drafts', () => {
      saveDraft('channel-1', 'Recent draft', 'testuser');
      
      const cleaned = cleanupOldDrafts(24); // 24 hours
      
      expect(cleaned).toBe(0);
    });

    it('should delete old drafts when explicitly aged', () => {
      // Manually create an old draft by manipulating the savedAt
      const draft = saveDraft('channel-1', 'Old draft', 'testuser');
      // @ts-ignore - accessing private for testing
      draft.savedAt = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      
      const cleaned = cleanupOldDrafts(24); // 24 hours max age
      
      expect(cleaned).toBe(1);
      expect(getDraft('channel-1', 'testuser')).toBeNull();
    });
  });
});
