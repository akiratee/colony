import { NextResponse } from 'next/server';
import { getMetrics, getRawMetrics } from '@/lib/metrics';

export async function GET() {
  const metrics = getMetrics();
  
  // Return error if metrics not available
  if (!metrics) {
    return NextResponse.json({ error: 'Metrics system not available' }, { status: 503 });
  }
  
  const rawMetrics = getRawMetrics();
  const uptimeMs = rawMetrics.startTime ? Date.now() - rawMetrics.startTime : metrics.uptime;
  
  return NextResponse.json({
    uptime: {
      seconds: Math.floor(uptimeMs / 1000),
      human: `${Math.floor(uptimeMs / 60000)}m ${Math.floor((uptimeMs % 60000) / 1000)}s`,
    },
    requests: metrics.requests,
    messages: metrics.messagesCreated,
    channels: metrics.channelsCreated,
    users: metrics.usersRegistered,
    errors: metrics.errors,
    authFailures: metrics.authFailures,
    validationFailures: metrics.validationFailures,
    performance: {
      avgResponseTime: metrics.avgResponseTime,
      slowestResponseTime: metrics.slowestResponseTime,
      fastestResponseTime: metrics.fastestResponseTime,
    },
    websocket: {
      connections: metrics.socketConnections,
      messages: metrics.socketMessages,
    },
    whatsapp: {
      received: metrics.whatsappMessagesReceived,
      sent: metrics.whatsappMessagesSent,
    },
  });
}
