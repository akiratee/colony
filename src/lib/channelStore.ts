// Shared Channel Store for Colony
// Used by both REST API routes and Socket.io server for fallback in-memory storage

import { generateId } from './id';
import { sanitizeContent } from './validation';
import type { Channel, ChannelMember, ChannelRole } from './types';

// Default channels for development
const defaultChannels: Channel[] = [
  { id: '1', name: 'general', description: 'General discussion', createdAt: new Date() },
  { id: '2', name: 'p-colony', description: 'Project discussions - Colony, Parent OS, LahLingo', createdAt: new Date() },
  { id: '3', name: 'engineering', description: 'Engineering team chat', createdAt: new Date() },
  { id: '4', name: 'design', description: 'Design discussions', createdAt: new Date() },
];

// In-memory channel store
let channelStore: Channel[] = [...defaultChannels];

// Generate unique ID
export function generateChannelId(): string {
  return generateId();
}

// Get all channels
export function getChannels(): Channel[] {
  return [...channelStore];
}

// Get channel by ID
export function getChannel(id: string): Channel | undefined {
  return channelStore.find(c => c.id === id || c.name === id);
}

// Get channel by name (case insensitive)
export function getChannelByName(name: string): Channel | undefined {
  return channelStore.find(c => c.name.toLowerCase() === name.toLowerCase());
}

// Add a new channel
export function addChannel(
  name: string,
  description: string = '',
  isPrivate: boolean = false,
  allowedUsers?: string[],
  categoryId?: string
): Channel {
  // Check if channel already exists
  const existing = getChannelByName(name);
  if (existing) {
    throw new Error(`Channel '${name}' already exists`);
  }
  
  // Sanitize description for defense in depth
  const sanitizedDescription = sanitizeContent(description);
  
  const channel: Channel = {
    id: generateChannelId(),
    name: name.toLowerCase(),
    description: sanitizedDescription,
    isPrivate,
    allowedUsers: isPrivate ? (allowedUsers || []) : undefined,
    categoryId,
    createdAt: new Date(),
  };
  
  channelStore.push(channel);
  return channel;
}

// Update a channel
export function updateChannel(id: string, updates: Partial<Pick<Channel, 'name' | 'description' | 'categoryId'>>): Channel | null {
  const index = channelStore.findIndex(c => c.id === id);
  
  if (index === -1) {
    return null;
  }
  
  // Sanitize name if provided
  let sanitizedName = updates.name;
  if (sanitizedName) {
    sanitizedName = sanitizedName.toLowerCase().trim();
    // Check for duplicate channel name (case insensitive), excluding current channel
    const duplicate = channelStore.find(c => 
      c.id !== id && c.name.toLowerCase() === sanitizedName
    );
    if (duplicate) {
      return null; // Channel name already exists
    }
  }
  
  // Sanitize description if provided
  let sanitizedDescription = updates.description;
  if (sanitizedDescription) {
    sanitizedDescription = sanitizeContent(sanitizedDescription.trim());
  }
  
  channelStore[index] = {
    ...channelStore[index],
    name: sanitizedName || channelStore[index].name,
    description: sanitizedDescription ?? channelStore[index].description,
    categoryId: updates.categoryId !== undefined ? updates.categoryId : channelStore[index].categoryId,
    id: channelStore[index].id, // Preserve original ID
    createdAt: channelStore[index].createdAt, // Preserve original creation date
  };
  
  return channelStore[index];
}

// Delete a channel
export function deleteChannel(id: string): boolean {
  const index = channelStore.findIndex(c => c.id === id);
  
  if (index === -1) {
    return false;
  }
  
  channelStore.splice(index, 1);
  return true;
}

// Check if channel exists (case insensitive)
export function channelExists(name: string): boolean {
  return channelStore.some(c => c.name.toLowerCase() === name.toLowerCase());
}

// Get channels by category
export function getChannelsByCategory(categoryId: string): Channel[] {
  return channelStore.filter(c => c.categoryId === categoryId);
}

// Get uncategorized channels
export function getUncategorizedChannels(): Channel[] {
  return channelStore.filter(c => !c.categoryId && !c.isDirectMessage);
}

// Check if a user can access a private channel
export function canAccessChannel(channelId: string, userId: string): boolean {
  const channel = getChannel(channelId);
  if (!channel) {return false;}
  
  // DM channels: check if user is a participant
  if (channel.isDirectMessage) {
    return channel.participantIds?.includes(userId) ?? false;
  }
  
  // Public channels are accessible to everyone
  if (!channel.isPrivate) {return true;}
  
  // Private channels: check if user is in allowedUsers
  if (!channel.allowedUsers || channel.allowedUsers.length === 0) {
    // If private channel has no allowedUsers, only the creator (not tracked) can access
    return false;
  }
  
  return channel.allowedUsers.includes(userId);
}

// Invite a user to a private channel
export function inviteUserToChannel(channelId: string, userId: string): boolean {
  const channel = getChannel(channelId);
  if (!channel) {return false;}
  
  // Only private channels can have invited users
  if (!channel.isPrivate) {return false;}
  
  // Initialize allowedUsers if needed
  if (!channel.allowedUsers) {
    channel.allowedUsers = [];
  }
  
  // Don't add duplicates
  if (channel.allowedUsers.includes(userId)) {
    return true; // Already invited
  }
  
  channel.allowedUsers.push(userId);
  return true;
}

