import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import {
  getWorkspace,
  getWorkspaceMember,
  updateWorkspaceMemberRole,
  canManageWorkspace,
  isWorkspaceMember,
} from '@/lib/workspace-store';
import { incrementMetric } from '@/lib/metrics';
import type { WorkspaceRole } from '@/lib/types';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

export async function PATCH(
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

  // Get target user from query params
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
  }

  // Check if user can manage workspace (change roles)
  if (!canManageWorkspace(workspaceId, userId)) {
    return NextResponse.json({ error: 'Access denied. Only owners and admins can change member roles.' }, { status: 403 });
  }

  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const targetMember = getWorkspaceMember(workspaceId, targetUserId);
    if (!targetMember) {
      return NextResponse.json({ error: 'Member not found in workspace' }, { status: 404 });
    }

    // Cannot change owner's role
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot change owner role' }, { status: 400 });
    }

    const body = await request.json();

    // Validate role
    const validRoles: WorkspaceRole[] = ['admin', 'member', 'guest'];
    if (!body.role || !validRoles.includes(body.role)) {
      return NextResponse.json({ error: 'Valid role is required (admin, member, or guest)' }, { status: 400 });
    }

    const updated = updateWorkspaceMemberRole(workspaceId, targetUserId, body.role);

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 400 });
    }

    incrementMetric('requests');
    return NextResponse.json({
      userId: updated.userId,
      role: updated.role,
      joinedAt: updated.joinedAt,
    });
  } catch (e) {
    console.error('Error updating member role:', e);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
}
