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

<div
  class="flex gap-1 overflow-x-auto px-4 pb-1"
  role="tablist"
  aria-label="Festival days"
  style="mask-image: linear-gradient(to right, transparent 0, black 1rem, black calc(100% - 1rem), transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0, black 1rem, black calc(100% - 1rem), transparent 100%);"
>
  {#each days as day (day)}
    {@const clashCount = clashCounts.get(day) ?? 0}
    <button
      type="button"
      role="tab"
      aria-selected={selectedDay === day}
      aria-label="{formatDay(day)}{clashCount > 0 ? `, ${clashCount} clash${clashCount > 1 ? 'es' : ''}` : ''}"
      class="btn flex-shrink-0 min-h-11 min-w-[44px] {selectedDay === day ? 'btn-primary' : 'btn-ghost'}"
      onclick={() => onSelect(day)}
    >
      {formatDay(day)}
      {#if clashCount > 0}
        <span class="badge badge-warning badge-sm ml-1" aria-hidden="true">{clashCount}</span>
      {/if}
    </button>
  {/each}
</div>
