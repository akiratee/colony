import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { validateMessageInput, sanitizeContent } from '@/lib/validation';
import { withAuth } from '@/lib/jwt-auth';
import { addMessage, editMessage as editStoredMessage, deleteMessage, getMessages, getMessageCount, getMessage } from '@/lib/messageStore';
import { sendColonyMessageToWhatsApp, syncDeleteToWhatsApp, syncEditToWhatsApp } from '@/lib/whatsapp-outbound';
import { incrementMetric } from '@/lib/metrics';

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

export async function GET(request: Request) {
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  
  const channelMessages = getMessages(channelId, limit, offset);
  const total = getMessageCount(channelId);
  
  // Serialize timestamps to ISO strings for proper JSON handling
  const serializedMessages = channelMessages.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp).toISOString()
  }));
  
  return NextResponse.json({
    messages: serializedMessages,
    total,
    limit,
    offset,
  });
}

export async function POST(request: Request) {
  // Apply strict rate limiting (10 req/min)
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
    
    // Validate input
    const validation = validateMessageInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    // Validate author object structure
    if (!body.author || typeof body.author !== 'object') {
      return NextResponse.json({ error: 'author is required and must be an object' }, { status: 400 });
    }
    if (!body.author.name || typeof body.author.name !== 'string' || body.author.name.trim().length === 0) {
      return NextResponse.json({ error: 'author.name is required' }, { status: 400 });
    }

    // Validate parentId if provided (for threading)
    const parentId = body.parentId;
    if (parentId !== undefined) {
      if (typeof parentId !== 'string') {
        return NextResponse.json({ error: 'parentId must be a string' }, { status: 400 });
      }
      // Verify parent message exists
      const parentMessage = getMessage(parentId);
      if (!parentMessage) {
        return NextResponse.json({ error: 'Parent message not found' }, { status: 404 });
      }
      // Ensure parent and reply are in the same channel
      if (parentMessage.channelId !== body.channelId) {
        return NextResponse.json({ error: 'Parent message must be in the same channel' }, { status: 400 });
      }
    }
    
    // Use shared message store
    const newMessage = addMessage(
      body.channelId,
      sanitizeContent(body.content),
      {
        name: body.author.name,
        avatar: body.author.avatar || '👤',
        isBot: body.author.isBot || false,
      },
      parentId // Pass parentId for threading
    );
    
    // Serialize timestamp for response
    const responseMessage = {
      ...newMessage,
      timestamp: new Date(newMessage.timestamp).toISOString()
    };
    
    // Broadcast new message to all clients in the channel via socket
    broadcastToSocket('message', newMessage.channelId, responseMessage);
    
    // Track metrics
    incrementMetric('requests');
    incrementMetric('messagesCreated');
    
    // Sync to WhatsApp (async, non-blocking)
    sendColonyMessageToWhatsApp({
      channelId: newMessage.channelId,
      content: newMessage.content,
      authorName: newMessage.author.name,
      authorAvatar: newMessage.author.avatar,
      timestamp: newMessage.timestamp.toString(),
      messageId: newMessage.id,
      threadParentId: parentId,
    }).catch(err => console.error('[WhatsApp Sync] Failed:', err));
    
    return NextResponse.json(responseMessage, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  // Apply rate limiting
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`patch:${clientIp}`, { windowMs: 60000, maxRequests: 20 });
  
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
    const { id, content, authorName } = body;
    
    if (!id) {
      return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
    }
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    
    const trimmedContent = content.trim();
    if (trimmedContent.length === 0) {
      return NextResponse.json({ error: 'Content cannot be empty or whitespace' }, { status: 400 });
    }
    
    if (content.length > 10000) {
      return NextResponse.json({ error: 'Content too long (max 10000 chars)' }, { status: 400 });
    }
    
    // Additional check: validate length after sanitization to prevent bypass
    // (e.g., many '<' chars expand to '&lt;' which is 4x longer)
    const sanitizedContent = sanitizeContent(content);
    if (sanitizedContent.length > 10000) {
      return NextResponse.json({ error: 'Content too long after sanitization (max 10000 chars)' }, { status: 400 });
    }
    
    // Require authorName for ownership verification (security requirement)
    if (!authorName) {
      return NextResponse.json({ error: 'authorName is required for message editing' }, { status: 400 });
    }
    
    // Use shared message store (pass authorName for ownership verification)
    const updatedMessage = editStoredMessage(id, sanitizedContent, authorName);
    
    if (!updatedMessage) {
      // Check if message exists to provide appropriate error
      const existingMessage = getMessage(id);
      if (existingMessage) {
        // Message exists but edit failed - authorization issue
        return NextResponse.json({ error: 'Not authorized to edit this message' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    const responseMessage = {
      ...updatedMessage,
      timestamp: new Date(updatedMessage.timestamp).toISOString()
    };
    
    // Broadcast message edit to all clients in the channel via socket
    broadcastToSocket('message_edited', updatedMessage.channelId, responseMessage);
    
    // Sync edit to WhatsApp (async, non-blocking)
    syncEditToWhatsApp({
      channelId: updatedMessage.channelId,
      content: updatedMessage.content,
      authorName: authorName,
      timestamp: updatedMessage.timestamp.toString(),
      messageId: id,
    }).catch(err => console.error('[WhatsApp Sync] Edit failed:', err));
    
    return NextResponse.json(responseMessage);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  // Apply rate limiting
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`delete:${clientIp}`, { windowMs: 60000, maxRequests: 20 });
  
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Message ID is required (query param: ?id=...)' }, { status: 400 });
    }
    
    // Require authorName for ownership verification (security requirement)
    const authorName = searchParams.get('authorName');
    if (!authorName) {
      return NextResponse.json({ error: 'authorName is required for message deletion (query param: ?authorName=...)' }, { status: 400 });
    }
    
    // Use shared message store (pass authorName for ownership verification)
    const deleted = deleteMessage(id, authorName);
    
    if (!deleted) {
      const existingMessage = getMessage(id);
      if (existingMessage) {
        return NextResponse.json({ error: 'Not authorized to delete this message' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    // Broadcast message deletion to all clients in the channel via socket
    broadcastToSocket('message_deleted', deleted.channelId, { id });
    
    // Sync deletion to WhatsApp (async, non-blocking)
    syncDeleteToWhatsApp(deleted.channelId, id, authorName).catch(err => console.error('[WhatsApp Sync] Delete failed:', err));
    
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
