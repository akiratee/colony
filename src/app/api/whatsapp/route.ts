// Colony WhatsApp Webhook API Route
// Receives messages from WhatsApp via OpenClaw and routes them to Colony channels

import { NextRequest, NextResponse } from 'next/server';
import { addMessage, getMessages } from '@/lib/messageStore';
import { getChannel, getChannels, getChannelByName } from '@/lib/channelStore';
import { getFallbackUser, fallbackUsers } from '@/lib/user-store';
import { sanitizeContent } from '@/lib/validation';
import { incrementWhatsAppReceived, incrementMetric } from '@/lib/metrics';
import type { Author } from '@/lib/types';

// Socket server URL for broadcasting WhatsApp messages in real-time
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3001';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'colony-internal-dev-key';

// Helper to broadcast WhatsApp messages to socket server for real-time delivery
async function broadcastWhatsAppToSocket(channelId: string, message: { id: string; content: string; author: Author; timestamp: Date; channelId: string }) {
  try {
    const response = await fetch(`${SOCKET_URL}/api/broadcast`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': INTERNAL_API_KEY,
      },
      body: JSON.stringify({ 
        event: 'message', 
        channelId, 
        data: {
          ...message,
          timestamp: new Date(message.timestamp).toISOString()
        }
      }),
    });
    if (!response.ok) {
      console.error('Failed to broadcast WhatsApp message to socket:', response.status);
    }
  } catch (err) {
    console.error('Failed to broadcast WhatsApp message to socket:', err);
  }
}

// Rate limiting map
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// WhatsApp message types we support
type WhatsAppMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'reaction';

interface WhatsAppMessage {
  type: WhatsAppMessageType;
  text?: string;
  caption?: string;
  mimeType?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  mediaId?: string;
}

interface WhatsAppWebhookBody {
  messages?: WhatsAppMessage[];
  from?: string; // sender phone number
  sender?: {
    phone?: string;
  };
  phone?: string;
}

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

// Get or create a WhatsApp user in Colony
function getOrCreateWhatsAppUser(phoneNumber: string): Author {
  const userKey = `whatsapp:${phoneNumber}`;
  const existing = fallbackUsers.get(userKey);
  
  if (existing) {
    return {
      name: existing.name,
      avatar: existing.avatar,
    };
  }
  
  // Create a new WhatsApp user
  const displayName = phoneNumber.length > 6 
    ? `+${phoneNumber.slice(0, 2)} ${phoneNumber.slice(2, 6)} ${phoneNumber.slice(6)}`
    : phoneNumber;
    
  return {
    name: `WhatsApp (${displayName})`,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(phoneNumber)}`,
  };
}

// Parse incoming WhatsApp message content
function parseWhatsAppMessage(body: WhatsAppWebhookBody): { content: string; author: Author } | null {
  const senderPhone = body.from || body.sender?.phone || body.phone;
  
  if (!senderPhone) {
    console.error('No sender phone found in WhatsApp message');
    return null;
  }
  
  const author = getOrCreateWhatsAppUser(senderPhone);
  
  // Extract message content based on type
  let content = '';
  const messages = body.messages;
  
  if (messages && messages.length > 0) {
    const msg = messages[0];
    
    switch (msg.type) {
      case 'text':
        content = msg.text || '';
        break;
      case 'image':
        content = msg.caption || `[Image received - media ID: ${msg.mediaId}]`;
        break;
      case 'audio':
        content = `[Audio message received - media ID: ${msg.mediaId}]`;
        break;
      case 'video':
        content = msg.caption || `[Video received - media ID: ${msg.mediaId}]`;
        break;
      case 'document':
        content = `[Document received: ${msg.caption || msg.mimeType || 'file'}]`;
        break;
      case 'location':
        if (msg.location) {
          content = `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`;
        } else {
          content = '[Location shared]';
        }
        break;
      case 'reaction':
        content = '[Reacted to a message]';
        break;
      default:
        content = `[${msg.type} message received]`;
    }
  }
  
  if (!content) {
    return null;
  }
  
  return {
    content: sanitizeContent(content.trim()),
    author,
  };
}

// Determine which channel to send the message to
// Supports routing based on channel mentions like "#channel-name"
function getTargetChannel(body: WhatsAppWebhookBody): string | null {
  // Get messages from the body
  const messages = body.messages;
  
  if (!messages || messages.length === 0) {
    // Default to general channel if no messages
    const generalChannel = getChannelByName('general');
    return generalChannel?.id || null;
  }
  
  const msg = messages[0];
  const content = msg.type === 'text' ? msg.text : msg.caption || '';
  
  // Check if message contains a channel mention like "#channel-name"
  const channelMentionMatch = content?.match(/#([a-z0-9-]+)/i);
  
  if (channelMentionMatch) {
    const channelName = channelMentionMatch[1].toLowerCase();
    const channel = getChannelByName(channelName);
    
    if (channel) {
      console.log(`Routing WhatsApp message to #${channelName} based on channel mention`);
      return channel.id;
    } else {
      console.log(`Channel #${channelName} not found, defaulting to #general`);
    }
  }
  
  // Default to general channel if no specific channel mentioned
  const generalChannel = getChannelByName('general');
  return generalChannel?.id || null;
}

export async function GET(request: NextRequest) {
  // WhatsApp webhook verification (GET challenge)
  const { searchParams } = new URL(request.url);
  const hubMode = searchParams.get('hub.mode');
  const hubChallenge = searchParams.get('hub.challenge');
  const hubVerifyToken = searchParams.get('hub.verify_token');
  
  // Verify token - should match env var in production
  // In development, accept any token that starts with 'colony_'
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'colony_whatsapp_verify_token';
  
  if (hubMode === 'subscribe') {
    // In development, accept our token or tokens starting with 'colony_'
    if (hubVerifyToken === verifyToken || (hubVerifyToken && hubVerifyToken.startsWith('colony_'))) {
      console.log('Colony WhatsApp webhook verified');
      incrementMetric('requests');
      return new NextResponse(hubChallenge, { status: 200 });
    }
  }
  
  console.log('WhatsApp webhook verification failed', { hubVerifyToken, verifyToken });
  return NextResponse.json(
    { error: 'Verification failed' },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    const body: WhatsAppWebhookBody = await request.json();
    
    // Parse the message
    const parsed = parseWhatsAppMessage(body);
    
    if (!parsed) {
      return NextResponse.json(
        { error: 'No valid message found' },
        { status: 400 }
      );
    }
    
    // Get target channel
    const channelId = getTargetChannel(body);
    
    if (!channelId) {
      return NextResponse.json(
        { error: 'No target channel available' },
        { status: 500 }
      );
    }
    
    // Get channel info
    const channel = getChannel(channelId);
    
    if (!channel) {
      return NextResponse.json(
        { error: 'Target channel not found' },
        { status: 404 }
      );
    }
    
    // Add message to channel
    const message = addMessage(channelId, parsed.content, parsed.author);
    
    // Track metrics
    incrementWhatsAppReceived();
    incrementMetric('requests');
    
    // Broadcast to connected clients in real-time
    broadcastWhatsAppToSocket(channelId, message);
    
    // Return success with message details
    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        channel: channel.name,
        author: message.author,
        timestamp: message.timestamp,
      },
      debug: {
        sender: body.from || body.sender?.phone,
        messageType: body.messages?.[0]?.type,
      },
    });
  } catch (error) {
    console.error('Colony WhatsApp webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
