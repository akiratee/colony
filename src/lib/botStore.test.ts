// Bot Store Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getBots,
  getBot,
  addBot,
  updateBot,
  deleteBot,
  botExists,
  resetBots
} from './botStore';

describe('Bot Store', () => {
  beforeEach(() => {
    resetBots();
  });

  describe('getBots', () => {
    it('should return all bots', () => {
      const bots = getBots();
      expect(bots.length).toBeGreaterThan(0);
    });
  });

  describe('getBot', () => {
    it('should return bot by id', () => {
      const bots = getBots();
      const bot = getBot(bots[0].id);
      expect(bot).toBeDefined();
    });

    it('should return undefined for non-existent bot', () => {
      const bot = getBot('nonexistent');
      expect(bot).toBeUndefined();
    });
  });

  describe('addBot', () => {
    it('should add a new bot', () => {
      const newBot = {
        id: 'new-bot',
        name: 'New Bot',
        description: 'A test bot',
        avatar: '🤖',
        status: 'online' as const,
        created_at: new Date().toISOString()
      };
      
      const added = addBot(newBot);
      expect(added.name).toBe('New Bot');
      expect(getBots().length).toBe(4);
    });

    it('should sanitize bot name', () => {
      const newBot = {
        id: 'new-bot',
        name: '<script>alert("xss")</script>',
        description: 'Test',
        avatar: '🤖',
        status: 'online' as const,
        created_at: new Date().toISOString()
      };
      
      const added = addBot(newBot);
      expect(added.name).not.toContain('<script>');
    });

    it('should reject duplicate bot names (case insensitive)', () => {
      const newBot1 = {
        id: 'bot-1',
        name: 'DuplicateBot',
        description: 'Test',
        avatar: '🤖',
        status: 'online' as const,
        created_at: new Date().toISOString()
      };
      
      addBot(newBot1);
      
      const newBot2 = {
        id: 'bot-2',
        name: 'duplicatebot',
        description: 'Test',
        avatar: '🤖',
        status: 'online' as const,
        created_at: new Date().toISOString()
      };
      
      expect(() => addBot(newBot2)).toThrow();
    });

    it('should reject invalid status', () => {
      const newBot = {
        id: 'new-bot',
        name: 'Test Bot',
        description: 'Test',
        avatar: '🤖',
        status: 'invalid' as any,
        created_at: new Date().toISOString()
      };
      
      expect(() => addBot(newBot)).toThrow();
    });
  });

  describe('updateBot', () => {
    it('should update an existing bot', () => {
      const bots = getBots();
      const updated = updateBot(bots[0].id, { name: 'Updated Bot' });
      
      expect(updated?.name).toBe('Updated Bot');
    });

    it('should return error for non-existent bot', () => {
      expect(() => updateBot('nonexistent', { name: 'Test' })).toThrow();
    });

    it('should reject invalid status update', () => {
      const bots = getBots();
      expect(() => updateBot(bots[0].id, { status: 'invalid' as any })).toThrow();
    });
  });

  describe('deleteBot', () => {
    it('should delete an existing bot', () => {
      const bots = getBots();
      const initialCount = bots.length;
      const deleted = deleteBot(bots[0].id);
      
      expect(deleted).toBe(true);
      expect(getBots().length).toBe(initialCount - 1);
    });

    it('should return false for non-existent bot', () => {
      const deleted = deleteBot('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('botExists', () => {
    it('should return true for existing bot', () => {
      const bots = getBots();
      expect(botExists(bots[0].id)).toBe(true);
    });

    it('should return false for non-existent bot', () => {
      expect(botExists('nonexistent')).toBe(false);
    });
  });
});
