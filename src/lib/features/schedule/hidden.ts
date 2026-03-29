import { db } from '$lib/db';

export async function toggleHidden(festivalId: number, actId: number): Promise<void> {
  const existing = await db.hiddenActs
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();

  if (existing) {
    await db.hiddenActs.delete(existing.id!);
  } else {
    await db.hiddenActs.add({
      festivalId,
      actId,
      createdAt: new Date().toISOString()
    });
  }
}

export async function unhideAct(festivalId: number, actId: number): Promise<void> {
  const existing = await db.hiddenActs
    .where('[festivalId+actId]')
    .equals([festivalId, actId])
    .first();
  if (existing) {
    await db.hiddenActs.delete(existing.id!);
  }
}
