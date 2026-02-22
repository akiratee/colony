'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  connectSocket, 
  disconnectSocket, 
  sendMessage, 
  onMessage, 
  offMessage,
  onConnect,
  offConnect,
  onDisconnect,
  offDisconnect,
  onConnectError,
} from '@/lib/socket';

// Types
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

interface Channel {
  id: string;
  name: string;
  description?: string;
  isProject?: boolean;
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
}

// Active agents (persisted in localStorage for now)
const defaultAgents: Agent[] = [
  {
    id: '1',
    name: 'Rei',
    role: 'Product Manager',
    avatar: '✨',
    personality: 'Friendly',
    model: 'MiniMax M2.1',
    status: 'active',
    systemPrompt: 'You are Rei, a friendly and helpful AI assistant. You help with project management, coordination, and answering questions.'
  }
];

const defaultChannels: Channel[] = [
  { id: '1', name: 'general', description: 'General discussion' },
  { id: '2', name: 'p-colony', description: 'Colony project channel', isProject: true },
];

export default function ColonyPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [channel, setChannel] = useState<Channel>(defaultChannels[0]);
  const [channels, setChannels] = useState<Channel[]>(defaultChannels);
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);

  // New agent form state
  const [newAgent, setNewAgent] = useState({
    name: '',
    role: 'Assistant',
    avatar: '🤖',
    personality: 'Friendly',
    model: 'MiniMax M2.1',
    systemPrompt: ''
  });

  useEffect(() => {
    // Load agents from OpenClaw API (AGENTS.md)
    async function fetchAgents() {
      try {
        const res = await fetch('/api/agents');
        const data = await res.json();
        if (data.agents && data.agents.length > 0) {
          setAgents(data.agents);
        }
      } catch (e) {
        console.error('Failed to fetch agents:', e);
      }
    }

    fetchAgents();

    // Connect to socket
    try {
      connectSocket();
      onConnect(() => setIsConnected(true));
      onDisconnect(() => setIsConnected(false));
      
      onMessage((data: any) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          content: data.message,
          channelId: data.channel || '1',
          author: { name: data.author || 'Unknown', isBot: true },
          timestamp: new Date()
        }]);
      });
    } catch (e) {
      console.error('Socket connection failed:', e);
    }

    return () => {
      try {
        disconnectSocket();
        offMessage();
        offConnect();
        offDisconnect();
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      channelId: channel.id,
      author: { name: 'Vincent', avatar: '👨‍💻' },
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Send to socket for potential bot responses
    sendMessage(channel.id, input, { name: 'Vincent', avatar: '👨‍💻' });

    setInput('');
  };

  const handleCreateChannel = () => {
    if (!newChannelName.trim()) return;
    
    const newChannel: Channel = {
      id: Date.now().toString(),
      name: newChannelName.toLowerCase().replace(/\s+/g, '-'),
      description: `${newChannelName} channel`,
      isProject: newChannelName.startsWith('p-')
    };
    
    setChannels(prev => [...prev, newChannel]);
    setChannel(newChannel);
    setNewChannelName('');
    setShowChannelModal(false);
  };

  const handleCreateAgent = async () => {
    if (!newAgent.name.trim()) return;
    
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
      const data = await res.json();
      setAgents(data.agents || []);
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
      model: 'MiniMax M2.1',
      systemPrompt: ''
    });
    setShowAgentModal(false);
  };

  const channelMessages = messages.filter(m => m.channelId === channel.id);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#13131a] border-r border-[#27272a] flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-[#27272a]">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span>🐜</span> Colony
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-xs text-zinc-500">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
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
                channel.id === ch.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-zinc-400 hover:bg-[#27272a]'
              }`}
            >
              <span>#</span>
              <span>{ch.name}</span>
              {ch.isProject && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1 rounded">P</span>}
            </button>
          ))}

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
            <span className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">👨‍💻</span>
            <span>Vincent</span>
          </div>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Channel Header */}
        <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>#</span> {channel.name}
            </h2>
            {channel.description && (
              <p className="text-sm text-zinc-500">{channel.description}</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {channelMessages.length === 0 ? (
            <div className="text-center text-zinc-500 py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            channelMessages.map(msg => (
              <div key={msg.id} className="flex gap-3">
                <div className="w-8 h-8 bg-[#27272a] rounded-full flex items-center justify-center flex-shrink-0">
                  {msg.author.avatar || msg.author.name[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{msg.author.name}</span>
                    {msg.author.isBot && (
                      <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">Bot</span>
                    )}
                    <span className="text-xs text-zinc-500">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-zinc-300 mt-1">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-[#27272a]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message #${channel.name}...`}
              className="flex-1 bg-[#27272a] border-none rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    </div>
  );
}
