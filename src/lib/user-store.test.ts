// User Store Tests

import { describe, it, expect, beforeEach } from 'vitest';
import {
  fallbackUsers,
  hashPassword,
  verifyPassword,
  addFallbackUser,
  getFallbackUser,
  fallbackUserExists,
  User
} from './user-store';

describe('User Store', () => {
  // Clear users before each test
  beforeEach(() => {
    fallbackUsers.clear();
    // Re-add default test user
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
  });

  describe('hashPassword', () => {
    it('should generate a hash with salt prefix', () => {
      const hash = hashPassword('testpassword');
      expect(hash).toContain(':');
      const [salt, hashValue] = hash.split(':');
      expect(salt).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(hashValue).toHaveLength(128); // 64 bytes = 128 hex chars
    });

    it('should generate different hashes for the same password (due to random salt)', () => {
      const hash1 = hashPassword('testpassword');
      const hash2 = hashPassword('testpassword');
      expect(hash1).not.toBe(hash2); // Different salts
    });

    it('should generate consistent format for different passwords', () => {
      const hash1 = hashPassword('abc');
      const hash2 = hashPassword('longerpassword123');
      expect(hash1.split(':').length).toBe(2);
      expect(hash2.split(':').length).toBe(2);
    });
  });

  describe('verifyPassword', () => {
    it('should return true for correct password', () => {
      const hash = hashPassword('mypassword');
      expect(verifyPassword('mypassword', hash)).toBe(true);
    });

    it('should return false for incorrect password', () => {
      const hash = hashPassword('mypassword');
      expect(verifyPassword('wrongpassword', hash)).toBe(false);
    });

    it('should return false for malformed hash', () => {
      expect(verifyPassword('password', 'invalid-hash')).toBe(false);
    });

    it('should return false for empty password with valid hash', () => {
      const hash = hashPassword('mypassword');
      expect(verifyPassword('', hash)).toBe(false);
    });

    it('should return false for empty password with empty hash', () => {
      expect(verifyPassword('', '')).toBe(false);
    });
  });

  describe('addFallbackUser', () => {
    it('should add a new user to the store', () => {
      const hash = hashPassword('password123');
      const user = addFallbackUser('new@test.com', 'New User', hash);
      
      expect(user.email).toBe('new@test.com');
      expect(user.name).toBe('New User');
      expect(user.bio).toBe('');
      expect(user.id).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });

    it('should normalize email to lowercase', () => {
      const hash = hashPassword('password123');
      const user = addFallbackUser('UPPER@TEST.COM', 'Upper User', hash);
      
      expect(user.email).toBe('upper@test.com');
    });

    it('should accept optional bio parameter', () => {
      const hash = hashPassword('password123');
      const user = addFallbackUser('bio@test.com', 'Bio User', hash, 'This is my bio');
      
      expect(user.bio).toBe('This is my bio');
    });

    it('should generate avatar URL from name', () => {
      const hash = hashPassword('password123');
      const user = addFallbackUser('avatar@test.com', 'Avatar User', hash);
      
      expect(user.avatar).toContain('api.dicebear.com');
      expect(user.avatar).toContain('Avatar%20User');
    });

    it('should store user in fallbackUsers map', () => {
      const hash = hashPassword('password123');
      addFallbackUser('stored@test.com', 'Stored User', hash);
      
      expect(fallbackUsers.has('stored@test.com')).toBe(true);
    });
  });

  describe('getFallbackUser', () => {
    it('should return user by email', () => {
      const user = getFallbackUser('test@test.com');
      
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@test.com');
      expect(user?.name).toBe('Test User');
    });

    it('should be case-insensitive', () => {
      const user = getFallbackUser('TEST@TEST.COM');
      
      expect(user).toBeDefined();
      expect(user?.email).toBe('test@test.com');
    });

    it('should return undefined for non-existent user', () => {
      const user = getFallbackUser('nonexistent@test.com');
      
      expect(user).toBeUndefined();
    });
  });

  describe('fallbackUserExists', () => {
    it('should return true for existing user', () => {
      expect(fallbackUserExists('test@test.com')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(fallbackUserExists('TEST@TEST.COM')).toBe(true);
    });

    it('should return false for non-existent user', () => {
      expect(fallbackUserExists('nonexistent@test.com')).toBe(false);
    });
  });
});
