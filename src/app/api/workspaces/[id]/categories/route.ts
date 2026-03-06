// Channel Categories API for Workspace
// GET /api/workspaces/[id]/categories
// POST /api/workspaces/[id]/categories

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/lib/workspace-store';
import { getCategories, createCategory, deleteCategory, updateCategory } from '@/lib/channel-category-store';
import { canManageWorkspace } from '@/lib/workspace-store';
import { withAuth } from '@/lib/jwt-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    
    // Get workspace
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }
    
    // Get categories
    const categories = getCategories(workspaceId);
    
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    
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
    
    // Check permissions (owner or admin can manage categories)
    if (!canManageWorkspace(workspaceId, userId)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    const { name, order, isCollapsed } = body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }
    
    if (name.length > 50) {
      return NextResponse.json({ error: 'Category name too long (max 50 characters)' }, { status: 400 });
    }
    
    // Create category
    const category = createCategory(workspaceId, { name, order, isCollapsed });
    
    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating category:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    if (errorMessage.includes('already exists')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
