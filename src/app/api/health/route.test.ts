// Health API Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfiguredSync: vi.fn(() => true),
  isSupabaseConfigured: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('@/lib/metrics', () => ({
  getMetrics: vi.fn(() => ({
    requests: 100,
    messages: 50,
    channels: 10,
    users: 5,
    errors: 0,
  })),
  getRawMetrics: vi.fn(() => ({
    startTime: Date.now() - 60000,
    requests: 100,
  })),
}));

describe('GET /api/health', () => {
  // Set JWT_SECRET for tests before each
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  it('should return 200 with ok status when all checks pass', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.service).toBe('colony-api');
    expect(data.uptime).toBeDefined();
    expect(data.checks).toBeDefined();
  });

  it('should include all health check categories', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.checks.supabase).toBeDefined();
    expect(data.checks.environment).toBeDefined();
    expect(data.checks.memory).toBeDefined();
    expect(data.checks.metrics).toBeDefined();
    expect(data.checks.environmentVars).toBeDefined();
  });

  it('should return uptime information', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.uptime).toHaveProperty('seconds');
    expect(data.uptime).toHaveProperty('human');
    expect(typeof data.uptime.seconds).toBe('number');
    expect(typeof data.uptime.human).toBe('string');
  });

  it('should include timestamp and version', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
  });

  it('should return 503 when critical checks fail', async () => {
    const { isSupabaseConfigured } = await import('@/lib/supabase');
    vi.mocked(isSupabaseConfigured).mockResolvedValue(false);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('unhealthy');
    expect(data.checks.supabase.status).toBe('error');
  });

  it('should handle missing Supabase configuration', async () => {
    const { isSupabaseConfiguredSync } = await import('@/lib/supabase');
    vi.mocked(isSupabaseConfiguredSync).mockReturnValue(false);

    const response = await GET();
    const data = await response.json();

    expect(data.checks.supabase.status).toBe('not_configured');
  });

  it('should handle metrics system errors gracefully', async () => {
    const { getMetrics } = await import('@/lib/metrics');
    vi.mocked(getMetrics).mockReturnValue(null);

    const response = await GET();
    const data = await response.json();

    expect(data.checks.metrics.status).toBe('error');
  });

  it('should check for required environment variables', async () => {
    // Test with JWT_SECRET set
    process.env.JWT_SECRET = 'test-secret';
    const response1 = await GET();
    const data1 = await response1.json();
    expect(data1.checks.environmentVars.status).toBe('ok');

    // Test without JWT_SECRET
    delete process.env.JWT_SECRET;
    const response2 = await GET();
    const data2 = await response2.json();
    expect(data2.checks.environmentVars.status).toBe('warning');
    expect(data2.checks.environmentVars.error).toContain('JWT_SECRET');
  });

  it('should return unhealthy when critical checks fail', async () => {
    const { isSupabaseConfigured } = await import('@/lib/supabase');
    vi.mocked(isSupabaseConfigured).mockResolvedValue(false);

    // Without JWT_SECRET and with Supabase failing, it's unhealthy
    delete process.env.JWT_SECRET;

    const response = await GET();
    const data = await response.json();

    // Since critical checks fail, it's unhealthy
    expect(data.status).toBe('unhealthy');
  });
});
