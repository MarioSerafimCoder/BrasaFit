import assert from "node:assert/strict";
import test from "node:test";

import {
  CRITICAL_STORAGE_KEYS,
  CriticalDataRepository,
  checksum,
} from "../app/data-repository.ts";

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

class MemoryMirror {
  values = new Map();

  async get(key) {
    return this.values.get(key) ?? null;
  }

  async set(key, value) {
    this.values.set(key, value);
  }

  async remove(key) {
    this.values.delete(key);
  }
}

const profile = {
  id: "mario",
  name: "Mário",
  days: ["Seg", "Qua"],
  futureField: { preserved: true },
};

test("writes compatible JSON to primary storage and an integrity envelope to the mirror", async () => {
  const primary = new MemoryStorage();
  const mirror = new MemoryMirror();
  const repository = new CriticalDataRepository(primary, mirror);

  await repository.write("profile", profile);

  assert.deepEqual(JSON.parse(primary.getItem(CRITICAL_STORAGE_KEYS.profile)), profile);
  const envelope = JSON.parse(await mirror.get(CRITICAL_STORAGE_KEYS.profile));
  assert.equal(envelope.key, CRITICAL_STORAGE_KEYS.profile);
  assert.equal(envelope.checksum, checksum(envelope.payload));
  assert.deepEqual(JSON.parse(envelope.payload), profile);
});

test("recovers a corrupted primary record from the verified mirror without deleting evidence", async () => {
  const primary = new MemoryStorage();
  const mirror = new MemoryMirror();
  const repository = new CriticalDataRepository(primary, mirror);
  await repository.write("profile", profile);

  primary.setItem(CRITICAL_STORAGE_KEYS.profile, "{corrupted-json");
  const result = await repository.load();

  assert.deepEqual(result.data.profile, profile);
  assert.equal(result.events.find((event) => event.record === "profile")?.action, "recovered");
  assert.equal(primary.getItem(`angelsfit.corrupt.v1.${CRITICAL_STORAGE_KEYS.profile}`), "{corrupted-json");
  assert.deepEqual(JSON.parse(primary.getItem(CRITICAL_STORAGE_KEYS.profile)), profile);
});

test("rejects a mirror whose checksum was changed", async () => {
  const primary = new MemoryStorage();
  const mirror = new MemoryMirror();
  const repository = new CriticalDataRepository(primary, mirror);
  await repository.write("history", [{ id: "1", workoutName: "Treino A", completedAt: "2026-08-06T12:00:00.000Z" }]);

  primary.setItem(CRITICAL_STORAGE_KEYS.history, "not-json");
  const envelope = JSON.parse(await mirror.get(CRITICAL_STORAGE_KEYS.history));
  envelope.payload = "[]";
  mirror.values.set(CRITICAL_STORAGE_KEYS.history, JSON.stringify(envelope));

  const result = await repository.load();

  assert.deepEqual(result.data.history, []);
  assert.equal(result.events.find((event) => event.record === "history")?.action, "empty");
  assert.equal(primary.getItem(CRITICAL_STORAGE_KEYS.history), "not-json");
});

test("preserves unknown fields while validating existing records", async () => {
  const primary = new MemoryStorage();
  const repository = new CriticalDataRepository(primary);
  primary.setItem(CRITICAL_STORAGE_KEYS.profile, JSON.stringify(profile));

  const result = await repository.load();

  assert.deepEqual(result.data.profile, profile);
  assert.deepEqual(result.data.profile.futureField, { preserved: true });
});

test("keeps primary reads and writes working when the structured mirror is unavailable", async () => {
  const primary = new MemoryStorage();
  const failingMirror = {
    async get() { throw new Error("IndexedDB unavailable"); },
    async set() { throw new Error("IndexedDB unavailable"); },
  };
  const repository = new CriticalDataRepository(primary, failingMirror);

  await repository.write("profile", profile);
  const result = await repository.load();

  assert.deepEqual(result.data.profile, profile);
});

test("creates and restores an integrity-checked snapshot", async () => {
  const primary = new MemoryStorage();
  const mirror = new MemoryMirror();
  const repository = new CriticalDataRepository(primary, mirror);
  await repository.write("profile", profile);
  await repository.createSnapshot();

  primary.setItem(CRITICAL_STORAGE_KEYS.profile, JSON.stringify({ id: "mario", name: "Alterado", days: [] }));
  assert.equal(await repository.restoreLatestSnapshot(), true);

  assert.deepEqual(JSON.parse(primary.getItem(CRITICAL_STORAGE_KEYS.profile)), profile);
});

test("removes a completed active session from both stores", async () => {
  const primary = new MemoryStorage();
  const mirror = new MemoryMirror();
  const repository = new CriticalDataRepository(primary, mirror);
  const activeSession = { schemaVersion: 1, id: "session-1", status: "active", createdAt: "2026-08-06T12:00:00.000Z", updatedAt: "2026-08-06T12:00:00.000Z", workout: { id: "a" }, currentExerciseIndex: 0, completedSeries: {}, loads: {}, actualReps: {} };
  await repository.write("activeSession", activeSession);
  await repository.remove("activeSession");

  assert.equal(primary.getItem(CRITICAL_STORAGE_KEYS.activeSession), null);
  assert.equal(await mirror.get(CRITICAL_STORAGE_KEYS.activeSession), null);
});
