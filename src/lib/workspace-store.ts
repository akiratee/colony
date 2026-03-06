// Shared Workspace Store for Colony
// Used by REST API routes for workspace/team management

import { generateId } from './id';
import { sanitizeContent } from './validation';
import type { Workspace, WorkspaceMember, WorkspaceRole, WorkspaceType, WorkspaceInvitation } from './types';

// ============================================================================
// In-Memory Workspace Store
// ============================================================================

// Default workspaces for development
const defaultWorkspaces: Workspace[] = [
  {
    id: 'ws-default',
    name: 'Personal',
    type: 'personal',
    description: 'Your personal workspace',
    ownerId: 'test-user-001',
    createdAt: new Date(),
    settings: {
      allowGuestAccess: false,
      defaultRole: 'owner',
      maxMembers: 1,
    },
  },
  {
    id: 'ws-team',
    name: 'Team',
    type: 'team',
    description: 'Team collaboration workspace',
    ownerId: 'test-user-001',
    createdAt: new Date(),
    settings: {
      allowGuestAccess: true,
      defaultRole: 'member',
      maxMembers: 50,
    },
  },
];

// In-memory workspace store
let workspaceStore: Workspace[] = [...defaultWorkspaces];
let workspaceMembersStore: WorkspaceMember[] = [
  { workspaceId: 'ws-default', userId: 'test-user-001', role: 'owner', joinedAt: new Date() },
  { workspaceId: 'ws-team', userId: 'test-user-001', role: 'owner', joinedAt: new Date() },
];
let workspaceInvitationsStore: WorkspaceInvitation[] = [];

// ============================================================================
// Workspace CRUD Operations
// ============================================================================

export function generateWorkspaceId(): string {
  return `ws-${generateId()}`;
}

export function getWorkspaces(): Workspace[] {
  return [...workspaceStore];
}

export function getWorkspace(id: string): Workspace | undefined {
  return workspaceStore.find(w => w.id === id);
}

export function getWorkspaceByName(name: string): Workspace | undefined {
  return workspaceStore.find(w => w.name.toLowerCase() === name.toLowerCase());
}

export function getUserWorkspaces(userId: string): Workspace[] {
  const userMemberShips = workspaceMembersStore.filter(m => m.userId === userId);
  const workspaceIds = userMemberShips.map(m => m.workspaceId);
  return workspaceStore.filter(w => workspaceIds.includes(w.id));
}

export function createWorkspace(
  name: string,
  type: WorkspaceType,
  ownerId: string,
  description?: string
): Workspace {
  // Check if workspace name already exists
  const existing = getWorkspaceByName(name);
  if (existing) {
    throw new Error(`Workspace '${name}' already exists`);
  }

  const workspace: Workspace = {
    id: generateWorkspaceId(),
    name: name.trim(),
    type,
    description: description ? sanitizeContent(description.trim()) : '',
    ownerId,
    createdAt: new Date(),
    settings: {
      allowGuestAccess: type !== 'personal',
      defaultRole: type === 'personal' ? 'owner' : 'member',
      maxMembers: type === 'personal' ? 1 : 50,
    },
  };

  workspaceStore.push(workspace);

  // Add owner as a member
  addWorkspaceMember(workspace.id, ownerId, 'owner');

  return workspace;
}

export function updateWorkspace(
  id: string,
  updates: Partial<Pick<Workspace, 'name' | 'description' | 'settings'>>,
  ownerId?: string
): Workspace | null {
  const index = workspaceStore.findIndex(w => w.id === id);
  if (index === -1) {
    return null;
  }

  // Validate ownership if ownerId provided
  if (ownerId && workspaceStore[index].ownerId !== ownerId) {
    return null;
  }

  // Check for duplicate name
  if (updates.name) {
    const duplicate = workspaceStore.find(
      w => w.id !== id && w.name.toLowerCase() === updates.name!.toLowerCase()
    );
    if (duplicate) {
      return null;
    }
  }

  workspaceStore[index] = {
    ...workspaceStore[index],
    name: updates.name?.trim() || workspaceStore[index].name,
    description: updates.description !== undefined
      ? sanitizeContent(updates.description.trim())
      : workspaceStore[index].description,
    settings: updates.settings
      ? { ...workspaceStore[index].settings, ...updates.settings }
      : workspaceStore[index].settings,
  };

  return workspaceStore[index];
}

