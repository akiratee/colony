// Workspace Store Unit Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  getWorkspaces, 
  getWorkspace, 
  createWorkspace, 
  updateWorkspace, 
  deleteWorkspace,
  getUserWorkspaces,
  addWorkspaceMember,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateMemberRole,
  resetWorkspaces,
  createWorkspaceInvitation,
  canManageWorkspace,
  canDeleteWorkspace,
  canUpdateWorkspace,
  canInviteUsers,
  canRemoveMembers,
  canUpdateMemberRoles,
  canCreateChannels,
  canDeleteChannels,
  canEditChannels,
  canManageBots,
  canManageCategories,
  canViewWorkspace,
  canModifyRole,
  getUserPermissions,
} from '@/lib/workspace-store';

describe('Workspace Store', () => {
  beforeEach(() => {
    // Reset workspace store between tests
    resetWorkspaces();
  });

  describe('getWorkspaces', () => {
    it('should return all workspaces', () => {
      const workspaces = getWorkspaces();
      expect(workspaces).toBeDefined();
      expect(Array.isArray(workspaces)).toBe(true);
      expect(workspaces.length).toBeGreaterThan(0);
    });

    it('should return default workspaces with expected properties', () => {
      const workspaces = getWorkspaces();
      const defaultWs = workspaces.find(w => w.id === 'ws-default');
      expect(defaultWs).toBeDefined();
      expect(defaultWs?.name).toBe('Personal');
      expect(defaultWs?.type).toBe('personal');
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace by id', () => {
      const workspace = getWorkspace('ws-default');
      expect(workspace).toBeDefined();
      expect(workspace?.name).toBe('Personal');
    });

    it('should return undefined for non-existent workspace', () => {
      const workspace = getWorkspace('non-existent');
      expect(workspace).toBeUndefined();
    });
  });

  describe('createWorkspace', () => {
    it('should create a new workspace', () => {
      const initialCount = getWorkspaces().length;
      const workspace = createWorkspace('Test Team', 'team', 'test-user-002', 'A test workspace');
      
      expect(workspace).toBeDefined();
      expect(workspace.name).toBe('Test Team');
      expect(workspace.type).toBe('team');
      expect(workspace.description).toBe('A test workspace');
      expect(workspace.ownerId).toBe('test-user-002');
      expect(getWorkspaces().length).toBe(initialCount + 1);
    });

    it('should add owner as member automatically', () => {
      const workspace = createWorkspace('Test Team', 'team', 'new-owner');
      const members = getWorkspaceMembers(workspace.id);
      expect(members.some(m => m.userId === 'new-owner' && m.role === 'owner')).toBe(true);
    });
  });

  describe('updateWorkspace', () => {
    it('should update workspace name', () => {
      const updated = updateWorkspace('ws-default', { name: 'New Name' }, 'test-user-001');
      expect(updated).toBeDefined();
      expect(updated?.name).toBe('New Name');
    });

    it('should update workspace description', () => {
      const updated = updateWorkspace('ws-default', { description: 'New description' }, 'test-user-001');
      expect(updated).toBeDefined();
      expect(updated?.description).toBe('New description');
    });

    it('should reject update for non-owner', () => {
      const updated = updateWorkspace('ws-default', { name: 'Hacked' }, 'not-owner');
      expect(updated).toBeNull();
    });

    it('should allow update without ownerId (backward compatibility)', () => {
      const updated = updateWorkspace('ws-default', { name: 'No Owner Check' });
      expect(updated).toBeDefined();
    });
  });

  describe('deleteWorkspace', () => {
    it('should delete workspace', () => {
      const newWs = createWorkspace('To Delete', 'team', 'test-user-001');
      const initialCount = getWorkspaces().length;
      const result = deleteWorkspace(newWs.id, 'test-user-001');
      expect(result).toBe(true);
      expect(getWorkspaces().length).toBe(initialCount - 1);
    });

    it('should reject delete for non-owner', () => {
      const newWs = createWorkspace('To Delete', 'team', 'test-user-001');
      const result = deleteWorkspace(newWs.id, 'not-owner');
      expect(result).toBe(false);
    });

    it('should allow delete without ownerId (backward compatibility)', () => {
      const newWs = createWorkspace('To Delete', 'team', 'test-user-001');
      const result = deleteWorkspace(newWs.id);
      expect(result).toBe(true);
    });
  });

  describe('getUserWorkspaces', () => {
    it('should return workspaces for user', () => {
      const workspaces = getUserWorkspaces('test-user-001');
      expect(workspaces).toBeDefined();
      expect(Array.isArray(workspaces)).toBe(true);
    });

    it('should return empty array for user with no workspaces', () => {
      const workspaces = getUserWorkspaces('non-existent-user');
      expect(workspaces).toEqual([]);
    });
  });
});

