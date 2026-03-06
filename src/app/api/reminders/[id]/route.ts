import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/jwt-auth';
import { reminderStore } from '@/lib/reminders';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const reminder = reminderStore.getReminder(id);

  if (!reminder) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
  }

  // Users can only view their own reminders
  if (reminder.userId !== authResult.payload.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  return NextResponse.json({
    reminder: reminderStore.toResponse(reminder),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check authentication
  const authResult = withAuth(request);
  if (!authResult.valid || !authResult.payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const reminder = reminderStore.getReminder(id);

  if (!reminder) {
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
  }

  // Users can only delete their own reminders
  if (reminder.userId !== authResult.payload.userId) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const deleted = reminderStore.deleteReminder(id);

  if (deleted) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 });
}
