<script>
	import '../app.css';
	import Toasts from '$lib/features/notifications/Toasts.svelte';
	let { children } = $props();
</script>

{@render children()}
<Toasts />
