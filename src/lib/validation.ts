// Shared validation utilities for Colony API
// Used by both REST API routes and Socket.io server

import type { Message, Author, Channel, Bot, SendMessagePayload, JoinChannelPayload, TypingPayload } from './types';

// ============================================================================
// Author Type
// ============================================================================

export type { Author } from './types';

// ============================================================================
// Author Sanitization
// ============================================================================

export function sanitizeAuthor(author: { name: string; avatar?: string; isBot?: boolean }): { name: string; avatar?: string; isBot?: boolean } {
  return {
    name: author.name.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    avatar: author.avatar,
    isBot: author.isBot,
  };
}

// ============================================================================
// Message Validation
// ============================================================================

export function validateMessageInput(body: any): { valid: boolean; error?: string } {
  if (!body.channelId || typeof body.channelId !== 'string' || body.channelId.trim().length === 0) {
    return { valid: false, error: 'channelId is required' };
  }
  if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
    return { valid: false, error: 'content is required' };
  }
  if (body.content.length > 10000) {
    return { valid: false, error: 'content too long (max 10000 chars)' };
  }
  // Additional check: validate length after sanitization to prevent bypass
  // (e.g., many '<' chars expand to '&lt;' which is 4x longer)
  const sanitized = sanitizeContent(body.content);
  if (sanitized.length > 10000) {
    return { valid: false, error: 'content too long after sanitization (max 10000 chars)' };
  }
  return { valid: true };
}

export function validateSendMessagePayload(payload: unknown): payload is SendMessagePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'channelId' in payload &&
    typeof payload.channelId === 'string' &&
    'content' in payload &&
    typeof payload.content === 'string' &&
    payload.content.length > 0 &&
    payload.content.length <= 10000 &&
    'author' in payload &&
    typeof payload.author === 'object' &&
    payload.author !== null &&
    'name' in payload.author &&
    typeof payload.author.name === 'string'
  );
}

// ============================================================================
// Channel Validation
// ============================================================================

export function validateChannelInput(body: any): { valid: boolean; error?: string } {
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { valid: false, error: 'Channel name is required' };
  }
  if (body.name.length > 50) {
    return { valid: false, error: 'Channel name too long (max 50 chars)' };
  }
  if (!/^[a-z0-9-]+$/.test(body.name)) {
    return { valid: false, error: 'Channel name must be lowercase alphanumeric with hyphens' };
  }
  if (body.description && body.description.length > 500) {
    return { valid: false, error: 'Description too long (max 500 chars)' };
  }
  return { valid: true };
}

export function validateJoinChannelPayload(payload: unknown): payload is JoinChannelPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'channelId' in payload &&
    typeof payload.channelId === 'string' &&
    payload.channelId.length > 0
  );
}

// ============================================================================
// Bot Validation
// ============================================================================

export function validateBotInput(body: any): { valid: boolean; error?: string } {
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    return { valid: false, error: 'Bot name is required' };
  }
  if (body.name.length > 50) {
    return { valid: false, error: 'Bot name too long (max 50 chars)' };
  }
  if (body.description && body.description.length > 500) {
    return { valid: false, error: 'Description too long (max 500 chars)' };
  }
  // Validate status if provided (must be 'online' or 'offline')
  if (body.status !== undefined && body.status !== 'online' && body.status !== 'offline') {
    return { valid: false, error: "Status must be 'online' or 'offline'" };
  }
  return { valid: true };
}

// ============================================================================
// Typing Indicator Validation
// ============================================================================

export function validateTypingPayload(payload: unknown): payload is TypingPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'channelId' in payload &&
    typeof payload.channelId === 'string' &&
    'userId' in payload &&
    typeof payload.userId === 'string' &&
    'isTyping' in payload &&
    typeof payload.isTyping === 'boolean'
  );
}

// ============================================================================
// Sanitization
// ============================================================================

export function sanitizeContent(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .substring(0, 50);
}

// ============================================================================
// ID Generation (re-export from id.ts for consistency)
// ============================================================================

export { generateId } from './id';

// ============================================================================
// Pagination Helpers
// ============================================================================

export interface PaginationParams {
  limit: number;
  offset: number;
}

export function parsePaginationParams(searchParams: URLSearchParams): PaginationParams {
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  return { limit, offset };
}

export function paginate<T>(items: T[], limit: number, offset: number): { data: T[]; total: number } {
  const sorted = [...items].sort((a, b) => 0); // Preserve original order by default
  return {
    data: sorted.slice(offset, offset + limit),
    total: sorted.length,
  };
}

// ============================================================================
// Reminder Validation
// ============================================================================

export function validateReminderCreate(body: any): { valid: boolean; error?: string } {
  // Validate messageId
  if (!body.messageId || typeof body.messageId !== 'string' || body.messageId.trim().length === 0) {
    return { valid: false, error: 'messageId is required' };
  }

  // Validate channelId
  if (!body.channelId || typeof body.channelId !== 'string' || body.channelId.trim().length === 0) {
    return { valid: false, error: 'channelId is required' };
  }

  // Validate remindAt
  if (!body.remindAt) {
    return { valid: false, error: 'remindAt is required' };
  }

  const remindAt = new Date(body.remindAt);
  if (isNaN(remindAt.getTime())) {
    return { valid: false, error: 'remindAt must be a valid ISO date string' };
  }

  // Validate note (optional, max 500 chars)
  if (body.note !== undefined) {
    if (typeof body.note !== 'string') {
      return { valid: false, error: 'note must be a string' };
    }
    if (body.note.length > 500) {
      return { valid: false, error: 'note must be 500 characters or less' };
    }
  }

  return { valid: true };
}
