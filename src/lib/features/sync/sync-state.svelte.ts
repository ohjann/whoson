import type { SyncResult } from './clashfinder-sync';

let _syncing = $state(false);
let _lastSyncResult = $state<SyncResult | null>(null);

export function getSyncing() { return _syncing; }
export function setSyncing(v: boolean) { _syncing = v; }

export function getLastSyncResult() { return _lastSyncResult; }
export function setLastSyncResult(v: SyncResult | null) { _lastSyncResult = v; }
export function clearSyncResult() { _lastSyncResult = null; }
