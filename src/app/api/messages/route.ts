import { NextResponse } from 'next/server';

// Input validation helper
function validateMessage(body: any): { valid: boolean; error?: string } {
  if (!body.channelId || typeof body.channelId !== 'string') {
    return { valid: false, error: 'channelId is required' };
  }
  if (!body.content || typeof body.content !== 'string') {
    return { valid: false, error: 'content is required' };
  }
  if (body.content.length > 10000) {
    return { valid: false, error: 'content too long (max 10000 chars)' };
  }
  return { valid: true };
}

// Sanitize HTML to prevent XSS
function sanitizeContent(content: string): string {
  return content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// In-memory message store (will connect to Supabase later)
const messages: any[] = [
  {
    id: '1',
    channelId: '1',
    content: 'Hey team! Just pushed the new authentication flow. Can someone review?',
    author: { name: 'Vincent', avatar: '👨‍💻' },
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    channelId: '1',
    content: "Sure thing! I'll take a look.",
    author: { name: 'Yilong', avatar: '👨‍🔧' },
    timestamp: new Date(Date.now() - 3000000).toISOString(),
  },
  {
    id: '3',
    channelId: '1',
    content: 'I can run the test suite while Yilong reviews.',
    author: { name: 'Test Bot', avatar: '🧪', isBot: true },
    timestamp: new Date(Date.now() - 2900000).toISOString(),
  },
  {
    id: '4',
    channelId: '1',
    content: "Great! Test Bot found 2 failing tests in auth.spec.ts. Looks like a missing mock.",
    author: { name: 'Test Bot', avatar: '🧪', isBot: true },
    timestamp: new Date(Date.now() - 1800000).toISOString(),
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  
  const channelMessages = channelId 
    ? messages.filter(m => m.channelId === channelId)
    : messages;
  
  return NextResponse.json(channelMessages);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate input
    const validation = validateMessage(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    
    const newMessage = {
      id: Date.now().toString(),
      channelId: body.channelId,
      content: sanitizeContent(body.content),
      author: body.author || { name: 'Anonymous', avatar: '👤' },
      timestamp: new Date().toISOString(),
    };
    
    messages.push(newMessage);
    
    return NextResponse.json(newMessage, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}