export function deleteWorkspace(id: string, ownerId?: string): boolean {
  const index = workspaceStore.findIndex(w => w.id === id);
  if (index === -1) {
    return false;
  }

  // Validate ownership if ownerId provided
  if (ownerId && workspaceStore[index].ownerId !== ownerId) {
    return false;
  }

  workspaceStore.splice(index, 1);

  // Clean up members and invitations
  workspaceMembersStore = workspaceMembersStore.filter(m => m.workspaceId !== id);
  workspaceInvitationsStore = workspaceInvitationsStore.filter(i => i.workspaceId !== id);

  return true;
}

// ============================================================================
// Workspace Member Management
// ============================================================================

export function getWorkspaceMembers(workspaceId: string): WorkspaceMember[] {
  return workspaceMembersStore.filter(m => m.workspaceId === workspaceId);
}

export function getWorkspaceMember(workspaceId: string, userId: string): WorkspaceMember | undefined {
  return workspaceMembersStore.find(m => m.workspaceId === workspaceId && m.userId === userId);
}

export function addWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole
): WorkspaceMember | null {
  // Check if workspace exists
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    return null;
  }

  // Check if already a member
  const existing = getWorkspaceMember(workspaceId, userId);
  if (existing) {
    return existing;
  }

  // Check max members limit
  const memberCount = workspaceMembersStore.filter(m => m.workspaceId === workspaceId).length;
  if (workspace.settings?.maxMembers && memberCount >= workspace.settings.maxMembers) {
    throw new Error(`Workspace has reached maximum member limit (${workspace.settings.maxMembers})`);
  }

  const member: WorkspaceMember = {
    workspaceId,
    userId,
    role,
    joinedAt: new Date(),
  };

  workspaceMembersStore.push(member);
  return member;
}

export function removeWorkspaceMember(workspaceId: string, userId: string): boolean {
  // Cannot remove owner
  const member = getWorkspaceMember(workspaceId, userId);
  if (!member || member.role === 'owner') {
    return false;
  }

  const index = workspaceMembersStore.findIndex(
    m => m.workspaceId === workspaceId && m.userId === userId
  );
  if (index === -1) {
    return false;
  }

  workspaceMembersStore.splice(index, 1);
  return true;
}

export function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  newRole: WorkspaceRole
): WorkspaceMember | null {
  const member = getWorkspaceMember(workspaceId, userId);
  if (!member) {
    return null;
  }

  // Cannot change owner's role
  if (member.role === 'owner') {
    return null;
  }

  member.role = newRole;
  return member;
}

// Alias for convenience
export const updateMemberRole = updateWorkspaceMemberRole;

export function isWorkspaceMember(workspaceId: string, userId: string): boolean {
  return workspaceMembersStore.some(m => m.workspaceId === workspaceId && m.userId === userId);
}

export function getUserRole(workspaceId: string, userId: string): WorkspaceRole | null {
  const member = getWorkspaceMember(workspaceId, userId);
  return member ? member.role : null;
}

// ============================================================================
// Role Hierarchy Permission Functions
// ============================================================================

/**
 * Role hierarchy: owner > admin > member > guest
 * Each function checks if the user has permission for a specific action
 */

// Owner/Admin can manage workspace settings
export function canManageWorkspace(workspaceId: string, userId: string): boolean {
  const role = getUserRole(workspaceId, userId);
  return role === 'owner' || role === 'admin';
}

// Owner can delete workspace (not even admin can do this)
export function canDeleteWorkspace(workspaceId: string, userId: string): boolean {
  const workspace = getWorkspace(workspaceId);
  if (!workspace) { return false; }
  return workspace.ownerId === userId;
}

