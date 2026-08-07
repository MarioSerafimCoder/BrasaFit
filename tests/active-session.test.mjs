import assert from "node:assert/strict";
import test from "node:test";

import {
  addRestSeconds,
  beginActiveSession,
  createActiveWorkoutSession,
  getElapsedSeconds,
  getRestRemainingSeconds,
  normalizeActiveWorkoutSession,
  pauseRest,
  resumeRest,
  startRest,
  summarizeActiveSession,
} from "../app/active-session.ts";

const exercise = (id, sets = 3) => ({
  exercise: { id, name: id, muscleGroups: [], equipment: "", alternativeIds: [], instructions: "", commonErrors: "" },
  sets,
  reps: "10",
  rest: 60,
  tempo: "",
  loadSuggestion: "",
  targetRpe: "RPE 6",
  note: "",
});

const workout = {
  id: "workout-a",
  name: "Treino A",
  focus: "Força",
  estimatedMinutes: 30,
  warmup: [exercise("warmup", 1)],
  main: [exercise("squat")],
  cooldown: [],
  notices: [],
};

test("restores elapsed time from an absolute start timestamp", () => {
  const created = createActiveWorkoutSession(workout, 1_000);
  const started = beginActiveSession(created, 5_000);

  assert.equal(getElapsedSeconds(started, 70_500), 65);
});

test("persists the selected date and sequence action with the session", () => {
  const session = createActiveWorkoutSession(workout, Date.UTC(2026, 7, 6), { plannedDate: "2026-08-08", sequenceNumber: 4, sequenceAdvance: 2, sequenceAction: "manually_advanced" });

  assert.equal(session.plannedDate, "2026-08-08");
  assert.equal(session.sequenceNumber, 4);
  assert.equal(session.sequenceAdvance, 2);
  assert.equal(session.sequenceAction, "manually_advanced");
});

test("keeps rest timer correct across pause, resume and background time", () => {
  const session = beginActiveSession(createActiveWorkoutSession(workout, 0), 0);
  const resting = startRest(session, 60, 10_000);
  assert.equal(getRestRemainingSeconds(resting, 25_000), 45);

  const paused = pauseRest(resting, 25_000);
  assert.equal(getRestRemainingSeconds(paused, 90_000), 45);

  const extended = addRestSeconds(paused, 15, 90_000);
  const resumed = resumeRest(extended, 100_000);
  assert.equal(getRestRemainingSeconds(resumed, 130_000), 30);
});

test("summarizes completed series, volume and repetitions from persisted state", () => {
  let session = beginActiveSession(createActiveWorkoutSession(workout, 0), 0);
  session = {
    ...session,
    completedSeries: { warmup: [1], squat: [1, 2, 3] },
    loads: { squat: "20" },
    actualReps: { squat: "10" },
    rir: { squat: "2" },
    cardioMinutes: "12",
    cardioIntensity: "Leve",
  };
  const summary = summarizeActiveSession(session, 120_000);

  assert.equal(summary.completedExercises, 2);
  assert.equal(summary.totalVolumeKg, 600);
  assert.equal(summary.elapsedSeconds, 120);
  assert.equal(summary.cardioMinutes, 12);
});

test("normalizes older persisted sessions and includes pain events in the summary", () => {


  const legacy = createActiveWorkoutSession(workout, 0);
  delete legacy.notes;
  delete legacy.exerciseOverrides;
  delete legacy.substitutions;
  delete legacy.painEvents;

  const normalized = normalizeActiveWorkoutSession(legacy);
  normalized.painEvents.push({ exerciseId: "squat", region: "Joelho direito", intensity: 5, recordedAt: new Date(0).toISOString() });
  const summary = summarizeActiveSession(normalized, 0);

  assert.deepEqual(normalized.notes, {});
  assert.equal(summary.painScore, 5);
  assert.deepEqual(summary.symptoms, ["Joelho direito (5/10)"]);
});
test("uses the adjusted set recommendation and restores new rest progress fields", () => {
  const legacy = createActiveWorkoutSession(workout, 0);
  delete legacy.setOverrides;
  delete legacy.completedRestSeries;
  delete legacy.activeRestExerciseId;
  delete legacy.activeRestSeries;

  const normalized = normalizeActiveWorkoutSession(legacy);
  normalized.setOverrides = { squat: 2 };
  normalized.completedSeries = { warmup: [1], squat: [1, 2] };
  const summary = summarizeActiveSession(normalized, 0);

  assert.deepEqual(normalized.completedRestSeries, {});
  assert.equal(normalized.activeRestExerciseId, null);
  assert.equal(summary.completedExercises, 2);
});