<script lang="ts">
	import { db } from '$lib/db';
	import { useLiveQuery } from '$lib/db/live.svelte';
	import { getPlayingNow, getUpNext } from '$lib/features/schedule/utils';
	import { TZDate } from '@date-fns/tz';
	import { format, formatDistanceToNow } from 'date-fns';
	import type { Act, UserHighlight } from '$lib/types';

	const UP_NEXT_WINDOW_MINUTES = 60;
	const REFRESH_INTERVAL_MS = 60_000;

	// Load data from DB
	const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);
	const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), []);

	// Derived active festival id
	const activeFestivalId = $derived(settingsQuery.value?.activeFestivalId);

	// Reactive acts + highlights based on activeFestivalId
	const actsQuery = useLiveQuery(
		() =>
			activeFestivalId != null
				? db.acts.where('festivalId').equals(activeFestivalId).toArray()
				: Promise.resolve([]),
		[]
	);
	const highlightsQuery = useLiveQuery(
		() =>
			activeFestivalId != null
				? db.highlights.where('festivalId').equals(activeFestivalId).toArray()
				: Promise.resolve([]),
		[]
	);

	// Current time — refreshed every 60 seconds
	let now = $state(new Date());

	$effect(() => {
		const id = setInterval(() => {
			now = new Date();
		}, REFRESH_INTERVAL_MS);
		return () => clearInterval(id);
	});

	const festival = $derived(
		festivalsQuery.value?.find((f) => f.id === activeFestivalId)
	);

	// Map of actId → UserHighlight for quick lookup
	const highlightMap = $derived(
		new Map((highlightsQuery.value ?? []).map((h: UserHighlight) => [h.actId, h]))
	);

	type FestivalState = 'not_started' | 'active' | 'over' | 'no_festival';

	const festivalState = $derived.by((): FestivalState => {
		if (!festival) return 'no_festival';
		const tz = festival.timezone;
		// Parse festival dates in festival timezone (start of startDate, end of endDate)
		const [sy, sm, sd] = festival.startDate.split('-').map(Number);
		const [ey, em, ed] = festival.endDate.split('-').map(Number);
		// Festival starts at midnight of startDate in festival tz, ends at end of endDate
		const festStart = TZDate.tz(tz, sy, sm - 1, sd, 0, 0, 0);
		const festEnd = TZDate.tz(tz, ey, em - 1, ed + 1, 0, 0, 0); // next day midnight
		if (now < festStart) return 'not_started';
		if (now >= festEnd) return 'over';
		return 'active';
	});

	// Sort acts: highlighted (by priority asc) first, then rest
	function sortWithHighlightsFirst(acts: Act[]): Act[] {
		return [...acts].sort((a, b) => {
			const ha = a.id != null ? highlightMap.get(a.id) : undefined;
			const hb = b.id != null ? highlightMap.get(b.id) : undefined;
			if (ha && !hb) return -1;
			if (!ha && hb) return 1;
			if (ha && hb) {
				const pa = ha.priority ?? 99;
				const pb = hb.priority ?? 99;
				return pa - pb;
			}
			return 0;
		});
	}

	const playingNow = $derived.by(() => {
		if (festivalState !== 'active' || !festival) return [];
		const acts = getPlayingNow(actsQuery.value ?? [], now, festival);
		return sortWithHighlightsFirst(acts);
	});

	const upNext = $derived.by(() => {
		if (festivalState !== 'active' || !festival) return [];
		const acts = getUpNext(actsQuery.value ?? [], now, UP_NEXT_WINDOW_MINUTES, festival);
		return sortWithHighlightsFirst(acts);
	});

	// Countdown to next highlighted act
	const nextHighlightedAct = $derived.by(() => {
		if (!festival || festivalState !== 'active') return undefined;
		const allFuture = (actsQuery.value ?? [])
			.filter((a) => {
				if (a.id == null || !highlightMap.has(a.id)) return false;
				// Must not be currently playing — starts in the future
				return a.startTime > format(now, "yyyy-MM-dd'T'HH:mm:ss");
			})
			.sort((a, b) => a.startTime.localeCompare(b.startTime));
		return allFuture[0];
	});

	function formatCountdown(targetIso: string, tz: string): string {
		const [datePart, timePart] = targetIso.split('T');
		const [y, m, d] = datePart.split('-').map(Number);
		const [h, min, s = 0] = timePart.split(':').map(Number);
		const target = TZDate.tz(tz, y, m - 1, d, h, min, s);
		const diffMs = target.getTime() - now.getTime();
		if (diffMs <= 0) return 'now';
		const totalMinutes = Math.floor(diffMs / 60_000);
		const hours = Math.floor(totalMinutes / 60);
		const mins = totalMinutes % 60;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function formatTime(isoString: string, tz: string): string {
		const [datePart, timePart] = isoString.split('T');
		const [y, m, d] = datePart.split('-').map(Number);
		const [h, min] = timePart.split(':').map(Number);
		const tzDate = TZDate.tz(tz, y, m - 1, d, h, min, 0);
		return format(tzDate, 'HH:mm');
	}

	function getHighlight(act: Act): UserHighlight | undefined {
		if (act.id == null) return undefined;
		return highlightMap.get(act.id);
	}

	function priorityClass(priority: number | undefined): string {
		if (priority === 1) return 'badge-warning';
		if (priority === 2) return 'badge-success';
		return 'badge-info';
	}

	function priorityLabel(priority: number | undefined): string {
		if (priority === 1) return '🔥';
		if (priority === 2) return '👍';
		return '🤷';
	}

	const festivalStartCountdown = $derived.by(() => {
		if (!festival) return '';
		const [y, m, d] = festival.startDate.split('-').map(Number);
		const target = TZDate.tz(festival.timezone, y, m - 1, d, 0, 0, 0);
		return formatDistanceToNow(target, { addSuffix: true });
	});
</script>

<div class="p-4 pb-6">
	<h1 class="mb-4 text-2xl font-bold">Now</h1>

	{#if festivalState === 'no_festival'}
		<div class="flex flex-col items-center justify-center py-12 text-center">
			<p class="text-base-content/60 text-sm">No festival selected.</p>
			<a href="/settings/" class="btn btn-primary btn-sm mt-3">Go to Settings</a>
		</div>

	{:else if festivalState === 'not_started'}
		<div class="card bg-base-200 p-6 text-center">
			<div class="text-4xl mb-2">🎪</div>
			<h2 class="text-lg font-semibold">Festival hasn't started yet</h2>
			<p class="text-base-content/60 mt-1 text-sm">{festival!.name}</p>
			<p class="text-base-content/60 mt-3 text-sm">Starts {festivalStartCountdown}</p>
		</div>

	{:else if festivalState === 'over'}
		<div class="card bg-base-200 p-6 text-center">
			<div class="text-4xl mb-2">🌅</div>
			<h2 class="text-lg font-semibold">Festival is over</h2>
			<p class="text-base-content/60 mt-1 text-sm">{festival!.name} — see you next year!</p>
			{#if (highlightsQuery.value ?? []).length > 0}
				<p class="text-base-content/60 mt-3 text-sm">
					You highlighted {(highlightsQuery.value ?? []).length} act{(highlightsQuery.value ?? []).length !== 1 ? 's' : ''}
				</p>
			{/if}
		</div>

	{:else}
		<!-- Active festival -->

		<!-- Countdown to next highlighted act -->
		{#if nextHighlightedAct}
			<div class="alert alert-info mb-4">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-5 w-5 shrink-0 stroke-current">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span class="text-sm">
					<strong>{nextHighlightedAct.name}</strong> starts in
					<strong>{formatCountdown(nextHighlightedAct.startTime, festival!.timezone)}</strong>
					at {nextHighlightedAct.stage}
				</span>
			</div>
		{/if}

		<!-- Playing Now -->
		<section class="mb-6">
			<h2 class="mb-3 text-lg font-semibold">Playing Now</h2>
			{#if playingNow.length === 0}
				<p class="text-base-content/50 text-sm">Nothing playing right now.</p>
			{:else}
				<ul class="space-y-2">
					{#each playingNow as act (act.id)}
						{@const highlight = getHighlight(act)}
						<li class="bg-base-200 rounded-xl p-3 {highlight ? 'border-l-4 border-warning' : ''}">
							<div class="flex items-center justify-between gap-2">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="truncate font-semibold">{act.name}</span>
										{#if highlight?.priority}
											<span class="badge badge-sm {priorityClass(highlight.priority)}">{priorityLabel(highlight.priority)}</span>
										{/if}
									</div>
									<div class="text-base-content/70 mt-0.5 text-sm font-medium">{act.stage}</div>
									<div class="text-base-content/50 text-xs">
										{formatTime(act.startTime, festival!.timezone)} – {formatTime(act.endTime, festival!.timezone)}
									</div>
								</div>
								<div class="badge badge-success shrink-0">LIVE</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<!-- Up Next -->
		<section>
			<h2 class="mb-3 text-lg font-semibold">Up Next <span class="text-base-content/40 text-sm font-normal">(next {UP_NEXT_WINDOW_MINUTES} min)</span></h2>
			{#if upNext.length === 0}
				<p class="text-base-content/50 text-sm">Nothing coming up in the next {UP_NEXT_WINDOW_MINUTES} minutes.</p>
			{:else}
				<ul class="space-y-2">
					{#each upNext as act (act.id)}
						{@const highlight = getHighlight(act)}
						<li class="bg-base-200 rounded-xl p-3 {highlight ? 'border-l-4 border-warning' : ''}">
							<div class="flex items-center justify-between gap-2">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<span class="truncate font-semibold">{act.name}</span>
										{#if highlight?.priority}
											<span class="badge badge-sm {priorityClass(highlight.priority)}">{priorityLabel(highlight.priority)}</span>
										{/if}
									</div>
									<div class="text-base-content/70 mt-0.5 text-sm font-medium">{act.stage}</div>
									<div class="text-base-content/50 text-xs">
										{formatTime(act.startTime, festival!.timezone)} · in {formatCountdown(act.startTime, festival!.timezone)}
									</div>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</div>