describe('Workspace Members', () => {
  beforeEach(() => {
    resetWorkspaces();
  });

  describe('getWorkspaceMembers', () => {
    it('should return members for workspace', () => {
      const members = getWorkspaceMembers('ws-default');
      expect(members).toBeDefined();
      expect(Array.isArray(members)).toBe(true);
      expect(members.length).toBeGreaterThan(0);
    });

    it('should return owner as first member for new workspace', () => {
      const workspace = createWorkspace('Empty Team', 'team', 'new-owner');
      const members = getWorkspaceMembers(workspace.id);
      expect(members.some(m => m.userId === 'new-owner')).toBe(true);
    });
  });

  describe('addWorkspaceMember', () => {
    it('should add member to workspace', () => {
      const initialMembers = getWorkspaceMembers('ws-team').length;
      const result = addWorkspaceMember('ws-team', 'new-user-123', 'member');
      
      expect(result).toBeDefined();
      expect(getWorkspaceMembers('ws-team').length).toBe(initialMembers + 1);
    });

    it('should not add duplicate member', () => {
      addWorkspaceMember('ws-team', 'new-user', 'member');
      const initialMembers = getWorkspaceMembers('ws-team').length;
      
      const result = addWorkspaceMember('ws-team', 'new-user', 'admin');
      // Returns existing member, count doesn't increase
      expect(getWorkspaceMembers('ws-team').length).toBe(initialMembers);
    });
  });

  describe('removeWorkspaceMember', () => {
    it('should remove member from workspace', () => {
      // Add a member first
      addWorkspaceMember('ws-team', 'removable-user', 'member');
      const initialMembers = getWorkspaceMembers('ws-team').length;
      
      const result = removeWorkspaceMember('ws-team', 'removable-user');
      
      expect(result).toBe(true);
      expect(getWorkspaceMembers('ws-team').length).toBe(initialMembers - 1);
    });

    it('should return false for non-existent member', () => {
      const result = removeWorkspaceMember('ws-team', 'non-existent');
      expect(result).toBe(false);
    });

    it('should not allow removing owner', () => {
      const result = removeWorkspaceMember('ws-team', 'test-user-001');
      expect(result).toBe(false);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', () => {
      addWorkspaceMember('ws-team', 'test-member', 'member');
      const result = updateMemberRole('ws-team', 'test-member', 'admin');
      
      expect(result).toBeDefined();
      expect(result?.role).toBe('admin');
    });

    it('should return null for non-existent member', () => {
      const result = updateMemberRole('ws-team', 'non-existent', 'admin');
      expect(result).toBeNull();
    });
  });
});

