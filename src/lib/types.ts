// Colony Type Definitions - Single Source of Truth
// Import these types instead of duplicating them across files

// ============================================================================
// Core Types
// ============================================================================

export interface Message {
  id: string;
  content: string;
  channelId: string;
  author: Author;
  timestamp: Date;
  editedAt?: Date; // Track when message was last edited
  reactions?: Reaction[];
  parentId?: string; // For threaded replies
  seenBy?: string[]; // User names who have seen this message
  pinnedAt?: Date; // Track when message was pinned
}

export interface Reaction {
  emoji: string;
  users: string[]; // User names who reacted
  count: number;
}

export interface Author {
  name: string;
  avatar?: string;
  isBot?: boolean;
  id?: string; // User ID when needed for ownership tracking
}

// ============================================================================
// Channel Role Types
// ============================================================================

export type ChannelRole = 'admin' | 'moderator' | 'member';

export interface ChannelMember {
  userId: string;
  role: ChannelRole;
  joinedAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
  categoryId?: string; // Channel category for organization
  isProject?: boolean;
  isPrivate?: boolean;
  allowedUsers?: string[]; // User IDs allowed to access private channels
  isDirectMessage?: boolean;
  participantIds?: string[]; // User IDs for DM channels
  createdAt?: Date;
  // Role-based permissions
  members?: ChannelMember[]; // Channel-specific roles for users
}

// ============================================================================
// Agent & Bot Types
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  personality: string;
  model: string;
  status: 'online' | 'offline';
  systemPrompt?: string;
  capabilities?: string[];
  workspace?: string;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  avatar: string;
  status: 'online' | 'offline';
  instructions?: string;
  apiEndpoint?: string;
  created_at?: string;
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
  id: string;
  name: string;
  avatar?: string;
}

// ============================================================================
// Workspace/Team Types
// ============================================================================

export type WorkspaceType = 'personal' | 'team' | 'organization';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  description?: string;
  ownerId: string;
  createdAt: Date;
  settings?: WorkspaceSettings;
}

export interface WorkspaceSettings {
  allowGuestAccess?: boolean;
  defaultRole?: WorkspaceRole;
  maxMembers?: number;
  // Channel category settings
  defaultChannelCategory?: string;
  // Notification settings
  notifyOnMention?: boolean;
  notifyOnMessage?: boolean;
  // Security settings
  requireInvitationForJoin?: boolean;
  // Appearance
  theme?: 'light' | 'dark' | 'system';
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  expiresAt: Date;
  accepted: boolean;
}

// ============================================================================
// Socket Payload Types
// ============================================================================

export interface JoinChannelPayload {
  channelId: string;
}

export interface SendMessagePayload {
  channelId: string;
  content: string;
  author: Author;
}

export interface TypingPayload {
  channelId: string;
  userId: string;
  isTyping: boolean;
}

export interface ServerResponse {
  success?: boolean;
  error?: string;
  message?: Message;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateMessageRequest {
  channelId: string;
  content: string;
  author: Author;
}

export interface CreateChannelRequest {
  name: string;
  description?: string;
}

export interface CreateBotRequest {
  name: string;
  description?: string;
  avatar?: string;
  instructions?: string;
  apiEndpoint?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================
// All validation functions are defined in validation.ts
// Import from there:
//   import { validateSendMessagePayload, validateJoinChannelPayload, validateTypingPayload, sanitizeContent, sanitizeChannelName } from './validation';

// Re-export validation functions from single source of truth
export { 
  validateSendMessagePayload as validateMessagePayload,
  validateJoinChannelPayload as validateChannelPayload
} from './validation';

// ============================================================================
// Reminder Types
// ============================================================================

export interface Reminder {
  id: string;
  messageId: string;
  channelId: string;
  userId: string;
  userName: string;
  remindAt: Date;
  note?: string;
  createdAt: Date;
  triggered: boolean;
}

export interface ReminderCreate {
  messageId: string;
  channelId: string;
  remindAt: string; // ISO date string
  note?: string;
}

export interface ReminderResponse {
  id: string;
  messageId: string;
  channelId: string;
  userId: string;
  userName: string;
  remindAt: string;
  note?: string;
  createdAt: string;
  triggered: boolean;
}

// ============================================================================
// Channel Category Types
// ============================================================================

export interface ChannelCategory {
  id: string;
  name: string;
  workspaceId: string;
  order: number;
  isCollapsed?: boolean;
}

export interface ChannelCategoryCreate {
  name: string;
  order?: number;
  isCollapsed?: boolean;
}

// Re-export sanitization functions from validation.ts for backward compatibility
export { sanitizeContent, sanitizeChannelName } from './validation';
