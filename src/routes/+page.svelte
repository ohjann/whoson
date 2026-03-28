<script lang="ts">
  import { useLiveQuery } from '$lib/db/live';
  import { db } from '$lib/db';
  import { toggleHighlight } from '$lib/features/highlights/operations';
  import ActDetailSheet from '$lib/features/highlights/ActDetailSheet.svelte';
  import type { Act, UserHighlight } from '$lib/types';

  // Active festival — in full app this would come from settings/store;
  // here we use the first festival for demonstration.
  const festivalsQuery = useLiveQuery(() => db.festivals.toArray(), []);
  const actsQuery = useLiveQuery(() => db.acts.toArray(), []);
  const highlightsQuery = useLiveQuery(() => db.highlights.toArray(), []);

  let showHighlightedOnly = $state(false);
  let sortByPriority = $state(false);
  let selectedAct = $state<Act | undefined>(undefined);

  const highlightMap = $derived(
    new Map(
      (highlightsQuery.value ?? []).map((h: UserHighlight) => [`${h.festivalId}:${h.actId}`, h])
    )
  );

  const acts = $derived.by(() => {
    let list: Act[] = actsQuery.value ?? [];

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

<div class="p-4">
  <h1 class="mb-4 text-2xl font-bold">Who's On</h1>

  <!-- Filter / sort controls -->
  <div class="mb-4 flex flex-wrap gap-3">
    <label class="flex cursor-pointer items-center gap-2">
      <input type="checkbox" class="toggle toggle-sm" bind:checked={showHighlightedOnly} />
      <span class="text-sm">Highlighted only</span>
    </label>
    <label class="flex cursor-pointer items-center gap-2">
      <input type="checkbox" class="toggle toggle-sm" bind:checked={sortByPriority} />
      <span class="text-sm">Sort by priority</span>
    </label>
  </div>

  <!-- Act list -->
  {#if acts.length === 0}
    <p class="text-base-content/50 text-sm">No acts to show.</p>
  {:else}
    <ul class="space-y-2">
      {#each acts as act (act.id)}
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
</div>

<!-- Act detail sheet -->
{#if selectedAct}
  <ActDetailSheet
    act={selectedAct}
    highlight={getHighlight(selectedAct)}
    onclose={closeSheet}
  />
{/if}
