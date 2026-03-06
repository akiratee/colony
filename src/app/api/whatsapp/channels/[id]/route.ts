// WhatsApp Channel Mapping API - Individual mapping operations

import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppChannelStore, WhatsAppChannelMapping } from '@/lib/whatsapp-channel-mapping';
import { isValidNotificationRule } from '@/lib/whatsapp-channel-mapping';

// GET /api/whatsapp/channels/[id] - Get a specific mapping
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = getWhatsAppChannelStore();
    const mapping = store.get(id);
    
    if (!mapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      mapping: {
        ...mapping,
        createdAt: mapping.createdAt.toISOString(),
        updatedAt: mapping.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching WhatsApp channel mapping:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mapping' },
      { status: 500 }
    );
  }
}

// PUT /api/whatsapp/channels/[id] - Update a mapping
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = getWhatsAppChannelStore();
    const existingMapping = store.get(id);
    
    if (!existingMapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }
    
    const body = await request.json();
    const { colonyChannelName, whatsappGroupName, notificationRule } = body;
    
    // Validate notification rule if provided
    if (notificationRule !== undefined && !isValidNotificationRule(notificationRule)) {
      return NextResponse.json(
        { error: 'notificationRule must be one of: all, mentions, silent, off' },
        { status: 400 }
      );
    }
    
    // Update mapping
    const updatedMapping: WhatsAppChannelMapping = {
      ...existingMapping,
      colonyChannelName: colonyChannelName ?? existingMapping.colonyChannelName,
      whatsappGroupName: whatsappGroupName ?? existingMapping.whatsappGroupName,
      notificationRule: notificationRule ?? existingMapping.notificationRule,
      updatedAt: new Date(),
    };
    
    store.set(id, updatedMapping);
    
    return NextResponse.json({
      success: true,
      mapping: {
        ...updatedMapping,
        createdAt: updatedMapping.createdAt.toISOString(),
        updatedAt: updatedMapping.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating WhatsApp channel mapping:', error);
    return NextResponse.json(
      { error: 'Failed to update mapping' },
      { status: 500 }
    );
  }
}

// DELETE /api/whatsapp/channels/[id] - Delete a mapping
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const store = getWhatsAppChannelStore();
    const existingMapping = store.get(id);
    
    if (!existingMapping) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }
    
    store.delete(id);
    
    return NextResponse.json({
      success: true,
      message: 'Mapping deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting WhatsApp channel mapping:', error);
    return NextResponse.json(
      { error: 'Failed to delete mapping' },
      { status: 500 }
    );
  }
}
