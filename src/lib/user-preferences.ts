// User Preferences Store for Colony
// In-memory fallback for user preferences (when Supabase not available)

export interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  notificationLevel: 'all' | 'mentions' | 'none';
  messagePreview: boolean;
  soundEnabled: boolean;
  timezone: string;
  language: string;
  // Channel-specific notification overrides
  channelNotifications: Record<string, 'all' | 'mentions' | 'none'>;
  updatedAt: Date;
}

// Default preferences for new users
export const defaultPreferences: Omit<UserPreferences, 'userId' | 'updatedAt'> = {
  theme: 'system',
  notificationLevel: 'all',
  messagePreview: true,
  soundEnabled: true,
  timezone: 'America/Los_Angeles',
  language: 'en',
  channelNotifications: {},
};

// In-memory preferences store
const userPreferencesStore: Map<string, UserPreferences> = new Map();

// Get preferences for a user
export function getUserPreferences(userId: string): UserPreferences {
  const existing = userPreferencesStore.get(userId);
  if (existing) {
    return existing;
  }
  
  // Return default preferences
  return {
    ...defaultPreferences,
    userId,
    channelNotifications: {},
    updatedAt: new Date(),
  } as UserPreferences;
}

// Update preferences for a user
export function updateUserPreferences(
  userId: string, 
  updates: Partial<Omit<UserPreferences, 'userId' | 'updatedAt'>>
): UserPreferences {
  const current = getUserPreferences(userId);
  
  const updated: UserPreferences = {
    ...current,
    ...updates,
    // Merge channel notifications
    channelNotifications: {
      ...current.channelNotifications,
      ...(updates.channelNotifications || {}),
    },
    updatedAt: new Date(),
  };
  
  userPreferencesStore.set(userId, updated);
  return updated;
}

// Get notification level for a specific channel
export function getChannelNotificationLevel(
  userId: string, 
  channelId: string
): 'all' | 'mentions' | 'none' {
  const prefs = getUserPreferences(userId);
  
  // Check for channel-specific override
  if (prefs.channelNotifications[channelId]) {
    return prefs.channelNotifications[channelId];
  }
  
  // Fall back to global setting
  return prefs.notificationLevel;
}

// Set channel-specific notification level
export function setChannelNotificationLevel(
  userId: string,
  channelId: string,
  level: 'all' | 'mentions' | 'none'
): UserPreferences {
  const prefs = getUserPreferences(userId);
  
  return updateUserPreferences(userId, {
    channelNotifications: {
      ...prefs.channelNotifications,
      [channelId]: level,
    },
  });
}

// Reset preferences to defaults
export function resetUserPreferences(userId: string): UserPreferences {
  userPreferencesStore.delete(userId);
  return getUserPreferences(userId);
}
