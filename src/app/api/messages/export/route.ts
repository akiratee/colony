import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { getMessages } from '@/lib/messageStore';

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
  
  // Apply rate limiting (strict: 10 req/min for export)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`export:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const format = searchParams.get('format') || 'json'; // json or csv
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
  const offset = parseInt(searchParams.get('offset') || '0');
  
  // Get messages, optionally filtered by channel
  const allMessages = channelId ? getMessages(channelId) : getMessages();
  
  // Apply pagination
  const paginatedMessages = allMessages.slice(offset, offset + limit);
  
  // Serialize timestamps to ISO strings
  const serializedMessages = paginatedMessages.map(m => ({
    ...m,
    timestamp: new Date(m.timestamp).toISOString(),
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
    pinnedAt: m.pinnedAt ? new Date(m.pinnedAt).toISOString() : null,
  }));
  
  if (format === 'csv') {
    // Convert to CSV format
    const headers = ['id', 'channelId', 'content', 'authorName', 'authorAvatar', 'timestamp', 'editedAt', 'pinnedAt', 'reactions'];
    const csvRows = [headers.join(',')];
    
    for (const msg of serializedMessages) {
      const row = [
        msg.id,
        msg.channelId,
        `"${(msg.content || '').replace(/"/g, '""')}"`,
        `"${(msg.author?.name || '').replace(/"/g, '""')}"`,
        msg.author?.avatar || '',
        msg.timestamp,
        msg.editedAt || '',
        msg.pinnedAt || '',
        `"${JSON.stringify(msg.reactions || []).replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="messages${channelId ? '-' + channelId : ''}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }
  
  // Default: JSON format
  return NextResponse.json({
    messages: serializedMessages,
    total: allMessages.length,
    returned: serializedMessages.length,
    limit,
    offset,
    channelId: channelId || 'all',
    exportedAt: new Date().toISOString(),
  });
}
