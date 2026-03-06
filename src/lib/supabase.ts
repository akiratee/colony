import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Use empty string as fallback to avoid runtime crashes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if both env vars are present
export const supabase: SupabaseClient | null = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Cache for validation result with TTL
let supabaseValid: boolean | null = null;
let cacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

// Helper to check if Supabase is configured and credentials are valid
export const isSupabaseConfigured = async (): Promise<boolean> => {
  if (!supabase) {return false;}
  
  // If we've recently validated, return cached result
  if (supabaseValid !== null && Date.now() - cacheTime < CACHE_TTL) {
    return supabaseValid;
  }
  
  try {
    // Try a simple request to validate credentials
    const { data, error } = await supabase.from('users').select('id').limit(1);
    // Table might not exist, but that means Supabase is configured
    // "Invalid API key" error means credentials are bad
    supabaseValid = !error || error.message.includes('relation') || error.message.includes('table');
    cacheTime = Date.now();
    return supabaseValid;
  } catch {
    supabaseValid = false;
    cacheTime = Date.now();
    return false;
  }
};

// Reset validation cache (useful when credentials change)
export const resetSupabaseValidation = (): void => {
  supabaseValid = null;
  cacheTime = 0;
};

// Synchronous check for initial configuration (doesn't validate credentials)
export const isSupabaseConfiguredSync = (): boolean => supabase !== null;
