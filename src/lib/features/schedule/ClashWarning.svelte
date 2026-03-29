<script lang="ts">
  import type { Act } from '$lib/types';

  let {
    actA,
    actB
  }: {
    actA: Act;
    actB: Act;
  } = $props();
</script>

<div class="rounded-lg border border-warning bg-warning/10 p-3">
  <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">Time clash</p>
  <div class="space-y-2">
    {#each [actA, actB] as act (act.id)}
      <div class="flex items-center gap-2">
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium">{act.name}</p>
          <p class="text-xs text-base-content/60">
            {act.stage} · {act.startTime.slice(11, 16)}–{act.endTime.slice(11, 16)}
          </p>
        </div>
      </div>
    {/each}
  </div>
</div>
