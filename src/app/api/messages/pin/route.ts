import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { pinMessage, unpinMessage, getPinnedMessages, getMessage } from '@/lib/messageStore';

// Socket server URL for broadcasting message events
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'colony-internal-dev-key';

// Helper to broadcast message events to socket server
async function broadcastToSocket(event: string, channelId: string, data: unknown) {
  try {
    await fetch(`${SOCKET_URL}/api/broadcast`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({ event, channelId, data }),
    });
  } catch (err) {
    console.error('Failed to broadcast to socket:', err);
  }
}

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// GET: Get pinned messages for a channel
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId') || undefined;
  
  const pinned = getPinnedMessages(channelId);
  
  // Serialize timestamps to ISO strings for proper JSON handling
  const serialized = pinned.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp).toISOString(),
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : undefined,
    pinnedAt: m.pinnedAt ? new Date(m.pinnedAt).toISOString() : undefined,
  }));
  
  return NextResponse.json({ pinned: serialized });
}

// POST: Pin or unpin a message
export async function POST(request: Request) {
  // Apply rate limiting
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`pin:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { id, action } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }
    
    if (!action || !['pin', 'unpin'].includes(action)) {
      return NextResponse.json({ error: 'Action is required (must be "pin" or "unpin")' }, { status: 400 });
    }
    
    // Check if message exists
    const existingMessage = getMessage(id);
    if (!existingMessage) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    let result;
    if (action === 'pin') {
      result = pinMessage(id);
    } else {
      result = unpinMessage(id);
    }
    
    if (!result) {
      return NextResponse.json({ error: 'Failed to update pin status' }, { status: 500 });
    }
    
    const response = {
      ...result,
      timestamp: new Date(result.timestamp).toISOString(),
      editedAt: result.editedAt ? new Date(result.editedAt).toISOString() : undefined,
      pinnedAt: result.pinnedAt ? new Date(result.pinnedAt).toISOString() : undefined,
    };
    
    // Broadcast to socket
    broadcastToSocket(action === 'pin' ? 'message_pinned' : 'message_unpinned', result.channelId, response);
    
    return NextResponse.json({ success: true, message: response });
  } catch (error: unknown) {
    console.error('Pin message error:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
