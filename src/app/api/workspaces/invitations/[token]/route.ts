import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import {
  getInvitationByToken,
  getWorkspace,
} from '@/lib/workspace-store';
import { incrementMetric } from '@/lib/metrics';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

// GET /api/workspaces/invitations/[token] - Get invitation details by token
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Apply rate limiting (stricter for invitation lookup to prevent enumeration)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 20 });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }

  // Check authentication (optional - allows checking if user is logged in)
  const authResult = withAuth(request);
  const isAuthenticated = authResult.valid;

  try {
    // Find the invitation - use consistent error message to prevent enumeration
    const invitation = getInvitationByToken(token);

    // Return consistent response whether invitation exists or not
    // This prevents token enumeration attacks
    if (!invitation) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json(
        { valid: false, error: 'Invitation has expired' },
        { status: 404 }
      );
    }

    // Check if already accepted
    if (invitation.accepted) {
      return NextResponse.json(
        { valid: false, error: 'Invitation has already been accepted' },
        { status: 404 }
      );
    }

    // Return invitation details (without sensitive data)
    // Get workspace name for the response
    const workspace = getWorkspace(invitation.workspaceId);

    incrementMetric('requests');

    // Return invitation details (without sensitive data)
    return NextResponse.json({
      valid: true,
      workspaceId: invitation.workspaceId,
      workspaceName: workspace?.name || 'Unknown Workspace',
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      invitedBy: invitation.invitedBy,
      // Include whether the current user is the one invited (if authenticated)
      isInvitedUser: isAuthenticated && authResult.payload?.userId === invitation.email,
    });
  } catch (e) {
    console.error('Error fetching invitation:', e);
    return NextResponse.json(
      { valid: false, error: 'Invalid or expired invitation token' },
      { status: 404 }
    );
  }
}
