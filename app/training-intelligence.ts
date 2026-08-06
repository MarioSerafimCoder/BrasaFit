import type { GeneratedWorkout } from "./workout-engine";

export type TrainingSessionStatus = "planned" | "in_progress" | "completed" | "partial" | "skipped" | "repeated" | "interrupted" | "manually_advanced";

export type ExercisePerformanceRecord = {
  exerciseId: string;
  setsPlanned: number;
  setsCompleted: number;
  repetitions: number;
  load: number;
  rirOrRpe: number;
  restTime: number;
  technique: string;
  executionFeedback: "adequate" | "limited" | "unknown";
  painReported: boolean;
  substitutedExerciseId?: string;
};

export type TrainingHistoryLike = {
  id: string;
  workoutName: string;
  workoutId?: string;
  completedAt: string;
  plannedDate?: string;
  status?: TrainingSessionStatus;
  sequenceNumber?: number;
  sequenceAdvance?: number;
  phaseId?: string;
  durationMinutes?: number;
  completedExercises?: number;
  totalExercises?: number;
  sessionRpe?: number;
  painScore?: number;
  recovery24h?: string;
  totalVolumeKg?: number;
  exerciseRecords?: ExercisePerformanceRecord[];
  wasRepeated?: boolean;
  wasSkipped?: boolean;
  wasManuallyAdvanced?: boolean;
};

export type CalendarTrainingDay = {
  date: Date;
  dateKey: string;
  weekdayShort: string;
  dayNumber: number;
  monthShort: string;
  isToday: boolean;
  isTrainingDay: boolean;
  workout: GeneratedWorkout | null;
  sequenceOffset: number;
};

export type AdherenceSummary = {
  month: string;
  plannedSessions: number;
  completedSessions: number;
  partialSessions: number;
  skippedSessions: number;
  adherencePercentage: number;
  averageSessionsPerWeek: number;
  averageSessionDuration: number;
  longestInactivityPeriod: number;
  totalSetsCompleted: number;
  trainingVolume: number;
};

export type PhaseDecision = {
  phaseNumber: number;
  completedInPhase: number;
  requiredSessions: number;
  action: "advance" | "maintain" | "repeat";
  reason: string;
};

export type ReturnAdaptation = {
  inactivityDays: number;
  level: "none" | "maintain" | "reduce" | "return";
  setMultiplier: number;
  loadMultiplier: number;
  allowAdvancedProtocols: boolean;
  explanation: string;
};

export type TrainingProtocol = {
  id: string;
  name: string;
  objective: string;
  minimumLevel: "Iniciante" | "Intermediário" | "Avançado";
  allowedMovements: string[];
  forbiddenExerciseIds: string[];
  maxFrequencyPerWeek: number;
  maxSetsPerSession: number;
  requiredRecoveryStatus: "Média" | "Alta";
  inactivityRestrictionDays: number;
  explanation: string;
};

const LEVEL_RANK = { Iniciante: 1, Intermediário: 2, Avançado: 3 } as const;
const ADVANCING_STATUSES = new Set<TrainingSessionStatus>(["completed", "skipped", "manually_advanced"]);
const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const TRAINING_PROTOCOLS: TrainingProtocol[] = [
  { id: "superset-simple", name: "Supersérie simples", objective: "Aumentar densidade com técnica estável", minimumLevel: "Intermediário", allowedMovements: ["horizontal_push", "horizontal_pull", "arms", "glute"], forbiddenExerciseIds: [], maxFrequencyPerWeek: 2, maxSetsPerSession: 8, requiredRecoveryStatus: "Média", inactivityRestrictionDays: 7, explanation: "Dois exercícios compatíveis são feitos em sequência, seguidos pelo descanso completo." },
  { id: "drop-set", name: "Drop set", objective: "Aumentar estímulo local com volume controlado", minimumLevel: "Avançado", allowedMovements: ["arms", "horizontal_pull", "horizontal_push", "glute"], forbiddenExerciseIds: [], maxFrequencyPerWeek: 1, maxSetsPerSession: 3, requiredRecoveryStatus: "Alta", inactivityRestrictionDays: 7, explanation: "A última série reduz a carga uma vez e continua somente enquanto a execução permanecer estável." },
  { id: "rest-pause", name: "Rest-pause", objective: "Aumentar repetições efetivas sem elevar muitas séries", minimumLevel: "Avançado", allowedMovements: ["arms", "horizontal_pull", "horizontal_push"], forbiddenExerciseIds: [], maxFrequencyPerWeek: 1, maxSetsPerSession: 2, requiredRecoveryStatus: "Alta", inactivityRestrictionDays: 7, explanation: "A última série recebe uma pausa curta e controlada antes de poucas repetições adicionais." },
];

export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function effectiveStatus(item: TrainingHistoryLike): TrainingSessionStatus {
  return item.status || "completed";
}

export function sequenceAdvanceFor(item: TrainingHistoryLike): number {
  if (typeof item.sequenceAdvance === "number") return Math.max(0, item.sequenceAdvance);
  return ADVANCING_STATUSES.has(effectiveStatus(item)) ? 1 : 0;
}

