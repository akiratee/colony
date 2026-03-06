// WhatsApp Outbound Messaging Service
// Sends messages from Colony to mapped WhatsApp groups
// Part of PRD Feature #3: Bidirectional Sync

import { getWhatsAppChannelStore, WhatsAppChannelMapping } from './whatsapp-channel-mapping';

// WhatsApp Business API configuration
// These would be environment variables in production
const WHATSAPP_BUSINESS_API_URL = process.env.WHATSAPP_BUSINESS_API_URL;
const WHATSAPP_BUSINESS_TOKEN = process.env.WHATSAPP_BUSINESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

export interface WhatsAppOutboundMessage {
  channelId: string;
  content: string;
  authorName: string;
  authorAvatar?: string;
  timestamp: string;
  messageId?: string; // Colony message ID
  threadParentId?: string; // For threaded replies
}

// Queue for offline queuing (Feature #10)
interface QueuedMessage {
  message: WhatsAppOutboundMessage;
  retryCount: number;
  queuedAt: Date;
}

let messageQueue: QueuedMessage[] = [];
const MAX_QUEUE_SIZE = 100;
const MAX_RETRY_COUNT = 3;

/**
 * Check if a channel has WhatsApp mapping and what notification rule applies
 */
export function getChannelWhatsAppMapping(channelId: string): WhatsAppChannelMapping | null {
  const store = getWhatsAppChannelStore();
  const mappings = Array.from(store.values());
  
  // Find mapping for this channel
  const mapping = mappings.find(m => m.colonyChannelId === channelId);
  return mapping || null;
}

/**
 * Determine if a message should be sent to WhatsApp based on notification rule
 * - 'all': Always send
 * - 'mentions': Only send if message contains @mentions
 * - 'silent': Send but don't notify (queued)
 * - 'off': Don't send
 */
export function shouldSendToWhatsApp(
  mapping: WhatsAppChannelMapping,
  content: string,
  hasMention: boolean = false
): boolean {
  switch (mapping.notificationRule) {
    case 'all':
      return true;
    case 'mentions':
      return hasMention;
    case 'silent':
      return true; // Send but underlying API would not notify
    case 'off':
    default:
      return false;
  }
}

/**
 * Extract WhatsApp group ID from mapping
 */
export function getWhatsAppGroupId(mapping: WhatsAppChannelMapping): string {
  return mapping.whatsappGroupId;
}

/**
 * Send message to WhatsApp group via Business API
 * Returns true if successful, false otherwise
 */
