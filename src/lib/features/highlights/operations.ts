import { db } from '$lib/db';
import { liveQuery } from 'dexie';
import type { UserHighlight } from '$lib/types';
import { cancelActNotification, checkPermission, scheduleActNotification } from '$lib/features/notifications/local';

export async function toggleHighlight(
  festivalId: number,
  actId: number
): Promise<void> {
  const existing = await db.highlights
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();

  if (existing) {
    await cancelActNotification(existing);
    await db.highlights.delete(existing.id!);
  } else {
    const id = await db.highlights.add({
      festivalId,
      actId,
      createdAt: new Date().toISOString()
    });

    // Auto-schedule notification using global default lead time
    const settings = await db.settings.toCollection().first();
    if (settings?.notificationsEnabled && (await checkPermission())) {
      const leadTime = settings.notifyMinutesBefore ?? 15;
      const highlight = await db.highlights.get(id as number);
      const act = await db.acts.get(actId);
      if (highlight && act) {
        await scheduleActNotification(highlight, act, leadTime);
      }
    }
  }
}

export async function isHighlighted(festivalId: number, actId: number): Promise<boolean> {
  const existing = await db.highlights
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();
  return !!existing;
}

export function getHighlightsForFestival(festivalId: number) {
  return liveQuery(() =>
    db.highlights.where('festivalId').equals(festivalId).toArray()
  );
}

export async function updateClashRank(
  festivalId: number,
  actId: number,
  clashRank: number
): Promise<void> {
  const existing = await db.highlights
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();

  if (existing?.id != null) {
    await db.highlights.update(existing.id, { clashRank });
  }
}

export async function updateHighlightNotes(
  festivalId: number,
  actId: number,
  notes: string
): Promise<void> {
  const existing = await db.highlights
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();

  if (existing?.id != null) {
    await db.highlights.update(existing.id, { notes });
  }
}
