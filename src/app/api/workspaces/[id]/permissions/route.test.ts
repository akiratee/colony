import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';

// Mock workspace-store before importing route
vi.mock('@/lib/workspace-store', () => ({
  getUserPermissions: vi.fn(),
}));

// Mock jwt-auth
vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
}));

// Mock rate-limit
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

import * as workspaceStore from '@/lib/workspace-store';
import { withAuth } from '@/lib/jwt-auth';
import { rateLimit } from '@/lib/rate-limit';

const getUserPermissions = workspaceStore.getUserPermissions as ReturnType<typeof vi.fn>;

describe('GET /api/workspaces/[id]/permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValue({
      valid: false,
      error: 'Unauthorized',
    });

    vi.mocked(rateLimit).mockReturnValue({
      allowed: true,
      remaining: 29,
      resetIn: 60000,
    });

    const request = new NextRequest('http://localhost/api/workspaces/workspace-123/permissions');
    const params = Promise.resolve({ id: 'workspace-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return permissions for authenticated user', async () => {
    vi.mocked(withAuth).mockReturnValue({
      valid: true,
      payload: {
        userId: 'user-123',
        name: 'Test User',
      },
    });

    vi.mocked(rateLimit).mockReturnValue({
      allowed: true,
      remaining: 29,
      resetIn: 60000,
    });

    getUserPermissions.mockReturnValue({
      canView: true,
      canManage: true,
      canDeleteWorkspace: false,
      canUpdateWorkspace: true,
      canInviteUsers: true,
      canRemoveMembers: false,
      canUpdateMemberRoles: false,
      canCreateChannels: true,
      canDeleteChannels: false,
      canEditChannels: true,
      canManageBots: false,
      canManageCategories: true,
      role: 'admin',
    });

    const request = new NextRequest('http://localhost/api/workspaces/workspace-123/permissions');
    const params = Promise.resolve({ id: 'workspace-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.canView).toBe(true);
    expect(data.canManage).toBe(true);
    expect(data.role).toBe('admin');
    expect(getUserPermissions).toHaveBeenCalledWith('workspace-123', 'user-123');
  });

  it('should return 403 if user has no access to workspace', async () => {
    vi.mocked(withAuth).mockReturnValue({
      valid: true,
      payload: {
        userId: 'user-123',
        name: 'Test User',
      },
    });

    vi.mocked(rateLimit).mockReturnValue({
      allowed: true,
      remaining: 29,
      resetIn: 60000,
    });

    getUserPermissions.mockReturnValue({
      canView: false,
      canManage: false,
      canDeleteWorkspace: false,
      canUpdateWorkspace: false,
      canInviteUsers: false,
      canRemoveMembers: false,
      canUpdateMemberRoles: false,
      canCreateChannels: false,
      canDeleteChannels: false,
      canEditChannels: false,
      canManageBots: false,
      canManageCategories: false,
      role: null,
    });

    const request = new NextRequest('http://localhost/api/workspaces/workspace-123/permissions');
    const params = Promise.resolve({ id: 'workspace-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied to workspace');
  });

  it('should return member role for regular member', async () => {
    vi.mocked(withAuth).mockReturnValue({
      valid: true,
      payload: {
        userId: 'user-456',
        name: 'Member User',
      },
    });

    vi.mocked(rateLimit).mockReturnValue({
      allowed: true,
      remaining: 29,
      resetIn: 60000,
    });

    getUserPermissions.mockReturnValue({
      canView: true,
      canManage: false,
      canDeleteWorkspace: false,
      canUpdateWorkspace: false,
      canInviteUsers: false,
      canRemoveMembers: false,
      canUpdateMemberRoles: false,
      canCreateChannels: true,
      canDeleteChannels: false,
      canEditChannels: true,
      canManageBots: false,
      canManageCategories: false,
      role: 'member',
    });

    const request = new NextRequest('http://localhost/api/workspaces/workspace-123/permissions');
    const params = Promise.resolve({ id: 'workspace-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.role).toBe('member');
    expect(data.canManage).toBe(false);
    expect(data.canCreateChannels).toBe(true);
  });

  it('should return owner role with full permissions', async () => {
    vi.mocked(withAuth).mockReturnValue({
      valid: true,
      payload: {
        userId: 'user-owner',
        name: 'Owner User',
      },
    });

    vi.mocked(rateLimit).mockReturnValue({
      allowed: true,
      remaining: 29,
      resetIn: 60000,
    });

    getUserPermissions.mockReturnValue({
      canView: true,
      canManage: true,
      canDeleteWorkspace: true,
      canUpdateWorkspace: true,
      canInviteUsers: true,
      canRemoveMembers: true,
      canUpdateMemberRoles: true,
      canCreateChannels: true,
      canDeleteChannels: true,
      canEditChannels: true,
      canManageBots: true,
      canManageCategories: true,
      role: 'owner',
    });

    const request = new NextRequest('http://localhost/api/workspaces/workspace-123/permissions');
    const params = Promise.resolve({ id: 'workspace-123' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.role).toBe('owner');
    expect(data.canDeleteWorkspace).toBe(true);
    expect(data.canManage).toBe(true);
  });
});
