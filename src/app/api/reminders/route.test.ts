import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './route';
import { reminderStore } from '@/lib/reminders';

// Mock dependencies
vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
}));

vi.mock('@/lib/reminders', () => ({
  reminderStore: {
    createReminder: vi.fn(),
    getReminder: vi.fn(),
    getRemindersByUser: vi.fn(),
    getRemindersByChannel: vi.fn(),
    getUpcomingReminders: vi.fn(),
    toResponse: vi.fn((r) => r),
    deleteReminder: vi.fn(),
  },
}));

vi.mock('@/lib/validation', () => ({
  validateReminderCreate: vi.fn(),
}));

import { withAuth } from '@/lib/jwt-auth';
import { validateReminderCreate } from '@/lib/validation';

const mockWithAuth = withAuth as ReturnType<typeof vi.fn>;
const mockValidateReminderCreate = validateReminderCreate as ReturnType<typeof vi.fn>;
const mockCreateReminder = reminderStore.createReminder as ReturnType<typeof vi.fn>;
const mockGetRemindersByUser = reminderStore.getRemindersByUser as ReturnType<typeof vi.fn>;
const mockGetRemindersByChannel = reminderStore.getRemindersByChannel as ReturnType<typeof vi.fn>;
const mockGetUpcomingReminders = reminderStore.getUpcomingReminders as ReturnType<typeof vi.fn>;
const mockGetReminder = reminderStore.getReminder as ReturnType<typeof vi.fn>;
const mockDeleteReminder = reminderStore.deleteReminder as ReturnType<typeof vi.fn>;

describe('GET /api/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false });

    const request = new Request('http://localhost/api/reminders');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return user reminders if authenticated', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetRemindersByUser.mockReturnValue([
      {
        id: 'reminder-1',
        messageId: 'msg-1',
        channelId: 'channel-1',
        userId: 'user-123',
        userName: 'Test User',
        remindAt: new Date('2026-03-01T10:00:00Z'),
        createdAt: new Date(),
        triggered: false,
      },
    ]);

    const request = new Request('http://localhost/api/reminders');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reminders).toHaveLength(1);
    expect(mockGetRemindersByUser).toHaveBeenCalledWith('user-123');
  });

  it('should return channel reminders if channelId provided', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetRemindersByChannel.mockReturnValue([]);

    const request = new Request('http://localhost/api/reminders?channelId=channel-1');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetRemindersByChannel).toHaveBeenCalledWith('channel-1');
  });

  it('should return upcoming reminders if upcoming=true', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetUpcomingReminders.mockReturnValue([]);

    const request = new Request('http://localhost/api/reminders?upcoming=true');
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockGetUpcomingReminders).toHaveBeenCalled();
  });
});

describe('POST /api/reminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false });

    const request = new Request('http://localhost/api/reminders', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should return 400 if validation fails', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockValidateReminderCreate.mockReturnValue({ valid: false, error: 'messageId is required' });

    const request = new Request('http://localhost/api/reminders', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it('should return 400 if reminder time is in the past', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockValidateReminderCreate.mockReturnValue({ valid: true });

    const request = new Request('http://localhost/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        messageId: 'msg-1',
        channelId: 'channel-1',
        remindAt: '2020-01-01T10:00:00Z',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('future');
  });

  it('should create reminder successfully', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockValidateReminderCreate.mockReturnValue({ valid: true });
    mockCreateReminder.mockReturnValue({
      id: 'reminder-1',
      messageId: 'msg-1',
      channelId: 'channel-1',
      userId: 'user-123',
      userName: 'Test User',
      remindAt: new Date('2026-03-01T10:00:00Z'),
      note: 'Test note',
      createdAt: new Date(),
      triggered: false,
    });

    // Use a date far in the future to avoid timezone issues
    // (10:00 UTC = 02:00 PST same day, so use 2029 to ensure it's always in future)
    const request = new Request('http://localhost/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        messageId: 'msg-1',
        channelId: 'channel-1',
        remindAt: '2029-03-01T10:00:00Z',
        note: 'Test note',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.reminder).toBeDefined();
    expect(mockCreateReminder).toHaveBeenCalledWith(
      'msg-1',
      'channel-1',
      'user-123',
      'Test User',
      expect.any(Date),
      'Test note'
    );
  });
});
