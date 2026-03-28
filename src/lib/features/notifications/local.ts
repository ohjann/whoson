import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { parseISO, subMinutes } from 'date-fns';
import { db } from '$lib/db';
import type { Act, UserHighlight } from '$lib/types';

// iOS hard limit for pending local notifications
const IOS_NOTIFICATION_LIMIT = 64;

// Default minutes before act start to notify
export const DEFAULT_NOTIFY_MINUTES_BEFORE = 15;

/**
 * Request permission to send local notifications.
 * Returns true if granted, false if denied.
 */
export async function requestPermission(): Promise<boolean> {
  const status = await LocalNotifications.requestPermissions();
  return status.display === 'granted';
}

/**
 * Check if notification permission is granted without prompting.
 */
export async function checkPermission(): Promise<boolean> {
  const status = await LocalNotifications.checkPermissions();
  return status.display === 'granted';
}

/**
 * Generate a stable numeric notification ID from a highlight ID.
 * Uses the highlight ID directly since it's already a unique number.
 */
function notificationIdForHighlight(highlightId: number): number {
  return highlightId;
}

/**
 * Schedule a local notification for a highlighted act.
 * Stores the notificationId back into the highlight record.
 * Returns false if permission denied or act start time is in the past.
 */
export async function scheduleActNotification(
  highlight: UserHighlight,
  act: Act,
  notifyMinutesBefore: number = DEFAULT_NOTIFY_MINUTES_BEFORE
): Promise<boolean> {
  if (!(await checkPermission())) return false;
  if (highlight.id == null) return false;

  const startTime = parseISO(act.startTime);
  const notifyAt = subMinutes(startTime, notifyMinutesBefore);

  if (notifyAt <= new Date()) return false;

  const notificationId = notificationIdForHighlight(highlight.id);

  const body =
    notifyMinutesBefore === 0
      ? `Starting now on ${act.stage}`
      : `Starting in ${notifyMinutesBefore} min on ${act.stage}`;

  await LocalNotifications.schedule({
    notifications: [
      {
        id: notificationId,
        title: act.name,
        body,
        schedule: { at: notifyAt },
        extra: { actId: act.id, highlightId: highlight.id }
      }
    ]
  });

  // Persist notificationId and notifyMinutesBefore into the highlight record
  await db.highlights.update(highlight.id, { notificationId, notifyMinutesBefore });

  return true;
}

/**
 * Cancel the local notification for a highlight, if any.
 * Clears notificationId from the highlight record.
 */
export async function cancelActNotification(highlight: UserHighlight): Promise<void> {
  if (highlight.notificationId == null || highlight.id == null) return;

  await LocalNotifications.cancel({
    notifications: [{ id: highlight.notificationId }]
  });

  await db.highlights.update(highlight.id, {
    notificationId: undefined,
    notifyMinutesBefore: undefined
  });
}

/**
 * Rolling window strategy: only keep the nearest IOS_NOTIFICATION_LIMIT
 * notifications registered with the OS. Call this on app foreground.
 *
 * Steps:
 * 1. Cancel all currently pending notifications (delivered ones are gone already)
 * 2. Fetch all highlights with notifyMinutesBefore set from Dexie
 * 3. Resolve their acts and compute fire times
 * 4. Sort by fire time ascending, take the nearest 64
 * 5. Schedule those with the OS
 */
export async function syncNotificationWindow(): Promise<void> {
  if (!(await checkPermission())) return;

  // Cancel all OS-registered notifications first
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  // Fetch all highlights that have notifyMinutesBefore configured
  const allHighlights = await db.highlights
    .filter((h) => h.notifyMinutesBefore != null)
    .toArray();

  if (allHighlights.length === 0) return;

  const now = new Date();

  // Resolve acts and compute fire times
  const entries: Array<{
    highlight: UserHighlight;
    act: Act;
    notifyAt: Date;
  }> = [];

  for (const highlight of allHighlights) {
    const act = await db.acts.get(highlight.actId);
    if (!act) continue;

    const startTime = parseISO(act.startTime);
    const notifyAt = subMinutes(startTime, highlight.notifyMinutesBefore!);

    if (notifyAt > now) {
      entries.push({ highlight, act, notifyAt });
    }
  }

  // Sort by fire time, take the nearest IOS_NOTIFICATION_LIMIT
  entries.sort((a, b) => a.notifyAt.getTime() - b.notifyAt.getTime());
  const window = entries.slice(0, IOS_NOTIFICATION_LIMIT);

  if (window.length === 0) return;

  await LocalNotifications.schedule({
    notifications: window.map(({ highlight, act, notifyAt }) => {
      const mins = highlight.notifyMinutesBefore!;
      const body =
        mins === 0 ? `Starting now on ${act.stage}` : `Starting in ${mins} min on ${act.stage}`;
      return {
        id: notificationIdForHighlight(highlight.id!),
        title: act.name,
        body,
        schedule: { at: notifyAt },
        extra: { actId: act.id, highlightId: highlight.id }
      };
    })
  });
}

/**
 * Bulk-reschedule all notifications after a lineup update.
 * Clears all OS notifications and re-registers the rolling window.
 */
export async function rescheduleAllNotifications(): Promise<void> {
  await syncNotificationWindow();
}

/**
 * Register the app-foreground listener to sync the notification window.
 * Call once at app startup (e.g., in root +layout.svelte).
 * Returns a cleanup function to remove the listener.
 */
export function registerForegroundSync(): () => void {
  let handle: { remove: () => Promise<void> } | null = null;

  App.addListener('appStateChange', (state) => {
    if (state.isActive) {
      syncNotificationWindow().catch(console.error);
    }
  }).then((h) => {
    handle = h;
  });

  return () => {
    handle?.remove();
  };
}
