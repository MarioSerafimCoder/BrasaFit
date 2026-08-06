import { Exercise, exerciseById, exercises } from "./workout-data";
import { POSTPARTUM_BLOCKS, PostpartumPrescription } from "./postpartum-program";
import { calculateAdherence, evaluatePhase, recommendedWorkoutIndex, type TrainingHistoryLike } from "./training-intelligence";

export type ProfileForGeneration = {
  goal: string;
  experience: string;
  days: string[];
  duration: string;
  location: string;
  limitations: string;
  specialConditions?: string[];
  medicalClearance?: boolean;
  createdAt?: string;
  secondaryGoals?: string[];
  monthsConsistent?: number;
  monthsSinceTraining?: number;
  averageSleepHours?: number;
  stressLevel?: string;
  recoveryFeeling?: string;
  availableEquipment?: string[];
  preferredExercises?: string;
  rejectedExercises?: string;
  deliveryDate?: string;
  deliveryType?: string;
  incisionHealed?: boolean;
  postpartumSymptoms?: string[];
};

export type GenerationContext = {
  history?: TrainingHistoryLike[];
  now?: Date;
};

export type GeneratedExercise = {
  exercise: Exercise;
  sets: number;
  reps: string;
  rest: number;
  tempo: string;
  loadSuggestion: string;
  targetRpe: string;
  note: string;
};

export type GeneratedWorkout = {
  id: string;
  name: string;
  focus: string;
  estimatedMinutes: number;
  warmup: GeneratedExercise[];
  main: GeneratedExercise[];
  cooldown: GeneratedExercise[];
  notices: string[];
};

export type GeneratedProgram = {
  databaseVersion: string;
  status: "ready" | "clearance_required";
  title: string;
  summary: string;
  split: string;
  workouts: GeneratedWorkout[];
  safetyCodes: string[];
  notices: string[];
  cycleNumber: number;
  validFrom: string;
  validUntil: string;
  daysRemaining: number;
  todayWorkoutIndex: number;
  progressionNote: string;
  effectiveExperience: string;
  recoveryClass: string;
  effectiveDays: number;
  specialPhase?: string;
  phaseCompletedSessions?: number;
  phaseRequiredSessions?: number;
  recommendationReason?: string;
};

export const specialConditionOptions = [
  { id: "postpartum", label: "Pós-parto" },
  { id: "cesarean", label: "Pós-cesárea" },
  { id: "pregnancy", label: "Gestação" },
  { id: "knee", label: "Dor no joelho" },
  { id: "back", label: "Dor lombar" },
  { id: "shoulder", label: "Dor no ombro" },
  { id: "hypertension", label: "Hipertensão" },
  { id: "cardiovascular", label: "Condição cardíaca" },
  { id: "diabetes", label: "Diabetes" },
  { id: "balance", label: "Equilíbrio reduzido" },
  { id: "low_impact", label: "Somente baixo impacto" },
];

const patterns: Array<[string, RegExp]> = [
  ["postpartum", /p[oó]s[- ]?parto|puerp[eé]rio/i],
  ["cesarean", /ces[aá]rea|cesariana|cicatriz abdominal/i],
  ["pregnancy", /gesta(?:nte|ç[aã]o)|gr[aá]vida/i],
  ["knee", /joelho|patela|menisco/i],
  ["back", /lombar|coluna|h[eé]rnia de disco|ci[aá]tica/i],
  ["shoulder", /ombro|manguito|bursite/i],
  ["hypertension", /hipertens|press[aã]o alta/i],
  ["cardiovascular", /card[ií]ac|cardiovascular|arritmia/i],
  ["diabetes", /diabet|hipoglicemia/i],
  ["balance", /equil[ií]brio|tontura/i],
  ["low_impact", /baixo impacto|sem impacto/i],
  ["wrist", /punho|m[aã]o/i],
  ["ankle", /tornozelo/i],
  ["elbow", /cotovelo/i],
  ["abdominal_symptoms", /di[aá]stase|press[aã]o p[eé]lvica|escape urin[aá]rio|dor abdominal/i],
];

const redFlagPattern = /dor no peito|desmaio|falta de ar (?:em repouso|intensa)|sangramento aumentado|febre|press[aã]o (?:descontrolada|muito alta)|cirurgia recente|p[oó]s[- ]?operat[oó]rio recente/i;

