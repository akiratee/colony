// Colony Socket.io Server with Express REST API
// Run with: npx tsx server/index.ts

import 'dotenv/config';
import { Server, Socket } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import type { Message } from '../src/lib/socket';
import { validateJoinChannel, validateSendMessage, validateTyping, sanitizeContent, sanitizeAuthor } from './validation';
import jwt from 'jsonwebtoken';
import { addMessage, editMessage as editStoredMessage, deleteMessage as deleteStoredMessage, getMessages, getMessage } from '../src/lib/messageStore';
import { channelExists, getChannel, canAccessChannel } from '../src/lib/channelStore';
import authRoutes from './auth';

// Express app for REST API
const app = express();
app.use(cors());
app.use(express.json());

// Auth routes
app.use('/api/auth', authRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Internal broadcast endpoint for other services (e.g., WhatsApp webhook) to emit socket events
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'colony-internal-dev-key';

app.post('/api/broadcast', express.json(), (req, res) => {
  const apiKey = req.headers['x-api-key'];
  
  // Verify internal API key
  if (apiKey !== INTERNAL_API_KEY) {
    res.status(403).json({ error: 'Forbidden: Invalid API key' });
    return;
  }
  
  const { event, channelId, data } = req.body;
  
  if (!event || !channelId || !data) {
    res.status(400).json({ error: 'Missing required fields: event, channelId, data' });
    return;
  }
  
  // Broadcast to everyone in the channel
  io.to(channelId).emit(event, data);
  
  console.log(`Broadcast ${event} to channel ${channelId}`);
  res.json({ success: true });
});

// Create HTTP server with Express
const httpServer = createServer(app);

// Socket.io server
const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
  allowRequest: (req, callback) => {
    callback(null, true);
  },
});

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'colony-dev-secret-do-not-use-in-production';
const REQUIRE_AUTH = process.env.NODE_ENV === 'production' || process.env.REQUIRE_AUTH === 'true';

// Channel storage (in-memory)
const channels = new Map<string, Set<string>>(); // channelId -> set of userIds

// Authenticated users map
interface AuthenticatedUser {
  id: string;
  name: string;
  avatar?: string;
}

const authenticatedUsers = new Map<string, AuthenticatedUser>();

// Check if socket is authenticated
function isAuthenticated(socket: Socket): boolean {
  return authenticatedUsers.has(socket.id);
}