async function sendToWhatsAppAPI(message: WhatsAppOutboundMessage, groupId: string): Promise<boolean> {
  // Check if WhatsApp Business API is configured
  if (!WHATSAPP_BUSINESS_API_URL || !WHATSAPP_BUSINESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    // No API configured - log for now, could queue for retry
    console.log(`[WhatsApp Outbound] Would send to group ${groupId}:`, {
      content: message.content,
      author: message.authorName,
      timestamp: message.timestamp,
    });
    return true; // Return true to not block the main flow (stub mode)
  }

  try {
    const response = await fetch(`${WHATSAPP_BUSINESS_API_URL}/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_BUSINESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: groupId,
        type: 'text',
        text: {
          body: `${message.authorName}: ${message.content}`,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp Outbound] API error:', error);
      return false;
    }

    const result = await response.json();
    console.log('[WhatsApp Outbound] Message sent:', result.messages?.[0]?.id);
    return true;
  } catch (error) {
    console.error('[WhatsApp Outbound] Failed to send:', error);
    return false;
  }
}

/**
 * Queue a message for later delivery (offline queuing)
 */
function queueMessage(message: WhatsAppOutboundMessage): void {
  // Remove oldest if queue is full
  if (messageQueue.length >= MAX_QUEUE_SIZE) {
    messageQueue.shift();
  }
  
  messageQueue.push({
    message,
    retryCount: 0,
    queuedAt: new Date(),
  });
  
  console.log(`[WhatsApp Outbound] Queued message, queue size: ${messageQueue.length}`);
}

/**
 * Process queued messages
 */
export async function processMessageQueue(): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  
  const remainingQueue: QueuedMessage[] = [];
  
  for (const queued of messageQueue) {
    const mapping = getChannelWhatsAppMapping(queued.message.channelId);
    
    if (!mapping) {
      // Channel no longer mapped, skip
      processed++;
      continue;
    }
    
    const success = await sendToWhatsAppAPI(queued.message, mapping.whatsappGroupId);
    
    if (success) {
      processed++;
    } else if (queued.retryCount < MAX_RETRY_COUNT) {
      // Keep in queue for retry (don't count as processed yet)
      queued.retryCount++;
      remainingQueue.push(queued);
      // Not counted as processed - will be retried
    } else {
      // Max retries exceeded, drop message
      console.error(`[WhatsApp Outbound] Max retries exceeded for message:`, queued.message.content);
      processed++;
      failed++;
    }
  }
  
  messageQueue = remainingQueue;
  return { processed, failed };
}

/**
 * Get queue status
 */
export function getQueueStatus(): { size: number; oldestMessage: Date | null } {
  return {
    size: messageQueue.length,
    oldestMessage: messageQueue.length > 0 ? messageQueue[0].queuedAt : null,
  };
}

/**
 * Main function: Send a Colony message to mapped WhatsApp groups
 * Called after a message is created in Colony
 */
export async function sendColonyMessageToWhatsApp(
  message: WhatsAppOutboundMessage
): Promise<{ sent: boolean; queued: boolean; reason?: string }> {
  // Check if channel has WhatsApp mapping
  const mapping = getChannelWhatsAppMapping(message.channelId);
  
  if (!mapping) {
    // No mapping - silently skip (channel not connected to WhatsApp)
    return { sent: false, queued: false, reason: 'no_mapping' };
  }
  
  // Check notification rule
  // Simple check: does content contain @mentions?
  const hasMention = /@\w+/.test(message.content);
  const shouldSend = shouldSendToWhatsApp(mapping, message.content, hasMention);
  
  if (!shouldSend) {
    return { sent: false, queued: false, reason: 'notification_rule_blocked' };
  }
  
  // Send to WhatsApp
  const success = await sendToWhatsAppAPI(message, mapping.whatsappGroupId);
  
  if (success) {
    return { sent: true, queued: false };
  } else {
    // Queue for retry
    queueMessage(message);
    return { sent: false, queued: true, reason: 'api_failed_queued' };
  }
}

/**
 * Sync a message deletion to WhatsApp
 * Note: WhatsApp doesn't support message deletion via API for group messages
 * This is logged for audit purposes
 */
export async function syncDeleteToWhatsApp(
  channelId: string,
  messageId: string,
  authorName: string
): Promise<void> {
  const mapping = getChannelWhatsAppMapping(channelId);
  
  if (!mapping) {
    return;
  }
  
  // Log the deletion - WhatsApp Business API doesn't support deleting group messages
  console.log(`[WhatsApp Outbound] Message deleted in Colony (would delete in WhatsApp):`, {
    messageId,
    authorName,
    channelId,
    whatsappGroup: mapping.whatsappGroupName,
  });
}

/**
 * Sync a message edit to WhatsApp
 * Note: WhatsApp doesn't support editing messages via API
 * This would require sending a new message with "(edited)" prefix
 */
export async function syncEditToWhatsApp(
  message: WhatsAppOutboundMessage
): Promise<{ sent: boolean; queued: boolean }> {
  const mapping = getChannelWhatsAppMapping(message.channelId);
  
  if (!mapping) {
    return { sent: false, queued: false };
  }
  
  // WhatsApp doesn't support edits, so we send the edited content as a new message
  // with (edited) indicator
  const editedContent = `(edited) ${message.content}`;
  const editedMessage = { ...message, content: editedContent };
  
  const success = await sendToWhatsAppAPI(editedMessage, mapping.whatsappGroupId);
  
  return { sent: success, queued: !success };
}

/**
 * Sync a message reaction to WhatsApp
 * Sends a notification about the reaction as WhatsApp doesn't support reactions natively
 */
export async function syncReactionToWhatsApp(
  channelId: string,
  messageId: string,
  authorName: string,
  reactionEmoji: string
): Promise<{ sent: boolean; queued: boolean }> {
  const mapping = getChannelWhatsAppMapping(channelId);
  
  if (!mapping) {
    return { sent: false, queued: false };
  }
  
  // WhatsApp doesn't support reactions, so we send a notification message
  const reactionContent = `${authorName} reacted with ${reactionEmoji} to a message`;
  const reactionMessage: WhatsAppOutboundMessage = {
    channelId,
    content: reactionContent,
    authorName: 'Colony Bot',
    authorAvatar: '🤖',
    timestamp: new Date().toISOString(),
    messageId,
  };
  
  const success = await sendToWhatsAppAPI(reactionMessage, mapping.whatsappGroupId);
  
  return { sent: success, queued: !success };
}