// Owner/Admin can update workspace
export function canUpdateWorkspace(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// Owner/Admin can invite new members
export function canInviteUsers(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// Owner/Admin can remove members (but not owners)
export function canRemoveMembers(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// Owner/Admin can update member roles (but not owner's role)
export function canUpdateMemberRoles(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// Owner/Admin can create channels
export function canCreateChannels(workspaceId: string, userId: string): boolean {
  const role = getUserRole(workspaceId, userId);
  return role === 'owner' || role === 'admin' || role === 'member';
}

// Owner/Admin can delete channels
export function canDeleteChannels(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// Owner/Admin can edit channels
export function canEditChannels(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// Owner/Admin can manage bots
export function canManageBots(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// Owner/Admin can manage categories
export function canManageCategories(workspaceId: string, userId: string): boolean {
  return canManageWorkspace(workspaceId, userId);
}

// All members (including guest) can view workspace
export function canViewWorkspace(workspaceId: string, userId: string): boolean {
  return isWorkspaceMember(workspaceId, userId);
}

// Check if a user can perform an action based on their role vs target user's role
// Users can only modify roles lower than their own
export function canModifyRole(workspaceId: string, userId: string, targetRole: WorkspaceRole): boolean {
  const userRole = getUserRole(workspaceId, userId);
  if (!userRole) { return false; }
  
  const roleHierarchy: Record<WorkspaceRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    guest: 1,
  };
  
  // Owner can do anything
  if (userRole === 'owner') { return true; }
  
  // Admin can modify member/guest roles
  if (userRole === 'admin') {
    return roleHierarchy[targetRole] <= roleHierarchy.member;
  }
  
  // Member/guest cannot modify roles
  return false;
}

// Get all permissions for a user in a workspace
export function getUserPermissions(workspaceId: string, userId: string): {
  canView: boolean;
  canManage: boolean;
  canDeleteWorkspace: boolean;
  canUpdateWorkspace: boolean;
  canInviteUsers: boolean;
  canRemoveMembers: boolean;
  canUpdateMemberRoles: boolean;
  canCreateChannels: boolean;
  canDeleteChannels: boolean;
  canEditChannels: boolean;
  canManageBots: boolean;
  canManageCategories: boolean;
  role: WorkspaceRole | null;
} {
  return {
    canView: canViewWorkspace(workspaceId, userId),
    canManage: canManageWorkspace(workspaceId, userId),
    canDeleteWorkspace: canDeleteWorkspace(workspaceId, userId),
    canUpdateWorkspace: canUpdateWorkspace(workspaceId, userId),
    canInviteUsers: canInviteUsers(workspaceId, userId),
    canRemoveMembers: canRemoveMembers(workspaceId, userId),
    canUpdateMemberRoles: canUpdateMemberRoles(workspaceId, userId),
    canCreateChannels: canCreateChannels(workspaceId, userId),
    canDeleteChannels: canDeleteChannels(workspaceId, userId),
    canEditChannels: canEditChannels(workspaceId, userId),
    canManageBots: canManageBots(workspaceId, userId),
    canManageCategories: canManageCategories(workspaceId, userId),
    role: getUserRole(workspaceId, userId),
  };
}

// ============================================================================
// Workspace Invitations
// ============================================================================

export function createWorkspaceInvitation(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  invitedBy: string
): WorkspaceInvitation {
  const invitation: WorkspaceInvitation = {
    id: generateId(),
    workspaceId,
    email: email.toLowerCase(),
    role,
    invitedBy,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    accepted: false,
  };

  workspaceInvitationsStore.push(invitation);
  return invitation;
}

export function getWorkspaceInvitations(workspaceId: string): WorkspaceInvitation[] {
  return workspaceInvitationsStore.filter(i => i.workspaceId === workspaceId && !i.accepted);
}

export function getInvitationByToken(token: string): WorkspaceInvitation | undefined {
  return workspaceInvitationsStore.find(i => i.id === token && !i.accepted);
}

export function acceptInvitation(invitationId: string, userId: string): boolean {
  const invitation = workspaceInvitationsStore.find(i => i.id === invitationId);
  if (!invitation || invitation.accepted) {
    return false;
  }

  if (new Date() > invitation.expiresAt) {
    return false;
  }

  // Add user to workspace
  addWorkspaceMember(invitation.workspaceId, userId, invitation.role);
  invitation.accepted = true;

  return true;
}

export function deleteInvitation(invitationId: string): boolean {
  const index = workspaceInvitationsStore.findIndex(i => i.id === invitationId);
  if (index === -1) {
    return false;
  }

  workspaceInvitationsStore.splice(index, 1);
  return true;
}

// ============================================================================
// Utilities
// ============================================================================

export function getWorkspaceCount(): number {
  return workspaceStore.length;
}

export function resetWorkspaces(): void {
  workspaceStore = [...defaultWorkspaces];
  workspaceMembersStore = [
    { workspaceId: 'ws-default', userId: 'test-user-001', role: 'owner', joinedAt: new Date() },
    { workspaceId: 'ws-team', userId: 'test-user-001', role: 'owner', joinedAt: new Date() },
  ];
  workspaceInvitationsStore = [];
}
