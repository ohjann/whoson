<script lang="ts">
	import { getPresetThemes } from './index.js';
	import ThemePreview from './ThemePreview.svelte';
	import type { FestivalTheme } from '$lib/types';

	let {
		value = $bindable<FestivalTheme | undefined>(undefined),
		onchange
	}: {
		value?: FestivalTheme;
		onchange?: (theme: FestivalTheme) => void;
	} = $props();

	const presets = getPresetThemes();

	let selectedPreset = $derived(value?.preset ?? 'night-rave');

	function selectPreset(id: typeof selectedPreset) {
		const next: FestivalTheme = { preset: id };
		value = next;
		onchange?.(next);
	}
</script>

<div class="flex flex-col gap-4">
	<p class="text-sm text-base-content/70">Choose a colour theme for this festival.</p>

	<div class="grid grid-cols-2 gap-3">
		{#each presets as preset (preset.id)}
			{@const isSelected = selectedPreset === preset.id}
			<button
				type="button"
				class="flex flex-col gap-2 rounded-xl border-2 p-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100 {isSelected
					? 'border-primary'
					: 'border-base-300 hover:border-base-content/30'}"
				onclick={() => selectPreset(preset.id)}
			>
				<div class="relative">
					<ThemePreview theme={preset} />
					{#if isSelected}
						<div class="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-content">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-3">
								<path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
							</svg>
						</div>
					{/if}
				</div>
				<div class="px-1">
					<div class="text-sm font-medium">{preset.name}</div>
					<div class="text-xs text-base-content/60">{preset.description}</div>
				</div>
			</button>
		{/each}
	</div>
</div>
