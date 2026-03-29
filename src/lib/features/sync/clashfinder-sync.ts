import { db } from '$lib/db';
import type { Act, Festival } from '$lib/types';
import { fetchClashfinderLineup } from '$lib/features/import/clashfinder';
import { updateFestival } from '$lib/features/festival/operations';
import { rescheduleAllNotifications } from '$lib/features/notifications/local';

export interface SyncResult {
  changed: boolean;
  added: string[];
  removed: string[];
  moved: Array<{ name: string; change: string }>;
  printAdvisory?: { level: number; label: string; lastUpdate: string };
  error?: string;
}

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function shouldSync(festival: Festival): boolean {
  if (!festival.clashfinderSlug) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!festival.lastSyncAt) return true;
  const elapsed = Date.now() - new Date(festival.lastSyncAt).getTime();
  return elapsed > SYNC_INTERVAL_MS;
}

export async function syncFestivalLineup(festival: Festival): Promise<SyncResult> {
  if (!festival.clashfinderSlug || festival.id == null) {
    return { changed: false, added: [], removed: [], moved: [], error: 'No Clashfinder slug' };
  }

  let result: Awaited<ReturnType<typeof fetchClashfinderLineup>>;
  try {
    result = await fetchClashfinderLineup(festival.clashfinderSlug);
  } catch (e) {
    return {
      changed: false,
      added: [],
      removed: [],
      moved: [],
      error: e instanceof Error ? e.message : 'Sync failed'
    };
  }

  const festivalId = festival.id;
  const newActs = result.acts;

  // Load current acts
  const oldActs = await db.acts.where('festivalId').equals(festivalId).toArray();

  // Compute diff by matching on name
  const oldByName = new Map(oldActs.map((a) => [a.name, a]));
  const newByName = new Map(newActs.map((a) => [a.name, a]));

  const added: string[] = [];
  const removed: string[] = [];
  const moved: Array<{ name: string; change: string }> = [];

  for (const [name] of newByName) {
    if (!oldByName.has(name)) added.push(name);
  }
  for (const [name] of oldByName) {
    if (!newByName.has(name)) removed.push(name);
  }
  for (const [name, newAct] of newByName) {
    const oldAct = oldByName.get(name);
    if (!oldAct) continue;
    const changes: string[] = [];
    if (oldAct.stage !== newAct.stage) {
      changes.push(`${oldAct.stage} → ${newAct.stage}`);
    }
    if (oldAct.startTime !== newAct.startTime || oldAct.endTime !== newAct.endTime) {
      changes.push(`${oldAct.startTime.slice(11, 16)} → ${newAct.startTime.slice(11, 16)}`);
    }
    if (changes.length > 0) {
      moved.push({ name, change: changes.join(', ') });
    }
  }

  const changed = added.length > 0 || removed.length > 0 || moved.length > 0;

  if (changed) {
    // Preserve highlights and hidden acts by remapping act IDs
    await db.transaction('rw', [db.acts, db.highlights, db.hiddenActs], async () => {
      // Build old name→ID map
      const oldNameToId = new Map<string, number>();
      for (const act of oldActs) {
        if (act.id != null) oldNameToId.set(act.name, act.id);
      }

      // Load user data keyed by old act ID
      const highlights = await db.highlights.where('festivalId').equals(festivalId).toArray();
      const hiddenActs = await db.hiddenActs.where('festivalId').equals(festivalId).toArray();

      // Map old actId → name for remapping
      const oldIdToName = new Map<number, string>();
      for (const [name, id] of oldNameToId) {
        oldIdToName.set(id, name);
      }

      // Delete old acts and insert new
      await db.acts.where('festivalId').equals(festivalId).delete();
      const actsToInsert = newActs.map((a) => ({ ...a, festivalId }));
      await db.acts.bulkPut(actsToInsert);

      // Build new name→ID map
      const freshActs = await db.acts.where('festivalId').equals(festivalId).toArray();
      const newNameToId = new Map<string, number>();
      for (const act of freshActs) {
        if (act.id != null) newNameToId.set(act.name, act.id);
      }

      // Remap highlights
      for (const h of highlights) {
        const actName = oldIdToName.get(h.actId);
        if (!actName) continue;
        const newId = newNameToId.get(actName);
        if (newId != null && newId !== h.actId) {
          await db.highlights.update(h.id!, { actId: newId });
        } else if (newId == null) {
          // Act was removed — delete orphaned highlight
          await db.highlights.delete(h.id!);
        }
      }

      // Remap hidden acts
      for (const h of hiddenActs) {
        const actName = oldIdToName.get(h.actId);
        if (!actName) continue;
        const newId = newNameToId.get(actName);
        if (newId != null && newId !== h.actId) {
          await db.hiddenActs.update(h.id!, { actId: newId });
        } else if (newId == null) {
          await db.hiddenActs.delete(h.id!);
        }
      }
    });

    // Reschedule notifications with new act IDs/times
    await rescheduleAllNotifications();
  }

  // Update festival metadata
  const updateData: Partial<Festival> = { lastSyncAt: new Date().toISOString() };
  if (result.printAdvisory) {
    updateData.printAdvisoryLevel = result.printAdvisory.level;
    updateData.printAdvisoryLabel = result.printAdvisory.label;
  }
  await updateFestival(festivalId, updateData);

  return {
    changed,
    added,
    removed,
    moved,
    printAdvisory: result.printAdvisory
  };
}
