import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { searchMessages } from '@/lib/messageStore';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

export async function GET(request: Request) {
  // Check authentication in production
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  // Apply rate limiting (moderate: 30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`search:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const channelId = searchParams.get('channelId') || undefined;
  const userName = searchParams.get('userName') || undefined;
  const dateFrom = searchParams.get('dateFrom') || undefined;
  const dateTo = searchParams.get('dateTo') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  
  if (!query || query.trim().length === 0) {
    return NextResponse.json({ error: 'Search query (q) is required' }, { status: 400 });
  }
  
  // Parse date filters
  const options: {
    dateFrom?: Date;
    dateTo?: Date;
    userName?: string;
  } = {};
  
  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (!isNaN(parsed.getTime())) {
      options.dateFrom = parsed;
    }
  }
  
  if (dateTo) {
    const parsed = new Date(dateTo);
    if (!isNaN(parsed.getTime())) {
      options.dateTo = parsed;
    }
  }
  
  if (userName) {
    options.userName = userName.trim();
  }
  
  // Search messages with filters
  const results = searchMessages(query, channelId, options);
  const limitedResults = results.slice(0, limit);
  
  // Serialize timestamps to ISO strings
  const serializedResults = limitedResults.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp).toISOString()
  }));
  
  return NextResponse.json({
    messages: serializedResults,
    total: results.length,
    returned: serializedResults.length,
    query: query.trim(),
    filters: {
      channelId: channelId || null,
      userName: options.userName || null,
      dateFrom: options.dateFrom?.toISOString() || null,
      dateTo: options.dateTo?.toISOString() || null,
    },
  });
}
