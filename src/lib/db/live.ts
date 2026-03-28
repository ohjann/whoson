import { liveQuery } from 'dexie';

/**
 * Bridge pattern: Dexie liveQuery Observable → Svelte 5 $state
 *
 * Subscribes to a liveQuery Observable in $effect, writes results to a $state
 * variable, and cleans up on destroy. Use this in Svelte components/runes context.
 *
 * Usage:
 *   const acts = useLiveQuery(() => db.acts.where({ festivalId }).toArray(), []);
 *   // Access value: acts.value
 */
export function useLiveQuery<T>(querier: () => Promise<T>, initialValue: T) {
  let result = $state(initialValue);

  $effect(() => {
    const subscription = liveQuery(querier).subscribe({
      next: (value) => {
        result = value;
      },
      error: (err) => console.error('liveQuery error:', err)
    });
    return () => subscription.unsubscribe();
  });

  return {
    get value() {
      return result;
    }
  };
}
