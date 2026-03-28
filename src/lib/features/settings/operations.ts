import { db } from '$lib/db';
import type { AppSettings } from '$lib/types';

export async function getSettings(): Promise<AppSettings | undefined> {
  return db.settings.toCollection().first();
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  const settings = await db.settings.toCollection().first();
  if (settings?.id != null) {
    await db.settings.update(settings.id, patch);
  } else {
    await db.settings.add({ notificationsEnabled: false, ...patch });
  }
}

/**
 * Clear all app data (festivals, acts, highlights, settings, maps).
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.festivals, db.acts, db.highlights, db.settings, db.festivalMaps],
    async () => {
      await db.festivals.clear();
      await db.acts.clear();
      await db.highlights.clear();
      await db.settings.clear();
      await db.festivalMaps.clear();
    }
  );
}
