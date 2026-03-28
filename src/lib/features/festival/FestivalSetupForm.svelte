<script lang="ts">
	import { goto } from '$app/navigation';
	import { db } from '$lib/db';
	import {
		createFestival,
		updateFestival,
		setActiveFestival,
		importLineup
	} from '$lib/features/festival/operations';
	import { parseClashfinderUrl, fetchClashfinderLineup } from '$lib/features/import/clashfinder';
	import { parseJsonLineup, parseCsvLineup } from '$lib/features/import/manual';
	import { getDecryptedPrivateKey } from '$lib/features/settings/operations';

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
			startDate: string;
			endDate: string;
			timezone: string;
			clashfinderSlug?: string;
		};
	} = $props();

	// --- Device timezone ---
	const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

	// --- Step 1: Import Source ---
	let importType = $state<'clashfinder' | 'file' | 'skip'>(
		initialData?.clashfinderSlug ? 'clashfinder' : 'skip'
	);
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
	let isFetching = $state(false);

	$effect(() => {
		import('@capacitor/core')
			.then(({ Capacitor }) => {
				isNative = Capacitor.isNativePlatform();
			})
			.catch(() => {
				isNative = false;
			});
	});

	const clashfinderSlug = $derived(parseClashfinderUrl(clashfinderUrl));

	// --- Step 2: Details (pre-filled from import) ---
	let name = $state(initialData?.name ?? '');
	let startDate = $state(initialData?.startDate ?? '');
	let endDate = $state(initialData?.endDate ?? '');
	let timezone = $state(initialData?.timezone ?? deviceTimezone);

	// --- Step 3: Map ---
	let mapBlob = $state<Blob | null>(null);
	let mapPreviewUrl = $state('');

	// --- Navigation ---
	let currentStep = $state(1);
	const totalSteps = 3;

	function nextStep() {
		currentStep = Math.min(totalSteps, currentStep + 1);
	}
	function prevStep() {
		currentStep = Math.max(1, currentStep - 1);
	}

	// --- Validation ---
	const step2Valid = $derived(name.trim() !== '' && startDate !== '' && endDate !== '');

	// --- Clashfinder fetch ---
	async function handleClashfinderFetch() {
		if (!clashfinderSlug) return;
		isFetching = true;
		importError = '';
		parsedActs = [];

		try {
			const settings = await db.settings.toCollection().first();
			const username = settings?.clashfinderUsername ?? '';
			const privateKey = await getDecryptedPrivateKey() ?? '';
			if (!username || !privateKey) {
				throw new Error('Clashfinder credentials not set. Add them in Settings first.');
			}

			const result = await fetchClashfinderLineup(clashfinderSlug, username, username, privateKey);

			parsedActs = result.acts.map((a) => ({
				name: a.name,
				stage: a.stage,
				startTime: a.startTime,
				endTime: a.endTime
			}));

			// Pre-fill festival details from import
			if (result.title && !name) {
				name = result.title;
			}

			// Derive date range from act times
			if (result.acts.length > 0) {
				const starts = result.acts.map((a) => a.startTime).sort();
				const ends = result.acts.map((a) => a.endTime).sort();
				const derivedStart = starts[0].split('T')[0];
				const derivedEnd = ends[ends.length - 1].split('T')[0];
				if (!startDate) startDate = derivedStart;
				if (!endDate) endDate = derivedEnd;
			}
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to fetch from Clashfinder';
		} finally {
			isFetching = false;
		}
	}

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

			parsedActs = result.acts.map((a) => ({
				name: a.name,
				stage: a.stage,
				startTime: a.startTime,
				endTime: a.endTime
			}));

			// Derive dates from file import too
			if (result.acts.length > 0) {
				const starts = result.acts.map((a) => a.startTime).sort();
				const ends = result.acts.map((a) => a.endTime).sort();
				if (!startDate) startDate = starts[0].split('T')[0];
				if (!endDate) endDate = ends[ends.length - 1].split('T')[0];
			}

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
			const festivalData = {
				name: name.trim(),
				timezone,
				dayBoundaryHour: 6,
				startDate,
				endDate,
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

			// Import lineup if acts were loaded
			if (parsedActs.length > 0) {
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
	{#each ['Import', 'Details', 'Map'] as stepLabel, i}
		<li class="step {currentStep > i ? 'step-primary' : ''}">{stepLabel}</li>
	{/each}
</ul>

<!-- Step 1: Import Source -->
{#if currentStep === 1}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">Import Lineup</h2>
		<p class="text-sm text-base-content/60">
			Start by importing your lineup — we'll fill in the rest from there.
		</p>

		<!-- Import type selector -->
		<div class="space-y-2">
			<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-4 {importType === 'clashfinder' ? 'border-primary bg-base-200' : ''}">
				<input type="radio" name="importType" class="radio radio-primary" bind:group={importType} value="clashfinder" />
				<div>
					<div class="font-medium">Clashfinder URL</div>
					<div class="text-xs text-base-content/60">Import from clashfinder.com</div>
				</div>
			</label>
			<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-4 {importType === 'file' ? 'border-primary bg-base-200' : ''}">
				<input type="radio" name="importType" class="radio radio-primary" bind:group={importType} value="file" />
				<div>
					<div class="font-medium">Upload file</div>
					<div class="text-xs text-base-content/60">JSON or CSV lineup file</div>
				</div>
			</label>
			<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-4 {importType === 'skip' ? 'border-primary bg-base-200' : ''}">
				<input type="radio" name="importType" class="radio radio-primary" bind:group={importType} value="skip" />
				<div>
					<div class="font-medium">Set up manually</div>
					<div class="text-xs text-base-content/60">Enter festival details yourself</div>
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
							The URL will be saved and you can sync the lineup from the app.
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
					<div class="text-sm text-success">
						<span>Ready to import: <code>{clashfinderSlug}</code></span>
					</div>

					{#if isNative && !parsedActs.length}
						<button
							class="btn btn-primary btn-sm"
							onclick={handleClashfinderFetch}
							disabled={isFetching}
						>
							{#if isFetching}
								<span class="loading loading-spinner loading-xs"></span>
							{/if}
							Fetch Lineup
						</button>
					{/if}
				{/if}

				{#if parsedActs.length > 0}
					<div class="alert alert-success text-sm">
						<span>{parsedActs.length} acts loaded{name ? ` from "${name}"` : ''}</span>
					</div>
				{/if}

				{#if importError}
					<div class="alert alert-error text-sm">
						<span>{importError}</span>
					</div>
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

	<div class="mt-6 flex justify-end">
		<button class="btn btn-primary" onclick={nextStep}>
			Next
		</button>
	</div>
{/if}

<!-- Step 2: Details (pre-filled from import) -->
{#if currentStep === 2}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">Festival Details</h2>
		{#if parsedActs.length > 0}
			<p class="text-sm text-base-content/60">
				We've pre-filled what we could from your import. Check it looks right.
			</p>
		{/if}

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

		<div class="text-xs text-base-content/50">
			Timezone: {timezone}
		</div>
	</div>

	<div class="mt-6 flex justify-between">
		<button class="btn btn-ghost" onclick={prevStep}>Back</button>
		<button class="btn btn-primary" onclick={nextStep} disabled={!step2Valid}>
			Next
		</button>
	</div>
{/if}

<!-- Step 3: Map -->
{#if currentStep === 3}
	<div class="space-y-4">
		<h2 class="text-xl font-bold">Festival Map</h2>
		<p class="text-sm text-base-content/60">
			Upload a festival map image, or skip and add one later.
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

		{#if saveError}
			<div class="alert alert-error text-sm">
				<span>{saveError}</span>
			</div>
		{/if}
	</div>

	<div class="mt-6 flex justify-between">
		<button class="btn btn-ghost" onclick={prevStep} disabled={saving}>Back</button>
		<div class="flex gap-2">
			{#if !mapBlob}
				<button class="btn btn-ghost" onclick={handleSave} disabled={saving}>
					{#if saving}
						<span class="loading loading-spinner loading-sm"></span>
					{/if}
					Skip
				</button>
			{/if}
			<button class="btn btn-primary" onclick={handleSave} disabled={saving}>
				{#if saving}
					<span class="loading loading-spinner loading-sm"></span>
				{/if}
				{mode === 'create' ? 'Create Festival' : 'Save Changes'}
			</button>
		</div>
	</div>
{/if}
