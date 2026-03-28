import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '$lib/db';
import type { UserHighlight } from '$lib/types';
import {
  toggleHighlight,
  isHighlighted,
  getHighlightsForFestival,
  updateHighlightPriority,
  updateHighlightNotes
} from './operations';

beforeEach(async () => {
  // Clear highlights before each test
  await db.highlights.clear();
});

describe('toggleHighlight', () => {
  it('adds a highlight on first call', async () => {
    await toggleHighlight(1, 10);
    const all = await db.highlights.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].festivalId).toBe(1);
    expect(all[0].actId).toBe(10);
  });

  it('removes the highlight on second call (toggle off)', async () => {
    await toggleHighlight(1, 10);
    await toggleHighlight(1, 10);
    const all = await db.highlights.toArray();
    expect(all).toHaveLength(0);
  });

  it('does not affect other highlights when toggling', async () => {
    await toggleHighlight(1, 10);
    await toggleHighlight(1, 20);
    await toggleHighlight(1, 10); // remove 10
    const all = await db.highlights.toArray();
    expect(all).toHaveLength(1);
    expect(all[0].actId).toBe(20);
  });
});

describe('isHighlighted', () => {
  it('returns false when act is not highlighted', async () => {
    expect(await isHighlighted(1, 10)).toBe(false);
  });

  it('returns true after highlighting', async () => {
    await toggleHighlight(1, 10);
    expect(await isHighlighted(1, 10)).toBe(true);
  });

  it('returns false after toggling off', async () => {
    await toggleHighlight(1, 10);
    await toggleHighlight(1, 10);
    expect(await isHighlighted(1, 10)).toBe(false);
  });
});

describe('updateHighlightPriority', () => {
  it('sets priority on an existing highlight', async () => {
    await toggleHighlight(1, 10);
    await updateHighlightPriority(1, 10, 1);
    const h = await db.highlights.where('[festivalId+actId]').equals([1, 10]).first();
    expect(h?.priority).toBe(1);
  });

  it('can update priority to each level', async () => {
    await toggleHighlight(1, 10);
    for (const p of [1, 2, 3] as const) {
      await updateHighlightPriority(1, 10, p);
      const h = await db.highlights.where('[festivalId+actId]').equals([1, 10]).first();
      expect(h?.priority).toBe(p);
    }
  });

  it('does nothing if highlight does not exist', async () => {
    // Should not throw
    await expect(updateHighlightPriority(1, 99, 1)).resolves.not.toThrow();
  });
});

describe('updateHighlightNotes', () => {
  it('sets notes on an existing highlight', async () => {
    await toggleHighlight(1, 10);
    await updateHighlightNotes(1, 10, 'Great band!');
    const h = await db.highlights.where('[festivalId+actId]').equals([1, 10]).first();
    expect(h?.notes).toBe('Great band!');
  });

  it('can update notes', async () => {
    await toggleHighlight(1, 10);
    await updateHighlightNotes(1, 10, 'First note');
    await updateHighlightNotes(1, 10, 'Updated note');
    const h = await db.highlights.where('[festivalId+actId]').equals([1, 10]).first();
    expect(h?.notes).toBe('Updated note');
  });

  it('does nothing if highlight does not exist', async () => {
    await expect(updateHighlightNotes(1, 99, 'note')).resolves.not.toThrow();
  });
});

describe('getHighlightsForFestival', () => {
  it('returns an Observable that resolves to highlights for the festival', async () => {
    await toggleHighlight(1, 10);
    await toggleHighlight(1, 20);
    await toggleHighlight(2, 30); // different festival

    const observable = getHighlightsForFestival(1);
    const highlights = await new Promise<UserHighlight[]>((resolve) => {
      const sub = observable.subscribe({
        next: (v) => {
          resolve(v as UserHighlight[]);
          sub.unsubscribe();
        },
        error: (e: unknown) => { throw e; }
      });
    });

    expect(highlights).toHaveLength(2);
    expect(highlights.map((h: UserHighlight) => h.actId).sort()).toEqual([10, 20]);
  });
});
