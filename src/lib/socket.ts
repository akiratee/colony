// Colony Socket.io Client Utilities

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(channelId?: string): void {
  const s = getSocket();
  
  if (!s.connected) {
    s.connect();
  }
  
  if (channelId) {
    s.emit('join_channel', { channelId });
  }
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

export function onMessage(callback: (message: any) => void): void {
  const s = getSocket();
  s.on('message', callback);
}

export function offMessage(callback: (message: any) => void): void {
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

export function onConnectError(callback: (error: any) => void): void {
  const s = getSocket();
  s.on('connect_error', callback);
}

export function offConnectError(callback: (error: any) => void): void {
  const s = getSocket();
  s.off('connect_error', callback);
}

// Colony Types

export interface Message {
  id: string;
  content: string;
  channelId: string;
  author: {
    name: string;
    avatar?: string;
    isBot?: boolean;
  };
  timestamp: Date;
}

export interface Channel {
  id: string;
  name: string;
  description?: string;
}

export interface Bot {
  id: string;
  name: string;
  description: string;
  avatar: string;
  status: 'online' | 'offline';
  instructions?: string;
  apiEndpoint?: string;
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
}
