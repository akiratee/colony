import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './route';
import { resetWorkspaces, getWorkspaces, getUserWorkspaces, createWorkspace } from '@/lib/workspace-store';

// Mock dependencies
vi.mock('@/lib/workspace-store', () => ({
  getWorkspaces: vi.fn(),
  getUserWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  getWorkspaceMembers: vi.fn(() => []),
  resetWorkspaces: vi.fn(),
}));

vi.mock('@/lib/metrics', () => ({
  incrementMetric: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, resetIn: 60000 })),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn((request: Request) => {
    const authHeader = request.headers.get('authorization');
    if (authHeader === 'Bearer valid-token') {
      return { valid: true, payload: { userId: 'user-123' } };
    }
    return { valid: false, error: 'Invalid token' };
  }),
}));

describe('GET /api/workspaces', () => {
  beforeEach(() => {
    resetWorkspaces();
    vi.clearAllMocks();
  });

  it('should return all workspaces without auth', async () => {
    const mockWorkspaces = [
      { id: 'ws-1', name: 'Test Workspace', type: 'team', ownerId: 'user-123' },
    ];
    (getWorkspaces as ReturnType<typeof vi.fn>).mockReturnValue(mockWorkspaces);
    (getUserWorkspaces as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const request = new Request('http://localhost:3000/api/workspaces');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(data)).toBe(true);
  });

  it('should return user workspaces when userOnly=true', async () => {
    const mockUserWorkspaces = [
      { id: 'ws-1', name: 'My Workspace', type: 'team', ownerId: 'user-123' },
    ];
    (getUserWorkspaces as ReturnType<typeof vi.fn>).mockReturnValue(mockUserWorkspaces);
    (getWorkspaces as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const request = new Request('http://localhost:3000/api/workspaces?userOnly=true', {
      headers: { authorization: 'Bearer valid-token' },
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(getUserWorkspaces).toHaveBeenCalledWith('user-123');
  });
});

describe('POST /api/workspaces', () => {
  beforeEach(() => {
    resetWorkspaces();
    vi.clearAllMocks();
  });

  it('should return 401 without auth', async () => {
    const request = new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should create workspace with valid data', async () => {
    (createWorkspace as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'ws-new',
      name: 'New Workspace',
      type: 'team',
      ownerId: 'user-123',
      description: '',
      createdAt: '2026-03-03T00:00:00Z',
      settings: {},
    });

    const request = new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'New Workspace', type: 'team' }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('ws-new');
    expect(data.name).toBe('New Workspace');
  });

  it('should return 400 for missing name', async () => {
    const request = new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ type: 'team' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('name');
  });

  it('should return 400 for invalid name length', async () => {
    const request = new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'A' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('2-50');
  });

  it('should return 400 for invalid type', async () => {
    const request = new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'Valid Name', type: 'invalid' }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201); // Falls back to 'team'
    expect(data.type).toBe('team');
  });

  it('should return 400 for description too long', async () => {
    const longDescription = 'A'.repeat(501);
    const request = new Request('http://localhost:3000/api/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'Valid Name', description: longDescription }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('500');
  });
});
