import { NextResponse } from 'next/server';

// Mock data for now - will connect to Supabase later
const channels = [
  { id: '1', name: 'general', description: 'General discussion' },
  { id: '2', name: 'engineering', description: 'Engineering team chat' },
  { id: '3', name: 'design', description: 'Design discussions' },
  { id: '4', name: 'bots', description: 'AI agent playground' },
];

export async function GET() {
  return NextResponse.json(channels);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
    }
    
    const newChannel = {
      id: Date.now().toString(),
      name: body.name.toLowerCase().replace(/\s+/g, '-'),
      description: body.description || '',
      created_at: new Date().toISOString(),
    };
    
    channels.push(newChannel);
    
    return NextResponse.json(newChannel, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
