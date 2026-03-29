<script lang="ts">
  import type { Act, UserHighlight } from '$lib/types';
  import { cn } from '$lib/utils';

  let {
    act,
    highlight,
    isClashing = false,
    clashResolved = false,
    isHidden = false,
    onToggle,
    onClick
  }: {
    act: Act;
    highlight: UserHighlight | undefined;
    isClashing?: boolean;
    clashResolved?: boolean;
    isHidden?: boolean;
    onToggle: (act: Act) => void;
    onClick: (act: Act) => void;
  } = $props();

  const isHighlighted = $derived(highlight !== undefined);
</script>

<article
  class={cn(
    'mx-4 mb-2 flex items-center gap-3 rounded-lg p-3 transition-colors',
    isHidden ? 'opacity-40' : '',
    isHighlighted ? 'bg-primary/10 border border-primary/30' : 'bg-base-200'
  )}
  aria-label="{act.name}{isHighlighted ? ', highlighted' : ''}{isHidden ? ', hidden' : ''}{isClashing ? ', has time clash' : ''}"
>
  <!-- Highlight toggle: min 44×44px touch target -->
  <button
    type="button"
    class={cn(
      'btn btn-circle flex-shrink-0 min-h-11 min-w-11',
      isHighlighted ? 'btn-warning' : 'btn-ghost'
    )}
    aria-label={isHighlighted ? `Remove highlight for ${act.name}` : `Highlight ${act.name}`}
    aria-pressed={isHighlighted}
    onclick={() => onToggle(act)}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4" aria-hidden="true">
      <path
        fill-rule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z"
        clip-rule="evenodd"
      />
    </svg>
  </button>

  <!-- Act info: min 44px height touch target -->
  <button
    type="button"
    class="flex min-w-0 flex-1 flex-col items-start text-left min-h-11"
    aria-label="View details for {act.name}, {act.stage}, {act.startTime.slice(11, 16)}–{act.endTime.slice(11, 16)}"
    onclick={() => onClick(act)}
  >
    <span class="truncate font-medium">{act.name}</span>
    <span class="text-xs text-base-content/60">
      {act.stage} · {act.startTime.slice(11, 16)}–{act.endTime.slice(11, 16)}
    </span>
    {#if act.genre}
      <div class="mt-1 flex flex-wrap gap-1">
        <span class="badge badge-outline badge-xs">{act.genre}</span>
      </div>
    {/if}
  </button>

  <!-- Right-side badges -->
  <button
    type="button"
    class="flex flex-shrink-0 items-center gap-1"
    aria-hidden="true"
    tabindex="-1"
    onclick={() => onClick(act)}
  >
    {#if isClashing && !clashResolved}
      <span class="badge badge-warning badge-sm">⚠</span>
    {:else if isClashing && clashResolved}
      <span class="badge badge-ghost badge-sm text-base-content/30">⚠</span>
    {/if}
  </button>
</article>
