import { db } from '$lib/db';
import { liveQuery } from 'dexie';
import type { ActPriority, UserHighlight } from '$lib/types';

export async function toggleHighlight(festivalId: number, actId: number): Promise<void> {
  const existing = await db.highlights
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();

  if (existing) {
    await db.highlights.delete(existing.id!);
  } else {
    await db.highlights.add({
      festivalId,
      actId,
      createdAt: new Date().toISOString()
    });
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

export async function updateHighlightPriority(
  festivalId: number,
  actId: number,
  priority: ActPriority
): Promise<void> {
  const existing = await db.highlights
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();

  if (existing?.id != null) {
    await db.highlights.update(existing.id, { priority });
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
