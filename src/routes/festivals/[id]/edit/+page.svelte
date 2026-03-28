<script lang="ts">
	import { page } from '$app/stores';
	import { db } from '$lib/db';
	import { useLiveQuery } from '$lib/db/live.svelte';
	import FestivalSetupForm from '$lib/features/festival/FestivalSetupForm.svelte';

	const festivalId = $derived(Number($page.params.id));

	const festivalQuery = useLiveQuery(
		() => db.festivals.get(festivalId),
		undefined
	);
</script>

<div class="container mx-auto max-w-lg px-4 py-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/" class="btn btn-ghost btn-sm btn-circle" aria-label="Back">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h1 class="text-2xl font-bold">Edit Festival</h1>
	</div>

	{#if festivalQuery.value === undefined}
		<div class="flex justify-center py-12">
			<span class="loading loading-spinner loading-lg"></span>
		</div>
	{:else if festivalQuery.value === null}
		<div class="alert alert-error">
			<span>Festival not found.</span>
		</div>
	{:else}
		{@const festival = festivalQuery.value}
		<FestivalSetupForm
			mode="edit"
			festivalId={festival.id}
			initialData={{
				name: festival.name,
				startDate: festival.startDate,
				endDate: festival.endDate,
				timezone: festival.timezone,
				clashfinderSlug: festival.clashfinderSlug
			}}
		/>
	{/if}
</div>
