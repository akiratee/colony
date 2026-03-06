// Tests for Messages Polls API
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST, PATCH } from './route';
import { createPoll, getPoll, getAllPolls, voteOnPoll, closePoll } from '@/lib/message-polls';

// Mock dependencies
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 10, resetIn: 60000 }))
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((request) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader === 'Bearer valid-token') {
      return { valid: true, payload: { userId: 'user-123', name: 'Test User' } };
    }
    if (authHeader === 'Bearer other-user-token') {
      return { valid: true, payload: { userId: 'user-456', name: 'Other User' } };
    }
    return { valid: false, error: 'Invalid token' };
  })
}));

vi.mock('@/lib/message-polls', () => {
  // Track which message IDs have polls
  const existingPolls = new Set(['msg-123']);
  
  return {
    createPoll: vi.fn((messageId, question, options, createdBy, isMultiVote) => ({
      id: `poll-${messageId}`,
      messageId,
      question,
      options: options.map((opt: string, idx: number) => ({
        id: `opt-${idx}`,
        text: opt,
        votes: []
      })),
      createdBy,
      isMultiVote: isMultiVote || false,
      isClosed: false,
      createdAt: new Date().toISOString()
    })),
    getPoll: vi.fn((pollId) => {
      if (pollId === 'poll-123') {
        return {
          id: 'poll-123',
          messageId: 'msg-123',
          question: 'Test poll?',
          options: [{ id: 'opt-0', text: 'Yes', votes: ['user-1'] }],
          createdBy: 'Test User',
          isMultiVote: false,
          isClosed: false,
          createdAt: new Date().toISOString()
        };
      }
      return null;
    }),
    getPollByMessageId: vi.fn((messageId) => {
      if (existingPolls.has(messageId)) {
        return { id: `poll-${messageId}`, messageId, question: 'Test poll?' };
      }
      return null;
    }),
    getAllPolls: vi.fn(() => [
      { id: 'poll-123', messageId: 'msg-123', question: 'Test poll?' }
    ]),
    voteOnPoll: vi.fn((pollId, optionId, userName) => ({
      id: pollId,
      messageId: 'msg-123',
      question: 'Test poll?',
      options: [{ id: optionId, text: 'Yes', votes: [userName] }],
      isClosed: false
    })),
    closePoll: vi.fn((pollId) => ({
      id: pollId,
      messageId: 'msg-123',
      question: 'Test poll?',
      isClosed: true
    }))
  };
});

// Helper to create request
function createRequest(url: string, options: RequestInit = {}) {
  return new Request(url, {
    ...options,
    headers: new Headers(options.headers || {})
  });
}

describe('GET /api/messages/polls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all polls when no parameters provided', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.polls).toBeDefined();
    expect(Array.isArray(data.polls)).toBe(true);
  });

  it('should return poll by pollId', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls?pollId=poll-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.poll).toBeDefined();
    expect(data.poll.id).toBe('poll-123');
  });

  it('should return 404 for non-existent pollId', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls?pollId=non-existent');
    const response = await GET(request);

    expect(response.status).toBe(404);
  });

  it('should return poll by messageId', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls?messageId=msg-123');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.poll).toBeDefined();
  });

  it('should return 404 for non-existent messageId', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls?messageId=non-existent');
    const response = await GET(request);

    expect(response.status).toBe(404);
  });
});

describe('POST /api/messages/polls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without auth', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: 'msg-123', question: 'Test?', options: ['Yes', 'No'] })
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should create poll with valid data', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({
        messageId: 'msg-new-poll',
        question: 'Test poll?',
        options: ['Yes', 'No']
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.poll).toBeDefined();
    expect(data.poll.question).toBe('Test poll?');
  });

  it('should reject poll with missing messageId', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ question: 'Test?', options: ['Yes', 'No'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('messageId');
  });

  it('should reject poll with missing question', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ messageId: 'msg-123', options: ['Yes', 'No'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('question');
  });

  it('should reject poll with question too long', async () => {
    const longQuestion = 'a'.repeat(201);
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ messageId: 'msg-123', question: longQuestion, options: ['Yes', 'No'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('too long');
  });

  it('should reject poll with less than 2 options', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ messageId: 'msg-123', question: 'Test?', options: ['Yes'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('At least 2 options');
  });

  it('should reject poll with more than 10 options', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({
        messageId: 'msg-123',
        question: 'Test?',
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Maximum 10');
  });

  it('should reject duplicate poll for same message', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ messageId: 'msg-123', question: 'Test?', options: ['Yes', 'No'] })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('already exists');
  });

  it('should accept multi-vote option', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({
        messageId: 'msg-new',
        question: 'Test?',
        options: ['Yes', 'No'],
        isMultiVote: true
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.poll.isMultiVote).toBe(true);
  });
});

describe('PATCH /api/messages/polls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without auth', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollId: 'poll-123', action: 'vote', optionId: 'opt-0' })
    });

    const response = await PATCH(request);
    expect(response.status).toBe(401);
  });

  it('should vote on poll', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ pollId: 'poll-123', action: 'vote', optionId: 'opt-0' })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.poll).toBeDefined();
  });

  it('should return 404 for voting on non-existent poll', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ pollId: 'non-existent', action: 'vote', optionId: 'opt-0' })
    });

    const response = await PATCH(request);

    expect(response.status).toBe(404);
  });

  it('should require optionId for voting', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ pollId: 'poll-123', action: 'vote' })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('optionId');
  });

  it('should close poll by creator', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ pollId: 'poll-123', action: 'close' })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.poll.isClosed).toBe(true);
  });

  it('should reject closing poll by non-creator', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer other-user-token'
      },
      body: JSON.stringify({ pollId: 'poll-123', action: 'close' })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('creator');
  });

  it('should reject invalid action', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ pollId: 'poll-123', action: 'invalid' })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid action');
  });

  it('should require pollId', async () => {
    const request = createRequest('http://localhost:3000/api/messages/polls', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer valid-token'
      },
      body: JSON.stringify({ action: 'vote' })
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('pollId');
  });
});
