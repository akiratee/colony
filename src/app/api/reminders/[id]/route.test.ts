import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, DELETE } from './route';
import { reminderStore } from '@/lib/reminders';
import { withAuth } from '@/lib/jwt-auth';

// Mock dependencies
vi.mock('@/lib/jwt-auth', () => ({
  withAuth: vi.fn(),
}));

vi.mock('@/lib/reminders', () => ({
  reminderStore: {
    getReminder: vi.fn(),
    deleteReminder: vi.fn(),
    toResponse: vi.fn((r) => r),
  },
}));

const mockWithAuth = withAuth as ReturnType<typeof vi.fn>;
const mockGetReminder = reminderStore.getReminder as ReturnType<typeof vi.fn>;
const mockDeleteReminder = reminderStore.deleteReminder as ReturnType<typeof vi.fn>;

describe('GET /api/reminders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false });

    const request = new Request('http://localhost/api/reminders/reminder-1');
    const response = await GET(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(401);
  });

  it('should return 404 if reminder not found', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetReminder.mockReturnValue(undefined);

    const request = new Request('http://localhost/api/reminders/reminder-1');
    const response = await GET(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(404);
  });

  it('should return 403 if user does not own reminder', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetReminder.mockReturnValue({
      id: 'reminder-1',
      messageId: 'msg-1',
      channelId: 'channel-1',
      userId: 'user-456', // Different user
      userName: 'Other User',
      remindAt: new Date(),
      createdAt: new Date(),
      triggered: false,
    });

    const request = new Request('http://localhost/api/reminders/reminder-1');
    const response = await GET(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(403);
  });

  it('should return reminder if user owns it', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetReminder.mockReturnValue({
      id: 'reminder-1',
      messageId: 'msg-1',
      channelId: 'channel-1',
      userId: 'user-123',
      userName: 'Test User',
      remindAt: new Date('2026-03-01T10:00:00Z'),
      createdAt: new Date(),
      triggered: false,
    });

    const request = new Request('http://localhost/api/reminders/reminder-1');
    const response = await GET(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.reminder).toBeDefined();
    expect(data.reminder.id).toBe('reminder-1');
  });
});

describe('DELETE /api/reminders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    mockWithAuth.mockReturnValue({ valid: false });

    const request = new Request('http://localhost/api/reminders/reminder-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(401);
  });

  it('should return 404 if reminder not found', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetReminder.mockReturnValue(undefined);

    const request = new Request('http://localhost/api/reminders/reminder-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(404);
  });

  it('should return 403 if user does not own reminder', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetReminder.mockReturnValue({
      id: 'reminder-1',
      messageId: 'msg-1',
      channelId: 'channel-1',
      userId: 'user-456', // Different user
      userName: 'Other User',
      remindAt: new Date(),
      createdAt: new Date(),
      triggered: false,
    });

    const request = new Request('http://localhost/api/reminders/reminder-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(403);
  });

  it('should delete reminder successfully', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetReminder.mockReturnValue({
      id: 'reminder-1',
      messageId: 'msg-1',
      channelId: 'channel-1',
      userId: 'user-123',
      userName: 'Test User',
      remindAt: new Date(),
      createdAt: new Date(),
      triggered: false,
    });
    mockDeleteReminder.mockReturnValue(true);

    const request = new Request('http://localhost/api/reminders/reminder-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(200);
    expect(mockDeleteReminder).toHaveBeenCalledWith('reminder-1');
  });

  it('should return 500 if delete fails', async () => {
    mockWithAuth.mockReturnValue({
      valid: true,
      payload: { userId: 'user-123', name: 'Test User' },
    });
    mockGetReminder.mockReturnValue({
      id: 'reminder-1',
      messageId: 'msg-1',
      channelId: 'channel-1',
      userId: 'user-123',
      userName: 'Test User',
      remindAt: new Date(),
      createdAt: new Date(),
      triggered: false,
    });
    mockDeleteReminder.mockReturnValue(false);

    const request = new Request('http://localhost/api/reminders/reminder-1', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'reminder-1' }) });

    expect(response.status).toBe(500);
  });
});
