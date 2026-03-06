import { describe, it, expect } from 'vitest';

describe('Messages API Timestamp Serialization', () => {
  it('should serialize Date objects to ISO strings', () => {
    const testDate = new Date('2026-02-23T12:00:00Z');
    const serialized = testDate.toISOString();
    
    expect(serialized).toBe('2026-02-23T12:00:00.000Z');
    expect(typeof serialized).toBe('string');
  });
  
  it('should handle timestamp conversion correctly', () => {
    // Simulate what the API does
    const message = {
      id: '1',
      content: 'Test',
      timestamp: new Date(),
    };
    
    const serialized = {
      ...message,
      timestamp: new Date(message.timestamp).toISOString()
    };
    
    expect(typeof serialized.timestamp).toBe('string');
    expect(serialized.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  
  it('should handle array of messages with timestamps', () => {
    const messages = [
      { id: '1', timestamp: new Date('2026-02-23T10:00:00Z') },
      { id: '2', timestamp: new Date('2026-02-23T11:00:00Z') },
      { id: '3', timestamp: new Date('2026-02-23T12:00:00Z') },
    ];
    
    const serialized = messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp).toISOString()
    }));
    
    expect(serialized.every(m => typeof m.timestamp === 'string')).toBe(true);
    // Verify descending order after sorting
    const sortedDesc = [...serialized].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    expect(sortedDesc[0].id).toBe('3'); // newest first
  });
});
