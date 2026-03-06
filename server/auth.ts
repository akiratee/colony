// Colony Auth API Routes
// Handles user registration, login, and session management

import 'dotenv/config';
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// Use local auth storage if Supabase is not available
const USE_LOCAL_STORAGE = process.env.USE_LOCAL_STORAGE === 'true' || !process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY;

interface LocalUser {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  avatar?: string;
  created_at: Date;
  updated_at: Date;
}

// In-memory user storage for local development
const localUsers = new Map<string, LocalUser>();

let supabase: any = null;
if (!USE_LOCAL_STORAGE) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    console.log('🔗 Using Supabase for auth storage');
  } catch (e) {
    console.log('⚠️ Supabase client failed, falling back to local storage');
  }
} else {
  console.log('💾 Using local in-memory storage for auth (development mode)');
}

const router = Router();

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'colony-dev-secret-change-in-production';
const JWT_EXPIRY = (process.env.JWT_EXPIRY || '24h') as jwt.SignOptions['expiresIn'];

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

// Input validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPassword(password: string): boolean {
  return !!(password && password.length >= 6);
}

function isValidName(name: string): boolean {
  const trimmed = name?.trim();
  return !!(trimmed && trimmed.length >= 1 && trimmed.length <= 100);
}

// Sanitize input to prevent injection
function sanitizeString(str: string): string {
  return str.trim().slice(0, 1000);
}

// POST /api/auth/register - Create new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Rate limiting
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }

    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required.' });
      return;
    }

    const sanitizedEmail = sanitizeString(email).toLowerCase();
    const sanitizedName = sanitizeString(name);

    if (!isValidEmail(sanitizedEmail)) {
      res.status(400).json({ error: 'Invalid email format.' });
      return;
    }

    if (!isValidPassword(password)) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }

    if (!isValidName(sanitizedName)) {
      res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
      return;
    }

    let newUser: any;

    if (USE_LOCAL_STORAGE || !supabase) {
      // Check if user already exists in local storage
      const existingUser = Array.from(localUsers.values()).find(u => u.email === sanitizedEmail);
      if (existingUser) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user in local storage
      newUser = {
        id: uuidv4(),
        email: sanitizedEmail,
        name: sanitizedName,
        password_hash: passwordHash,
        avatar: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      localUsers.set(newUser.id, newUser);
    } else {
      // Check if user already exists in Supabase
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', sanitizedEmail)
        .single();

      if (existingUser) {
        res.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user in Supabase
      const { data, error: createError } = await supabase
        .from('users')
        .insert({
          email: sanitizedEmail,
          name: sanitizedName,
          password_hash: passwordHash,
        })
        .select('id, email, name, avatar, created_at')
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        res.status(500).json({ error: 'Failed to create account. Please try again.' });
        return;
      }

      newUser = data;
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar || null,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`New user registered: ${newUser.email}`);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatar: newUser.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// POST /api/auth/login - Authenticate user
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Rate limiting
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Too many requests. Please try again later.' });
      return;
    }

    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const sanitizedEmail = sanitizeString(email).toLowerCase();

    if (!isValidEmail(sanitizedEmail)) {
      res.status(400).json({ error: 'Invalid email format.' });
      return;
    }

    let user: any;

    if (USE_LOCAL_STORAGE || !supabase) {
      // Get user from local storage
      user = Array.from(localUsers.values()).find(u => u.email === sanitizedEmail);
      
      if (!user) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
    } else {
      // Get user from Supabase
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, email, name, password_hash, avatar')
        .eq('email', sanitizedEmail)
        .single();

      if (userError || !data) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      user = data;

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }
    }

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar || null,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    console.log(`User logged in: ${user.email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// GET /api/auth/me - Get current user (requires auth)
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const token = authHeader.slice(7);

    // Verify token
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    let user: any;

    if (USE_LOCAL_STORAGE || !supabase) {
      // Get user from local storage
      user = localUsers.get(decoded.userId);
      
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
    } else {
      // Get user from Supabase
      const { data, error: userError } = await supabase
        .from('users')
        .select('id, email, name, avatar, created_at, updated_at')
        .eq('id', decoded.userId)
        .single();

      if (userError || !data) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      user = data;
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// PUT /api/auth/profile - Update user profile (requires auth)
router.put('/profile', async (req: Request, res: Response) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const token = authHeader.slice(7);

    // Verify token
    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired token.' });
      return;
    }

    const { name, avatar } = req.body;

    // Validate input
    if (name !== undefined) {
      const sanitizedName = sanitizeString(name);
      if (!isValidName(sanitizedName)) {
        res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
        return;
      }
    }

    let updatedUser: any;

    if (USE_LOCAL_STORAGE || !supabase) {
      // Update user in local storage
      const user = localUsers.get(decoded.userId);
      
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }

      if (name !== undefined) user.name = sanitizeString(name);
      if (avatar !== undefined) user.avatar = avatar?.slice(0, 500);
      user.updated_at = new Date();

      localUsers.set(decoded.userId, user);
      updatedUser = user;
    } else {
      // Update user in Supabase
      const updateData: { name?: string; avatar?: string } = {};
      if (name !== undefined) updateData.name = sanitizeString(name);
      if (avatar !== undefined) updateData.avatar = avatar?.slice(0, 500);

      const { data, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', decoded.userId)
        .select('id, email, name, avatar, updated_at')
        .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        res.status(500).json({ error: 'Failed to update profile.' });
        return;
      }

      updatedUser = data;
    }

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

// POST /api/auth/logout - Invalidate token (client-side token removal)
router.post('/logout', (req: Request, res: Response) => {
  // JWT is stateless - client simply removes the token
  // This endpoint exists for consistency and any server-side cleanup if needed
  res.json({ message: 'Logged out successfully. Please remove the token from client storage.' });
});

export default router;
