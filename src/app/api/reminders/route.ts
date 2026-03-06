import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt-auth';
import { reminderStore } from '@/lib/reminders';
import { validateReminderCreate } from '@/lib/validation';

export async function GET(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = authResult.payload.userId;
  const url = new URL(request.url);
  const channelId = url.searchParams.get('channelId');
  const upcoming = url.searchParams.get('upcoming');

  // If channelId provided, get reminders for that channel
  if (channelId) {
    const reminders = reminderStore.getRemindersByChannel(channelId);
    return NextResponse.json({
      reminders: reminders.map((r) => reminderStore.toResponse(r)),
    });
  }

  // If upcoming=true, get all upcoming reminders
  if (upcoming === 'true') {
    const reminders = reminderStore.getUpcomingReminders();
    return NextResponse.json({
      reminders: reminders.map((r) => reminderStore.toResponse(r)),
    });
  }

  // Default: get reminders for the authenticated user
  const reminders = reminderStore.getRemindersByUser(userId);
  return NextResponse.json({
    reminders: reminders.map((r) => reminderStore.toResponse(r)),
  });
}

export async function POST(request: Request) {
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = authResult.payload.userId;
  const userName = authResult.payload.name || 'Unknown';

  try {
    const body = await request.json();

    // Validate input
    const validation = validateReminderCreate(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const remindAt = new Date(body.remindAt);
    const now = new Date();

    // Validate reminder time is in the future
    if (remindAt <= now) {
      return NextResponse.json(
        { error: 'Reminder time must be in the future' },
        { status: 400 }
      );
    }

    const reminder = reminderStore.createReminder(
      body.messageId,
      body.channelId,
      userId,
      userName,
      remindAt,
      body.note
    );

    return NextResponse.json({
      reminder: reminderStore.toResponse(reminder),
    }, { status: 201 });
  } catch (error) {
    console.error('Create reminder error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
