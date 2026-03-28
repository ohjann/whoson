<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { afterNavigate } from '$app/navigation';
	import { db } from '$lib/db';
	import { applyFestivalTheme } from '$lib/features/theme/index.js';
	import { liveQuery } from 'dexie';

	let { children } = $props();

	// Apply dynamic festival theme (AB-019)
	$effect(() => {
		const sub = liveQuery(async () => {
			const settings = await db.settings.toCollection().first();
			if (!settings?.activeFestivalId) return undefined;
			return db.festivals.get(settings.activeFestivalId);
		}).subscribe({
			next: (festival) => applyFestivalTheme(festival?.theme),
			error: (err) => console.error('theme liveQuery error:', err)
		});
		return () => sub.unsubscribe();
	});

	// Focus management on route transitions — moves focus to main h1 for screen readers
	afterNavigate(() => {
		const h1 = document.querySelector<HTMLElement>('main h1, h1[tabindex="-1"]');
		if (h1) {
			h1.focus({ preventScroll: true });
		}
	});

	// Nav items
	const navItems = [
		{ href: '/', label: 'Home', icon: 'home' },
		{ href: '/now/', label: 'Now', icon: 'now' },
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
		aria-label="Main navigation"
		class="btm-nav fixed bottom-0 left-0 right-0 z-50"
		style="padding-bottom: env(safe-area-inset-bottom, 0px);"
	>
		{#each navItems as item}
			<a
				href={item.href}
				class:active={isActive(item.href)}
				aria-current={isActive(item.href) ? 'page' : undefined}
				aria-label={item.label}
			>
				<span class="btm-nav-label">{item.label}</span>
			</a>
		{/each}
	</nav>
</div>
