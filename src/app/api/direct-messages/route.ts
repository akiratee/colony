import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { findDirectMessage, createDirectMessage, getDirectMessages } from '@/lib/channelStore';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// GET /api/direct-messages - Get all DMs for the authenticated user
export async function GET(request: Request) {
  // Apply rate limiting (10 req/min)
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
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  const userId = authResult.payload.userId;
  
  // Try Supabase first
  if (supabase) {
    try {
      // Get DMs where user is a participant
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('is_direct_message', true)
        .contains('participant_ids', [userId])
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        return NextResponse.json(data);
      }
    } catch (e) {
      console.error('Supabase error, using fallback:', e);
    }
  }
  
  // Fallback to in-memory store
  const dms = getDirectMessages(userId);
  return NextResponse.json(dms);
}

// POST /api/direct-messages - Create or get a DM with another user
export async function POST(request: Request) {
  // Apply rate limiting (10 req/min)
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
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  
  const currentUserId = authResult.payload.userId;
  
  try {
    const body = await request.json();
    const { userId: targetUserId } = body;
    
    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'Target user ID is required' }, { status: 400 });
    }
    
    if (targetUserId === currentUserId) {
      return NextResponse.json({ error: 'Cannot create DM with yourself' }, { status: 400 });
    }
    
    // Try Supabase first
    if (supabase) {
      try {
        // Check if DM already exists
        const { data: existing } = await supabase
          .from('channels')
          .select('*')
          .eq('is_direct_message', true)
          .contains('participant_ids', [currentUserId, targetUserId])
          .single();
        
        if (existing) {
          return NextResponse.json(existing);
        }
        
        // Create new DM
        const { data, error } = await supabase
          .from('channels')
          .insert({
            name: `dm-${currentUserId}-${targetUserId}`,
            description: 'Direct message',
            is_direct_message: true,
            participant_ids: [currentUserId, targetUserId],
          })
          .select()
          .single();
        
        if (!error && data) {
          return NextResponse.json(data, { status: 201 });
        }
      } catch (e) {
        console.error('Supabase error, using fallback:', e);
      }
    }
    
    // Fallback to in-memory store
    // Check if DM already exists
    let dm = findDirectMessage(currentUserId, targetUserId);
    
    if (!dm) {
      // Create new DM
      dm = createDirectMessage(currentUserId, targetUserId);
    }
    
    return NextResponse.json({
      id: dm.id,
      name: dm.name,
      description: dm.description,
      isDirectMessage: dm.isDirectMessage,
      participantIds: dm.participantIds,
      createdAt: dm.createdAt?.toISOString() ?? new Date().toISOString(),
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('Direct message error:', error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
