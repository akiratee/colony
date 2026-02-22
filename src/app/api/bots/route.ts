import { NextResponse } from 'next/server';

// In-memory bots store (will connect to Supabase later)
const bots = [
  { id: '1', name: 'CodeReview Bot', description: 'Reviews pull requests', avatar: '🤖', status: 'online' },
  { id: '2', name: 'Test Bot', description: 'Runs automated tests', avatar: '🧪', status: 'online' },
  { id: '3', name: 'Docs Bot', description: 'Answers questions about docs', avatar: '📚', status: 'offline' },
];

export async function GET() {
  return NextResponse.json(bots);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Bot name is required' }, { status: 400 });
    }
    
    const newBot = {
      id: Date.now().toString(),
      name: body.name,
      description: body.description || '',
      avatar: body.avatar || '🤖',
      status: 'offline',
      instructions: body.instructions || '',
      api_endpoint: body.api_endpoint || '',
      created_at: new Date().toISOString(),
    };
    
    bots.push(newBot);
    
    return NextResponse.json(newBot, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
