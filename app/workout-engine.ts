import { Exercise, exercises } from "./workout-data";

export type ProfileForGeneration = {
  goal: string;
  experience: string;
  days: string[];
  duration: string;
  location: string;
  limitations: string;
  specialConditions?: string[];
  medicalClearance?: boolean;
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

function prescribe(exercise: Exercise, profile: ProfileForGeneration, codes: string[], section: "warmup" | "main" | "cooldown"): GeneratedExercise {
  if (section === "warmup") return { exercise, sets: 1, reps: "4–6 min", rest: 0, tempo: "leve", loadSuggestion: "Sem carga", targetRpe: "RPE 3–4", note: "Prepare o corpo sem fadigar." };
  if (section === "cooldown") return { exercise, sets: 1, reps: "45–60 s", rest: 0, tempo: "confortável", loadSuggestion: "Sem carga", targetRpe: "RPE 2–3", note: "Sem forçar amplitude." };
  const base = scheme(profile);
  const conservative = codes.some((code) => ["postpartum", "cesarean", "hypertension", "cardiovascular", "back", "knee", "shoulder"].includes(code));
  return {
    exercise,
    sets: conservative ? Math.min(base.sets, 2) : base.sets,
    reps: exercise.movement === "core" && exercise.tags.includes("isometria") ? "15–25 s" : base.reps,
    rest: conservative ? Math.max(base.rest, 75) : base.rest,
    tempo: base.tempo,
    loadSuggestion: exercise.equipment === "Nenhum" || exercise.equipment.includes("Parede") || exercise.equipment.includes("Colchonete") ? "Peso corporal" : "Carga que preserve 3 repetições em reserva",
    targetRpe: conservative ? "RPE 5–6" : base.rpe,
    note: conservative ? "Pare ao primeiro sinal de piora dos sintomas." : "A última repetição deve permanecer tecnicamente limpa.",
  };
}

export function generateProgram(profile: ProfileForGeneration): GeneratedProgram {
  const codes = detectSafetyCodes(profile);
  const clearanceRequired = codes.includes("red_flag") || codes.includes("pregnancy") || ((codes.includes("postpartum") || codes.includes("cesarean") || codes.includes("cardiovascular")) && !profile.medicalClearance);
  const notices = safetyNotices(codes);
  if (clearanceRequired) {
    return {
      databaseVersion: "2.0",
      status: "clearance_required",
      title: "Liberação necessária",
      summary: "O BrasaFit não gera treino automático quando há uma condição que precisa de avaliação individual.",
      split: "Pausado por segurança",
      workouts: [],
      safetyCodes: codes,
      notices: ["Procure liberação de profissional habilitado antes de iniciar.", ...notices],
    };
  }

  const avoidCodes = safetyAvoidCodes(codes);
  const lowImpact = codes.some((code) => ["postpartum", "cesarean", "pregnancy", "knee", "back", "balance", "low_impact", "cardiovascular"].includes(code));
  const allowed = exercises.filter((exercise) => isAllowed(exercise, profile, avoidCodes, lowImpact));
  const minutes = Number.parseInt(profile.duration, 10) || 45;
  const mainCount = minutes <= 30 ? 4 : minutes <= 45 ? 6 : minutes <= 60 ? 7 : 8;
  const templates = workoutTemplates(Math.max(1, profile.days.length));
  const workouts = templates.map((template, templateIndex) => {
    const selected = new Set<string>();
    const main: GeneratedExercise[] = [];
    const movements = focusMovements[template.focus] || focusMovements.full;
    for (let index = 0; index < mainCount; index += 1) {
      const movement = movements[index % movements.length];
      const candidates = allowed.filter((exercise) => exercise.movement === movement && !selected.has(exercise.id));
      const exercise = candidates[(templateIndex + index) % Math.max(candidates.length, 1)] || allowed.find((item) => !selected.has(item.id) && !["warmup", "cooldown", "mobility"].includes(item.movement));
      if (!exercise) continue;
      selected.add(exercise.id);
      main.push(prescribe(exercise, profile, codes, "main"));
    }
    const warmupExercise = allowed.find((exercise) => exercise.movement === "warmup") || exercises[0];
    const cooldownExercise = allowed.find((exercise) => exercise.movement === "cooldown") || exercises.find((exercise) => exercise.id === "breathing_reset")!;
    return {
      id: `generated-${templateIndex + 1}`,
      name: template.name,
      focus: profile.goal,
      estimatedMinutes: minutes,
      warmup: [prescribe(warmupExercise, profile, codes, "warmup")],
      main,
      cooldown: [prescribe(cooldownExercise, profile, codes, "cooldown")],
      notices,
    };
  });

  return {
    databaseVersion: "2.0",
    status: "ready",
    title: `${profile.goal} · ciclo inicial`,
    summary: `${profile.experience}, ${profile.days.length}x por semana, sessões de ${profile.duration.toLowerCase()}.`,
    split: templates.map((item) => item.name.replace(/^[A-E] — /, "")).join(" · "),
    workouts,
    safetyCodes: codes,
    notices,
  };
}
