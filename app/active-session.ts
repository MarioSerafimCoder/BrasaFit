import type { GeneratedWorkout } from "./workout-engine";

function calculateEstimatedOneRepMax(loadKg: number, repetitions: number): number {
  if (!Number.isFinite(loadKg) || !Number.isFinite(repetitions) || loadKg <= 0 || repetitions <= 0) return 0;
  return loadKg * (1 + repetitions / 30);
}

export type SessionStatus = "setup" | "active" | "feedback";

export type ActiveWorkoutSession = {
  schemaVersion: 1;
  id: string;
  workout: GeneratedWorkout;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  elapsedBeforeSeconds: number;
  elapsedStartedAt: string | null;
  currentExerciseIndex: number;
  completedSeries: Record<string, number[]>;
  loads: Record<string, string>;
  actualReps: Record<string, string>;
  rir: Record<string, string>;
  notes: Record<string, string>;
  exerciseOverrides: Record<string, string>;
  substitutions: Array<{ fromExerciseId: string; toExerciseId: string; reason: string; changedAt: string }>;
  painEvents: Array<{ exerciseId: string; region: string; intensity: number; recordedAt: string }>;
  restEndsAt: string | null;
  restPausedSeconds: number | null;
  sleepLastNight: string;
  energy: string;
  stress: string;
  painBefore: string;
  newPain: boolean;
  postpartumAlert: boolean;
  cardioMinutes: string;
  cardioIntensity: string;
  sessionRpe: string;
  painAfter: string;
  postSymptoms: string[];
};

export type SessionSummary = {
  completedExercises: number;
  totalExercises: number;
  elapsedSeconds: number;
  totalVolumeKg: number;
  estimatedOneRepMax: number;
  cardioMinutes: number;
  cardioIntensity: string;
  sessionRpe: number;
  averageRir: number;
  painScore: number;
  symptoms: string[];
};

function iso(now: number): string {
  return new Date(now).toISOString();
}

function sessionId(now: number): string {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ?? `${now}-${Math.random().toString(36).slice(2)}`;
}

export function createActiveWorkoutSession(workout: GeneratedWorkout, now = Date.now()): ActiveWorkoutSession {
  const timestamp = iso(now);
  return {
    schemaVersion: 1,
    id: sessionId(now),
    workout,
    status: "setup",
    createdAt: timestamp,
    updatedAt: timestamp,
    elapsedBeforeSeconds: 0,
    elapsedStartedAt: null,
    currentExerciseIndex: 0,
    completedSeries: {},
    loads: {},
    actualReps: {},
    rir: {},
    notes: {},
    exerciseOverrides: {},
    substitutions: [],
    painEvents: [],
    restEndsAt: null,
    restPausedSeconds: null,
    sleepLastNight: "",
    energy: "",
    stress: "",
    painBefore: "",
    newPain: false,
    postpartumAlert: false,
    cardioMinutes: "",
    cardioIntensity: "",
    sessionRpe: "",
    painAfter: "",
    postSymptoms: [],
  };
}

export function normalizeActiveWorkoutSession(session: ActiveWorkoutSession): ActiveWorkoutSession {
  return {
    ...session,
    completedSeries: session.completedSeries || {},
    loads: session.loads || {},
    actualReps: session.actualReps || {},
    rir: session.rir || {},
    notes: session.notes || {},
    exerciseOverrides: session.exerciseOverrides || {},
    substitutions: session.substitutions || [],
    painEvents: session.painEvents || [],
    postSymptoms: session.postSymptoms || [],
  };
}

export function patchActiveSession(
  session: ActiveWorkoutSession,
  patch: Partial<ActiveWorkoutSession>,
  now = Date.now(),
): ActiveWorkoutSession {
  return { ...session, ...patch, updatedAt: iso(now) };
}

export function beginActiveSession(session: ActiveWorkoutSession, now = Date.now()): ActiveWorkoutSession {
  if (session.status !== "setup") return session;
  return patchActiveSession(session, { status: "active", elapsedStartedAt: iso(now) }, now);
}

export function getElapsedSeconds(session: ActiveWorkoutSession, now = Date.now()): number {
  if (!session.elapsedStartedAt || session.status !== "active") return Math.max(0, session.elapsedBeforeSeconds);
  const running = Math.max(0, Math.floor((now - new Date(session.elapsedStartedAt).getTime()) / 1000));
  return session.elapsedBeforeSeconds + running;
}

export function enterFeedback(session: ActiveWorkoutSession, now = Date.now()): ActiveWorkoutSession {
  return patchActiveSession(session, {
    status: "feedback",
    elapsedBeforeSeconds: getElapsedSeconds(session, now),
    elapsedStartedAt: null,
    restEndsAt: null,
    restPausedSeconds: null,
  }, now);
}

export function getRestRemainingSeconds(session: ActiveWorkoutSession, now = Date.now()): number {
  if (session.restPausedSeconds !== null) return Math.max(0, session.restPausedSeconds);
  if (!session.restEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(session.restEndsAt).getTime() - now) / 1000));
}

