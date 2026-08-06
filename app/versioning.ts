import type { SyncKeyValueStorage } from "./data-repository";
import { migrateTrainingHistory, type TrainingHistoryLike } from "./training-intelligence.ts";

export const APP_VERSION = "1.0";
export const CONTENT_VERSION = "2026.08.06.4";
export const CURRENT_DATA_SCHEMA_VERSION = 4;
export const MINIMUM_SUPPORTED_APP_VERSION = "1.0";

export const DATA_SCHEMA_VERSION_KEY = "angelsfit.data-schema-version";
export const LAST_UPDATE_CHECK_KEY = "angelsfit.last-update-check";

type Migration = (storage: SyncKeyValueStorage) => void;

const migrations: Record<number, Migration> = {
  2: (storage) => {
    if (storage.getItem("angelsfit.migration.2") === null) storage.setItem("angelsfit.migration.2", "complete");
  },
  3: (storage) => {
    if (storage.getItem("angelsfit.migration.3") === null) storage.setItem("angelsfit.migration.3", "complete");
  },
  4: (storage) => {
    if (storage.getItem("angelsfit.migration.4") !== null) return;
    const historyKey = "brasafit.history.v2";
    const rawHistory = storage.getItem(historyKey);
    if (rawHistory !== null) {
      const parsed: unknown = JSON.parse(rawHistory);
      if (!Array.isArray(parsed)) throw new Error("Workout history is not an array");
      storage.setItem(historyKey, JSON.stringify(migrateTrainingHistory(parsed as TrainingHistoryLike[])));
    }
    storage.setItem("angelsfit.migration.4", "complete");
  },
};

export function readDataSchemaVersion(storage: SyncKeyValueStorage): number {
  const parsed = Number.parseInt(storage.getItem(DATA_SCHEMA_VERSION_KEY) || "1", 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export function runDataMigrations(storage: SyncKeyValueStorage): number[] {
  const initialVersion = readDataSchemaVersion(storage);
  if (initialVersion > CURRENT_DATA_SCHEMA_VERSION) throw new Error("Local data schema is newer than this content version");
  const applied: number[] = [];
  for (let version = initialVersion + 1; version <= CURRENT_DATA_SCHEMA_VERSION; version += 1) {
    const migrate = migrations[version];
    if (!migrate) throw new Error(`Missing data migration for version ${version}`);
    migrate(storage);
    storage.setItem(DATA_SCHEMA_VERSION_KEY, String(version));
    applied.push(version);
  }
  return applied;
}

function versionParts(value: string): number[] {
  return value.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(left: string, right: string): number {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export type VersionMetadata = {
  appVersion: string;
  contentVersion: string;
  dataSchemaVersion: number;
  minimumSupportedAppVersion: string;
};

export function validateVersionMetadata(value: unknown): value is VersionMetadata {
  if (typeof value !== "object" || value === null) return false;
  const metadata = value as Partial<VersionMetadata>;
  return typeof metadata.appVersion === "string"
    && typeof metadata.contentVersion === "string"
    && typeof metadata.dataSchemaVersion === "number"
    && typeof metadata.minimumSupportedAppVersion === "string";
}
