<script lang="ts">
	import { useLiveQuery } from '$lib/db/live.svelte';
	import { db } from '$lib/db';
	import {
		updateSettings,
		clearAllData
	} from '$lib/features/settings/operations';
	import { setActiveFestival, updateFestival } from '$lib/features/festival/operations';
	import { applyFestivalTheme } from '$lib/features/theme/index.js';
	import ThemePicker from '$lib/features/theme/ThemePicker.svelte';
	import { addToast } from '$lib/features/notifications/toasts.svelte.js';
	import { exportHighlightsAsJson } from '$lib/features/export';
	import { syncFestivalLineup } from '$lib/features/sync/clashfinder-sync';
	import { setSyncing } from '$lib/features/sync/sync-state.svelte';
	import { getNow, setTimeOffset, resetTime, isTimeShifted, jumpTo } from '$lib/debug/time.svelte';
	import type { Festival, FestivalTheme, Act, UserHighlight } from '$lib/types';

	let syncingNow = $state(false);

	async function handleSyncNow() {
		if (!activeFestival) return;
		syncingNow = true;
		setSyncing(true);
		try {
			const result = await syncFestivalLineup(activeFestival);
			if (result.error) {
				addToast({ title: 'Sync failed', message: result.error });
			} else if (result.changed) {
				const parts: string[] = [];
				if (result.added.length) parts.push(`${result.added.length} added`);
				if (result.removed.length) parts.push(`${result.removed.length} removed`);
				if (result.moved.length) parts.push(`${result.moved.length} changed`);
				addToast({ title: 'Schedule updated', message: parts.join(', ') });
			} else {
				addToast({ title: 'Up to date', message: 'No changes found.' });
			}
		} catch {
			addToast({ title: 'Sync failed', message: 'Unable to reach Clashfinder.' });
		} finally {
			syncingNow = false;
			setSyncing(false);
		}
	}

	const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), [] as Festival[]);
	const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);
	const highlightsQuery = useLiveQuery(() => db.highlights.toArray(), [] as UserHighlight[]);
	const actsQuery = useLiveQuery(() => db.acts.toArray(), [] as Act[]);

	const settings = $derived(settingsQuery.value);
	const festivals = $derived(festivalsQuery.value ?? []);

	// --- Active Festival ---
	async function handleFestivalChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const id = Number(select.value);
		if (id) await setActiveFestival(id);
	}

	// --- Notifications ---
	const LEAD_TIME_OPTIONS = [5, 10, 15, 30] as const;

	async function handleNotificationsToggle(e: Event) {
		const checkbox = e.target as HTMLInputElement;
		await updateSettings({ notificationsEnabled: checkbox.checked });
	}

	async function handleLeadTimeChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		const mins = Number(select.value);
		await updateSettings({ notifyMinutesBefore: mins });

		// Update all existing highlights and reschedule notifications
		const allHighlights = await db.highlights
			.filter((h) => h.notifyMinutesBefore != null)
			.toArray();
		for (const h of allHighlights) {
			if (h.id != null) {
				await db.highlights.update(h.id, { notifyMinutesBefore: mins });
			}
		}
		const { rescheduleAllNotifications } = await import('$lib/features/notifications/local');
		await rescheduleAllNotifications();
	}

	// --- Notifications ---
	// Detect permission state reactively (check on mount + after toggle)
	let notifPermission = $state<NotificationPermission>('default');
	$effect(() => {
		if (typeof Notification !== 'undefined') {
			notifPermission = Notification.permission;
		}
	});

	// --- Theme & Display ---
	const activeFestival = $derived(
		festivals.find((f) => f.id === settings?.activeFestivalId) ?? festivals[0]
	);
	let dayBoundaryHour = $state(6);
	let dayBoundaryLoaded = $state(false);

	$effect(() => {
		const f = activeFestival;
		if (f && !dayBoundaryLoaded) {
			dayBoundaryLoaded = true;
			dayBoundaryHour = f.dayBoundaryHour ?? 6;
		}
	});

	async function handleThemeChange(theme: FestivalTheme) {
		if (!activeFestival?.id) return;
		await updateFestival(activeFestival.id, { theme });
		applyFestivalTheme(theme);
		addToast({ title: 'Theme updated', message: 'Festival theme has been changed.' });
	}

	async function handleDayBoundaryChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const val = Number(input.value);
		dayBoundaryHour = val;
		if (!activeFestival?.id) return;
		await updateFestival(activeFestival.id, { dayBoundaryHour: val });
	}

	// --- Debug Mode ---
	let debugMode = $state(false);
	let versionTaps = $state(0);
	let seedingDemo = $state(false);

	function handleVersionTap() {
		versionTaps++;
		if (versionTaps >= 5) {
			debugMode = !debugMode;
			versionTaps = 0;
			if (debugMode) {
				jumpDatetime = formatDatetimeLocal(getNow());
				addToast({ title: 'Debug mode', message: 'Debug tools enabled.' });
			}
		}
		// Reset tap count after 2 seconds of inactivity
		setTimeout(() => { versionTaps = 0; }, 2000);
	}

	async function handleSeedDemo() {
		seedingDemo = true;
		try {
			const { seedDemoFestival } = await import('$lib/debug/seed');
			await seedDemoFestival();
			addToast({ title: 'Demo loaded', message: 'Demo festival created with acts playing now.' });
		} catch (e) {
			addToast({ title: 'Error', message: e instanceof Error ? e.message : 'Failed to seed demo' });
		} finally {
			seedingDemo = false;
		}
	}

	async function handleClearDemo() {
		try {
			const { clearDemoFestival } = await import('$lib/debug/seed');
			await clearDemoFestival();
			addToast({ title: 'Cleared', message: 'Demo festival removed.' });
		} catch {
			addToast({ title: 'Error', message: 'Failed to clear demo festival.' });
		}
	}

	function formatDatetimeLocal(d: Date): string {
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	let jumpDatetime = $state('');
	let sliderHours = $state(0);

	function handleJumpTo() {
		if (!jumpDatetime) return;
		sliderHours = 0;
		jumpTo(new Date(jumpDatetime));
	}

	function handleTimeSlider(e: Event) {
		const input = e.target as HTMLInputElement;
		sliderHours = Number(input.value);
		// Offset from the datepicker time (or real time if not set)
		const baseMs = jumpDatetime ? new Date(jumpDatetime).getTime() : Date.now();
		const targetMs = baseMs + sliderHours * 60 * 60 * 1000;
		setTimeOffset(targetMs - Date.now());
	}

	const debugNow = $derived(getNow());

	// --- Data Management ---
	let showClearConfirm = $state(false);
	let clearLoading = $state(false);

	function handleExportHighlights() {
		if (!activeFestival) {
			addToast({ title: 'No festival', message: 'No active festival to export.' });
			return;
		}
		const highlights = highlightsQuery.value ?? [];
		const acts = actsQuery.value ?? [];
		const json = exportHighlightsAsJson(activeFestival, highlights, acts);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${activeFestival.name.replace(/\s+/g, '-')}-highlights.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleClearAllData() {
		clearLoading = true;
		try {
			await clearAllData();
			addToast({ title: 'Cleared', message: 'All data has been removed.' });
		} catch {
			addToast({ title: 'Error', message: 'Failed to clear data.' });
		} finally {
			clearLoading = false;
			showClearConfirm = false;
		}
	}
</script>

<div class="container mx-auto max-w-lg p-6 space-y-6 pb-24">
	<h1 class="text-2xl font-bold">Settings</h1>

	<!-- Active Festival -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-3">
			<h2 class="card-title text-lg">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 text-primary" aria-hidden="true"><path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd" /></svg>
				Active Festival
			</h2>
			{#if festivals.length === 0}
				<p class="text-sm text-base-content/70">No festivals added yet.</p>
			{:else}
				<label class="form-control">
					<div class="label">
						<span class="label-text">Current festival</span>
					</div>
					<select
						class="select w-full pt-2"
						value={settings?.activeFestivalId ?? ''}
						onchange={handleFestivalChange}
					>
						<option value="" disabled>Select a festival…</option>
						{#each festivals as festival (festival.id)}
							<option value={festival.id}>{festival.name}</option>
						{/each}
					</select>
				</label>

				{#if activeFestival?.clashfinderSlug || activeFestival?.icalUrl}
					<!-- Print Advisory -->
					{#if activeFestival.printAdvisoryLabel}
						{@const level = activeFestival.printAdvisoryLevel ?? 0}
						<div class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {level >= 4 ? 'bg-error/10 text-error' : level >= 3 ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}">
							<span class="font-medium">{activeFestival.printAdvisoryLabel}</span>
						</div>
					{/if}

					<!-- Sync -->
					<div class="flex items-center justify-between gap-2">
						<div class="text-xs text-base-content/50">
							{#if activeFestival.lastSyncAt}
								Last synced: {new Date(activeFestival.lastSyncAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
							{:else}
								Never synced
							{/if}
						</div>
						<button
							class="btn btn-outline btn-sm"
							onclick={handleSyncNow}
							disabled={syncingNow}
						>
							{#if syncingNow}
								<span class="loading loading-spinner loading-xs"></span>
							{/if}
							Sync now
						</button>
					</div>
				{/if}
			{/if}
		</div>
	</section>

	<!-- Theme & Display -->
	{#if activeFestival}
		<section class="card bg-base-200 shadow-sm">
			<div class="card-body gap-3">
				<h2 class="card-title text-lg">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 text-primary" aria-hidden="true"><path fill-rule="evenodd" d="M2.25 4.125c0-1.036.84-1.875 1.875-1.875h5.25c1.036 0 1.875.84 1.875 1.875V17.25a4.5 4.5 0 1 1-9 0V4.125Zm4.5 14.25a1.125 1.125 0 1 0 0-2.25 1.125 1.125 0 0 0 0 2.25Z" clip-rule="evenodd" /><path d="M10.719 21.75h9.156c1.036 0 1.875-.84 1.875-1.875v-5.25c0-1.036-.84-1.875-1.875-1.875h-.14l-8.742 8.743c-.09.089-.18.175-.274.257ZM12.738 17.625l6.474-6.474a1.875 1.875 0 0 0-1.337-.551H10.5a3.375 3.375 0 0 0 2.238 6.025Z" /></svg>
				Theme & Display
			</h2>

				<ThemePicker
					value={activeFestival.theme}
					onchange={handleThemeChange}
				/>

				<label class="form-control w-full mt-2">
					<div class="label">
						<span class="label-text">Day boundary hour</span>
						<span class="label-text-alt text-base-content/60">Hour when the "day" resets</span>
					</div>
					<input
						type="number"
						class="input w-full"
						min="0"
						max="12"
						bind:value={dayBoundaryHour}
						onchange={handleDayBoundaryChange}
					/>
				</label>
			</div>
		</section>
	{/if}

	<!-- Notifications -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-3">
			<h2 class="card-title text-lg">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 text-primary" aria-hidden="true"><path fill-rule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clip-rule="evenodd" /></svg>
				Notifications
			</h2>

			{#if notifPermission === 'denied'}
				<div class="alert alert-warning text-sm">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5 shrink-0" aria-hidden="true">
						<path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
					</svg>
					<div>
						<p class="font-medium">Notifications are blocked</p>
						<p class="mt-1 text-xs text-base-content/70">
							You've denied notification permission. To re-enable, open your device settings,
							find this app, and allow notifications.
						</p>
					</div>
				</div>
			{:else}
				<label class="flex items-center gap-3 cursor-pointer">
					<input
						type="checkbox"
						class="toggle toggle-primary"
						checked={settings?.notificationsEnabled ?? false}
						onchange={handleNotificationsToggle}
					/>
					<span class="label-text">Enable local notifications</span>
				</label>
			{/if}

			<label class="form-control">
				<div class="label">
					<span class="label-text">Default lead time</span>
				</div>
				<select
					class="select w-full"
					value={settings?.notifyMinutesBefore ?? 15}
					onchange={handleLeadTimeChange}
					disabled={!(settings?.notificationsEnabled ?? false) || notifPermission === 'denied'}
				>
					{#each LEAD_TIME_OPTIONS as mins}
						<option value={mins}>{mins} minutes before</option>
					{/each}
				</select>
			</label>
		</div>
	</section>

	<!-- Data Management -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-3">
			<h2 class="card-title text-lg">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 text-primary" aria-hidden="true"><path d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875Z" /><path d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 0 0 1.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 0 0 1.897 1.384C6.809 12.164 9.315 12.75 12 12.75Z" /><path d="M12 18.75c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.809 18.164 9.315 18.75 12 18.75Z" /></svg>
				Data Management
			</h2>

			<button class="btn btn-outline btn-sm self-start" onclick={handleExportHighlights}>
				Export highlights as JSON
			</button>

			{#if !showClearConfirm}
				<button
					class="btn btn-outline btn-error btn-sm self-start"
					onclick={() => (showClearConfirm = true)}
				>
					Clear all data…
				</button>
			{:else}
				<div class="alert alert-warning">
					<div class="flex flex-col gap-2">
						<p class="text-sm font-semibold">
							This will permanently delete all festivals, acts, highlights, and settings.
						</p>
						<div class="flex gap-2">
							<button
								class="btn btn-error btn-sm"
								onclick={handleClearAllData}
								disabled={clearLoading}
							>
								{#if clearLoading}
									<span class="loading loading-spinner loading-xs"></span>
								{/if}
								Yes, clear everything
							</button>
							<button
								class="btn btn-ghost btn-sm"
								onclick={() => (showClearConfirm = false)}
								disabled={clearLoading}
							>
								Cancel
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- About -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-2">
			<h2 class="card-title text-lg">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5 text-primary" aria-hidden="true"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clip-rule="evenodd" /></svg>
				About
			</h2>
			<button
				type="button"
				class="text-sm text-left"
				onclick={handleVersionTap}
			>
				<span class="font-semibold">WhosOn</span> — version 0.0.1
			</button>
			<p class="text-sm text-base-content/70">Festival schedule companion app.</p>
			<div class="flex flex-col gap-1 text-sm">
				<a
					href="https://github.com/ohjann/whoson"
					class="link link-primary"
					target="_blank"
					rel="noopener"
				>
					GitHub
				</a>
				<span class="text-base-content/60">MIT License</span>
			</div>
		</div>
	</section>

	<!-- Debug Tools (hidden until version tapped 5x) -->
	{#if debugMode}
		<section class="card bg-base-200 shadow-sm border border-warning/30">
			<div class="card-body gap-3">
				<h2 class="card-title text-lg text-warning">Debug Tools</h2>

				<!-- Demo Festival -->
				<div class="space-y-2">
					<p class="text-sm font-medium">Demo Festival</p>
					<p class="text-xs text-base-content/60">
						Load a 3-day festival with acts across 5 stages, centered around now.
					</p>
					<div class="flex gap-2">
						<button
							class="btn btn-warning btn-sm"
							onclick={handleSeedDemo}
							disabled={seedingDemo}
						>
							{#if seedingDemo}
								<span class="loading loading-spinner loading-xs"></span>
							{/if}
							Load Demo Festival
						</button>
						<button class="btn btn-ghost btn-sm" onclick={handleClearDemo}>
							Clear Demo
						</button>
					</div>
				</div>

				<!-- Time Travel -->
				<div class="space-y-2">
					<p class="text-sm font-medium">Time Travel</p>
					<p class="text-xs text-base-content/60">
						Shift the app's clock forward or backward to test "Now Playing".
					</p>

					<input
						type="range"
						class="range range-warning range-sm w-full"
						min="-24"
						max="24"
						step="0.5"
						value={sliderHours}
						oninput={handleTimeSlider}
					/>
					<div class="flex justify-between text-xs text-base-content/50">
						<span>-24h</span>
						<span class="font-mono {sliderHours !== 0 ? 'text-warning font-semibold' : ''}">
							{#if sliderHours !== 0}
								{sliderHours > 0 ? '+' : ''}{sliderHours.toFixed(1)}h
							{:else}
								0
							{/if}
						</span>
						<span>+24h</span>
					</div>

					<!-- Jump to date -->
					<div class="flex items-end gap-2">
						<label class="form-control flex-1">
							<div class="label"><span class="label-text">Jump to date & time</span></div>
							<input
								type="datetime-local"
								class="input input-sm w-full"
								bind:value={jumpDatetime}
							/>
						</label>
						<button
							class="btn btn-warning btn-sm"
							onclick={handleJumpTo}
							disabled={!jumpDatetime}
						>
							Jump
						</button>
					</div>

					<p class="text-xs font-mono text-base-content/60">
						App time: {debugNow.toLocaleTimeString()} {debugNow.toLocaleDateString()}
					</p>

					{#if isTimeShifted()}
						<button class="btn btn-ghost btn-xs" onclick={() => { resetTime(); sliderHours = 0; jumpDatetime = formatDatetimeLocal(new Date()); }}>
							Reset to real time
						</button>
					{/if}
				</div>
			</div>
		</section>
	{/if}
</div>
