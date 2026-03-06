// WhatsApp Channel Mapping API - Shared store
// Maps Colony channels to WhatsApp groups with notification rules

import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppChannelStore, generateWhatsAppMappingId, isValidNotificationRule, WhatsAppChannelMapping } from '@/lib/whatsapp-channel-mapping';

// GET /api/whatsapp/channels - List all mappings
export async function GET(request: NextRequest) {
  try {
    const store = getWhatsAppChannelStore();
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('colonyChannelId');
    
    let mappings = Array.from(store.values());
    
    // Filter by channel if specified
    if (channelId) {
      mappings = mappings.filter(m => m.colonyChannelId === channelId);
    }
    
    return NextResponse.json({
      success: true,
      mappings: mappings.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching WhatsApp channel mappings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

// POST /api/whatsapp/channels - Create a new mapping
export async function POST(request: NextRequest) {
  try {
    const store = getWhatsAppChannelStore();
    const body = await request.json();
    const { colonyChannelId, colonyChannelName, whatsappGroupId, whatsappGroupName, notificationRule } = body;
    
    // Validate required fields
    if (!colonyChannelId || !whatsappGroupId) {
      return NextResponse.json(
        { error: 'colonyChannelId and whatsappGroupId are required' },
        { status: 400 }
      );
    }
    
    // Validate notification rule
    const rule = notificationRule || 'all';
    if (!isValidNotificationRule(rule)) {
      return NextResponse.json(
        { error: 'notificationRule must be one of: all, mentions, silent, off' },
        { status: 400 }
      );
    }
    
    // Check for duplicate mapping
    const existingMappings = Array.from(store.values());
    const duplicate = existingMappings.find(
      m => m.colonyChannelId === colonyChannelId && m.whatsappGroupId === whatsappGroupId
    );
    
    if (duplicate) {
      return NextResponse.json(
        { error: 'Mapping already exists for this channel and WhatsApp group' },
        { status: 409 }
      );
    }
    
    // Create new mapping
    const mapping: WhatsAppChannelMapping = {
      id: generateWhatsAppMappingId(),
      colonyChannelId,
      colonyChannelName: colonyChannelName || colonyChannelId,
      whatsappGroupId,
      whatsappGroupName: whatsappGroupName || whatsappGroupId,
      notificationRule: rule,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    store.set(mapping.id, mapping);
    
    return NextResponse.json({
      success: true,
      mapping: {
        ...mapping,
        createdAt: mapping.createdAt.toISOString(),
        updatedAt: mapping.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error creating WhatsApp channel mapping:', error);
    return NextResponse.json(
      { error: 'Failed to create mapping' },
      { status: 500 }
    );
  }
}
