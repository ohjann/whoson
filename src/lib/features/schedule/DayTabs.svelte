<script lang="ts">
  let {
    days,
    selectedDay,
    clashCounts = new Map<string, number>(),
    onSelect
  }: {
    days: string[];
    selectedDay: string | null;
    clashCounts?: Map<string, number>;
    onSelect: (day: string) => void;
  } = $props();

  function formatDay(isoDate: string): string {
    const [, month, day] = isoDate.split('-').map(Number);
    return new Date(2000, month - 1, day).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }
</script>

<div class="flex gap-1 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Festival days">
  {#each days as day (day)}
    {@const clashCount = clashCounts.get(day) ?? 0}
    <button
      type="button"
      role="tab"
      aria-selected={selectedDay === day}
      class="btn btn-sm flex-shrink-0 {selectedDay === day ? 'btn-primary' : 'btn-ghost'}"
      onclick={() => onSelect(day)}
    >
      {formatDay(day)}
      {#if clashCount > 0}
        <span class="badge badge-warning badge-sm ml-1" aria-label="{clashCount} clash{clashCount > 1 ? 'es' : ''}">{clashCount}</span>
      {/if}
    </button>
  {/each}
</div>
