<script lang="ts">
  import { useLiveQuery } from '$lib/db/live.svelte';
  import { db } from '$lib/db';
  import { getPlayingNow, getUpNext } from '$lib/features/schedule/utils';
  import { exportHighlightsAsIcal, copyShareableText } from '$lib/features/export';
  import Welcome from '$lib/features/onboarding/Welcome.svelte';
  import ActDetailSheet from '$lib/features/schedule/ActDetailSheet.svelte';
  import { getNow } from '$lib/debug/time.svelte';
  import type { Act, Festival, HiddenAct, UserHighlight } from '$lib/types';

  let selectedAct = $state<Act | undefined>(undefined);

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
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(getNow());
  }

  const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), [] as Festival[]);
  const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);
  const highlightsQuery = useLiveQuery(() => db.highlights.toArray(), []);
  const hiddenActsQuery = useLiveQuery(() => db.hiddenActs.toArray(), [] as HiddenAct[]);

  const activeFestivalId = $derived(settingsQuery.value?.activeFestivalId ?? null);

  // Active festival object
  const activeFestival = $derived(
    (festivalsQuery.value ?? []).find((f) => f.id === activeFestivalId) ??
      (festivalsQuery.value ?? [])[0] ??
      null
  );

  // Load all acts and filter reactively (querier must not depend on reactive vars)
  const allActsQuery = useLiveQuery(() => db.acts.toArray(), [] as Act[]);
  const hiddenActIds = $derived(
    new Set((hiddenActsQuery.value ?? []).map((h: HiddenAct) => h.actId))
  );
  const actsQuery = $derived({
    value: (allActsQuery.value ?? []).filter(
      (a: Act) => a.festivalId === activeFestival?.id && (a.id == null || !hiddenActIds.has(a.id))
    )
  });

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

  const highlightMap = $derived(
    new Map(
      (highlightsQuery.value ?? []).map((h: UserHighlight) => [`${h.festivalId}:${h.actId}`, h])
    )
  );

  function isHighlighted(act: Act): boolean {
    return act.id != null && highlightMap.has(`${act.festivalId}:${act.id}`);
  }

  // Now/Next
  const now = $derived(getNow());
  const playingNow = $derived(
    activeFestival
      ? getPlayingNow(actsQuery.value ?? [], now, activeFestival)
          .toSorted((a, b) => Number(isHighlighted(b)) - Number(isHighlighted(a)))
      : []
  );
  const upNext = $derived(
    activeFestival
      ? getUpNext(actsQuery.value ?? [], now, 60, activeFestival)
          .toSorted((a, b) => {
            if (a.startTime !== b.startTime) return 0;
            return Number(isHighlighted(b)) - Number(isHighlighted(a));
          })
      : []
  );

  /** Progress through the set as 0-100 */
  function setProgress(act: Act): number {
    const [sd, st] = act.startTime.split('T');
    const [sy, sm, sdy] = sd.split('-').map(Number);
    const [sh, smin] = st.split(':').map(Number);
    const start = new Date(sy, sm - 1, sdy, sh, smin).getTime();

    const [ed, et] = act.endTime.split('T');
    const [ey, em, edy] = ed.split('-').map(Number);
    const [eh, emin] = et.split(':').map(Number);
    const end = new Date(ey, em - 1, edy, eh, emin).getTime();

    const total = end - start;
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, ((now.getTime() - start) / total) * 100));
  }

  /** Minutes remaining in set */
  function minutesLeft(act: Act): number {
    const [ed, et] = act.endTime.split('T');
    const [ey, em, edy] = ed.split('-').map(Number);
    const [eh, emin] = et.split(':').map(Number);
    const end = new Date(ey, em - 1, edy, eh, emin).getTime();
    return Math.max(0, Math.round((end - now.getTime()) / 60_000));
  }

  /** Minutes until act starts */
  function minutesUntil(act: Act): number {
    const [sd, st] = act.startTime.split('T');
    const [sy, sm, sdy] = sd.split('-').map(Number);
    const [sh, smin] = st.split(':').map(Number);
    const start = new Date(sy, sm - 1, sdy, sh, smin).getTime();
    return Math.max(0, Math.round((start - now.getTime()) / 60_000));
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

  {:else}
    <!-- Active festival: Now/Next summary -->
    {@const festival = activeFestival}
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
            <button
              type="button"
              class="fixed inset-0 z-40"
              aria-label="Close menu"
              onclick={() => exportMenuOpen = false}
            ></button>
            <div class="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg bg-base-200 shadow-lg">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded-t-lg px-4 py-2 text-sm hover:bg-base-300"
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
      {#if playingNow.length === 0}
        <!-- Nothing on right now -->
        <div class="flex flex-col items-center gap-3 py-16 text-center">
          <div class="text-base-content/10 text-6xl">~</div>
          <p class="text-base-content/40 text-sm">Nothing on right now</p>
          {#if upNext.length > 0}
            <p class="text-base-content/30 text-xs">Next up in {minutesUntil(upNext[0])}m</p>
          {/if}
        </div>
      {:else}
        <!-- ON NOW — the hero -->
        <div class="space-y-3">
          {#each playingNow as act, i (act.id)}
            {@const progress = setProgress(act)}
            {@const remaining = minutesLeft(act)}
            <button
              type="button"
              class="relative w-full cursor-pointer overflow-hidden rounded-2xl border border-base-content/5 p-4 text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
              style="background: linear-gradient(135deg, color-mix(in oklch, var(--color-primary) {Math.max(8, 20 - i * 4)}%, var(--color-base-200)), var(--color-base-200));"
              onclick={() => { selectedAct = act; }}
            >
              <!-- Stage pill -->
              <div class="mb-2 flex items-center justify-between">
                <span class="text-xs font-semibold uppercase tracking-widest text-primary">{act.stage}</span>
                <span class="text-xs tabular-nums text-base-content/50">{remaining}m left</span>
              </div>

              <!-- Act name — big and unmissable -->
              <h2 class="flex items-center gap-1.5 text-xl font-bold leading-tight tracking-tight">
                {act.name}
                {#if isHighlighted(act)}
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 text-warning shrink-0">
                    <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
                  </svg>
                {/if}
              </h2>

              <!-- Time range -->
              <p class="mt-1 text-sm text-base-content/50 tabular-nums">
                {act.startTime.slice(11, 16)} – {act.endTime.slice(11, 16)}
              </p>

              <!-- Progress bar -->
              <div class="mt-3 h-1 w-full overflow-hidden rounded-full bg-base-content/10">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
                  style="width: {progress}%"
                ></div>
              </div>
            </button>
          {/each}
        </div>
      {/if}

      <!-- Up Next -->
      {#if upNext.length === 0 && playingNow.length > 0}
        <p class="mt-6 text-center text-sm text-base-content/30">Nothing coming up in the next hour</p>
      {/if}
      {#if upNext.length > 0}
        <section class="mt-8">
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-base-content/40">Up Next</h2>
          <div class="space-y-1">
            {#each upNext as act (act.id)}
              {@const mins = minutesUntil(act)}
              <button
                type="button"
                class="flex w-full items-baseline gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-base-200/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-base-100"
                onclick={() => { selectedAct = act; }}
              >
                <span class="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-primary">{mins}m</span>
                <div class="min-w-0 flex-1">
                  <p class="flex items-center gap-1 truncate font-medium">
                    {act.name}
                    {#if isHighlighted(act)}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3 text-warning shrink-0">
                        <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
                      </svg>
                    {/if}
                  </p>
                  <p class="text-xs text-base-content/40">{act.stage} · {act.startTime.slice(11, 16)}</p>
                </div>
              </button>
            {/each}
          </div>
        </section>
      {/if}
    {/if}

  {/if}
</div>

{#if selectedAct}
  <ActDetailSheet
    act={selectedAct}
    highlight={selectedAct.id != null ? highlightMap.get(`${selectedAct.festivalId}:${selectedAct.id}`) : undefined}
    onclose={() => { selectedAct = undefined; }}
  />
{/if}
