import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import {
  getWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  canManageWorkspace,
  isWorkspaceMember,
  getUserRole,
  createWorkspaceInvitation,
  getWorkspaceInvitations,
} from '@/lib/workspace-store';
import { incrementMetric } from '@/lib/metrics';
import type { WorkspaceRole } from '@/lib/types';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;

  const authResult = withAuth(request);
  const userId = authResult.valid && authResult.payload ? authResult.payload.userId : null;

  incrementMetric('requests');

  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Check if user is a member
    if (userId && !isWorkspaceMember(workspaceId, userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const members = getWorkspaceMembers(workspaceId);
    const invitations = getWorkspaceInvitations(workspaceId);

    return NextResponse.json({
      members: members.map(m => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      invitations: invitations.map(i => ({
        id: i.id,
        email: i.email,
        role: i.role,
        invitedBy: i.invitedBy,
        expiresAt: i.expiresAt,
      })),
    });
  } catch (e) {
    console.error('Error fetching workspace members:', e);
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
  }
}

// POST /api/workspaces/[id]/members - Add member or invite user
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;

  // Apply rate limiting
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 10 });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }

  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const userId = authResult.payload!.userId;

  // Check if user can manage workspace (add members)
  if (!canManageWorkspace(workspaceId, userId)) {
    return NextResponse.json({ error: 'Access denied. Only owners and admins can add members.' }, { status: 403 });
  }

  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await request.json();

    // Check if inviting by email or adding by userId
    if (body.email) {
      // Invite by email
      if (!body.email || typeof body.email !== 'string') {
        return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }

      // Validate role
      const validRoles: WorkspaceRole[] = ['admin', 'member', 'guest'];
      const role = body.role && validRoles.includes(body.role) ? body.role : 'member';

      const invitation = createWorkspaceInvitation(workspaceId, body.email, role, userId);

      incrementMetric('requests');
      return NextResponse.json({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      }, { status: 201 });
    } else if (body.userId) {
      // Add member by userId
      if (!body.userId || typeof body.userId !== 'string') {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }

      const validRoles: WorkspaceRole[] = ['admin', 'member', 'guest'];
      const role = body.role && validRoles.includes(body.role) ? body.role : 'member';

      const member = addWorkspaceMember(workspaceId, body.userId, role);

      if (!member) {
        return NextResponse.json({ error: 'Failed to add member. User may already be a member or workspace not found.' }, { status: 400 });
      }

      incrementMetric('requests');
      return NextResponse.json({
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
      }, { status: 201 });
    } else {
      return NextResponse.json({ error: 'Either email or userId is required' }, { status: 400 });
    }
  } catch (e: any) {
    if (e.message.includes('maximum member limit')) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('Error adding workspace member:', e);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id]/members - Remove member
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;

  // Apply rate limiting
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 10 });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }

  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  const userId = authResult.payload!.userId;

  // Get the user to remove from query params
  const { searchParams } = new URL(request.url);
  const memberUserId = searchParams.get('userId');

  if (!memberUserId) {
    return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
  }

  // Check if user can manage workspace or is removing themselves
  const canManage = canManageWorkspace(workspaceId, userId);
  const isSelfRemoval = userId === memberUserId;

  if (!canManage && !isSelfRemoval) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  try {
    const removed = removeWorkspaceMember(workspaceId, memberUserId);

    if (!removed) {
      return NextResponse.json({ error: 'Failed to remove member. User may not be a member or cannot be removed.' }, { status: 400 });
    }

    incrementMetric('requests');
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Error removing workspace member:', e);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
