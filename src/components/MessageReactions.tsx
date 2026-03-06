'use client';

import React, { useState } from 'react';

// Common emojis for reactions
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀', '✅', '💯'];

// Backend stores reactions as { emoji, users: string[], count }
interface ReactionGroup {
  emoji: string;
  users: string[];
  count: number;
}

interface MessageReactionsProps {
  messageId: string;
  reactions: ReactionGroup[];
  currentUserName: string;
  onAddReaction: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
}

export default function MessageReactions({ 
  messageId, 
  reactions, 
  currentUserName,
  onAddReaction,
  onRemoveReaction 
}: MessageReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const hasUserReacted = (emoji: string) => {
    const reaction = reactions.find(r => r.emoji === emoji);
    return reaction ? reaction.users.includes(currentUserName) : false;
  };

  const getReactionTooltip = (emoji: string) => {
    const reaction = reactions.find(r => r.emoji === emoji);
    return reaction ? reaction.users.join(', ') : '';
  };

  const handleReactionClick = (emoji: string) => {
    if (hasUserReacted(emoji)) {
      onRemoveReaction(messageId, emoji);
    } else {
      onAddReaction(messageId, emoji);
    }
    setShowPicker(false);
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {/* Display existing reactions */}
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => handleReactionClick(reaction.emoji)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
            hasUserReacted(reaction.emoji) 
              ? 'bg-indigo-500/30 border border-indigo-500/50' 
              : 'bg-[#27272a] border border-transparent hover:border-zinc-500'
          }`}
          title={getReactionTooltip(reaction.emoji)}
        >
          <span>{reaction.emoji}</span>
          <span className="text-zinc-400">{reaction.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center justify-center w-6 h-6 rounded text-xs text-zinc-500 hover:text-white hover:bg-[#27272a] transition-colors"
          title="Add reaction"
        >
          😊
        </button>

        {/* Emoji picker dropdown */}
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 bg-[#1a1a24] border border-[#27272a] rounded-lg shadow-lg p-2 z-10">
            <div className="grid grid-cols-5 gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReactionClick(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-[#27272a] rounded transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Close picker when clicking outside */}
      {showPicker && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
