'use client';

import { useState, useEffect, useRef } from 'react';
import {
  connectSocket,
  sendMessage,
  onMessage,
  onConnect,
  onDisconnect,
  onConnectError,
  cleanupAll,
  joinChannel,
  leaveChannel,
  authenticateSocket,
  onTyping,
  sendTyping,
  onMessageEdited,
  onMessageDeleted,
} from '@/lib/socket';

// Types - imported from shared types
import type { Message as SharedMessage, Channel as SharedChannel, Agent as SharedAgent } from '@/lib/types';
import { formatMessage } from '@/lib/message-format';
import MessageReactions from '@/components/MessageReactions';

// Local type definitions (for UI-specific fields)
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
  reactions?: { emoji: string; users: string[]; count: number }[];
}

// Client-side validation helpers (matching server validation)
function validateChannelName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return { valid: false, error: 'Channel name is required' };
  }
  if (name.length > 50) {
    return { valid: false, error: 'Channel name too long (max 50 chars)' };
  }
  if (!/^[a-z0-9-]+$/.test(name.toLowerCase())) {
    return { valid: false, error: 'Channel name must be lowercase alphanumeric with hyphens' };
  }
  return { valid: true };
}

function sanitizeChannelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 50);
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  isProject?: boolean;
  isDirectMessage?: boolean;
  participantIds?: string[];
}

interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  personality: string;
  model: string;
  status: 'active' | 'inactive';
  systemPrompt?: string;
  description?: string;
}

// Active agents (persisted in localStorage for now)
const defaultAgents: Agent[] = [
  {
    id: '1',
    name: 'Rei',
    role: 'Product Manager',
    avatar: '✨',
    personality: 'Friendly',
    model: 'MiniMax M2.5',
    status: 'active',
    systemPrompt: 'You are Rei, a friendly and helpful AI assistant. You help with project management, coordination, and answering questions.'
  }
];

const defaultChannels: Channel[] = [
  { id: '1', name: 'general', description: 'General discussion' },
  { id: '2', name: 'p-colony', description: 'Colony project channel', isProject: true },
];

// Current user - in production would come from auth
const CURRENT_USER = {
  id: 'user-vincent',
  name: 'Vincent',
  avatar: '👨‍💻'
};

