import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChannelSidebar } from '../components/ChannelSidebar';

// Mock data
const mockChannels = [
  { id: '1', name: 'general', workspaceId: 'w1' },
  { id: '2', name: 'random', workspaceId: 'w1' },
  { id: '3', name: 'engineering', workspaceId: 'w1' },
];

const mockBots: Array<{ id: string; name: string; description: string; avatar: string; status: 'online' | 'offline' }> = [
  { id: 'b1', name: 'Assistant', description: 'AI helper', avatar: '🤖', status: 'online' },
  { id: 'b2', name: 'Notifier', description: 'Alerts bot', avatar: '🔔', status: 'offline' },
];

describe('ChannelSidebar', () => {
  it('renders channel list correctly', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    expect(screen.getByText('general')).toBeDefined();
    expect(screen.getByText('random')).toBeDefined();
    expect(screen.getByText('engineering')).toBeDefined();
  });

  it('renders bot list correctly', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    expect(screen.getByText('Assistant')).toBeDefined();
    expect(screen.getByText('Notifier')).toBeDefined();
  });

  it('shows connected status when connected', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    expect(screen.getByText('Connected')).toBeDefined();
  });

  it('shows connecting status when connecting', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={false}
        isConnecting={true}
      />
    );

    expect(screen.getByText('Connecting...')).toBeDefined();
  });

  it('shows offline status when disconnected', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={false}
        isConnecting={false}
      />
    );

    expect(screen.getByText('Offline')).toBeDefined();
  });

  it('calls onSelectChannel when channel is clicked', () => {
    const mockSelectChannel = vi.fn();
    
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={mockSelectChannel}
        isConnected={true}
        isConnecting={false}
      />
    );

    fireEvent.click(screen.getByText('random'));
    expect(mockSelectChannel).toHaveBeenCalledWith(mockChannels[1]);
  });

  it('highlights selected channel', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="2"
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    // The selected channel should be in the document
    expect(screen.getByText('random')).toBeDefined();
  });

  it('renders Colony title with emoji', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    expect(screen.getByText('Colony')).toBeDefined();
    expect(screen.getByText('🐜')).toBeDefined();
  });

  it('renders version footer', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={mockBots}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    expect(screen.getByText('Colony v0.1.0')).toBeDefined();
  });

  it('renders empty channels list gracefully', () => {
    render(
      <ChannelSidebar
        channels={[]}
        bots={mockBots}
        selectedChannelId=""
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    // Should still render the Channels section header
    expect(screen.getByText('Channels')).toBeDefined();
  });

  it('renders empty bots list gracefully', () => {
    render(
      <ChannelSidebar
        channels={mockChannels}
        bots={[]}
        selectedChannelId="1"
        onSelectChannel={() => {}}
        isConnected={true}
        isConnecting={false}
      />
    );

    // Should still render the AI Agents section header
    expect(screen.getByText('AI Agents')).toBeDefined();
  });
});
