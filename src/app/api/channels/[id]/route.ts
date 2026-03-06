import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/lib/jwt-auth';
import { getChannel, inviteUserToChannel, canAccessChannel, updateChannel as updateChannelInStore, removeUserFromChannel } from '@/lib/channelStore';
import { sanitizeContent, sanitizeChannelName } from '@/lib/validation';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  // Get channel
  const channel = getChannel(id);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }
  
  // Check if user can access the channel
  if (!canAccessChannel(id, userId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  
  return NextResponse.json(channel);
}

// Invite user to a private channel
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  try {
    const body = await request.json();
    const { userId: targetUserId } = body;
    
    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    
    // Get channel
    const channel = getChannel(id);
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    
    // Check if user can access the channel (must be member to invite)
    if (!canAccessChannel(id, userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    
    // Check if channel is private
    if (!channel.isPrivate) {
      return NextResponse.json({ error: 'Can only invite users to private channels' }, { status: 400 });
    }
    
    // Try Supabase first
    if (supabase) {
      const { data: channelData, error: channelError } = await supabase
        .from('channels')
        .select('allowed_users')
        .eq('id', id)
        .single();
      
      if (!channelError && channelData) {
        const currentUsers = channelData.allowed_users || [];
        if (!currentUsers.includes(targetUserId)) {
          const { error: updateError } = await supabase
            .from('channels')
            .update({ allowed_users: [...currentUsers, targetUserId] })
            .eq('id', id);
          
          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }
        }
      } else {
        return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      }
    }
    
    // Fallback to in-memory store
    const success = inviteUserToChannel(id, targetUserId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to invite user' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: `User ${targetUserId} invited` });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

// Update channel settings (name, description)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  // Get channel
  const channel = getChannel(id);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }
  
  // Check if user can access the channel (must be member to update)
  if (!canAccessChannel(id, userId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  
  try {
    const body = await request.json();
    
    // Validate and sanitize input
    const updates: { name?: string; description?: string } = {};
    
    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        return NextResponse.json({ error: 'Name must be a string' }, { status: 400 });
      }
      const trimmedName = body.name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 50) {
        return NextResponse.json({ error: 'Channel name must be 1-50 characters' }, { status: 400 });
      }
      if (!/^[a-z0-9-]+$/.test(trimmedName)) {
        return NextResponse.json({ error: 'Channel name must be lowercase alphanumeric with hyphens' }, { status: 400 });
      }
      updates.name = sanitizeChannelName(trimmedName);
    }
    
    if (body.description !== undefined) {
      if (typeof body.description !== 'string') {
        return NextResponse.json({ error: 'Description must be a string' }, { status: 400 });
      }
      if (body.description.length > 500) {
        return NextResponse.json({ error: 'Description too long (max 500 chars)' }, { status: 400 });
      }
      updates.description = sanitizeContent(body.description.trim());
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    
    // Try Supabase first
    if (supabase) {
      const supabaseUpdates: any = {};
      if (updates.name) {supabaseUpdates.name = updates.name;}
      if (updates.description !== undefined) {supabaseUpdates.description = updates.description;}
      
      const { data, error } = await supabase
        .from('channels')
        .update(supabaseUpdates)
        .eq('id', id)
        .select('id, name, description, is_private, allowed_users, created_at')
        .single();
      
      if (error) {
        // Check for duplicate name error
        if (error.message.includes('duplicate') || error.code === '23505') {
          return NextResponse.json({ error: 'Channel name already exists' }, { status: 409 });
        }
        console.error('Supabase update error:', error);
        return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 });
      }
      
      return NextResponse.json({
        id: data.id,
        name: data.name,
        description: data.description,
        isPrivate: data.is_private,
        allowedUsers: data.allowed_users,
        createdAt: data.created_at,
      });
    }
    
    // Fallback to in-memory store
    const updatedChannel = updateChannelInStore(id, updates);
    if (!updatedChannel) {
      return NextResponse.json({ error: 'Channel name already exists or channel not found' }, { status: 409 });
    }
    
    return NextResponse.json({
      id: updatedChannel.id,
      name: updatedChannel.name,
      description: updatedChannel.description,
      isPrivate: updatedChannel.isPrivate,
      allowedUsers: updatedChannel.allowedUsers,
      createdAt: updatedChannel.createdAt?.toISOString() ?? new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

// DELETE channel or remove user from private channel
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  // Get channel
  const channel = getChannel(id);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }
  
  // Check if user can access the channel
  if (!canAccessChannel(id, userId)) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }
  
  // Check for userId query param to remove a specific user from private channel
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('userId');
  
  if (targetUserId && channel.isPrivate) {
    // Remove user from private channel
    const success = removeUserFromChannel(id, targetUserId);
    if (!success) {
      return NextResponse.json({ error: 'Failed to remove user from channel' }, { status: 500 });
    }
    
    // Also update Supabase if available
    if (supabase) {
      const { data: channelData } = await supabase
        .from('channels')
        .select('allowed_users')
        .eq('id', id)
        .single();
      
      if (channelData) {
        const currentUsers = (channelData.allowed_users || []).filter((u: string) => u !== targetUserId);
        await supabase
          .from('channels')
          .update({ allowed_users: currentUsers })
          .eq('id', id);
      }
    }
    
    return NextResponse.json({ success: true, message: `User ${targetUserId} removed from channel` });
  }
  
  // If no userId param, return method not allowed (use different endpoint for channel deletion if needed)
  return NextResponse.json({ error: 'Use ?userId= to remove a user from private channel' }, { status: 400 });
}
