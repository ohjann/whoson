<script lang="ts">
	import { useLiveQuery } from '$lib/db/live.svelte';
	import { db } from '$lib/db';
	import {
		updateSettings,
		saveClashfinderCredentials,
		getDecryptedPrivateKey,
		clearAllData
	} from '$lib/features/settings/operations';
	import { setActiveFestival, updateFestival } from '$lib/features/festival/operations';
	import { applyFestivalTheme } from '$lib/features/theme/index.js';
	import ThemePicker from '$lib/features/theme/ThemePicker.svelte';
	import { addToast } from '$lib/features/notifications/toasts.svelte.js';
	import { exportHighlightsAsJson } from '$lib/features/export';
	import { getNow, setTimeOffsetHours, getTimeOffsetHours, resetTime, isTimeShifted } from '$lib/debug/time.svelte';
	import type { Festival, FestivalTheme, Act, UserHighlight } from '$lib/types';

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
		await updateSettings({ notifyMinutesBefore: Number(select.value) });
	}

	// --- Notifications ---
	// Detect permission state reactively (check on mount + after toggle)
	let notifPermission = $state<NotificationPermission>('default');
	$effect(() => {
		if (typeof Notification !== 'undefined') {
			notifPermission = Notification.permission;
		}
	});

	// --- Clashfinder ---
	let cfUsername = $state('');
	let cfPrivateKey = $state('');
	let cfRemember = $state(false);
	let cfSaving = $state(false);
	let cfLoaded = $state(false);
	let cfSyncing = $state(false);
	let cfSyncError = $state('');

	// Load stored username and decrypt private key on mount
	$effect(() => {
		const s = settings;
		if (s && !cfLoaded) {
			cfLoaded = true;
			cfUsername = s.clashfinderUsername ?? '';
			cfRemember = !!s.encryptedPrivateKey;
			if (s.encryptedPrivateKey) {
				getDecryptedPrivateKey().then((key) => {
					if (key) cfPrivateKey = key;
				});
			}
		}
	});

	async function handleSaveClashfinder() {
		cfSaving = true;
		try {
			await saveClashfinderCredentials(cfUsername.trim(), cfPrivateKey, cfRemember);
			addToast({ title: 'Saved', message: 'Clashfinder credentials saved.' });
		} catch {
			addToast({ title: 'Error', message: 'Failed to save credentials.' });
		} finally {
			cfSaving = false;
		}
	}

	async function handleSyncClashfinder() {
		cfSyncError = '';
		cfSyncing = true;
		try {
			const { refreshLineup } = await import('$lib/features/festival/operations');
			if (!activeFestival?.id) throw new Error('No active festival');
			if (!activeFestival.clashfinderSlug) throw new Error('Festival has no Clashfinder URL configured');
			const publicKey = cfUsername.trim();
			await refreshLineup(activeFestival.id, cfUsername.trim(), publicKey, cfPrivateKey);
			addToast({ title: 'Synced', message: 'Lineup updated from Clashfinder.' });
		} catch (e) {
			cfSyncError = e instanceof Error ? e.message : 'Failed to sync from Clashfinder';
		} finally {
			cfSyncing = false;
		}
	}

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

	function handleTimeSlider(e: Event) {
		const input = e.target as HTMLInputElement;
		setTimeOffsetHours(Number(input.value));
	}

	const debugNow = $derived(getNow());
	const debugTimeOffset = $derived(getTimeOffsetHours());

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
			<h2 class="card-title text-lg">Active Festival</h2>
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
			{/if}
		</div>
	</section>

	<!-- Theme & Display -->
	{#if activeFestival}
		<section class="card bg-base-200 shadow-sm">
			<div class="card-body gap-3">
				<h2 class="card-title text-lg">Theme & Display</h2>

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
			<h2 class="card-title text-lg">Notifications</h2>

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

	<!-- Clashfinder Credentials -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-3">
			<h2 class="card-title text-lg">Clashfinder Credentials</h2>
			<p class="text-sm text-base-content/70">
				Enter your Clashfinder username and private key to import private lineups.
			</p>

			<label class="form-control">
				<div class="label">
					<span class="label-text">Username</span>
				</div>
				<input
					type="text"
					class="input w-full"
					placeholder="your-username"
					bind:value={cfUsername}
					autocomplete="username"
				/>
			</label>

			<label class="form-control">
				<div class="label">
					<span class="label-text">Private key</span>
				</div>
				<input
					type="password"
					class="input w-full"
					placeholder="••••••••"
					bind:value={cfPrivateKey}
					autocomplete="current-password"
				/>
			</label>

			<label class="flex items-center gap-3 cursor-pointer">
				<input type="checkbox" class="checkbox checkbox-primary" bind:checked={cfRemember} />
				<span class="label-text">Remember private key (encrypted on device)</span>
			</label>

			<div class="flex gap-2 flex-wrap">
				<button
					class="btn btn-primary btn-sm"
					onclick={handleSaveClashfinder}
					disabled={cfSaving || !cfUsername.trim()}
				>
					{#if cfSaving}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Save Credentials
				</button>

				<button
					class="btn btn-outline btn-sm"
					onclick={handleSyncClashfinder}
					disabled={cfSyncing || !cfUsername.trim() || !cfPrivateKey.trim()}
				>
					{#if cfSyncing}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Sync Lineup
				</button>
			</div>

			{#if cfSyncError}
				<div class="alert alert-error text-sm">
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-5 shrink-0" aria-hidden="true">
						<path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" />
					</svg>
					<div>
						<p>{cfSyncError}</p>
						<div class="flex gap-2 mt-2">
							<button type="button" class="btn btn-sm btn-outline" onclick={handleSyncClashfinder}>
								Retry
							</button>
							<a href="/festivals/new/" class="btn btn-sm btn-ghost">
								Import manually instead
							</a>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- Data Management -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-3">
			<h2 class="card-title text-lg">Data Management</h2>

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
			<h2 class="card-title text-lg">About</h2>
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
					href="https://github.com/example/whoson"
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
						value={debugTimeOffset}
						oninput={handleTimeSlider}
					/>
					<div class="flex justify-between text-xs text-base-content/50">
						<span>-24h</span>
						<span class="font-mono {isTimeShifted() ? 'text-warning font-semibold' : ''}">
							{#if isTimeShifted()}
								{debugTimeOffset > 0 ? '+' : ''}{debugTimeOffset.toFixed(1)}h
							{:else}
								now
							{/if}
						</span>
						<span>+24h</span>
					</div>

					<p class="text-xs font-mono text-base-content/60">
						App time: {debugNow.toLocaleTimeString()} {debugNow.toLocaleDateString()}
					</p>

					{#if isTimeShifted()}
						<button class="btn btn-ghost btn-xs" onclick={resetTime}>
							Reset to real time
						</button>
					{/if}
				</div>
			</div>
		</section>
	{/if}
</div>
