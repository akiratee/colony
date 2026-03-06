import { NextRequest, NextResponse } from 'next/server';
import { scheduledMessageStore, type ScheduledMessage } from '@/lib/scheduled-messages';
import { sanitizeContent, sanitizeAuthor } from '@/lib/validation';
import { withAuth, type AuthResult } from '@/lib/jwt-auth';
import { canAccessChannel } from '@/lib/channelStore';

// GET /api/messages/scheduled - Get scheduled messages
export async function GET(request: NextRequest) {
  const authResult = withAuth(request);
  
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    
    // If channelId provided, validate access
    if (channelId) {
      const hasAccess = canAccessChannel(channelId, authResult.payload!.userId);
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this channel' },
          { status: 403 }
        );
      }
    }
    
    const messages = scheduledMessageStore.getScheduledMessages(channelId || undefined);
    
    return NextResponse.json({
      messages: messages.map(msg => ({
        id: msg.id,
        channelId: msg.channelId,
        content: msg.content,
        author: sanitizeAuthor(msg.author),
        scheduledAt: msg.scheduledAt,
        status: msg.status,
        createdAt: msg.createdAt,
      })),
      count: messages.length,
    });
  } catch (error) {
    console.error('Error getting scheduled messages:', error);
    return NextResponse.json(
      { error: 'Failed to get scheduled messages' },
      { status: 500 }
    );
  }
}

// POST /api/messages/scheduled - Schedule a new message
export async function POST(request: NextRequest) {
  const authResult = withAuth(request);
  
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { channelId, content, scheduledAt } = body;
    
    // Validate required fields
    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      );
    }
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'content is required and must be a string' },
        { status: 400 }
      );
    }
    
    if (!scheduledAt) {
      return NextResponse.json(
        { error: 'scheduledAt is required (ISO 8601 format)' },
        { status: 400 }
      );
    }
    
    // Validate channel access
    const hasAccess = canAccessChannel(channelId, authResult.payload!.userId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this channel' },
        { status: 403 }
      );
    }
    
    // Parse and validate scheduled time
    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduledAt date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }
    
    // Schedule must be in the future
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'scheduledAt must be in the future' },
        { status: 400 }
      );
    }
    
    // Sanitize content
    const sanitizedContent = sanitizeContent(content);
    if (!sanitizedContent || sanitizedContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content cannot be empty' },
        { status: 400 }
      );
    }
    
    // Create the scheduled message - include user ID for ownership
    const message = scheduledMessageStore.scheduleMessage(
      channelId,
      sanitizedContent,
      { id: authResult.payload!.userId, name: authResult.payload!.name || 'Unknown', avatar: authResult.payload!.avatar },
      scheduledDate
    );
    
    return NextResponse.json({
      id: message.id,
      channelId: message.channelId,
      content: message.content,
      author: sanitizeAuthor(message.author),
      scheduledAt: message.scheduledAt,
      status: message.status,
      createdAt: message.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error scheduling message:', error);
    return NextResponse.json(
      { error: 'Failed to schedule message' },
      { status: 500 }
    );
  }
}

// DELETE /api/messages/scheduled - Cancel a scheduled message
export async function DELETE(request: NextRequest) {
  const authResult = withAuth(request);
  
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('id');
    
    if (!messageId) {
      return NextResponse.json(
        { error: 'Message ID is required (use ?id=)' },
        { status: 400 }
      );
    }
    
    // Get the message to check ownership
    const scheduledMessage = scheduledMessageStore.getMessage(messageId);
    if (!scheduledMessage) {
      return NextResponse.json(
        { error: 'Scheduled message not found' },
        { status: 404 }
      );
    }
    
    // Check if user owns the message
    if (scheduledMessage.author.id !== authResult.payload!.userId) {
      return NextResponse.json(
        { error: 'You can only cancel your own scheduled messages' },
        { status: 403 }
      );
    }
    
    const cancelled = scheduledMessageStore.cancelMessage(messageId);
    if (!cancelled) {
      return NextResponse.json(
        { error: 'Message has already been sent or cancelled' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling scheduled message:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scheduled message' },
      { status: 500 }
    );
  }
}