export default function ColonyPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previousChannelId, setPreviousChannelId] = useState<string | null>(null);
  const [directMessages, setDirectMessages] = useState<Channel[]>([]);
  const [showDmModal, setShowDmModal] = useState(false);
  const [newDmUserId, setNewDmUserId] = useState('');
  
  // Loading and error states
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingDms, setIsLoadingDms] = useState(false);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Message delivery status
  const [messageStatus, setMessageStatus] = useState<{ [messageId: string]: 'sending' | 'sent' | 'delivered' | 'failed' }>({});
  
  // Online status tracking (simulated for now - in production would come from socket presence)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set([CURRENT_USER.id]));
  
  // Track seen message IDs to prevent duplicates from socket broadcast
  const seenMessageIds = useRef<Set<string>>(new Set());
  
  // Message edit/delete state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  // Use ref to track current channel for socket message filtering (avoids stale closure)
  const channelRef = useRef(channel);
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  // Typing indicator state
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Track if we've sent "typing: true" to avoid duplicate events
  const hasSentTypingRef = useRef<{ [channelId: string]: boolean }>({});

  // New agent form state
  const [newAgent, setNewAgent] = useState({
    name: '',
    role: 'Assistant',
    avatar: '🤖',
    personality: 'Friendly',
    model: 'MiniMax M2.5',
    systemPrompt: ''
  });

  // Agent editing state
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    // Load channels from API
    async function fetchChannels() {
      setIsLoadingChannels(true);
      setError(null);
      try {
        const res = await fetch('/api/channels');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setChannels(data);
            // Set first channel as active if none selected
            if (!channel) {
              setChannel(data[0]);
            }
          } else {
            // Fallback to default channels if none exist
            setChannels(defaultChannels);
            if (!channel) {
              setChannel(defaultChannels[0]);
            }
          }
        } else {
          setError('Failed to load channels');
          // Fallback to default channels on error
          setChannels(defaultChannels);
          if (!channel) {
            setChannel(defaultChannels[0]);
          }
        }
      } catch (e) {
        console.error('Failed to fetch channels:', e);
        setError('Failed to connect to server');
        // Fallback to default channels on error
        setChannels(defaultChannels);
        if (!channel) {
          setChannel(defaultChannels[0]);
        }
      } finally {
        setIsLoadingChannels(false);
      }
    }

    // Load agents from OpenClaw API (AGENTS.md)
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          // API returns array directly, not { agents: [...] }
          if (Array.isArray(data) && data.length > 0) {
            setAgents(data);
          }
        }
      } catch (e) {
        console.error('Failed to fetch agents:', e);
        // Non-critical - agents are optional
      }
    }

    // Load direct messages with loading state
    async function fetchDirectMessages() {
      setIsLoadingDms(true);
      try {
        const res = await fetch('/api/direct-messages');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setDirectMessages(data);
          }
        }
      } catch (e) {
        console.error('Failed to fetch direct messages:', e);
        // Non-critical for main functionality
      } finally {
        setIsLoadingDms(false);
      }
    }

    fetchChannels();
    fetchAgents();
    fetchDirectMessages();

    // Fetch user presence from API
    async function fetchPresence() {
      try {
        const res = await fetch('/api/users/status');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            // Get user IDs with online status
            const onlineUserIds = data
              .filter((p: any) => p.status === 'online')
              .map((p: any) => p.userId);
            setOnlineUsers(new Set([CURRENT_USER.id, ...onlineUserIds]));
          }
        }
      } catch (e) {
        console.error('Failed to fetch presence:', e);
        // Non-critical - presence is optional
      }
    }
    fetchPresence();

    // Connect to socket and authenticate
    try {
      connectSocket();
      // Authenticate socket with user credentials
      authenticateSocket({ id: CURRENT_USER.id, name: CURRENT_USER.name, avatar: CURRENT_USER.avatar });
      
      onConnect(() => {
        setIsConnected(true);
        setConnectionError(null);
        // Set user as online in presence system
        fetch('/api/users/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: CURRENT_USER.id, userName: CURRENT_USER.name, status: 'online', platform: 'web' })
        }).catch(() => {}); // Silent fail
      });
      onDisconnect(() => {
        setIsConnected(false);
        // Mark user as offline in presence system
        fetch('/api/users/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: CURRENT_USER.id, userName: CURRENT_USER.name, status: 'offline' })
        }).catch(() => {}); // Silent fail
      });
      onConnectError((error: Error) => {
        setConnectionError(error.message || 'Connection failed');
        console.error('Socket connection error:', error);
      });

      onMessage((data: any) => {
        // Use ref to avoid stale closure - get current channel value
        const currentChannel = channelRef.current;
        
        // Ignore messages for different channels
        if (currentChannel && data.channelId !== currentChannel.id && data.channel !== currentChannel.id) {
          return;
        }
        
        // Prevent duplicate messages: socket broadcasts to everyone including sender,
        // so we skip if we already have a message with this ID (from optimistic update)
        const messageId = data.id || Date.now().toString();
        if (seenMessageIds.current.has(messageId)) {
          return; // Already have this message (from optimistic update or duplicate broadcast)
        }
        seenMessageIds.current.add(messageId);
        
        // Handle both socket.io message format and REST API format
        const content = data.content || data.message || '';
        const authorData = data.author || { name: 'Unknown' };
        setMessages(prev => [...prev, {
          id: messageId,
          content: content,
          channelId: data.channelId || data.channel || (currentChannel?.id || 'unknown'),
          author: {
            name: authorData.name || 'Unknown',
            avatar: authorData.avatar,
            isBot: authorData.isBot
          },
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date()
        }]);
      });

      // Typing indicator handler
      onTyping((data: { userId: string; isTyping: boolean }) => {
        // Ignore own typing indicator
        if (data.userId === CURRENT_USER.id) {return;}
        
        setTypingUsers(prev => {
          const next = new Set(prev);
          if (data.isTyping) {
            next.add(data.userId);
            // Auto-clear typing after 3 seconds
            setTimeout(() => {
              setTypingUsers(current => {
                const updated = new Set(current);
                updated.delete(data.userId);
                return updated;
              });
            }, 3000);
          } else {
            next.delete(data.userId);
          }
          return next;
        });
      });

      // Message edited handler
      onMessageEdited((data: any) => {
        const currentChannel = channelRef.current;
        // Ignore edits for different channels
        if (currentChannel && data.channelId !== currentChannel.id) {
          return;
        }
        // Update the message in local state
        setMessages(prev => prev.map(m => 
          m.id === data.id 
            ? { ...m, content: data.content, timestamp: new Date(data.timestamp) }
            : m
        ));
        // Cancel edit mode if editing this message
        if (editingMessageId === data.id) {
          setEditingMessageId(null);
          setEditContent('');
        }
      });

      // Message deleted handler
      onMessageDeleted((data: { id: string }) => {
        const currentChannel = channelRef.current;
        // Get the message first to check channel
        const message = messages.find(m => m.id === data.id);
        if (!message) {return;}
        // Ignore deletes for different channels
        if (currentChannel && message.channelId !== currentChannel.id) {
          return;
        }
        // Remove the message from local state
        setMessages(prev => prev.filter(m => m.id !== data.id));
        // Cancel edit mode if editing this message
        if (editingMessageId === data.id) {
          setEditingMessageId(null);
          setEditContent('');
        }
      });
    } catch (e) {
      console.error('Socket connection failed:', e);
    }

    return () => {
      try {
        cleanupAll();
      } catch (e) {
        // Ignore cleanup errors
      }
      // Cleanup typing timeout to prevent memory leaks
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Periodic presence refresh (every 30 seconds)
  useEffect(() => {
    const fetchPresence = async () => {
      try {
        const res = await fetch('/api/users/status');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const onlineUserIds = data
              .filter((p: any) => p.status === 'online')
              .map((p: any) => p.userId);
            setOnlineUsers(new Set([CURRENT_USER.id, ...onlineUserIds]));
          }
        }
      } catch (e) {
        // Silent fail for presence refresh
      }
    };

    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load message history when channel changes
  useEffect(() => {
    if (!channel?.id) {return;}

    const channelId = channel.id;
    
    // Clear seen IDs when switching channels
    seenMessageIds.current.clear();

    // Leave old channel and join new one when switching channels
    if (previousChannelId && previousChannelId !== channelId && isConnected) {
      leaveChannel(previousChannelId);
      joinChannel(channelId);
    }
    setPreviousChannelId(channelId);

    async function fetchChannelMessages() {
      setIsLoadingMessages(true);
      setError(null);
      try {
        const res = await fetch(`/api/messages?channelId=${channelId}&limit=50`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && Array.isArray(data.messages)) {
            // Track all loaded message IDs to prevent duplicates
            data.messages.forEach((m: any) => seenMessageIds.current.add(m.id));
            setMessages(data.messages.map((m: any) => ({
              id: m.id,
              content: m.content,
              channelId: m.channelId,
              author: m.author,
              timestamp: new Date(m.timestamp),
              reactions: m.reactions || []
            })));
          }
        } else {
          setError('Failed to load messages');
        }
      } catch (e) {
        console.error('Failed to fetch message history:', e);
        setError('Failed to load messages');
      } finally {
        setIsLoadingMessages(false);
      }
    }

    fetchChannelMessages();
  }, [channel?.id, isConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !channel) {return;}

    // Clear typing indicator when sending
    sendTyping(channel.id, CURRENT_USER.id, false);
    hasSentTypingRef.current[channel.id] = false;

    // Generate message ID upfront to track for deduplication
    const messageId = Date.now().toString();
    seenMessageIds.current.add(messageId);

    // Optimistic update - add message immediately with "sending" status
    const userMessage: Message = {
      id: messageId,
      content: input,
      channelId: channel.id,
      author: { name: CURRENT_USER.name, avatar: CURRENT_USER.avatar },
      timestamp: new Date()
    };

    // Set message status to sending
    setMessageStatus(prev => ({ ...prev, [messageId]: 'sending' }));
    setMessages(prev => [...prev, userMessage]);

    // Send via socket only - it both broadcasts to other users AND persists to messageStore
    // This avoids duplicate messages that would occur if we also called REST API
    sendMessage(channel.id, input, { name: CURRENT_USER.name, avatar: CURRENT_USER.avatar });

    // After a short delay, mark as sent (in production, would wait for server ACK)
    setTimeout(() => {
      setMessageStatus(prev => ({ ...prev, [messageId]: 'sent' }));
      // After another delay, mark as delivered (simulated)
      setTimeout(() => {
        setMessageStatus(prev => ({ ...prev, [messageId]: 'delivered' }));
      }, 1000);
    }, 300);

    setInput('');
  };

  // Handle input change with typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);
    
    // Send typing indicator (debounced, only send typing:true once per session)
    if (channel) {
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Only send "typing: true" if we haven't already for this channel
      // This reduces redundant socket events on each keystroke
      if (!hasSentTypingRef.current[channel.id]) {
        sendTyping(channel.id, CURRENT_USER.id, true);
        hasSentTypingRef.current[channel.id] = true;
      }
      
      // Send "typing: false" after 1 second of no typing
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(channel.id, CURRENT_USER.id, false);
        hasSentTypingRef.current[channel.id] = false;
      }, 1000);
    }
  };

  const handleCreateChannel = async () => {
    // Validate channel name client-side before creating
    const validation = validateChannelName(newChannelName);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const sanitizedName = sanitizeChannelName(newChannelName);

    // Check for duplicate channel names
    if (channels.some(ch => ch.name === sanitizedName)) {
      alert('Channel already exists');
      return;
    }

    // Create via API for persistence
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sanitizedName,
          description: `${newChannelName} channel`,
          isPrivate: false
        })
      });

      if (res.ok) {
        const newChannelFromApi = await res.json();
        setChannels(prev => [...prev, newChannelFromApi]);
        setChannel(newChannelFromApi);
      } else {
        // Fallback to local creation if API fails
        const newChannel: Channel = {
          id: Date.now().toString(),
          name: sanitizedName,
          description: `${newChannelName} channel`,
          isProject: newChannelName.startsWith('p-')
        };
        setChannels(prev => [...prev, newChannel]);
        setChannel(newChannel);
      }
    } catch (e) {
      console.error('Failed to create channel via API:', e);
      // Fallback to local creation
      const newChannel: Channel = {
        id: Date.now().toString(),
        name: sanitizedName,
        description: `${newChannelName} channel`,
        isProject: newChannelName.startsWith('p-')
      };
      setChannels(prev => [...prev, newChannel]);
      setChannel(newChannel);
    }

    setNewChannelName('');
    setShowChannelModal(false);
  };

  // Handle creating a direct message
  const handleCreateDm = async () => {
    if (!newDmUserId.trim()) {
      alert('Please enter a user ID');
      return;
    }

    if (newDmUserId === CURRENT_USER.id) {
      alert('Cannot create DM with yourself');
      return;
    }

    try {
      const res = await fetch('/api/direct-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: newDmUserId })
      });

      if (res.ok) {
        const newDm = await res.json();
        setDirectMessages(prev => {
          // Avoid duplicates
          if (prev.some(dm => dm.id === newDm.id)) {
            return prev;
          }
          return [...prev, newDm];
        });
        setChannel(newDm);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create DM');
        return;
      }
    } catch (e) {
      console.error('Failed to create DM:', e);
      alert('Failed to create DM');
      return;
    }

    setNewDmUserId('');
    setShowDmModal(false);
  };

  const handleCreateAgent = async () => {
    if (!newAgent.name.trim()) {return;}

    const agent: Agent = {
      id: Date.now().toString(),
      name: newAgent.name,
      role: newAgent.role,
      avatar: newAgent.avatar,
      personality: newAgent.personality,
      model: newAgent.model,
      status: 'active',
      systemPrompt: newAgent.systemPrompt
    };

    try {
      // Save to API (will persist to file and update AGENTS.md)
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent)
      });

      // Refresh agents list
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        // API returns array directly, not { agents: [...] }
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to save agent:', e);
      // Fallback to localStorage
      const updatedAgents = [...agents, agent];
      setAgents(updatedAgents);
      localStorage.setItem('colony-agents', JSON.stringify(updatedAgents));
    }

    setNewAgent({
      name: '',
      role: 'Assistant',
      avatar: '🤖',
      personality: 'Friendly',
      model: 'MiniMax M2.5',
      systemPrompt: ''
    });
    setShowAgentModal(false);
  };

  // Handle agent edit - open edit modal
  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
  };

  // Handle agent edit - save changes
  const handleSaveAgent = async () => {
    if (!editingAgent) {return;}

    try {
      const res = await fetch('/api/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: editingAgent.id,
          name: editingAgent.name,
          role: editingAgent.role,
          avatar: editingAgent.avatar,
          description: editingAgent.description,
          personality: editingAgent.personality,
          model: editingAgent.model
        })
      });

      if (res.ok) {
        // Update local state
        setAgents(prev => prev.map(a => 
          a.id === editingAgent.id ? editingAgent : a
        ));
      }
    } catch (e) {
      console.error('Failed to update agent:', e);
      // Still update local state even if API fails
      setAgents(prev => prev.map(a => 
        a.id === editingAgent.id ? editingAgent : a
      ));
    }

    setEditingAgent(null);
  };

  // Handle message edit - enter edit mode
  const handleStartEdit = (messageId: string, content: string) => {
    setEditingMessageId(messageId);
    setEditContent(content);
  };

  // Handle message edit - cancel
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent('');
  };

  // Handle message edit - save changes
  const handleSaveEdit = async (messageId: string) => {
    if (!editContent.trim()) {
      alert('Message cannot be empty');
      return;
    }

    try {
      const res = await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: messageId,
          content: editContent,
          authorName: CURRENT_USER.name
        })
      });

      if (res.ok) {
        const updatedMessage = await res.json();
        // Update local state
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, content: updatedMessage.content, timestamp: new Date(updatedMessage.timestamp) }
            : m
        ));
        setEditingMessageId(null);
        setEditContent('');
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to edit message');
      }
    } catch (e) {
      console.error('Failed to edit message:', e);
      alert('Failed to edit message');
    }
  };

  // Handle message delete
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      const res = await fetch(`/api/messages?id=${messageId}&authorName=${encodeURIComponent(CURRENT_USER.name)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // Remove from local state
        setMessages(prev => prev.filter(m => m.id !== messageId));
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to delete message');
      }
    } catch (e) {
      console.error('Failed to delete message:', e);
      alert('Failed to delete message');
    }
  };

  // Handle adding a reaction to a message
  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      const res = await fetch('/api/messages/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          emoji,
          userName: CURRENT_USER.name
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update the message with the new reactions
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, reactions: data.reactions } 
            : m
        ));
      } else {
        console.error('Failed to add reaction');
      }
    } catch (e) {
      console.error('Failed to add reaction:', e);
    }
  };

  // Handle removing a reaction from a message (toggle off)
  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    // For now, we just add the reaction again - the backend toggles
    // In a full implementation, we'd have a separate DELETE endpoint
    try {
      const res = await fetch('/api/messages/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId,
          emoji,
          userName: CURRENT_USER.name
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Update the message with the new reactions
        setMessages(prev => prev.map(m => 
          m.id === messageId 
            ? { ...m, reactions: data.reactions } 
            : m
        ));
      } else {
        console.error('Failed to remove reaction');
      }
    } catch (e) {
      console.error('Failed to remove reaction:', e);
    }
  };

  const channelMessages = channel ? messages.filter(m => m.channelId === channel.id) : [];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Sidebar */}
      <div className={`w-64 bg-[#13131a] border-r border-[#27272a] flex flex-col hidden md:flex fixed md:relative z-50 h-full transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Logo */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>🐜</span> Colony
          </h1>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400">✕</button>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-xs text-zinc-500">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {connectionError && (
            <div className="text-xs text-red-400 mt-1" title={connectionError}>
              Error: {connectionError.length > 30 ? connectionError.slice(0, 30) + '...' : connectionError}
            </div>
          )}
        </div>

        {/* Channels */}
        <div className="flex-1 overflow-auto p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Channels</span>
            <button
              onClick={() => setShowChannelModal(true)}
              className="text-zinc-500 hover:text-white text-xs"
            >
              +
            </button>
          </div>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${
                channel?.id === ch.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:bg-[#27272a]'
              }`}
            >
              <span>#</span>
              <span>{ch.name}</span>
              {ch.isProject && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1 rounded">P</span>}
            </button>
          ))}

          {/* Direct Messages */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase">Direct Messages</span>
              <button
                onClick={() => setShowDmModal(true)}
                className="text-zinc-500 hover:text-white text-xs"
              >
                +
              </button>
            </div>
            {isLoadingDms ? (
              <div className="px-3 py-2 text-xs text-zinc-500">Loading...</div>
            ) : directMessages.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-600">No DMs yet</div>
            ) : (
              directMessages.map(dm => {
                // Get the other participant's ID (not current user)
                const otherParticipantId = dm.participantIds?.find(id => id !== CURRENT_USER.id) || 'unknown';
                const isOnline = onlineUsers.has(otherParticipantId);
                return (
                  <button
                    key={dm.id}
                    onClick={() => setChannel(dm)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${
                      channel?.id === dm.id
                        ? 'bg-indigo-600 text-white'
                        : 'text-zinc-400 hover:bg-[#27272a]'
                    }`}
                  >
                    <span className="relative">
                      <span>💬</span>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#13131a] ${isOnline ? 'bg-green-500' : 'bg-zinc-500'}`}></span>
                    </span>
                    <span className="truncate">{otherParticipantId}</span>
                    <span className={`ml-auto text-xs ${isOnline ? 'text-green-500' : 'text-zinc-600'}`}>
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* AI Agents - Read from OpenClaw + Custom */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-xs font-semibold text-zinc-500 uppercase">AI Agents</span>
              <button
                onClick={() => setShowAgentModal(true)}
                className="text-zinc-500 hover:text-white text-xs"
              >
                +
              </button>
            </div>
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => handleEditAgent(agent)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-zinc-400 hover:bg-[#27272a]"
              >
                <span>{agent.avatar}</span>
                <span>{agent.name}</span>
                <span className="text-xs text-zinc-500">({agent.role})</span>
                <span className={`w-2 h-2 rounded-full ml-auto ${agent.status === 'active' ? 'bg-green-500' : 'bg-zinc-500'}`}></span>
              </button>
            ))}
          </div>
        </div>

        {/* User */}
        <div className="p-4 border-t border-[#27272a]">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">{CURRENT_USER.avatar}</span>
            <span>{CURRENT_USER.name}</span>
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden p-3 border-b border-[#27272a] flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="text-zinc-400">☰</button>
          <span className="font-medium">
              {channel?.isDirectMessage 
                ? `💬 ${channel.participantIds?.find(id => id !== CURRENT_USER.id) || 'DM'}`
                : `# ${channel?.name || 'loading...'}`}
            </span>
        </div>

        {/* Desktop Channel Header */}
        <div className="hidden md:flex p-4 border-b border-[#27272a] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {channel?.isDirectMessage ? (
                <>
                  <span>💬</span>
                  <span>{channel.participantIds?.find(id => id !== CURRENT_USER.id) || 'DM'}</span>
                </>
              ) : (
                <>
                  <span>#</span> {channel?.name || 'loading...'}
                </>
              )}
            </h2>
            {channel?.description && !channel.isDirectMessage && (
              <p className="text-sm text-zinc-500">{channel.description}</p>
            )}
            {channel?.isDirectMessage && (
              <p className="text-sm text-zinc-500">Direct message</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm">
              {error}
              <button onClick={() => setError(null)} className="ml-2 hover:text-red-300">✕</button>
            </div>
          )}
          
          {isLoadingMessages ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-zinc-500">
                <span className="animate-spin">⏳</span>
                <span>Loading messages...</span>
              </div>
            </div>
          ) : channelMessages.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              {channel?.isDirectMessage ? (
                <>
                  <div className="text-4xl mb-2">💬</div>
                  <p>No messages yet.</p>
                  <p className="text-sm mt-1">Start a conversation with {channel.participantIds?.find(id => id !== CURRENT_USER.id) || 'this user'}!</p>
                </>
              ) : (
                <>
                  <div className="text-4xl mb-2">#</div>
                  <p>No messages yet.</p>
                  <p className="text-sm mt-1">Be the first to send a message in #{channel?.name}!</p>
                </>
              )}
            </div>
          ) : (
            channelMessages.map(msg => {
              const status = messageStatus[msg.id];
              const isOwnMessage = msg.author.name === CURRENT_USER.name;
              const isEditing = editingMessageId === msg.id;
              return (
                <div key={msg.id} className="flex gap-3 group">
                  <div className="w-8 h-8 bg-[#27272a] rounded-full flex items-center justify-center flex-shrink-0">
                    {msg.author.avatar || msg.author.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{msg.author.name}</span>
                      {msg.author.isBot && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Bot</span>
                      )}
                      <span className="text-xs text-zinc-500">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOwnMessage && status && (
                        <span className={`text-xs ${
                          status === 'sending' ? 'text-yellow-500' :
                          status === 'sent' ? 'text-zinc-400' :
                          status === 'delivered' ? 'text-green-500' :
                          'text-red-500'
                        }`}>
                          {status === 'sending' ? '⏳' :
                           status === 'sent' ? '✓' :
                           status === 'delivered' ? '✓✓' :
                           '!'}
                        </span>
                      )}
                      {/* Edit/Delete buttons for own messages */}
                      {isOwnMessage && !isEditing && (
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                          <button
                            onClick={() => handleStartEdit(msg.id, msg.content)}
                            className="text-xs text-zinc-500 hover:text-zinc-300 px-1"
                            title="Edit message"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-xs text-zinc-500 hover:text-red-400 px-1"
                            title="Delete message"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditing ? (
                      <div className="mt-1">
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full bg-[#27272a] border border-indigo-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {handleSaveEdit(msg.id);}
                            if (e.key === 'Escape') {handleCancelEdit();}
                          }}
                          autoFocus
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleSaveEdit(msg.id)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-xs text-zinc-400 hover:text-white px-2 py-1"
                          >
                            Cancel
                          </button>
                          <span className="text-xs text-zinc-500">Press Enter to save, Esc to cancel</span>
                        </div>
                      </div>
                    ) : (
                      <p 
                        className="text-zinc-300 mt-1" 
                        dangerouslySetInnerHTML={{ __html: formatMessage(msg.content) }}
                      />
                    )}
                    {/* Message Reactions */}
                    <MessageReactions
                      messageId={msg.id}
                      reactions={msg.reactions || []}
                      currentUserName={CURRENT_USER.name}
                      onAddReaction={handleAddReaction}
                      onRemoveReaction={handleRemoveReaction}
                    />
                  </div>
                </div>
              );
            })
          )}
          {/* Typing indicator */}
          {typingUsers.size > 0 && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm animate-pulse">
              <span>•</span>
              <span>•</span>
              <span>•</span>
              <span>{Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-[#27272a]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder={`Message ${channel?.isDirectMessage ? (channel.participantIds?.find(id => id !== CURRENT_USER.id) || 'DM') : '#' + (channel?.name || '...')}...`}
              className="flex-1 bg-[#27272a] border-none rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={!channel}
            />
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium"
            >
              Send
            </button>
          </div>
        </form>
      </div>

      {/* Agent Creation Modal */}
      {showAgentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] rounded-xl max-w-lg w-full p-6 border border-[#27272a]">
            <h2 className="text-xl font-bold mb-4">Create New Agent</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({...newAgent, name: e.target.value})}
                  className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Yilong"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Role</label>
                  <select
                    value={newAgent.role}
                    onChange={(e) => setNewAgent({...newAgent, role: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>Assistant</option>
                    <option>Senior Engineer</option>
                    <option>QA Tester</option>
                    <option>Product Manager</option>
                    <option>Researcher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Model</label>
                  <select
                    value={newAgent.model}
                    onChange={(e) => setNewAgent({...newAgent, model: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>MiniMax M2.5</option>
                    <option>Claude Sonnet</option>
                    <option>GPT-4</option>
                    <option>Gemini Pro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Personality</label>
                  <select
                    value={newAgent.personality}
                    onChange={(e) => setNewAgent({...newAgent, personality: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>Friendly</option>
                    <option>Direct</option>
                    <option>Concise</option>
                    <option>Formal</option>
                    <option>Witty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Avatar</label>
                  <select
                    value={newAgent.avatar}
                    onChange={(e) => setNewAgent({...newAgent, avatar: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>🤖</option>
                    <option>👨‍💻</option>
                    <option>👩‍🔬</option>
                    <option>👨‍🔧</option>
                    <option>🧪</option>
                    <option>📋</option>
                    <option>✨</option>
                    <option>🦁</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">System Prompt</label>
                <textarea
                  value={newAgent.systemPrompt}
                  onChange={(e) => setNewAgent({...newAgent, systemPrompt: e.target.value})}
                  className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white h-24"
                  placeholder="Instructions for the agent..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowAgentModal(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAgent}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Create Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Edit Modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] rounded-xl max-w-lg w-full p-6 border border-[#27272a]">
            <h2 className="text-xl font-bold mb-4">Edit Agent: {editingAgent.name}</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editingAgent.name}
                  onChange={(e) => setEditingAgent({...editingAgent, name: e.target.value})}
                  className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Role</label>
                  <select
                    value={editingAgent.role}
                    onChange={(e) => setEditingAgent({...editingAgent, role: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>Assistant</option>
                    <option>Senior Engineer</option>
                    <option>QA Tester</option>
                    <option>Product Manager</option>
                    <option>Researcher</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Model</label>
                  <select
                    value={editingAgent.model}
                    onChange={(e) => setEditingAgent({...editingAgent, model: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>MiniMax M2.5</option>
                    <option>MiniMax M2.1</option>
                    <option>Claude Sonnet</option>
                    <option>GPT-4</option>
                    <option>Gemini Pro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Personality</label>
                  <select
                    value={editingAgent.personality || 'Friendly'}
                    onChange={(e) => setEditingAgent({...editingAgent, personality: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>Friendly</option>
                    <option>Direct</option>
                    <option>Concise</option>
                    <option>Formal</option>
                    <option>Witty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Avatar</label>
                  <select
                    value={editingAgent.avatar}
                    onChange={(e) => setEditingAgent({...editingAgent, avatar: e.target.value})}
                    className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                  >
                    <option>🤖</option>
                    <option>👨‍💻</option>
                    <option>👩‍🔬</option>
                    <option>👨‍🔧</option>
                    <option>🧪</option>
                    <option>📋</option>
                    <option>✨</option>
                    <option>🦁</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Description</label>
                <textarea
                  value={editingAgent.description || ''}
                  onChange={(e) => setEditingAgent({...editingAgent, description: e.target.value})}
                  className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white h-20"
                  placeholder="Agent description..."
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setEditingAgent(null)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAgent}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Creation Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] rounded-xl max-w-md w-full p-6 border border-[#27272a]">
            <h2 className="text-xl font-bold mb-4">Create Channel</h2>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Channel Name</label>
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                placeholder="e.g., p-colony or random"
              />
              <p className="text-xs text-zinc-500 mt-1">Use "p-" prefix for project channels</p>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowChannelModal(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateChannel}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Message Creation Modal */}
      {showDmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a24] rounded-xl max-w-md w-full p-6 border border-[#27272a]">
            <h2 className="text-xl font-bold mb-4">Start Direct Message</h2>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">User ID</label>
              <input
                type="text"
                value={newDmUserId}
                onChange={(e) => setNewDmUserId(e.target.value)}
                className="w-full bg-[#27272a] border-none rounded-lg px-4 py-2 text-white"
                placeholder="e.g., user-john"
              />
              <p className="text-xs text-zinc-500 mt-1">Enter the user ID you want to message</p>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowDmModal(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDm}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                Start DM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
