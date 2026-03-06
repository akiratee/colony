import { describe, it, expect, beforeEach } from 'vitest';
import { searchMessages, resetMessageStore } from '../../src/lib/messageStore';

describe('Message Search', () => {
  beforeEach(() => {
    resetMessageStore();
  });
  
  it('should find messages containing search term', () => {
    const results = searchMessages('test');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(m => m.content.toLowerCase().includes('test'))).toBe(true);
  });
  
  it('should be case insensitive', () => {
    const upperResults = searchMessages('VINCENT');
    const lowerResults = searchMessages('vincent');
    expect(upperResults.length).toBe(lowerResults.length);
  });
  
  it('should return empty array for empty query', () => {
    expect(searchMessages('')).toEqual([]);
    expect(searchMessages('   ')).toEqual([]);
  });
  
  it('should filter by channel when provided', () => {
    const allResults = searchMessages('team');
    const channelResults = searchMessages('team', '1');
    
    // Channel filter should return fewer or equal results
    expect(channelResults.length).toBeLessThanOrEqual(allResults.length);
    
    // All channel results should be from that channel
    if (channelResults.length > 0) {
      expect(channelResults.every(m => m.channelId === '1')).toBe(true);
    }
  });
  
  it('should return results sorted by newest first', () => {
    const results = searchMessages('the');
    for (let i = 0; i < results.length - 1; i++) {
      expect(new Date(results[i].timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(results[i + 1].timestamp).getTime()
      );
    }
  });
});
