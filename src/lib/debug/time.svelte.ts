/**
 * Debug time control — provides a shared getNow() that all components use
 * instead of `new Date()`. When an offset is set, getNow() returns
 * real wall-clock time shifted by that offset.
 *
 * Must be .svelte.ts so runes are compiled.
 */

let offsetMs = $state(0);
let tick = $state(0);
let tickInterval: ReturnType<typeof setInterval> | undefined;

/** Start a 1-second tick so reactive consumers update continuously. */
function ensureTicking() {
	if (tickInterval) return;
	tickInterval = setInterval(() => {
		tick++;
	}, 1000);
}

/** Get the current (possibly shifted) time. Reactive — updates every second. */
export function getNow(): Date {
	// Reading `tick` makes this reactive (re-evaluated each second)
	void tick;
	return new Date(Date.now() + offsetMs);
}

/** Set a time offset in milliseconds from real wall-clock time. */
export function setTimeOffset(ms: number) {
	offsetMs = ms;
	ensureTicking();
}

/** Set offset in hours (convenience for the slider). */
export function setTimeOffsetHours(hours: number) {
	setTimeOffset(hours * 60 * 60 * 1000);
}

/** Reset to real time. */
export function resetTime() {
	offsetMs = 0;
}

/** Get current offset in hours. */
export function getTimeOffsetHours(): number {
	void tick;
	return offsetMs / (60 * 60 * 1000);
}

/** Whether time is currently shifted. */
export function isTimeShifted(): boolean {
	return offsetMs !== 0;
}

/** Jump to a specific date/time. */
export function jumpTo(dateTime: Date) {
	setTimeOffset(dateTime.getTime() - Date.now());
}