export function migrateTrainingHistory(history: TrainingHistoryLike[]): TrainingHistoryLike[] {
  let cursor = 0;
  const migrated = [...history].sort((left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime()).map((item) => {
    const status = effectiveStatus(item);
    const advance = sequenceAdvanceFor({ ...item, status });
    const migratedItem = {
      ...item,
      status,
      workoutId: item.workoutId || `legacy-${item.workoutName.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, "-")}`,
      plannedDate: item.plannedDate || toLocalDateKey(new Date(item.completedAt)),
      sequenceNumber: item.sequenceNumber || cursor + 1,
      sequenceAdvance: advance,
      phaseId: item.phaseId || `phase-${Math.floor(cursor / 12) + 1}`,
      wasRepeated: item.wasRepeated || status === "repeated",
      wasSkipped: item.wasSkipped || status === "skipped",
      wasManuallyAdvanced: item.wasManuallyAdvanced || status === "manually_advanced",
      exerciseRecords: item.exerciseRecords || [],
    };
    cursor += advance;
    return migratedItem;
  });
  return migrated.sort((left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime());
}

export function completedSequenceCount(history: TrainingHistoryLike[]): number {
  return history.reduce((total, item) => total + sequenceAdvanceFor(item), 0);
}

export function recommendedWorkoutIndex(history: TrainingHistoryLike[], workoutCount: number): number {
  if (workoutCount <= 0) return 0;
  return completedSequenceCount(history) % workoutCount;
}

export function buildCalendarSchedule(options: { startDate: Date; days: number; availableDays: string[]; workouts: GeneratedWorkout[]; recommendedIndex: number }): CalendarTrainingDay[] {
  const start = startOfDay(options.startDate);
  let trainingOffset = 0;
  return Array.from({ length: options.days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const weekdayShort = DAY_LABELS[date.getDay()];
    const isTrainingDay = index === 0 || options.availableDays.includes(weekdayShort);
    const workout = isTrainingDay && options.workouts.length
      ? options.workouts[(options.recommendedIndex + trainingOffset) % options.workouts.length]
      : null;
    const sequenceOffset = trainingOffset;
    if (isTrainingDay && workout) trainingOffset += 1;
    return {
      date,
      dateKey: toLocalDateKey(date),
      weekdayShort,
      dayNumber: date.getDate(),
      monthShort: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
      isToday: index === 0,
      isTrainingDay,
      workout,
      sequenceOffset,
    };
  });
}

function daysBetween(left: Date, right: Date): number {
  return Math.max(0, Math.floor((startOfDay(right).getTime() - startOfDay(left).getTime()) / 86_400_000));
}

function plannedSessionsThrough(date: Date, availableDays: string[]): number {
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  let planned = 0;
  for (const cursor = new Date(first); cursor <= date; cursor.setDate(cursor.getDate() + 1)) {
    if (availableDays.includes(DAY_LABELS[cursor.getDay()])) planned += 1;
  }
  return planned;
}

export function calculateAdherence(history: TrainingHistoryLike[], now: Date, availableDays: string[]): AdherenceSummary {
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthItems = history.filter((item) => toLocalDateKey(new Date(item.completedAt)).startsWith(monthKey));
  const completed = monthItems.filter((item) => effectiveStatus(item) === "completed");
  const partial = monthItems.filter((item) => effectiveStatus(item) === "partial");
  const skipped = monthItems.filter((item) => ["skipped", "manually_advanced"].includes(effectiveStatus(item)));
  const plannedSessions = Math.max(plannedSessionsThrough(startOfDay(now), availableDays), completed.length + partial.length + skipped.length);
  const attended = [...completed, ...partial].sort((left, right) => new Date(left.completedAt).getTime() - new Date(right.completedAt).getTime());
  let longestInactivityPeriod = 0;
  for (let index = 1; index < attended.length; index += 1) longestInactivityPeriod = Math.max(longestInactivityPeriod, daysBetween(new Date(attended[index - 1].completedAt), new Date(attended[index].completedAt)));
  if (attended.length) longestInactivityPeriod = Math.max(longestInactivityPeriod, daysBetween(new Date(attended[attended.length - 1].completedAt), now));
  const elapsedWeeks = Math.max(1, now.getDate() / 7);
  const durations = attended.map((item) => item.durationMinutes || 0).filter((value) => value > 0);
  return {
    month: monthKey,
    plannedSessions,
    completedSessions: completed.length,
    partialSessions: partial.length,
    skippedSessions: skipped.length,
    adherencePercentage: plannedSessions ? Math.round((completed.length / plannedSessions) * 100) : 0,
    averageSessionsPerWeek: Math.round((attended.length / elapsedWeeks) * 10) / 10,
    averageSessionDuration: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
    longestInactivityPeriod,
    totalSetsCompleted: monthItems.flatMap((item) => item.exerciseRecords || []).reduce((sum, item) => sum + item.setsCompleted, 0),
    trainingVolume: Math.round(monthItems.reduce((sum, item) => sum + (item.totalVolumeKg || 0), 0)),
  };
}

export function evaluatePhase(history: TrainingHistoryLike[], adherence: AdherenceSummary, requiredSessions = 12): PhaseDecision {
  const completed = history.filter((item) => effectiveStatus(item) === "completed");
  const phaseNumber = Math.floor(completed.length / requiredSessions) + 1;
  const completedInPhase = completed.length % requiredSessions;
  const window = completed.slice(0, requiredSessions);
  const recurringPain = window.filter((item) => (item.painScore || 0) >= 4).length >= 2;
  const poorRecovery = window.filter((item) => ["Piorou", "Muito cansada"].includes(item.recovery24h || "")).length > Math.max(1, window.length / 3);
  const lowCompletion = window.filter((item) => (item.completedExercises || 0) / Math.max(1, item.totalExercises || 1) < 0.7).length > Math.max(1, window.length / 3);
  if (window.length < requiredSessions) return { phaseNumber, completedInPhase, requiredSessions, action: "maintain", reason: `Mantivemos a fase: ${requiredSessions - window.length} sessões concluídas ainda são necessárias para consolidar o bloco.` };
  if (adherence.adherencePercentage < 60 || recurringPain || poorRecovery || lowCompletion) return { phaseNumber: Math.max(1, phaseNumber - 1), completedInPhase: requiredSessions, requiredSessions, action: "repeat", reason: recurringPain ? "Repetiremos a fase porque houve dor moderada ou forte de forma recorrente." : poorRecovery ? "Repetiremos a fase porque a recuperação recente ainda não está adequada." : lowCompletion ? "Repetiremos a fase porque muitos exercícios principais não foram concluídos." : "Repetiremos a fase para recuperar regularidade antes de aumentar a complexidade." };
  return { phaseNumber, completedInPhase: 0, requiredSessions, action: "advance", reason: "A fase pode avançar porque as sessões, a frequência, a recuperação e a execução atingiram os critérios mínimos." };
}

export function getReturnAdaptation(history: TrainingHistoryLike[], now: Date): ReturnAdaptation {
  const last = history.find((item) => ["completed", "partial"].includes(effectiveStatus(item)));
  const inactivityDays = last ? daysBetween(new Date(last.completedAt), now) : 0;
  if (inactivityDays > 14) return { inactivityDays, level: "return", setMultiplier: 0.5, loadMultiplier: 0.7, allowAdvancedProtocols: false, explanation: `Como você ficou ${inactivityDays} dias sem treinar, esta será uma sessão de retorno com reavaliação, menos séries e esforço controlado.` };
  if (inactivityDays >= 8) return { inactivityDays, level: "reduce", setMultiplier: 0.7, loadMultiplier: 0.8, allowAdvancedProtocols: false, explanation: `Reduzimos volume e intensidade porque já se passaram ${inactivityDays} dias desde a última sessão.` };
  if (inactivityDays > 0) return { inactivityDays, level: "maintain", setMultiplier: 1, loadMultiplier: 0.95, allowAdvancedProtocols: true, explanation: `Mantivemos a sequência; após ${inactivityDays} dias, comece com uma carga ligeiramente menor se necessário.` };
  return { inactivityDays: 0, level: "none", setMultiplier: 1, loadMultiplier: 1, allowAdvancedProtocols: true, explanation: "Mantivemos a prescrição porque sua sequência está atualizada." };
}

export function suggestDoubleProgression(options: { repetitionsBySet: number[]; upperRepetitionLimit: number; setsPlanned: number; sessionRpe: number; painScore: number; executionAdequate: boolean; matchingLoadConfirmations: number }): { action: "increase" | "maintain"; reason: string } {
  const reachedTop = options.repetitionsBySet.length >= options.setsPlanned && options.repetitionsBySet.slice(0, options.setsPlanned).every((value) => value >= options.upperRepetitionLimit);
  if (reachedTop && options.sessionRpe <= 8 && options.painScore < 4 && options.executionAdequate && options.matchingLoadConfirmations >= 2) return { action: "increase", reason: "Todas as séries atingiram o topo da faixa com esforço, execução e dor dentro dos critérios. Sugerimos o menor aumento de carga disponível." };
  return { action: "maintain", reason: reachedTop ? "Mantivemos a carga porque esforço, execução, dor ou confirmações ainda não atingiram todos os critérios." : "Mantenha a carga e aumente as repetições gradualmente até alcançar o topo da faixa em todas as séries." };
}

export function eligibleProtocols(options: { experience: string; recovery: string; adherencePercentage: number; painScore: number; inactivityDays: number; sessionsThisWeek: number }): TrainingProtocol[] {
  const rank = LEVEL_RANK[options.experience as keyof typeof LEVEL_RANK] || 1;
  return TRAINING_PROTOCOLS.filter((protocol) => rank >= LEVEL_RANK[protocol.minimumLevel]
    && (protocol.requiredRecoveryStatus === "Média" ? ["Média", "Alta"].includes(options.recovery) : options.recovery === "Alta")
    && options.adherencePercentage >= 70
    && options.painScore < 4
    && options.inactivityDays <= protocol.inactivityRestrictionDays
    && options.sessionsThisWeek < protocol.maxFrequencyPerWeek);
}
