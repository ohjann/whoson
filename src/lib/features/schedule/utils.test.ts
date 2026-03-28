import { describe, it, expect } from 'vitest';
import type { Act, Festival, UserHighlight } from '$lib/types';
import {
	groupActsByDate,
	findOverlaps,
	getPlayingNow,
	getUpNext,
	getHighlightedActs,
	searchActs
} from './utils';

// Minimal festival fixtures
const festivalAMS: Pick<Festival, 'timezone' | 'dayBoundaryHour'> = {
	timezone: 'Europe/Amsterdam',
	dayBoundaryHour: 6
};

function makeAct(overrides: Partial<Act> & { startTime: string; endTime: string }): Act {
	return {
		id: overrides.id ?? 1,
		festivalId: 1,
		name: overrides.name ?? 'Test Act',
		stage: overrides.stage ?? 'Main Stage',
		startTime: overrides.startTime,
		endTime: overrides.endTime,
		description: overrides.description,
		genre: overrides.genre
	};
}

// ── groupActsByDate ─────────────────────────────────────────────────────────

describe('groupActsByDate', () => {
	it('groups acts on the same festival day', () => {
		const act1 = makeAct({ id: 1, name: 'A', startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });
		const act2 = makeAct({ id: 2, name: 'B', startTime: '2026-08-15T20:00:00', endTime: '2026-08-15T21:00:00' });
		const groups = groupActsByDate([act1, act2], festivalAMS);
		expect(groups.size).toBe(1);
		expect(groups.get('2026-08-15')).toHaveLength(2);
	});

	it('groups midnight-crossing act (2 AM) with the previous calendar day', () => {
		// Act starts at 2 AM on Aug 16 — before dayBoundaryHour (6) — belongs to Aug 15
		const lateAct = makeAct({ id: 1, name: 'Late', startTime: '2026-08-16T02:00:00', endTime: '2026-08-16T03:30:00' });
		const groups = groupActsByDate([lateAct], festivalAMS);
		expect(groups.has('2026-08-15')).toBe(true);
		expect(groups.has('2026-08-16')).toBe(false);
	});

	it('an act starting exactly at dayBoundaryHour stays on its calendar day', () => {
		const act = makeAct({ id: 1, name: 'Morning', startTime: '2026-08-16T06:00:00', endTime: '2026-08-16T07:00:00' });
		const groups = groupActsByDate([act], festivalAMS);
		expect(groups.has('2026-08-16')).toBe(true);
	});

	it('separates acts across two festival days', () => {
		const day1Act = makeAct({ id: 1, startTime: '2026-08-15T18:00:00', endTime: '2026-08-15T19:00:00' });
		const day2Act = makeAct({ id: 2, startTime: '2026-08-16T18:00:00', endTime: '2026-08-16T19:00:00' });
		const groups = groupActsByDate([day1Act, day2Act], festivalAMS);
		expect(groups.size).toBe(2);
	});

	it('sorts acts within each day by start time', () => {
		const actB = makeAct({ id: 2, name: 'B', startTime: '2026-08-15T20:00:00', endTime: '2026-08-15T21:00:00' });
		const actA = makeAct({ id: 1, name: 'A', startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });
		const groups = groupActsByDate([actB, actA], festivalAMS);
		const day = groups.get('2026-08-15')!;
		expect(day[0].name).toBe('A');
		expect(day[1].name).toBe('B');
	});

	it('returns empty map for empty input', () => {
		expect(groupActsByDate([], festivalAMS).size).toBe(0);
	});
});

// ── findOverlaps ────────────────────────────────────────────────────────────