// Remove a user from a private channel
export function removeUserFromChannel(channelId: string, userId: string): boolean {
  const channel = getChannel(channelId);
  if (!channel || !channel.isPrivate) {return false;}
  
  if (!channel.allowedUsers) {return false;}
  
  const index = channel.allowedUsers.indexOf(userId);
  if (index === -1) {return false;}
  
  channel.allowedUsers.splice(index, 1);
  return true;
}

// Get channels a user can access
export function getAccessibleChannels(userId: string): Channel[] {
  return channelStore.filter(channel => {
    // Public channels are accessible to everyone
    if (!channel.isPrivate) {return true;}
    // Private channels: check allowedUsers
    return channel.allowedUsers?.includes(userId);
  });
}

// Get channel count
export function getChannelCount(): number {
  return channelStore.length;
}

// ============================================================================
// Direct Message (DM) Functions
// ============================================================================

// Find existing DM between two users
export function findDirectMessage(userId1: string, userId2: string): Channel | undefined {
  return channelStore.find(channel => 
    channel.isDirectMessage && 
    channel.participantIds && 
    channel.participantIds.includes(userId1) && 
    channel.participantIds.includes(userId2)
  );
}

// Create a new DM between two users
export function createDirectMessage(userId1: string, userId2: string): Channel {
  // Check if DM already exists
  const existing = findDirectMessage(userId1, userId2);
  if (existing) {
    return existing;
  }
  
  const channel: Channel = {
    id: generateChannelId(),
    name: `dm-${userId1}-${userId2}`,
    description: 'Direct message',
    isDirectMessage: true,
    participantIds: [userId1, userId2],
    createdAt: new Date(),
  };
  
  channelStore.push(channel);
  return channel;
}

// Get all DMs for a user
export function getDirectMessages(userId: string): Channel[] {
  return channelStore.filter(channel => 
    channel.isDirectMessage && 
    channel.participantIds?.includes(userId)
  );
}

// Reset to default channels (useful for testing)
export function resetChannels(): void {
  channelStore = [...defaultChannels];
}

// ============================================================================
// Channel Role-Based Permissions
// ============================================================================

// Get user's role in a channel (returns null if not a member)
export function getChannelRole(channelId: string, userId: string): ChannelRole | null {
  const channel = getChannel(channelId);
  if (!channel || !channel.members) {return null;}
  
  const member = channel.members.find(m => m.userId === userId);
  return member?.role ?? null;
}

// Check if user has required role or higher
export function hasChannelRole(channelId: string, userId: string, requiredRole: ChannelRole): boolean {
  const userRole = getChannelRole(channelId, userId);
  if (!userRole) {return false;}
  
  // Role hierarchy: admin > moderator > member
  const roleHierarchy: ChannelRole[] = ['member', 'moderator', 'admin'];
  const userRoleIndex = roleHierarchy.indexOf(userRole);
  const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
  
  return userRoleIndex >= requiredRoleIndex;
}

// Check if user can manage channel (admin or moderator)
export function canManageChannel(channelId: string, userId: string): boolean {
  return hasChannelRole(channelId, userId, 'moderator');
}

// Check if user can delete channel (admin only)
export function canDeleteChannel(channelId: string, userId: string): boolean {
  return hasChannelRole(channelId, userId, 'admin');
}

// Set user's role in a channel
export function setChannelRole(channelId: string, userId: string, role: ChannelRole): boolean {
  const channel = getChannel(channelId);
  if (!channel) {return false;}
  
  // Initialize members array if needed
  if (!channel.members) {
    channel.members = [];
  }
  
  const existingIndex = channel.members.findIndex(m => m.userId === userId);
  
  if (existingIndex >= 0) {
    // Update existing member's role
    channel.members[existingIndex].role = role;
  } else {
    // Add new member with role
    channel.members.push({
      userId,
      role,
      joinedAt: new Date(),
    });
  }
  
  return true;
}

// Remove user's role from channel
export function removeChannelMember(channelId: string, userId: string): boolean {
  const channel = getChannel(channelId);
  if (!channel || !channel.members) {return false;}
  
  const index = channel.members.findIndex(m => m.userId === userId);
  if (index === -1) {return false;}
  
  channel.members.splice(index, 1);
  return true;
}

// Get all members of a channel
export function getChannelMembers(channelId: string): ChannelMember[] {
  const channel = getChannel(channelId);
  if (!channel || !channel.members) {return [];}
  return [...channel.members];
}

// Promote user to a higher role
export function promoteChannelMember(channelId: string, userId: string): boolean {
  const currentRole = getChannelRole(channelId, userId);
  if (!currentRole) {return false;}
  
  if (currentRole === 'member') {
    return setChannelRole(channelId, userId, 'moderator');
  } else if (currentRole === 'moderator') {
    return setChannelRole(channelId, userId, 'admin');
  }
  
  return false; // Already admin
}

// Demote user to a lower role
export function demoteChannelMember(channelId: string, userId: string): boolean {
  const currentRole = getChannelRole(channelId, userId);
  if (!currentRole) {return false;}
  
  if (currentRole === 'admin') {
    return setChannelRole(channelId, userId, 'moderator');
  } else if (currentRole === 'moderator') {
    return setChannelRole(channelId, userId, 'member');
  }
  
  return false; // Already member
}

// Check if user can invite others (moderator or admin)
export function canInviteToChannel(channelId: string, userId: string): boolean {
  return hasChannelRole(channelId, userId, 'moderator');
}

// Check if user can remove others (moderator or admin, cannot remove admin)
export function canRemoveFromChannel(channelId: string, targetUserId: string): boolean {
  // Can't determine without the requester's ID - use hasChannelRole with target check
  return true; // Will be checked at API level
}
