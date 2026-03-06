// User Registration API for Colony
// POST /api/auth/register

import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { rateLimit } from '@/lib/rate-limit';
import { generateToken } from '@/lib/jwt-auth';
import { hashPassword, addFallbackUser, fallbackUserExists } from '@/lib/user-store';
import { incrementMetric } from '@/lib/metrics';

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

export async function POST(request: Request) {
  // Apply rate limiting (5 req/min for registration)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(clientIp, { windowMs: 60000, maxRequests: 5 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { email, password, name } = body;
    
    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }
    
    // Validate password strength
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    
    if (password.length > 100) {
      return NextResponse.json({ error: 'Password must be less than 100 characters' }, { status: 400 });
    }
    
    // Validate name
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      return NextResponse.json({ error: 'Name must be 1-50 characters' }, { status: 400 });
    }
    
    // Hash password
    const passwordHash = hashPassword(password);
    
    // Check if Supabase is configured and working
    const supabaseConfigured = await isSupabaseConfigured();
    const useSupabase = supabase && supabaseConfigured;
    
    if (useSupabase && supabase) {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();
      
      if (existingUser) {
        return NextResponse.json({ error: 'User already exists' }, { status: 409 });
      }
      
      // Create user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase(),
          name: trimmedName,
          password_hash: passwordHash,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(trimmedName)}`,
        })
        .select()
        .single();
      
      if (insertError) {
        console.error('Supabase insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
      }
      
      // Generate JWT token
      const token = generateToken({
        userId: newUser.id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
      });
      
      incrementMetric('usersRegistered');
      incrementMetric('requests');
      
      return NextResponse.json({
        message: 'User created successfully',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          avatar: newUser.avatar,
        },
        token,
      });
    }
    
    // Fallback: Store in memory (development only)
    // Note: This won't persist across server restarts
    console.log('Using in-memory user storage (Supabase not available)');
    
    // Check if user already exists in fallback store
    if (fallbackUserExists(email.toLowerCase())) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }
    
    // Add user to fallback store
    const newUser = addFallbackUser(email.toLowerCase(), trimmedName, passwordHash);
    
    // Generate JWT token
    const token = generateToken({
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      avatar: newUser.avatar,
    });
    
    incrementMetric('usersRegistered');
    incrementMetric('requests');
    
    return NextResponse.json({
      message: 'User created (development mode - not persisted)',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
      },
      token,
    }, {
      headers: { 'X-Development-Mode': 'true' }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
