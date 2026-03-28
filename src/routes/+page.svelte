<script lang="ts">
  import { useLiveQuery } from '$lib/db/live.svelte';
  import { db } from '$lib/db';
  import { setActiveFestival } from '$lib/features/festival/operations';
  import FestivalCard from '$lib/features/festival/FestivalCard.svelte';
  import { toggleHighlight } from '$lib/features/highlights/operations';
  import { getPlayingNow, getUpNext, groupActsByDate, findOverlaps } from '$lib/features/schedule/utils';
  import { exportHighlightsAsJson, exportHighlightsAsIcal, copyShareableText } from '$lib/features/export';
  import ActDetailSheet from '$lib/features/highlights/ActDetailSheet.svelte';
  import ClashWarning from '$lib/features/schedule/ClashWarning.svelte';
  import Welcome from '$lib/features/onboarding/Welcome.svelte';
  import type { Act, Festival, UserHighlight } from '$lib/types';

  const ONBOARDING_DISMISSED_KEY = 'whoson_onboarding_dismissed';
  let onboardingDismissed = $state(
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(ONBOARDING_DISMISSED_KEY) === 'true'
      : false
  );

  function dismissOnboarding() {
    onboardingDismissed = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
    }
  }

  // Festival date boundary detection
  function getTodayInTimezone(timezone: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
  }

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

  // Clash detection state
  let showHighlightedOnly = $state(false);
  let sortByPriority = $state(false);
  let selectedAct = $state<Act | undefined>(undefined);
  let selectedDay = $state<string | null>(null);

  // Highlights map for export
  const highlightMap = $derived(
    new Map(
      (highlightsQuery.value ?? []).map((h: UserHighlight) => [`${h.festivalId}:${h.actId}`, h])
    )
  );

  // Festival date boundary
  const festivalStatus = $derived.by((): 'before' | 'during' | 'after' | null => {
    if (!activeFestival) return null;
    const today = getTodayInTimezone(activeFestival.timezone);
    if (today < activeFestival.startDate) return 'before';
    if (today > activeFestival.endDate) return 'after';
    return 'during';
  });

  const daysUntilStart = $derived.by(() => {
    if (!activeFestival || festivalStatus !== 'before') return 0;
    const today = new Date(getTodayInTimezone(activeFestival.timezone));
    const start = new Date(activeFestival.startDate);
    return Math.round((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  });

  const highlightCount = $derived((highlightsQuery.value ?? []).filter(
    (h: UserHighlight) => h.festivalId === activeFestival?.id
  ).length);

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

  // Day grouping and clash detection
  const dayGroups = $derived.by(() => {
    if (!activeFestival) return new Map<string, Act[]>();
    const allActs: Act[] = actsQuery.value ?? [];
    return groupActsByDate(allActs, activeFestival);
  });

  const sortedDays = $derived(Array.from(dayGroups.keys()).sort());

  // Auto-select first day when days load
  $effect(() => {
    if (sortedDays.length > 0 && selectedDay === null) {
      selectedDay = sortedDays[0];
    }
  });

  // Clash pairs per day (only between highlighted acts)
  const clashesPerDay = $derived.by(() => {
    const result = new Map<string, Array<[Act, Act]>>();
    for (const [day, dayActs] of dayGroups) {
      const highlighted = dayActs.filter(
        (a) => a.id != null && highlightMap.has(`${a.festivalId}:${a.id}`)
      );
      result.set(day, findOverlaps(highlighted));
    }
    return result;
  });

  // Clashes for the currently selected day
  const currentDayClashes = $derived(
    selectedDay ? (clashesPerDay.get(selectedDay) ?? []) : []
  );

  // Acts for the selected day (with optional filters)
  const currentDayActs = $derived.by(() => {
    const dayActs = selectedDay ? (dayGroups.get(selectedDay) ?? []) : [];
    let list = dayActs;

    if (showHighlightedOnly) {
      list = list.filter(
        (a) => a.id != null && highlightMap.has(`${a.festivalId}:${a.id}`)
      );
    }

    if (sortByPriority) {
      list = [...list].sort((a, b) => {
        const ha = a.id != null ? highlightMap.get(`${a.festivalId}:${a.id}`) : undefined;
        const hb = b.id != null ? highlightMap.get(`${b.festivalId}:${b.id}`) : undefined;
        const pa = ha?.priority ?? 99;
        const pb = hb?.priority ?? 99;
        return pa - pb;
      });
    }

    return list;
  });

  function getHighlight(act: Act): UserHighlight | undefined {
    if (act.id == null) return undefined;
    return highlightMap.get(`${act.festivalId}:${act.id}`);
  }

  function openSheet(act: Act) {
    selectedAct = act;
  }

  function closeSheet() {
    selectedAct = undefined;
  }

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

  // Acts that clash with a given act in the current day
  function getClashingActsFor(act: Act): Act[] {
    return currentDayClashes.flatMap(([a, b]) => {
      if (a.id === act.id) return [b];
      if (b.id === act.id) return [a];
      return [];
    });
  }

  async function handleToggle(act: Act) {
    if (act.id == null) return;
    await toggleHighlight(act.festivalId, act.id);
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

  function formatDay(isoDate: string): string {
    const [, month, day] = isoDate.split('-').map(Number);
    return new Date(2000, month - 1, day).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }
</script>

<div class="p-4">
  {#if (festivalsQuery.value ?? []).length === 0}
    {#if !onboardingDismissed}
      <Welcome ondismiss={dismissOnboarding} />
    {:else}
      <!-- Post-dismiss empty state -->
      <div class="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-16 text-base-content/20" aria-hidden="true">
          <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
          <path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd" />
        </svg>
        <p class="text-base-content/60 text-sm">No festivals added yet.</p>
        <a href="/festivals/new/" class="btn btn-primary btn-sm">Add Festival</a>
      </div>
    {/if}

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

    {#if festivalStatus === 'before'}
      <!-- Festival hasn't started yet -->
      <div class="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-14 text-primary/60" aria-hidden="true">
          <path fill-rule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="font-semibold">Festival hasn't started yet</p>
          <p class="text-base-content/60 text-sm mt-1">
            Starts in {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'} · {festival.startDate}
          </p>
        </div>
        <a href="/schedule/" class="btn btn-primary btn-sm">Browse Schedule</a>
      </div>

    {:else if festivalStatus === 'after'}
      <!-- Festival is over -->
      <div class="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-14 text-success/60" aria-hidden="true">
          <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
        </svg>
        <div>
          <p class="font-semibold">Festival is over</p>
          {#if highlightCount > 0}
            <p class="text-base-content/60 text-sm mt-1">
              You highlighted {highlightCount} {highlightCount === 1 ? 'act' : 'acts'}
            </p>
          {:else}
            <p class="text-base-content/60 text-sm mt-1">Ended {festival.endDate}</p>
          {/if}
        </div>
        <a href="/schedule/" class="btn btn-primary btn-sm">View Your Highlights</a>
      </div>

    {:else}
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
      <section class="mb-6">
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

      {#if sortedDays.length > 0}
        <!-- Day tabs with clash count badges -->
        <div class="mb-4 flex gap-1 overflow-x-auto">
          {#each sortedDays as day (day)}
            {@const clashCount = clashesPerDay.get(day)?.length ?? 0}
            <button
              type="button"
              class="btn btn-sm flex-shrink-0 {selectedDay === day ? 'btn-primary' : 'btn-ghost'}"
              onclick={() => { selectedDay = day; }}
            >
              {formatDay(day)}
              {#if clashCount > 0}
                <span class="badge badge-warning badge-sm ml-1">{clashCount}</span>
              {/if}
            </button>
          {/each}
        </div>

        <!-- Clash warnings for selected day -->
        {#if currentDayClashes.length > 0}
          <div class="mb-4 space-y-2">
            {#each currentDayClashes as [actA, actB] (`${actA.id}-${actB.id}`)}
              <ClashWarning {actA} {actB} />
            {/each}
          </div>
        {/if}

        <!-- Act list for selected day -->
        {#if currentDayActs.length === 0 && showHighlightedOnly}
          <!-- No highlights empty state -->
          <div class="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-12 text-base-content/20" aria-hidden="true">
              <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
            </svg>
            <p class="text-base-content/60 text-sm">No highlights for this day yet</p>
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onclick={() => { showHighlightedOnly = false; }}
            >
              Show all acts
            </button>
          </div>
        {:else if currentDayActs.length === 0}
          <p class="text-sm text-base-content/50">No acts to show.</p>
        {:else}
          <ul class="space-y-2">
            {#each currentDayActs as act (act.id)}
              {@const highlight = getHighlight(act)}
              <li class="flex items-center gap-3 rounded-lg bg-base-200 p-3">
                <!-- Highlight toggle -->
                <button
                  type="button"
                  class="btn btn-circle btn-sm {highlight ? 'btn-warning' : 'btn-ghost'}"
                  aria-label={highlight ? 'Remove highlight' : 'Highlight'}
                  onclick={() => handleToggle(act)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
                    <path
                      fill-rule="evenodd"
                      d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>

                <!-- Act info -->
                <button
                  type="button"
                  class="flex min-w-0 flex-1 flex-col items-start text-left"
                  onclick={() => openSheet(act)}
                >
                  <span class="truncate font-medium">{act.name}</span>
                  <span class="text-xs text-base-content/60">{act.stage} · {act.startTime.slice(11, 16)}</span>
                </button>

                <!-- Clash indicator -->
                {#if getClashingActsFor(act).length > 0}
                  <span class="badge badge-warning badge-sm" aria-label="Time clash">⚠</span>
                {/if}

                <!-- Priority badge if highlighted -->
                {#if highlight?.priority}
                  <span class="badge badge-sm {highlight.priority === 1 ? 'badge-warning' : highlight.priority === 2 ? 'badge-success' : 'badge-info'}">
                    {highlight.priority === 1 ? '🔥' : highlight.priority === 2 ? '👍' : '🤷'}
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    {/if}

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

<!-- Act detail sheet -->
{#if selectedAct}
  <ActDetailSheet
    act={selectedAct}
    highlight={getHighlight(selectedAct)}
    clashingWith={getClashingActsFor(selectedAct)}
    onclose={closeSheet}
  />
{/if}
