import { TZDate } from '@date-fns/tz';
import type { Act, Festival, UserHighlight } from '$lib/types';

/**
 * Parses a festival-local ISO string (no timezone offset) into a TZDate
 * anchored to the festival's timezone.
 *
 * This is necessary because `new TZDate(string, tz)` interprets strings
 * without an offset as device-local time. Using TZDate.tz with explicit
 * date parts ensures the time is interpreted as festival-local.
 */
function parseLocalTime(isoString: string, timezone: string): TZDate {
	const [datePart, timePart] = isoString.split('T');
	const [year, month, day] = datePart.split('-').map(Number);
	const [hour, minute, second = 0] = timePart.split(':').map(Number);
	return TZDate.tz(timezone, year, month - 1, day, hour, minute, second);
}

/**
 * Groups acts by festival day, respecting the dayBoundaryHour.
 * Acts before dayBoundaryHour (e.g. 2 AM with boundary 6 AM) belong to the previous day.
 * Times are interpreted in the festival's timezone.
 *
 * @returns Map<"yyyy-MM-dd", Act[]> sorted by start time within each day
 */
export function groupActsByDate(
	acts: Act[],
	festival: Pick<Festival, 'timezone' | 'dayBoundaryHour'>
): Map<string, Act[]> {
	const { timezone, dayBoundaryHour } = festival;
	const groups = new Map<string, Act[]>();

	for (const act of acts) {
		const startTZ = parseLocalTime(act.startTime, timezone);

		// Subtract dayBoundaryHour hours so acts before the boundary roll back to previous day
		const adjustedMs = startTZ.getTime() - dayBoundaryHour * 60 * 60 * 1000;
		const adjustedTZ = new TZDate(adjustedMs, timezone);

		const y = adjustedTZ.getFullYear();
		const m = String(adjustedTZ.getMonth() + 1).padStart(2, '0');
		const d = String(adjustedTZ.getDate()).padStart(2, '0');
		const festivalDay = `${y}-${m}-${d}`;

		if (!groups.has(festivalDay)) {
			groups.set(festivalDay, []);
		}
		groups.get(festivalDay)!.push(act);
	}

	// Sort acts within each day by start time (ISO string comparison is valid here)
	for (const dayActs of groups.values()) {
		dayActs.sort((a, b) => a.startTime.localeCompare(b.startTime));
	}

	return groups;
}

/**
 * Finds pairs of acts whose time ranges overlap.
 * Acts where A.end === B.start are NOT considered overlapping.
 */
export function findOverlaps(acts: Act[]): Array<[Act, Act]> {
	const overlaps: Array<[Act, Act]> = [];

	for (let i = 0; i < acts.length; i++) {
		for (let j = i + 1; j < acts.length; j++) {
			const a = acts[i];
			const b = acts[j];
			// Overlap: a starts before b ends AND b starts before a ends
			// Touching boundaries (a.end === b.start) are NOT overlaps
			if (a.startTime < b.endTime && b.startTime < a.endTime) {
				overlaps.push([a, b]);
			}
		}
	}

	return overlaps;
}

/**
 * Returns acts that are currently playing at `now`.
 * startTime <= now < endTime (end boundary is exclusive).
 * Times are interpreted in the festival's timezone.
 */
export function getPlayingNow(
	acts: Act[],
	now: Date,
	festival: Pick<Festival, 'timezone'>
): Act[] {
	return acts.filter((act) => {
		const start = parseLocalTime(act.startTime, festival.timezone);
		const end = parseLocalTime(act.endTime, festival.timezone);
		return start <= now && now < end;
	});
}

/**
 * Returns acts starting within the next `windowMinutes` from `now`.
 * Acts that have already started are excluded.
 * Times are interpreted in the festival's timezone.
 */
export function getUpNext(
	acts: Act[],
	now: Date,
	windowMinutes: number,
	festival: Pick<Festival, 'timezone'>
): Act[] {
	const windowMs = windowMinutes * 60 * 1000;
	return acts.filter((act) => {
		const start = parseLocalTime(act.startTime, festival.timezone);
		const delta = start.getTime() - now.getTime();
		return delta > 0 && delta <= windowMs;
	});
}

/**
 * Groups overlapping acts into transitive clash groups.
 * If A clashes with B and B clashes with C, all three are in one group.
 */
export function groupClashes(pairs: Array<[Act, Act]>): Act[][] {
	const parent = new Map<number, number>();

	function find(id: number): number {
		if (!parent.has(id)) parent.set(id, id);
		if (parent.get(id) !== id) parent.set(id, find(parent.get(id)!));
		return parent.get(id)!;
	}

	function union(a: number, b: number) {
		const ra = find(a);
		const rb = find(b);
		if (ra !== rb) parent.set(ra, rb);
	}

	const actMap = new Map<number, Act>();
	for (const [a, b] of pairs) {
		if (a.id != null && b.id != null) {
			actMap.set(a.id, a);
			actMap.set(b.id, b);
			union(a.id, b.id);
		}
	}

	const groups = new Map<number, Act[]>();
	for (const [id, act] of actMap) {
		const root = find(id);
		if (!groups.has(root)) groups.set(root, []);
		groups.get(root)!.push(act);
	}

	// Sort each group by start time
	for (const group of groups.values()) {
		group.sort((a, b) => a.startTime.localeCompare(b.startTime));
	}

	return Array.from(groups.values());
}

/**
 * Filters acts to those that have a corresponding UserHighlight entry.
 */
export function getHighlightedActs(acts: Act[], highlights: UserHighlight[]): Act[] {
	const highlightedIds = new Set(highlights.map((h) => h.actId));
	return acts.filter((act) => act.id !== undefined && highlightedIds.has(act.id));
}

/**
 * Searches acts by name (case-insensitive), description, and genre.
 * Returns all acts if query is blank.
 */
export function searchActs(acts: Act[], query: string): Act[] {
	const q = query.trim().toLowerCase();
	if (!q) return acts;

	return acts.filter(
		(act) =>
			act.name.toLowerCase().includes(q) ||
			(act.description?.toLowerCase().includes(q) ?? false) ||
			(act.genre?.toLowerCase().includes(q) ?? false)
	);
}
