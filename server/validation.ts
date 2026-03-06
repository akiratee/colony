// Server Validation - Re-exports from single source of truth
// All validation functions are now defined in src/lib/validation.ts
// This file re-exports them for backward compatibility with server/index.ts

import { 
  validateSendMessagePayload, 
  validateJoinChannelPayload, 
  validateTypingPayload, 
  sanitizeContent,
  sanitizeAuthor,
  sanitizeChannelName,
  validateMessageInput,
  validateChannelInput,
  validateBotInput,
  generateId,
  parsePaginationParams,
  paginate,
  type PaginationParams
} from '../src/lib/validation';

// ============================================================================
// Re-exports for socket server (using slightly different names for backward compatibility)
// ============================================================================

export { 
  validateSendMessagePayload as validateSendMessage,
  validateJoinChannelPayload as validateJoinChannel,
  validateTypingPayload as validateTyping,
  sanitizeContent,
  sanitizeAuthor,
  sanitizeChannelName,
  validateMessageInput,
  validateChannelInput,
  validateBotInput,
  generateId,
  parsePaginationParams,
  paginate,
  type PaginationParams
};

// ============================================================================
// Type exports
// ============================================================================

export type { SendMessagePayload, JoinChannelPayload, TypingPayload } from '../src/lib/types';
