import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { deleteMessage as deleteStoredMessage, getMessage } from '@/lib/messageStore';

// Socket server URL for broadcasting message events
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';

// Helper to broadcast message events to socket server
async function broadcastToSocket(event: string, channelId: string, data: unknown) {
  const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'colony-internal-dev-key';
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

// In-memory message store - must match parent route.ts
// Note: Using shared message store now

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting (10 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`delete:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  
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
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const authorName = searchParams.get('author');
    
    // Validate message ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }
    
    // Require authorName for ownership verification (security requirement)
    if (!authorName) {
      return NextResponse.json({ error: 'authorName is required for message deletion' }, { status: 400 });
    }
    
    // Delete using shared message store (pass authorName for ownership verification)
    // The store handles both "not found" and "not authorized" cases
    const deleted = deleteStoredMessage(id, authorName);
    
    if (!deleted) {
      // Check if message exists to provide appropriate error
      const existingMessage = getMessage(id);
      if (existingMessage) {
        // Message exists but delete failed - authorization issue
        return NextResponse.json({ error: 'Not authorized to delete this message' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    // deleted contains the message object when successful
    // Serialize timestamp for response
    const responseMessage = {
      ...deleted,
      timestamp: new Date(deleted.timestamp).toISOString()
    };
    
    // Broadcast message deletion to all clients in the channel via socket
    broadcastToSocket('message_deleted', deleted.channelId, { id: deleted.id });
    
    return NextResponse.json({ success: true, message: responseMessage });
  } catch (error: unknown) {
    console.error('Delete message error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
