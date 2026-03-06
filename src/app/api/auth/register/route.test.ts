// Auth Register API Tests
// POST /api/auth/register

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

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    fallbackUsers.clear();
    vi.clearAllMocks();
  });

  it('should return 400 if email is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'password123', name: 'Test User' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email is required');
  });

  it('should return 400 if password is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', name: 'Test User' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password is required');
  });

  it('should return 400 if name is missing', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Name is required');
  });

  it('should return 400 if email is invalid format', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'password123', name: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid email format');
  });

  it('should return 400 if password is too short', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: '12345', name: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must be at least 6 characters');
  });

  it('should return 400 if password is too long', async () => {
    const longPassword = 'a'.repeat(101);
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: longPassword, name: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Password must be less than 100 characters');
  });

  it('should return 400 if name is empty', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123', name: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Name is required');
  });

  it('should return 400 if name is too long', async () => {
    const longName = 'a'.repeat(51);
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123', name: longName }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Name must be 1-50 characters');
  });

  it('should return 409 if user already exists', async () => {
    // Pre-add user
    const passwordHash = hashPassword('password123');
    addFallbackUser('test@example.com', 'Test User', passwordHash);

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123', name: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('User already exists');
  });

  it('should return 200 and token on successful registration', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'new@example.com', password: 'password123', name: 'New User' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe('User created (development mode - not persisted)');
    expect(data.token).toBe('mock-jwt-token');
    expect(data.user).toEqual({
      id: expect.any(String),
      email: 'new@example.com',
      name: 'New User',
      avatar: expect.any(String),
    });
  });

  it('should normalize email to lowercase', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'TEST@EXAMPLE.COM', password: 'password123', name: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.email).toBe('test@example.com');
  });

  it('should trim whitespace from name', async () => {
    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test2@example.com', password: 'password123', name: '  Test User  ' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user.name).toBe('Test User');
  });

  it('should return 429 if rate limited', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    vi.mocked(rateLimit).mockReturnValue({ allowed: false, remaining: 0, resetIn: 60000 });

    const request = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123', name: 'Test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toBe('Too many requests');
    expect(data.retryAfter).toBe(60);
  });
});
