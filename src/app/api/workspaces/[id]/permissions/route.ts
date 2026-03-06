import { NextRequest, NextResponse } from 'next/server';
import { getUserPermissions } from '@/lib/workspace-store';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate auth
    const authResult = withAuth(request);
    if (!authResult.valid || !authResult.payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workspaceId } = await params;
    const userId = authResult.payload.userId;

    // Apply rate limit
    const clientIp = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';
    const rateLimitResult = rateLimit(`permissions:${clientIp}`, {
      windowMs: 60000,
      maxRequests: 30,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
        { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
      );
    }

    // Get user permissions for this workspace
    const permissions = getUserPermissions(workspaceId, userId);

    // If user has no access to workspace, still return basic info
    if (!permissions.canView) {
      return NextResponse.json(
        { error: 'Access denied to workspace' },
        { status: 403 }
      );
    }

    return NextResponse.json(permissions);
  } catch (error) {
    console.error('Error getting workspace permissions:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
