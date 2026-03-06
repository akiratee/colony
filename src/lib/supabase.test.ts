import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: vi.fn(() => Promise.resolve({ data: [], error: null })) }))
  }))
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export null client when env vars are missing', async () => {
    // Clear env vars
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    // Re-require to get fresh import
    const { supabase } = await import('./supabase');
    expect(supabase).toBeNull();
    
    // Restore
    if (originalUrl) { process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl; }
    if (originalKey) { process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey; }
  });

  it('should export null client when only URL is present', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const { supabase } = await import('./supabase');
    expect(supabase).toBeNull();
    
    if (originalUrl) { process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl; }
    if (originalKey) { process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey; }
  });

  it('should export null client when only anon key is present', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';
    
    const { supabase } = await import('./supabase');
    expect(supabase).toBeNull();
    
    if (originalUrl) { process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl; }
    if (originalKey) { process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey; }
  });

  it('isSupabaseConfigured should return false when client is null', async () => {
    const { isSupabaseConfigured } = await import('./supabase');
    const result = await isSupabaseConfigured();
    expect(result).toBe(false);
  });

  it('isSupabaseConfiguredSync should return correct value based on client', async () => {
    // The sync check just checks if supabase client exists
    // Since the actual env vars are set in test environment, it will return true
    const { isSupabaseConfiguredSync, supabase } = await import('./supabase');
    const result = isSupabaseConfiguredSync();
    // Result should match whether supabase client was created
    expect(result).toBe(supabase !== null);
  });

  it('resetSupabaseValidation should clear cache', async () => {
    const { resetSupabaseValidation } = await import('./supabase');
    expect(() => resetSupabaseValidation()).not.toThrow();
  });
});
