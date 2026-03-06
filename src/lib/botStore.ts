// Shared bot store module
// Provides consistent in-memory storage for bots across all API routes

import { generateId } from './id';
import { sanitizeContent } from './validation';

export interface Bot {
  id: string;
  name: string;
  description: string;
  avatar: string;
  status: 'online' | 'offline';
  instructions?: string;
  apiEndpoint?: string;
  created_at: string;
}

// Default bots
const defaultBots: Bot[] = [
  { id: '1', name: 'CodeReview Bot', description: 'Reviews pull requests', avatar: '🤖', status: 'online', created_at: new Date().toISOString() },
  { id: '2', name: 'Test Bot', description: 'Runs automated tests', avatar: '🧪', status: 'online', created_at: new Date().toISOString() },
  { id: '3', name: 'Docs Bot', description: 'Answers questions about docs', avatar: '📚', status: 'offline', created_at: new Date().toISOString() },
];

// Mutable bot store
let botStore: Bot[] = [...defaultBots];

export function getBots(): Bot[] {
  return [...botStore];
}

export function getBot(id: string): Bot | undefined {
  return botStore.find(b => b.id === id);
}

export function addBot(bot: Bot): Bot {
  // Validate status
  if (bot.status !== 'online' && bot.status !== 'offline') {
    throw new Error("Status must be 'online' or 'offline'");
  }
  
  // Sanitize bot fields for defense in depth
  const sanitizedBot: Bot = {
    ...bot,
    name: sanitizeContent(bot.name),
    description: sanitizeContent(bot.description || ''),
    avatar: sanitizeContent(bot.avatar || '🤖'),
    instructions: sanitizeContent(bot.instructions || ''),
  };
  
  // Check for duplicate bot name (case insensitive) - compare against sanitized names
  const duplicate = botStore.find(b => b.name.toLowerCase() === sanitizedBot.name.toLowerCase());
  if (duplicate) {
    throw new Error(`Bot '${sanitizedBot.name}' already exists`);
  }
  botStore.push(sanitizedBot);
  return sanitizedBot;
}

export function updateBot(id: string, updates: Partial<Bot>): Bot {
  const index = botStore.findIndex(b => b.id === id);
  if (index === -1) {throw new Error(`Bot with id '${id}' not found`);}
  
  // Validate status if provided
  if (updates.status !== undefined && updates.status !== 'online' && updates.status !== 'offline') {
    throw new Error("Status must be 'online' or 'offline'");
  }
  
  // Sanitize fields if provided
  const sanitizedUpdates: Partial<Bot> = { ...updates };
  if (sanitizedUpdates.name) {sanitizedUpdates.name = sanitizeContent(sanitizedUpdates.name);}
  if (sanitizedUpdates.description !== undefined) {sanitizedUpdates.description = sanitizeContent(sanitizedUpdates.description);}
  if (sanitizedUpdates.avatar !== undefined) {sanitizedUpdates.avatar = sanitizeContent(sanitizedUpdates.avatar);}
  if (sanitizedUpdates.instructions !== undefined) {sanitizedUpdates.instructions = sanitizeContent(sanitizedUpdates.instructions);}
  
  // Check for duplicate bot name (case insensitive), excluding current bot
  if (sanitizedUpdates.name) {
    const duplicate = botStore.find(b => 
      b.id !== id && b.name.toLowerCase() === sanitizedUpdates.name!.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Bot '${sanitizedUpdates.name}' already exists`);
    }
  }
  
  botStore[index] = { ...botStore[index], ...sanitizedUpdates };
  return botStore[index];
}

export function deleteBot(id: string): boolean {
  const index = botStore.findIndex(b => b.id === id);
  if (index === -1) {return false;}
  botStore.splice(index, 1);
  return true;
}

export function botExists(id: string): boolean {
  return botStore.some(b => b.id === id);
}

// Reset to default bots (useful for testing)
export function resetBots(): void {
  botStore = [...defaultBots];
}
