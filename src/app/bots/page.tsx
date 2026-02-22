'use client';

import { useState } from 'react';
import { Bot } from '@/types';

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([
    { id: '1', name: 'CodeReview Bot', description: 'Reviews pull requests', avatar: '🤖', status: 'online' },
    { id: '2', name: 'Test Bot', description: 'Runs automated tests', avatar: '🧪', status: 'online' },
    { id: '3', name: 'Docs Bot', description: 'Answers questions about docs', avatar: '📚', status: 'offline' },
  ]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBot, setNewBot] = useState({ name: '', description: '', avatar: '🤖' });

  const handleAddBot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBot.name.trim()) return;
    
    const bot: Bot = {
      id: Date.now().toString(),
      ...newBot,
      status: 'offline',
    };
    
    setBots([...bots, bot]);
    setNewBot({ name: '', description: '', avatar: '🤖' });
    setShowAddForm(false);
  };

  const toggleBotStatus = (id: string) => {
    setBots(bots.map(bot => 
      bot.id === id 
        ? { ...bot, status: bot.status === 'online' ? 'offline' : 'online' }
        : bot
    ));
  };

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
                <p className="text-sm text-[var(--text-muted)]">Manage your bot team</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white font-semibold hover:bg-[var(--brand-primary-dark)] transition-all active:scale-[0.98] shadow-md"
            >
              + Add Bot
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Bot List */}
        <div className="grid gap-4">
          {bots.map(bot => (
            <div
              key={bot.id}
              className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-color)] p-5 hover:shadow-lg transition-all animate-fade-in"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center text-3xl">
                  {bot.avatar}
                </div>
                
                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">{bot.name}</h3>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      bot.status === 'online' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {bot.status === 'online' ? '● Online' : '○ Offline'}
                    </span>
                  </div>
                  <p className="text-[var(--text-muted)] mt-1">{bot.description}</p>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleBotStatus(bot.id)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    {bot.status === 'online' ? 'Disable' : 'Enable'}
                  </button>
                  <button className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border-color)] hover:bg-[var(--bg-tertiary)] transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {bots.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold mb-2">No bots yet</h3>
            <p className="text-[var(--text-muted)] mb-4">Add your first AI agent to get started</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold"
            >
              Add Your First Bot
            </button>
          </div>
        )}
      </main>

      {/* Add Bot Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-secondary)] rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
            <h2 className="text-xl font-bold mb-4">Add New Bot</h2>
            <form onSubmit={handleAddBot}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Bot Name</label>
                  <input
                    type="text"
                    value={newBot.name}
                    onChange={e => setNewBot({ ...newBot, name: e.target.value })}
                    placeholder="e.g., Code Review Bot"
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newBot.description}
                    onChange={e => setNewBot({ ...newBot, description: e.target.value })}
                    placeholder="What does this bot do?"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--border-color)] focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[var(--brand-primary)]/20 outline-none transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Avatar</label>
                  <div className="flex gap-2">
                    {['🤖', '🧪', '📚', '🔍', '💻', '🎨'].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewBot({ ...newBot, avatar: emoji })}
                        className={`w-10 h-10 rounded-lg text-xl transition-all ${
                          newBot.avatar === emoji 
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
                  disabled={!newBot.name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold hover:bg-[var(--brand-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Add Bot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
