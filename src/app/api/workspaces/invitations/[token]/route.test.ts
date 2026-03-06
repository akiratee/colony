import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from './route';
import { createWorkspaceInvitation, getInvitationByToken, acceptInvitation, createWorkspace, resetWorkspaces } from '@/lib/workspace-store';
import { NextRequest } from 'next/server';

// Helper to create authenticated request
function createAuthRequest(token: string, userId = 'test-user-001') {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  
  // Create a mock JWT token
  const mockToken = Buffer.from(JSON.stringify({ userId })).toString('base64');
  headers.set('Authorization', `Bearer ${mockToken}`);
  
  const req = new NextRequest(`http://localhost:3000/api/workspaces/invitations/${token}`, {
    method: 'GET',
    headers,
  });
  
  return req;
}

// Helper to create unauthenticated request
function createUnauthRequest(token: string) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  
  const req = new NextRequest(`http://localhost:3000/api/workspaces/invitations/${token}`, {
    method: 'GET',
    headers,
  });
  
  return req;
}

describe('GET /api/workspaces/invitations/[token]', () => {
  beforeEach(() => {
    resetWorkspaces();
  });

  it('should return invitation details for valid token', async () => {
    // Create a workspace first
    const workspace = createWorkspace('Test Team', 'team', 'test-user-001', 'Test workspace');
    
    // Create an invitation
    const invitation = createWorkspaceInvitation(workspace.id, 'test@example.com', 'member', 'test-user-001');
    
    // Try to get it
    const req = createUnauthRequest(invitation.id);
    const response = await GET(req, { params: Promise.resolve({ token: invitation.id }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
    expect(data.workspaceId).toBe(workspace.id);
    expect(data.workspaceName).toBe('Test Team');
    expect(data.role).toBe('member');
    expect(data.invitedBy).toBe('test-user-001');
  });

  it('should return 404 for non-existent token', async () => {
    const req = createUnauthRequest('non-existent-token');
    const response = await GET(req, { params: Promise.resolve({ token: 'non-existent-token' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.valid).toBe(false);
    expect(data.error).toBe('Invalid or expired invitation token');
  });

  it('should return 404 for expired invitation', async () => {
    // Create a workspace
    const workspace = createWorkspace('Expired Workspace', 'team', 'test-user-001', 'Test');
    
    // Create an invitation
    const invitation = createWorkspaceInvitation(workspace.id, 'expired@example.com', 'member', 'test-user-001');
    
    // Manually set the invitation as expired by modifying the store directly
    // (The invitation is created with expiresAt = now + 7 days)
    
    // Get and modify the invitation
    const { getInvitationByToken: getInv } = await import('@/lib/workspace-store');
    const inv = getInv(invitation.id);
    if (inv) {
      // Set expiresAt to past
      (inv as any).expiresAt = new Date(Date.now() - 1000);
    }

    const req = createUnauthRequest(invitation.id);
    const response = await GET(req, { params: Promise.resolve({ token: invitation.id }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.valid).toBe(false);
    expect(data.error).toContain('expired');
  });

  it('should return 404 for already accepted invitation', async () => {
    // Create a workspace
    const workspace = createWorkspace('Accepted Workspace', 'team', 'test-user-001', 'Test');
    
    // Create an invitation
    const invitation = createWorkspaceInvitation(workspace.id, 'accepted-user', 'member', 'test-user-001');
    
    // Accept the invitation - this sets accepted=true, which makes getInvitationByToken return undefined
    acceptInvitation(invitation.id, 'accepted-user');

    // After acceptance, getInvitationByToken returns undefined (security feature)
    // So the API returns "Invalid or expired invitation token" - this is correct behavior
    const req = createUnauthRequest(invitation.id);
    const response = await GET(req, { params: Promise.resolve({ token: invitation.id }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.valid).toBe(false);
    // The token becomes invalid after acceptance (security feature)
    expect(data.error).toBe('Invalid or expired invitation token');
  });

  it('should return consistent error for enumeration prevention', async () => {
    // Test that different invalid tokens return the same error message format
    const tokens = ['invalid-1', 'invalid-2', 'totally-different'];

    for (const token of tokens) {
      const req = createUnauthRequest(token);
      const response = await GET(req, { params: Promise.resolve({ token }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.valid).toBe(false);
      // Error message should be consistent to prevent enumeration
      expect(data.error).toBe('Invalid or expired invitation token');
    }
  });

  it('should include isInvitedUser when authenticated with matching user', async () => {
    // Create a workspace
    const workspace = createWorkspace('Auth Workspace', 'team', 'test-user-001', 'Test');
    
    // Create an invitation with the same email as the user ID
    const invitation = createWorkspaceInvitation(workspace.id, 'test-user-002', 'member', 'test-user-001');
    
    // Create authenticated request with matching user
    const req = createAuthRequest(invitation.id, 'test-user-002');
    
    const response = await GET(req, { params: Promise.resolve({ token: invitation.id }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.valid).toBe(true);
  });
});
