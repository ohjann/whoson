import { db } from '$lib/db';
import type { Festival, Act } from '$lib/types';
import { fetchClashfinderLineup } from '$lib/features/import/clashfinder';

export async function createFestival(
  data: Omit<Festival, 'id' | 'createdAt' | 'updatedAt'>
): Promise<number> {
  const now = new Date().toISOString();
  const id = await db.festivals.add({
    ...data,
    createdAt: now,
    updatedAt: now
  });
  return id as number;
}

export async function updateFestival(
  id: number,
  data: Partial<Omit<Festival, 'id' | 'createdAt'>>
): Promise<void> {
  await db.festivals.update(id, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteFestival(id: number): Promise<void> {
  await db.transaction('rw', [db.festivals, db.acts, db.highlights, db.festivalMaps], async () => {
    await db.acts.where('festivalId').equals(id).delete();
    await db.highlights.where('festivalId').equals(id).delete();
    await db.festivalMaps.delete(id);
    await db.festivals.delete(id);
  });
}

export async function getActiveFestival(): Promise<Festival | undefined> {
  const settings = await db.settings.toCollection().first();
  if (!settings?.activeFestivalId) return undefined;
  return db.festivals.get(settings.activeFestivalId);
}

export async function setActiveFestival(festivalId: number): Promise<void> {
  const settings = await db.settings.toCollection().first();
  if (settings?.id != null) {
    await db.settings.update(settings.id, { activeFestivalId: festivalId });
  } else {
    await db.settings.add({ activeFestivalId: festivalId, notificationsEnabled: false });
  }
}

export async function importLineup(
  festivalId: number,
  acts: Omit<Act, 'id' | 'festivalId'>[]
): Promise<void> {
  await db.transaction('rw', [db.acts], async () => {
    await db.acts.where('festivalId').equals(festivalId).delete();
    const actsToInsert = acts.map((act) => ({ ...act, festivalId }));
    await db.acts.bulkPut(actsToInsert);
  });
}

export async function refreshLineup(festivalId: number): Promise<void> {
  const festival = await db.festivals.get(festivalId);
  if (!festival?.clashfinderSlug) {
    throw new Error('Festival has no Clashfinder slug configured');
  }
  const result = await fetchClashfinderLineup(festival.clashfinderSlug);
  await importLineup(festivalId, result.acts);
}

export async function getFestivalBySlug(slug: string): Promise<Festival | undefined> {
  const all = await db.festivals.toArray();
  return all.find((f) => f.clashfinderSlug === slug);
}
