<script lang="ts">
  import { parseISO, format } from 'date-fns';
  import type { Festival } from '$lib/types';

  let {
    festival,
    actCount,
    isActive,
    onActivate
  }: {
    festival: Festival;
    actCount: number;
    isActive: boolean;
    onActivate?: () => void;
  } = $props();

  const dateRange = $derived(
    `${format(parseISO(festival.startDate), 'MMM d')} – ${format(parseISO(festival.endDate), 'MMM d, yyyy')}`
  );
</script>

<div class="card bg-base-200 shadow-sm {isActive ? 'ring-2 ring-primary' : ''}">
  <!-- Theme color preview strip -->
  {#if festival.theme}
    <div
      class="h-1.5 rounded-t-2xl"
      style="background: linear-gradient(to right, {festival.theme.primary ?? '#b14aed'}, {festival.theme.secondary ?? '#ff2d78'})"
    ></div>
  {/if}

  <div class="card-body gap-2 p-4">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <h3 class="truncate text-lg font-semibold">{festival.name}</h3>
        <p class="text-base-content/60 text-sm">{dateRange}</p>
        <p class="text-base-content/50 text-xs">{festival.timezone}</p>
      </div>
      {#if isActive}
        <span class="badge badge-primary badge-sm shrink-0">Active</span>
      {/if}
    </div>

    <div class="flex items-center justify-between">
      <span class="text-base-content/60 text-sm">
        {actCount} {actCount === 1 ? 'act' : 'acts'}
      </span>

      {#if !isActive && onActivate}
        <button
          type="button"
          class="btn btn-sm btn-outline"
          onclick={onActivate}
        >
          Switch to this
        </button>
      {/if}
    </div>
  </div>
</div>
