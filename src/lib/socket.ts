// Colony Socket.io Client Utilities
// Used by the Next.js frontend to connect to the Socket.io server

import { io, Socket } from 'socket.io-client';
import type { Message, SendMessagePayload, JoinChannelPayload, TypingPayload, Author, Channel, Agent, Bot, User, ServerResponse, CreateMessageRequest, CreateChannelRequest, CreateBotRequest, PaginatedResponse } from './types';

// Re-export all types for convenience
export type { 
  Message, 
  SendMessagePayload, 
  JoinChannelPayload, 
  TypingPayload,
  Author,
  Channel,
  Agent,
  Bot,
  User,
  ServerResponse,
  CreateMessageRequest,
  CreateChannelRequest,
  CreateBotRequest,
  PaginatedResponse
};

let socket: Socket | null = null;
// Track if reconnect listener has been added to prevent duplicates
let reconnectListenerAdded = false;

// Current authenticated user
let currentUser: { id: string; name: string; avatar?: string } | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Auth will be sent via auth event after connection
    });

    // Set up automatic re-authentication on reconnection (only once)
    if (!reconnectListenerAdded) {
      socket.on('reconnect', () => {
        console.log('Socket reconnected, re-authenticating...');
        if (currentUser) {
          // Re-authenticate using stored user
          socket!.emit('auth', { user: currentUser }, (response: { success?: boolean; error?: string }) => {
            if (response.success) {
              console.log('Socket re-authenticated successfully');
            } else {
              console.error('Socket re-authentication failed:', response.error);
              // Clear current user on auth failure to prevent stale state
              currentUser = null;
            }
          });
        }
      });
      reconnectListenerAdded = true;
    }
  }
  return socket;
}

// Authenticate the socket connection
export function authenticateSocket(user: { id: string; name: string; avatar?: string }): Promise<{ success?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();

    // If not connected, connect first
    if (!s.connected) {
      s.connect();
      s.once('connect', () => {
        s.emit('auth', { user }, (response: { success?: boolean; error?: string; user?: typeof user }) => {
          // Only set currentUser if auth succeeded
          if (response.success) {
            currentUser = user;
            resolve({ success: true });
          } else {
            resolve({ error: response.error || 'Auth failed' });
          }
        });
      });
    } else {
      s.emit('auth', { user }, (response: { success?: boolean; error?: string; user?: typeof user }) => {
        // Only set currentUser if auth succeeded
        if (response.success) {
          currentUser = user;
          resolve({ success: true });
        } else {
          resolve({ error: response.error || 'Auth failed' });
        }
      });
    }
  });
}

// Get current authenticated user
export function getCurrentUser(): { id: string; name: string; avatar?: string } | null {
  return currentUser;
}

// Check if socket is authenticated
export function isAuthenticated(): boolean {
  return currentUser !== null;
}

// Connection state type
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Get current socket connection state
export function getConnectionState(): ConnectionState {
  if (!socket) {return 'disconnected';}
  if (socket.connected) {return 'connected';}
  // Socket.io states: 'connect', 'connecting', 'disconnect', 'disconnecting', 'error'
  // We track connecting state via event listeners, but for simplicity:
  return socket.disconnected ? 'disconnected' : 'connecting';
}

export function connectSocket(channelId?: string, user?: { id: string; name: string; avatar?: string }): Promise<{ success?: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    const s = getSocket();
    
    // If user provided, authenticate first
    if (user && !currentUser) {
      const authResult = await authenticateSocket(user);
      if (!authResult.success) {
        resolve({ error: authResult.error });
        return;
      }
    }
    
    if (!s.connected) {
      s.connect();
      s.once('connect', () => {
        if (channelId) {
          s.emit('join_channel', { channelId }, (response: { success?: boolean; error?: string }) => {
            resolve(response);
          });
        } else {
          resolve({ success: true });
        }
      });
    } else if (channelId) {
      s.emit('join_channel', { channelId }, (response: { success?: boolean; error?: string }) => {
        resolve(response);
      });
    } else {
      resolve({ success: true });
    }
  });
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

export function sendMessage(channelId: string, content: string, author: {
  name: string;
  avatar?: string;
  isBot?: boolean;
}): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('send_message', { channelId, content, author });
  }
}

export function onMessage(callback: (message: Message) => void): void {
  const s = getSocket();
  s.on('message', callback);
}

export function offMessage(callback: (message: Message) => void): void {
  const s = getSocket();
  s.off('message', callback);
}

