<script lang="ts">
	import type { PresetTheme } from './index.js';

	let { theme }: { theme: PresetTheme } = $props();
</script>

<div
	data-theme={theme.dataTheme}
	class="rounded-xl border border-base-300 p-3 w-full overflow-hidden"
	style="background-color: {theme.colors.base}"
>
	<div class="flex flex-col gap-2">
		<!-- Mini card -->
		<div
			class="rounded-lg p-2"
			style="background-color: color-mix(in srgb, {theme.colors.base} 60%, {theme.colors.primary} 40%)"
		>
			<div class="text-xs font-semibold mb-1" style="color: {theme.colors.primary}">
				Main Stage
			</div>
			<div class="text-xs opacity-70" style="color: {theme.colors.primary}">Artist Name</div>
		</div>

		<!-- Badges row -->
		<div class="flex gap-1 flex-wrap">
			<span
				class="text-xs px-2 py-0.5 rounded-full font-medium"
				style="background-color: {theme.colors.primary}; color: {theme.colors.base}"
			>
				Highlight
			</span>
			<span
				class="text-xs px-2 py-0.5 rounded-full font-medium"
				style="background-color: {theme.colors.secondary}; color: {theme.colors.base}"
			>
				Clash
			</span>
			<span
				class="text-xs px-2 py-0.5 rounded-full font-medium"
				style="background-color: {theme.colors.accent}; color: {theme.colors.base}"
			>
				Now
			</span>
		</div>

		<!-- Button -->
		<button
			class="text-xs py-1 px-3 rounded-lg font-medium w-full"
			style="background-color: {theme.colors.primary}; color: {theme.colors.base}"
		>
			View Schedule
		</button>
	</div>
</div>
