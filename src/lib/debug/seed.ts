import { db } from '$lib/db';
import { createFestival, setActiveFestival, importLineup } from '$lib/features/festival/operations';

const STAGES = ['Main Stage', 'The Tent', 'Warehouse', 'Acoustic Garden', 'Late Night'];

const ACTS = [
	// Main Stage
	['The Midnight Runners', 'Velvet Crush', 'Solar Flare', 'Echo Chamber', 'Northern Lights',
	 'The Heavy Hitters', 'Ghost Signal', 'Crimson Tide', 'Starfall', 'Dawn Patrol'],
	// The Tent
	['Bass Therapy', 'Neon Jungle', 'Pixel Dreams', 'Subsonic', 'Waveform',
	 'Deep Current', 'Rhythm Section', 'Lowlight', 'Phase Shift', 'Undertow'],
	// Warehouse
	['DJ Helix', 'Techno Twins', 'Circuit Breaker', 'Voltage', 'Hard Reset',
	 'Binary Star', 'Overdrive', 'Frequency', 'Pulse Width', 'Dark Matter'],
	// Acoustic Garden
	['Willow & The Roots', 'Campfire Stories', 'Meadow Song', 'The Folk Road', 'Amber Light',
	 'River Stones', 'Gentle Thunder', 'Open Sky', 'Still Waters', 'Evening Chorus'],
	// Late Night
	['Club Noir', 'Afterhours Collective', '3AM Sessions', 'The Underworld', 'Nocturnal',
	 'Shadow Play', 'Witching Hour', 'Red Eye', 'Last Call', 'Sunrise Set']
];

/**
 * Generates a 3-day demo festival with acts centered around the current time.
 * Day 1 = yesterday, Day 2 = today, Day 3 = tomorrow.
 * Acts on "today" are spread so that some are currently playing.
 */
export async function seedDemoFestival(): Promise<number> {
	const now = new Date();
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// Festival runs yesterday through tomorrow
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);

	const festivalId = await createFestival({
		name: 'Demo Festival 2026',
		timezone: tz,
		dayBoundaryHour: 6,
		startDate: formatDate(yesterday),
		endDate: formatDate(tomorrow),
		theme: { preset: 'night-rave' },
		clashfinderSlug: undefined
	});

	await setActiveFestival(festivalId);

	const acts: Array<{ name: string; stage: string; startTime: string; endTime: string }> = [];

	for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
		const dayBase = new Date(now);
		dayBase.setDate(dayBase.getDate() + dayOffset);

		for (let stageIdx = 0; stageIdx < STAGES.length; stageIdx++) {
			const stage = STAGES[stageIdx];
			const stageActs = ACTS[stageIdx];

			// Each stage runs from 12:00 to 02:00 (14 hours), ~8 acts per day per stage
			const actsPerDay = 8;
			const startHour = stageIdx === 4 ? 22 : 12; // Late Night starts at 22:00
			const slotMinutes = stageIdx === 4 ? 90 : 105; // Late Night = 90min slots, others = 105min

			for (let i = 0; i < actsPerDay; i++) {
				const actIdx = ((dayOffset + 1) * actsPerDay + i) % stageActs.length;
				const actStart = new Date(dayBase);
				actStart.setHours(startHour, 0, 0, 0);
				actStart.setMinutes(actStart.getMinutes() + i * slotMinutes);

				const actEnd = new Date(actStart);
				actEnd.setMinutes(actEnd.getMinutes() + slotMinutes - 15); // 15min gap between acts

				acts.push({
					name: stageActs[actIdx],
					stage,
					startTime: formatLocalISO(actStart),
					endTime: formatLocalISO(actEnd)
				});
			}
		}
	}

	await importLineup(festivalId, acts);
	return festivalId;
}

/** Delete demo festival if it exists. */
export async function clearDemoFestival(): Promise<void> {
	const all = await db.festivals.toArray();
	for (const f of all) {
		if (f.name === 'Demo Festival 2026' && f.id) {
			const { deleteFestival } = await import('$lib/features/festival/operations');
			await deleteFestival(f.id);
		}
	}
}

function formatDate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatLocalISO(d: Date): string {
	return `${formatDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n: number): string {
	return n.toString().padStart(2, '0');
}
