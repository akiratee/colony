'use client';

import { useState, useEffect } from 'react';

interface Agent {
  id: string;
  name: string;
  role: string;
  avatar: string;
  description: string;
  model: string;
  status: 'online' | 'offline';
  capabilities?: string[];
  isCustom?: boolean; // Track custom agents added by user
}

// Load custom agents from localStorage
function loadCustomAgents(): Agent[] {
  if (typeof window === 'undefined') {return [];}
  try {
    const stored = localStorage.getItem('colony-custom-agents');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save custom agents to localStorage
function saveCustomAgents(agents: Agent[]): void {
  if (typeof window === 'undefined') {return;}
  localStorage.setItem('colony-custom-agents', JSON.stringify(agents));
}

export default function BotsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [newAgent, setNewAgent] = useState({ name: '', description: '', avatar: '🤖', role: 'Assistant' });
  const [spawning, setSpawning] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      // Load OpenClaw agents
      await fetchAgents();
      // Merge with custom agents from localStorage
      const customAgents = loadCustomAgents();
      if (customAgents.length > 0) {
        setAgents(prev => [...prev, ...customAgents]);
      }
    }
    loadAll();
  }, []);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        // API returns array directly, not { agents: [...] }
        if (Array.isArray(data)) {
          setAgents(data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSpawnAgent = async (agentId: string) => {
    setSpawning(agentId);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'spawn',
          agentId,
          task: 'Hello! I am ready to help. What would you like me to do?'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Agent spawned! Session: ${data.sessionKey}`);
        fetchAgents();
      } else {
        alert('Failed to spawn agent: ' + data.error);
      }
    } catch (e) {
      alert('Failed to spawn agent');
    } finally {
      setSpawning(null);
    }
  };

  const handleDespawnAgent = async (agentId: string) => {
    setSpawning(agentId);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'despawn',
          agentId
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Agent despawned!`);
        fetchAgents();
      } else {
        alert('Failed to despawn agent: ' + data.error);
      }
    } catch (e) {
      alert('Failed to despawn agent');
    } finally {
      setSpawning(null);
    }
  };

  const toggleAgentStatus = (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (agent?.status === 'offline') {
      handleSpawnAgent(id);
    } else {
      // Despawn the agent via API
      handleDespawnAgent(id);
    }
  };

  const handleAddAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgent.name.trim()) {return;}
    
    const agent: Agent = {
      id: `custom-${Date.now()}`,
      name: newAgent.name,
      role: newAgent.role,
      avatar: newAgent.avatar,
      description: newAgent.description,
      model: 'MiniMax M2.5',
      status: 'offline',
      isCustom: true,
    };
    
    // Save to localStorage for persistence
    const customAgents = loadCustomAgents();
    const updatedCustomAgents = [...customAgents, agent];
    saveCustomAgents(updatedCustomAgents);
    
    // Add to UI
    setAgents(prev => [...prev, agent]);
    setNewAgent({ name: '', description: '', avatar: '🤖', role: 'Assistant' });
    setShowAddForm(false);
  };

  const handleEditAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAgent || !editingAgent.name.trim()) {return;}
    
    // Update in localStorage
    const customAgents = loadCustomAgents();
    const updatedCustomAgents = customAgents.map(a => 
      a.id === editingAgent.id ? editingAgent : a
    );
    saveCustomAgents(updatedCustomAgents);
    
    // Update in UI
    setAgents(prev => prev.map(a => 
      a.id === editingAgent.id ? editingAgent : a
    ));
    setEditingAgent(null);
  };

  const handleDeleteAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent?.isCustom) {
      alert('Only custom agents can be deleted. OpenClaw agents are managed via AGENTS.md');
      return;
    }
    
    if (!confirm(`Delete agent "${agent.name}"?`)) {return;}
    
    // Remove from localStorage
    const customAgents = loadCustomAgents();
    const updatedCustomAgents = customAgents.filter(a => a.id !== agentId);
    saveCustomAgents(updatedCustomAgents);
    
    // Remove from UI
    setAgents(prev => prev.filter(a => a.id !== agentId));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-[var(--text-muted)]">Loading agents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a href="/" className="text-2xl">🐜</a>
              <div>
                <h1 className="text-xl font-bold">AI Agents</h1>
                <p className="text-sm text-[var(--text-muted)]">Manage your OpenClaw agents</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white font-semibold hover:bg-[var(--brand-primary-dark)] transition-all active:scale-[0.98] shadow-md"
            >
              + Add Agent
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Info Banner */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 These agents are connected to your OpenClaw installation. Toggle "Online" to spawn an agent session.
          </p>
        </div>

        {/* Agent List */}
        <div className="grid gap-4">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 hover:shadow-lg transition-all animate-fade-in"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center text-3xl">
                  {agent.avatar}
                </div>
                
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{agent.name}</h3>
                    <span className="text-xs text-[var(--text-muted)]">{agent.role}</span>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      agent.status === 'online' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {agent.status === 'online' ? '● Online' : '○ Offline'}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] mt-1">{agent.description}</p>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)]">
                      {agent.model}
                    </span>
                    {agent.capabilities?.slice(0, 3).map(cap => (
                      <span key={cap} className="text-xs px-2 py-1 bg-[var(--bg-tertiary)] rounded-lg text-[var(--text-muted)]">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAgentStatus(agent.id)}
                    disabled={spawning === agent.id}
                    className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
                  >
                    {spawning === agent.id ? '⏳' : agent.status === 'online' ? 'Disable' : 'Spawn'}
                  </button>
                  <button 
                    onClick={() => setEditingAgent(agent)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    Edit
                  </button>
                  {agent.isCustom && (
                    <button 
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="px-3 py-1.5 text-sm rounded-lg border border-red-200 dark:border-red-800 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {agents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
            <p className="text-[var(--text-muted)] mb-4">Add your first AI agent to get started</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold"
            >
              Add Your First Agent
            </button>
          </div>
        )}
      </main>

      {/* Add Agent Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <h2 className="text-xl font-bold mb-4">Add New Agent</h2>
            <form onSubmit={handleAddAgent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={newAgent.name}
                    onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                    placeholder="e.g., Code Review Bot"
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <input
                    type="text"
                    value={newAgent.role}
                    onChange={e => setNewAgent({ ...newAgent, role: e.target.value })}
                    placeholder="e.g., Assistant"
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newAgent.description}
                    onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                    placeholder="What does this agent do?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Avatar</label>
                  <div className="flex gap-2">
                    {['🤖', '🧪', '📚', '🔍', '💻', '🎨', '✨', '👨‍💻'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewAgent({ ...newAgent, avatar: emoji })}
                        className={`w-10 h-10 rounded-lg text-xl transition-all ${
                          newAgent.avatar === emoji 
                            ? 'bg-[var(--brand-primary)] text-white' 
                            : 'bg-[var(--bg-tertiary)] hover:scale-110'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-[var(--border-color)] font-semibold hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newAgent.name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold hover:bg-[var(--brand-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Add Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <h2 className="text-xl font-bold mb-4">Edit Agent</h2>
            <form onSubmit={handleEditAgent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={editingAgent.name}
                    onChange={e => setEditingAgent({ ...editingAgent, name: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <input
                    type="text"
                    value={editingAgent.role}
                    onChange={e => setEditingAgent({ ...editingAgent, role: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={editingAgent.description}
                    onChange={e => setEditingAgent({ ...editingAgent, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Avatar</label>
                  <div className="flex gap-2">
                    {['🤖', '🧪', '📚', '🔍', '💻', '🎨', '✨', '👨‍💻'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setEditingAgent({ ...editingAgent, avatar: emoji })}
                        className={`w-10 h-10 rounded-lg text-xl transition-all ${
                          editingAgent.avatar === emoji 
                            ? 'bg-[var(--brand-primary)] text-white' 
                            : 'bg-[var(--bg-tertiary)] hover:scale-110'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-[var(--border-color)] font-semibold hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editingAgent.name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold hover:bg-[var(--brand-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
