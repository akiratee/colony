// Colony WhatsApp Queue Processor API
// Processes queued WhatsApp outbound messages

import { NextRequest, NextResponse } from 'next/server';
import { processMessageQueue, getQueueStatus } from '@/lib/whatsapp-outbound';
import { incrementMetric } from '@/lib/metrics';

export async function POST(request: NextRequest) {
  try {
    // Process the queue
    const result = await processMessageQueue();
    
    incrementMetric('requests');
    
    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('WhatsApp queue processing error:', error);
    return NextResponse.json(
      { error: 'Queue processing failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Return queue status
  const status = getQueueStatus();
  
  return NextResponse.json({
    queueSize: status.size,
    oldestMessage: status.oldestMessage,
    maxRetries: 3,
    timestamp: new Date().toISOString(),
  });
}
