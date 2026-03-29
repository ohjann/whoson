<script lang="ts">
  import type { Act, ActPriority, UserHighlight } from '$lib/types';
  import PriorityPicker from '$lib/features/highlights/PriorityPicker.svelte';
  import ClashWarning from './ClashWarning.svelte';
  import { toggleHighlight, updateHighlightPriority, updateHighlightNotes } from '$lib/features/highlights/operations';
  import { toggleHidden } from '$lib/features/schedule/hidden';
  import {
    scheduleActNotification,
    cancelActNotification,
    checkPermission,
    DEFAULT_NOTIFY_MINUTES_BEFORE
  } from '$lib/features/notifications/local';
  import { db } from '$lib/db';

  let {
    act,
    highlight,
    isHidden = false,
    clashingWith = [],
    onclose
  }: {
    act: Act;
    highlight: UserHighlight | undefined;
    isHidden?: boolean;
    clashingWith?: Act[];
    onclose?: () => void;
  } = $props();

  const isHighlighted = $derived(highlight !== undefined);

  let notes = $state('');
  let priority = $state<ActPriority | undefined>(undefined);
  let notifyEnabled = $state(false);
  let notifyMinutes = $state(DEFAULT_NOTIFY_MINUTES_BEFORE);

  $effect(() => {
    notes = highlight?.notes ?? '';
    priority = highlight?.priority;
    notifyEnabled = highlight?.notifyMinutesBefore != null;
    notifyMinutes = highlight?.notifyMinutesBefore ?? DEFAULT_NOTIFY_MINUTES_BEFORE;
  });

  const leadTimeOptions = [0, 5, 10, 15, 30, 60];

  async function handleHighlightToggle() {
    if (act.id == null) return;
    await toggleHighlight(act.festivalId, act.id);
  }

  async function handleHideToggle() {
    if (act.id == null) return;
    await toggleHidden(act.festivalId, act.id);
    if (!isHidden) onclose?.();
  }

  async function handlePriorityChange(p: ActPriority) {
    if (!act.id || !act.festivalId) return;
    await updateHighlightPriority(act.festivalId, act.id, p);
  }

  async function handleNotesBlur() {
    if (!act.id || !act.festivalId) return;
    await updateHighlightNotes(act.festivalId, act.id, notes);
  }

  async function handleNotifyToggle() {
    if (!highlight?.id) return;

    if (notifyEnabled) {
      // Turn off
      await cancelActNotification(highlight);
      notifyEnabled = false;
    } else {
      // Turn on — request permission first
      const granted = await checkPermission();
      if (!granted) return;
      const freshHighlight = await db.highlights.get(highlight.id);
      if (freshHighlight) {
        await scheduleActNotification(freshHighlight, act, notifyMinutes);
        notifyEnabled = true;
      }
    }
  }

  async function handleLeadTimeChange(mins: number) {
    if (!highlight?.id) return;
    notifyMinutes = mins;
    if (notifyEnabled) {
      // Reschedule with new lead time
      await cancelActNotification(highlight);
      const freshHighlight = await db.highlights.get(highlight.id);
      if (freshHighlight) {
        await scheduleActNotification(freshHighlight, act, mins);
      }
    }
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
  <div class="relative z-10 w-full max-w-lg overflow-y-auto rounded-t-2xl bg-base-100 shadow-xl"
    style="max-height: 90dvh;"
  >
    <!-- Drag handle -->
    <div class="flex justify-center pt-3 pb-1">
      <div class="h-1 w-10 rounded-full bg-base-content/20"></div>
    </div>

    <div class="p-5">
      <!-- Header -->
      <div class="mb-4 flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <h2 class="text-xl font-bold">{act.name}</h2>
          <p class="text-sm text-base-content/60">{act.stage}</p>
          <p class="text-sm text-base-content/60">
            {act.startTime.slice(11, 16)} – {act.endTime.slice(11, 16)}
          </p>
          {#if act.genre}
            <div class="mt-2 flex flex-wrap gap-1">
              <span class="badge badge-outline badge-sm">{act.genre}</span>
            </div>
          {/if}
        </div>
        <button
          type="button"
          class="btn btn-circle btn-ghost btn-sm flex-shrink-0"
          onclick={onclose}
          aria-label="Close"
        >
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
        <p class="mb-4 text-sm text-base-content/80">{act.description}</p>
      {/if}

      {#if act.imageUrl}
        <a
          href={act.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          class="link link-primary mb-4 flex items-center gap-1 text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          More info
        </a>
      {/if}

      <!-- Clash warnings -->
      {#if clashingWith.length > 0}
        <div class="mb-4 space-y-2">
          {#each clashingWith as other (other.id)}
            <ClashWarning actA={act} actB={other} />
          {/each}
        </div>
      {/if}

      <!-- Highlight toggle -->
      <div class="mb-4">
        <button
          type="button"
          class="btn btn-sm w-full min-h-11 {isHighlighted ? 'btn-warning' : 'btn-outline'}"
          aria-label={isHighlighted ? `Remove highlight for ${act.name}` : `Highlight ${act.name}`}
          aria-pressed={isHighlighted}
          onclick={handleHighlightToggle}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
            <path
              fill-rule="evenodd"
              d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z"
              clip-rule="evenodd"
            />
          </svg>
          {isHighlighted ? 'Highlighted' : 'Highlight'}
        </button>
      </div>

      {#if isHighlighted}
        <div class="space-y-4">
          <!-- Priority -->
          <div>
            <p class="mb-1 text-sm font-medium">Priority</p>
            <PriorityPicker bind:priority onchange={handlePriorityChange} />
          </div>

          <!-- Notes -->
          <div>
            <label class="mb-1 block text-sm font-medium" for="sheet-act-notes">Notes</label>
            <textarea
              id="sheet-act-notes"
              class="textarea w-full"
              rows="3"
              placeholder="Add personal notes..."
              bind:value={notes}
              onblur={handleNotesBlur}
            ></textarea>
          </div>

          <!-- Notification toggle -->
          <div class="rounded-lg bg-base-200 p-3">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4 text-base-content/60">
                  <path fill-rule="evenodd" d="M5.25 9a6.75 6.75 0 0 1 13.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 0 1-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 1 1-7.48 0 24.585 24.585 0 0 1-4.831-1.244.75.75 0 0 1-.298-1.205A8.217 8.217 0 0 0 5.25 9.75V9Zm4.502 8.9a2.25 2.25 0 1 0 4.496 0 25.057 25.057 0 0 1-4.496 0Z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-medium">Notify me</span>
              </div>
              <input
                type="checkbox"
                class="toggle toggle-sm toggle-primary"
                checked={notifyEnabled}
                onchange={handleNotifyToggle}
                aria-label="Enable notification"
              />
            </div>

            {#if notifyEnabled}
              <div class="mt-3">
                <p class="mb-2 text-xs text-base-content/60">How early?</p>
                <div class="flex flex-wrap gap-1">
                  {#each leadTimeOptions as mins}
                    <button
                      type="button"
                      class="btn btn-xs min-h-11 {notifyMinutes === mins ? 'btn-primary' : 'btn-ghost'}"
                      aria-label="{mins === 0 ? 'Notify at start' : `Notify ${mins} minutes before`}"
                      aria-pressed={notifyMinutes === mins}
                      onclick={() => handleLeadTimeChange(mins)}
                    >
                      {mins === 0 ? 'At start' : `${mins}m`}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <!-- Hide/unhide -->
      <div class="mt-4 border-t border-base-content/10 pt-4">
        <button
          type="button"
          class="btn btn-sm w-full min-h-11 {isHidden ? 'btn-outline' : 'btn-ghost text-base-content/50'}"
          aria-label={isHidden ? `Show ${act.name} in schedule` : `Hide ${act.name} from schedule`}
          onclick={handleHideToggle}
        >
          {#if isHidden}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path fill-rule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 0 1 0-1.113ZM17.25 12a5.25 5.25 0 1 1-10.5 0 5.25 5.25 0 0 1 10.5 0Z" clip-rule="evenodd" />
            </svg>
            Show in schedule
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
              <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM22.676 12.553a11.249 11.249 0 0 1-2.631 4.31l-3.099-3.099a5.25 5.25 0 0 0-6.71-6.71L7.759 4.577a11.217 11.217 0 0 1 4.242-.827c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113Z" />
              <path d="M15.75 12c0 .18-.013.357-.037.53l-4.244-4.243A3.75 3.75 0 0 1 15.75 12ZM12.53 15.713l-4.243-4.244a3.75 3.75 0 0 0 4.244 4.243Z" />
              <path d="M6.75 12c0-.619.107-1.213.304-1.764l-3.1-3.1a11.25 11.25 0 0 0-2.63 4.31c-.12.362-.12.752 0 1.114 1.489 4.467 5.704 7.69 10.675 7.69 1.5 0 2.933-.294 4.242-.827l-2.477-2.477A5.25 5.25 0 0 1 6.75 12Z" />
            </svg>
            Hide from schedule
          {/if}
        </button>
      </div>
    </div>

    <!-- Safe area bottom padding -->
    <div style="padding-bottom: env(safe-area-inset-bottom, 16px);"></div>
  </div>
</div>
