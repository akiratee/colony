import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { getMessages, getMessageCount } from '@/lib/messageStore';
import { getChannels, getChannel } from '@/lib/channelStore';

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
  const rateLimitResult = rateLimit(`stats:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const timeframe = searchParams.get('timeframe') || 'all'; // '24h', '7d', '30d', 'all'
  
  // Get all channels
  const channels = getChannels();
  
  // Calculate timeframe filter
  let cutoffDate: Date | null = null;
  if (timeframe !== 'all') {
    const now = Date.now();
    const hours = timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : timeframe === '30d' ? 720 : 0;
    cutoffDate = new Date(now - hours * 60 * 60 * 1000);
  }
  
  // Calculate stats
  const stats = channels.map(channel => {
    const allMessages = getMessages(channel.id, 10000, 0);
    
    // Filter by timeframe if specified
    const messages = cutoffDate 
      ? allMessages.filter(m => new Date(m.timestamp) >= cutoffDate)
      : allMessages;
    
    // Calculate user activity
    const userActivity: Record<string, number> = {};
    messages.forEach(m => {
      const authorName = m.author.name;
      userActivity[authorName] = (userActivity[authorName] || 0) + 1;
    });
    
    // Get top contributors
    const topContributors = Object.entries(userActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, messageCount: count }));
    
    // Count bots vs humans
    const botMessages = messages.filter(m => m.author.isBot).length;
    const humanMessages = messages.length - botMessages;
    
    // Get recent message (last message)
    const recentMessage = messages.length > 0 ? {
      content: messages[messages.length - 1].content.substring(0, 100),
      author: messages[messages.length - 1].author.name,
      timestamp: new Date(messages[messages.length - 1].timestamp).toISOString()
    } : null;
    
    return {
      channelId: channel.id,
      channelName: channel.name,
      totalMessages: messages.length,
      humanMessages,
      botMessages,
      topContributors,
      recentMessage,
    };
  });
  
  // If specific channel requested, return only that channel's stats
  if (channelId) {
    const channelStats = stats.find(s => s.channelId === channelId);
    if (!channelStats) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    return NextResponse.json(channelStats);
  }
  
  // Return summary stats
  const totalMessages = stats.reduce((sum, s) => sum + s.totalMessages, 0);
  const totalHumanMessages = stats.reduce((sum, s) => sum + s.humanMessages, 0);
  const totalBotMessages = stats.reduce((sum, s) => sum + s.botMessages, 0);
  
  // Get overall top contributors
  const overallUserActivity: Record<string, number> = {};
  stats.forEach(s => {
    s.topContributors.forEach(c => {
      overallUserActivity[c.name] = (overallUserActivity[c.name] || 0) + c.messageCount;
    });
  });
  const overallTopContributors = Object.entries(overallUserActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, messageCount: count }));
  
  return NextResponse.json({
    timeframe,
    channels: stats.length,
    summary: {
      totalMessages,
      totalHumanMessages,
      totalBotMessages,
      totalChannels: stats.length,
    },
    overallTopContributors,
    channelStats: stats,
  });
}
