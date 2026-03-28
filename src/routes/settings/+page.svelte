<script lang="ts">
	import { useLiveQuery } from '$lib/db/live.svelte';
	import { db } from '$lib/db';
	import {
		updateSettings,
		saveClashfinderCredentials,
		getDecryptedPrivateKey,
		clearAllData
	} from '$lib/features/settings/operations';
	import { setActiveFestival } from '$lib/features/festival/operations';
	import { subscribeToTopic, unsubscribe, sendTestNotification } from '$lib/features/notifications/ntfy';
	import { addToast } from '$lib/features/notifications/toasts.svelte.js';
	import { exportHighlightsAsJson } from '$lib/features/export';
	import type { Festival, Act, UserHighlight } from '$lib/types';

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

	// --- Clashfinder ---
	let cfUsername = $state('');
	let cfPrivateKey = $state('');
	let cfRemember = $state(false);
	let cfSaving = $state(false);
	let cfLoaded = $state(false);

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

	// --- ntfy.sh ---
	let ntfyTopic = $state('');
	let ntfySubscribed = $state(false);
	let ntfyTestLoading = $state(false);
	let ntfyLoaded = $state(false);

	$effect(() => {
		const s = settings;
		if (s && !ntfyLoaded) {
			ntfyLoaded = true;
			ntfyTopic = s.ntfyTopic ?? '';
		}
	});

	async function handleNtfySubscribe() {
		const topic = ntfyTopic.trim();
		if (!topic) return;
		await updateSettings({ ntfyTopic: topic });
		subscribeToTopic(topic);
		ntfySubscribed = true;
	}

	async function handleNtfyUnsubscribe() {
		unsubscribe();
		ntfySubscribed = false;
	}

	async function handleTestNotification() {
		const topic = ntfyTopic.trim();
		if (!topic) {
			addToast({ title: 'No topic', message: 'Enter a ntfy.sh topic first.' });
			return;
		}
		ntfyTestLoading = true;
		try {
			await sendTestNotification(topic);
			addToast({ title: 'Test sent', message: `Sent to ntfy.sh/${topic}` });
		} catch {
			addToast({ title: 'Failed', message: 'Could not send test notification.' });
		} finally {
			ntfyTestLoading = false;
		}
	}

	// --- Data Management ---
	let showClearConfirm = $state(false);
	let clearLoading = $state(false);

	function handleExportHighlights() {
		const activeFestival = festivals.find((f) => f.id === settings?.activeFestivalId) ?? festivals[0];
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
						class="select select-bordered w-full"
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

	<!-- Notifications -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-3">
			<h2 class="card-title text-lg">Notifications</h2>

			<label class="flex items-center gap-3 cursor-pointer">
				<input
					type="checkbox"
					class="toggle toggle-primary"
					checked={settings?.notificationsEnabled ?? false}
					onchange={handleNotificationsToggle}
				/>
				<span class="label-text">Enable local notifications</span>
			</label>

			<label class="form-control">
				<div class="label">
					<span class="label-text">Default lead time</span>
				</div>
				<select
					class="select select-bordered w-full"
					value={settings?.notifyMinutesBefore ?? 15}
					onchange={handleLeadTimeChange}
					disabled={!(settings?.notificationsEnabled ?? false)}
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
					class="input input-bordered w-full"
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
					class="input input-bordered w-full"
					placeholder="••••••••"
					bind:value={cfPrivateKey}
					autocomplete="current-password"
				/>
			</label>

			<label class="flex items-center gap-3 cursor-pointer">
				<input type="checkbox" class="checkbox checkbox-primary" bind:checked={cfRemember} />
				<span class="label-text">Remember private key (encrypted on device)</span>
			</label>

			<button
				class="btn btn-primary btn-sm self-start"
				onclick={handleSaveClashfinder}
				disabled={cfSaving || !cfUsername.trim()}
			>
				{#if cfSaving}
					<span class="loading loading-spinner loading-xs"></span>
				{/if}
				Save Credentials
			</button>
		</div>
	</section>

	<!-- ntfy.sh -->
	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-3">
			<h2 class="card-title text-lg">Announcements (ntfy.sh)</h2>
			<p class="text-sm text-base-content/70">
				Subscribe to a <a href="https://ntfy.sh" class="link" target="_blank" rel="noopener">ntfy.sh</a> topic
				to receive festival announcements as in-app notifications.
			</p>

			<label class="form-control">
				<div class="label">
					<span class="label-text">ntfy.sh topic</span>
				</div>
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. my-festival-2026"
					bind:value={ntfyTopic}
					disabled={ntfySubscribed}
				/>
			</label>

			<div class="flex gap-2 flex-wrap">
				{#if !ntfySubscribed}
					<button
						class="btn btn-primary btn-sm"
						onclick={handleNtfySubscribe}
						disabled={!ntfyTopic.trim()}
					>
						Subscribe
					</button>
				{:else}
					<button class="btn btn-outline btn-error btn-sm" onclick={handleNtfyUnsubscribe}>
						Unsubscribe
					</button>
				{/if}

				<button
					class="btn btn-outline btn-sm"
					onclick={handleTestNotification}
					disabled={ntfyTestLoading || !ntfyTopic.trim()}
				>
					{#if ntfyTestLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Send Test
				</button>
			</div>

			{#if ntfySubscribed}
				<div class="alert alert-success py-2">
					<span class="text-sm">Subscribed to <strong>{ntfyTopic}</strong></span>
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
			<p class="text-sm">
				<span class="font-semibold">WhosOn</span> — version 0.0.1
			</p>
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
</div>
