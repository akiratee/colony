import { NextResponse } from 'next/server';
import { sanitizeContent } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import {
  getWorkspaces,
  getWorkspace,
  getUserWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  addWorkspaceMember,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
  canManageWorkspace,
  isWorkspaceMember,
  getUserRole,
} from '@/lib/workspace-store';
import { incrementMetric } from '@/lib/metrics';
import type { WorkspaceType, WorkspaceRole } from '@/lib/types';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

// GET /api/workspaces - Get all workspaces or user's workspaces
export async function GET(request: Request) {
  const authResult = withAuth(request);
  const userId = authResult.valid && authResult.payload ? authResult.payload.userId : null;

  incrementMetric('requests');

  try {
    const { searchParams } = new URL(request.url);
    const userOnly = searchParams.get('userOnly') === 'true';

    let workspaces;
    if (userOnly && userId) {
      // Return only workspaces the user is a member of
      workspaces = getUserWorkspaces(userId);
    } else {
      // Return all workspaces (for admin/owner users)
      workspaces = getWorkspaces();
    }

    // Add member count to each workspace
    const workspacesWithMemberCount = workspaces.map(w => ({
      ...w,
      memberCount: getWorkspaceMembers(w.id).length,
    }));

    return NextResponse.json(workspacesWithMemberCount);
  } catch (e) {
    console.error('Error fetching workspaces:', e);
    return NextResponse.json({ error: 'Failed to fetch workspaces' }, { status: 500 });
  }
}

// POST /api/workspaces - Create a new workspace
export async function POST(request: Request) {
  // Apply rate limiting (5 req/min for workspace creation)
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

  try {
    const body = await request.json();

    // Validate workspace input
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    const trimmedName = body.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json({ error: 'Workspace name must be 2-50 characters' }, { status: 400 });
    }

    // Validate workspace type
    const validTypes: WorkspaceType[] = ['personal', 'team', 'organization'];
    const workspaceType = body.type && validTypes.includes(body.type) ? body.type : 'team';

    // Validate description length
    if (body.description && body.description.length > 500) {
      return NextResponse.json({ error: 'Description too long (max 500 chars)' }, { status: 400 });
    }

    const workspace = createWorkspace(
      trimmedName,
      workspaceType,
      userId,
      body.description
    );

    incrementMetric('requests');
    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      type: workspace.type,
      description: workspace.description,
      ownerId: workspace.ownerId,
      createdAt: workspace.createdAt,
      settings: workspace.settings,
    }, { status: 201 });
  } catch (e: any) {
    if (e.message.includes('already exists')) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error('Error creating workspace:', e);
    return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
  }
}
