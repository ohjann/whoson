<script lang="ts">
  import type { Act, ActPriority, UserHighlight } from '$lib/types';
  import PriorityPicker from './PriorityPicker.svelte';
  import ClashWarning from '$lib/features/schedule/ClashWarning.svelte';
  import { updateHighlightNotes, updateHighlightPriority } from './operations';

  let {
    act,
    highlight,
    clashingWith = [],
    onclose
  }: {
    act: Act;
    highlight: UserHighlight | undefined;
    clashingWith?: Act[];
    onclose?: () => void;
  } = $props();

  let notes = $state<string>('');
  let priority = $state<ActPriority | undefined>(undefined);

  $effect(() => {
    notes = highlight?.notes ?? '';
    priority = highlight?.priority;
  });

  async function handlePriorityChange(p: ActPriority) {
    if (!act.id || !act.festivalId) return;
    await updateHighlightPriority(act.festivalId, act.id, p);
  }

  async function handleNotesBlur() {
    if (!act.id || !act.festivalId) return;
    await updateHighlightNotes(act.festivalId, act.id, notes);
  }
</script>

<div
  class="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
  role="dialog"
  aria-modal="true"
  aria-label="Act details"
>
  <!-- Backdrop -->
  <button
    type="button"
    class="absolute inset-0"
    aria-label="Close"
    onclick={onclose}
  ></button>

  <!-- Sheet -->
  <div class="relative z-10 w-full max-w-lg rounded-t-2xl bg-base-100 p-6 shadow-xl">
    <div class="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 class="text-xl font-bold">{act.name}</h2>
        <p class="text-sm text-base-content/60">{act.stage}</p>
        <p class="text-sm text-base-content/60">
          {act.startTime.slice(11, 16)} – {act.endTime.slice(11, 16)}
        </p>
      </div>
      <button type="button" class="btn btn-circle btn-ghost btn-sm" onclick={onclose} aria-label="Close">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-5">
          <path
            fill-rule="evenodd"
            d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>

    {#if act.description}
      <p class="mb-4 text-sm">{act.description}</p>
    {/if}

    {#if clashingWith.length > 0}
      <div class="mb-4 space-y-2">
        {#each clashingWith as other (other.id)}
          <ClashWarning actA={act} actB={other} />
        {/each}
      </div>
    {/if}

    {#if highlight}
      <div class="space-y-4">
        <div>
          <p class="mb-1 block text-sm font-medium">Priority</p>
          <PriorityPicker bind:priority onchange={handlePriorityChange} />
        </div>

        <div>
          <label class="mb-1 block text-sm font-medium" for="act-notes">Notes</label>
          <textarea
            id="act-notes"
            class="textarea textarea-bordered w-full"
            rows="3"
            placeholder="Add personal notes..."
            bind:value={notes}
            onblur={handleNotesBlur}
          ></textarea>
        </div>
      </div>
    {/if}
  </div>
</div>