describe('Workspace Invitations', () => {
  beforeEach(() => {
    resetWorkspaces();
  });

  describe('createWorkspaceInvitation', () => {
    it('should create invitation', () => {
      const invitation = createWorkspaceInvitation('ws-team', 'new@example.com', 'member', 'test-user-001');
      
      expect(invitation).toBeDefined();
      expect(invitation.email).toBe('new@example.com');
      expect(invitation.role).toBe('member');
      expect(invitation.workspaceId).toBe('ws-team');
    });

    it('should normalize email to lowercase', () => {
      const invitation = createWorkspaceInvitation('ws-team', 'NEW@EXAMPLE.COM', 'member', 'test-user-001');
      
      expect(invitation.email).toBe('new@example.com');
    });
  });
});

describe('Role Hierarchy Permissions', () => {
  beforeEach(() => {
    resetWorkspaces();
    // Create test workspace with multiple roles
    addWorkspaceMember('ws-team', 'owner-user', 'owner');
    addWorkspaceMember('ws-team', 'admin-user', 'admin');
    addWorkspaceMember('ws-team', 'member-user', 'member');
    addWorkspaceMember('ws-team', 'guest-user', 'guest');
  });

  describe('canViewWorkspace', () => {
    it('should allow owner to view', () => {
      expect(canViewWorkspace('ws-team', 'owner-user')).toBe(true);
    });

    it('should allow admin to view', () => {
      expect(canViewWorkspace('ws-team', 'admin-user')).toBe(true);
    });

    it('should allow member to view', () => {
      expect(canViewWorkspace('ws-team', 'member-user')).toBe(true);
    });

    it('should allow guest to view', () => {
      expect(canViewWorkspace('ws-team', 'guest-user')).toBe(true);
    });

    it('should deny non-member', () => {
      expect(canViewWorkspace('ws-team', 'non-member')).toBe(false);
    });
  });

  describe('canManageWorkspace', () => {
    it('should allow owner to manage', () => {
      expect(canManageWorkspace('ws-team', 'owner-user')).toBe(true);
    });

    it('should allow admin to manage', () => {
      expect(canManageWorkspace('ws-team', 'admin-user')).toBe(true);
    });

    it('should deny member', () => {
      expect(canManageWorkspace('ws-team', 'member-user')).toBe(false);
    });

    it('should deny guest', () => {
      expect(canManageWorkspace('ws-team', 'guest-user')).toBe(false);
    });
  });

  describe('canDeleteWorkspace', () => {
    it('should allow owner to delete', () => {
      // ws-team has ownerId = 'test-user-001'
      expect(canDeleteWorkspace('ws-team', 'test-user-001')).toBe(true);
    });

    it('should deny admin', () => {
      expect(canDeleteWorkspace('ws-team', 'admin-user')).toBe(false);
    });

    it('should deny member', () => {
      expect(canDeleteWorkspace('ws-team', 'member-user')).toBe(false);
    });

    it('should deny guest', () => {
      expect(canDeleteWorkspace('ws-team', 'guest-user')).toBe(false);
    });
  });

  describe('canInviteUsers', () => {
    it('should allow owner to invite', () => {
      expect(canInviteUsers('ws-team', 'owner-user')).toBe(true);
    });

    it('should allow admin to invite', () => {
      expect(canInviteUsers('ws-team', 'admin-user')).toBe(true);
    });

    it('should deny member', () => {
      expect(canInviteUsers('ws-team', 'member-user')).toBe(false);
    });

    it('should deny guest', () => {
      expect(canInviteUsers('ws-team', 'guest-user')).toBe(false);
    });
  });

  describe('canRemoveMembers', () => {
    it('should allow owner to remove', () => {
      expect(canRemoveMembers('ws-team', 'owner-user')).toBe(true);
    });

    it('should allow admin to remove', () => {
      expect(canRemoveMembers('ws-team', 'admin-user')).toBe(true);
    });

    it('should deny member', () => {
      expect(canRemoveMembers('ws-team', 'member-user')).toBe(false);
    });
  });

  describe('canCreateChannels', () => {
    it('should allow owner to create', () => {
      expect(canCreateChannels('ws-team', 'owner-user')).toBe(true);
    });

    it('should allow admin to create', () => {
      expect(canCreateChannels('ws-team', 'admin-user')).toBe(true);
    });

    it('should allow member to create', () => {
      expect(canCreateChannels('ws-team', 'member-user')).toBe(true);
    });

    it('should deny guest', () => {
      expect(canCreateChannels('ws-team', 'guest-user')).toBe(false);
    });
  });

  describe('canDeleteChannels', () => {
    it('should allow owner to delete', () => {
      expect(canDeleteChannels('ws-team', 'owner-user')).toBe(true);
    });

    it('should allow admin to delete', () => {
      expect(canDeleteChannels('ws-team', 'admin-user')).toBe(true);
    });

    it('should deny member', () => {
      expect(canDeleteChannels('ws-team', 'member-user')).toBe(false);
    });
  });

  describe('canManageBots', () => {
    it('should allow owner to manage bots', () => {
      expect(canManageBots('ws-team', 'owner-user')).toBe(true);
    });

    it('should allow admin to manage bots', () => {
      expect(canManageBots('ws-team', 'admin-user')).toBe(true);
    });

    it('should deny member', () => {
      expect(canManageBots('ws-team', 'member-user')).toBe(false);
    });
  });

  describe('canModifyRole', () => {
    it('owner can modify any role', () => {
      expect(canModifyRole('ws-team', 'owner-user', 'admin')).toBe(true);
      expect(canModifyRole('ws-team', 'owner-user', 'member')).toBe(true);
      expect(canModifyRole('ws-team', 'owner-user', 'guest')).toBe(true);
    });

    it('admin can modify member and guest roles', () => {
      expect(canModifyRole('ws-team', 'admin-user', 'member')).toBe(true);
      expect(canModifyRole('ws-team', 'admin-user', 'guest')).toBe(true);
      expect(canModifyRole('ws-team', 'admin-user', 'admin')).toBe(false);
      expect(canModifyRole('ws-team', 'admin-user', 'owner')).toBe(false);
    });

    it('member cannot modify any roles', () => {
      expect(canModifyRole('ws-team', 'member-user', 'guest')).toBe(false);
      expect(canModifyRole('ws-team', 'member-user', 'member')).toBe(false);
    });
  });

  describe('getUserPermissions', () => {
    it('should return all permissions for owner', () => {
      // test-user-001 is the actual owner of ws-team
      const perms = getUserPermissions('ws-team', 'test-user-001');
      expect(perms.role).toBe('owner');
      expect(perms.canView).toBe(true);
      expect(perms.canManage).toBe(true);
      expect(perms.canDeleteWorkspace).toBe(true);
      expect(perms.canInviteUsers).toBe(true);
      expect(perms.canCreateChannels).toBe(true);
    });

    it('should return all permissions for admin', () => {
      const perms = getUserPermissions('ws-team', 'admin-user');
      expect(perms.role).toBe('admin');
      expect(perms.canView).toBe(true);
      expect(perms.canManage).toBe(true);
      expect(perms.canDeleteWorkspace).toBe(false); // Only owner
      expect(perms.canInviteUsers).toBe(true);
      expect(perms.canCreateChannels).toBe(true);
    });

    it('should return limited permissions for member', () => {
      const perms = getUserPermissions('ws-team', 'member-user');
      expect(perms.role).toBe('member');
      expect(perms.canView).toBe(true);
      expect(perms.canManage).toBe(false);
      expect(perms.canDeleteWorkspace).toBe(false);
      expect(perms.canInviteUsers).toBe(false);
      expect(perms.canCreateChannels).toBe(true); // Members can create channels
    });

    it('should return minimal permissions for guest', () => {
      const perms = getUserPermissions('ws-team', 'guest-user');
      expect(perms.role).toBe('guest');
      expect(perms.canView).toBe(true);
      expect(perms.canManage).toBe(false);
      expect(perms.canCreateChannels).toBe(false);
    });
  });
});
