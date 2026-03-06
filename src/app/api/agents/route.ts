import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';
import { incrementMetric } from '@/lib/metrics';

const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// Define agent types based on OpenClaw config
interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  model: string;
  status: 'online' | 'offline';
  workspace?: string;
  capabilities?: string[];
}

// Fallback agents when OpenClaw is not available
const fallbackAgents: Agent[] = [
  {
    id: 'main',
    name: 'Rei',
    role: 'Product Manager',
    avatar: '✨',
    description: 'Primary agent for coordination, documentation, and communication',
    model: 'MiniMax M2.1',
    status: 'offline',
    capabilities: ['project management', 'coordination', 'communication']
  },
  {
    id: 'yilong',
    name: 'Yilong',
    role: 'Senior Engineer',
    avatar: '👨‍💻',
    description: 'Code reviews, architecture, debugging, and technical documentation',
    model: 'MiniMax M2.1',
    status: 'offline',
    capabilities: ['code review', 'architecture', 'debugging', 'API design']
  },
  {
    id: 'dan',
    name: 'Dan',
    role: 'QA Tester',
    avatar: '🧪',
    description: 'Test execution, bug verification, and quality checks',
    model: 'MiniMax M2.1',
    status: 'offline',
    capabilities: ['testing', 'bug verification', 'quality assurance']
  }
];

export async function GET() {
  // Track which agents have active sessions
  const activeAgents = new Set<string>();
  
  try {
    // Try to fetch actual session status from OpenClaw gateway
    if (OPENCLAW_GATEWAY_TOKEN) {
      // Fetch sessions to get actual agent status
      const sessionsResponse = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/sessions`, {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (sessionsResponse.ok) {
        const sessions = await sessionsResponse.json();
        // sessions is an array of { agentId, sessionKey, ... }
        if (Array.isArray(sessions)) {
          sessions.forEach((session: { agentId?: string }) => {
            if (session.agentId) {
              activeAgents.add(session.agentId);
            }
          });
        }
      }
      
      // Also fetch config to get agent definitions
      const configResponse = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/config`, {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (configResponse.ok) {
        // Gateway is running - use fallback agents with actual session status
        const agents = fallbackAgents.map(agent => ({
          ...agent,
          status: activeAgents.has(agent.id) ? 'online' as const : 'offline' as const
        }));
        return NextResponse.json(agents);
      }
    }
  } catch (e) {
    console.error('Failed to fetch from OpenClaw:', e);
  }
  
  // Return fallback agents (all offline if gateway unavailable)
  return NextResponse.json(fallbackAgents);
}

export async function POST(request: Request) {
  // Apply rate limiting (10 req/min for spawning)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`agent:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  
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
    const body = await request.json();
    const { action, agentId, task } = body;
    
    if (action === 'spawn' && agentId && task) {
      // Validate agentId - must be one of the known agents
      const validAgentIds = ['main', 'yilong', 'dan'];
      if (!validAgentIds.includes(agentId)) {
        return NextResponse.json({ 
          error: `Invalid agentId. Must be one of: ${validAgentIds.join(', ')}` 
        }, { status: 400 });
      }
      
      // Validate task - must be non-empty and reasonable length
      if (typeof task !== 'string' || task.trim().length === 0) {
        return NextResponse.json({ 
          error: 'task is required and must be a non-empty string' 
        }, { status: 400 });
      }
      
      if (task.length > 5000) {
        return NextResponse.json({ 
          error: 'task too long (max 5000 chars)' 
        }, { status: 400 });
      }
      
      // Spawn an agent via OpenClaw
      if (OPENCLAW_GATEWAY_TOKEN) {
        const response = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/sessions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            agentId,
            task,
            timeoutSeconds: 600
          }),
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const result = await response.json();
          // Track agent spawns in metrics
          incrementMetric('requests');
          return NextResponse.json({ 
            success: true, 
            sessionKey: result.sessionKey,
            message: `Spawned ${agentId} successfully` 
          });
        }
      }
      
      // Track failed spawn attempts
      incrementMetric('errors');
      return NextResponse.json({ 
        error: 'OpenClaw gateway not available' 
      }, { status: 503 });
    }
    
    if (action === 'despawn' && agentId) {
      // Validate agentId - must be one of the known agents
      const validAgentIds = ['main', 'yilong', 'dan'];
      if (!validAgentIds.includes(agentId)) {
        return NextResponse.json({ 
          error: `Invalid agentId. Must be one of: ${validAgentIds.join(', ')}` 
        }, { status: 400 });
      }
      
      // Despawn an agent via OpenClaw - find and delete the session
      if (OPENCLAW_GATEWAY_TOKEN) {
        try {
          // First get all sessions to find the one for this agent
          const sessionsResponse = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/sessions`, {
            headers: {
              'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`
            },
            signal: AbortSignal.timeout(5000)
          });
          
          if (sessionsResponse.ok) {
            const sessions = await sessionsResponse.json();
            if (Array.isArray(sessions)) {
              // Find the session for this agent
              const agentSession = sessions.find((s: { agentId?: string; sessionKey?: string }) => s.agentId === agentId);
              if (agentSession?.sessionKey) {
                // Delete the session
                const deleteResponse = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/sessions`, {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ sessionKey: agentSession.sessionKey }),
                  signal: AbortSignal.timeout(5000)
                });
                
                if (deleteResponse.ok) {
                  return NextResponse.json({ 
                    success: true, 
                    message: `Despawned ${agentId} successfully` 
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('Failed to despawn agent:', e);
        }
      }
      
      return NextResponse.json({ 
        error: 'Failed to despawn agent or gateway not available' 
      }, { status: 503 });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update agent configuration
export async function PATCH(request: Request) {
  // Apply rate limiting (10 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`agent-patch:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const body = await request.json();
    const { agentId, name, role, avatar, description, personality, model } = body;
    
    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }
    
    // Find and update agent in fallback list
    const agentIndex = fallbackAgents.findIndex(a => a.id === agentId);
    if (agentIndex !== -1) {
      // Update allowed fields
      if (name !== undefined) { fallbackAgents[agentIndex].name = name; }
      if (role !== undefined) { fallbackAgents[agentIndex].role = role; }
      if (avatar !== undefined) { fallbackAgents[agentIndex].avatar = avatar; }
      if (description !== undefined) {fallbackAgents[agentIndex].description = description;}
      if (personality !== undefined) {
        // Store personality in capabilities temporarily
        fallbackAgents[agentIndex].capabilities = fallbackAgents[agentIndex].capabilities || [];
        // This is a simplified approach - in production would store in separate config
      }
      if (model !== undefined) {fallbackAgents[agentIndex].model = model;}
      
      return NextResponse.json({ 
        success: true, 
        agent: fallbackAgents[agentIndex],
        message: `Updated agent ${agentId} configuration` 
      });
    }
    
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
