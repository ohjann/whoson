import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhosOnDB } from '$lib/db';
import type { Festival, Act } from '$lib/types';
import {
  createFestival,
  updateFestival,
  deleteFestival,
  getActiveFestival,
  setActiveFestival,
  importLineup,
  refreshLineup,
  getFestivalBySlug
} from './operations';

// We need to override the module-level db with a fresh test instance
vi.mock('$lib/db', async () => {
  const { WhosOnDB } = await import('$lib/db');
  const db = new WhosOnDB();
  return { db, WhosOnDB };
});

// Get access to the mocked db for direct inspection
let db: WhosOnDB;

beforeEach(async () => {
  const mod = await import('$lib/db');
  db = mod.db as WhosOnDB;
  // Clear all tables
  await db.festivals.clear();
  await db.acts.clear();
  await db.highlights.clear();
  await db.festivalMaps.clear();
  await db.settings.clear();
});

const makeFestivalData = (overrides: Partial<Omit<Festival, 'id' | 'createdAt' | 'updatedAt'>> = {}): Omit<Festival, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: 'Test Fest',
  timezone: 'Europe/Amsterdam',
  dayBoundaryHour: 6,
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  ...overrides
});

const makeAct = (overrides: Partial<Omit<Act, 'id' | 'festivalId'>> = {}): Omit<Act, 'id' | 'festivalId'> => ({
  name: 'Test Band',
  stage: 'Main Stage',
  startTime: '2026-07-01T20:00:00',
  endTime: '2026-07-01T21:30:00',
  ...overrides
});

describe('createFestival', () => {
  it('persists festival and returns a numeric ID', async () => {
    const id = await createFestival(makeFestivalData());
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);

    const stored = await db.festivals.get(id);
    expect(stored?.name).toBe('Test Fest');
  });

  it('sets createdAt and updatedAt timestamps', async () => {
    const before = Date.now();
    const id = await createFestival(makeFestivalData());
    const after = Date.now();

    const stored = await db.festivals.get(id);
    expect(stored?.createdAt).toBeDefined();
    expect(stored?.updatedAt).toBeDefined();

    const createdAt = new Date(stored!.createdAt).getTime();
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
  });
});

describe('deleteFestival', () => {
  it('cascades: removes festival, acts, highlights, and festivalMap', async () => {
    const festivalId = await createFestival(makeFestivalData());

    const actId = (await db.acts.add({
      festivalId,
      name: 'Band',
      stage: 'Main',
      startTime: '2026-07-01T20:00:00',
      endTime: '2026-07-01T21:00:00'
    })) as number;

    await db.highlights.add({
      festivalId,
      actId,
      createdAt: new Date().toISOString()
    });

    await db.festivalMaps.put({
      festivalId,
      imageBlob: new Blob(['img']),
      updatedAt: new Date().toISOString()
    });

    await deleteFestival(festivalId);

    expect(await db.festivals.get(festivalId)).toBeUndefined();
    expect(await db.acts.where('festivalId').equals(festivalId).count()).toBe(0);
    expect(await db.highlights.where('festivalId').equals(festivalId).count()).toBe(0);
    expect(await db.festivalMaps.get(festivalId)).toBeUndefined();
  });

  it('does not affect other festivals data', async () => {
    const id1 = await createFestival(makeFestivalData({ name: 'Fest A' }));
    const id2 = await createFestival(makeFestivalData({ name: 'Fest B' }));

    await db.acts.add({ festivalId: id1, name: 'Band A', stage: 'Main', startTime: '2026-07-01T20:00:00', endTime: '2026-07-01T21:00:00' });
    await db.acts.add({ festivalId: id2, name: 'Band B', stage: 'Main', startTime: '2026-07-01T20:00:00', endTime: '2026-07-01T21:00:00' });

    await deleteFestival(id1);

    expect(await db.festivals.get(id2)).toBeDefined();
    expect(await db.acts.where('festivalId').equals(id2).count()).toBe(1);
  });
});

