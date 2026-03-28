<script lang="ts">
  import type { Act } from '$lib/types';
  import { toggleHighlight } from '$lib/features/highlights/operations';

  let {
    actA,
    actB
  }: {
    actA: Act;
    actB: Act;
  } = $props();

  const rows: Array<{ act: Act; other: Act }> = $derived([
    { act: actA, other: actB },
    { act: actB, other: actA }
  ]);

  async function choose(remove: Act) {
    if (remove.id == null) return;
    await toggleHighlight(remove.festivalId, remove.id);
  }
</script>

<div class="rounded-lg border border-warning bg-warning/10 p-3">
  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">⚠ Time clash</p>
  <div class="space-y-2">
    {#each rows as { act, other } (act.id)}
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{act.name}</p>
          <p class="text-xs text-base-content/60">
            {act.stage} · {act.startTime.slice(11, 16)}–{act.endTime.slice(11, 16)}
          </p>
        </div>
        <button
          type="button"
          class="btn btn-outline btn-warning btn-xs"
          onclick={() => choose(other)}
        >
          Choose
        </button>
      </div>
    {/each}
  </div>
</div>