function unique<T>(items: T[]) { return [...new Set(items)]; }

export function detectSafetyCodes(profile: ProfileForGeneration) {
  const text = profile.limitations || "";
  const codes = [...(profile.specialConditions || [])];
  for (const [code, pattern] of patterns) if (pattern.test(text)) codes.push(code);
  if (redFlagPattern.test(text)) codes.push("red_flag");
  return unique(codes);
}

function safetyAvoidCodes(codes: string[]) {
  const avoid: string[] = [];
  if (codes.includes("postpartum") || codes.includes("cesarean")) avoid.push("postpartum", "abdominal_symptoms");
  if (codes.includes("pregnancy")) avoid.push("pregnancy", "postpartum", "abdominal_symptoms");
  if (codes.includes("knee")) avoid.push("knee_acute");
  if (codes.includes("back")) avoid.push("back_acute");
  if (codes.includes("shoulder")) avoid.push("shoulder_acute");
  if (codes.includes("hypertension")) avoid.push("hypertension");
  if (codes.includes("cardiovascular")) avoid.push("cardiovascular");
  if (codes.includes("balance")) avoid.push("balance_issue");
  if (codes.includes("wrist")) avoid.push("wrist_acute");
  if (codes.includes("ankle")) avoid.push("ankle_acute");
  if (codes.includes("elbow")) avoid.push("elbow_acute");
  if (codes.includes("abdominal_symptoms")) avoid.push("abdominal_symptoms");
  return unique(avoid);
}

function safetyNotices(codes: string[]) {
  const notices: string[] = [];
  if (codes.includes("postpartum") || codes.includes("cesarean")) notices.push("Interrompa se houver dor abdominal, pressão pélvica, escape urinário, sangramento aumentado ou desconforto na cicatriz.");
  if (codes.includes("knee")) notices.push("Use amplitude sem dor e interrompa se o joelho piorar durante ou após o exercício.");
  if (codes.includes("back")) notices.push("Mantenha carga leve e coluna confortável; dor irradiada, formigamento ou perda de força exigem avaliação.");
  if (codes.includes("shoulder")) notices.push("Evite amplitude dolorosa e movimentos acima da cabeça enquanto houver sintomas.");
  if (codes.includes("hypertension")) notices.push("Respire continuamente, não faça manobra de Valsalva e mantenha esforço moderado.");
  if (codes.includes("diabetes")) notices.push("Tenha fonte de carboidrato disponível e siga a orientação pessoal de monitoramento da glicose.");
  if (codes.includes("balance")) notices.push("Faça exercícios perto de apoio estável e evite mudanças rápidas de direção.");
  if (codes.includes("low_impact")) notices.push("A sessão foi limitada a opções de baixo impacto.");
  return notices;
}

function scheme(profile: ProfileForGeneration) {
  const beginner = profile.experience === "Iniciante" || profile.goal === "Retorno aos treinos";
  if (profile.goal === "Força") return { sets: beginner ? 3 : 4, reps: beginner ? "6–8" : "4–6", rest: beginner ? 90 : 150, tempo: "2–1–2", rpe: beginner ? "RPE 6" : "RPE 7" };
  if (profile.goal === "Condicionamento") return { sets: beginner ? 2 : 3, reps: "10–15", rest: beginner ? 60 : 45, tempo: "controlado", rpe: beginner ? "RPE 5–6" : "RPE 7" };
  if (profile.goal === "Mobilidade") return { sets: 2, reps: "6–10 lentas", rest: 40, tempo: "3–2–3", rpe: "RPE 4–5" };
  if (profile.goal === "Retorno aos treinos") return { sets: 2, reps: "8–12", rest: 75, tempo: "3–1–2", rpe: "RPE 5–6" };
  return { sets: beginner ? 2 : 3, reps: "8–12", rest: beginner ? 75 : 90, tempo: "3–1–2", rpe: beginner ? "RPE 6" : "RPE 7–8" };
}

