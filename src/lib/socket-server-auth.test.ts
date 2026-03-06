// Socket Server Authentication Tests
// Tests for server/index.ts join_channel authentication

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock socket.io
const mockSocket = {
  id: 'test-socket-id',
  join: vi.fn(),
  leave: vi.fn(),
  emit: vi.fn(),
  to: vi.fn(() => ({ emit: vi.fn() })),
  on: vi.fn(),
  once: vi.fn(),
  disconnect: vi.fn(),
  connected: true,
};

const mockIo = {
  on: vi.fn((event: string, handler: (socket: unknown) => void) => {
    // Store handler for later
    mockIo._connectionHandler = handler;
  }),
  _connectionHandler: null as ((socket: unknown) => void) | null,
};

describe('Socket Server - join_channel Authentication', () => {
  // This test verifies the server code structure has proper auth checks
  // Actual socket testing would require a running socket server

  it('should have single join_channel handler with auth check', async () => {
    // Read the server file and verify there's only one join_channel handler
    const fs = await import('fs/promises');
    const serverCode = await fs.readFile('./server/index.ts', 'utf-8');
    
    // Count occurrences of "socket.on('join_channel'"
    const joinChannelMatches = serverCode.match(/socket\.on\s*\(\s*['"]join_channel['"]/g);
    
    // Should have exactly 1 join_channel handler (the duplicate was fixed)
    expect(joinChannelMatches).toHaveLength(1);
  });

  it('should require authentication before joining channel', async () => {
    const fs = await import('fs/promises');
    const serverCode = await fs.readFile('./server/index.ts', 'utf-8');
    
    // The join_channel handler should check isAuthenticated before allowing join
    expect(serverCode).toContain("if (!isAuthenticated(socket))");
    expect(serverCode).toContain("callback?.({ error: 'Authentication required");
  });

  it('should not have duplicate event handlers', async () => {
    const fs = await import('fs/promises');
    const serverCode = await fs.readFile('./server/index.ts', 'utf-8');
    
    // Check for any duplicate socket.on calls
    const allOnHandlers = serverCode.match(/socket\.on\s*\(\s*['"][^'"]+['"]/g) || [];
    const handlerCounts = new Map<string, number>();
    
    for (const handler of allOnHandlers) {
      const eventName = handler.match(/['"]([^'"]+)['"]/)?.[1];
      if (eventName) {
        handlerCounts.set(eventName, (handlerCounts.get(eventName) || 0) + 1);
      }
    }
    
    // Find duplicates
    const duplicates = Array.from(handlerCounts.entries()).filter(([_, count]) => count > 1);
    
    // Should have no duplicate handlers
    expect(duplicates).toHaveLength(0);
  });
});