export function startRest(session: ActiveWorkoutSession, seconds: number, now = Date.now()): ActiveWorkoutSession {
  if (seconds <= 0) return session;
  return patchActiveSession(session, {
    restEndsAt: iso(now + seconds * 1000),
    restPausedSeconds: null,
  }, now);
}

export function addRestSeconds(session: ActiveWorkoutSession, seconds: number, now = Date.now()): ActiveWorkoutSession {
  const remaining = getRestRemainingSeconds(session, now);
  if (session.restPausedSeconds !== null) {
    return patchActiveSession(session, { restPausedSeconds: remaining + seconds }, now);
  }
  return patchActiveSession(session, { restEndsAt: iso(now + (remaining + seconds) * 1000) }, now);
}

export function pauseRest(session: ActiveWorkoutSession, now = Date.now()): ActiveWorkoutSession {
  const remaining = getRestRemainingSeconds(session, now);
  if (!remaining) return session;
  return patchActiveSession(session, { restEndsAt: null, restPausedSeconds: remaining }, now);
}

export function resumeRest(session: ActiveWorkoutSession, now = Date.now()): ActiveWorkoutSession {
  if (session.restPausedSeconds === null || session.restPausedSeconds <= 0) return session;
  return patchActiveSession(session, {
    restEndsAt: iso(now + session.restPausedSeconds * 1000),
    restPausedSeconds: null,
  }, now);
}

export function skipRest(session: ActiveWorkoutSession, now = Date.now()): ActiveWorkoutSession {
  return patchActiveSession(session, { restEndsAt: null, restPausedSeconds: null }, now);
}

export function sessionReadiness(session: ActiveWorkoutSession): "atenção" | "muito baixa" | "baixa" | "moderada" | "alta" {
  const penalty = (Number(session.sleepLastNight) < 6 ? 2 : Number(session.sleepLastNight) < 7 ? 1 : 0)
    + (Number(session.energy) <= 2 ? 2 : Number(session.energy) === 3 ? 1 : 0)
    + (Number(session.stress) >= 4 ? 2 : Number(session.stress) === 3 ? 1 : 0)
    + (Number(session.painBefore) >= 4 ? 2 : Number(session.painBefore) >= 2 ? 1 : 0);
  if (session.newPain || session.postpartumAlert || Number(session.painBefore) >= 7) return "atenção";
  if (penalty >= 6) return "muito baixa";
  if (penalty >= 4) return "baixa";
  if (penalty >= 2) return "moderada";
  return "alta";
}

export function effectiveSets(sets: number, readiness: ReturnType<typeof sessionReadiness>): number {
  if (readiness === "muito baixa") return 1;
  if (readiness === "baixa") return Math.max(1, Math.ceil(sets * 0.7));
  return sets;
}

export function summarizeActiveSession(session: ActiveWorkoutSession, now = Date.now()): SessionSummary {
  session = normalizeActiveWorkoutSession(session);
  const items = [...session.workout.warmup, ...session.workout.main, ...session.workout.cooldown];
  const readiness = sessionReadiness(session);
  let completedExercises = 0;
  let totalVolumeKg = 0;
  let estimatedOneRepMax = 0;

  for (const item of items) {
    const sets = session.workout.main.includes(item) ? effectiveSets(item.sets, readiness) : item.sets;
    const setsDone = (session.completedSeries[item.exercise.id] || []).length;
    if (setsDone >= sets) completedExercises += 1;
    const load = Number.parseFloat((session.loads[item.exercise.id] || "0").replace(",", "."));
    const repetitions = Number.parseInt(session.actualReps[item.exercise.id] || "0", 10);
    if (load > 0 && repetitions > 0 && setsDone > 0) totalVolumeKg += load * repetitions * setsDone;
    const estimate = calculateEstimatedOneRepMax(load, repetitions);
    if (estimate) estimatedOneRepMax = Math.max(estimatedOneRepMax, estimate);
  }

  const rirValues = Object.values(session.rir).map(Number).filter(Number.isFinite);
  return {
    completedExercises,
    totalExercises: items.length,
    elapsedSeconds: getElapsedSeconds(session, now),
    totalVolumeKg: Math.round(totalVolumeKg),
    estimatedOneRepMax: Math.round(estimatedOneRepMax * 10) / 10,
    cardioMinutes: Number.parseInt(session.cardioMinutes || "0", 10),
    cardioIntensity: session.cardioIntensity,
    sessionRpe: Number(session.sessionRpe),
    averageRir: rirValues.length ? Math.round((rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length) * 10) / 10 : 0,
    painScore: Math.max(Number(session.painAfter), ...session.painEvents.map((event) => event.intensity), 0),
    symptoms: [...new Set([...session.postSymptoms, ...session.painEvents.map((event) => `${event.region} (${event.intensity}/10)`)])],
  };
}
