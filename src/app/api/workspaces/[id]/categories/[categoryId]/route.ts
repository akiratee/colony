// Individual Channel Category API
// GET /api/workspaces/[id]/categories/[categoryId]
// PUT /api/workspaces/[id]/categories/[categoryId]
// DELETE /api/workspaces/[id]/categories/[categoryId]

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/lib/workspace-store';
import { getCategory, updateCategory, deleteCategory } from '@/lib/channel-category-store';
import { canManageWorkspace } from '@/lib/workspace-store';
import { withAuth } from '@/lib/jwt-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id: workspaceId, categoryId } = await params;
    
    // Get workspace
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Get category
    const category = getCategory(categoryId);
    if (!category || category.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    return NextResponse.json({ category });
  } catch (error) {
    console.error('Error fetching category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id: workspaceId, categoryId } = await params;
    
    // Validate authentication
    const authResult = withAuth(request);
    if (!authResult.valid || !authResult.payload?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authResult.payload.userId;
    
    // Get workspace
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Check permissions
    if (!canManageWorkspace(workspaceId, userId)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get category
    const existingCategory = getCategory(categoryId);
    if (!existingCategory || existingCategory.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    // Parse body
    const body = await request.json();
    const { name, order, isCollapsed } = body;
    
    // Validate name if provided
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Category name cannot be empty' }, { status: 400 });
      }
      if (name.length > 50) {
        return NextResponse.json({ error: 'Category name too long (max 50 characters)' }, { status: 400 });
      }
    }
    
    // Update category
    const category = updateCategory(categoryId, { name, order, isCollapsed });
    
    if (!category) {
      return NextResponse.json({ error: 'Failed to update category' }, { status: 400 });
    }
    
    return NextResponse.json({ category });
  } catch (error: unknown) {
    console.error('Error updating category:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    if (errorMessage.includes('already exists')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  try {
    const { id: workspaceId, categoryId } = await params;
    
    // Validate authentication
    const authResult = withAuth(request);
    if (!authResult.valid || !authResult.payload?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = authResult.payload.userId;
    
    // Get workspace
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Check permissions
    if (!canManageWorkspace(workspaceId, userId)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get category
    const existingCategory = getCategory(categoryId);
    if (!existingCategory || existingCategory.workspaceId !== workspaceId) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }
    
    // Delete category
    const success = deleteCategory(categoryId);
    
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 400 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
