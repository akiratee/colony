import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { markMessageSeen, markChannelSeen, getMessage } from '@/lib/messageStore';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// Mark a single message as seen
export async function POST(request: Request) {
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  // Apply rate limiting (moderate: 30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`seen:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { messageId, channelId, userName } = body;
    
    // Validate input
    if (!userName || typeof userName !== 'string' || userName.trim().length === 0) {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }
    
    // Either messageId or channelId must be provided
    if (!messageId && !channelId) {
      return NextResponse.json({ error: 'Either messageId or channelId is required' }, { status: 400 });
    }
    
    let result: { success: boolean; markedCount?: number; message?: unknown } = { success: false };
    
    if (messageId) {
      // Mark single message as seen
      const message = markMessageSeen(messageId, userName);
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      result = { success: true, message };
    } else if (channelId) {
      // Mark all messages in channel as seen
      const markedCount = markChannelSeen(channelId, userName);
      result = { success: true, markedCount };
    }
    
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Seen error:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

// Get who has seen a message
export async function GET(request: Request) {
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get('messageId');
  
  if (!messageId) {
    return NextResponse.json({ error: 'messageId query parameter is required' }, { status: 400 });
  }
  
  const message = getMessage(messageId);
  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }
  
  return NextResponse.json({
    messageId: message.id,
    seenBy: message.seenBy || [],
    seenCount: (message.seenBy || []).length,
  });
}
