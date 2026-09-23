import assert from "node:assert/strict";
import { test } from "node:test";
import { acknowledgeDraft, readPendingDraft, roundDraftKey, writePendingDraft } from "./round-draft-storage.ts";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
}

test("immediate refresh retains the entire edit, including a newline or empty draft", () => {
  const storage = memoryStorage();
  const key = roundDraftKey("alice", "round1");
  writePendingDraft(storage, key, "print");
  writePendingDraft(storage, key, 'print("hello world")\n');
  assert.equal(readPendingDraft(storage, key), 'print("hello world")\n');
  writePendingDraft(storage, key, "");
  assert.equal(readPendingDraft(storage, key), "");
});

test("an old server acknowledgement cannot discard newer typing", () => {
  const storage = memoryStorage();
  writePendingDraft(storage, "key", "new code");
  acknowledgeDraft(storage, "key", "old code");
  assert.equal(readPendingDraft(storage, "key"), "new code");
  acknowledgeDraft(storage, "key", "new code");
  assert.equal(readPendingDraft(storage, "key"), null);
});

test("pending drafts are isolated by player and round", () => {
  const storage = memoryStorage();
  writePendingDraft(storage, roundDraftKey("alice", "round1"), "private");
  assert.equal(readPendingDraft(storage, roundDraftKey("bob", "round1")), null);
  assert.equal(readPendingDraft(storage, roundDraftKey("alice", "round2")), null);
});

test("unavailable storage fails safely", () => {
  const fail = () => { throw new Error("Storage disabled"); };
  const storage = { getItem: fail, setItem: fail, removeItem: fail };
  assert.equal(writePendingDraft(storage, "key", "code"), false);
  assert.equal(readPendingDraft(storage, "key"), null);
  assert.doesNotThrow(() => acknowledgeDraft(storage, "key", "code"));
});
