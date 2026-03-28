import { addToast } from './toasts.svelte.js';

export interface NtfyMessage {
	id: string;
	title?: string;
	message: string;
	topic: string;
	time: number;
}

let eventSource: EventSource | null = null;
let currentTopic: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let active = false;

function connect(topic: string): void {
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	if (!navigator.onLine) {
		// Offline: schedule reconnect when online
		const onOnline = () => {
			window.removeEventListener('online', onOnline);
			if (active && currentTopic) {
				connect(currentTopic);
			}
		};
		window.addEventListener('online', onOnline);
		return;
	}

	const url = `https://ntfy.sh/${encodeURIComponent(topic)}/sse`;

	try {
		const es = new EventSource(url);
		eventSource = es;

		es.addEventListener('message', (event: MessageEvent) => {
			try {
				const data = JSON.parse(event.data as string) as NtfyMessage;
				if (data.message) {
					addToast({ title: data.title, message: data.message });
				}
			} catch {
				// Ignore malformed messages
			}
		});

		es.addEventListener('error', () => {
			es.close();
			eventSource = null;
			if (active && currentTopic) {
				// Reconnect after 5 seconds
				reconnectTimer = setTimeout(() => {
					if (active && currentTopic) {
						connect(currentTopic);
					}
				}, 5000);
			}
		});
	} catch {
		// SSE not supported or blocked; fail silently
	}
}

export function subscribeToTopic(topic: string): void {
	active = true;
	currentTopic = topic;
	connect(topic);

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);
}

export function unsubscribe(): void {
	active = false;
	currentTopic = null;

	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	window.removeEventListener('online', handleOnline);
	window.removeEventListener('offline', handleOffline);
}

function handleOnline(): void {
	if (active && currentTopic && !eventSource) {
		connect(currentTopic);
	}
}

function handleOffline(): void {
	if (eventSource) {
		eventSource.close();
		eventSource = null;
	}
}

export async function sendTestNotification(topic: string): Promise<void> {
	await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
		method: 'POST',
		body: 'Test notification from WhosOn!',
		headers: {
			Title: 'WhosOn Test',
		},
	});
}
