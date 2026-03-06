// Shared User Store for Colony
// Used by both REST API routes for fallback in-memory user storage

import crypto from 'crypto';

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  avatar: string;
  bio?: string;
  createdAt?: Date;
}

// In-memory fallback user store (development only)
export const fallbackUsers: Map<string, User> = new Map();

// Initialize with a default test user for development
// Email: test@test.com, Password: test123
const defaultTestUser: User = {
  id: 'test-user-001',
  email: 'test@test.com',
  name: 'Test User',
  password_hash: '8093b4b3688d83d83c04f86e577bbd36:b7d4a7332ce8f42cef345d7d161572d6060fe71d7d03a86be5f6f5d614ec3d2343f8c0a9f28e3e85f6c2073cfc955e424f1807198c3ad2dd7d880bb14ec959d8',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Test%20User',
  bio: 'Welcome to Colony! This is your bio.',
  createdAt: new Date(),
};
fallbackUsers.set(defaultTestUser.email, defaultTestUser);

// Password hashing (using PBKDF2) - increased iterations for better security
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Password verification
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  } catch {
    return false;
  }
}

// Add a user to fallback store
export function addFallbackUser(email: string, name: string, passwordHash: string, bio?: string): User {
  const user: User = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    password_hash: passwordHash,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    bio: bio || '',
    createdAt: new Date(),
  };
  fallbackUsers.set(email.toLowerCase(), user);
  return user;
}

// Get user by email from fallback store
export function getFallbackUser(email: string): User | undefined {
  return fallbackUsers.get(email.toLowerCase());
}

// Check if user exists in fallback store
export function fallbackUserExists(email: string): boolean {
  return fallbackUsers.has(email.toLowerCase());
}
