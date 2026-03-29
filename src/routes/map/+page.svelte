<script lang="ts">
	import { onDestroy } from 'svelte';
	import { db } from '$lib/db';
	import { useLiveQuery } from '$lib/db/live.svelte';

	const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);
	const allMapsQuery = useLiveQuery(() => db.festivalMaps.toArray(), []);

	const activeFestivalId = $derived(settingsQuery.value?.activeFestivalId);
	const mapQuery = $derived({
		value: (allMapsQuery.value ?? []).find((m) => m.festivalId === activeFestivalId)
	});

	let objectUrl = $state<string | undefined>(undefined);
	let prevBlob: Blob | undefined;
	let isFullscreen = $state(false);
	let containerEl = $state<HTMLDivElement | undefined>(undefined);

	async function toggleFullscreen() {
		if (!containerEl) return;
		if (!document.fullscreenElement) {
			await containerEl.requestFullscreen();
			isFullscreen = true;
		} else {
			await document.exitFullscreen();
			isFullscreen = false;
		}
	}

	$effect(() => {
		function onFullscreenChange() {
			isFullscreen = !!document.fullscreenElement;
		}
		document.addEventListener('fullscreenchange', onFullscreenChange);
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
	});

	$effect(() => {
		const blob = mapQuery.value?.imageBlob;
		// Only update if the blob actually changed
		if (blob === prevBlob) return;
		prevBlob = blob;

		const oldUrl = objectUrl;
		if (blob) {
			objectUrl = URL.createObjectURL(blob);
		} else {
			objectUrl = undefined;
		}
		if (oldUrl) URL.revokeObjectURL(oldUrl);
	});

	onDestroy(() => {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	});
</script>

<div class="p-4">
	<div class="mb-4 flex items-center justify-between">
		<h1 class="text-xl font-bold">Map</h1>
		{#if objectUrl}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
				onclick={toggleFullscreen}
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5">
					{#if isFullscreen}
						<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
					{:else}
						<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
					{/if}
				</svg>
			</button>
		{/if}
	</div>

	{#if objectUrl}
		<div
			bind:this={containerEl}
			class="overflow-auto rounded-lg bg-base-200"
			style="max-height: calc(100dvh - 12rem);"
		>
			<img
				src={objectUrl}
				alt="Festival map"
				class="block w-full"
			/>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center gap-4 py-16 text-center">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				class="size-16 text-base-content/30"
				aria-hidden="true"
			>
				<path
					d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"
				/>
			</svg>
			<p class="text-base-content/60">No map uploaded yet</p>
			<a href="/settings/" class="btn btn-primary btn-sm">Add map in settings</a>
		</div>
	{/if}
</div>
