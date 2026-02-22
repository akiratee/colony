// Colony Socket.io Server
// Run with: npx tsx server/index.ts

import { Server } from 'socket.io';
import { createServer } from 'http';

interface Message {
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

interface User {
  id: string;
  name: string;
  avatar?: string;
}

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    // TODO: Restrict to specific origins in production
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST'],
  },
});

// In-memory storage (replace with database in production)
const channels = new Map<string, Set<string>>(); // channelId -> set of userIds
const messages: Message[] = [];

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join a channel
  socket.on('join_channel', ({ channelId }, callback) => {
    if (!channelId || typeof channelId !== 'string') {
      callback?.({ error: 'Invalid channelId' });
      return;
    }
    
    socket.join(channelId);
    
    // Track users in channel
    if (!channels.has(channelId)) {
      channels.set(channelId, new Set());
    }
    channels.get(channelId)?.add(socket.id);
    
    console.log(`Socket ${socket.id} joined channel ${channelId}`);
    
    // Send recent messages to the user
    const channelMessages = messages.filter(m => m.channelId === channelId);
    socket.emit('message_history', channelMessages);
    
    // Notify others
    socket.to(channelId).emit('user_joined', { socketId: socket.id });
    
    callback?.({ success: true });
  });

  // Leave a channel
  socket.on('leave_channel', ({ channelId }) => {
    if (!channelId) return;
    
    socket.leave(channelId);
    channels.get(channelId)?.delete(socket.id);
    
    socket.to(channelId).emit('user_left', { socketId: socket.id });
  });

  // Handle new message
  socket.on('send_message', ({ channelId, content, author }, callback) => {
    // Validate input
    if (!channelId || typeof channelId !== 'string') {
      callback?.({ error: 'Invalid channelId' });
      return;
    }
    if (!content || typeof content !== 'string' || content.length > 10000) {
      callback?.({ error: 'Invalid content' });
      return;
    }
    
    const message: Message = {
      id: generateId(),
      content,
      channelId,
      author: author || { name: 'Anonymous' },
      timestamp: new Date(),
    };
    
    messages.push(message);
    
    // Broadcast to everyone in the channel including sender
    io.to(channelId).emit('message', message);
    
    console.log(`Message in ${channelId} from ${author?.name || 'Unknown'}: ${content.substring(0, 50)}...`);
    
    callback?.({ success: true, message });
  });

  // Typing indicator
  socket.on('typing', ({ channelId, userId, isTyping }) => {
    if (!channelId) return;
    socket.to(channelId).emit('typing', { userId, isTyping });
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove from all channels
    channels.forEach((users) => {
      users.delete(socket.id);
    });
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Colony Socket.io server running on port ${PORT}`);
});
