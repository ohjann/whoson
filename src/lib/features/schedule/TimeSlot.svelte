<script lang="ts">
  let { time }: { time: string } = $props();

  const formatted = $derived(
    new Date(2000, 0, 1, parseInt(time.slice(0, 2)), parseInt(time.slice(3, 5)))
      .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  );
</script>

<div class="px-4 pt-4 pb-1">
  <p class="text-xs font-semibold uppercase tracking-wide text-base-content/50">{formatted}</p>
</div>
