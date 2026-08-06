import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCalendarSchedule,
  calculateAdherence,
  eligibleProtocols,
  evaluatePhase,
  getReturnAdaptation,
  migrateTrainingHistory,
  recommendedWorkoutIndex,
  suggestDoubleProgression,
} from "../app/training-intelligence.ts";

const workouts = ["A", "B", "C"].map((name) => ({ id: name, name: `Treino ${name}`, focus: "", estimatedMinutes: 45, warmup: [], main: [], cooldown: [], notices: [] }));
const record = (id, date, status = "completed", extra = {}) => ({ id, workoutName: `Treino ${id}`, completedAt: `${date}T12:00:00.000Z`, status, completedExercises: 6, totalExercises: 6, ...extra });

test("2026-08-06 is Thursday and future dates cross boundaries correctly", () => {
  const calendar = buildCalendarSchedule({ startDate: new Date(2026, 7, 6, 12), days: 7, availableDays: ["Qui", "Sáb", "Seg"], workouts, recommendedIndex: 0 });
  assert.equal(calendar[0].weekdayShort, "Qui");
  assert.equal(calendar[0].dateKey, "2026-08-06");
  assert.equal(calendar[1].weekdayShort, "Sex");
  assert.equal(calendar[1].workout, null);
  assert.equal(calendar[2].workout?.name, "Treino B");
  assert.equal(calendar[4].workout?.name, "Treino C");
});

test("missing the planned date keeps the same recommended workout", () => {
  const history = [record("A", "2026-08-01")];
  assert.equal(recommendedWorkoutIndex(history, workouts.length), 1);
  assert.equal(recommendedWorkoutIndex(history, workouts.length), 1);
});

test("repeat does not advance twice and manual advance records its offset", () => {
  const history = [record("A", "2026-08-01"), record("A2", "2026-08-02", "repeated", { sequenceAdvance: 0 }), record("C", "2026-08-03", "manually_advanced", { sequenceAdvance: 2 })];
  assert.equal(recommendedWorkoutIndex(history, workouts.length), 0);
});

test("migration preserves legacy history and adds deterministic sequence fields", () => {
  const migrated = migrateTrainingHistory([{ id: "1", workoutName: "Treino A", completedAt: "2026-08-01T12:00:00.000Z" }]);
  assert.equal(migrated[0].status, "completed");
  assert.equal(migrated[0].sequenceNumber, 1);
  assert.equal(migrated[0].plannedDate, "2026-08-01");
});

test("adherence separates completed, partial and skipped sessions", () => {
  const history = [record("1", "2026-08-01"), record("2", "2026-08-02", "partial"), record("3", "2026-08-03", "skipped")];
  const summary = calculateAdherence(history, new Date(2026, 7, 6, 12), ["Seg", "Qua", "Sex"]);
  assert.equal(summary.completedSessions, 1);
  assert.equal(summary.partialSessions, 1);
  assert.equal(summary.skippedSessions, 1);
  assert.equal(summary.adherencePercentage, 33);
});

test("phase cannot advance before twelve adequate completed sessions", () => {
  const history = Array.from({ length: 6 }, (_, index) => record(String(index), `2026-07-${String(index + 1).padStart(2, "0")}`));
  const adherence = { ...calculateAdherence(history, new Date(2026, 7, 6, 12), ["Seg", "Qua", "Sex"]), adherencePercentage: 100 };
  assert.equal(evaluatePhase(history, adherence).action, "maintain");
});

test("double progression requires the upper limit and every safety criterion", () => {
  assert.equal(suggestDoubleProgression({ repetitionsBySet: [12, 12, 12], upperRepetitionLimit: 12, setsPlanned: 3, sessionRpe: 7, painScore: 0, executionAdequate: true, matchingLoadConfirmations: 2 }).action, "increase");
  assert.equal(suggestDoubleProgression({ repetitionsBySet: [12, 12, 11], upperRepetitionLimit: 12, setsPlanned: 3, sessionRpe: 7, painScore: 0, executionAdequate: true, matchingLoadConfirmations: 2 }).action, "maintain");
});

test("ten days away reduces volume and blocks advanced protocols", () => {
  const adaptation = getReturnAdaptation([record("1", "2026-07-27")], new Date(2026, 7, 6, 12));
  assert.equal(adaptation.level, "reduce");
  assert.equal(adaptation.setMultiplier, 0.7);
  assert.equal(eligibleProtocols({ experience: "Avançado", recovery: "Alta", adherencePercentage: 90, painScore: 0, inactivityDays: 10, sessionsThisWeek: 0 }).length, 0);
});
