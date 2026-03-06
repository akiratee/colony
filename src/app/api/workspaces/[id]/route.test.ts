import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, PUT, DELETE } from './route';
import { resetWorkspaces, getWorkspace, updateWorkspace, deleteWorkspace, getWorkspaceMembers, isWorkspaceMember, canManageWorkspace } from '@/lib/workspace-store';

// Mock dependencies
vi.mock('@/lib/workspace-store', () => ({
  getWorkspace: vi.fn(),
  updateWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
  getWorkspaceMembers: vi.fn(),
  isWorkspaceMember: vi.fn(),
  canManageWorkspace: vi.fn(),
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
    if (authHeader === 'Bearer owner-token') {
      return { valid: true, payload: { userId: 'owner-456' } };
    }
    return { valid: false, error: 'Invalid token' };
  }),
}));

describe('GET /api/workspaces/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 for non-existent workspace', async () => {
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const request = new Request('http://localhost:3000/api/workspaces/ws-999');
    const response = await GET(request, { params: Promise.resolve({ id: 'ws-999' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain('not found');
  });

  it('should return workspace with members', async () => {
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'ws-1',
      name: 'Test Workspace',
      type: 'team',
      ownerId: 'user-123',
    });
    (getWorkspaceMembers as ReturnType<typeof vi.fn>).mockReturnValue([
      { userId: 'user-123', role: 'owner', joinedAt: '2026-03-01T00:00:00Z' },
    ]);
    (isWorkspaceMember as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      headers: { authorization: 'Bearer valid-token' },
    });
    const response = await GET(request, { params: Promise.resolve({ id: 'ws-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Test Workspace');
    expect(data.members).toHaveLength(1);
  });
});

describe('PUT /api/workspaces/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without auth', async () => {
    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'ws-1' }) });

    expect(response.status).toBe(401);
  });

  it('should return 403 for non-manager', async () => {
    (canManageWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'New Name' }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'ws-1' }) });

    expect(response.status).toBe(403);
  });

  it('should return 404 for non-existent workspace', async () => {
    (canManageWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const request = new Request('http://localhost:3000/api/workspaces/ws-999', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'New Name' }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'ws-999' }) });

    expect(response.status).toBe(404);
  });

  it('should update workspace with valid data', async () => {
    (canManageWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'ws-1',
      name: 'Test',
      type: 'team',
      ownerId: 'user-123',
    });
    (updateWorkspace as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'ws-1',
      name: 'Updated Name',
      type: 'team',
      ownerId: 'user-123',
      description: 'Updated',
      createdAt: '2026-03-01T00:00:00Z',
      settings: {},
    });

    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'ws-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.name).toBe('Updated Name');
  });

  it('should return 400 for invalid name', async () => {
    (canManageWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'ws-1',
      name: 'Test',
      type: 'team',
      ownerId: 'user-123',
    });

    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        authorization: 'Bearer valid-token',
      },
      body: JSON.stringify({ name: 'A' }),
    });
    const response = await PUT(request, { params: Promise.resolve({ id: 'ws-1' }) });

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/workspaces/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 without auth', async () => {
    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'ws-1' }) });

    expect(response.status).toBe(401);
  });

  it('should return 404 for non-existent workspace', async () => {
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const request = new Request('http://localhost:3000/api/workspaces/ws-999', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'ws-999' }) });

    expect(response.status).toBe(404);
  });

  it('should return 403 for non-owner', async () => {
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'ws-1',
      name: 'Test',
      ownerId: 'owner-456',
    });

    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      method: 'DELETE',
      headers: { authorization: 'Bearer valid-token' },
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'ws-1' }) });

    expect(response.status).toBe(403);
  });

  it('should delete workspace as owner', async () => {
    (getWorkspace as ReturnType<typeof vi.fn>).mockReturnValue({
      id: 'ws-1',
      name: 'Test',
      ownerId: 'owner-456',
    });
    (deleteWorkspace as ReturnType<typeof vi.fn>).mockReturnValue(true);

    const request = new Request('http://localhost:3000/api/workspaces/ws-1', {
      method: 'DELETE',
      headers: { authorization: 'Bearer owner-token' },
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'ws-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
