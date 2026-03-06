import { NextRequest, NextResponse } from 'next/server';
import { saveDraft, getDraft, getAllDrafts, deleteDraft, clearAllDrafts, hasDraft, getDraftCount } from '@/lib/message-drafts';

// GET /api/messages/drafts - Get all drafts for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channelId = searchParams.get('channelId');
    const authorName = searchParams.get('authorName') || 'anonymous';

    if (channelId) {
      // Get draft for specific channel
      const draft = getDraft(channelId, authorName);
      return NextResponse.json({ draft });
    } else {
      // Get all drafts for user
      const drafts = getAllDrafts(authorName);
      const count = getDraftCount(authorName);
      return NextResponse.json({ drafts, count });
    }
  } catch (error) {
    console.error('Error getting drafts:', error);
    return NextResponse.json({ error: 'Failed to get drafts' }, { status: 500 });
  }
}

// POST /api/messages/drafts - Save a draft
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channelId, content, authorName = 'anonymous', parentId } = body;

    if (!channelId || !content) {
      return NextResponse.json(
        { error: 'channelId and content are required' },
        { status: 400 }
      );
    }

    const draft = saveDraft(channelId, content, authorName, parentId);
    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    console.error('Error saving draft:', error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

// DELETE /api/messages/drafts - Delete a draft or clear all drafts
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channelId = searchParams.get('channelId');
    const authorName = searchParams.get('authorName') || 'anonymous';
    const clearAll = searchParams.get('clearAll') === 'true';

    if (clearAll) {
      const count = clearAllDrafts(authorName);
      return NextResponse.json({ deleted: count });
    }

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required to delete a specific draft' },
        { status: 400 }
      );
    }

    const deleted = deleteDraft(channelId, authorName);
    return NextResponse.json({ deleted });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}

// HEAD /api/messages/drafts - Check if draft exists
export async function HEAD(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channelId = searchParams.get('channelId');
    const authorName = searchParams.get('authorName') || 'anonymous';

    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      );
    }

    const exists = hasDraft(channelId, authorName);
    return new NextResponse(null, {
      status: exists ? 200 : 404,
      headers: { 'X-Has-Draft': exists ? 'true' : 'false' }
    });
  } catch (error) {
    console.error('Error checking draft:', error);
    return NextResponse.json({ error: 'Failed to check draft' }, { status: 500 });
  }
}