// Get authenticated user for socket
function getAuthenticatedUser(socket: Socket): AuthenticatedUser | undefined {
  return authenticatedUsers.get(socket.id);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Authentication handler
  socket.on('auth', async (payload, callback) => {
    if (!payload || typeof payload !== 'object') {
      callback?.({ error: 'Invalid auth payload' });
      return;
    }

    const { token, user } = payload as { token?: string; user?: AuthenticatedUser };

    // In production, validate JWT token
    if (REQUIRE_AUTH) {
      if (!token) {
        callback?.({ error: 'JWT token required in production mode' });
        return;
      }
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; name: string; avatar?: string };
        const authenticatedUser: AuthenticatedUser = {
          id: decoded.userId,
          name: decoded.name,
          avatar: decoded.avatar,
        };
        authenticatedUsers.set(socket.id, authenticatedUser);
        console.log(`User authenticated via JWT: ${authenticatedUser.name} (${socket.id})`);
        callback?.({ success: true, user: authenticatedUser });
        return;
      } catch (err) {
        callback?.({ error: 'Invalid or expired token' });
        return;
      }
    }

    // In development, accept user data directly
    if (!user || !user.id || !user.name) {
      callback?.({ error: 'Invalid user data' });
      return;
    }

    // Store authenticated user
    authenticatedUsers.set(socket.id, user);
    console.log(`User authenticated (dev mode): ${user.name} (${socket.id})`);

    callback?.({ success: true, user });
  });

  // Join a channel
  socket.on('join_channel', (payload, callback) => {
    // Check authentication
    if (!isAuthenticated(socket)) {
      callback?.({ error: 'Authentication required. Send auth event first.' });
      return;
    }

    if (!validateJoinChannel(payload)) {
      callback?.({ error: 'Invalid channelId' });
      return;
    }
    
    const { channelId } = payload;
    
    // Get authenticated user
    const user = getAuthenticatedUser(socket);
    if (!user) {
      callback?.({ error: 'User not authenticated' });
      return;
    }
    
    // Check if channel exists and user can access it
    const channel = getChannel(channelId);
    if (!channel) {
      // For development, allow joining non-existent channels
      console.log(`Channel ${channelId} does not exist, allowing in dev mode`);
    } else if (channel.isPrivate) {
      // Check if user is allowed to access this private channel
      if (!canAccessChannel(channelId, user.id)) {
        callback?.({ error: 'Access denied. This is a private channel.' });
        return;
      }
    }
    
    socket.join(channelId);
    
    // Track users in channel
    if (!channels.has(channelId)) {
      channels.set(channelId, new Set());
    }
    channels.get(channelId)?.add(socket.id);
    
    console.log(`Socket ${socket.id} joined channel ${channelId}`);
    
    // Send recent messages to the user (from shared store)
    const channelMessages = getMessages(channelId);
    socket.emit('message_history', channelMessages);
    
    // Emit channel_joined event for UI feedback
    socket.emit('channel_joined', { channelId });
    
    // Notify others
    socket.to(channelId).emit('user_joined', { socketId: socket.id });
    
    callback?.({ success: true });
  });

  // Leave a channel
  socket.on('leave_channel', (payload) => {
    if (!isAuthenticated(socket)) return;
    if (!payload || typeof payload !== 'object' || !('channelId' in payload)) return;
    
    const { channelId } = payload as { channelId: string };
    socket.leave(channelId);
    channels.get(channelId)?.delete(socket.id);
    
    socket.to(channelId).emit('user_left', { socketId: socket.id });
  });

  // Handle new message
  socket.on('send_message', (payload, callback) => {
    // Check authentication
    if (!isAuthenticated(socket)) {
      callback?.({ error: 'Authentication required. Send auth event first.' });
      return;
    }
    
    // Validate input
    if (!validateSendMessage(payload)) {
      callback?.({ error: 'Invalid message payload' });
      return;
    }
    
    const { channelId, content, author } = payload;
    
    // Additional check: validate length after sanitization to prevent bypass
    const sanitizedContent = sanitizeContent(content);
    if (sanitizedContent.length > 10000) {
      callback?.({ error: 'Content too long after sanitization (max 10000 chars)' });
      return;
    }
    
    // Use shared message store (with pre-sanitized content)
    const message = addMessage(channelId, sanitizedContent, sanitizeAuthor(author));
    
    // Broadcast to everyone in the channel including sender
    io.to(channelId).emit('message', message);
    
    console.log(`Message in ${channelId} from ${author.name}: ${content.substring(0, 50)}...`);
    
    callback?.({ success: true, message });
  });

  // Handle message edit (via REST API broadcast)
  socket.on('edit_message', (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback?.({ error: 'Authentication required' });
      return;
    }
    
    if (!payload || typeof payload !== 'object' || !payload.id || !payload.content) {
      callback?.({ error: 'Invalid edit payload' });
      return;
    }
    
    const { id, content } = payload;
    
    // Get authenticated user for authorization
    const user = getAuthenticatedUser(socket);
    const authorName = user?.name;
    const userId = user?.id;
    
    // Get the message first to check channel membership
    const existingMessage = getMessage(id);
    if (!existingMessage) {
      callback?.({ error: 'Message not found' });
      return;
    }
    
    // SECURITY: Verify user is a member of the message's channel
    // Check if socket is currently in the channel room
    const isInChannelRoom = socket.rooms.has(existingMessage.channelId);
    
    // Also check channel access (for private channels)
    const hasChannelAccess = canAccessChannel(existingMessage.channelId, userId || '');
    
    if (!isInChannelRoom && !hasChannelAccess) {
      callback?.({ error: 'You must be a member of this channel to edit messages' });
      return;
    }
    
    // Pass authorName for ownership verification
    const updatedMessage = editStoredMessage(id, sanitizeContent(content), authorName);
    
    if (!updatedMessage) {
      // Check if message exists but user is not the author
      if (existingMessage && authorName && existingMessage.author.name !== authorName) {
        callback?.({ error: 'Not authorized to edit this message' });
        return;
      }
      callback?.({ error: 'Message not found' });
      return;
    }
    
    io.to(updatedMessage.channelId).emit('message_edited', {
      ...updatedMessage,
      timestamp: new Date(updatedMessage.timestamp).toISOString()
    });
    
    callback?.({ success: true, message: updatedMessage });
  });

  // Handle message delete (via REST API broadcast)
  socket.on('delete_message', (payload, callback) => {
    if (!isAuthenticated(socket)) {
      callback?.({ error: 'Authentication required' });
      return;
    }
    
    if (!payload || typeof payload !== 'object' || !payload.id) {
      callback?.({ error: 'Invalid delete payload' });
      return;
    }
    
    const { id } = payload;
    
    // Get authenticated user for authorization
    const user = getAuthenticatedUser(socket);
    const authorName = user?.name;
    const userId = user?.id;
    
    // Get the message first to check channel membership
    const existingMessage = getMessage(id);
    if (!existingMessage) {
      callback?.({ error: 'Message not found' });
      return;
    }
    
    // SECURITY: Verify user is a member of the message's channel
    // Check if socket is currently in the channel room
    const isInChannelRoom = socket.rooms.has(existingMessage.channelId);
    
    // Also check channel access (for private channels)
    const hasChannelAccess = canAccessChannel(existingMessage.channelId, userId || '');
    
    if (!isInChannelRoom && !hasChannelAccess) {
      callback?.({ error: 'You must be a member of this channel to delete messages' });
      return;
    }
    
    // Pass authorName for ownership verification
    const deleted = deleteStoredMessage(id, authorName);
    
    if (!deleted) {
      // Check if message exists but user is not the author
      if (existingMessage && authorName && existingMessage.author.name !== authorName) {
        callback?.({ error: 'Not authorized to delete this message' });
        return;
      }
      callback?.({ error: 'Message not found' });
      return;
    }
    
    // Get channelId from the deleted message
    io.to(deleted.channelId).emit('message_deleted', { id });
    
    callback?.({ success: true });
  });

  // Typing indicator
  socket.on('typing', (payload) => {
    if (!isAuthenticated(socket)) return;
    if (!validateTyping(payload)) return;
    
    const { channelId, userId, isTyping } = payload;
    socket.to(channelId).emit('typing', { userId, isTyping });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Get user info before removing (for notification)
    const user = authenticatedUsers.get(socket.id);
    const userName = user?.name;
    
    // Remove from authenticated users
    authenticatedUsers.delete(socket.id);
    
    // Remove from all channels and notify members
    channels.forEach((socketIds, channelId) => {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        // Notify remaining users in the channel that this user left
        io.to(channelId).emit('user_left', { socketId: socket.id, userName });
      }
    });
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Colony server running on port ${PORT}`);
  console.log(`📡 Socket.io enabled`);
  console.log(`🔐 REST API enabled at /api/*`);
});
