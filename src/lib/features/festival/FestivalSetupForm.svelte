<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import {
		createFestival,
		updateFestival,
		setActiveFestival,
		importLineup
	} from '$lib/features/festival/operations';
	import { parseClashfinderUrl } from '$lib/features/import/clashfinder';
	import { parseJsonLineup, parseCsvLineup } from '$lib/features/import/manual';
	import type { FestivalTheme } from '$lib/types';

	// --- Props ---
	let {
		mode = 'create',
		festivalId = undefined,
		initialData = undefined
	}: {
		mode?: 'create' | 'edit';
		festivalId?: number;
		initialData?: {
			name: string;
			location?: string;
			startDate: string;
			endDate: string;
			timezone: string;
			dayBoundaryHour: number;
			theme?: FestivalTheme;
			clashfinderSlug?: string;
		};
	} = $props();

	// --- Timezone list ---
	const timezones: string[] = Intl.supportedValuesOf('timeZone');
	const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// --- Step 1: Name & Details ---
	let name = $state(initialData?.name ?? '');
	let location = $state(initialData?.location ?? '');
	let startDate = $state(initialData?.startDate ?? '');
	let endDate = $state(initialData?.endDate ?? '');
	let timezone = $state(initialData?.timezone ?? deviceTimezone);
	let dayBoundaryHour = $state(initialData?.dayBoundaryHour ?? 6);

	// --- Step 2: Import Lineup ---
	let importType = $state<'clashfinder' | 'file' | 'skip'>('skip');
	let clashfinderUrl = $state(
		initialData?.clashfinderSlug
			? `https://clashfinder.com/s/${initialData.clashfinderSlug}/`
			: ''
	);
	let parsedActs = $state<Array<{ name: string; stage: string; startTime: string; endTime: string }>>(
		[]
	);
	let importError = $state('');
	let importErrors = $state<string[]>([]);
	let isNative = $state(false);

	$effect(() => {
		// Detect Capacitor native platform
		import('@capacitor/core')
			.then(({ Capacitor }) => {
				isNative = Capacitor.isNativePlatform();
			})
			.catch(() => {
				isNative = false;
			});
	});

	const clashfinderSlug = $derived(parseClashfinderUrl(clashfinderUrl));

	// --- Step 3: Map ---
	let mapBlob = $state<Blob | null>(null);
	let mapPreviewUrl = $state('');

	// --- Step 4: Theme ---
	const themePresets = [
		{ name: 'nightrave', label: 'Night Rave', description: 'Dark with neon accents', swatch: '#b14aed' },
		{ name: 'dayfestival', label: 'Day Festival', description: 'Warm, vibrant colors', swatch: '#f59e0b' },
		{ name: 'synthwave', label: 'Synthwave', description: 'Retro synth vibes', swatch: '#e779c1' },
		{ name: 'minimal', label: 'Minimal', description: 'Clean, high contrast', swatch: '#111111' },
		{ name: 'custom', label: 'Custom', description: 'Pick your own colors', swatch: null }
	] as const;

	let selectedThemeName = $state(initialData?.theme?.name ?? 'nightrave');
	let customPrimary = $state(initialData?.theme?.primaryColor ?? '#7c3aed');
	let customSecondary = $state(initialData?.theme?.secondaryColor ?? '#db2777');

	// --- Navigation ---
	let currentStep = $state(1);
	const totalSteps = 5;

	function nextStep() {
		currentStep = Math.min(totalSteps, currentStep + 1);
	}
	function prevStep() {
		currentStep = Math.max(1, currentStep - 1);
	}

	// --- Validation ---
	const step1Valid = $derived(
		name.trim() !== '' && startDate !== '' && endDate !== '' && timezone !== ''
	);

	// --- File upload handler ---
	function handleFileUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;

		importError = '';
		importErrors = [];
		parsedActs = [];

		const reader = new FileReader();
		reader.onload = (e) => {
			const content = e.target?.result as string;
			const ext = file.name.split('.').pop()?.toLowerCase();
			const result = ext === 'csv' ? parseCsvLineup(content) : parseJsonLineup(content);

			// Always import the valid acts, even if some rows failed
			parsedActs = result.acts.map((a) => ({
				name: a.name,
				stage: a.stage,
				startTime: a.startTime,
				endTime: a.endTime
			}));

			if (result.errors.length > 0) {
				importErrors = result.errors;
				if (result.acts.length === 0) {
					importError = 'No valid acts found in this file.';
				}
			}
		};
		reader.readAsText(file);
	}

	// --- Map upload handler ---
	function handleMapUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		mapBlob = file;
		if (mapPreviewUrl) URL.revokeObjectURL(mapPreviewUrl);
		mapPreviewUrl = URL.createObjectURL(file);
	}

	// --- Save ---
	let saving = $state(false);
	let saveError = $state('');

	async function handleSave() {
		saving = true;
		saveError = '';
		try {
			const theme: FestivalTheme =
				selectedThemeName === 'custom'
					? { name: 'custom', primaryColor: customPrimary, secondaryColor: customSecondary }
					: { name: selectedThemeName, primaryColor: '', secondaryColor: '' };

			const festivalData = {
				name: name.trim(),
				location: location.trim() || undefined,
				timezone,
				dayBoundaryHour,
				startDate,
				endDate,
				theme,
				clashfinderSlug:
					importType === 'clashfinder' && clashfinderSlug ? clashfinderSlug : undefined
			};

			let fId: number;
			if (mode === 'create') {
				fId = await createFestival(festivalData);
				await setActiveFestival(fId);
			} else {
				fId = festivalId!;
				await updateFestival(fId, festivalData);
			}

			// Save map blob if provided
			if (mapBlob) {
				await db.festivalMaps.put({
					festivalId: fId,
					imageBlob: mapBlob,
					updatedAt: new Date().toISOString()
				});
			}

			// Import lineup from file if provided
			if (importType === 'file' && parsedActs.length > 0) {
				await importLineup(fId, parsedActs);
			}

			await goto('/');
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Failed to save festival';
		} finally {
			saving = false;
		}
	}
