import assert from "node:assert/strict";
import test from "node:test";

import {
  CURRENT_DATA_SCHEMA_VERSION,
  DATA_SCHEMA_VERSION_KEY,
  compareVersions,
  runDataMigrations,
} from "../app/versioning.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("migrates sequentially from schema 1", () => {
  const storage = new MemoryStorage();
  storage.setItem(DATA_SCHEMA_VERSION_KEY, "1");

  assert.deepEqual(runDataMigrations(storage), [2, 3, 4]);
  assert.equal(storage.getItem(DATA_SCHEMA_VERSION_KEY), String(CURRENT_DATA_SCHEMA_VERSION));
});

test("migrates from the previous schema without replaying completed work", () => {
  const storage = new MemoryStorage();
  storage.setItem(DATA_SCHEMA_VERSION_KEY, "2");

  assert.deepEqual(runDataMigrations(storage), [3, 4]);
  assert.deepEqual(runDataMigrations(storage), []);
});

test("schema 4 preserves history while adding deterministic sequence data", () => {
  const storage = new MemoryStorage();
  storage.setItem(DATA_SCHEMA_VERSION_KEY, "3");
  storage.setItem("brasafit.history.v2", JSON.stringify([
    { id: "old-1", workoutName: "Treino A", completedAt: "2026-08-01T12:00:00.000Z" },
  ]));

  assert.deepEqual(runDataMigrations(storage), [4]);
  const [migrated] = JSON.parse(storage.getItem("brasafit.history.v2"));
  assert.equal(migrated.id, "old-1");
  assert.equal(migrated.status, "completed");
  assert.equal(migrated.sequenceNumber, 1);
  assert.equal(migrated.sequenceAdvance, 1);
});

test("compares native and content versions numerically", () => {
  assert.equal(compareVersions("1.10.0", "1.2.0") > 0, true);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
});
