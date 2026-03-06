import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sanitizeContent, sanitizeChannelName } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { getChannels, addChannel, getAccessibleChannels } from '@/lib/channelStore';
import { incrementMetric } from '@/lib/metrics';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

export async function GET(request: Request) {
  // Check authentication for user-specific channel access
  const authResult = withAuth(request);
  const userId = authResult.valid && authResult.payload ? authResult.payload.userId : null;
  
  // Track metrics
  incrementMetric('requests');
  
  try {
    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name');
      
      if (!error && data) {
        // Filter channels based on user access if authenticated
        let channels = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          isPrivate: row.is_private,
          allowedUsers: row.allowed_users,
          createdAt: row.created_at,
        }));
        
        // For authenticated users, filter private channels they can access
        if (userId) {
          channels = channels.filter((ch: any) => !ch.isPrivate || (ch.allowedUsers && ch.allowedUsers.includes(userId)));
        } else {
          // Hide private channel details from unauthenticated users
          channels = channels.map((ch: any) => ch.isPrivate ? { ...ch, allowedUsers: undefined } : ch);
        }
        
        return NextResponse.json(channels);
      }
    }
  } catch (e) {
    console.error('Supabase error, using fallback:', e);
  }
  
  // Fallback to in-memory channel store
  let channels = getChannels();
  
  // Filter by user access
  if (userId) {
    channels = getAccessibleChannels(userId);
  } else {
    // Hide private channel details from unauthenticated users
    channels = channels.map(ch => ch.isPrivate ? { ...ch, allowedUsers: undefined } : ch);
  }
  
  return NextResponse.json(channels);
}

export async function POST(request: Request) {
  // Apply rate limiting (10 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 10 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    
    // Validate channel input
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
    }
    
    const trimmedName = body.name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 50) {
      return NextResponse.json({ error: 'Channel name must be 1-50 characters' }, { status: 400 });
    }
    
    // Only allow lowercase letters, numbers, and hyphens
    if (!/^[a-z0-9-]+$/.test(trimmedName)) {
      return NextResponse.json({ error: 'Channel name must be lowercase alphanumeric with hyphens' }, { status: 400 });
    }
    
    if (body.description && body.description.length > 500) {
      return NextResponse.json({ error: 'Description too long (max 500 chars)' }, { status: 400 });
    }
    
    const channelName = sanitizeChannelName(trimmedName);
    const channelDescription = sanitizeContent(body.description || '');
    const isPrivate = Boolean(body.isPrivate);
    const allowedUsers = body.allowedUsers || [];
    
    // Validate allowedUsers for private channels
    if (isPrivate && !Array.isArray(allowedUsers)) {
      return NextResponse.json({ error: 'allowedUsers must be an array' }, { status: 400 });
    }
    
    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('channels')
        .insert({
          name: channelName,
          description: channelDescription,
          is_private: isPrivate,
          allowed_users: isPrivate ? allowedUsers : null,
        })
        .select()
        .single();
      
      if (!error && data) {
        incrementMetric('channelsCreated');
        incrementMetric('requests');
        return NextResponse.json({
          id: data.id,
          name: data.name,
          description: data.description,
          isPrivate: data.is_private,
          allowedUsers: data.allowed_users,
          createdAt: data.created_at,
        }, { status: 201 });
      }
    }
    
    // Fallback to in-memory channel store
    try {
      const newChannel = addChannel(channelName, channelDescription, isPrivate, allowedUsers);
      incrementMetric('channelsCreated');
      incrementMetric('requests');
      return NextResponse.json({
        id: newChannel.id,
        name: newChannel.name,
        description: newChannel.description,
        isPrivate: newChannel.isPrivate,
        allowedUsers: newChannel.allowedUsers,
        createdAt: newChannel.createdAt?.toISOString() ?? new Date().toISOString(),
      }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
