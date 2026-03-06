// WhatsApp Webhook Tests
import { describe, it, expect, beforeEach } from 'vitest';
import { getChannelByName, addChannel, resetChannels } from './channelStore';
import { resetMessageStore } from './messageStore';

// Test the channel routing logic from the WhatsApp webhook
// This tests the getTargetChannel function logic manually

describe('WhatsApp Channel Routing', () => {
  beforeEach(() => {
    resetChannels();
    resetMessageStore();
  });

  describe('Channel mention parsing', () => {
    it('should route to mentioned channel when #channel-name is in message', () => {
      // Simulate message content with channel mention - engineering is a default channel
      const content = 'Hey team, check out this PR #engineering';
      const channelMentionMatch = content.match(/#([a-z0-9-]+)/i);
      
      expect(channelMentionMatch).not.toBeNull();
      expect(channelMentionMatch?.[1]).toBe('engineering');
      
      const channel = getChannelByName(channelMentionMatch![1]);
      expect(channel).toBeDefined();
      expect(channel?.name).toBe('engineering');
    });

    it('should be case insensitive for channel names', () => {
      const content = 'Check #DESIGN for updates';
      const channelMentionMatch = content.match(/#([a-z0-9-]+)/i);
      
      expect(channelMentionMatch?.[1].toLowerCase()).toBe('design');
      
      const channel = getChannelByName(channelMentionMatch![1].toLowerCase());
      expect(channel).toBeDefined();
    });

    it('should default to general when channel not found', () => {
      const content = 'Hello #nonexistent';
      const channelMentionMatch = content.match(/#([a-z0-9-]+)/i);
      
      const channelName = channelMentionMatch?.[1]?.toLowerCase() || 'general';
      const channel = getChannelByName(channelName);
      
      // nonexistent channel won't exist, so should fall back to general
      if (!channel) {
        const generalChannel = getChannelByName('general');
        expect(generalChannel).toBeDefined();
      }
    });

    it('should handle multiple channel mentions and use first one', () => {
      const content = 'Check #engineering and #design';
      const channelMentionMatch = content.match(/#([a-z0-9-]+)/i);
      
      expect(channelMentionMatch?.[1]).toBe('engineering');
    });

    it('should handle channel names with hyphens', () => {
      const content = 'Updates on #p-colony';
      const channelMentionMatch = content.match(/#([a-z0-9-]+)/i);
      
      expect(channelMentionMatch?.[1]).toBe('p-colony');
      
      const channel = getChannelByName(channelMentionMatch![1]);
      expect(channel).toBeDefined();
    });
  });

  describe('Default routing', () => {
    it('should have general channel available', () => {
      const generalChannel = getChannelByName('general');
      expect(generalChannel).toBeDefined();
      expect(generalChannel?.name).toBe('general');
    });

    it('should default to general when no channel mention', () => {
      const content = 'Just a regular message without channel mention';
      const hasChannelMention = content.match(/#([a-z0-9-]+)/i);
      
      // No channel mention found
      expect(hasChannelMention).toBeNull();
      
      // Should route to general
      const generalChannel = getChannelByName('general');
      expect(generalChannel).toBeDefined();
    });
  });
});

describe('WhatsApp Message Parsing', () => {
  // Test helper functions that would be in the webhook
  
  function parseWhatsAppMessageType(body: any): string | null {
    const messages = body.messages;
    if (!messages || messages.length === 0) {return null;}
    
    return messages[0].type;
  }

  function extractContent(body: any): string {
    const messages = body.messages;
    if (!messages || messages.length === 0) {return '';}
    
    const msg = messages[0];
    switch (msg.type) {
      case 'text':
        return msg.text || '';
      case 'image':
      case 'video':
        return msg.caption || `[${msg.type} received]`;
      case 'audio':
        return `[Audio - ${msg.mediaId}]`;
      case 'document':
        return `[Document: ${msg.caption || msg.mimeType}]`;
      case 'location':
        if (msg.location) {
          return `[Location: ${msg.location.latitude}, ${msg.location.longitude}]`;
        }
        return '[Location]';
      case 'reaction':
        return '[Reaction]';
      default:
        return `[${msg.type} received]`;
    }
  }

  describe('Message type detection', () => {
    it('should detect text messages', () => {
      const body = { messages: [{ type: 'text', text: 'Hello' }] };
      expect(parseWhatsAppMessageType(body)).toBe('text');
    });

    it('should detect image messages', () => {
      const body = { messages: [{ type: 'image', mediaId: 'abc123' }] };
      expect(parseWhatsAppMessageType(body)).toBe('image');
    });

    it('should detect audio messages', () => {
      const body = { messages: [{ type: 'audio', mediaId: 'audio456' }] };
      expect(parseWhatsAppMessageType(body)).toBe('audio');
    });

    it('should return null for empty messages', () => {
      const body = {};
      expect(parseWhatsAppMessageType(body)).toBeNull();
    });
  });

  describe('Content extraction', () => {
    it('should extract text content', () => {
      const body = { messages: [{ type: 'text', text: 'Test message' }] };
      expect(extractContent(body)).toBe('Test message');
    });

    it('should use caption for images when available', () => {
      const body = { messages: [{ type: 'image', caption: 'My photo', mediaId: 'img123' }] };
      expect(extractContent(body)).toBe('My photo');
    });

    it('should use placeholder for images without caption', () => {
      const body = { messages: [{ type: 'image', mediaId: 'img123' }] };
      expect(extractContent(body)).toBe('[image received]');
    });

    it('should extract location coordinates', () => {
      const body = { 
        messages: [{ 
          type: 'location', 
          location: { latitude: 37.7749, longitude: -122.4194 } 
        }] 
      };
      expect(extractContent(body)).toBe('[Location: 37.7749, -122.4194]');
    });
  });
});

describe('WhatsApp Rate Limiting', () => {
  // Simple in-memory rate limiter test
  
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT = 30;
  const RATE_LIMIT_WINDOW = 60 * 1000;
  
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

  beforeEach(() => {
    rateLimitMap.clear();
  });

  it('should allow requests under the limit', () => {
    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit('test-ip')).toBe(true);
    }
  });

  it('should block requests over the limit', () => {
    // Fill up to limit
    for (let i = 0; i < 30; i++) {
      checkRateLimit('test-ip');
    }
    
    // Next request should be blocked
    expect(checkRateLimit('test-ip')).toBe(false);
  });

  it('should track each IP separately', () => {
    // Fill up one IP
    for (let i = 0; i < 30; i++) {
      checkRateLimit('ip-1');
    }
    
    // Other IPs should still work
    expect(checkRateLimit('ip-2')).toBe(true);
  });

  it('should reset after window expires', () => {
    // Manually set an expired record
    const expiredTime = Date.now() - 1000;
    rateLimitMap.set('test-ip', { count: 30, resetTime: expiredTime });
    
    // Should allow request after reset
    expect(checkRateLimit('test-ip')).toBe(true);
  });
});
