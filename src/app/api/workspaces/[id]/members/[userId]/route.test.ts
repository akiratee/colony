import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PATCH } from '@/app/api/workspaces/[id]/members/[userId]/route';

// Mock dependencies
vi.mock('@/lib/workspace-store', () => ({
  getWorkspace: vi.fn(),
  getWorkspaceMember: vi.fn(),
  updateWorkspaceMemberRole: vi.fn(),
  canManageWorkspace: vi.fn(),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ allowed: true, remaining: 9, resetIn: 0 })),
}));

vi.mock('@/lib/metrics', () => ({
  incrementMetric: vi.fn(),
}));

import { getWorkspace, getWorkspaceMember, updateWorkspaceMemberRole, canManageWorkspace } from '@/lib/workspace-store';
import { withAuth } from '@/lib/jwt-auth';

// Helper to create valid workspace mock
const createMockWorkspace = (overrides = {}) => ({
  id: 'ws-1',
  name: 'Test Workspace',
  type: 'team' as const,
  ownerId: 'user-1',
  createdAt: new Date(),
  ...overrides,
});

// Helper to create valid member mock
const createMockMember = (overrides = {}) => ({
  workspaceId: 'ws-1',
  userId: 'user-2',
  role: 'member' as const,
  joinedAt: new Date(),
  ...overrides,
});

describe('PATCH /api/workspaces/[id]/members/[userId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 429 if rate limited', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60000 });
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
  });

  it('should return 401 if not authenticated', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: false, error: 'Unauthorized' });
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if userId query param is missing', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('userId query parameter is required');
  });

  it('should return 403 if user cannot manage workspace', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(false);
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied. Only owners and admins can change member roles.');
  });

  it('should return 404 if workspace not found', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getWorkspace).mockReturnValue(undefined);
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Workspace not found');
  });

  it('should return 404 if member not found in workspace', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(getWorkspaceMember).mockReturnValue(undefined);
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Member not found in workspace');
  });

  it('should return 400 if trying to change owner role', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(getWorkspaceMember).mockReturnValue(createMockMember({ role: 'owner' }));
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Cannot change owner role');
  });

  it('should return 400 if role is missing', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(getWorkspaceMember).mockReturnValue(createMockMember());
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Valid role is required (admin, member, or guest)');
  });

  it('should return 400 if role is invalid', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(getWorkspaceMember).mockReturnValue(createMockMember());
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'invalid' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Valid role is required (admin, member, or guest)');
  });

  it('should update member role successfully', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(getWorkspaceMember).mockReturnValue(createMockMember());
    vi.mocked(updateWorkspaceMemberRole).mockReturnValue(createMockMember({ role: 'admin' }));
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.userId).toBe('user-2');
    expect(data.role).toBe('admin');
  });

  it('should return 400 if update fails', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: true, remaining: 9, resetIn: 0 });
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(getWorkspaceMember).mockReturnValue(createMockMember());
    vi.mocked(updateWorkspaceMemberRole).mockReturnValue(null);
    
    const url = new URL('http://localhost:3000/api/workspaces/ws-1/members/user-2?userId=user-2');
    const request = new NextRequest(url, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'admin' }),
    });
    const params = Promise.resolve({ id: 'ws-1' });
    
    const response = await PATCH(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Failed to update member role');
  });
});
