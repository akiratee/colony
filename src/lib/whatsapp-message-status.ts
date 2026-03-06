// WhatsApp Message Status Tracking
// Tracks delivery status of messages sent from Colony to WhatsApp
// Part of PRD: Offline Queuing & Status Tracking

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export interface WhatsAppMessageStatus {
  colonyMessageId: string;
  channelId: string;
  whatsappMessageId?: string;
  status: MessageStatus;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
  retryCount: number;
}

// In-memory store for message statuses
const messageStatusStore = new Map<string, WhatsAppMessageStatus>();

const MAX_RETRY_COUNT = 3;

/**
 * Initialize a message status when a message is queued to be sent to WhatsApp
 */
export function initMessageStatus(
  colonyMessageId: string,
  channelId: string
): WhatsAppMessageStatus {
  const status: WhatsAppMessageStatus = {
    colonyMessageId,
    channelId,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    retryCount: 0,
  };
  
  messageStatusStore.set(colonyMessageId, status);
  return status;
}

/**
 * Update message status after sending to WhatsApp
 */
export function updateMessageStatus(
  colonyMessageId: string,
  status: MessageStatus,
  whatsappMessageId?: string,
  error?: string
): WhatsAppMessageStatus | null {
  const existing = messageStatusStore.get(colonyMessageId);
  
  if (!existing) {
    console.warn(`Message status not found for ${colonyMessageId}`);
    return null;
  }
  
  existing.status = status;
  existing.updatedAt = new Date();
  
  if (whatsappMessageId) {
    existing.whatsappMessageId = whatsappMessageId;
  }
  
  if (error) {
    existing.error = error;
    existing.retryCount += 1;
  }
  
  messageStatusStore.set(colonyMessageId, existing);
  return existing;
}

/**
 * Mark message as pending (for retry)
 */
export function markMessagePending(colonyMessageId: string): WhatsAppMessageStatus | null {
  const existing = messageStatusStore.get(colonyMessageId);
  
  if (!existing) {
    return null;
  }
  
  existing.status = 'pending';
  existing.updatedAt = new Date();
  messageStatusStore.set(colonyMessageId, existing);
  return existing;
}

/**
 * Get message status by Colony message ID
 */
export function getMessageStatus(colonyMessageId: string): WhatsAppMessageStatus | null {
  return messageStatusStore.get(colonyMessageId) || null;
}

/**
 * Get all message statuses for a channel
 */
export function getChannelMessageStatuses(channelId: string): WhatsAppMessageStatus[] {
  const statuses: WhatsAppMessageStatus[] = [];
  
  for (const status of messageStatusStore.values()) {
    if (status.channelId === channelId) {
      statuses.push(status);
    }
  }
  
  return statuses;
}

/**
 * Get pending messages (for retry)
 */
export function getPendingMessages(): WhatsAppMessageStatus[] {
  const pending: WhatsAppMessageStatus[] = [];
  
  for (const status of messageStatusStore.values()) {
    if (status.status === 'pending' && status.retryCount < MAX_RETRY_COUNT) {
      pending.push(status);
    }
  }
  
  return pending;
}

/**
 * Get failed messages (for alerting)
 */
export function getFailedMessages(): WhatsAppMessageStatus[] {
  const failed: WhatsAppMessageStatus[] = [];
  
  for (const status of messageStatusStore.values()) {
    if (status.status === 'failed') {
      failed.push(status);
    }
  }
  
  return failed;
}

/**
 * Get count of pending messages for a channel (for UI indicator)
 */
export function getPendingCount(channelId: string): number {
  let count = 0;
  
  for (const status of messageStatusStore.values()) {
    if (status.channelId === channelId && status.status === 'pending') {
      count++;
    }
  }
  
  return count;
}

/**
 * Clear old message statuses (cleanup)
 */
export function clearOldStatuses(olderThanDays: number = 7): number {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  
  let cleared = 0;
  
  for (const [id, status] of messageStatusStore.entries()) {
    if (status.updatedAt < cutoff) {
      messageStatusStore.delete(id);
      cleared++;
    }
  }
  
  return cleared;
}

/**
 * Reset for testing
 */
export function __resetMessageStatusForTesting(): void {
  messageStatusStore.clear();
}

// ============================================================================
// Automatic Cleanup
// ============================================================================

// Cleanup interval ID (serverless environments may not support setInterval)
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start automatic cleanup of old message statuses
 * Call this once during server initialization
 * Cleans up statuses older than 7 days every hour
 */
export function startMessageStatusCleanup(): void {
  if (cleanupIntervalId) {
    return; // Already running
  }
  
  // Run cleanup every hour
  cleanupIntervalId = setInterval(() => {
    const cleared = clearOldStatuses(7);
    if (cleared > 0) {
      console.log(`[WhatsApp Message Status] Cleaned up ${cleared} old message statuses`);
    }
  }, 60 * 60 * 1000); // 1 hour
  
  // Also run once at startup
  clearOldStatuses(7);
}

/**
 * Stop automatic cleanup (for testing or graceful shutdown)
 */
export function stopMessageStatusCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}
