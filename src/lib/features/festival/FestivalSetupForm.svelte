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
	import { parseIcal, fetchIcalFeed } from '$lib/features/import/ical';

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
	let importType = $state<'clashfinder' | 'ical' | 'skip'>(
		initialData?.clashfinderSlug ? 'clashfinder' : 'skip'
	);
	let icalUrl = $state('');
	let clashfinderUrl = $state(
		initialData?.clashfinderSlug
			? `https://clashfinder.com/s/${initialData.clashfinderSlug}/`
			: ''
	);
	let parsedActs = $state<Array<{ name: string; stage: string; startTime: string; endTime: string }>>(
		[]
	);
	let importError = $state('');
	let isFetching = $state(false);

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
			const result = await fetchClashfinderLineup(clashfinderSlug);

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
			prefillDatesFromActs();
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to fetch from Clashfinder';
		} finally {
			isFetching = false;
		}
	}

	// --- iCal handlers ---
	async function handleIcalFetch() {
		if (!icalUrl) return;
		isFetching = true;
		importError = '';
		parsedActs = [];

		try {
			const result = await fetchIcalFeed(icalUrl);
			parsedActs = result.acts;
			if (result.title && !name) name = result.title;
			prefillDatesFromActs();
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to fetch iCal feed';
		} finally {
			isFetching = false;
		}
	}

	async function handleIcalFileUpload(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importError = '';
		parsedActs = [];

		try {
			const text = await file.text();
			const result = parseIcal(text);
			parsedActs = result.acts;
			if (result.title && !name) name = result.title;
			prefillDatesFromActs();
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to parse iCal file';
		}
	}

	function prefillDatesFromActs() {
		if (parsedActs.length > 0) {
			const starts = parsedActs.map((a) => a.startTime).sort();
			const ends = parsedActs.map((a) => a.endTime).sort();
			if (!startDate) startDate = starts[0].split('T')[0];
			if (!endDate) endDate = ends[ends.length - 1].split('T')[0];
		}
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
					importType === 'clashfinder' && clashfinderSlug ? clashfinderSlug : undefined,
				icalUrl:
					importType === 'ical' && icalUrl ? icalUrl : undefined
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
			<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-base-300 p-4 {importType === 'ical' ? 'border-primary bg-base-200' : ''}">
				<input type="radio" name="importType" class="radio radio-primary" bind:group={importType} value="ical" />
				<div>
					<div class="font-medium">iCal feed or file</div>
					<div class="text-xs text-base-content/60">Import from a .ics URL or file</div>
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
				<label class="form-control w-full">
					<div class="label"><span class="label-text">Clashfinder URL</span></div>
					<input
						type="url"
						class="input w-full"
						placeholder="https://clashfinder.com/s/festival2026/"
						bind:value={clashfinderUrl}
					/>
					<div class="label">
						<span class="label-text-alt text-base-content/50">Paste the URL from your browser when viewing the lineup on clashfinder.com</span>
					</div>
				</label>

				{#if clashfinderUrl && !clashfinderSlug}
					<div class="text-sm text-error">Not a valid Clashfinder URL — should look like clashfinder.com/s/your-festival/</div>
				{:else if clashfinderSlug && !parsedActs.length}
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

		<!-- iCal input -->
		{#if importType === 'ical'}
			<div class="space-y-3">
				<label class="form-control w-full">
					<div class="label"><span class="label-text">iCal feed URL</span></div>
					<input
						type="url"
						class="input w-full"
						placeholder="https://example.com/calendar.ics"
						bind:value={icalUrl}
					/>
					<div class="label">
						<span class="label-text-alt text-base-content/50">Paste a URL to a .ics calendar feed for auto-sync</span>
					</div>
				</label>

				{#if icalUrl && !parsedActs.length}
					<button
						class="btn btn-primary btn-sm"
						onclick={handleIcalFetch}
						disabled={isFetching}
					>
						{#if isFetching}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						Fetch Schedule
					</button>
				{/if}

				<div class="divider text-xs text-base-content/40">or upload a file</div>

				<label class="form-control w-full">
					<div class="label"><span class="label-text">Upload .ics file</span></div>
					<input
						type="file"
						class="file-input w-full"
						accept=".ics,text/calendar"
						onchange={handleIcalFileUpload}
					/>
				</label>

				{#if parsedActs.length > 0}
					<div class="alert alert-success text-sm">
						<span>{parsedActs.length} events loaded{name ? ` from "${name}"` : ''}</span>
					</div>
				{/if}

				{#if importError}
					<div class="alert alert-error text-sm">
						<span>{importError}</span>
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
				class="input w-full"
				placeholder="e.g. Glastonbury 2026"
				bind:value={name}
				required
			/>
		</label>

		<div class="grid grid-cols-2 gap-3">
			<label class="form-control">
				<div class="label"><span class="label-text">Start date *</span></div>
				<input type="date" class="input w-full" bind:value={startDate} required />
			</label>
			<label class="form-control">
				<div class="label"><span class="label-text">End date *</span></div>
				<input type="date" class="input w-full" bind:value={endDate} required />
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
				class="file-input w-full"
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
