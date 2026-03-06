import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt-auth';
import { generateId } from '@/lib/id';

// In-memory bookmarks store (for fallback mode)
// Map: userId -> bookmarks[]
interface Bookmark {
  id: string;
  userId: string;
  messageId: string;
  channelId: string;
  createdAt: string;
  messagePreview?: string;
}

let bookmarksStore: Map<string, Bookmark[]> = new Map();

// GET /api/messages/bookmarks - Get user's bookmarked messages
export async function GET(request: NextRequest) {
  const auth = withAuth(request);
  
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const userId = auth.payload!.userId;
  
  try {
    const userBookmarks = bookmarksStore.get(userId) || [];
    
    return NextResponse.json({
      bookmarks: userBookmarks,
      count: userBookmarks.length
    });
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve bookmarks' },
      { status: 500 }
    );
  }
}

// POST /api/messages/bookmarks - Bookmark a message
export async function POST(request: NextRequest) {
  const auth = withAuth(request);
  
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const userId = auth.payload!.userId;
  
  try {
    const body = await request.json();
    const { messageId, channelId, messagePreview } = body;
    
    // Validate required fields
    if (!messageId || !channelId) {
      return NextResponse.json(
        { error: 'messageId and channelId are required' },
        { status: 400 }
      );
    }

    // Check if already bookmarked
    const userBookmarks = bookmarksStore.get(userId) || [];
    const existingBookmark = userBookmarks.find(b => b.messageId === messageId);
    
    if (existingBookmark) {
      return NextResponse.json(
        { error: 'Message already bookmarked', bookmark: existingBookmark },
        { status: 409 }
      );
    }

    // Create new bookmark
    const bookmark: Bookmark = {
      id: generateId(),
      userId,
      messageId,
      channelId,
      messagePreview: messagePreview?.substring(0, 200), // Limit preview length
      createdAt: new Date().toISOString()
    };

    userBookmarks.push(bookmark);
    bookmarksStore.set(userId, userBookmarks);

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch (error) {
    console.error('Error creating bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to create bookmark' },
      { status: 500 }
    );
  }
}

// DELETE /api/messages/bookmarks?messageId=xxx - Remove a bookmark
export async function DELETE(request: NextRequest) {
  const auth = withAuth(request);
  
  if (!auth.valid) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const userId = auth.payload!.userId;
  
  try {
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    
    if (!messageId) {
      return NextResponse.json(
        { error: 'messageId query parameter required' },
        { status: 400 }
      );
    }

    const userBookmarks = bookmarksStore.get(userId) || [];
    const bookmarkIndex = userBookmarks.findIndex(b => b.messageId === messageId);
    
    if (bookmarkIndex === -1) {
      return NextResponse.json(
        { error: 'Bookmark not found' },
        { status: 404 }
      );
    }

    userBookmarks.splice(bookmarkIndex, 1);
    bookmarksStore.set(userId, userBookmarks);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bookmark:', error);
    return NextResponse.json(
      { error: 'Failed to delete bookmark' },
      { status: 500 }
    );
  }
}

// Reset function for testing
export function __resetForTesting(): void {
  bookmarksStore = new Map();
}
