// Logout API for Colony
// POST /api/auth/logout

import { NextResponse } from 'next/server';
import { withAuth, extractTokenFromHeader, invalidateToken } from '@/lib/jwt-auth';

// Get token from Authorization header
function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  return extractTokenFromHeader(authHeader || undefined);
}

export async function POST(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }
  
  // Invalidate the token (add to blocklist)
  const token = getTokenFromRequest(request);
  if (token) {
    invalidateToken(token);
  }
  
  // Log logout event (could be used for analytics, session tracking, etc.)
  console.log(`User logged out: ${authResult.payload.userId} (${authResult.payload.name})`);
  
  return NextResponse.json({
    message: 'Logged out successfully',
  });
}
