<script lang="ts">
	import { getToasts, removeToast } from './toasts.svelte.js';
</script>

<div class="toast toast-top toast-end z-50">
	{#each getToasts() as toast (toast.id)}
		<div class="alert alert-info shadow-lg max-w-sm">
			<div class="flex flex-col gap-0.5 flex-1">
				{#if toast.title}
					<span class="font-semibold">{toast.title}</span>
				{/if}
				<span>{toast.message}</span>
			</div>
			<button
				class="btn btn-ghost btn-xs"
				onclick={() => removeToast(toast.id)}
				aria-label="Dismiss"
			>✕</button>
		</div>
	{/each}
</div>
