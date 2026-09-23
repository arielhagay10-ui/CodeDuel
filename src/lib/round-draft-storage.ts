type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function roundDraftKey(userId: string, roundId: string): string {
  return `codeduel.round.pending.${userId}.${roundId}`;
}

// Only unacknowledged edits are cached. Server drafts remain authoritative once
// saving succeeds; an older response must never remove a newer local edit.
export function readPendingDraft(storage: DraftStorage, key: string): string | null {
  try { return storage.getItem(key); } catch { return null; }
}

export function writePendingDraft(storage: DraftStorage, key: string, source: string): boolean {
  try { storage.setItem(key, source); return true; } catch { return false; }
}

export function acknowledgeDraft(storage: DraftStorage, key: string, source: string): void {
  try {
    if (storage.getItem(key) === source) storage.removeItem(key);
  } catch { /* Server save succeeded even if device storage is unavailable. */ }
}
