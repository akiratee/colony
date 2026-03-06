import { NextResponse } from 'next/server';
import { sanitizeContent, validateBotInput } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { getBots, addBot } from '@/lib/botStore';
import { generateId } from '@/lib/id';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

export async function GET() {
  return NextResponse.json(getBots());
}

export async function POST(request: Request) {
  // Apply rate limiting (10 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`bot:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    
    // Validate input using shared validation
    const validation = validateBotInput(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    const newBot = addBot({
      id: generateId(),
      name: sanitizeContent(body.name),
      description: sanitizeContent(body.description || ''),
      avatar: sanitizeContent(body.avatar || '🤖'),
      status: 'offline',
      instructions: sanitizeContent(body.instructions || ''),
      apiEndpoint: body.apiEndpoint || '',
      created_at: new Date().toISOString(),
    });
    
    return NextResponse.json(newBot, { status: 201 });
  } catch (error: unknown) {
    // Handle duplicate bot name error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('already exists')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
