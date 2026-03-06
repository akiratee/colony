// Colony WhatsApp Message Status API
// Provides endpoint to query delivery status of messages sent to WhatsApp

import { NextRequest, NextResponse } from 'next/server';
import { getMessageStatus, getChannelMessageStatuses, getPendingCount, getFailedMessages } from '@/lib/whatsapp-message-status';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  // Check rate limit
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  
  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get('messageId');
  const channelId = searchParams.get('channelId');
  const pending = searchParams.get('pending');
  const failed = searchParams.get('failed');
  
  // Get status for specific message
  if (messageId) {
    const status = getMessageStatus(messageId);
    
    if (!status) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }
    
    return NextResponse.json(status);
  }
  
  // Get pending count for channel
  if (pending && channelId) {
    const count = getPendingCount(channelId);
    return NextResponse.json({ channelId, pendingCount: count });
  }
  
  // Get failed messages
  if (failed === 'true') {
    const failedMessages = getFailedMessages();
    return NextResponse.json({ failed: failedMessages });
  }
  
  // Get all statuses for a channel
  if (channelId) {
    const statuses = getChannelMessageStatuses(channelId);
    return NextResponse.json({ channelId, statuses });
  }
  
  return NextResponse.json({ 
    error: 'Missing required parameter: messageId, channelId, pending, or failed' 
  }, { status: 400 });
}
