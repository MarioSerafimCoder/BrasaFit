export const DATA_SCHEMA_VERSION = 3;

export const CRITICAL_STORAGE_KEYS = {
  profile: "fitlocal.profile.v1",
  history: "brasafit.history.v2",
  measurements: "brasafit.measurements.v3",
  checkIns: "brasafit.checkins.v1",
  activeSession: "angelsfit.active-session.v1",
} as const;

export type CriticalRecordName = keyof typeof CRITICAL_STORAGE_KEYS;

export type CriticalData = {
  profile: unknown | null;
  history: unknown[];
  measurements: unknown[];
  checkIns: unknown[];
  activeSession: unknown | null;
};

export type RecoveryEvent = {
  record: CriticalRecordName;
  action: "loaded" | "recovered" | "empty";
};

export type LoadCriticalDataResult = {
  data: CriticalData;
  events: RecoveryEvent[];
};

export interface SyncKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AsyncRecordMirror {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

type IntegrityEnvelope = {
  dataSchemaVersion: number;
  key: string;
  savedAt: string;
  checksum: string;
  payload: string;
};

type RecordDescriptor = {
  key: string;
  fallback: unknown | unknown[];
  validate: (value: unknown) => boolean;
};

const CORRUPT_RECORD_PREFIX = "angelsfit.corrupt.v1.";
const DATABASE_NAME = "angels-fit-local";
const DATABASE_VERSION = 1;
const RECORD_STORE = "critical-records";
const SNAPSHOT_KEY = "angelsfit.snapshot.latest.v1";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isValidProfile(value: unknown): boolean {
  return isObject(value)
    && isString(value.id)
    && isString(value.name)
    && Array.isArray(value.days);
}

export function isValidHistory(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isObject(item)
    && isString(item.id)
    && isString(item.workoutName)
    && isString(item.completedAt));
}

export function isValidMeasurements(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isObject(item)
    && isString(item.recordedAt)
    && typeof item.weightKg === "number"
    && Number.isFinite(item.weightKg));
}

export function isValidCheckIns(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isObject(item)
    && isString(item.id)
    && isString(item.checkedAt));
}

export function isValidActiveSession(value: unknown): boolean {
  return isObject(value)
    && value.schemaVersion === 1
    && isString(value.id)
    && isString(value.status)
    && isString(value.createdAt)
    && isString(value.updatedAt)
    && isObject(value.workout)
    && isString(value.workout.id)
    && typeof value.currentExerciseIndex === "number"
    && isObject(value.completedSeries)
    && isObject(value.loads)
    && isObject(value.actualReps);
}

const RECORDS: Record<CriticalRecordName, RecordDescriptor> = {
  profile: { key: CRITICAL_STORAGE_KEYS.profile, fallback: null, validate: isValidProfile },
  history: { key: CRITICAL_STORAGE_KEYS.history, fallback: [], validate: isValidHistory },
  measurements: { key: CRITICAL_STORAGE_KEYS.measurements, fallback: [], validate: isValidMeasurements },
  checkIns: { key: CRITICAL_STORAGE_KEYS.checkIns, fallback: [], validate: isValidCheckIns },
  activeSession: { key: CRITICAL_STORAGE_KEYS.activeSession, fallback: null, validate: isValidActiveSession },
};

export function checksum(payload: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function serializeEnvelope(key: string, payload: string): string {
  const envelope: IntegrityEnvelope = {
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    key,
    savedAt: new Date().toISOString(),
    checksum: checksum(payload),
    payload,
  };
  return JSON.stringify(envelope);
}

function parseEnvelope(raw: string | null, expectedKey: string): string | null {
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as Partial<IntegrityEnvelope>;
    if (envelope.dataSchemaVersion !== DATA_SCHEMA_VERSION
      || envelope.key !== expectedKey
      || typeof envelope.payload !== "string"
      || envelope.checksum !== checksum(envelope.payload)) return null;
    return envelope.payload;
  } catch {
    return null;
  }
}

function parseRecord(payload: string | null, validate: (value: unknown) => boolean): unknown | null {
  if (payload === null) return null;
  try {
    const value: unknown = JSON.parse(payload);
    return validate(value) ? value : null;
  } catch {
    return null;
  }
}

function quarantine(storage: SyncKeyValueStorage, key: string, payload: string): void {
  try {
    storage.setItem(`${CORRUPT_RECORD_PREFIX}${key}`, payload);
  } catch {
    // Preserving the primary value takes precedence when storage is full or unavailable.
  }
}

export class CriticalDataRepository {
  private readonly primary: SyncKeyValueStorage;
  private readonly mirror?: AsyncRecordMirror;

  constructor(
    primary: SyncKeyValueStorage,
    mirror?: AsyncRecordMirror,
  ) {
    this.primary = primary;
    this.mirror = mirror;
  }

