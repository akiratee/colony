import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import {
  getInvitationByToken,
  acceptInvitation,
} from '@/lib/workspace-store';
import { incrementMetric } from '@/lib/metrics';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

// POST /api/workspaces/invitations/[token]/accept - Accept a workspace invitation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

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

  try {
    // Find the invitation
    const invitation = getInvitationByToken(token);

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found or already accepted' }, { status: 404 });
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    // Accept the invitation
    const success = acceptInvitation(token, userId);

    if (!success) {
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 400 });
    }

    incrementMetric('requests');
    return NextResponse.json({
      success: true,
      workspaceId: invitation.workspaceId,
      role: invitation.role,
    });
  } catch (e) {
    console.error('Error accepting invitation:', e);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}