</script>

<!-- Step indicator -->
<ul class="steps steps-horizontal w-full mb-6 text-xs">
	{#each ['Details', 'Lineup', 'Map', 'Theme', 'Confirm'] as stepLabel, i}
		<li class="step {currentStep > i ? 'step-primary' : ''}">{stepLabel}</li>
	{/each}
</ul>

<!-- Step 1: Name & Details -->
{#if currentStep === 1}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">Festival Details</h2>

		<label class="form-control w-full">
			<div class="label"><span class="label-text">Festival name *</span></div>
			<input
				type="text"
				class="input input-bordered w-full"
				placeholder="e.g. Glastonbury 2026"
				bind:value={name}
				required
			/>
		</label>

		<label class="form-control w-full">
			<div class="label"><span class="label-text">Location</span></div>
			<input
				type="text"
				class="input input-bordered w-full"
				placeholder="e.g. Worthy Farm, Somerset, UK"
				bind:value={location}
			/>
		</label>

		<div class="grid grid-cols-2 gap-3">
			<label class="form-control">
				<div class="label"><span class="label-text">Start date *</span></div>
				<input type="date" class="input input-bordered w-full" bind:value={startDate} required />
			</label>
			<label class="form-control">
				<div class="label"><span class="label-text">End date *</span></div>
				<input type="date" class="input input-bordered w-full" bind:value={endDate} required />
			</label>
		</div>

		<label class="form-control w-full">
			<div class="label">
				<span class="label-text">Timezone *</span>
				<span class="label-text-alt text-base-content/60">Default: your device timezone</span>
			</div>
			<select class="select select-bordered w-full" bind:value={timezone}>
				{#each timezones as tz}
					<option value={tz}>{tz}</option>
				{/each}
			</select>
		</label>

		<label class="form-control w-full">
			<div class="label">
				<span class="label-text">Day boundary hour</span>
				<span class="label-text-alt text-base-content/60">Hour when the "day" resets</span>
			</div>
			<input
				type="number"
				class="input input-bordered w-full"
				min="0"
				max="12"
				bind:value={dayBoundaryHour}
			/>
		</label>
	</div>

	<div class="mt-6 flex justify-end">
		<button class="btn btn-primary" onclick={nextStep} disabled={!step1Valid}>
			Next
		</button>
	</div>
{/if}

<!-- Step 2: Import Lineup -->
{#if currentStep === 2}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">Import Lineup</h2>
		<p class="text-sm text-base-content/60">
			Optionally import your festival lineup. You can also add this later.
		</p>

		<!-- Import type selector -->
		<div class="join join-vertical w-full">
			<label class="join-item flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-4">
				<input type="radio" name="importType" class="radio" bind:group={importType} value="clashfinder" />
				<div>
					<div class="font-medium">Clashfinder URL</div>
					<div class="text-xs text-base-content/60">Import from clashfinder.com</div>
				</div>
			</label>
			<label class="join-item flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-4 mt-2">
				<input type="radio" name="importType" class="radio" bind:group={importType} value="file" />
				<div>
					<div class="font-medium">Upload file</div>
					<div class="text-xs text-base-content/60">JSON or CSV lineup file</div>
				</div>
			</label>
			<label class="join-item flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-4 mt-2">
				<input type="radio" name="importType" class="radio" bind:group={importType} value="skip" />
				<div>
					<div class="font-medium">Skip for now</div>
					<div class="text-xs text-base-content/60">Add lineup later</div>
				</div>
			</label>
		</div>

		<!-- Clashfinder URL input -->
		{#if importType === 'clashfinder'}
			<div class="space-y-3">
				{#if !isNative}
					<div class="alert alert-warning">
						<svg xmlns="http://www.w3.org/2000/svg" class="size-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
						</svg>
						<span class="text-sm">
							Clashfinder import requires the mobile app due to browser CORS restrictions.
							The URL will be saved and you can import the lineup from the app.
						</span>
					</div>
				{/if}

				<label class="form-control w-full">
					<div class="label"><span class="label-text">Clashfinder URL</span></div>
					<input
						type="url"
						class="input input-bordered w-full"
						placeholder="https://clashfinder.com/s/festival2026/"
						bind:value={clashfinderUrl}
					/>
				</label>

				{#if clashfinderUrl && !clashfinderSlug}
					<div class="text-sm text-error">Not a valid Clashfinder URL</div>
				{:else if clashfinderSlug}
					<div class="text-sm text-success">Slug: <code>{clashfinderSlug}</code></div>
				{/if}
			</div>
		{/if}

		<!-- File upload -->
		{#if importType === 'file'}
			<div class="space-y-3">
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Lineup file (JSON or CSV)</span></div>
					<input
						type="file"
						class="file-input file-input-bordered w-full"
						accept=".json,.csv"
						onchange={handleFileUpload}
					/>
				</label>

				{#if importError}
					<div class="alert alert-error text-sm">
						<span>{importError}</span>
					</div>
				{/if}
				{#if parsedActs.length > 0}
					<div class="alert alert-success text-sm">
						<span>{parsedActs.length} acts loaded successfully</span>
					</div>
				{/if}
				{#if importErrors.length > 0}
					<div class="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
						<p class="font-medium text-warning mb-2">
							{importErrors.length} {importErrors.length === 1 ? 'row' : 'rows'} skipped:
						</p>
						<ul class="space-y-1 text-xs text-base-content/70 max-h-32 overflow-y-auto">
							{#each importErrors as err}
								<li>• {err}</li>
							{/each}
						</ul>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<div class="mt-6 flex justify-between">
		<button class="btn btn-ghost" onclick={prevStep}>Back</button>
		<button class="btn btn-primary" onclick={nextStep}>Next</button>
	</div>
{/if}

<!-- Step 3: Map -->
{#if currentStep === 3}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">Festival Map</h2>
		<p class="text-sm text-base-content/60">
			Optionally upload a festival map image. You can add or change this later.
		</p>

		<label class="form-control w-full">
			<div class="label"><span class="label-text">Map image (optional)</span></div>
			<input
				type="file"
				class="file-input file-input-bordered w-full"
				accept="image/*"
				onchange={handleMapUpload}
			/>
		</label>

		{#if mapPreviewUrl}
			<div class="relative">
				<img src={mapPreviewUrl} alt="Festival map preview" class="w-full rounded-lg object-contain max-h-64" />
				<button
					type="button"
					class="btn btn-circle btn-xs btn-error absolute right-2 top-2"
					onclick={() => { mapBlob = null; mapPreviewUrl = ''; }}
					aria-label="Remove map"
				>
					✕
				</button>
			</div>
		{/if}
	</div>

	<div class="mt-6 flex justify-between">
		<button class="btn btn-ghost" onclick={prevStep}>Back</button>
		<button class="btn btn-primary" onclick={nextStep}>Next</button>
	</div>
{/if}

<!-- Step 4: Theme -->
{#if currentStep === 4}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">Choose a Theme</h2>
		<p class="text-sm text-base-content/60">Pick a visual theme for your festival.</p>

		<div class="grid grid-cols-2 gap-3">
			{#each themePresets as preset}
				<button
					type="button"
					class="rounded-xl border-2 p-4 text-left transition-all {selectedThemeName === preset.name
						? 'border-primary bg-base-200'
						: 'border-base-300 hover:border-base-content/30'}"
					onclick={() => (selectedThemeName = preset.name)}
				>
					<div class="flex items-center gap-2 mb-1">
						{#if preset.swatch}
							<span
								class="inline-block size-4 rounded-full border border-base-300"
								style="background-color: {preset.swatch}"
							></span>
						{:else}
							<span class="inline-block size-4 rounded-full border border-dashed border-base-content/40"></span>
						{/if}
						<span class="font-medium text-sm">{preset.label}</span>
					</div>
					<p class="text-xs text-base-content/60">{preset.description}</p>
				</button>
			{/each}
		</div>

		<!-- Custom color inputs -->
		{#if selectedThemeName === 'custom'}
			<div class="grid grid-cols-2 gap-3">
				<label class="form-control">
					<div class="label"><span class="label-text">Primary color</span></div>
					<div class="flex items-center gap-2">
						<input type="color" class="h-10 w-12 cursor-pointer rounded border border-base-300" bind:value={customPrimary} />
						<input type="text" class="input input-bordered flex-1 font-mono text-sm" bind:value={customPrimary} placeholder="#7c3aed" />
					</div>
				</label>
				<label class="form-control">
					<div class="label"><span class="label-text">Secondary color</span></div>
					<div class="flex items-center gap-2">
						<input type="color" class="h-10 w-12 cursor-pointer rounded border border-base-300" bind:value={customSecondary} />
						<input type="text" class="input input-bordered flex-1 font-mono text-sm" bind:value={customSecondary} placeholder="#db2777" />
					</div>
				</label>
			</div>
		{/if}
	</div>

	<div class="mt-6 flex justify-between">
		<button class="btn btn-ghost" onclick={prevStep}>Back</button>
		<button class="btn btn-primary" onclick={nextStep}>Next</button>
	</div>
{/if}

<!-- Step 5: Confirm -->
{#if currentStep === 5}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">
			{mode === 'create' ? 'Create Festival' : 'Save Changes'}
		</h2>

		<div class="card bg-base-200">
			<div class="card-body gap-3 p-4">
				<div class="flex justify-between items-start">
					<span class="text-sm font-medium text-base-content/60">Name</span>
					<span class="text-sm font-bold text-right">{name}</span>
				</div>
				{#if location}
					<div class="flex justify-between items-start">
						<span class="text-sm font-medium text-base-content/60">Location</span>
						<span class="text-sm text-right">{location}</span>
					</div>
				{/if}
				<div class="flex justify-between">
					<span class="text-sm font-medium text-base-content/60">Dates</span>
					<span class="text-sm">{startDate} – {endDate}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-sm font-medium text-base-content/60">Timezone</span>
					<span class="text-sm">{timezone}</span>
				</div>
				<div class="flex justify-between">
					<span class="text-sm font-medium text-base-content/60">Day boundary</span>
					<span class="text-sm">{dayBoundaryHour}:00</span>
				</div>
				<div class="flex justify-between">
					<span class="text-sm font-medium text-base-content/60">Lineup</span>
					<span class="text-sm">
						{#if importType === 'clashfinder' && clashfinderSlug}
							Clashfinder: {clashfinderSlug}
						{:else if importType === 'file' && parsedActs.length > 0}
							{parsedActs.length} acts from file
						{:else}
							Not imported
						{/if}
					</span>
				</div>
				<div class="flex justify-between">
					<span class="text-sm font-medium text-base-content/60">Map</span>
					<span class="text-sm">{mapBlob ? 'Image uploaded' : 'None'}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-sm font-medium text-base-content/60">Theme</span>
					<span class="text-sm capitalize">{selectedThemeName}</span>
				</div>
			</div>
		</div>

		{#if saveError}
			<div class="alert alert-error text-sm">
				<span>{saveError}</span>
			</div>
		{/if}
	</div>

	<div class="mt-6 flex justify-between">
		<button class="btn btn-ghost" onclick={prevStep} disabled={saving}>Back</button>
		<button class="btn btn-primary" onclick={handleSave} disabled={saving}>
			{#if saving}
				<span class="loading loading-spinner loading-sm"></span>
			{/if}
			{mode === 'create' ? 'Create Festival' : 'Save Changes'}
		</button>
	</div>
{/if}
