import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPoll,
  getPoll,
  getPollByMessageId,
  voteOnPoll,
  closePoll,
  getAllPolls,
  getPollVoteCount,
  hasUserVoted,
  getUserVotedOptions,
  __resetForTesting
} from '@/lib/message-polls';

describe('Message Polls', () => {
  beforeEach(() => {
    __resetForTesting();
  });
  
  describe('createPoll', () => {
    it('should create a poll with multiple options', () => {
      const poll = createPoll(
        'msg-123',
        'What should we have for lunch?',
        ['Pizza', 'Burgers', 'Sushi'],
        'Vincent'
      );
      
      expect(poll.messageId).toBe('msg-123');
      expect(poll.question).toBe('What should we have for lunch?');
      expect(poll.options).toHaveLength(3);
      expect(poll.options[0].text).toBe('Pizza');
      expect(poll.createdBy).toBe('Vincent');
      expect(poll.isMultiVote).toBe(false);
      expect(poll.isClosed).toBe(false);
      expect(poll.id).toBeDefined();
    });
    
    it('should create a poll with multi-vote enabled', () => {
      const poll = createPoll(
        'msg-456',
        'Select your top 3',
        ['Option A', 'Option B', 'Option C', 'Option D'],
        'Vincent',
        true
      );
      
      expect(poll.isMultiVote).toBe(true);
    });
    
    it('should generate unique IDs for options', () => {
      const poll = createPoll(
        'msg-123',
        'Test question?',
        ['A', 'B', 'C'],
        'Vincent'
      );
      
      const optionIds = poll.options.map(o => o.id);
      const uniqueIds = new Set(optionIds);
      expect(uniqueIds.size).toBe(3);
    });
  });
  
  describe('getPoll', () => {
    it('should return poll by ID', () => {
      const created = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      const found = getPoll(created.id);
      
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });
    
    it('should return undefined for non-existent poll', () => {
      const found = getPoll('non-existent-id');
      expect(found).toBeUndefined();
    });
  });
  
  describe('getPollByMessageId', () => {
    it('should return poll by message ID', () => {
      createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      const found = getPollByMessageId('msg-123');
      
      expect(found).toBeDefined();
      expect(found?.messageId).toBe('msg-123');
    });
    
    it('should return undefined for message without poll', () => {
      const found = getPollByMessageId('msg-no-poll');
      expect(found).toBeUndefined();
    });
  });
  
  describe('voteOnPoll', () => {
    it('should add a vote for a user', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      const optionId = poll.options[0].id;
      
      const updated = voteOnPoll(poll.id, optionId, 'Yilong');
      
      expect(updated?.options[0].votes).toContain('Yilong');
      expect(updated?.options[0].votes).toHaveLength(1);
    });
    
    it('should toggle off vote when user votes again', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      const optionId = poll.options[0].id;
      
      // First vote
      voteOnPoll(poll.id, optionId, 'Yilong');
      // Second vote (toggle off)
      const updated = voteOnPoll(poll.id, optionId, 'Yilong');
      
      expect(updated?.options[0].votes).not.toContain('Yilong');
      expect(updated?.options[0].votes).toHaveLength(0);
    });
    
    it('should remove vote from other options when single-vote mode', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B', 'C'], 'Vincent', false);
      
      // Vote for first option
      voteOnPoll(poll.id, poll.options[0].id, 'Yilong');
      
      // Vote for second option (should remove first)
      const updated = voteOnPoll(poll.id, poll.options[1].id, 'Yilong');
      
      expect(updated?.options[0].votes).not.toContain('Yilong');
      expect(updated?.options[1].votes).toContain('Yilong');
    });
    
    it('should allow multiple votes when multi-vote mode', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B', 'C'], 'Vincent', true);
      
      // Vote for first option
      voteOnPoll(poll.id, poll.options[0].id, 'Yilong');
      // Vote for second option
      voteOnPoll(poll.id, poll.options[1].id, 'Yilong');
      
      const updated = getPoll(poll.id);
      
      expect(updated?.options[0].votes).toContain('Yilong');
      expect(updated?.options[1].votes).toContain('Yilong');
    });
    
    it('should return null for invalid poll ID', () => {
      const result = voteOnPoll('invalid-id', 'option-id', 'Yilong');
      expect(result).toBeNull();
    });
    
    it('should return null for invalid option ID', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      const result = voteOnPoll(poll.id, 'invalid-option-id', 'Yilong');
      expect(result).toBeNull();
    });
    
    it('should return null for closed poll', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      closePoll(poll.id);
      
      const result = voteOnPoll(poll.id, poll.options[0].id, 'Yilong');
      expect(result).toBeNull();
    });
  });
  
  describe('closePoll', () => {
    it('should close an open poll', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      const closed = closePoll(poll.id);
      
      expect(closed?.isClosed).toBe(true);
    });
    
    it('should return null for non-existent poll', () => {
      const result = closePoll('invalid-id');
      expect(result).toBeNull();
    });
  });
  
  describe('getAllPolls', () => {
    it('should return all polls', () => {
      createPoll('msg-1', 'Q1?', ['A', 'B'], 'Vincent');
      createPoll('msg-2', 'Q2?', ['C', 'D'], 'Yilong');
      
      const polls = getAllPolls();
      
      expect(polls).toHaveLength(2);
    });
  });
  
  describe('getPollVoteCount', () => {
    it('should return total vote count', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      
      voteOnPoll(poll.id, poll.options[0].id, 'Vincent');
      voteOnPoll(poll.id, poll.options[0].id, 'Yilong');
      voteOnPoll(poll.id, poll.options[1].id, 'Dan');
      
      const count = getPollVoteCount(poll.id);
      
      expect(count).toBe(3);
    });
    
    it('should return 0 for non-existent poll', () => {
      const count = getPollVoteCount('invalid-id');
      expect(count).toBe(0);
    });
  });
  
  describe('hasUserVoted', () => {
    it('should return true if user has voted', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      voteOnPoll(poll.id, poll.options[0].id, 'Yilong');
      
      const result = hasUserVoted(poll.id, 'Yilong');
      
      expect(result).toBe(true);
    });
    
    it('should return false if user has not voted', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B'], 'Vincent');
      
      const result = hasUserVoted(poll.id, 'Yilong');
      
      expect(result).toBe(false);
    });
  });
  
  describe('getUserVotedOptions', () => {
    it('should return option IDs user has voted for', () => {
      const poll = createPoll('msg-123', 'Question?', ['A', 'B', 'C'], 'Vincent', true);
      
      voteOnPoll(poll.id, poll.options[0].id, 'Yilong');
      voteOnPoll(poll.id, poll.options[2].id, 'Yilong');
      
      const votedOptions = getUserVotedOptions(poll.id, 'Yilong');
      
      expect(votedOptions).toHaveLength(2);
      expect(votedOptions).toContain(poll.options[0].id);
      expect(votedOptions).toContain(poll.options[2].id);
    });
  });
});