describe('findOverlaps', () => {
	it('detects overlapping acts', () => {
		const a = makeAct({ id: 1, name: 'A', startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:30:00' });
		const b = makeAct({ id: 2, name: 'B', startTime: '2026-08-15T15:00:00', endTime: '2026-08-15T16:00:00' });
		const overlaps = findOverlaps([a, b]);
		expect(overlaps).toHaveLength(1);
		expect(overlaps[0]).toEqual([a, b]);
	});

	it('touching boundaries (A.end === B.start) are NOT overlaps', () => {
		const a = makeAct({ id: 1, startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });
		const b = makeAct({ id: 2, startTime: '2026-08-15T15:00:00', endTime: '2026-08-15T16:00:00' });
		expect(findOverlaps([a, b])).toHaveLength(0);
	});

	it('non-overlapping acts with gap produce no overlaps', () => {
		const a = makeAct({ id: 1, startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });
		const b = makeAct({ id: 2, startTime: '2026-08-15T16:00:00', endTime: '2026-08-15T17:00:00' });
		expect(findOverlaps([a, b])).toHaveLength(0);
	});

	it('act fully contained within another is an overlap', () => {
		const outer = makeAct({ id: 1, startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T17:00:00' });
		const inner = makeAct({ id: 2, startTime: '2026-08-15T15:00:00', endTime: '2026-08-15T16:00:00' });
		expect(findOverlaps([outer, inner])).toHaveLength(1);
	});

	it('returns empty array for empty input', () => {
		expect(findOverlaps([])).toHaveLength(0);
	});

	it('returns empty array for single act', () => {
		const a = makeAct({ id: 1, startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });
		expect(findOverlaps([a])).toHaveLength(0);
	});
});

// ── getPlayingNow ───────────────────────────────────────────────────────────

describe('getPlayingNow', () => {
	// Festival is Europe/Amsterdam (UTC+2 in summer)
	// Act stored as "2026-08-15T14:00:00" means 14:00 Amsterdam = 12:00 UTC
	const act = makeAct({ id: 1, startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });

	it('returns act when now is between start and end', () => {
		// 14:30 Amsterdam = 12:30 UTC
		const now = new Date('2026-08-15T12:30:00Z');
		expect(getPlayingNow([act], now, festivalAMS)).toContain(act);
	});

	it('returns act when now is exactly at start (inclusive)', () => {
		const now = new Date('2026-08-15T12:00:00Z');
		expect(getPlayingNow([act], now, festivalAMS)).toContain(act);
	});

	it('does NOT return act when now is exactly at end (exclusive)', () => {
		const now = new Date('2026-08-15T13:00:00Z');
		expect(getPlayingNow([act], now, festivalAMS)).toHaveLength(0);
	});

	it('does NOT return act when now is before start', () => {
		const now = new Date('2026-08-15T11:00:00Z');
		expect(getPlayingNow([act], now, festivalAMS)).toHaveLength(0);
	});

	it('does NOT return act when now is after end', () => {
		const now = new Date('2026-08-15T14:00:00Z');
		expect(getPlayingNow([act], now, festivalAMS)).toHaveLength(0);
	});

	it('returns empty array for empty acts', () => {
		const now = new Date('2026-08-15T12:30:00Z');
		expect(getPlayingNow([], now, festivalAMS)).toHaveLength(0);
	});
});

// ── getUpNext ───────────────────────────────────────────────────────────────

describe('getUpNext', () => {
	// Act at 14:00 Amsterdam = 12:00 UTC
	const act = makeAct({ id: 1, startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });

	it('returns act starting within the window', () => {
		// now is 11:45 UTC (15 min before 12:00 UTC = 14:00 Amsterdam)
		const now = new Date('2026-08-15T11:45:00Z');
		expect(getUpNext([act], now, 30, festivalAMS)).toContain(act);
	});

	it('does NOT return act starting after the window', () => {
		const now = new Date('2026-08-15T11:00:00Z');
		expect(getUpNext([act], now, 30, festivalAMS)).toHaveLength(0);
	});

	it('does NOT return act that has already started', () => {
		const now = new Date('2026-08-15T12:30:00Z');
		expect(getUpNext([act], now, 30, festivalAMS)).toHaveLength(0);
	});

	it('returns act exactly at the window boundary', () => {
		// Act at 12:00 UTC, now is 11:30 UTC → exactly 30 min window
		const now = new Date('2026-08-15T11:30:00Z');
		expect(getUpNext([act], now, 30, festivalAMS)).toContain(act);
	});

	it('returns empty array for empty acts', () => {
		const now = new Date('2026-08-15T11:45:00Z');
		expect(getUpNext([], now, 30, festivalAMS)).toHaveLength(0);
	});
});

// ── getHighlightedActs ──────────────────────────────────────────────────────

describe('getHighlightedActs', () => {
	const act1 = makeAct({ id: 1, startTime: '2026-08-15T14:00:00', endTime: '2026-08-15T15:00:00' });
	const act2 = makeAct({ id: 2, startTime: '2026-08-15T16:00:00', endTime: '2026-08-15T17:00:00' });

	const highlight: UserHighlight = {
		id: 1,
		festivalId: 1,
		actId: 1,
		createdAt: '2026-01-01T00:00:00Z'
	};

	it('returns only highlighted acts', () => {
		const result = getHighlightedActs([act1, act2], [highlight]);
		expect(result).toContain(act1);
		expect(result).not.toContain(act2);
	});

	it('returns empty array when no highlights', () => {
		expect(getHighlightedActs([act1, act2], [])).toHaveLength(0);
	});

	it('returns empty array when acts list is empty', () => {
		expect(getHighlightedActs([], [highlight])).toHaveLength(0);
	});
});

// ── searchActs ──────────────────────────────────────────────────────────────

describe('searchActs', () => {
	const acts: Act[] = [
		makeAct({ id: 1, name: 'The Prodigy', startTime: '2026-08-15T20:00:00', endTime: '2026-08-15T21:30:00', description: 'Electronic music legends', genre: 'electronic' }),
		makeAct({ id: 2, name: 'Radiohead', startTime: '2026-08-15T22:00:00', endTime: '2026-08-15T23:30:00', description: 'Alternative rock band', genre: 'alternative' }),
		makeAct({ id: 3, name: 'Daft Punk', startTime: '2026-08-16T00:00:00', endTime: '2026-08-16T02:00:00' })
	];

	it('returns all acts for empty query', () => {
		expect(searchActs(acts, '')).toHaveLength(3);
	});

	it('returns all acts for whitespace-only query', () => {
		expect(searchActs(acts, '   ')).toHaveLength(3);
	});

	it('matches by name (case-insensitive)', () => {
		const result = searchActs(acts, 'prodigy');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('The Prodigy');
	});

	it('matches by name regardless of case', () => {
		expect(searchActs(acts, 'RADIOHEAD')).toHaveLength(1);
	});

	it('matches by description', () => {
		const result = searchActs(acts, 'legends');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('The Prodigy');
	});

	it('matches by genre', () => {
		const result = searchActs(acts, 'alternative');
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe('Radiohead');
	});

	it('returns empty array when no match', () => {
		expect(searchActs(acts, 'zzznomatch')).toHaveLength(0);
	});

	it('returns empty array for empty acts', () => {
		expect(searchActs([], 'prodigy')).toHaveLength(0);
	});
});
