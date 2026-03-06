// User Preferences API for Colony
// GET /api/users/me/preferences - Get current user's preferences
// PATCH /api/users/me/preferences - Update current user's preferences

import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';
import { 
  getUserPreferences, 
  updateUserPreferences,
  setChannelNotificationLevel,
  type UserPreferences 
} from '@/lib/user-preferences';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// Valid preference fields
const validFields = [
  'theme', 
  'notificationLevel', 
  'messagePreview', 
  'soundEnabled', 
  'timezone', 
  'language',
  'channelNotifications'
];

// Validate preference update input
function validatePreferencesInput(body: any): { 
  valid: boolean; 
  error?: string; 
  data?: Partial<UserPreferences> 
} {
  const updates: Partial<UserPreferences> = {};
  
  // Validate theme
  if (body.theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(body.theme)) {
      return { valid: false, error: 'Theme must be: light, dark, or system' };
    }
    updates.theme = body.theme;
  }
  
  // Validate notification level
  if (body.notificationLevel !== undefined) {
    if (!['all', 'mentions', 'none'].includes(body.notificationLevel)) {
      return { valid: false, error: 'notificationLevel must be: all, mentions, or none' };
    }
    updates.notificationLevel = body.notificationLevel;
  }
  
  // Validate messagePreview
  if (body.messagePreview !== undefined) {
    if (typeof body.messagePreview !== 'boolean') {
      return { valid: false, error: 'messagePreview must be a boolean' };
    }
    updates.messagePreview = body.messagePreview;
  }
  
  // Validate soundEnabled
  if (body.soundEnabled !== undefined) {
    if (typeof body.soundEnabled !== 'boolean') {
      return { valid: false, error: 'soundEnabled must be a boolean' };
    }
    updates.soundEnabled = body.soundEnabled;
  }
  
  // Validate timezone
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string') {
      return { valid: false, error: 'timezone must be a string' };
    }
    if (body.timezone.length > 100) {
      return { valid: false, error: 'timezone too long (max 100 chars)' };
    }
    updates.timezone = body.timezone;
  }
  
  // Validate language
  if (body.language !== undefined) {
    if (typeof body.language !== 'string') {
      return { valid: false, error: 'language must be a string' };
    }
    if (body.language.length > 10) {
      return { valid: false, error: 'language code too long (max 10 chars)' };
    }
    // Basic language code validation (ISO 639-1)
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(body.language)) {
      return { valid: false, error: 'language must be a valid ISO 639-1 code (e.g., en, es, en-US)' };
    }
    updates.language = body.language;
  }
  
  // Validate channel notifications
  if (body.channelNotifications !== undefined) {
    if (typeof body.channelNotifications !== 'object' || body.channelNotifications === null) {
      return { valid: false, error: 'channelNotifications must be an object' };
    }
    
    const channelNotifs: Record<string, 'all' | 'mentions' | 'none'> = {};
    for (const [channelId, level] of Object.entries(body.channelNotifications)) {
      if (!['all', 'mentions', 'none'].includes(level as string)) {
        return { valid: false, error: `Invalid notification level for channel ${channelId}: must be all, mentions, or none` };
      }
      channelNotifs[channelId] = level as 'all' | 'mentions' | 'none';
    }
    updates.channelNotifications = channelNotifs;
  }
  
  // Check if there are any valid updates
  if (Object.keys(updates).length === 0) {
    return { valid: false, error: 'No valid preference fields to update' };
  }
  
  return { valid: true, data: updates };
}

export async function GET(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }
  
  const { userId } = authResult.payload;
  
  try {
    // Get user preferences
    const preferences = getUserPreferences(userId);
    
    return NextResponse.json({
      preferences: {
        ...preferences,
        updatedAt: preferences.updatedAt.toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Get preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  // Apply rate limiting (20 req/min for preference updates)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 20 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication
  const authResult = withAuth(request);
  
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }
  
  const { userId } = authResult.payload;
  
  try {
    const body = await request.json();
    
    // Validate input
    const validation = validatePreferencesInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    const updates = validation.data!;
    
    // Update preferences
    const updated = updateUserPreferences(userId, updates);
    
    return NextResponse.json({
      message: 'Preferences updated successfully',
      preferences: {
        ...updated,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Update preferences error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
