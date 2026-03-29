import { db } from '$lib/db';
import { liveQuery } from 'dexie';
import type { UserHighlight } from '$lib/types';
import { cancelActNotification, checkPermission, scheduleActNotification } from '$lib/features/notifications/local';

export async function toggleHighlight(
  festivalId: number,
  actId: number,
  notifyMinutesBefore?: number
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

    // Schedule notification if permission granted and notifyMinutesBefore provided
    if (notifyMinutesBefore != null && (await checkPermission())) {
      const highlight = await db.highlights.get(id as number);
      const act = await db.acts.get(actId);
      if (highlight && act) {
        await scheduleActNotification(highlight, act, notifyMinutesBefore);
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
