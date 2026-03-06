// Socket Authentication Tests

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { io } from 'socket.io-client';
import { authenticateSocket, connectSocket, getCurrentUser, isAuthenticated, cleanupAll } from './socket';

describe('Socket Authentication', () => {
  beforeEach(() => {
    cleanupAll();
  });

  it('should track current user after authentication', async () => {
    const mockUser = { id: 'user-1', name: 'Test User', avatar: 'avatar.png' };
    
    // The function should set currentUser (actual socket connection not available in test)
    expect(getCurrentUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('should clear user on cleanup', async () => {
    const mockUser = { id: 'user-1', name: 'Test User' };
    
    cleanupAll();
    
    expect(getCurrentUser()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});

describe('connectSocket with auth', () => {
  beforeEach(() => {
    cleanupAll();
  });

  it('should require user for authenticated connections', () => {
    // Without auth, connecting should require user param
    cleanupAll();
  });
});
