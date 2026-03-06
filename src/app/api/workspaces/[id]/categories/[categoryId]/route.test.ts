import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '@/app/api/workspaces/[id]/categories/[categoryId]/route';

// Mock dependencies
vi.mock('@/lib/workspace-store', () => ({
  getWorkspace: vi.fn(),
  canManageWorkspace: vi.fn(),
}));

vi.mock('@/lib/channel-category-store', () => ({
  getCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
}));

import { getWorkspace, canManageWorkspace } from '@/lib/workspace-store';
import { getCategory, updateCategory, deleteCategory } from '@/lib/channel-category-store';
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

// Helper to create valid category mock
const createMockCategory = (overrides = {}) => ({
  id: 'cat-1',
  name: 'Development',
  workspaceId: 'ws-1',
  order: 0,
  isCollapsed: false,
  ...overrides,
});

describe('GET /api/workspaces/[id]/categories/[categoryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 404 if workspace not found', async () => {
    vi.mocked(getWorkspace).mockReturnValue(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1');
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Workspace not found');
  });

  it('should return 404 if category not found', async () => {
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(getCategory).mockReturnValue(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1');
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Category not found');
  });

  it('should return category if found', async () => {
    const workspace = createMockWorkspace();
    const category = createMockCategory();
    
    vi.mocked(getWorkspace).mockReturnValue(workspace);
    vi.mocked(getCategory).mockReturnValue(category);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1');
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.category).toEqual(category);
  });

  it('should return 404 if category belongs to different workspace', async () => {
    const workspace = createMockWorkspace();
    const category = createMockCategory({ workspaceId: 'ws-2' });
    
    vi.mocked(getWorkspace).mockReturnValue(workspace);
    vi.mocked(getCategory).mockReturnValue(category);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1');
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Category not found');
  });
});

describe('PUT /api/workspaces/[id]/categories/[categoryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: false, error: 'Unauthorized' });
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await PUT(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if workspace not found', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await PUT(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Workspace not found');
  });

  it('should return 403 if insufficient permissions', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(false);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await PUT(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions');
  });

  it('should return 404 if category not found', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getCategory).mockReturnValue(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated' }),
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await PUT(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Category not found');
  });

  it('should return 400 if category name is empty', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getCategory).mockReturnValue(createMockCategory());
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: '' }),
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await PUT(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Category name cannot be empty');
  });

  it('should return 400 if category name is too long', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getCategory).mockReturnValue(createMockCategory());
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'a'.repeat(51) }),
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await PUT(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Category name too long (max 50 characters)');
  });

  it('should update category successfully', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getCategory).mockReturnValue(createMockCategory());
    vi.mocked(updateCategory).mockReturnValue(createMockCategory({ name: 'Updated', order: 1, isCollapsed: true }));
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Updated', order: 1, isCollapsed: true }),
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await PUT(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.category).toEqual(createMockCategory({ name: 'Updated', order: 1, isCollapsed: true }));
  });
});

describe('DELETE /api/workspaces/[id]/categories/[categoryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: false, error: 'Unauthorized' });
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 404 if workspace not found', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Workspace not found');
  });

  it('should return 403 if insufficient permissions', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(false);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(403);
    expect(data.error).toBe('Insufficient permissions');
  });

  it('should return 404 if category not found', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getCategory).mockReturnValue(undefined);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(404);
    expect(data.error).toBe('Category not found');
  });

  it('should delete category successfully', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getCategory).mockReturnValue(createMockCategory());
    vi.mocked(deleteCategory).mockReturnValue(true);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 400 if delete fails', async () => {
    vi.mocked(withAuth).mockReturnValue({ valid: true, payload: { userId: 'user-1', name: 'Test User' } });
    vi.mocked(getWorkspace).mockReturnValue(createMockWorkspace());
    vi.mocked(canManageWorkspace).mockReturnValue(true);
    vi.mocked(getCategory).mockReturnValue(createMockCategory());
    vi.mocked(deleteCategory).mockReturnValue(false);
    
    const request = new NextRequest('http://localhost:3000/api/workspaces/ws-1/categories/cat-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'ws-1', categoryId: 'cat-1' });
    
    const response = await DELETE(request, { params });
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Failed to delete category');
  });
});
