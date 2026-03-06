// User Presence Store for Colony
// Tracks user online/offline/away status for presence sync

export type UserStatus = 'online' | 'offline' | 'away';

export interface UserPresence {
  userId: string;
  userName: string;
  status: UserStatus;
  lastSeen: Date;
  platform?: 'web' | 'whatsapp' | 'mobile';
}

// In-memory presence store
const presenceStore: Map<string, UserPresence> = new Map();

// Default presence timeout (5 minutes)
const PRESENCE_TIMEOUT_MS = 5 * 60 * 1000;

// Set user status
export function setUserStatus(
  userId: string,
  userName: string,
  status: UserStatus,
  platform?: 'web' | 'whatsapp' | 'mobile'
): UserPresence {
  const presence: UserPresence = {
    userId,
    userName,
    status,
    lastSeen: new Date(),
    platform,
  };
  
  presenceStore.set(userId, presence);
  return presence;
}

// Get user presence by ID
export function getUserPresence(userId: string): UserPresence | undefined {
  const presence = presenceStore.get(userId);
  
  if (!presence) {
    return undefined;
  }
  
  // Check if presence has expired (mark as offline)
  const now = Date.now();
  const lastSeenMs = new Date(presence.lastSeen).getTime();
  
  if (presence.status === 'online' && (now - lastSeenMs) > PRESENCE_TIMEOUT_MS) {
    // Auto-update to away if timed out
    const updatedPresence: UserPresence = {
      ...presence,
      status: 'away',
      lastSeen: presence.lastSeen,
    };
    presenceStore.set(userId, updatedPresence);
    return updatedPresence;
  }
  
  return presence;
}

// Get all user presences
export function getAllPresence(): UserPresence[] {
  const now = Date.now();
  const result: UserPresence[] = [];
  
  presenceStore.forEach((presence) => {
    // Check if presence has expired
    const lastSeenMs = new Date(presence.lastSeen).getTime();
    
    if (presence.status === 'online' && (now - lastSeenMs) > PRESENCE_TIMEOUT_MS) {
      // Auto-update to away if timed out
      const updatedPresence: UserPresence = {
        ...presence,
        status: 'away',
        lastSeen: presence.lastSeen,
      };
      presenceStore.set(presence.userId, updatedPresence);
      result.push(updatedPresence);
    } else {
      result.push(presence);
    }
  });
  
  return result;
}

// Get users by status
export function getUsersByStatus(status: UserStatus): UserPresence[] {
  return getAllPresence().filter(p => p.status === status);
}

// Mark user as away (call periodically or on idle)
export function markUserAway(userId: string): UserPresence | null {
  const presence = presenceStore.get(userId);
  
  if (!presence) {
    return null;
  }
  
  const updatedPresence: UserPresence = {
    ...presence,
    status: 'away',
    lastSeen: new Date(),
  };
  
  presenceStore.set(userId, updatedPresence);
  return updatedPresence;
}

// Mark user as offline (on disconnect)
export function markUserOffline(userId: string): UserPresence | null {
  const presence = presenceStore.get(userId);
  
  if (!presence) {
    return null;
  }
  
  const updatedPresence: UserPresence = {
    ...presence,
    status: 'offline',
    lastSeen: new Date(),
  };
  
  presenceStore.set(userId, updatedPresence);
  return updatedPresence;
}

// Update last seen (heartbeat)
export function updateLastSeen(userId: string): UserPresence | null {
  const presence = presenceStore.get(userId);
  
  if (!presence) {
    return null;
  }
  
  const updatedPresence: UserPresence = {
    ...presence,
    lastSeen: new Date(),
    status: presence.status === 'away' ? 'online' : presence.status,
  };
  
  presenceStore.set(userId, updatedPresence);
  return updatedPresence;
}

// Clear all presence data (for testing)
export function clearPresenceStore(): void {
  presenceStore.clear();
}

// Get online user count
export function getOnlineCount(): number {
  return getUsersByStatus('online').length;
}

// Get presence count by status
export function getPresenceStats(): Record<UserStatus, number> {
  const all = getAllPresence();
  return {
    online: all.filter(p => p.status === 'online').length,
    offline: all.filter(p => p.status === 'offline').length,
    away: all.filter(p => p.status === 'away').length,
  };
}
