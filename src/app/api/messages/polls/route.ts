import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { createPoll, getPoll, getPollByMessageId, voteOnPoll, closePoll, getAllPolls } from '@/lib/message-polls';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// GET /api/messages/polls - Get all polls or specific poll
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pollId = searchParams.get('pollId');
  const messageId = searchParams.get('messageId');
  
  // Get single poll by ID
  if (pollId) {
    const poll = getPoll(pollId);
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    return NextResponse.json({ poll });
  }
  
  // Get poll by message ID
  if (messageId) {
    const poll = getPollByMessageId(messageId);
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found for this message' }, { status: 404 });
    }
    return NextResponse.json({ poll });
  }
  
  // Get all polls
  const polls = getAllPolls();
  return NextResponse.json({ polls });
}

// POST /api/messages/polls - Create a new poll
export async function POST(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  // Apply rate limiting (20 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`polls:${clientIp}`, { windowMs: 60000, maxRequests: 20 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { messageId, question, options, isMultiVote } = body;
    
    // Validate required fields
    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }
    
    if (question.length > 200) {
      return NextResponse.json({ error: 'question too long (max 200 chars)' }, { status: 400 });
    }
    
    if (!options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: 'At least 2 options are required' }, { status: 400 });
    }
    
    if (options.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 options allowed' }, { status: 400 });
    }
    
    // Validate each option
    for (const opt of options) {
      if (typeof opt !== 'string' || opt.trim().length === 0) {
        return NextResponse.json({ error: 'All options must be non-empty strings' }, { status: 400 });
      }
      if (opt.length > 100) {
        return NextResponse.json({ error: 'Option too long (max 100 chars)' }, { status: 400 });
      }
    }
    
    // Check if poll already exists for this message
    const existingPoll = getPollByMessageId(messageId);
    if (existingPoll) {
      return NextResponse.json({ error: 'Poll already exists for this message' }, { status: 409 });
    }
    
    // Create the poll
    const poll = createPoll(
      messageId,
      question.trim(),
      options.map(o => o.trim()),
      authResult.payload?.name || 'Unknown',
      isMultiVote === true
    );
    
    return NextResponse.json({
      success: true,
      poll,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create poll error:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

// PATCH /api/messages/polls - Vote on a poll or close a poll
export async function PATCH(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  
  // Apply rate limiting (30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`polls-vote:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { pollId, action, optionId } = body;
    
    if (!pollId || typeof pollId !== 'string') {
      return NextResponse.json({ error: 'pollId is required' }, { status: 400 });
    }
    
    const poll = getPoll(pollId);
    
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    
    // Handle vote action
    if (action === 'vote') {
      if (!optionId || typeof optionId !== 'string') {
        return NextResponse.json({ error: 'optionId is required for voting' }, { status: 400 });
      }
      
      const userName = authResult.payload?.name || 'Unknown';
      const updatedPoll = voteOnPoll(pollId, optionId, userName);
      
      if (!updatedPoll) {
        return NextResponse.json({ error: 'Failed to vote' }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        poll: updatedPoll,
      });
    }
    
    // Handle close action
    if (action === 'close') {
      // Only poll creator can close
      const userName = authResult.payload?.name || 'Unknown';
      if (poll.createdBy !== userName) {
        return NextResponse.json({ error: 'Only poll creator can close the poll' }, { status: 403 });
      }
      
      const closedPoll = closePoll(pollId);
      
      if (!closedPoll) {
        return NextResponse.json({ error: 'Failed to close poll' }, { status: 500 });
      }
      
      return NextResponse.json({
        success: true,
        poll: closedPoll,
      });
    }
    
    return NextResponse.json({ error: 'Invalid action. Use "vote" or "close"' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Poll error:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
