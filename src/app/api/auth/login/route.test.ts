// Auth Login API Tests
// POST /api/auth/login

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { hashPassword, addFallbackUser, fallbackUsers } from '@/lib/user-store';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: null,
  isSupabaseConfigured: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ allowed: true, resetIn: 0 }),
}));

vi.mock('@/lib/jwt-auth', () => ({
  generateToken: vi.fn().mockReturnValue('mock-jwt-token'),
}));

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    fallbackUsers.clear();
    vi.clearAllMocks();
  });

  it('should return 400 if email is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 400 if password is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password is required');
  });

  it('should return 400 if email is not a string', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 123, password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 400 if password is not a string', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 123 }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password is required');
  });

  it('should return 401 if user does not exist', async () => {
    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com', password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid email or password');
  });

  it('should return 401 if password is incorrect', async () => {
    // Add a test user
    const passwordHash = hashPassword('correctpassword');
    addFallbackUser('test@example.com', 'Test User', passwordHash);

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'wrongpassword' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Invalid email or password');
  });

  it('should return 401 if email is case-insensitive mismatch', async () => {
    // Add a test user with lowercase email
    const passwordHash = hashPassword('password123');
    addFallbackUser('test@example.com', 'Test User', passwordHash);

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'TEST@EXAMPLE.COM', password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Should succeed due to case-insensitive lookup
    expect(response.status).toBe(200);
    expect(data.message).toBe('Login successful');
    expect(data.token).toBe('mock-jwt-token');
  });

  it('should return 200 and token on successful login', async () => {
    // Add a test user
    const passwordHash = hashPassword('password123');
    addFallbackUser('test@example.com', 'Test User', passwordHash);

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('Login successful');
    expect(data.token).toBe('mock-jwt-token');
    expect(data.user).toEqual({
      id: expect.any(String),
      email: 'test@example.com',
      name: 'Test User',
      avatar: expect.any(String),
    });
  });

  it('should return 429 if rate limited', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new Request('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
    expect(data.retryAfter).toBe(60);
  });
});
