// Message Polls Store
// Provides poll creation and voting functionality for messages

import { generateId } from './id';

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // Array of user names who voted for this option
}

export interface Poll {
  id: string;
  messageId: string;
  question: string;
  options: PollOption[];
  createdBy: string; // User name who created the poll
  createdAt: Date;
  isMultiVote: boolean; // Allow multiple selections
  isClosed: boolean;
}

// In-memory poll store
let polls: Poll[] = [];

// Reset for testing
export function __resetForTesting(): void {
  polls = [];
}

/**
 * Create a new poll attached to a message
 */
export function createPoll(
  messageId: string,
  question: string,
  options: string[],
  createdBy: string,
  isMultiVote: boolean = false
): Poll {
  const poll: Poll = {
    id: generateId(),
    messageId,
    question,
    options: options.map(text => ({
      id: generateId(),
      text,
      votes: [],
    })),
    createdBy,
    createdAt: new Date(),
    isMultiVote,
    isClosed: false,
  };
  
  polls.push(poll);
  return poll;
}

/**
 * Get poll by ID
 */
export function getPoll(pollId: string): Poll | undefined {
  return polls.find(p => p.id === pollId);
}

/**
 * Get poll by message ID
 */
export function getPollByMessageId(messageId: string): Poll | undefined {
  return polls.find(p => p.messageId === messageId);
}

/**
 * Vote on a poll option
 */
export function voteOnPoll(
  pollId: string,
  optionId: string,
  userName: string
): Poll | null {
  const poll = getPoll(pollId);
  
  if (!poll) {
    return null;
  }
  
  if (poll.isClosed) {
    return null;
  }
  
  const option = poll.options.find(o => o.id === optionId);
  
  if (!option) {
    return null;
  }
  
  // Check if user already voted
  const hasVoted = option.votes.includes(userName);
  
  if (hasVoted) {
    // Remove vote (toggle off)
    option.votes = option.votes.filter(v => v !== userName);
  } else {
    // If multi-vote is disabled, remove all other votes from this user
    if (!poll.isMultiVote) {
      poll.options.forEach(opt => {
        opt.votes = opt.votes.filter(v => v !== userName);
      });
    }
    // Add vote
    option.votes.push(userName);
  }
  
  return poll;
}

/**
 * Close a poll (prevent new votes)
 */
export function closePoll(pollId: string): Poll | null {
  const poll = getPoll(pollId);
  
  if (!poll) {
    return null;
  }
  
  poll.isClosed = true;
  return poll;
}

/**
 * Get all polls
 */
export function getAllPolls(): Poll[] {
  return [...polls];
}

/**
 * Get total vote count for a poll
 */
export function getPollVoteCount(pollId: string): number {
  const poll = getPoll(pollId);
  
  if (!poll) {
    return 0;
  }
  
  return poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
}

/**
 * Check if user has voted on a poll
 */
export function hasUserVoted(pollId: string, userName: string): boolean {
  const poll = getPoll(pollId);
  
  if (!poll) {
    return false;
  }
  
  return poll.options.some(opt => opt.votes.includes(userName));
}

/**
 * Get user's voted options
 */
export function getUserVotedOptions(pollId: string, userName: string): string[] {
  const poll = getPoll(pollId);
  
  if (!poll) {
    return [];
  }
  
  return poll.options
    .filter(opt => opt.votes.includes(userName))
    .map(opt => opt.id);
}