describe('importLineup', () => {
  it('bulk-inserts acts for a festival', async () => {
    const festivalId = await createFestival(makeFestivalData());
    const acts = [
      makeAct({ name: 'Band A' }),
      makeAct({ name: 'Band B' }),
      makeAct({ name: 'Band C' })
    ];

    await importLineup(festivalId, acts);

    const stored = await db.acts.where('festivalId').equals(festivalId).toArray();
    expect(stored).toHaveLength(3);
    expect(stored.map((a) => a.name).sort()).toEqual(['Band A', 'Band B', 'Band C']);
  });

  it('replaces existing acts for that festival', async () => {
    const festivalId = await createFestival(makeFestivalData());

    await importLineup(festivalId, [makeAct({ name: 'Old Band' })]);
    expect(await db.acts.where('festivalId').equals(festivalId).count()).toBe(1);

    await importLineup(festivalId, [
      makeAct({ name: 'New Band A' }),
      makeAct({ name: 'New Band B' })
    ]);

    const stored = await db.acts.where('festivalId').equals(festivalId).toArray();
    expect(stored).toHaveLength(2);
    expect(stored.map((a) => a.name)).not.toContain('Old Band');
  });

  it('does not affect acts of other festivals', async () => {
    const id1 = await createFestival(makeFestivalData({ name: 'Fest A' }));
    const id2 = await createFestival(makeFestivalData({ name: 'Fest B' }));

    await importLineup(id1, [makeAct({ name: 'Fest A Band' })]);
    await importLineup(id2, [makeAct({ name: 'Fest B Band' })]);

    // Re-import Fest A
    await importLineup(id1, [makeAct({ name: 'Fest A New Band' })]);

    const fest2Acts = await db.acts.where('festivalId').equals(id2).toArray();
    expect(fest2Acts).toHaveLength(1);
    expect(fest2Acts[0].name).toBe('Fest B Band');
  });
});

describe('setActiveFestival / getActiveFestival', () => {
  it('switch updates settings with activeFestivalId', async () => {
    const id = await createFestival(makeFestivalData());
    await setActiveFestival(id);

    const settings = await db.settings.toCollection().first();
    expect(settings?.activeFestivalId).toBe(id);
  });

  it('getActiveFestival returns the active festival', async () => {
    const id = await createFestival(makeFestivalData({ name: 'Active Fest' }));
    await setActiveFestival(id);

    const active = await getActiveFestival();
    expect(active?.name).toBe('Active Fest');
    expect(active?.id).toBe(id);
  });

  it('getActiveFestival returns undefined when no settings', async () => {
    const active = await getActiveFestival();
    expect(active).toBeUndefined();
  });

  it('updates existing settings when called multiple times', async () => {
    const id1 = await createFestival(makeFestivalData({ name: 'Fest A' }));
    const id2 = await createFestival(makeFestivalData({ name: 'Fest B' }));

    await setActiveFestival(id1);
    await setActiveFestival(id2);

    const settingsCount = await db.settings.count();
    expect(settingsCount).toBe(1);

    const active = await getActiveFestival();
    expect(active?.name).toBe('Fest B');
  });
});

describe('duplicate slug handling', () => {
  it('getFestivalBySlug returns festival with matching slug', async () => {
    const id = await createFestival(makeFestivalData({ clashfinderSlug: 'glastonbury-2026' }));
    await createFestival(makeFestivalData({ name: 'Other Fest' }));

    const found = await getFestivalBySlug('glastonbury-2026');
    expect(found?.id).toBe(id);
    expect(found?.clashfinderSlug).toBe('glastonbury-2026');
  });

  it('getFestivalBySlug returns undefined for unknown slug', async () => {
    await createFestival(makeFestivalData());
    const found = await getFestivalBySlug('nonexistent');
    expect(found).toBeUndefined();
  });
});

describe('refreshLineup', () => {
  it('throws if festival has no clashfinderSlug', async () => {
    const festivalId = await createFestival(makeFestivalData());
    await expect(refreshLineup(festivalId)).rejects.toThrow(
      'Festival has no Clashfinder slug configured'
    );
  });
});

describe('updateFestival', () => {
  it('updates festival fields and preserves createdAt', async () => {
    const id = await createFestival(makeFestivalData({ name: 'Original Name' }));
    const original = await db.festivals.get(id);

    await updateFestival(id, { name: 'Updated Name' });

    const updated = await db.festivals.get(id);
    expect(updated?.name).toBe('Updated Name');
    expect(typeof updated?.updatedAt).toBe('string');
    // createdAt should be preserved
    expect(updated?.createdAt).toBe(original?.createdAt);
  });
});
