import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { addReaction, getMessage } from '@/lib/messageStore';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// POST /api/messages/reactions - Add or toggle a reaction on a message
export async function POST(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  // Apply rate limiting (30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`reactions:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { messageId, emoji, userName } = body;
    
    // Validate required fields
    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }
    
    if (!emoji || typeof emoji !== 'string') {
      return NextResponse.json({ error: 'emoji is required' }, { status: 400 });
    }
    
    if (!userName || typeof userName !== 'string') {
      return NextResponse.json({ error: 'userName is required' }, { status: 400 });
    }
    
    // Validate emoji (basic validation - single emoji character or common emoji sequence)
    if (emoji.length === 0 || emoji.length > 10) {
      return NextResponse.json({ error: 'emoji must be 1-10 characters' }, { status: 400 });
    }
    
    // Check if message exists
    const message = getMessage(messageId);
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    // Add or toggle reaction
    const updatedMessage = addReaction(messageId, emoji, userName);
    
    if (!updatedMessage) {
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 });
    }
    
    // Return the updated reactions for this message
    return NextResponse.json({
      success: true,
      messageId,
      reactions: updatedMessage.reactions || [],
    });
  } catch (error: unknown) {
    console.error('Reaction error:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

// GET /api/messages/reactions?messageId=xxx - Get reactions for a message
export async function GET(request: Request) {
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
    messageId,
    reactions: message.reactions || [],
  });
}
