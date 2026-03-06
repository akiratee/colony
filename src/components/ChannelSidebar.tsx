'use client';

import React from 'react';
import { Channel, Bot } from './types';

interface ChannelSidebarProps {
  channels: Channel[];
  bots: Bot[];
  selectedChannelId: string;
  onSelectChannel: (channel: Channel) => void;
  isConnected: boolean;
  isConnecting: boolean;
}

export function ChannelSidebar({ 
  channels, 
  bots, 
  selectedChannelId, 
  onSelectChannel,
  isConnected,
  isConnecting 
}: ChannelSidebarProps) {
  return (
    <aside className="w-64 border-r border-[var(--border-color)] flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">🐜</span>
          <span>Colony</span>
        </h1>
        
        {/* Connection status */}
        <div className="flex items-center gap-2 mt-3">
          <span className={`w-2 h-2 rounded-full transition-colors ${
            isConnected ? 'bg-green-500' : isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <span className="text-xs text-[var(--text-muted)]">
            {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Channels */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">
            Channels
          </div>
          <div className="space-y-0.5">
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 ${
                  selectedChannelId === channel.id
                    ? 'bg-[var(--brand-primary)] text-white shadow-md'
                    : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                }`}
              >
                <span className="mr-1 opacity-70">#</span>
                {channel.name}
              </button>
            ))}
          </div>
        </div>

        {/* Bots */}
        <div>
          <div className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2 px-2">
            AI Agents
          </div>
          <div className="space-y-0.5">
            {bots.map(bot => (
              <div
                key={bot.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <span className="text-xl">{bot.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{bot.name}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{bot.description}</div>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  bot.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                }`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--border-color)]">
        <div className="text-xs text-center text-[var(--text-muted)]">
          Colony v0.1.0
        </div>
      </div>
    </aside>
  );
}
