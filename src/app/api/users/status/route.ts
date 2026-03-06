import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import {
  setUserStatus,
  getUserPresence,
  getAllPresence,
  getUsersByStatus,
  markUserOffline,
  updateLastSeen,
  getPresenceStats,
  getOnlineCount,
  type UserStatus
} from '@/lib/user-presence';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// GET /api/users/status - Get all user presences or specific user
export async function GET(request: Request) {
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  // Apply rate limiting (moderate: 30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`status:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const status = searchParams.get('status') as UserStatus | null;
  
  // Get specific user presence
  if (userId) {
    const presence = getUserPresence(userId);
    if (!presence) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({
      ...presence,
      lastSeen: presence.lastSeen.toISOString(),
    });
  }
  
  // Filter by status if provided
  if (status && ['online', 'offline', 'away'].includes(status)) {
    const users = getUsersByStatus(status);
    return NextResponse.json({
      status,
      count: users.length,
      users: users.map(p => ({
        ...p,
        lastSeen: p.lastSeen.toISOString(),
      })),
    });
  }
  
  // Get all presences with stats
  const allPresence = getAllPresence();
  const stats = getPresenceStats();
  
  return NextResponse.json({
    total: allPresence.length,
    online: stats.online,
    away: stats.away,
    offline: stats.offline,
    users: allPresence.map(p => ({
      ...p,
      lastSeen: p.lastSeen.toISOString(),
    })),
  });
}

// POST /api/users/status - Set user status or heartbeat
export async function POST(request: Request) {
  // Apply rate limiting (moderate: 30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`status:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication - required for setting status
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { userId, userName, status, action, platform } = body;
    
    // Handle heartbeat/ping action
    if (action === 'heartbeat' || action === 'ping') {
      if (!userId) {
        return NextResponse.json({ error: 'userId is required for heartbeat' }, { status: 400 });
      }
      const updated = updateLastSeen(userId);
      if (!updated) {
        return NextResponse.json({ error: 'User not found. Set status first.' }, { status: 404 });
      }
      return NextResponse.json({
        ...updated,
        lastSeen: updated.lastSeen.toISOString(),
      });
    }
    
    // Handle offline action
    if (action === 'offline' || action === 'disconnect') {
      if (!userId) {
        return NextResponse.json({ error: 'userId is required' }, { status: 400 });
      }
      const updated = markUserOffline(userId);
      if (!updated) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({
        ...updated,
        lastSeen: updated.lastSeen.toISOString(),
      });
    }
    
    // Validate required fields for status update
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!userName) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }
    if (!status || !['online', 'offline', 'away'].includes(status)) {
      return NextResponse.json({ error: 'status must be online, offline, or away' }, { status: 400 });
    }
    
    // Validate platform if provided
    if (platform && !['web', 'whatsapp', 'mobile'].includes(platform)) {
    return NextResponse.json({ error: 'platform must be web, whatsapp, or mobile' }, { status: 400 });
    }
    
    // Set user status
    const presence = setUserStatus(userId, userName, status, platform);
    
    return NextResponse.json({
      ...presence,
      lastSeen: presence.lastSeen.toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
