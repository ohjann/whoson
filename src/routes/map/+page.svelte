<script lang="ts">
	import { onDestroy } from 'svelte';
	import Panzoom from '@panzoom/panzoom';
	import type { PanzoomObject } from '@panzoom/panzoom';
	import { db } from '$lib/db';
	import { useLiveQuery } from '$lib/db/live.svelte';

	// Load active festival id from settings
	const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);

	const activeFestivalId = $derived(settingsQuery.value?.activeFestivalId);

	// Load map for active festival
	const mapQuery = useLiveQuery(
		() =>
			activeFestivalId != null
				? db.festivalMaps.get(activeFestivalId)
				: Promise.resolve(undefined),
		undefined
	);

	let objectUrl = $state<string | undefined>(undefined);
	let isFullscreen = $state(false);
	let imgEl = $state<HTMLImageElement | undefined>(undefined);
	let containerEl = $state<HTMLDivElement | undefined>(undefined);
	let panzoomInstance = $state<PanzoomObject | undefined>(undefined);

	// Update object URL when map blob changes
	$effect(() => {
		const map = mapQuery.value;
		// Revoke previous URL
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = undefined;
		}
		if (map?.imageBlob) {
			objectUrl = URL.createObjectURL(map.imageBlob);
		}
	});

	// Re-query when activeFestivalId changes
	$effect(() => {
		// This effect just tracks activeFestivalId so the mapQuery re-runs
		void activeFestivalId;
	});

	// Initialize panzoom when image is available
	$effect(() => {
		if (!imgEl || !objectUrl) return;

		// Destroy previous instance if any
		if (panzoomInstance) {
			panzoomInstance.destroy();
			panzoomInstance = undefined;
		}

		const instance = Panzoom(imgEl, {
			maxScale: 5,
			minScale: 0.5,
			contain: 'outside',
			canvas: true
		});

		// Enable wheel zoom on container
		containerEl?.addEventListener('wheel', instance.zoomWithWheel);

		panzoomInstance = instance;

		return () => {
			containerEl?.removeEventListener('wheel', instance.zoomWithWheel);
			instance.destroy();
		};
	});

	// Toggle fullscreen
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

	// Keep isFullscreen in sync with browser fullscreen changes
	$effect(() => {
		function onFullscreenChange() {
			isFullscreen = !!document.fullscreenElement;
		}
		document.addEventListener('fullscreenchange', onFullscreenChange);
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
	});

	// Revoke object URL on component destroy
	onDestroy(() => {
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
		}
		if (panzoomInstance) {
			panzoomInstance.destroy();
		}
	});
</script>

<div class="flex min-h-screen flex-col">
	<div class="flex items-center justify-between p-4">
		<h1 class="text-xl font-bold">Map</h1>
		{#if objectUrl}
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
				onclick={toggleFullscreen}
			>
				{#if isFullscreen}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="size-5"
					>
						<path
							d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"
						/>
					</svg>
				{:else}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						class="size-5"
					>
						<path
							d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
						/>
					</svg>
				{/if}
			</button>
		{/if}
	</div>

	{#if objectUrl}
		<div
			bind:this={containerEl}
			class="relative flex-1 overflow-hidden bg-base-200 touch-none"
			style="cursor: grab;"
		>
			<img
				bind:this={imgEl}
				src={objectUrl}
				alt="Festival map"
				class="block w-full"
				draggable="false"
			/>
		</div>
	{:else}
		<div class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
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
			<div class="flex flex-col items-center gap-3">
				<p class="text-base-content/60">No map uploaded yet</p>
				<a href="/settings/" class="btn btn-primary btn-sm">
					Add map in settings
				</a>
			</div>
		</div>
	{/if}
</div>
