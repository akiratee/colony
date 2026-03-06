// Direct Message Store Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { findDirectMessage, createDirectMessage, getDirectMessages, canAccessChannel, resetChannels } from './channelStore';

describe('Direct Message Functions', () => {
  beforeEach(() => {
    resetChannels();
  });

  describe('createDirectMessage', () => {
    it('should create a new DM between two users', () => {
      const dm = createDirectMessage('user-1', 'user-2');
      expect(dm.isDirectMessage).toBe(true);
      expect(dm.participantIds).toContain('user-1');
      expect(dm.participantIds).toContain('user-2');
    });

    it('should return existing DM if one already exists', () => {
      const dm1 = createDirectMessage('user-1', 'user-2');
      const dm2 = createDirectMessage('user-1', 'user-2');
      expect(dm1.id).toBe(dm2.id);
    });

    it('should create DM regardless of user order', () => {
      const dm1 = createDirectMessage('user-1', 'user-2');
      const dm2 = createDirectMessage('user-2', 'user-1');
      expect(dm1.id).toBe(dm2.id);
    });
  });

  describe('findDirectMessage', () => {
    it('should find existing DM between two users', () => {
      createDirectMessage('user-1', 'user-2');
      const found = findDirectMessage('user-1', 'user-2');
      expect(found).toBeDefined();
      expect(found?.isDirectMessage).toBe(true);
    });

    it('should return undefined if no DM exists', () => {
      const found = findDirectMessage('user-1', 'user-2');
      expect(found).toBeUndefined();
    });
  });

  describe('getDirectMessages', () => {
    it('should get all DMs for a user', () => {
      createDirectMessage('user-1', 'user-2');
      createDirectMessage('user-1', 'user-3');
      createDirectMessage('user-2', 'user-3');
      
      const dms = getDirectMessages('user-1');
      expect(dms.length).toBe(2);
    });

    it('should return empty array if no DMs exist', () => {
      const dms = getDirectMessages('user-1');
      expect(dms.length).toBe(0);
    });
  });

  describe('canAccessChannel', () => {
    it('should allow DM participants to access DM channel', () => {
      const dm = createDirectMessage('user-1', 'user-2');
      expect(canAccessChannel(dm.id, 'user-1')).toBe(true);
      expect(canAccessChannel(dm.id, 'user-2')).toBe(true);
    });

    it('should deny access to non-participants', () => {
      const dm = createDirectMessage('user-1', 'user-2');
      expect(canAccessChannel(dm.id, 'user-3')).toBe(false);
    });
  });
});