  async load(): Promise<LoadCriticalDataResult> {
    const data: CriticalData = { profile: null, history: [], measurements: [], checkIns: [], activeSession: null };
    const events: RecoveryEvent[] = [];

    for (const recordName of Object.keys(RECORDS) as CriticalRecordName[]) {
      const descriptor = RECORDS[recordName];
      const primaryPayload = this.primary.getItem(descriptor.key);
      const primaryValue = parseRecord(primaryPayload, descriptor.validate);

      if (primaryValue !== null) {
        data[recordName] = primaryValue as never;
        events.push({ record: recordName, action: "loaded" });
        await this.saveMirror(descriptor.key, primaryPayload!);
        continue;
      }

      const mirroredEnvelope = await this.readMirror(descriptor.key);
      const mirroredPayload = parseEnvelope(mirroredEnvelope, descriptor.key);
      const mirroredValue = parseRecord(mirroredPayload, descriptor.validate);

      if (mirroredValue !== null && mirroredPayload !== null) {
        if (primaryPayload !== null) quarantine(this.primary, descriptor.key, primaryPayload);
        this.primary.setItem(descriptor.key, mirroredPayload);
        data[recordName] = mirroredValue as never;
        events.push({ record: recordName, action: "recovered" });
        continue;
      }

      if (primaryPayload !== null) quarantine(this.primary, descriptor.key, primaryPayload);
      data[recordName] = descriptor.fallback as never;
      events.push({ record: recordName, action: "empty" });
    }

    return { data, events };
  }

  async write(recordName: CriticalRecordName, value: unknown): Promise<void> {
    const descriptor = RECORDS[recordName];
    if (!descriptor.validate(value)) throw new Error(`Invalid critical record: ${recordName}`);
    const payload = JSON.stringify(value);
    this.primary.setItem(descriptor.key, payload);
    await this.saveMirror(descriptor.key, payload);
  }

  async remove(recordName: CriticalRecordName): Promise<void> {
    const key = RECORDS[recordName].key;
    this.primary.removeItem(key);
    if (!this.mirror) return;
    try {
      await this.mirror.remove(key);
    } catch {
      // A later successful write will reconcile the structured mirror.
    }
  }

  async createSnapshot(): Promise<string> {
    const records = Object.fromEntries(
      (Object.keys(RECORDS) as CriticalRecordName[]).map((recordName) => {
        const key = RECORDS[recordName].key;
        return [key, this.primary.getItem(key)];
      }),
    );
    const payload = JSON.stringify({ dataSchemaVersion: DATA_SCHEMA_VERSION, createdAt: new Date().toISOString(), records });
    const envelope = serializeEnvelope(SNAPSHOT_KEY, payload);
    this.primary.setItem(SNAPSHOT_KEY, envelope);
    if (this.mirror) {
      try {
        await this.mirror.set(SNAPSHOT_KEY, envelope);
      } catch {
        // The primary snapshot is still available for rollback.
      }
    }
    return checksum(payload);
  }

  async restoreLatestSnapshot(): Promise<boolean> {
    const primaryEnvelope = this.primary.getItem(SNAPSHOT_KEY);
    let payload = parseEnvelope(primaryEnvelope, SNAPSHOT_KEY);
    if (!payload) payload = parseEnvelope(await this.readMirror(SNAPSHOT_KEY), SNAPSHOT_KEY);
    if (!payload) return false;
    try {
      const snapshot = JSON.parse(payload) as { records?: Record<string, string | null> };
      if (!snapshot.records || !isObject(snapshot.records)) return false;
      for (const recordName of Object.keys(RECORDS) as CriticalRecordName[]) {
        const descriptor = RECORDS[recordName];
        const recordPayload = snapshot.records[descriptor.key];
        if (typeof recordPayload !== "string" || parseRecord(recordPayload, descriptor.validate) === null) continue;
        this.primary.setItem(descriptor.key, recordPayload);
        await this.saveMirror(descriptor.key, recordPayload);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async saveMirror(key: string, payload: string): Promise<void> {
    if (!this.mirror) return;
    try {
      await this.mirror.set(key, serializeEnvelope(key, payload));
    } catch {
      // The compatible primary write remains authoritative until the mirror is available again.
    }
  }

  private async readMirror(key: string): Promise<string | null> {
    if (!this.mirror) return null;
    try {
      return await this.mirror.get(key);
    } catch {
      return null;
    }
  }
}

class IndexedDbRecordMirror implements AsyncRecordMirror {
  private databasePromise?: Promise<IDBDatabase>;

  async get(key: string): Promise<string | null> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const request = database.transaction(RECORD_STORE, "readonly").objectStore(RECORD_STORE).get(key);
      request.onsuccess = () => resolve(typeof request.result === "string" ? request.result : null);
      request.onerror = () => reject(request.error);
    });
  }

  async set(key: string, value: string): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECORD_STORE, "readwrite");
      transaction.objectStore(RECORD_STORE).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async remove(key: string): Promise<void> {
    const database = await this.open();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECORD_STORE, "readwrite");
      transaction.objectStore(RECORD_STORE).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private open(): Promise<IDBDatabase> {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(RECORD_STORE)) request.result.createObjectStore(RECORD_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.databasePromise;
  }
}

let browserRepository: CriticalDataRepository | undefined;

export function getBrowserDataRepository(): CriticalDataRepository {
  if (browserRepository) return browserRepository;
  const mirror = "indexedDB" in window ? new IndexedDbRecordMirror() : undefined;
  browserRepository = new CriticalDataRepository(window.localStorage, mirror);
  return browserRepository;
}
