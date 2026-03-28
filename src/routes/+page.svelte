<script lang="ts">
  import { useLiveQuery } from '$lib/db/live.svelte';
  import { db } from '$lib/db';
  import { setActiveFestival } from '$lib/features/festival/operations';
  import FestivalCard from '$lib/features/festival/FestivalCard.svelte';
  import { getPlayingNow, getUpNext } from '$lib/features/schedule/utils';
  import { exportHighlightsAsJson, exportHighlightsAsIcal, copyShareableText } from '$lib/features/export';
  import type { Festival, Act, UserHighlight } from '$lib/types';

  const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), [] as Festival[]);
  const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);
  const highlightsQuery = useLiveQuery(() => db.highlights.toArray(), []);

  const activeFestivalId = $derived(settingsQuery.value?.activeFestivalId ?? null);

  // Active festival object
  const activeFestival = $derived(
    (festivalsQuery.value ?? []).find((f) => f.id === activeFestivalId) ??
      (festivalsQuery.value ?? [])[0] ??
      null
  );

  // Acts for the active festival (indexed query, reactive on activeFestival.id)
  const actsQuery = useLiveQuery(
    () =>
      activeFestival?.id != null
        ? db.acts.where('festivalId').equals(activeFestival.id).toArray()
        : Promise.resolve([] as Act[]),
    [] as Act[]
  );

  // Act counts per festival for cards (queries Dexie directly so liveQuery tracks changes)
  const actCountsQuery = useLiveQuery(async () => {
    const festivals = await db.festivals.toArray();
    const counts: Record<number, number> = {};
    for (const f of festivals) {
      if (f.id != null) {
        counts[f.id] = await db.acts.where('festivalId').equals(f.id).count();
      }
    }
    return counts;
  }, {} as Record<number, number>);

  // Highlights map for export
  const highlightMap = $derived(
    new Map(
      (highlightsQuery.value ?? []).map((h: UserHighlight) => [`${h.festivalId}:${h.actId}`, h])
    )
  );

  // Now/Next
  const now = $derived(new Date());
  const playingNow = $derived(
    activeFestival
      ? getPlayingNow(actsQuery.value ?? [], now, activeFestival)
      : []
  );
  const upNext = $derived(
    activeFestival
      ? getUpNext(actsQuery.value ?? [], now, 60, activeFestival)
      : []
  );

  async function handleActivate(festivalId: number) {
    await setActiveFestival(festivalId);
  }

  // Export / share
  let exportMenuOpen = $state(false);

  const highlightedActs = $derived((actsQuery.value ?? []).filter(
    (a: Act) => a.id != null && highlightMap.has(`${a.festivalId}:${a.id}`)
  ));
  const highlightsForExport = $derived(
    (highlightsQuery.value ?? []).filter((h: UserHighlight) =>
      highlightedActs.some((a: Act) => a.id === h.actId)
    )
  );

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportJson() {
    if (!activeFestival) return;
    const json = exportHighlightsAsJson(activeFestival, highlightsForExport, highlightedActs);
    downloadFile(json, 'highlights.json', 'application/json');
    exportMenuOpen = false;
  }

  function handleExportIcal() {
    if (!activeFestival) return;
    const ical = exportHighlightsAsIcal(activeFestival, highlightsForExport, highlightedActs);
    downloadFile(ical, 'highlights.ics', 'text/calendar');
    exportMenuOpen = false;
  }

  async function handleCopyText() {
    if (!activeFestival) return;
    await copyShareableText(activeFestival, highlightsForExport, highlightedActs);
    exportMenuOpen = false;
  }
</script>

<div class="p-4">
  {#if (festivalsQuery.value ?? []).length === 0}
    <!-- Empty state -->
    <div class="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div class="text-6xl">🎪</div>
      <h1 class="text-2xl font-bold">Welcome to Who's On</h1>
      <p class="text-base-content/60 max-w-xs text-sm">
        Add your first festival to start tracking acts and highlights.
      </p>
      <a href="/settings/" class="btn btn-primary">Add Festival</a>
    </div>

  {:else if (festivalsQuery.value ?? []).length === 1}
    <!-- Single festival: Now/Next summary -->
    {@const festival = (festivalsQuery.value ?? [])[0]}
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-bold">{festival.name}</h1>

      <!-- Export / share menu -->
      {#if activeFestival && highlightsForExport.length > 0}
        <div class="relative">
          <button
            type="button"
            class="btn btn-ghost btn-sm gap-1"
            aria-label="Export schedule"
            onclick={() => exportMenuOpen = !exportMenuOpen}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Share
          </button>

          {#if exportMenuOpen}
            <div class="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg bg-base-200 shadow-lg">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-t-lg px-4 py-2 text-sm hover:bg-base-300"
                onclick={handleExportJson}
              >Export as JSON</button>
              <button
                type="button"
                class="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-base-300"
                onclick={handleExportIcal}
              >Export as iCal (.ics)</button>
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-b-lg px-4 py-2 text-sm hover:bg-base-300"
                onclick={handleCopyText}
              >Copy as text</button>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Now Playing -->
    <section class="mb-6">
      <h2 class="text-base-content/60 mb-2 text-xs font-semibold uppercase tracking-wide">
        Now Playing
      </h2>
      {#if playingNow.length === 0}
        <p class="text-base-content/40 text-sm">Nothing playing right now.</p>
      {:else}
        <ul class="space-y-2">
          {#each playingNow as act (act.id)}
            <li class="rounded-lg bg-base-200 p-3">
              <p class="font-medium">{act.name}</p>
              <p class="text-base-content/60 text-xs">{act.stage} · until {act.endTime.slice(11, 16)}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Up Next -->
    <section>
      <h2 class="text-base-content/60 mb-2 text-xs font-semibold uppercase tracking-wide">
        Up Next (next 60 min)
      </h2>
      {#if upNext.length === 0}
        <p class="text-base-content/40 text-sm">Nothing coming up in the next hour.</p>
      {:else}
        <ul class="space-y-2">
          {#each upNext as act (act.id)}
            <li class="rounded-lg bg-base-200 p-3">
              <p class="font-medium">{act.name}</p>
              <p class="text-base-content/60 text-xs">{act.stage} · {act.startTime.slice(11, 16)}</p>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

  {:else}
    <!-- Multiple festivals: festival cards -->
    <h1 class="mb-4 text-2xl font-bold">Your Festivals</h1>
    <div class="space-y-3">
      {#each (festivalsQuery.value ?? []) as festival (festival.id)}
        <FestivalCard
          {festival}
          actCount={(actCountsQuery.value ?? {})[festival.id ?? 0] ?? 0}
          isActive={festival.id === activeFestivalId}
          onActivate={festival.id != null ? () => handleActivate(festival.id!) : undefined}
        />
      {/each}
    </div>
    <div class="mt-4">
      <a href="/settings/" class="btn btn-outline btn-sm w-full">Add Festival</a>
    </div>
  {/if}
</div>