function workoutTemplates(days: number) {
  if (days <= 1) return [{ name: "A — Corpo inteiro", focus: "full" }];
  if (days === 2) return [{ name: "A — Corpo inteiro", focus: "full" }, { name: "B — Corpo inteiro", focus: "full" }];
  if (days === 3) return [{ name: "A — Superiores", focus: "upper" }, { name: "B — Inferiores e core", focus: "lower" }, { name: "C — Corpo inteiro", focus: "full" }];
  if (days === 4) return [{ name: "A — Superiores", focus: "upper" }, { name: "B — Inferiores", focus: "lower" }, { name: "C — Superiores", focus: "upper" }, { name: "D — Inferiores e core", focus: "lower" }];
  return [{ name: "A — Empurrar", focus: "push" }, { name: "B — Puxar", focus: "pull" }, { name: "C — Inferiores", focus: "lower" }, { name: "D — Superiores", focus: "upper" }, { name: "E — Corpo inteiro", focus: "full" }];
}

const focusMovements: Record<string, Exercise["movement"][]> = {
  full: ["squat", "horizontal_push", "horizontal_pull", "hinge", "glute", "core", "cardio", "arms"],
  upper: ["horizontal_push", "horizontal_pull", "vertical_pull", "vertical_push", "arms", "core"],
  lower: ["squat", "hinge", "glute", "squat", "core", "cardio"],
  push: ["horizontal_push", "vertical_push", "squat", "arms", "core", "cardio"],
  pull: ["horizontal_pull", "vertical_pull", "hinge", "arms", "core", "cardio"],
};

function isAllowed(exercise: Exercise, profile: ProfileForGeneration, avoidCodes: string[], lowImpact: boolean) {
  if (profile.location === "Em casa" && !exercise.locations.includes("Em casa")) return false;
  if (profile.location === "Academia" && !exercise.locations.includes("Academia")) return false;
  if (profile.experience === "Iniciante" && exercise.level === "Avançado") return false;
  if (lowImpact && exercise.impact !== "baixo") return false;
  return !exercise.avoidWhen.some((code) => avoidCodes.includes(code));
}

