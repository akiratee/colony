// User Login API for Colony
// POST /api/auth/login

import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { generateToken } from '@/lib/jwt-auth';
import { getFallbackUser, verifyPassword } from '@/lib/user-store';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

export async function POST(request: Request) {
  // Apply rate limiting (10 req/min for login)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 10 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { email, password } = body;
    
    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    
    const normalizedEmail = email.toLowerCase().trim();
    
    // User type (non-null after lookup)
    type User = { id: string; email: string; name: string; password_hash: string; avatar: string };
    let user: User;
    
    // Check if Supabase is configured and working
    const supabaseConfigured = await isSupabaseConfigured();
    const useSupabase = supabase && supabaseConfigured;
    
    if (useSupabase && supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .single();
      
      if (error || !data) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
      
      user = data as User;
    } else {
      // Fallback to in-memory store
      console.log('Using in-memory user store (Supabase not available)');
      const fallbackUser = getFallbackUser(normalizedEmail);
      
      if (!fallbackUser) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }
      
      user = fallbackUser;
    }
    
    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    
    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    });
    
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      token,
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
