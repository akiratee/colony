// Channel Members API for Colony
// GET /api/channels/[id]/members - Get members/participants of a channel

import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { getChannel, canAccessChannel } from '@/lib/channelStore';
import { fallbackUsers } from '@/lib/user-store';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting (30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { id: channelId } = await params;
  const userId = authResult.payload?.userId;
  
  // Get channel info from fallback (in-memory) store first
  // Supabase integration deferred until Vincent resolves the P0 blockers
  const channel = getChannel(channelId);
  
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }
  
  // Check access to private channel
  if (channel.isPrivate && !canAccessChannel(channelId, userId || '')) {
    return NextResponse.json({ error: 'Access denied to private channel' }, { status: 403 });
  }
  
  // Determine channel type
  const channelType = channel.isDirectMessage === true ? 'direct_message' : (channel.isPrivate === true ? 'private' : 'public');
  
  // Get members from in-memory store
  const members: Array<{ id: string; name: string; avatar: string }> = [];
  
  if (channel.isDirectMessage && channel.participantIds) {
    // Get user details for DM participants
    for (const uid of channel.participantIds) {
      for (const [, user] of fallbackUsers) {
        if (user.id === uid) {
          members.push({
            id: user.id,
            name: user.name,
            avatar: user.avatar,
          });
        }
      }
    }
  } else if (channel.isPrivate && channel.allowedUsers) {
    // Get user details for private channel
    for (const uid of channel.allowedUsers) {
      for (const [, user] of fallbackUsers) {
        if (user.id === uid) {
          members.push({
            id: user.id,
            name: user.name,
            avatar: user.avatar,
          });
        }
      }
    }
  }
  
  return NextResponse.json({
    channelId: channel.id,
    channelName: channel.name,
    type: channelType,
    members,
    note: channel.isPrivate ? undefined : 'Public channels - members not tracked. Use socket events to see online users.',
  });
}
