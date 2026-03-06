import { describe, it, expect, beforeEach } from 'vitest';
import { getBots, getBot, addBot, updateBot, deleteBot, resetBots, type Bot } from './botStore';

describe('Bot Store', () => {
  beforeEach(() => {
    resetBots();
  });

  describe('addBot', () => {
    it('should add a new bot', () => {
      const newBot: Bot = {
        id: 'test-1',
        name: 'New Test Bot',
        description: 'A test bot',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      const result = addBot(newBot);
      expect(result.name).toBe('New Test Bot');
      expect(getBots().length).toBeGreaterThan(3); // Should have default bots + new one
    });

    it('should reject invalid status', () => {
      const newBot: Bot = {
        id: 'test-invalid',
        name: 'Invalid Status Bot',
        description: 'A test bot',
        avatar: '🤖',
        status: 'invalid' as 'online' | 'offline',
        created_at: new Date().toISOString(),
      };
      
      expect(() => addBot(newBot)).toThrow("Status must be 'online' or 'offline'");
    });

    it('should reject duplicate bot name (case insensitive)', () => {
      const bot1: Bot = {
        id: 'test-1',
        name: 'Duplicate Bot',
        description: 'First bot',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      const bot2: Bot = {
        id: 'test-2',
        name: 'duplicate bot', // Different case
        description: 'Second bot',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      addBot(bot1);
      
      expect(() => addBot(bot2)).toThrow("Bot 'duplicate bot' already exists");
    });

    it('should allow same bot to be added after deletion', () => {
      const bot: Bot = {
        id: 'test-1',
        name: 'Temporary Bot',
        description: 'A temp bot',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      addBot(bot);
      deleteBot(bot.id);
      
      // Should be able to add again after deletion
      const result = addBot({ ...bot, id: 'test-2' });
      expect(result.name).toBe('Temporary Bot');
    });
  });

  describe('updateBot', () => {
    it('should update an existing bot', () => {
      const bot: Bot = {
        id: 'test-1',
        name: 'Original Name',
        description: 'Original description',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      addBot(bot);
      const updated = updateBot('test-1', { name: 'New Name' });
      
      expect(updated?.name).toBe('New Name');
    });

    it('should reject invalid status on update', () => {
      const bot: Bot = {
        id: 'test-status',
        name: 'Status Test Bot',
        description: 'Test',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      addBot(bot);
      
      expect(() => updateBot('test-status', { status: 'invalid' as 'online' | 'offline' }))
        .toThrow("Status must be 'online' or 'offline'");
    });

    it('should reject duplicate name on update', () => {
      const bot1: Bot = {
        id: 'test-1',
        name: 'Bot One',
        description: 'First bot',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      const bot2: Bot = {
        id: 'test-2',
        name: 'Bot Two',
        description: 'Second bot',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      addBot(bot1);
      addBot(bot2);
      
      // Try to rename bot2 to bot1's name - should throw
      expect(() => updateBot('test-2', { name: 'Bot One' }))
        .toThrow("Bot 'Bot One' already exists");
    });

    it('should throw error for non-existent bot', () => {
      expect(() => updateBot('non-existent', { name: 'New Name' }))
        .toThrow("Bot with id 'non-existent' not found");
    });
  });

  describe('getBot', () => {
    it('should get bot by id', () => {
      const bot: Bot = {
        id: 'get-test',
        name: 'Get Test Bot',
        description: 'Test',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      addBot(bot);
      const result = getBot('get-test');
      
      expect(result?.name).toBe('Get Test Bot');
    });

    it('should return undefined for non-existent bot', () => {
      const result = getBot('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('deleteBot', () => {
    it('should delete an existing bot', () => {
      const bot: Bot = {
        id: 'delete-test',
        name: 'Delete Test Bot',
        description: 'Test',
        avatar: '🤖',
        status: 'offline',
        created_at: new Date().toISOString(),
      };
      
      addBot(bot);
      const result = deleteBot('delete-test');
      
      expect(result).toBe(true);
      expect(getBot('delete-test')).toBeUndefined();
    });

    it('should return false for non-existent bot', () => {
      const result = deleteBot('non-existent-id');
      expect(result).toBe(false);
    });
  });
});
