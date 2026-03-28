<script lang="ts">
	import { subscribeToTopic, unsubscribe, sendTestNotification } from '$lib/features/notifications/ntfy.js';
	import { addToast } from '$lib/features/notifications/toasts.svelte.js';

	let ntfyTopic = $state(localStorage.getItem('ntfyTopic') ?? '');
	let subscribed = $state(false);
	let testLoading = $state(false);

	function handleSubscribe() {
		const topic = ntfyTopic.trim();
		if (!topic) return;
		localStorage.setItem('ntfyTopic', topic);
		subscribeToTopic(topic);
		subscribed = true;
	}

	function handleUnsubscribe() {
		unsubscribe();
		subscribed = false;
	}

	async function handleTestNotification() {
		const topic = ntfyTopic.trim();
		if (!topic) {
			addToast({ title: 'No topic', message: 'Enter a ntfy.sh topic first.' });
			return;
		}
		testLoading = true;
		try {
			await sendTestNotification(topic);
			addToast({ title: 'Test sent', message: `Sent to ntfy.sh/${topic}` });
		} catch {
			addToast({ title: 'Failed', message: 'Could not send test notification.' });
		} finally {
			testLoading = false;
		}
	}
</script>

<div class="container mx-auto max-w-lg p-6">
	<h1 class="text-2xl font-bold mb-6">Settings</h1>

	<section class="card bg-base-200 shadow-sm">
		<div class="card-body gap-4">
			<h2 class="card-title text-lg">Announcements (ntfy.sh)</h2>
			<p class="text-sm text-base-content/70">
				Subscribe to a <a href="https://ntfy.sh" class="link">ntfy.sh</a> topic to receive
				day-of festival announcements as in-app notifications.
			</p>

			<label class="form-control">
				<div class="label">
					<span class="label-text">ntfy.sh topic</span>
				</div>
				<input
					type="text"
					class="input input-bordered w-full"
					placeholder="e.g. my-festival-2026"
					bind:value={ntfyTopic}
					disabled={subscribed}
				/>
			</label>

			<div class="flex gap-2 flex-wrap">
				{#if !subscribed}
					<button
						class="btn btn-primary"
						onclick={handleSubscribe}
						disabled={!ntfyTopic.trim()}
					>
						Subscribe
					</button>
				{:else}
					<button class="btn btn-outline btn-error" onclick={handleUnsubscribe}>
						Unsubscribe
					</button>
				{/if}

				<button
					class="btn btn-outline"
					onclick={handleTestNotification}
					disabled={testLoading || !ntfyTopic.trim()}
				>
					{#if testLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{/if}
					Send Test
				</button>
			</div>

			{#if subscribed}
				<div class="alert alert-success py-2">
					<span class="text-sm">Subscribed to <strong>{ntfyTopic}</strong></span>
				</div>
			{/if}
		</div>
	</section>
</div>
