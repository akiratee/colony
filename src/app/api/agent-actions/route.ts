import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { withAuth } from '@/lib/jwt-auth';

// In-memory stores for agent actions
interface Event {
  id: string;
  type: 'event';
  title: string;
  description?: string;
  startTime: string;
  endTime?: string;
  location?: string;
  channelId: string;
  createdBy: string;
  createdAt: string;
}

interface Task {
  id: string;
  type: 'task';
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  channelId: string;
  createdBy: string;
  createdAt: string;
}

interface Poll {
  id: string;
  type: 'poll';
  question: string;
  options: { id: string; text: string; votes: number }[];
  multipleChoice: boolean;
  channelId: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
}

type AgentAction = Event | Task | Poll;

// Store for agent actions
const agentActionsStore = new Map<string, AgentAction>();

// Generate unique ID
function generateId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get client IP for rate limiting
function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown';
}

// GET /api/agent-actions - Get all actions, optionally filtered
export async function GET(request: Request) {
  // Apply rate limiting (30 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`agent-actions:${clientIp}`, { windowMs: 60000, maxRequests: 30 });
  
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: Math.ceil(rateLimitResult.resetIn / 1000) },
      { status: 429, headers: { 'Retry-After': Math.ceil(rateLimitResult.resetIn / 1000).toString() } }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId');
  const type = searchParams.get('type'); // 'event', 'task', 'poll'
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  
  // Get all actions
  let actions = Array.from(agentActionsStore.values());
  
  // Filter by channel
  if (channelId) {
    actions = actions.filter(a => a.channelId === channelId);
  }
  
  // Filter by type
  if (type) {
    actions = actions.filter(a => a.type === type);
  }
  
  // Sort by createdAt descending
  actions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Paginate
  const total = actions.length;
  const paginatedActions = actions.slice(offset, offset + limit);
  
  return NextResponse.json({
    actions: paginatedActions,
    total,
    limit,
    offset,
  });
}

// POST /api/agent-actions - Create a new action (event, task, or poll)
export async function POST(request: Request) {
  // Apply rate limiting (10 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`agent-actions-post:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  
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
  
  const userName = authResult.payload.name || 'Unknown';
  
  try {
    const body = await request.json();
    const { actionType, title, description, channelId, ...actionData } = body;
    
    // Validate required fields
    if (!actionType || !['event', 'task', 'poll'].includes(actionType)) {
      return NextResponse.json({ error: 'actionType must be: event, task, or poll' }, { status: 400 });
    }
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    
    if (!channelId || typeof channelId !== 'string') {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    }
    
    const id = generateId();
    const createdAt = new Date().toISOString();
    
    let action: AgentAction;
    
    switch (actionType) {
      case 'event': {
        const { startTime, endTime, location } = actionData;
        
        if (!startTime) {
          return NextResponse.json({ error: 'startTime is required for events' }, { status: 400 });
        }
        
        action = {
          id,
          type: 'event',
          title: title.trim(),
          description: description?.trim(),
          startTime,
          endTime,
          location,
          channelId,
          createdBy: userName,
          createdAt,
        };
        break;
      }
      
      case 'task': {
        const { assignee, dueDate, priority } = actionData;
        
        action = {
          id,
          type: 'task',
          title: title.trim(),
          description: description?.trim(),
          assignee,
          dueDate,
          priority: priority || 'medium',
          status: 'pending',
          channelId,
          createdBy: userName,
          createdAt,
        };
        break;
      }
      
      case 'poll': {
        const { question, options, multipleChoice, expiresAt } = actionData;
        
        if (!question) {
          return NextResponse.json({ error: 'question is required for polls' }, { status: 400 });
        }
        
        if (!options || !Array.isArray(options) || options.length < 2) {
          return NextResponse.json({ error: 'At least 2 options are required for polls' }, { status: 400 });
        }
        
        action = {
          id,
          type: 'poll',
          question: question.trim(),
          options: options.map((opt: string, idx: number) => ({
            id: `option-${idx}`,
            text: opt.trim(),
            votes: 0,
          })),
          multipleChoice: multipleChoice || false,
          channelId,
          createdBy: userName,
          createdAt,
          expiresAt,
        };
        break;
      }
      
      default:
        return NextResponse.json({ error: 'Invalid actionType' }, { status: 400 });
    }
    
    // Store the action
    agentActionsStore.set(id, action);
    
    return NextResponse.json(action, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// PATCH /api/agent-actions - Update an action (e.g., vote on poll, update task status)
export async function PATCH(request: Request) {
  // Apply rate limiting (20 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`agent-actions-patch:${clientIp}`, { windowMs: 60000, maxRequests: 20 });
  
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
  
  try {
    const body = await request.json();
    const { actionId, action, data } = body;
    
    if (!actionId) {
      return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
    }
    
    const existingAction = agentActionsStore.get(actionId);
    if (!existingAction) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }
    
    // Handle different action types
    if (action === 'vote' && existingAction.type === 'poll') {
      const { optionId } = data;
      
      // Find the option
      const option = existingAction.options.find(o => o.id === optionId);
      if (!option) {
        return NextResponse.json({ error: 'Option not found' }, { status: 404 });
      }
      
      // If multiple choice is false, remove previous votes from this user
      // For simplicity, we track votes by option ID only (not per user in this implementation)
      option.votes++;
      
      agentActionsStore.set(actionId, existingAction);
      return NextResponse.json(existingAction);
    }
    
    if (action === 'updateStatus' && existingAction.type === 'task') {
      const { status } = data;
      
      if (!['pending', 'in_progress', 'completed'].includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      
      existingAction.status = status;
      agentActionsStore.set(actionId, existingAction);
      return NextResponse.json(existingAction);
    }
    
    if (action === 'updateTask' && existingAction.type === 'task') {
      const { title, description, assignee, dueDate, priority } = data;
      
      if (title !== undefined) { existingAction.title = title; }
      if (description !== undefined) { existingAction.description = description; }
      if (assignee !== undefined) { existingAction.assignee = assignee; }
      if (dueDate !== undefined) { existingAction.dueDate = dueDate; }
      if (priority !== undefined) { existingAction.priority = priority; }
      
      agentActionsStore.set(actionId, existingAction);
      return NextResponse.json(existingAction);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// DELETE /api/agent-actions - Delete an action
export async function DELETE(request: Request) {
  // Apply rate limiting (10 req/min)
  const clientIp = getClientIp(request);
  const rateLimitResult = rateLimit(`agent-actions-delete:${clientIp}`, { windowMs: 60000, maxRequests: 10 });
  
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
  
  const { searchParams } = new URL(request.url);
  const actionId = searchParams.get('actionId');
  
  if (!actionId) {
    return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
  }
  
  if (!agentActionsStore.has(actionId)) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 });
  }
  
  agentActionsStore.delete(actionId);
  
  return NextResponse.json({ success: true, message: 'Action deleted' });
}
