// WhatsApp Channel Mapping Store
// Shared store for WhatsApp channel mappings

export interface WhatsAppChannelMapping {
  id: string;
  colonyChannelId: string;
  colonyChannelName: string;
  whatsappGroupId: string;
  whatsappGroupName: string;
  notificationRule: 'all' | 'mentions' | 'silent' | 'off';
  createdAt: Date;
  updatedAt: Date;
}

// Shared in-memory store (singleton pattern)
let whatsappChannelMappings: Map<string, WhatsAppChannelMapping>;

export function getWhatsAppChannelStore(): Map<string, WhatsAppChannelMapping> {
  if (!whatsappChannelMappings) {
    whatsappChannelMappings = new Map();
  }
  return whatsappChannelMappings;
}

// Generate unique ID
export function generateWhatsAppMappingId(): string {
  return `whatsapp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Validate notification rule
export function isValidNotificationRule(rule: string): rule is WhatsAppChannelMapping['notificationRule'] {
  return ['all', 'mentions', 'silent', 'off'].includes(rule);
}

// Get all mappings for a specific WhatsApp group
export function getMappingsByWhatsAppGroup(groupId: string): WhatsAppChannelMapping[] {
  const store = getWhatsAppChannelStore();
  return Array.from(store.values()).filter(m => m.whatsappGroupId === groupId);
}

// Get mapping by colony channel ID
export function getMappingByColonyChannel(channelId: string): WhatsAppChannelMapping | undefined {
  const store = getWhatsAppChannelStore();
  return Array.from(store.values()).find(m => m.colonyChannelId === channelId);
}

// Get mapping count
export function getMappingCount(): number {
  const store = getWhatsAppChannelStore();
  return store.size;
}

// Clear all mappings (for testing)
export function clearWhatsAppMappings(): void {
  const store = getWhatsAppChannelStore();
  store.clear();
}

// Get mappings by notification rule
export function getMappingsByNotificationRule(rule: WhatsAppChannelMapping['notificationRule']): WhatsAppChannelMapping[] {
  const store = getWhatsAppChannelStore();
  return Array.from(store.values()).filter(m => m.notificationRule === rule);
}

// Check if a channel is mapped to any WhatsApp group
export function isChannelMapped(colonyChannelId: string): boolean {
  const store = getWhatsAppChannelStore();
  return Array.from(store.values()).some(m => m.colonyChannelId === colonyChannelId);
}
