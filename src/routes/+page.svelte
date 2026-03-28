<script lang="ts">
  import { useLiveQuery } from '$lib/db/live.svelte';
  import { db } from '$lib/db';
  import { setActiveFestival } from '$lib/features/festival/operations';
  import FestivalCard from '$lib/features/festival/FestivalCard.svelte';
  import { getPlayingNow, getUpNext } from '$lib/features/schedule/utils';
  import type { Festival, Act } from '$lib/types';

  const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), [] as Festival[]);
  const settingsQuery = useLiveQuery(() => db.settings.toCollection().first(), undefined);

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
    <h1 class="mb-4 text-2xl font-bold">{festival.name}</h1>

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