export function onConnect(callback: () => void): void {
  const s = getSocket();
  s.on('connect', callback);
}

export function offConnect(callback: () => void): void {
  const s = getSocket();
  s.off('connect', callback);
}

export function onDisconnect(callback: () => void): void {
  const s = getSocket();
  s.on('disconnect', callback);
}

export function offDisconnect(callback: () => void): void {
  const s = getSocket();
  s.off('disconnect', callback);
}

export function onConnectError(callback: (error: Error) => void): void {
  const s = getSocket();
  s.on('connect_error', callback);
}

export function offConnectError(callback: (error: Error) => void): void {
  const s = getSocket();
  s.off('connect_error', callback);
}

// Typing indicator handlers
export function onTyping(callback: (data: { userId: string; isTyping: boolean }) => void): void {
  const s = getSocket();
  s.on('typing', callback);
}

export function offTyping(callback: (data: { userId: string; isTyping: boolean }) => void): void {
  const s = getSocket();
  s.off('typing', callback);
}

// User presence handlers
export function onUserJoined(callback: (data: { socketId: string; userName?: string }) => void): void {
  const s = getSocket();
  s.on('user_joined', callback);
}

export function offUserJoined(callback: (data: { socketId: string; userName?: string }) => void): void {
  const s = getSocket();
  s.off('user_joined', callback);
}

export function onUserLeft(callback: (data: { socketId: string; userName?: string }) => void): void {
  const s = getSocket();
  s.on('user_left', callback);
}

export function offUserLeft(callback: (data: { socketId: string; userName?: string }) => void): void {
  const s = getSocket();
  s.off('user_left', callback);
}

export function onMessageHistory(callback: (messages: Message[]) => void): void {
  const s = getSocket();
  s.on('message_history', callback);
}

export function offMessageHistory(callback: (messages: Message[]) => void): void {
  const s = getSocket();
  s.off('message_history', callback);
}

// Message edited event handlers
export function onMessageEdited(callback: (message: Message) => void): void {
  const s = getSocket();
  s.on('message_edited', callback);
}

export function offMessageEdited(callback: (message: Message) => void): void {
  const s = getSocket();
  s.off('message_edited', callback);
}

// Message deleted event handlers
export function onMessageDeleted(callback: (data: { id: string }) => void): void {
  const s = getSocket();
  s.on('message_deleted', callback);
}

export function offMessageDeleted(callback: (data: { id: string }) => void): void {
  const s = getSocket();
  s.off('message_deleted', callback);
}

// Send typing indicator
export function sendTyping(channelId: string, userId: string, isTyping: boolean): void {
  const s = getSocket();
  if (s.connected) {
    s.emit('typing', { channelId, userId, isTyping });
  }
}

// Join channel with callback support
export function joinChannel(channelId: string): Promise<{ success?: boolean; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    s.emit('join_channel', { channelId }, (response: { success?: boolean; error?: string }) => {
      resolve(response);
    });
  });
}

// Channel joined event handlers (emitted by server after successful join)
export function onChannelJoined(callback: (data: { channelId: string }) => void): void {
  const s = getSocket();
  s.on('channel_joined', callback);
}

export function offChannelJoined(callback: (data: { channelId: string }) => void): void {
  const s = getSocket();
  s.off('channel_joined', callback);
}

// Leave channel
export function leaveChannel(channelId: string): void {
  const s = getSocket();
  s.emit('leave_channel', { channelId });
}

// Send message with callback
export function sendMessageAsync(channelId: string, content: string, author: {
  name: string;
  avatar?: string;
  isBot?: boolean;
}): Promise<{ success?: boolean; message?: Message; error?: string }> {
  return new Promise((resolve) => {
    const s = getSocket();
    s.emit('send_message', { channelId, content, author }, (response: { success?: boolean; message?: Message; error?: string }) => {
      resolve(response);
    });
  });
}

// Cleanup all listeners (important to prevent memory leaks)
export function cleanupAll(): void {
  if (socket) {
    // Remove all listeners first to prevent any pending callbacks during disconnect
    socket.removeAllListeners();
    if (socket.connected) {
      socket.disconnect();
    }
    // Clear socket reference and ensure it's fully disconnected
    socket = null;
  }
  // Reset reconnect listener flag so it gets re-added when socket is recreated
  reconnectListenerAdded = false;
  // Clear current user
  currentUser = null;
}
