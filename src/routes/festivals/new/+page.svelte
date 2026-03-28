<script lang="ts">
	import { createFestival } from '$lib/features/festival/operations.js';
	import ThemePicker from '$lib/features/theme/ThemePicker.svelte';
	import type { FestivalTheme } from '$lib/types';

	let step = $state<'details' | 'theme'>('details');

	let name = $state('');
	let timezone = $state('Europe/London');
	let startDate = $state('');
	let endDate = $state('');
	let selectedTheme = $state<FestivalTheme | undefined>({ preset: 'night-rave' });

	let saving = $state(false);
	let error = $state('');

	function nextStep() {
		if (!name.trim() || !startDate || !endDate) {
			error = 'Please fill in all required fields.';
			return;
		}
		error = '';
		step = 'theme';
	}

	async function save() {
		saving = true;
		error = '';
		try {
			await createFestival({
				name: name.trim(),
				timezone,
				startDate,
				endDate,
				dayBoundaryHour: 6,
				theme: selectedTheme
			});
			window.history.back();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save festival.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="container mx-auto max-w-lg p-6">
	<h1 class="text-2xl font-bold mb-6">New Festival</h1>

	{#if step === 'details'}
		<div class="flex flex-col gap-4">
			<label class="form-control">
				<div class="label"><span class="label-text">Name *</span></div>
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. Glastonbury 2026"
					bind:value={name}
				/>
			</label>

			<label class="form-control">
				<div class="label"><span class="label-text">Timezone</span></div>
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. Europe/London"
					bind:value={timezone}
				/>
			</label>

			<div class="grid grid-cols-2 gap-3">
				<label class="form-control">
					<div class="label"><span class="label-text">Start Date *</span></div>
					<input type="date" class="input input-bordered w-full" bind:value={startDate} />
				</label>

				<label class="form-control">
					<div class="label"><span class="label-text">End Date *</span></div>
					<input type="date" class="input input-bordered w-full" bind:value={endDate} />
				</label>
			</div>

			{#if error}
				<div class="alert alert-error py-2 text-sm">{error}</div>
			{/if}

			<button class="btn btn-primary" onclick={nextStep}>
				Next: Choose Theme
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-4">
			<ThemePicker bind:value={selectedTheme} />

			{#if error}
				<div class="alert alert-error py-2 text-sm">{error}</div>
			{/if}

			<div class="flex gap-2">
				<button class="btn btn-outline flex-1" onclick={() => (step = 'details')}>
					Back
				</button>
				<button class="btn btn-primary flex-1" onclick={save} disabled={saving}>
					{#if saving}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Create Festival
				</button>
			</div>
		</div>
	{/if}
</div>
