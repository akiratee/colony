import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/lib/jwt-auth';
import { 
  getChannel, 
  canAccessChannel, 
  getChannelRole, 
  setChannelRole, 
  removeChannelMember,
  getChannelMembers,
  hasChannelRole,
  canManageChannel
} from '@/lib/channelStore';
import type { ChannelRole } from '@/lib/types';

// GET /api/channels/[id]/roles - Get all members and their roles
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
  
  // Get members (from in-memory store)
  const members = getChannelMembers(id);
  
  return NextResponse.json({ members });
}

// POST /api/channels/[id]/roles - Set a user's role
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
  
  // Get channel
  const channel = getChannel(id);
  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
  }
  
  // Check if user can manage channel (must be moderator or admin)
  if (!canManageChannel(id, userId)) {
    return NextResponse.json({ error: 'Only moderators and admins can manage roles' }, { status: 403 });
  }
  
  try {
    const body = await request.json();
    const { userId: targetUserId, role } = body;
    
    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }
    
    // Validate role
    if (!role || !['admin', 'moderator', 'member'].includes(role)) {
      return NextResponse.json({ error: 'role must be admin, moderator, or member' }, { status: 400 });
    }
    
    // Prevent user from demoting themselves if they're the only admin
    if (targetUserId === userId) {
      const currentRole = getChannelRole(id, userId);
      if (currentRole === 'admin') {
        const members = getChannelMembers(id);
        const adminCount = members.filter(m => m.role === 'admin').length;
        if (adminCount <= 1) {
          return NextResponse.json({ error: 'Cannot demote yourself - you are the only admin' }, { status: 400 });
        }
      }
    }
    
    // Set role in in-memory store
    const success = setChannelRole(id, targetUserId, role as ChannelRole);
    if (!success) {
      return NextResponse.json({ error: 'Failed to set role' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: `Role set to ${role}` });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

// DELETE /api/channels/[id]/roles?userId=xxx - Remove a user from channel
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
  
  // Get target user from query params
  const url = new URL(request.url);
  const targetUserId = url.searchParams.get('userId');
  
  if (!targetUserId) {
    return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
  }
  
  // Check permissions
  // User can remove themselves, or moderators/admins can remove others
  if (targetUserId !== userId) {
    if (!canManageChannel(id, userId)) {
      return NextResponse.json({ error: 'Only moderators and admins can remove others' }, { status: 403 });
    }
    
    // Cannot remove an admin unless you're an admin
    const targetRole = getChannelRole(id, targetUserId);
    if (targetRole === 'admin') {
      const userRole = getChannelRole(id, userId);
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Cannot remove an admin' }, { status: 403 });
      }
    }
  }
  
  // Remove member from in-memory store
  const success = removeChannelMember(id, targetUserId);
  if (!success) {
    return NextResponse.json({ error: 'User not found in channel' }, { status: 404 });
  }
  
  return NextResponse.json({ success: true, message: `User removed from channel` });
}
