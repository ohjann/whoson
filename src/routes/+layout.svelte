<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { db } from '$lib/db';
	import { useLiveQuery } from '$lib/db/live.svelte';

	let { children } = $props();

	// Load active festival for theme
	const settings = useLiveQuery(() => db.settings.toCollection().first(), undefined);

	// Apply theme to html element
	$effect(() => {
		const activeFestivalId = settings.value?.activeFestivalId;
		if (activeFestivalId) {
			db.festivals.get(activeFestivalId).then((festival) => {
				if (festival?.theme?.name) {
					document.documentElement.setAttribute('data-theme', festival.theme.name);
				}
			});
		}
	});

	// Nav items
	const navItems = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/schedule/', label: 'Schedule', icon: 'schedule' },
		{ href: '/map/', label: 'Map', icon: 'map' },
		{ href: '/settings/', label: 'Settings', icon: 'settings' }
	] as const;

	function isActive(href: string): boolean {
		const currentPath = $page.url.pathname;
		if (href === '/') {
			return currentPath === '/';
		}
		return currentPath.startsWith(href);
	}
</script>

<div class="flex min-h-screen flex-col">
	<main class="flex-1 pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
		{@render children()}
	</main>

	<nav
		class="btm-nav fixed bottom-0 left-0 right-0 z-50"
		style="padding-bottom: env(safe-area-inset-bottom, 0px);"
	>
		{#each navItems as item}
			<a href={item.href} class:active={isActive(item.href)}>
				<span class="btm-nav-label">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
