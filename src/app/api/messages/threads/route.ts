import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { validateMessageInput, sanitizeContent } from '@/lib/validation';
import { withAuth } from '@/lib/jwt-auth';
import { getThreadReplies, getMessage, addMessage } from '@/lib/messageStore';
import { incrementMetric } from '@/lib/metrics';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// GET /api/messages/threads?parentId=xxx
// Get all replies to a message (thread)
export async function GET(request: Request) {
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  const { searchParams } = new URL(request.url);
  const parentId = searchParams.get('parentId');
  
  if (!parentId) {
    return NextResponse.json({ error: 'parentId query parameter is required' }, { status: 400 });
  }
  
  // Verify parent message exists
  const parentMessage = getMessage(parentId);
  if (!parentMessage) {
    return NextResponse.json({ error: 'Parent message not found' }, { status: 404 });
  }
  
  // Get thread replies
  const replies = getThreadReplies(parentId);
  
  // Serialize timestamps to ISO strings
  const serializedReplies = replies.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp).toISOString(),
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : undefined,
    pinnedAt: m.pinnedAt ? new Date(m.pinnedAt).toISOString() : undefined,
  }));
  
  // Also return parent message info for context
  const serializedParent = {
    ...parentMessage,
    timestamp: new Date(parentMessage.timestamp).toISOString(),
    editedAt: parentMessage.editedAt ? new Date(parentMessage.editedAt).toISOString() : undefined,
    pinnedAt: parentMessage.pinnedAt ? new Date(parentMessage.pinnedAt).toISOString() : undefined,
  };
  
  return NextResponse.json({
    parent: serializedParent,
    replies: serializedReplies,
    totalReplies: replies.length,
  });
}

// POST /api/messages/threads
// Create a reply to a message (thread reply)
export async function POST(request: Request) {
  // Apply strict rate limiting (10 req/min)
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown';
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 10 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    
    // Validate parentId - can be in body or query param
    const parentId = body.parentId;
    if (!parentId) {
      return NextResponse.json({ error: 'parentId is required in request body' }, { status: 400 });
    }
    
    // Validate channelId
    if (!body.channelId || typeof body.channelId !== 'string') {
      return NextResponse.json({ error: 'channelId is required and must be a string' }, { status: 400 });
    }
    
    // Validate content
    if (!body.content || typeof body.content !== 'string' || body.content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required and must be a non-empty string' }, { status: 400 });
    }
    
    // Validate author object
    if (!body.author || typeof body.author !== 'object') {
      return NextResponse.json({ error: 'author is required and must be an object' }, { status: 400 });
    }
    if (!body.author.name || typeof body.author.name !== 'string' || body.author.name.trim().length === 0) {
      return NextResponse.json({ error: 'author.name is required' }, { status: 400 });
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
    
    // Create the thread reply using the message store
    const newReply = addMessage(
      body.channelId,
      sanitizeContent(body.content),
      {
        name: body.author.name,
        avatar: body.author.avatar || '👤',
        isBot: body.author.isBot || false,
      },
      parentId // Pass parentId to create thread reply
    );
    
    // Serialize for response
    const responseReply = {
      ...newReply,
      timestamp: new Date(newReply.timestamp).toISOString(),
      editedAt: newReply.editedAt ? new Date(newReply.editedAt).toISOString() : undefined,
      pinnedAt: newReply.pinnedAt ? new Date(newReply.pinnedAt).toISOString() : undefined,
    };
    
    // Track metrics
    incrementMetric('requests');
    
    return NextResponse.json({
      success: true,
      reply: responseReply,
      parent: {
        ...parentMessage,
        timestamp: new Date(parentMessage.timestamp).toISOString(),
      }
    }, { status: 201 });
    
  } catch (err) {
    console.error('Error creating thread reply:', err);
    return NextResponse.json({ error: 'Failed to create thread reply' }, { status: 500 });
  }
}
