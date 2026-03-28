<script lang="ts">
  import type { ActPriority } from '$lib/types';
  import { cn } from '$lib/utils';

  let {
    priority = $bindable<ActPriority | undefined>(undefined),
    onchange
  }: {
    priority?: ActPriority;
    onchange?: (p: ActPriority) => void;
  } = $props();

  function select(p: ActPriority) {
    priority = p;
    onchange?.(p);
  }
</script>

<div class="flex gap-1" role="group" aria-label="Priority">
  <!-- Priority 1: Must see (flame) -->
  <button
    type="button"
    class={cn('btn btn-circle min-h-11 min-w-11', priority === 1 ? 'btn-warning' : 'btn-ghost opacity-50')}
    title="Must see"
    aria-label="Must see"
    aria-pressed={priority === 1}
    onclick={() => select(1)}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
      <path
        fill-rule="evenodd"
        d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z"
        clip-rule="evenodd"
      />
    </svg>
  </button>

  <!-- Priority 2: Nice to see (thumbs up) -->
  <button
    type="button"
    class={cn('btn btn-circle min-h-11 min-w-11', priority === 2 ? 'btn-success' : 'btn-ghost opacity-50')}
    title="Nice to see"
    aria-label="Nice to see"
    aria-pressed={priority === 2}
    onclick={() => select(2)}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
      <path
        d="M7.493 18.5c-.425 0-.82-.236-.975-.632A7.48 7.48 0 0 1 6 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75A.75.75 0 0 1 15 2a2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23h-.777ZM2.331 10.727a11.969 11.969 0 0 0-.831 4.398 12 12 0 0 0 .52 3.507C2.28 19.482 3.105 20 3.994 20H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 0 1-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227Z"
      />
    </svg>
  </button>

  <!-- Priority 3: If nothing else (shrug) -->
  <button
    type="button"
    class={cn('btn btn-circle min-h-11 min-w-11', priority === 3 ? 'btn-info' : 'btn-ghost opacity-50')}
    title="If nothing else"
    aria-label="If nothing else"
    aria-pressed={priority === 3}
    onclick={() => select(3)}
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-4">
      <path
        fill-rule="evenodd"
        d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-2.625 6c-.54 0-.828.419-.936.634a1.96 1.96 0 0 0-.189.866c0 .298.059.605.189.866.108.215.395.634.936.634.54 0 .828-.419.936-.634.13-.26.189-.568.189-.866 0-.298-.059-.605-.189-.866-.108-.215-.395-.634-.936-.634Zm4.314.634c.108-.215.395-.634.936-.634.54 0 .828.419.936.634.13.26.189.568.189.866 0 .298-.059.605-.189.866-.108.215-.395.634-.936.634-.54 0-.828-.419-.936-.634a1.96 1.96 0 0 1-.189-.866c0-.298.059-.605.189-.866Zm-4.34 7.964c.144.074.299.14.461.196a6.013 6.013 0 0 0 3.98 0 3.73 3.73 0 0 0 .461-.196.75.75 0 1 0-.664-1.343 2.25 2.25 0 0 1-.326.137 4.518 4.518 0 0 1-2.924 0 2.25 2.25 0 0 1-.327-.137.75.75 0 0 0-.661 1.343Z"
        clip-rule="evenodd"
      />
    </svg>
  </button>
</div>
