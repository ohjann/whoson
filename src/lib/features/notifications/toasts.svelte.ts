export interface Toast {
	id: string;
	title?: string;
	message: string;
}

let toasts = $state<Toast[]>([]);

export function getToasts(): Toast[] {
	return toasts;
}

export function addToast(options: { title?: string; message: string }): void {
	const id = crypto.randomUUID();
	toasts = [...toasts, { id, ...options }];
	setTimeout(() => removeToast(id), 5000);
}

export function removeToast(id: string): void {
	toasts = toasts.filter((t) => t.id !== id);
}
