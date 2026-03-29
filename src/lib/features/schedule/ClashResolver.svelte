<script lang="ts">
  import type { Act, UserHighlight } from '$lib/types';
  import { updateClashRank } from '$lib/features/highlights/operations';
  import Sortable from 'sortablejs';

  let {
    clashGroups,
    highlightMap,
    onclose
  }: {
    clashGroups: Act[][];
    highlightMap: Map<number, UserHighlight>;
    onclose?: () => void;
  } = $props();

  // For each group, maintain the current ordering (initialized from clashRank or startTime order)
  let groupOrders = $state<Act[][]>(
    clashGroups.map((group) =>
      [...group].sort((a, b) => {
        const rankA = a.id != null ? (highlightMap.get(a.id)?.clashRank ?? Infinity) : Infinity;
        const rankB = b.id != null ? (highlightMap.get(b.id)?.clashRank ?? Infinity) : Infinity;
        if (rankA !== rankB) return rankA - rankB;
        return a.startTime.localeCompare(b.startTime);
      })
    )
  );

  function initSortable(el: HTMLElement, gi: number) {
    const instance = Sortable.create(el, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'opacity-30',
      onEnd: (evt) => {
        if (evt.oldIndex == null || evt.newIndex == null) return;
        const updated = [...groupOrders[gi]];
        const [moved] = updated.splice(evt.oldIndex, 1);
        updated.splice(evt.newIndex, 0, moved);
        groupOrders[gi] = updated;
        saveRanks(gi);
      }
    });
    return {
      destroy() { instance.destroy(); }
    };
  }

  async function saveRanks(groupIndex: number) {
    const group = groupOrders[groupIndex];
    for (let i = 0; i < group.length; i++) {
      const act = group[i];
      if (act.id != null) {
        await updateClashRank(act.festivalId, act.id, i);
      }
    }
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
  role="dialog"
  aria-modal="true"
  aria-label="Resolve clashes"
>
  <button
    type="button"
    class="absolute inset-0"
    aria-label="Close"
    onclick={onclose}
  ></button>

  <div class="relative z-10 w-full max-w-lg overflow-y-auto rounded-t-2xl bg-base-100 shadow-xl"
    style="max-height: 85dvh;"
  >
    <div class="p-5 pt-6">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-xl font-bold">Resolve Clashes</h2>
          <p class="mt-1 text-sm text-base-content/60">Drag acts to rank your preference. Top = most want to see.</p>
        </div>
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-sm flex-shrink-0"
          onclick={onclose}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div class="space-y-6">
        {#each groupOrders as group, gi}
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">
              Clash group {gi + 1}
            </p>
            <div
              class="space-y-2"
              use:initSortable={gi}
            >
              {#each group as act, i (act.id)}
                <div class="flex items-center gap-3 rounded-lg bg-base-200 p-3" data-id={act.id}>
                  <!-- Drag handle -->
                  <div class="drag-handle cursor-grab touch-none text-base-content/30 active:cursor-grabbing">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
                      <path fill-rule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" />
                    </svg>
                  </div>

                  <!-- Rank number -->
                  <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {i + 1}
                  </span>

                  <!-- Act info -->
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{act.name}</p>
                    <p class="text-xs text-base-content/60">
                      {act.stage} · {act.startTime.slice(11, 16)}–{act.endTime.slice(11, 16)}
                    </p>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-6">
        <button
          type="button"
          class="btn btn-primary w-full"
          onclick={onclose}
        >
          Done
        </button>
      </div>
    </div>

    <div style="padding-bottom: env(safe-area-inset-bottom, 16px);"></div>
  </div>
</div>
