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
				class="flex flex-col gap-2 rounded-xl border-2 p-2 text-left transition-colors {isSelected
					? 'border-primary'
					: 'border-base-300 hover:border-base-content/30'}"
				onclick={() => selectPreset(preset.id)}
			>
				<ThemePreview theme={preset} />
				<div class="px-1">
					<div class="text-sm font-medium">{preset.name}</div>
					<div class="text-xs text-base-content/60">{preset.description}</div>
				</div>
			</button>
		{/each}
	</div>
</div>
