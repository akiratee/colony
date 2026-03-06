// Get Current User API for Colony
// GET /api/auth/me

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAuth } from '@/lib/jwt-auth';

export async function GET(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }
  
  const { userId } = authResult.payload;
  
  // Try Supabase first
  if (supabase) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, avatar, created_at')
      .eq('id', userId)
      .single();
    
    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      user: {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        createdAt: data.created_at,
      },
    });
  }
  
  // Fallback: Return user info from token
  return NextResponse.json({
    user: {
      id: authResult.payload.userId,
      name: authResult.payload.name,
      email: authResult.payload.email,
      avatar: authResult.payload.avatar,
    },
  });
}
