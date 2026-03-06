import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { getBot, deleteBot, botExists, updateBot, Bot } from '@/lib/botStore';
import { sanitizeContent } from '@/lib/validation';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// GET /api/bots/:id - Get a single bot
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Validate bot ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }
    
    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
      }
      
      return NextResponse.json(data);
    }
    
    // Fallback to in-memory store
    const bot = getBot(id);
    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    
    return NextResponse.json(bot);
  } catch (error: unknown) {
    console.error('Get bot error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// PATCH /api/bots/:id - Update a bot
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    const body = await request.json();
    
    // Validate bot ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }
    
    // Check if bot exists
    if (!botExists(id)) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    
    // Build update object with sanitization
    const updates: Partial<Bot> = {};
    
    if (body.name !== undefined) {
      updates.name = sanitizeContent(body.name);
    }
    if (body.description !== undefined) {
      updates.description = sanitizeContent(body.description);
    }
    if (body.avatar !== undefined) {
      updates.avatar = sanitizeContent(body.avatar);
    }
    if (body.instructions !== undefined) {
      updates.instructions = sanitizeContent(body.instructions);
    }
    if (body.apiEndpoint !== undefined) {
      updates.apiEndpoint = body.apiEndpoint;
    }
    if (body.status !== undefined) {
      if (!['online', 'offline'].includes(body.status)) {
        return NextResponse.json({ error: 'Status must be online or offline' }, { status: 400 });
      }
      updates.status = body.status;
    }
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }
    
    // Try Supabase first
    if (supabase) {
      const { data, error } = await supabase
        .from('bots')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating bot:', error);
        return NextResponse.json({ error: 'Failed to update bot' }, { status: 500 });
      }
      
      return NextResponse.json(data);
    }
    
    // Fallback to in-memory store
    const updatedBot = updateBot(id, updates);
    return NextResponse.json(updatedBot);
  } catch (error: unknown) {
    console.error('Update bot error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    // Handle specific errors from updateBot
    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 });
    }
    if (errorMessage.includes('already exists')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    if (errorMessage.includes("Status must be")) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params;
    
    // Validate bot ID
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Bot ID is required' }, { status: 400 });
    }
    
    // Check if bot exists
    if (!botExists(id)) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }
    
    // Fallback mode: allow deletion from in-memory store
    if (!supabase) {
      deleteBot(id);
      return NextResponse.json({ success: true, id });
    }
    
    // Delete from database
    const { error: botError } = await supabase
      .from('bots')
      .delete()
      .eq('id', id);
    
    if (botError) {
      console.error('Error deleting bot:', botError);
      return NextResponse.json({ error: 'Failed to delete bot' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, id });
  } catch (error: unknown) {
    console.error('Delete bot error:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
