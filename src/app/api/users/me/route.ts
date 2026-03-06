// User Profile API for Colony
// PATCH /api/users/me - Update current user's profile

import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';
import { fallbackUsers, getFallbackUser } from '@/lib/user-store';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
         request.headers.get('x-real-ip') ||
         'unknown';
}

// Validate profile update input
function validateProfileInput(body: any): { valid: boolean; error?: string; data?: { name?: string; avatar?: string; bio?: string } } {
  const updates: { name?: string; avatar?: string; bio?: string } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      return { valid: false, error: 'Name must be a string' };
    }
    if (body.name.trim().length === 0) {
      return { valid: false, error: 'Name cannot be empty' };
    }
    if (body.name.length > 100) {
      return { valid: false, error: 'Name too long (max 100 chars)' };
    }
    updates.name = body.name.trim();
  }

  if (body.avatar !== undefined) {
    if (typeof body.avatar !== 'string') {
      return { valid: false, error: 'Avatar must be a string (URL)' };
    }
    // Validate avatar URL format
    const trimmedAvatar = body.avatar.trim();
    if (trimmedAvatar.length > 500) {
      return { valid: false, error: 'Avatar URL too long (max 500 chars)' };
    }
    // Must be a valid URL or data URI (for inline images)
    if (trimmedAvatar && !trimmedAvatar.startsWith('data:') && !trimmedAvatar.startsWith('http://') && !trimmedAvatar.startsWith('https://')) {
      return { valid: false, error: 'Avatar must be a valid URL (http://, https://, or data: URI)' };
    }
    updates.avatar = trimmedAvatar;
  }

  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') {
      return { valid: false, error: 'Bio must be a string' };
    }
    if (body.bio.length > 500) {
      return { valid: false, error: 'Bio too long (max 500 chars)' };
    }
    updates.bio = body.bio.trim();
  }

  // Prevent email updates (security: email should not be changeable via API)
  if (body.email !== undefined) {
    return { valid: false, error: 'Email cannot be changed' };
  }

  // Prevent password updates via this endpoint (use dedicated password change endpoint)
  if (body.password !== undefined) {
    return { valid: false, error: 'Password cannot be changed here' };
  }

  if (Object.keys(updates).length === 0) {
    return { valid: false, error: 'No valid fields to update' };
  }

  return { valid: true, data: updates };
}

export async function PATCH(request: Request) {
  // Apply rate limiting (20 req/min for profile updates)
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

  const { userId, email } = authResult.payload;

  try {
    const body = await request.json();

    // Validate input
    const validation = validateProfileInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const updates = validation.data!;

    // Check if Supabase is configured and working
    const supabaseConfigured = await isSupabaseConfigured();
    const useSupabase = supabase && supabaseConfigured;

    if (useSupabase && supabase) {
      // Update user in Supabase
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('id, email, name, avatar, bio, created_at')
        .single();

      if (error || !data) {
        console.error('Supabase update error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
      }

      return NextResponse.json({
        message: 'Profile updated successfully',
        user: {
          id: data.id,
          email: data.email,
          name: data.name,
          avatar: data.avatar,
          bio: data.bio || '',
          createdAt: data.created_at,
        },
      });
    } else {
      // Fallback to in-memory store
      console.log('Using in-memory user store (Supabase not available)');

      // Find user by email
      const userEntry = getFallbackUser(email || '');

      if (!userEntry) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      // Update user fields
      if (updates.name) {userEntry.name = updates.name;}
      if (updates.avatar) {userEntry.avatar = updates.avatar;}
      if (updates.bio !== undefined) {userEntry.bio = updates.bio;}

      // Update in map (need to re-add with same key)
      fallbackUsers.delete(userEntry.email);
      fallbackUsers.set(userEntry.email, userEntry);

      return NextResponse.json({
        message: 'Profile updated successfully',
        user: {
          id: userEntry.id,
          email: userEntry.email,
          name: userEntry.name,
          avatar: userEntry.avatar,
          bio: userEntry.bio || '',
        },
      });
    }

  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Check authentication
  const authResult = withAuth(request);

  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }

  const { userId, email } = authResult.payload;

  // Check if Supabase is configured
  const supabaseConfigured = await isSupabaseConfigured();
  const useSupabase = supabase && supabaseConfigured;

  if (useSupabase && supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, avatar, bio, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      user: {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        bio: data.bio || '',
        createdAt: data.created_at,
      },
    });
  } else {
    // Fallback to in-memory
    const user = getFallbackUser(email || '');

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio || '',
      },
    });
  }
}
