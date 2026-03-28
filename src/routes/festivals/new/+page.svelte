<script lang="ts">
	import FestivalSetupForm from '$lib/features/festival/FestivalSetupForm.svelte';
</script>

<div class="container mx-auto max-w-lg px-4 py-6">
	<div class="mb-6 flex items-center gap-3">
		<a href="/" class="btn btn-ghost btn-sm btn-circle" aria-label="Back">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h1 class="text-2xl font-bold">New Festival</h1>
	</div>

	<FestivalSetupForm mode="create" />
</div>
