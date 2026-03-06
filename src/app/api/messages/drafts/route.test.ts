import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { saveDraft, getDraft, getAllDrafts, deleteDraft, clearAllDrafts, hasDraft, getDraftCount } from '@/lib/message-drafts';
import { GET, POST, DELETE, HEAD } from './route';

describe('GET /api/messages/drafts', () => {
  beforeEach(() => {
    clearAllDrafts('testuser');
  });

  it('should return all drafts for a user when no channelId provided', async () => {
    saveDraft('channel-1', 'Draft 1', 'testuser');
    saveDraft('channel-2', 'Draft 2', 'testuser');
    saveDraft('channel-3', 'Draft for other user', 'otheruser');

    const url = new URL('http://localhost/api/messages/drafts?authorName=testuser');
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.drafts).toHaveLength(2);
    expect(data.count).toBe(2);
  });

  it('should return specific draft when channelId provided', async () => {
    saveDraft('channel-123', 'My draft content', 'testuser');

    const url = new URL('http://localhost/api/messages/drafts?channelId=channel-123&authorName=testuser');
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.draft).not.toBeNull();
    expect(data.draft.content).toBe('My draft content');
  });

  it('should return null draft for non-existent channel', async () => {
    const url = new URL('http://localhost/api/messages/drafts?channelId=non-existent&authorName=testuser');
    const request = new NextRequest(url);
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.draft).toBeNull();
  });
});

describe('POST /api/messages/drafts', () => {
  beforeEach(() => {
    clearAllDrafts('testuser');
  });

  it('should save a new draft', async () => {
    const url = new URL('http://localhost/api/messages/drafts');
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        channelId: 'channel-1',
        content: 'Test draft content',
        authorName: 'testuser',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.draft).not.toBeNull();
    expect(data.draft.channelId).toBe('channel-1');
    expect(data.draft.content).toBe('Test draft content');
  });

  it('should save a draft with parentId for threaded replies', async () => {
    const url = new URL('http://localhost/api/messages/drafts');
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        channelId: 'channel-1',
        content: 'Reply draft',
        authorName: 'testuser',
        parentId: 'message-123',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.draft.parentId).toBe('message-123');
  });

  it('should return 400 when channelId is missing', async () => {
    const url = new URL('http://localhost/api/messages/drafts');
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        content: 'Test content',
        authorName: 'testuser',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 when content is missing', async () => {
    const url = new URL('http://localhost/api/messages/drafts');
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify({
        channelId: 'channel-1',
        authorName: 'testuser',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/messages/drafts', () => {
  beforeEach(() => {
    clearAllDrafts('testuser');
  });

  it('should delete a specific draft', async () => {
    saveDraft('channel-1', 'Draft to delete', 'testuser');

    const url = new URL('http://localhost/api/messages/drafts?channelId=channel-1&authorName=testuser');
    const request = new NextRequest(url, { method: 'DELETE' });
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe(true);
    expect(getDraft('channel-1', 'testuser')).toBeNull();
  });

  it('should clear all drafts for a user', async () => {
    saveDraft('channel-1', 'Draft 1', 'testuser');
    saveDraft('channel-2', 'Draft 2', 'testuser');

    const url = new URL('http://localhost/api/messages/drafts?clearAll=true&authorName=testuser');
    const request = new NextRequest(url, { method: 'DELETE' });
    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deleted).toBe(2);
    expect(getAllDrafts('testuser')).toHaveLength(0);
  });

  it('should return 400 when deleting specific draft without channelId', async () => {
    const url = new URL('http://localhost/api/messages/drafts?authorName=testuser');
    const request = new NextRequest(url, { method: 'DELETE' });
    const response = await DELETE(request);

    expect(response.status).toBe(400);
  });
});

describe('HEAD /api/messages/drafts', () => {
  beforeEach(() => {
    clearAllDrafts('testuser');
  });

  it('should return 200 when draft exists', async () => {
    saveDraft('channel-1', 'Existing draft', 'testuser');

    const url = new URL('http://localhost/api/messages/drafts?channelId=channel-1&authorName=testuser');
    const request = new NextRequest(url, { method: 'HEAD' });
    const response = await HEAD(request);

    expect(response.status).toBe(200);
  });

  it('should return 404 when draft does not exist', async () => {
    const url = new URL('http://localhost/api/messages/drafts?channelId=non-existent&authorName=testuser');
    const request = new NextRequest(url, { method: 'HEAD' });
    const response = await HEAD(request);

    expect(response.status).toBe(404);
  });

  it('should return 400 when channelId is missing', async () => {
    const url = new URL('http://localhost/api/messages/drafts?authorName=testuser');
    const request = new NextRequest(url, { method: 'HEAD' });
    const response = await HEAD(request);

    expect(response.status).toBe(400);
  });
});
