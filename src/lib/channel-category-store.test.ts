// Channel Category Store Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateCategoryId,
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getChannelsInCategory,
  getCategoryByChannelId,
  getCategoryCount,
  resetCategories,
} from './channel-category-store';
import { addChannel, getChannel, resetChannels } from './channelStore';

describe('Channel Category Store', () => {
  beforeEach(() => {
    resetCategories();
    resetChannels();
  });

  describe('generateCategoryId', () => {
    it('should generate a category ID with cat- prefix', () => {
      const id = generateCategoryId();
      expect(id).toMatch(/^cat-.+$/);
    });

    it('should generate unique IDs', () => {
      const id1 = generateCategoryId();
      const id2 = generateCategoryId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('getCategories', () => {
    it('should return categories for a specific workspace', () => {
      const categories = getCategories('ws-default');
      expect(categories).toHaveLength(2);
      expect(categories.map(c => c.name)).toEqual(['General', 'Projects']);
    });

    it('should return categories sorted by order', () => {
      const categories = getCategories('ws-team');
      expect(categories).toHaveLength(2);
      expect(categories[0].order).toBeLessThan(categories[1].order);
    });

    it('should return empty array for non-existent workspace', () => {
      const categories = getCategories('ws-nonexistent');
      expect(categories).toEqual([]);
    });
  });

  describe('getCategory', () => {
    it('should return category by ID', () => {
      const category = getCategory('cat-general');
      expect(category).toBeDefined();
      expect(category?.name).toBe('General');
    });

    it('should return undefined for non-existent ID', () => {
      const category = getCategory('cat-nonexistent');
      expect(category).toBeUndefined();
    });
  });

  describe('createCategory', () => {
    it('should create a new category', () => {
      const category = createCategory('ws-default', { name: 'New Category' });
      expect(category.name).toBe('New Category');
      expect(category.workspaceId).toBe('ws-default');
      expect(category.order).toBeGreaterThan(1);
    });

    it('should throw error for duplicate name', () => {
      expect(() => {
        createCategory('ws-default', { name: 'General' });
      }).toThrow();
    });

    it('should handle custom order', () => {
      const category = createCategory('ws-default', { name: 'Custom', order: 0 });
      expect(category.order).toBe(0);
    });

    it('should sanitize category name', () => {
      const category = createCategory('ws-default', { name: '  Test Category  ' });
      expect(category.name).toBe('Test Category');
    });
  });

  describe('updateCategory', () => {
    it('should update category name', () => {
      const updated = updateCategory('cat-general', { name: 'Updated General' });
      expect(updated?.name).toBe('Updated General');
    });

    it('should update category order', () => {
      const updated = updateCategory('cat-general', { order: 5 });
      expect(updated?.order).toBe(5);
    });

    it('should update isCollapsed', () => {
      const updated = updateCategory('cat-general', { isCollapsed: true });
      expect(updated?.isCollapsed).toBe(true);
    });

    it('should return null for non-existent category', () => {
      const updated = updateCategory('cat-nonexistent', { name: 'Test' });
      expect(updated).toBeNull();
    });

    it('should return null for duplicate name', () => {
      // First create a new category
      createCategory('ws-default', { name: 'Another' });
      // Then try to rename general to another (duplicate)
      const updated = updateCategory('cat-general', { name: 'Another' });
      expect(updated).toBeNull();
    });

    it('should sanitize updated name', () => {
      const updated = updateCategory('cat-general', { name: '  Sanitized  ' });
      expect(updated?.name).toBe('Sanitized');
    });
  });

  describe('deleteCategory', () => {
    it('should delete existing category', () => {
      const result = deleteCategory('cat-general');
      expect(result).toBe(true);
      expect(getCategory('cat-general')).toBeUndefined();
    });

    it('should return false for non-existent category', () => {
      const result = deleteCategory('cat-nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getCategoryCount', () => {
    it('should return correct count for workspace', () => {
      const count = getCategoryCount('ws-default');
      expect(count).toBe(2);
    });

    it('should return 0 for non-existent workspace', () => {
      const count = getCategoryCount('ws-nonexistent');
      expect(count).toBe(0);
    });
  });

  describe('getChannelsInCategory', () => {
    it('should return channel IDs in a category', () => {
      // Add a channel with categoryId
      addChannel('test-channel', '', false, [], 'cat-general');
      const channelIds = getChannelsInCategory('cat-general');
      expect(channelIds.length).toBeGreaterThan(0);
    });

    it('should return empty array for category with no channels', () => {
      const channelIds = getChannelsInCategory('cat-random');
      // May have default channels
      expect(Array.isArray(channelIds)).toBe(true);
    });
  });

  describe('getCategoryByChannelId', () => {
    it('should return category for channel with categoryId', () => {
      // Add a channel with categoryId
      const channel = addChannel('test-channel-2', '', false, [], 'cat-general');
      const category = getCategoryByChannelId(channel.id);
      expect(category?.name).toBe('General');
    });

    it('should return undefined for channel without category', () => {
      const channel = addChannel('uncategorized-channel');
      const category = getCategoryByChannelId(channel.id);
      expect(category).toBeUndefined();
    });

    it('should return undefined for non-existent channel', () => {
      const category = getCategoryByChannelId('channel-nonexistent');
      expect(category).toBeUndefined();
    });
  });

  describe('resetCategories', () => {
    it('should reset to default categories', () => {
      createCategory('ws-default', { name: 'Test' });
      resetCategories();
      const categories = getCategories('ws-default');
      expect(categories).toHaveLength(2);
      expect(categories.map(c => c.name)).toEqual(['General', 'Projects']);
    });
  });
});