function prescribe(exercise: Exercise, profile: ProfileForGeneration, codes: string[], section: "warmup" | "main" | "cooldown", setAdjustment = 0, progressionInstruction = ""): GeneratedExercise {
  if (section === "warmup") return { exercise, sets: 1, reps: "4–6 min", rest: 0, tempo: "leve", loadSuggestion: "Sem carga", targetRpe: "RPE 3–4", note: "Prepare o corpo sem fadigar." };
  if (section === "cooldown") return { exercise, sets: 1, reps: "45–60 s", rest: 0, tempo: "confortável", loadSuggestion: "Sem carga", targetRpe: "RPE 2–3", note: "Sem forçar amplitude." };
  const base = scheme(profile);
  const conservative = codes.some((code) => ["postpartum", "cesarean", "hypertension", "cardiovascular", "back", "knee", "shoulder"].includes(code));
  return {
    exercise,
    sets: Math.max(1, conservative ? Math.min(base.sets, 2) : Math.min(5, base.sets + setAdjustment)),
    reps: exercise.movement === "core" && exercise.tags.includes("isometria") ? "15–25 s" : base.reps,
    rest: conservative ? Math.max(base.rest, 75) : base.rest,
    tempo: base.tempo,
    loadSuggestion: exercise.equipment === "Nenhum" || exercise.equipment.includes("Parede") || exercise.equipment.includes("Colchonete") ? "Peso corporal" : "Carga que preserve 3 repetições em reserva",
    targetRpe: conservative ? "RPE 5–6" : base.rpe,
    note: `${conservative ? "Pare ao primeiro sinal de piora dos sintomas." : "A última repetição deve permanecer tecnicamente limpa."}${progressionInstruction ? ` ${progressionInstruction}` : ""}`,
  };
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function equipmentStyle(exercise: Exercise) {
  if (exercise.tags.includes("maquina")) return "machine";
  if (exercise.tags.includes("cabo")) return "cable";
  if (exercise.tags.includes("peso-livre") || /Halter|Barra|anilhas/i.test(exercise.equipment)) return "free";
  return "conventional";
}

function classifyExperience(profile: ProfileForGeneration, codes: string[]) {
  if (codes.some((code) => ["postpartum", "cesarean"].includes(code))) return "Iniciante";
  if ((profile.monthsSinceTraining || 0) >= 6 || (profile.monthsConsistent !== undefined && profile.monthsConsistent < 6)) return "Iniciante";
  if (profile.experience === "Avançado" && (profile.monthsConsistent || 0) < 24) return "Intermediário";
  return profile.experience || "Iniciante";
}

function classifyRecovery(profile: ProfileForGeneration, codes: string[], history: GenerationContext["history"] = []) {
  const lowSignals = [
    (profile.averageSleepHours || 8) < 6,
    profile.stressLevel === "Alto",
    profile.recoveryFeeling === "Ruim",
    codes.some((code) => ["postpartum", "cesarean", "back", "knee"].includes(code)),
    history.slice(0, 3).some((item) => (item.painScore || 0) >= 4 || item.recovery24h === "Piorou"),
  ].filter(Boolean).length;
  if (lowSignals >= 2) return "Baixa";
  if ((profile.averageSleepHours || 0) >= 7 && profile.stressLevel === "Baixo" && profile.recoveryFeeling === "Boa") return "Alta";
  return "Média";
}

function effectiveFrequency(profile: ProfileForGeneration, experience: string, recovery: string) {
  const desired = Math.max(1, profile.days.length);
  const experienceLimit = experience === "Iniciante" ? 4 : experience === "Intermediário" ? 5 : 6;
  const recoveryLimit = recovery === "Baixa" ? 4 : recovery === "Média" ? 5 : 6;
  return Math.min(desired, experienceLimit, recoveryLimit);
}

function matchesAvailableEquipment(exercise: Exercise, selected: string[] = []) {
  if (!selected.length) return true;
  const equipment = `${exercise.equipment} ${exercise.tags.join(" ")}`.toLocaleLowerCase("pt-BR");
  if (/nenhum|parede|colchonete|banco|apoio|degrau/.test(equipment)) return true;
  if (/máquina|maquina|leg press|esteira|bicicleta|elíptico|remo ergômetro/.test(equipment)) return selected.includes("Máquinas");
  if (/polia|cabo/.test(equipment)) return selected.includes("Cabos");
  if (/halter|kettlebell/.test(equipment)) return selected.includes("Halteres");
  if (/barra|rack|landmine|anilhas/.test(equipment)) return selected.includes("Barra e anilhas");
  if (/elástico/.test(equipment)) return selected.includes("Elásticos");
  return true;
}

function reviewPreviousCycle(history: NonNullable<GenerationContext["history"]>, plannedSessions: number) {
  if (!history.length) return { action: "reference" as const, adherence: 0 };
  const completed = history.filter((item) => (item.completedExercises || 0) / Math.max(1, item.totalExercises || 0) >= 0.7);
  const adherence = completed.length / Math.max(1, plannedSessions);
  const symptomsWorsened = history.some((item) => (item.painScore || 0) >= 4 || (item.symptoms || []).length > 0 || item.recovery24h === "Piorou");
  const poorRecovery = history.some((item) => (item.sessionRpe || 0) >= 9 || item.recovery24h === "Muito cansada");
  if (symptomsWorsened) return { action: "regress" as const, adherence };
  if (adherence < 0.6 || poorRecovery) return { action: "simplify" as const, adherence };
  if (adherence < 0.8) return { action: "maintain" as const, adherence };
  return { action: "progress" as const, adherence };
}

function postpartumGeneratedExercise(item: PostpartumPrescription): GeneratedExercise | null {
  const exercise = exerciseById.get(item.exerciseId);
  if (!exercise) return null;
  return {
    exercise,
    sets: item.sets,
    reps: item.reps,
    rest: item.rest,
    tempo: "controlado",
    loadSuggestion: /Nenhum|Colchonete|Parede|apoio/i.test(exercise.equipment) ? "Peso corporal" : "Carga conservadora; ajustar pela primeira série",
    targetRpe: item.rpe,
    note: item.note,
  };
}

function safeDate(value: string | undefined) {
  if (!value) return null;
  const date = startOfLocalDay(new Date(`${value}T12:00:00`));
  return Number.isNaN(date.getTime()) ? null : date;
}

function postpartumProgram(profile: ProfileForGeneration, context: GenerationContext, codes: string[], now: Date, notices: string[]): GeneratedProgram | null {
  if (!codes.some((code) => ["postpartum", "cesarean"].includes(code))) return null;
  const delivery = safeDate(profile.deliveryDate);
  const severeSymptoms = (profile.postpartumSymptoms || []).some((item) => ["bleeding", "scar_pain", "pelvic_pressure", "pelvic_pain"].includes(item));
  const postpartumDays = delivery ? Math.max(0, Math.floor((now.getTime() - delivery.getTime()) / 86_400_000)) : 70;
  const postpartumWeeks = Math.floor(postpartumDays / 7);
  const blockIndex = Math.min(POSTPARTUM_BLOCKS.length - 1, Math.max(0, Math.floor((postpartumWeeks - 10) / 2)));
  const requestedBlock = POSTPARTUM_BLOCKS[blockIndex];
  const anchor = delivery || now;
  const priorBlockStart = new Date(anchor); priorBlockStart.setDate(priorBlockStart.getDate() + (delivery ? Math.max(10, 10 + (blockIndex - 1) * 2) * 7 : -14));
  const cycleStart = new Date(anchor); cycleStart.setDate(cycleStart.getDate() + (delivery && postpartumWeeks >= 10 ? (10 + blockIndex * 2) * 7 : 0));
  const cycleEnd = new Date(cycleStart); cycleEnd.setDate(cycleEnd.getDate() + 13);
  const priorHistory = (context.history || []).filter((item) => { const date = new Date(item.completedAt); return date >= priorBlockStart && date < cycleStart; });
  const review = reviewPreviousCycle(priorHistory, blockIndex > 0 ? POSTPARTUM_BLOCKS[blockIndex - 1].totalDays * 2 : requestedBlock.totalDays * 2);
  const block = POSTPARTUM_BLOCKS[blockIndex];
  const workouts = block.sessions.map((session, sessionIndex) => {
    const warmup = session.warmupIds.map((id) => exerciseById.get(id)).filter((item): item is Exercise => Boolean(item)).map((exercise) => ({ exercise, sets: 1, reps: exercise.movement === "warmup" ? "5 ciclos" : "5-7 min", rest: 0, tempo: "leve", loadSuggestion: "Sem carga", targetRpe: "RPE 2-3", note: "Preparar sem fadigar e observar sintomas." }));
    let main = session.main.map(postpartumGeneratedExercise).filter((item): item is GeneratedExercise => Boolean(item));
    if (review.action === "simplify") main = main.slice(0, Math.max(4, main.length - 2)).map((item) => ({ ...item, sets: Math.max(1, item.sets - 1), targetRpe: "RPE 4-5" }));
    const cooldown = ["breathing_reset", session.kind === "strength" ? "hip_flexor_stretch" : "thoracic_rotation"].map((id) => exerciseById.get(id)).filter((item): item is Exercise => Boolean(item)).map((exercise) => ({ exercise, sets: 1, reps: exercise.movement === "cooldown" ? "45-60 s" : "5 ciclos", rest: 0, tempo: "confortável", loadSuggestion: "Sem carga", targetRpe: "RPE 2", note: "Encerrar relaxada e sem piora de sintomas." }));
    return { id: `postpartum-${block.block}-${sessionIndex + 1}`, name: session.name, focus: session.focus, estimatedMinutes: session.minutes, warmup, main, cooldown, notices };
  });
  const trainingDay = Math.max(0, Math.floor((now.getTime() - cycleStart.getTime()) / 86_400_000));
  const daysRemaining = Math.max(1, Math.floor((cycleEnd.getTime() - now.getTime()) / 86_400_000) + 1);
  const progressionNote = review.action === "simplify" ? "O volume foi reduzido para recuperar aderência; liberação e sintomas registrados não bloqueiam a próxima sessão." : review.action === "progress" ? block.secondWeekRule : block.objective;
  const informationalNotices = [
    !delivery ? "Data do parto não informada: o bloco inicial permanece disponível e pode ser ajustado no perfil." : "",
    !profile.medicalClearance ? "Liberação profissional não marcada: informação registrada sem bloquear o programa." : "",
    !profile.incisionHealed ? "Situação da cicatriz não confirmada: informação registrada sem bloquear os treinos." : "",
    severeSymptoms ? "Há sintomas importantes registrados. O treino continua acessível; considere reduzir o esforço e buscar avaliação profissional." : "",
  ].filter(Boolean);
  return {
    databaseVersion: "4.1", status: "ready", title: `Pós-cesárea · bloco ${block.block}`, summary: `${delivery ? `Semana ${postpartumWeeks}` : "Bloco inicial"} pós-parto · ciclo de 14 dias, no máximo ${block.strengthDays} dias de força por semana.`, split: block.sessions.map((session) => session.name).join(" · "), workouts, safetyCodes: codes,
    notices: [...informationalNotices, ...notices, "Liberação e sintomas podem ser atualizados a qualquer momento e não bloqueiam o acesso ao treino."], cycleNumber: block.block, validFrom: toDateKey(cycleStart), validUntil: toDateKey(cycleEnd), daysRemaining, todayWorkoutIndex: recommendedWorkoutIndex(context.history || [], workouts.length),
    progressionNote, effectiveExperience: "Iniciante", recoveryClass: "Baixa", effectiveDays: block.totalDays, specialPhase: `${delivery ? `Semana ${postpartumWeeks}` : "Fase inicial"} pós-parto · ${block.rpe}`,
    recommendationReason: "O próximo treino segue a ordem das sessões concluídas, mesmo quando um dia planejado é perdido.",
  };
}

export function generateProgram(profile: ProfileForGeneration, context: GenerationContext = {}): GeneratedProgram {
  const now = startOfLocalDay(context.now || new Date());
  const created = profile.createdAt ? startOfLocalDay(new Date(profile.createdAt)) : now;
  const anchor = Number.isNaN(created.getTime()) || created > now ? now : created;
  const elapsedDays = Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / 86_400_000));
  const cycleIndex = Math.floor(elapsedDays / 14);
  const cycleStart = new Date(anchor);
  cycleStart.setDate(cycleStart.getDate() + cycleIndex * 14);
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setDate(cycleEnd.getDate() + 13);
  const daysRemaining = Math.max(1, Math.floor((cycleEnd.getTime() - now.getTime()) / 86_400_000) + 1);
  const codes = detectSafetyCodes(profile);
  const effectiveExperience = classifyExperience(profile, codes);
  const recoveryClass = classifyRecovery(profile, codes, context.history);
  const effectiveDays = effectiveFrequency(profile, effectiveExperience, recoveryClass);
  const adherence = calculateAdherence(context.history || [], now, profile.days);
  const phaseDecision = evaluatePhase(context.history || [], adherence);
  const effectiveProfile = { ...profile, experience: effectiveExperience };
  const clearanceRequired = codes.includes("red_flag") || codes.includes("pregnancy") || ((codes.includes("postpartum") || codes.includes("cesarean") || codes.includes("cardiovascular")) && !profile.medicalClearance);
  const notices = safetyNotices(codes);
  const specialProgram = postpartumProgram(profile, context, codes, now, notices);
  if (specialProgram) return specialProgram;
  const priorCycleStart = new Date(cycleStart); priorCycleStart.setDate(priorCycleStart.getDate() - 14);
  const recentPrior = (context.history || []).filter((item) => { const date = new Date(item.completedAt); return date >= priorCycleStart && date < cycleStart; });
  const review = reviewPreviousCycle(recentPrior, effectiveDays * 2);
  const setAdjustment = recoveryClass === "Baixa" || ["simplify", "regress"].includes(review.action) ? -1 : 0;
  const progressionInstruction = review.action === "progress" ? "Se alcançou o topo da faixa em duas sessões com RIR adequado, aumente a menor carga disponível." : "";
  if (clearanceRequired) {
    return {
      databaseVersion: "4.0",
      status: "clearance_required",
      title: "Liberação necessária",
      summary: "O Angels Fit não gera treino automático quando há uma condição que precisa de avaliação individual.",
      split: "Pausado por segurança",
      workouts: [],
      safetyCodes: codes,
      notices: ["Procure liberação de profissional habilitado antes de iniciar.", ...notices],
      cycleNumber: cycleIndex + 1,
      validFrom: toDateKey(cycleStart),
      validUntil: toDateKey(cycleEnd),
      daysRemaining,
      todayWorkoutIndex: 0,
      progressionNote: "O ciclo será definido após a liberação profissional.",
      effectiveExperience,
      recoveryClass,
      effectiveDays: 0,
    };
  }

  const avoidCodes = safetyAvoidCodes(codes);
  const lowImpact = codes.some((code) => ["postpartum", "cesarean", "pregnancy", "knee", "back", "balance", "low_impact", "cardiovascular"].includes(code));
  const rejectedTerms = (profile.rejectedExercises || "").toLocaleLowerCase("pt-BR").split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  const preferredTerms = (profile.preferredExercises || "").toLocaleLowerCase("pt-BR").split(/[,;\n]/).map((item) => item.trim()).filter(Boolean);
  const allowed = exercises.filter((exercise) => isAllowed(exercise, effectiveProfile, avoidCodes, lowImpact) && matchesAvailableEquipment(exercise, profile.availableEquipment) && !rejectedTerms.some((term) => exercise.name.toLocaleLowerCase("pt-BR").includes(term)));
  const minutes = Number.parseInt(profile.duration, 10) || 45;
  const mainCount = minutes <= 30 ? 4 : minutes <= 45 ? 6 : minutes <= 60 ? 7 : 8;
  const templates = workoutTemplates(effectiveDays);
  const movementCycle = Math.max(0, phaseDecision.phaseNumber - 1);
  const workouts = templates.map((template, templateIndex) => {
    const selected = new Set<string>();
    const main: GeneratedExercise[] = [];
    const movements = focusMovements[template.focus] || focusMovements.full;
    for (let index = 0; index < mainCount; index += 1) {
      const movement = movements[index % movements.length];
      const candidates = allowed.filter((exercise) => exercise.movement === movement && !selected.has(exercise.id));
      const styleOrder = ["machine", "free", "cable", "conventional"];
      const preferredStyle = styleOrder[(index + templateIndex + movementCycle) % styleOrder.length];
      const styled = candidates.filter((exercise) => equipmentStyle(exercise) === preferredStyle);
      const pool = styled.length ? styled : candidates;
      const ranked = [...pool].sort((a, b) => Number(preferredTerms.some((term) => b.name.toLocaleLowerCase("pt-BR").includes(term))) - Number(preferredTerms.some((term) => a.name.toLocaleLowerCase("pt-BR").includes(term))));
      const exercise = ranked[(movementCycle + templateIndex + index) % Math.max(ranked.length, 1)] || allowed.find((item) => !selected.has(item.id) && !["warmup", "cooldown", "mobility"].includes(item.movement));
      if (!exercise) continue;
      selected.add(exercise.id);
      main.push(prescribe(exercise, effectiveProfile, codes, "main", setAdjustment, progressionInstruction));
    }
    const warmupCandidates = allowed.filter((exercise) => exercise.movement === "warmup" || exercise.movement === "mobility");
    const cooldownCandidates = allowed.filter((exercise) => exercise.movement === "cooldown");
    const warmup = Array.from({ length: Math.min(2, warmupCandidates.length) }, (_, index) => warmupCandidates[(movementCycle + templateIndex + index) % warmupCandidates.length]).map((exercise) => prescribe(exercise, effectiveProfile, codes, "warmup"));
    const cooldown = Array.from({ length: Math.min(2, cooldownCandidates.length) }, (_, index) => cooldownCandidates[(movementCycle + templateIndex + index) % cooldownCandidates.length]).map((exercise) => prescribe(exercise, effectiveProfile, codes, "cooldown"));
    return {
      id: `phase-${phaseDecision.phaseNumber}-${templateIndex + 1}`,
      name: template.name,
      focus: profile.goal,
      estimatedMinutes: minutes,
      warmup: warmup.length ? warmup : [prescribe(exercises[0], effectiveProfile, codes, "warmup")],
      main,
      cooldown: cooldown.length ? cooldown : [prescribe(exercises.find((exercise) => exercise.id === "breathing_reset")!, effectiveProfile, codes, "cooldown")],
      notices,
    };
  });

  const todayWorkoutIndex = recommendedWorkoutIndex(context.history || [], workouts.length);
  const progressionNote = phaseDecision.reason;

  return {
    databaseVersion: "4.0",
    status: "ready",
    title: `${profile.goal} · fase ${phaseDecision.phaseNumber}`,
    summary: `${effectiveExperience}, ${effectiveDays}x por semana, recuperação ${recoveryClass.toLowerCase()}, sessões de ${profile.duration.toLowerCase()}.`,
    split: templates.map((item) => item.name.replace(/^[A-E] — /, "")).join(" · "),
    workouts,
    safetyCodes: codes,
    notices,
    cycleNumber: phaseDecision.phaseNumber,
    validFrom: toDateKey(cycleStart),
    validUntil: toDateKey(cycleEnd),
    daysRemaining,
    todayWorkoutIndex,
    progressionNote,
    effectiveExperience,
    recoveryClass,
    effectiveDays,
    phaseCompletedSessions: phaseDecision.completedInPhase,
    phaseRequiredSessions: phaseDecision.requiredSessions,
    recommendationReason: "Esta recomendação usa a ordem das sessões concluídas; dias perdidos não pulam treinos.",
  };
}
