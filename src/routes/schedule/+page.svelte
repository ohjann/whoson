<script lang="ts">
  import { useLiveQuery } from '$lib/db/live.svelte';
  import { db } from '$lib/db';
  import { toggleHighlight } from '$lib/features/highlights/operations';
  import { groupActsByDate, findOverlaps, searchActs } from '$lib/features/schedule/utils';
  import DayTabs from '$lib/features/schedule/DayTabs.svelte';
  import TimeSlot from '$lib/features/schedule/TimeSlot.svelte';
  import ActCard from '$lib/features/schedule/ActCard.svelte';
  import ActDetailSheet from '$lib/features/schedule/ActDetailSheet.svelte';
  import type { Act, Festival, UserHighlight } from '$lib/types';

  const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);
  const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), [] as Festival[]);

  const activeFestivalId = $derived(settingsQuery.value?.activeFestivalId ?? null);

  const activeFestival = $derived(
    (festivalsQuery.value ?? []).find((f) => f.id === activeFestivalId) ??
      (festivalsQuery.value ?? [])[0] ??
      null
  );

  // Acts for the active festival, ordered by startTime via compound index
  const actsQuery = useLiveQuery(
    () =>
      activeFestival?.id != null
        ? db.acts
            .where('[festivalId+startTime]')
            .between([activeFestival.id, ''], [activeFestival.id, '\uffff'])
            .toArray()
        : Promise.resolve([] as Act[]),
    [] as Act[]
  );

  const highlightsQuery = useLiveQuery(
    () =>
      activeFestival?.id != null
        ? db.highlights.where('festivalId').equals(activeFestival.id).toArray()
        : Promise.resolve([] as UserHighlight[]),
    [] as UserHighlight[]
  );

  let selectedDay = $state<string | null>(null);
  let searchQuery = $state('');
  let selectedAct = $state<Act | undefined>(undefined);

  // Highlight map for O(1) lookup
  const highlightMap = $derived(
    new Map(
      (highlightsQuery.value ?? []).map((h: UserHighlight) => [h.actId, h])
    )
  );

  // Day groups for ALL acts (no search filter — used for tabs + clash detection)
  const dayGroups = $derived.by(() => {
    if (!activeFestival) return new Map<string, Act[]>();
    return groupActsByDate(actsQuery.value ?? [], activeFestival);
  });

  const sortedDays = $derived(Array.from(dayGroups.keys()).sort());

  // Auto-select first day when days load
  $effect(() => {
    if (sortedDays.length > 0 && selectedDay === null) {
      selectedDay = sortedDays[0];
    }
  });

  // Clash pairs per day (highlighted acts only)
  const clashesPerDay = $derived.by(() => {
    const result = new Map<string, Array<[Act, Act]>>();
    for (const [day, dayActs] of dayGroups) {
      const highlighted = dayActs.filter((a) => a.id != null && highlightMap.has(a.id));
      result.set(day, findOverlaps(highlighted));
    }
    return result;
  });

  // Clash count badges for day tabs
  const clashCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const [day, clashes] of clashesPerDay) {
      if (clashes.length > 0) counts.set(day, clashes.length);
    }
    return counts;
  });

  // Clashes for the selected day
  const currentDayClashes = $derived(
    selectedDay ? (clashesPerDay.get(selectedDay) ?? []) : []
  );

  // Acts for the selected day, filtered by search
  const currentDayActs = $derived.by(() => {
    const dayActs = selectedDay ? (dayGroups.get(selectedDay) ?? []) : [];
    return searchQuery.trim() ? searchActs(dayActs, searchQuery) : dayActs;
  });

  // Group current day acts by time slot (HH:MM of startTime)
  const timeSlotGroups = $derived.by(() => {
    const groups = new Map<string, Act[]>();
    for (const act of currentDayActs) {
      const slot = act.startTime.slice(11, 16); // "HH:MM"
      if (!groups.has(slot)) groups.set(slot, []);
      groups.get(slot)!.push(act);
    }
    return groups;
  });

  const sortedTimeSlots = $derived(Array.from(timeSlotGroups.keys()).sort());

  function getHighlight(act: Act): UserHighlight | undefined {
    if (act.id == null) return undefined;
    return highlightMap.get(act.id);
  }

  function getClashingActsFor(act: Act): Act[] {
    return currentDayClashes.flatMap(([a, b]) => {
      if (a.id === act.id) return [b];
      if (b.id === act.id) return [a];
      return [];
    });
  }

  function isClashing(act: Act): boolean {
    return currentDayClashes.some(([a, b]) => a.id === act.id || b.id === act.id);
  }

  async function handleToggle(act: Act) {
    if (act.id == null) return;
    await toggleHighlight(act.festivalId, act.id);
  }

  function openSheet(act: Act) {
    selectedAct = act;
  }

  function closeSheet() {
    selectedAct = undefined;
  }
</script>

<div class="flex min-h-screen flex-col">
  <!-- Sticky header: festival name + day tabs -->
  <div class="sticky top-0 z-30 bg-base-100 shadow-sm">
    <div class="px-4 pt-4 pb-2">
      <h1 class="text-xl font-bold">
        {activeFestival?.name ?? 'Schedule'}
      </h1>
    </div>

    {#if sortedDays.length > 0}
      <DayTabs
        days={sortedDays}
        {selectedDay}
        {clashCounts}
        onSelect={(day) => { selectedDay = day; }}
      />
    {/if}

    <!-- Sticky search bar -->
    <div class="px-4 py-2">
      <label class="input input-bordered input-sm flex items-center gap-2 w-full">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 text-base-content/50 flex-shrink-0">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="search"
          class="grow bg-transparent outline-none"
          placeholder="Search acts..."
          bind:value={searchQuery}
          aria-label="Search acts"
        />
        {#if searchQuery}
          <button
            type="button"
            class="btn btn-ghost btn-xs btn-circle"
            onclick={() => { searchQuery = ''; }}
            aria-label="Clear search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3">
              <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
          </button>
        {/if}
      </label>
    </div>
  </div>

  <!-- Content -->
  <div class="pb-4">
    {#if !activeFestival}
      <div class="flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
        <div class="text-5xl">🎪</div>
        <p class="text-base-content/60 text-sm">No active festival. Set one up in Settings.</p>
        <a href="/settings/" class="btn btn-primary btn-sm">Go to Settings</a>
      </div>

    {:else if sortedDays.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 py-20 text-center px-4">
        <div class="text-5xl">📋</div>
        <p class="text-base-content/60 text-sm">No acts loaded yet. Import the lineup in Settings.</p>
        <a href="/settings/" class="btn btn-outline btn-sm">Import lineup</a>
      </div>

    {:else if currentDayActs.length === 0 && searchQuery}
      <div class="flex flex-col items-center justify-center gap-3 py-12 text-center px-4">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="size-12 text-base-content/20" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <p class="text-base-content/50 text-sm">No acts match "{searchQuery}"</p>
        <button
          type="button"
          class="btn btn-outline btn-sm"
          onclick={() => { searchQuery = ''; }}
        >
          Clear search
        </button>
      </div>

    {:else}
      {#each sortedTimeSlots as slot (slot)}
        <TimeSlot time={slot} />
        {#each (timeSlotGroups.get(slot) ?? []) as act (act.id)}
          <ActCard
            {act}
            highlight={getHighlight(act)}
            isClashing={isClashing(act)}
            onToggle={handleToggle}
            onClick={openSheet}
          />
        {/each}
      {/each}
    {/if}
  </div>
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
