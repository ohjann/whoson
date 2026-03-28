<script lang="ts">
  import type { Snippet } from 'svelte';

  type AnyItem = { id: string | number; height?: number; [key: string]: unknown };

  let {
    items,
    defaultItemHeight = 80,
    buffer = 5,
    item: itemSnippet,
    class: className = '',
    role,
    'aria-label': ariaLabel
  }: {
    items: AnyItem[];
    defaultItemHeight?: number;
    buffer?: number;
    item: Snippet<[AnyItem, number]>;
    class?: string;
    role?: string;
    'aria-label'?: string;
  } = $props();

  let containerEl: HTMLElement | undefined = $state();
  let scrollY = $state(0);
  let windowHeight = $state(600);
  let containerTop = $state(0);

  const itemHeights = $derived(items.map((it) => it.height ?? defaultItemHeight));

  const cumulativeHeights = $derived.by(() => {
    const cum: number[] = [0];
    for (const h of itemHeights) {
      cum.push(cum[cum.length - 1] + h);
    }
    return cum;
  });

  const totalHeight = $derived(cumulativeHeights[cumulativeHeights.length - 1] ?? 0);

  function binarySearch(target: number): number {
    let lo = 0;
    let hi = cumulativeHeights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulativeHeights[mid] <= target) lo = mid + 1;
      else hi = mid;
    }
    return Math.max(0, lo - 1);
  }

  $effect(() => {
    function update() {
      scrollY = window.scrollY;
      windowHeight = window.innerHeight;
      if (containerEl) {
        containerTop = containerEl.getBoundingClientRect().top + window.scrollY;
      }
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });

    let ro: ResizeObserver | undefined;
    if (containerEl) {
      ro = new ResizeObserver(update);
      ro.observe(containerEl);
    }

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  });

  const relativeScroll = $derived(Math.max(0, scrollY - containerTop));

  const startIndex = $derived(
    Math.max(0, binarySearch(relativeScroll) - buffer)
  );
  const endIndex = $derived(
    Math.min(items.length - 1, binarySearch(relativeScroll + windowHeight) + buffer)
  );

  const paddingTop = $derived(cumulativeHeights[startIndex] ?? 0);
  const paddingBottom = $derived(
    totalHeight - (cumulativeHeights[Math.min(endIndex + 1, cumulativeHeights.length - 1)] ?? totalHeight)
  );

  const visibleItems = $derived(
    items.slice(startIndex, endIndex + 1).map((it, i) => ({ item: it, index: startIndex + i }))
  );
</script>

<div bind:this={containerEl} class={className} {role} aria-label={ariaLabel}>
  <div aria-hidden="true" style="height: {paddingTop}px;"></div>
  {#each visibleItems as { item, index } (item.id)}
    {@render itemSnippet(item, index)}
  {/each}
  <div aria-hidden="true" style="height: {paddingBottom}px;"></div>
</div>
