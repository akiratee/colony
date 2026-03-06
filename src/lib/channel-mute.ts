// Channel Mute Store for Colony
// Handles muting of channels for users

export interface ChannelMute {
  userId: string;
  channelId: string;
  mutedAt: Date;
  // Optional: when the mute should expire (null = permanent)
  expiresAt: Date | null;
}

// In-memory mute store: userId -> channelId -> Mute
const muteStore: Map<string, Map<string, ChannelMute>> = new Map();

// Mute a channel for a user
export function muteChannel(
  userId: string,
  channelId: string,
  durationMinutes?: number
): ChannelMute {
  // Initialize user's mute map if needed
  if (!muteStore.has(userId)) {
    muteStore.set(userId, new Map());
  }
  
  const userMutes = muteStore.get(userId)!;
  
  const mute: ChannelMute = {
    userId,
    channelId,
    mutedAt: new Date(),
    expiresAt: durationMinutes ? new Date(Date.now() + durationMinutes * 60 * 1000) : null,
  };
  
  userMutes.set(channelId, mute);
  return mute;
}

// Unmute a channel for a user
export function unmuteChannel(userId: string, channelId: string): boolean {
  const userMutes = muteStore.get(userId);
  if (!userMutes) {
    return false;
  }
  
  return userMutes.delete(channelId);
}

// Check if a channel is muted for a user
export function isChannelMuted(userId: string, channelId: string): boolean {
  const userMutes = muteStore.get(userId);
  if (!userMutes) {
    return false;
  }
  
  const mute = userMutes.get(channelId);
  if (!mute) {
    return false;
  }
  
  // Check if mute has expired
  if (mute.expiresAt && new Date() > mute.expiresAt) {
    // Auto-remove expired mute
    userMutes.delete(channelId);
    return false;
  }
  
  return true;
}

// Get all muted channels for a user
export function getMutedChannels(userId: string): ChannelMute[] {
  const userMutes = muteStore.get(userId);
  if (!userMutes) {
    return [];
  }
  
  const now = new Date();
  const result: ChannelMute[] = [];
  
  userMutes.forEach((mute, channelId) => {
    // Skip expired mutes
    if (mute.expiresAt && now > mute.expiresAt) {
      userMutes.delete(channelId);
      return;
    }
    result.push(mute);
  });
  
  return result;
}

// Get mute status for a specific channel
export function getChannelMuteStatus(userId: string, channelId: string): ChannelMute | null {
  const userMutes = muteStore.get(userId);
  if (!userMutes) {
    return null;
  }
  
  const mute = userMutes.get(channelId);
  if (!mute) {
    return null;
  }
  
  // Check if mute has expired
  if (mute.expiresAt && new Date() > mute.expiresAt) {
    userMutes.delete(channelId);
    return null;
  }
  
  return mute;
}

// Clear all mutes for a user
export function clearAllMutes(userId: string): void {
  muteStore.delete(userId);
}
