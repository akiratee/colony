import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt-auth';
import { 
  muteChannel, 
  unmuteChannel, 
  isChannelMuted, 
  getMutedChannels,
  getChannelMuteStatus 
} from '@/lib/channel-mute';

// GET /api/channels/mute - Get all muted channels for the current user
export async function GET(request: NextRequest) {
  const authResult = withAuth(request);
  
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  try {
    const mutedChannels = getMutedChannels(userId);
    
    return NextResponse.json({
      mutedChannels: mutedChannels.map(mute => ({
        channelId: mute.channelId,
        mutedAt: mute.mutedAt.toISOString(),
        expiresAt: mute.expiresAt?.toISOString() || null,
        isPermanent: !mute.expiresAt,
      })),
    });
  } catch (error) {
    console.error('Error getting muted channels:', error);
    return NextResponse.json(
      { error: 'Failed to get muted channels' },
      { status: 500 }
    );
  }
}

// POST /api/channels/mute - Mute a channel
// Body: { channelId: string, durationMinutes?: number }
export async function POST(request: NextRequest) {
  const authResult = withAuth(request);
  
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  try {
    const body = await request.json();
    const { channelId, durationMinutes } = body;
    
    // Validate channelId
    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      );
    }
    
    // Validate durationMinutes if provided
    if (durationMinutes !== undefined) {
      if (typeof durationMinutes !== 'number' || durationMinutes < 1) {
        return NextResponse.json(
          { error: 'durationMinutes must be a positive number' },
          { status: 400 }
        );
      }
    }
    
    // Check if already muted
    if (isChannelMuted(userId, channelId)) {
      const existingMute = getChannelMuteStatus(userId, channelId);
      return NextResponse.json({
        message: 'Channel already muted',
        mute: {
          channelId,
          mutedAt: existingMute?.mutedAt.toISOString(),
          expiresAt: existingMute?.expiresAt?.toISOString() || null,
          isPermanent: !existingMute?.expiresAt,
        },
      });
    }
    
    const mute = muteChannel(userId, channelId, durationMinutes);
    
    return NextResponse.json({
      message: 'Channel muted successfully',
      mute: {
        channelId: mute.channelId,
        mutedAt: mute.mutedAt.toISOString(),
        expiresAt: mute.expiresAt?.toISOString() || null,
        isPermanent: !mute.expiresAt,
      },
    });
  } catch (error) {
    console.error('Error muting channel:', error);
    return NextResponse.json(
      { error: 'Failed to mute channel' },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/mute?channelId=xxx - Unmute a channel
export async function DELETE(request: NextRequest) {
  const authResult = withAuth(request);
  
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');
    
    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId query parameter is required' },
        { status: 400 }
      );
    }
    
    const removed = unmuteChannel(userId, channelId);
    
    if (!removed) {
      return NextResponse.json(
        { error: 'Channel was not muted' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Channel unmuted successfully',
    });
  } catch (error) {
    console.error('Error unmuting channel:', error);
    return NextResponse.json(
      { error: 'Failed to unmute channel' },
      { status: 500 }
    );
  }
}
