// Channel Category Store for Colony
// Manages channel organization into categories

import { generateId } from './id';
import { sanitizeContent } from './validation';
import type { ChannelCategory, ChannelCategoryCreate } from './types';
import { getChannel, getChannelsByCategory } from './channelStore';

// ============================================================================
// In-Memory Channel Category Store
// ============================================================================

// Default categories for development
const defaultCategories: ChannelCategory[] = [
  { id: 'cat-general', name: 'General', workspaceId: 'ws-default', order: 0 },
  { id: 'cat-projects', name: 'Projects', workspaceId: 'ws-default', order: 1 },
  { id: 'cat-team', name: 'Team', workspaceId: 'ws-team', order: 0 },
  { id: 'cat-random', name: 'Random', workspaceId: 'ws-team', order: 1 },
];

// In-memory store
let categoryStore: ChannelCategory[] = [...defaultCategories];

// ============================================================================
// Category CRUD Operations
// ============================================================================

export function generateCategoryId(): string {
  return `cat-${generateId()}`;
}

export function getCategories(workspaceId: string): ChannelCategory[] {
  return categoryStore
    .filter(c => c.workspaceId === workspaceId)
    .sort((a, b) => a.order - b.order);
}

export function getCategory(id: string): ChannelCategory | undefined {
  return categoryStore.find(c => c.id === id);
}

export function createCategory(
  workspaceId: string,
  data: ChannelCategoryCreate
): ChannelCategory {
  // Check for duplicate name in workspace
  const existing = categoryStore.find(
    c => c.workspaceId === workspaceId && c.name.toLowerCase() === data.name.toLowerCase()
  );
  if (existing) {
    throw new Error(`Category '${data.name}' already exists in this workspace`);
  }

  // Get next order number
  const workspaceCategories = getCategories(workspaceId);
  const maxOrder = workspaceCategories.length > 0
    ? Math.max(...workspaceCategories.map(c => c.order))
    : -1;

  const category: ChannelCategory = {
    id: generateCategoryId(),
    name: sanitizeContent(data.name.trim()),
    workspaceId,
    order: data.order ?? maxOrder + 1,
    isCollapsed: data.isCollapsed ?? false,
  };

  categoryStore.push(category);
  return category;
}

export function updateCategory(
  id: string,
  updates: Partial<Pick<ChannelCategory, 'name' | 'order' | 'isCollapsed'>>
): ChannelCategory | null {
  const index = categoryStore.findIndex(c => c.id === id);
  if (index === -1) {
    return null;
  }

  // Check for duplicate name if updating name
  if (updates.name) {
    const existingName = updates.name;
    const duplicate = categoryStore.find(
      c => c.id !== id && c.workspaceId === categoryStore[index].workspaceId &&
        c.name.toLowerCase() === existingName.toLowerCase()
    );
    if (duplicate) {
      return null;
    }
  }

  categoryStore[index] = {
    ...categoryStore[index],
    name: updates.name ? sanitizeContent(updates.name.trim()) : categoryStore[index].name,
    order: updates.order ?? categoryStore[index].order,
    isCollapsed: updates.isCollapsed ?? categoryStore[index].isCollapsed,
  };

  return categoryStore[index];
}

export function deleteCategory(id: string): boolean {
  const index = categoryStore.findIndex(c => c.id === id);
  if (index === -1) {
    return false;
  }

  categoryStore.splice(index, 1);
  return true;
}

// ============================================================================
// Channel Category Assignment
// ============================================================================

export function getChannelsInCategory(categoryId: string): string[] {
  // Get all channels in this category from the channel store
  const channels = getChannelsByCategory(categoryId);
  return channels.map(c => c.id);
}

export function getCategoryByChannelId(channelId: string): ChannelCategory | undefined {
  // Get the channel and find its category
  const channel = getChannel(channelId);
  if (!channel || !channel.categoryId) {
    return undefined;
  }
  return getCategory(channel.categoryId);
}

// ============================================================================
// Utilities
// ============================================================================

export function getCategoryCount(workspaceId: string): number {
  return categoryStore.filter(c => c.workspaceId === workspaceId).length;
}

export function resetCategories(): void {
  categoryStore = [...defaultCategories];
}
