import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import {
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  removeWorkspaceMember,
  canManageWorkspace,
  isWorkspaceMember,
  getUserRole,
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

    // Get workspace members
    const members = getWorkspaceMembers(workspaceId);

    return NextResponse.json({
      ...workspace,
      members: members.map(m => ({
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      memberCount: members.length,
    });
  } catch (e) {
    console.error('Error fetching workspace:', e);
    return NextResponse.json({ error: 'Failed to fetch workspace' }, { status: 500 });
  }
}

// PUT /api/workspaces/[id] - Update a workspace
export async function PUT(
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

  // Check if user can manage workspace
  if (!canManageWorkspace(workspaceId, userId)) {
    return NextResponse.json({ error: 'Access denied. Only owners and admins can update workspace.' }, { status: 403 });
  }

  try {
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate name if provided
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 50) {
        return NextResponse.json({ error: 'Workspace name must be 2-50 characters' }, { status: 400 });
      }
    }

    // Validate description length
    if (body.description !== undefined && body.description.length > 500) {
      return NextResponse.json({ error: 'Description too long (max 500 chars)' }, { status: 400 });
    }

    // Validate settings if provided
    if (body.settings) {
      // Validate maxMembers
      if (body.settings.maxMembers !== undefined) {
        if (typeof body.settings.maxMembers !== 'number' || body.settings.maxMembers < 1 || body.settings.maxMembers > 1000) {
          return NextResponse.json({ error: 'maxMembers must be between 1 and 1000' }, { status: 400 });
        }
      }
      // Validate allowGuestAccess
      if (body.settings.allowGuestAccess !== undefined) {
        if (typeof body.settings.allowGuestAccess !== 'boolean') {
          return NextResponse.json({ error: 'allowGuestAccess must be a boolean' }, { status: 400 });
        }
      }
      // Validate defaultRole
      if (body.settings.defaultRole !== undefined) {
        const validRoles = ['owner', 'admin', 'member', 'guest'];
        if (!validRoles.includes(body.settings.defaultRole)) {
          return NextResponse.json({ error: 'defaultRole must be one of: owner, admin, member, guest' }, { status: 400 });
        }
      }
      // Validate theme
      if (body.settings.theme !== undefined) {
        const validThemes = ['light', 'dark', 'system'];
        if (!validThemes.includes(body.settings.theme)) {
          return NextResponse.json({ error: 'theme must be one of: light, dark, system' }, { status: 400 });
        }
      }
      // Validate requireInvitationForJoin
      if (body.settings.requireInvitationForJoin !== undefined) {
        if (typeof body.settings.requireInvitationForJoin !== 'boolean') {
          return NextResponse.json({ error: 'requireInvitationForJoin must be a boolean' }, { status: 400 });
        }
      }
      // Validate notifyOnMention
      if (body.settings.notifyOnMention !== undefined) {
        if (typeof body.settings.notifyOnMention !== 'boolean') {
          return NextResponse.json({ error: 'notifyOnMention must be a boolean' }, { status: 400 });
        }
      }
      // Validate notifyOnMessage
      if (body.settings.notifyOnMessage !== undefined) {
        if (typeof body.settings.notifyOnMessage !== 'boolean') {
          return NextResponse.json({ error: 'notifyOnMessage must be a boolean' }, { status: 400 });
        }
      }
      // Validate defaultChannelCategory
      if (body.settings.defaultChannelCategory !== undefined) {
        if (typeof body.settings.defaultChannelCategory !== 'string' || body.settings.defaultChannelCategory.length > 50) {
          return NextResponse.json({ error: 'defaultChannelCategory must be a string (max 50 chars)' }, { status: 400 });
        }
      }
    }

    const updated = updateWorkspace(workspaceId, {
      name: body.name,
      description: body.description,
      settings: body.settings,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Failed to update workspace' }, { status: 400 });
    }

    incrementMetric('requests');
    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      type: updated.type,
      description: updated.description,
      ownerId: updated.ownerId,
      createdAt: updated.createdAt,
      settings: updated.settings,
    });
  } catch (e) {
    console.error('Error updating workspace:', e);
    return NextResponse.json({ error: 'Failed to update workspace' }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id] - Delete a workspace
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workspaceId } = await params;

  // Apply rate limiting
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 5 });

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

  // Check if workspace exists
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // Only owner can delete workspace
  if (workspace.ownerId !== userId) {
    return NextResponse.json({ error: 'Access denied. Only the workspace owner can delete it.' }, { status: 403 });
  }

  try {
    const deleted = deleteWorkspace(workspaceId);

    if (!deleted) {
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 400 });
    }

    incrementMetric('requests');
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Error deleting workspace:', e);
    return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 });
  }
}
