<script lang="ts">
  import { useLiveQuery } from '$lib/db/live.svelte';
  import { liveQuery } from 'dexie';
  import { db } from '$lib/db';
  import { toggleHighlight } from '$lib/features/highlights/operations';
  import { groupActsByDate, findOverlaps, searchActs } from '$lib/features/schedule/utils';
  import DayTabs from '$lib/features/schedule/DayTabs.svelte';
  import TimeSlot from '$lib/features/schedule/TimeSlot.svelte';
  import ActCard from '$lib/features/schedule/ActCard.svelte';
  import ActDetailSheet from '$lib/features/schedule/ActDetailSheet.svelte';
  import VirtualList from '$lib/components/ui/VirtualList.svelte';
  import type { Act, Festival, UserHighlight } from '$lib/types';

  const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);
  const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), [] as Festival[]);

  const activeFestivalId = $derived(settingsQuery.value?.activeFestivalId ?? null);

  const activeFestival = $derived(
    (festivalsQuery.value ?? []).find((f) => f.id === activeFestivalId) ??
      (festivalsQuery.value ?? [])[0] ??
      null
  );

  // Acts — use $effect to re-subscribe when activeFestivalId changes (useLiveQuery doesn't
  // track Svelte reactive state, so we need explicit re-subscription here)
  let actsValue = $state<Act[]>([]);
  $effect(() => {
    const festId = activeFestivalId; // read here so Svelte tracks this reactive dep
    const sub = liveQuery(
      () =>
        festId != null
          ? db.acts
              .where('[festivalId+startTime]')
              .between([festId, ''], [festId, '\uffff'])
              .toArray()
          : Promise.resolve([] as Act[])
    ).subscribe({
      next: (v) => { actsValue = v as Act[]; },
      error: (err) => console.error('acts liveQuery error:', err)
    });
    return () => sub.unsubscribe();
  });
  const actsQuery = { get value() { return actsValue; } };

  // Highlights — same pattern
  let highlightsValue = $state<UserHighlight[]>([]);
  $effect(() => {
    const festId = activeFestivalId;
    const sub = liveQuery(
      () =>
        festId != null
          ? db.highlights.where('festivalId').equals(festId).toArray()
          : Promise.resolve([] as UserHighlight[])
    ).subscribe({
      next: (v) => { highlightsValue = v as UserHighlight[]; },
      error: (err) => console.error('highlights liveQuery error:', err)
    });
    return () => sub.unsubscribe();
  });
  const highlightsQuery = { get value() { return highlightsValue; } };

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

  type SlotItem = { id: string; type: 'slot'; time: string; height: number };
  type ActItem = {
    id: string;
    type: 'act';
    act: Act;
    highlight: UserHighlight | undefined;
    isClashing: boolean;
    height: number;
  };
  type FlatItem = SlotItem | ActItem;

  // Flatten time slots + acts into a single array for virtual scrolling
  // TimeSlot header: ~40px; ActCard: ~80px (with genre: ~96px)
  const flatItems = $derived.by((): FlatItem[] => {
    const list: FlatItem[] = [];
    for (const slot of sortedTimeSlots) {
      list.push({ id: `slot-${slot}`, type: 'slot', time: slot, height: 40 });
      for (const act of timeSlotGroups.get(slot) ?? []) {
        list.push({
          id: `act-${act.id ?? act.name + slot}`,
          type: 'act',
          act,
          highlight: act.id != null ? highlightMap.get(act.id) : undefined,
          isClashing: currentDayClashes.some(([a, b]) => a.id === act.id || b.id === act.id),
          height: act.genre ? 96 : 80
        });
      }
    }
    return list;
  });

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

  function openSheet(act: Act) {
    selectedAct = act;
  }

  function closeSheet() {
    selectedAct = undefined;
  }
</script>

<div class="flex min-h-screen flex-col">
  <!-- Sticky header: festival name + day tabs -->
  <header class="sticky top-0 z-30 bg-base-100 shadow-sm">
    <div class="px-4 pt-4 pb-2">
      <h1 class="text-xl font-bold" tabindex="-1">
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
    <div class="px-4 py-2" role="search">
      <label class="input input-sm flex items-center gap-2 w-full">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4 text-base-content/50 flex-shrink-0" aria-hidden="true">
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-3" aria-hidden="true">
              <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
            </svg>
          </button>
        {/if}
      </label>
    </div>
  </header>

  <!-- Content -->
  <main class="flex-1 pb-4">
    {#if !activeFestival}
      <div class="flex flex-col items-center justify-center gap-4 py-20 text-center px-4">
        <div class="text-5xl" aria-hidden="true">🎪</div>
        <p class="text-base-content/60 text-sm">No active festival. Set one up in Settings.</p>
        <a href="/settings/" class="btn btn-primary btn-sm" aria-label="Go to Settings to set up a festival">Go to Settings</a>
      </div>

    {:else if sortedDays.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 py-20 text-center px-4">
        <div class="text-5xl" aria-hidden="true">📋</div>
        <p class="text-base-content/60 text-sm">No acts loaded yet. Import the lineup in Settings.</p>
        <a href="/settings/" class="btn btn-outline btn-sm" aria-label="Go to Settings to import lineup">Import lineup</a>
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
          aria-label="Clear search to show all acts"
        >Clear search</button>
      </div>

    {:else}
      <VirtualList
        items={flatItems}
        buffer={5}
        role="feed"
        aria-label="Act schedule"
      >
        {#snippet item(it)}
          {#if (it as FlatItem).type === 'slot'}
            <TimeSlot time={(it as SlotItem).time} />
          {:else}
            {@const actItem = it as ActItem}
            <ActCard
              act={actItem.act}
              highlight={actItem.highlight}
              isClashing={actItem.isClashing}
              onToggle={handleToggle}
              onClick={openSheet}
            />
          {/if}
        {/snippet}
      </VirtualList>
    {/if}
  </main>
</div>

<!-- Act detail sheet -->
{#if selectedAct}
  <ActDetailSheet
    act={selectedAct}
    highlight={selectedAct.id != null ? highlightMap.get(selectedAct.id) : undefined}
    clashingWith={getClashingActsFor(selectedAct)}
    onclose={closeSheet}
  />
{/if}
