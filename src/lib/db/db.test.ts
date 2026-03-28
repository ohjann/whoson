import { describe, it, expect, beforeEach } from 'vitest';
import { WhosOnDB } from './index';
import type { Festival, Act, UserHighlight, AppSettings } from '$lib/types';

let db: WhosOnDB;

beforeEach(() => {
  // Each test gets a fresh database instance with fake-indexeddb
  db = new WhosOnDB();
});

const makeFestival = (): Festival => ({
  name: 'Test Fest',
  timezone: 'Europe/Amsterdam',
  dayBoundaryHour: 6,
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

describe('WhosOnDB', () => {
  it('opens without errors', async () => {
    await expect(db.open()).resolves.toBeDefined();
  });

  it('can add and retrieve a festival', async () => {
    const festival: Festival = {
      name: 'Glastonbury',
      timezone: 'Europe/London',
      dayBoundaryHour: 6,
      startDate: '2026-06-25',
      endDate: '2026-06-29',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const id = (await db.festivals.add(festival)) as number;
    expect(id).toBeGreaterThan(0);

    const retrieved = await db.festivals.get(id);
    expect(retrieved?.name).toBe('Glastonbury');
    expect(retrieved?.timezone).toBe('Europe/London');
    expect(retrieved?.dayBoundaryHour).toBe(6);
  });

  it('festival has no mapImageBlob field', async () => {
    const festival: Festival = makeFestival();
    // TypeScript will error at compile time if mapImageBlob exists on Festival
    expect('mapImageBlob' in festival).toBe(false);
  });

  it('can add and retrieve an act with compound index queries', async () => {
    const festivalId = (await db.festivals.add(makeFestival())) as number;

    const act: Act = {
      festivalId,
      name: 'The Test Band',
      stage: 'Main Stage',
      startTime: '2026-07-01T20:00:00',
      endTime: '2026-07-01T21:30:00'
    };
    await db.acts.add(act);

    const byStage = await db.acts.where('[festivalId+stage]').equals([festivalId, 'Main Stage']).toArray();
    expect(byStage).toHaveLength(1);
    expect(byStage[0].name).toBe('The Test Band');

    const byTime = await db.acts.where('[festivalId+startTime]').equals([festivalId, '2026-07-01T20:00:00']).toArray();
    expect(byTime).toHaveLength(1);
  });

  it('can add a highlight with compound index', async () => {
    const festivalId = (await db.festivals.add(makeFestival())) as number;

    const act: Act = {
      festivalId,
      name: 'The Test Band',
      stage: 'Main Stage',
      startTime: '2026-07-01T20:00:00',
      endTime: '2026-07-01T21:30:00'
    };
    const actId = (await db.acts.add(act)) as number;

    const highlight: UserHighlight = {
      festivalId,
      actId,
      priority: 1,
      createdAt: new Date().toISOString()
    };
    await db.highlights.add(highlight);

    const found = await db.highlights.where('[festivalId+actId]').equals([festivalId, actId]).toArray();
    expect(found).toHaveLength(1);
    expect(found[0].priority).toBe(1);
  });

  it('can store a festivalMap separately from festival', async () => {
    const festivalId = (await db.festivals.add(makeFestival())) as number;

    const blob = new Blob(['fake image data'], { type: 'image/png' });
    await db.festivalMaps.put({
      festivalId,
      imageBlob: blob,
      updatedAt: new Date().toISOString()
    });

    const map = await db.festivalMaps.get(festivalId);
    expect(map?.festivalId).toBe(festivalId);

    // Fetching the festival should NOT include blob data
    const festival = await db.festivals.get(festivalId);
    expect(festival).not.toHaveProperty('imageBlob');
  });

  it('can store app settings', async () => {
    const settings: AppSettings = {
      clashfinderUsername: 'testuser',
      notificationsEnabled: true
    };
    const id = (await db.settings.add(settings)) as number;
    const retrieved = await db.settings.get(id);
    expect(retrieved?.clashfinderUsername).toBe('testuser');
    expect(retrieved?.notificationsEnabled).toBe(true);
  });
});
