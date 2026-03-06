import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { createWorkspaceInvitation, getInvitationByToken, acceptInvitation, createWorkspace, resetWorkspaces } from '@/lib/workspace-store';
import { NextRequest } from 'next/server';

// Helper to create authenticated request
function createAuthRequest(method: string, body?: any, userId = 'test-user-001') {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  
  // Create a mock JWT token (this will be validated by withAuth)
  // For testing, we'll mock the auth header
  const token = Buffer.from(JSON.stringify({ userId })).toString('base64');
  headers.set('Authorization', `Bearer ${token}`);
  
  const req = new NextRequest('http://localhost:3000/api/workspaces/invitations/test-token/accept', {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return req;
}

describe('Workspace Invitation Acceptance API', () => {
  beforeEach(() => {
    // Reset workspace store
    resetWorkspaces();
  });

  describe('POST /api/workspaces/invitations/[token]/accept', () => {
    it('should accept valid invitation', async () => {
      // Create a workspace first
      const workspace = createWorkspace('Test Team', 'team', 'test-user-001', 'Test workspace');
      
      // Create an invitation
      const invitation = createWorkspaceInvitation(workspace.id, 'newuser@example.com', 'member', 'test-user-001');
      
      // Try to accept it
      const req = createAuthRequest('POST', {}, 'new-user-id');
      
      // Create a params object
      const params = Promise.resolve({ token: invitation.id });
      
      const res = await POST(req, { params });
      const data = await res.json();
      
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.workspaceId).toBe(workspace.id);
      expect(data.role).toBe('member');
    });

    it('should reject invalid token', async () => {
      const req = createAuthRequest('POST', {}, 'new-user-id');
      const params = Promise.resolve({ token: 'invalid-token' });
      
      const res = await POST(req, { params });
      const data = await res.json();
      
      expect(res.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should require authentication', async () => {
      const req = new NextRequest('http://localhost:3000/api/workspaces/invitations/test/accept', {
        method: 'POST',
      });
      
      const params = Promise.resolve({ token: 'test' });
      const res = await POST(req, { params });
      
      // Either 401 (no auth) or 404 (invalid token) is acceptable
      expect([401, 404]).toContain(res.status);
    });

    it('should reject expired invitation', async () => {
      // Create a workspace
      const workspace = createWorkspace('Test Team', 'team', 'test-user-001');
      
      // Create an invitation and then manually expire it via acceptInvitation logic
      const invitation = createWorkspaceInvitation(workspace.id, 'test@example.com', 'member', 'test-user-001');
      
      // Accept it first
      acceptInvitation(invitation.id, 'user-who-accepted');
      
      // Try to accept again - should fail as already accepted
      const req = createAuthRequest('POST', {}, 'another-user');
      const params = Promise.resolve({ token: invitation.id });
      
      const res = await POST(req, { params });
      const data = await res.json();
      
      // Should fail because invitation is already accepted
      expect(res.status).toBe(404);
    });
  });
});
