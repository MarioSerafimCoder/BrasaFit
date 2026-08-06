"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { exercises, EXERCISE_DATABASE_VERSION } from "./workout-data";
import { exerciseMedia } from "./exercise-media.generated";
import { exerciseMediaQueries } from "./exercise-media-queries";
import { GeneratedProgram, GeneratedWorkout, generateProgram, specialConditionOptions } from "./workout-engine";
import { BodyMeasurement, bmiCategory, calculateAge, calculateBmi, epleyEstimatedOneRepMax, estimateRestingEnergy, formatMetric, linearProjection, waistRatioCategory, waistToHeightRatio } from "./performance-metrics";
import { getBrowserDataRepository } from "./data-repository";
import { ActiveWorkoutSession, addRestSeconds, beginActiveSession, effectiveSets, enterFeedback, getElapsedSeconds, getRestRemainingSeconds, normalizeActiveWorkoutSession, patchActiveSession, pauseRest, resumeRest, sessionReadiness, skipRest, startRest, createActiveWorkoutSession, summarizeActiveSession } from "./active-session";
import { APP_VERSION, CONTENT_VERSION, CURRENT_DATA_SCHEMA_VERSION, LAST_UPDATE_CHECK_KEY, MINIMUM_SUPPORTED_APP_VERSION, compareVersions, runDataMigrations, validateVersionMetadata } from "./versioning";
import { configureNativeChrome, getInstalledAppVersion, hapticImpact, isNativeApp, openExternal, registerNativeBackButton } from "./native-platform";
import { applyReturnAdaptation, buildCalendarSchedule, calculateAdherence, completedSequenceCount, eligibleProtocols, getReturnAdaptation, recommendedWorkoutIndex, toLocalDateKey, type ExercisePerformanceRecord, type TrainingHistoryLike, type TrainingSessionStatus } from "./training-intelligence";

type AppTab = "today" | "program" | "exercises" | "progress" | "profile";

type Profile = {
  id: "mario";
  name: string;
  photo: string;
  goal: string;
  experience: string;
  days: string[];
  duration: string;
  location: string;
  limitations: string;
  specialConditions?: string[];
  medicalClearance?: boolean;
  birthDate?: string;
  biologicalSex?: string;
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  restingHeartRate?: number;
  activityLevel?: string;
  currentWeeklySessions?: number;
  weeklyActivityMinutes?: number;
  createdAt: string;
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

type WorkoutHistory = TrainingHistoryLike & {
  durationMinutes: number;
  completedExercises: number;
  totalExercises: number;
  totalVolumeKg?: number;
  estimatedOneRepMax?: number;
  cardioMinutes?: number;
  cardioIntensity?: string;
  sessionRpe?: number;
  averageRir?: number;
  painScore?: number;
  symptoms?: string[];
  recovery24h?: string;
  status?: TrainingSessionStatus;
};

type CheckIn = {
  id: string;
  checkedAt: string;
};

const THEME_KEY = "fitlocal.theme.v1";
const PREFERENCES_KEY = "angelsfit.preferences.v1";

type AppPreferences = {
  sound: boolean;
  vibration: boolean;
  keepAwake: boolean;
};

type UpdateStatus = "idle" | "checking" | "current" | "available" | "offline" | "error" | "native-required";

const defaultPreferences: AppPreferences = { sound: false, vibration: true, keepAwake: true };

const initialProfile: Profile = {
  id: "mario",
  name: "Mário",
  photo: "",
  goal: "",
  experience: "",
  days: [],
  duration: "",
  location: "",
  limitations: "",
  specialConditions: [],
  medicalClearance: false,
  birthDate: "",
  biologicalSex: "",
  heightCm: undefined,
  weightKg: undefined,
  waistCm: undefined,
  restingHeartRate: undefined,
  activityLevel: "",
  currentWeeklySessions: 0,
  weeklyActivityMinutes: 0,
  createdAt: "",
  secondaryGoals: [],
  monthsConsistent: 0,
  monthsSinceTraining: 0,
  averageSleepHours: undefined,
  stressLevel: "",
  recoveryFeeling: "",
  availableEquipment: [],
  preferredExercises: "",
  rejectedExercises: "",
  deliveryDate: "",
  deliveryType: "",
  incisionHealed: false,
  postpartumSymptoms: [],
};

const goals = ["Hipertrofia", "Força", "Condicionamento", "Mobilidade", "Retorno aos treinos"];
const experiences = ["Iniciante", "Intermediário", "Avançado"];
const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const durations = ["30 min", "45 min", "60 min", "75 min+"];
const activityLevels = ["Sedentária", "Pouco ativa", "Ativa", "Muito ativa"];
const equipmentOptions = ["Máquinas", "Cabos", "Halteres", "Barra e anilhas", "Elásticos"];
const postpartumSymptomOptions = [
  { id: "bleeding", label: "Sangramento aumentado" },
  { id: "scar_pain", label: "Dor na cicatriz" },
  { id: "pelvic_pressure", label: "Pressão ou peso pélvico" },
  { id: "urinary_leakage", label: "Escape urinário" },
  { id: "pelvic_pain", label: "Dor pélvica" },
  { id: "doming", label: "Abaulamento abdominal" },
  { id: "back_pain", label: "Dor lombar crescente" },
  { id: "fatigue", label: "Fadiga desproporcional" },
];

function todayLabel() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).format(new Date());
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function attendanceStreak(checkIns: CheckIn[], history: WorkoutHistory[]) {
  const attended = new Set([
    ...checkIns.map((item) => localDateKey(new Date(item.checkedAt))),
    ...history.map((item) => localDateKey(new Date(item.completedAt))),
  ]);
  const cursor = new Date();
  if (!attended.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (attended.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function Avatar({ profile, size = "medium" }: { profile: Profile; size?: "small" | "medium" | "large" }) {
  return (
    <div className={`avatar avatar-${size}`} aria-label={`Foto de ${profile.name}`}>
      {profile.photo ? <img src={profile.photo} alt="" /> : <span>{initials(profile.name || "M")}</span>}
    </div>
  );
}

export default function FitLocalApp() {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile>(initialProfile);
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState<AppTab>("today");
  const [editingProfile, setEditingProfile] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [online, setOnline] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [activeSession, setActiveSession] = useState<ActiveWorkoutSession | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [endSessionPrompt, setEndSessionPrompt] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);
  const [installedAppVersion, setInstalledAppVersion] = useState(APP_VERSION);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [lastUpdateCheck, setLastUpdateCheck] = useState<string | null>(null);
  const [history, setHistory] = useState<WorkoutHistory[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [previewWorkout, setPreviewWorkout] = useState<GeneratedWorkout | null>(null);
  const [discardProfilePrompt, setDiscardProfilePrompt] = useState(false);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    const storedPreferences = window.localStorage.getItem(PREFERENCES_KEY);
    const nextTheme = storedTheme === "light" ? "light" : "dark";
    setTheme(nextTheme);
    if (storedPreferences) {
      try { setPreferences({ ...defaultPreferences, ...JSON.parse(storedPreferences) as Partial<AppPreferences> }); } catch { /* keep safe defaults */ }
    }
    setLastUpdateCheck(window.localStorage.getItem(LAST_UPDATE_CHECK_KEY));
    document.documentElement.dataset.theme = nextTheme;
    setOnline(navigator.onLine);
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true);
    let mounted = true;
    const repository = getBrowserDataRepository();
    void repository.createSnapshot().then(() => {
      runDataMigrations(window.localStorage);
      return repository.load();
    }).catch(async () => {
      await repository.restoreLatestSnapshot();
      return repository.load();
    }).then(({ data }) => {
      if (!mounted) return;
      if (data.profile) {
        const parsed = data.profile as Profile;
        const normalized = { ...initialProfile, ...parsed, specialConditions: parsed.specialConditions || [], secondaryGoals: parsed.secondaryGoals || [], availableEquipment: parsed.availableEquipment || [], postpartumSymptoms: parsed.postpartumSymptoms || [], medicalClearance: parsed.medicalClearance || false };
        setProfile(normalized);
        setDraft(normalized);
      }
      setHistory(data.history as WorkoutHistory[]);
      setMeasurements(data.measurements as BodyMeasurement[]);
      setCheckIns(data.checkIns as CheckIn[]);
      setActiveSession(data.activeSession ? normalizeActiveWorkoutSession(data.activeSession as ActiveWorkoutSession) : null);
      setHydrated(true);
    }).catch(() => {
      if (mounted) setHydrated(true);
    });

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    void configureNativeChrome();
    void getInstalledAppVersion().then((version) => { if (version && mounted) setInstalledAppVersion(version); });

    return () => {
      mounted = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const program = useMemo<GeneratedProgram | null>(() => profile ? generateProgram(profile, { history }) : null, [profile, history]);
  const profileDirty = Boolean(profile && JSON.stringify(profile) !== JSON.stringify(draft));

  useEffect(() => {
    if (!editingProfile || !profileDirty) return;
    const protectUnsavedWork = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnsavedWork);
    return () => window.removeEventListener("beforeunload", protectUnsavedWork);
  }, [editingProfile, profileDirty]);

  function changeTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_KEY, next);
  }

  function changePreference(name: keyof AppPreferences, value: boolean) {
    const next = { ...preferences, [name]: value };
    setPreferences(next);
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  }

  function toggleDay(day: string) {
    setDraft((current) => ({
      ...current,
      days: current.days.includes(day) ? current.days.filter((item) => item !== day) : [...current.days, day],
    }));
  }

  function toggleSpecialCondition(condition: string) {
    setDraft((current) => {
      const selected = current.specialConditions || [];
      return { ...current, specialConditions: selected.includes(condition) ? selected.filter((item) => item !== condition) : [...selected, condition] };
    });
  }

  function toggleListField(field: "secondaryGoals" | "availableEquipment" | "postpartumSymptoms", value: string) {
    setDraft((current) => {
      const selected = current[field] || [];
      return { ...current, [field]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value] };
    });
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const context = canvas.getContext("2d");
        if (!context) return;
        const scale = Math.max(320 / image.width, 320 / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (320 - width) / 2, (320 - height) / 2, width, height);
        setDraft((current) => ({ ...current, photo: canvas.toDataURL("image/jpeg", 0.78) }));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function saveProfile(event?: FormEvent) {
    event?.preventDefault();
    if (!draft.name.trim() || !draft.goal || !draft.experience || draft.days.length === 0) return;
    const next = { ...draft, name: draft.name.trim(), specialConditions: draft.specialConditions || [], secondaryGoals: (draft.secondaryGoals || []).slice(0, 2), availableEquipment: draft.availableEquipment || [], postpartumSymptoms: draft.postpartumSymptoms || [], medicalClearance: draft.medicalClearance || false, createdAt: draft.createdAt || new Date().toISOString() };
    void getBrowserDataRepository().write("profile", next);
    if (next.weightKg) {
      const latest = measurements[0];
      const changed = !latest || latest.weightKg !== next.weightKg || latest.waistCm !== next.waistCm || latest.restingHeartRate !== next.restingHeartRate;
      if (changed) {
        const nextMeasurement: BodyMeasurement = { recordedAt: new Date().toISOString(), weightKg: next.weightKg, waistCm: next.waistCm, restingHeartRate: next.restingHeartRate };
        const nextMeasurements = [nextMeasurement, ...measurements].slice(0, 120);
        setMeasurements(nextMeasurements);
        void getBrowserDataRepository().write("measurements", nextMeasurements);
      }
    }
    setProfile(next);
    setDraft(next);
    setEditingProfile(false);
    setTab("today");
    setSavedMessage("Perfil salvo no aparelho");
    window.setTimeout(() => setSavedMessage(""), 2600);
  }

  function registerCheckIn() {
    const today = localDateKey();
    if (checkIns.some((item) => localDateKey(new Date(item.checkedAt)) === today)) return;
    const nextCheckIns = [{ id: `${Date.now()}`, checkedAt: new Date().toISOString() }, ...checkIns].slice(0, 365);
    setCheckIns(nextCheckIns);
    void getBrowserDataRepository().write("checkIns", nextCheckIns);
    setSavedMessage("Check-in registrado");
    window.setTimeout(() => setSavedMessage(""), 2600);
  }

  function registerRecovery24h(historyId: string, response: string) {
    const nextHistory = history.map((item) => item.id === historyId ? { ...item, recovery24h: response } : item);
    setHistory(nextHistory);
    void getBrowserDataRepository().write("history", nextHistory);
    setSavedMessage("Recuperação registrada");
    window.setTimeout(() => setSavedMessage(""), 2600);
  }

  function cancelProfileEdit() {
    if (profileDirty) {
      setDiscardProfilePrompt(true);
      return;
    }
    setDraft(profile!);
    setEditingProfile(false);
  }

  function discardProfileChanges() {
    setDraft(profile!);
    setEditingProfile(false);
    setDiscardProfilePrompt(false);
  }

  function exportBackup() {
    if (!profile) return;
    const backup = { app: "Angels Fit", version: 7, databaseVersion: EXERCISE_DATABASE_VERSION, exportedAt: new Date().toISOString(), profile, program, history, checkIns, measurements };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `angels-fit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openProfileEditor() {
    setDraft(profile!);
    setEditingProfile(true);
    setTab("profile");
  }

  function startWorkout(workout: GeneratedWorkout, options: Partial<Pick<ActiveWorkoutSession, "plannedDate" | "sequenceNumber" | "sequenceAdvance" | "sequenceAction">> = {}) {
    if (activeSession) {
      setSessionOpen(true);
      setSavedMessage("O treino em andamento foi retomado");
      return;
    }
    const session = createActiveWorkoutSession(workout, Date.now(), {
      plannedDate: options.plannedDate || toLocalDateKey(new Date()),
      sequenceNumber: options.sequenceNumber || completedSequenceCount(history) + 1,
      sequenceAdvance: options.sequenceAdvance ?? 1,
      sequenceAction: options.sequenceAction || "recommended",
    });
    setActiveSession(session);
    setSessionOpen(true);
    void getBrowserDataRepository().write("activeSession", session);
  }

  function persistActiveSession(session: ActiveWorkoutSession) {
    setActiveSession(session);
    void getBrowserDataRepository().write("activeSession", session);
  }

  function finishWorkout(session: ActiveWorkoutSession, status: "completed" | "partial" | "interrupted" = "completed") {
    const metrics = summarizeActiveSession(session);
    const workout = session.workout;
    const items = [...workout.warmup, ...workout.main, ...workout.cooldown];
    const exerciseRecords: ExercisePerformanceRecord[] = items.map((item) => {
      const completedSets = (session.completedSeries[item.exercise.id] || []).length;
      const substitution = session.substitutions.find((entry) => entry.fromExerciseId === item.exercise.id);
      return {
        exerciseId: item.exercise.id,
        setsPlanned: item.sets,
        setsCompleted: completedSets,
        repetitions: Number.parseInt(session.actualReps[item.exercise.id] || "0", 10) || 0,
        load: Number.parseFloat((session.loads[item.exercise.id] || "0").replace(",", ".")) || 0,
        rirOrRpe: Number(session.rir[item.exercise.id]) || 0,
        restTime: item.rest,
        technique: "padrão",
        executionFeedback: completedSets >= item.sets ? "adequate" : completedSets > 0 ? "limited" : "unknown",
        painReported: session.painEvents.some((event) => event.exerciseId === item.exercise.id),
        substitutedExerciseId: substitution?.toExerciseId,
      };
    });
    const finalStatus: TrainingSessionStatus = session.sequenceAction === "repeated" ? "repeated" : session.sequenceAction === "manually_advanced" ? "manually_advanced" : status;
    const record: WorkoutHistory = {
      id: session.id,
      workoutId: workout.id,
      workoutName: workout.name,
      completedAt: new Date().toISOString(),
      plannedDate: session.plannedDate,
      sequenceNumber: session.sequenceNumber,
      sequenceAdvance: session.sequenceAdvance,
      phaseId: `phase-${program?.cycleNumber || 1}`,
      durationMinutes: Math.max(1, Math.round(metrics.elapsedSeconds / 60)),
      completedExercises: metrics.completedExercises,
      totalExercises: metrics.totalExercises,
      totalVolumeKg: metrics.totalVolumeKg,
      estimatedOneRepMax: metrics.estimatedOneRepMax,
      cardioMinutes: metrics.cardioMinutes,
      cardioIntensity: metrics.cardioIntensity,
      sessionRpe: metrics.sessionRpe,
      averageRir: metrics.averageRir,
      painScore: metrics.painScore,
      symptoms: metrics.symptoms,
      status: finalStatus,
      exerciseRecords,
      wasRepeated: finalStatus === "repeated",
      wasManuallyAdvanced: finalStatus === "manually_advanced",
    };
    const nextHistory = [record, ...history];
    setHistory(nextHistory);
    void getBrowserDataRepository().write("history", nextHistory);
    setActiveSession(null);
    setSessionOpen(false);
    setEndSessionPrompt(false);
    void getBrowserDataRepository().remove("activeSession");
    setTab("progress");
    setSavedMessage(status === "completed" ? "Treino registrado" : "Sessão parcial salva");
    window.setTimeout(() => setSavedMessage(""), 2600);
  }

  function skipWorkout(workout: GeneratedWorkout, plannedDate: string, sequenceNumber: number) {
    const record: WorkoutHistory = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-skip`,
      workoutId: workout.id,
      workoutName: workout.name,
      completedAt: new Date().toISOString(),
      plannedDate,
      sequenceNumber,
      sequenceAdvance: 1,
      phaseId: `phase-${program?.cycleNumber || 1}`,
      durationMinutes: 0,
      completedExercises: 0,
      totalExercises: workout.warmup.length + workout.main.length + workout.cooldown.length,
      status: "skipped",
      wasSkipped: true,
      exerciseRecords: [],
    };
    const nextHistory = [record, ...history];
    setHistory(nextHistory);
    void getBrowserDataRepository().write("history", nextHistory);
    setSavedMessage("Treino pulado; a sequência foi avançada");
    window.setTimeout(() => setSavedMessage(""), 2600);
  }

  async function updateApplication() {
    if (!navigator.onLine) { setUpdateStatus("offline"); return; }
    setUpdateStatus("checking");
    try {
      const repository = getBrowserDataRepository();
      if (activeSession) await repository.write("activeSession", activeSession);
      await repository.createSnapshot();
      const response = await fetch(`/version.json?check=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Version metadata unavailable");
      const metadata: unknown = await response.json();
      if (!validateVersionMetadata(metadata)) throw new Error("Invalid version metadata");
      const checkedAt = new Date().toISOString();
      window.localStorage.setItem(LAST_UPDATE_CHECK_KEY, checkedAt);
      setLastUpdateCheck(checkedAt);
      if (compareVersions(installedAppVersion, metadata.minimumSupportedAppVersion) < 0) {
        setUpdateStatus("native-required");
        return;
      }
      if (compareVersions(metadata.contentVersion, CONTENT_VERSION) > 0) {
        setUpdateStatus("available");
        const registration = await navigator.serviceWorker?.getRegistration();
        await registration?.update();
        window.location.reload();
        return;
      }
      setUpdateStatus("current");
    } catch {
      await getBrowserDataRepository().restoreLatestSnapshot();
      setUpdateStatus("error");
    }
  }

  if (!hydrated) {
    return <main className="loading-screen"><div className="brand-mark" aria-hidden="true"><span /></div><p>ANGELS FIT</p></main>;
  }

  if (!profile) {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-top">
          <div className="wordmark"><div className="brand-mark" aria-hidden="true"><span /></div>ANGELS FIT</div>
          {step > 0 && <button className="text-button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>}
        </div>
        <div className="step-status">
          <div className="step-dots" aria-label={step === 0 ? "Apresentação" : `Etapa ${step} de 4`}>
            {[0, 1, 2, 3, 4].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}
          </div>
          <small>{step === 0 ? "Apresentação" : `Etapa ${step} de 4`}</small>
        </div>

        {step === 0 && (
          <section className="welcome-panel">
            <div className="welcome-visual" aria-hidden="true">
              <div className="pulse-ring"><span>01</span></div>
              <div className="metric-float metric-one"><strong>3x</strong><small>por semana</small></div>
              <div className="metric-float metric-two"><strong>100%</strong><small>seu ritmo</small></div>
            </div>
            <p className="eyebrow">TREINO PESSOAL, DE VERDADE</p>
            <h1>Seu treino.<br /><em>Seu ritmo.</em></h1>
            <p className="lead">Uma rotina construída para você, disponível mesmo quando estiver sem internet.</p>
            <button className="primary-button" onClick={() => setStep(1)}>Criar meu perfil <span>→</span></button>
            <p className="privacy-note">Seus dados começam salvos somente neste aparelho.</p>
          </section>
        )}

        {step === 1 && (
          <section className="form-panel">
            <p className="eyebrow">PERSONALIZAÇÃO</p><h1>Vamos começar por você.</h1><p className="lead compact">Essas informações ajudam a organizar o programa certo.</p>
            <label className="photo-picker"><input type="file" accept="image/*" onChange={handlePhoto} /><Avatar profile={draft} size="large" /><span>{draft.photo ? "Trocar foto" : "Adicionar foto"}</span></label>
            <label className="field-label">Como devemos chamar você?<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Seu nome" autoComplete="name" /></label>
            <p className="field-title">Seu principal objetivo</p>
            <div className="choice-grid">{goals.map((goal) => <button type="button" key={goal} aria-pressed={draft.goal === goal} className={draft.goal === goal ? "selected" : ""} onClick={() => setDraft({ ...draft, goal })}>{goal}</button>)}</div>
            <p className="field-title">Objetivos secundários <small>Opcional, até dois.</small></p>
            <div className="choice-grid">{goals.filter((goal) => goal !== draft.goal).map((goal) => <button type="button" key={goal} disabled={!(draft.secondaryGoals || []).includes(goal) && (draft.secondaryGoals || []).length >= 2} aria-pressed={(draft.secondaryGoals || []).includes(goal)} className={(draft.secondaryGoals || []).includes(goal) ? "selected" : ""} onClick={() => toggleListField("secondaryGoals", goal)}>{goal}</button>)}</div>
            <button className="primary-button" disabled={!draft.name.trim() || !draft.goal} onClick={() => setStep(2)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 2 && (
          <section className="form-panel">
            <p className="eyebrow">PERSONALIZAÇÃO</p><h1>Seu ponto de partida.</h1><p className="lead compact">Usaremos esses dados para métricas de saúde e evolução. Você poderá editá-los depois.</p>
            <div className="metric-form-grid"><label className="field-label">Data de nascimento<input type="date" value={draft.birthDate || ""} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></label><label className="field-label">Sexo biológico <small>Opcional; usado somente na estimativa metabólica.</small><select value={draft.biologicalSex || ""} onChange={(event) => setDraft({ ...draft, biologicalSex: event.target.value })}><option value="">Não informar</option><option>Feminino</option><option>Masculino</option></select></label><label className="field-label">Altura (cm)<input inputMode="decimal" type="number" min="100" max="250" value={draft.heightCm || ""} onChange={(event) => setDraft({ ...draft, heightCm: event.target.value ? Number(event.target.value) : undefined })} placeholder="175" /></label><label className="field-label">Peso atual (kg)<input inputMode="decimal" type="number" min="25" max="400" step="0.1" value={draft.weightKg || ""} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value ? Number(event.target.value) : undefined })} placeholder="78,5" /></label><label className="field-label">Cintura (cm) <small>Opcional; meça no meio entre costelas e quadril.</small><input inputMode="decimal" type="number" min="40" max="250" step="0.1" value={draft.waistCm || ""} onChange={(event) => setDraft({ ...draft, waistCm: event.target.value ? Number(event.target.value) : undefined })} placeholder="82" /></label><label className="field-label">Frequência cardíaca de repouso <small>Opcional, em batimentos por minuto.</small><input inputMode="numeric" type="number" min="30" max="220" value={draft.restingHeartRate || ""} onChange={(event) => setDraft({ ...draft, restingHeartRate: event.target.value ? Number(event.target.value) : undefined })} placeholder="68" /></label></div>
            <p className="field-title">Como é sua rotina diária?</p><div className="choice-grid two-columns">{activityLevels.map((item) => <button type="button" key={item} aria-pressed={draft.activityLevel === item} className={draft.activityLevel === item ? "selected" : ""} onClick={() => setDraft({ ...draft, activityLevel: item })}>{item}</button>)}</div>
            <div className="metric-form-grid"><label className="field-label">Treinos atuais por semana<input inputMode="numeric" type="number" min="0" max="14" value={draft.currentWeeklySessions ?? ""} onChange={(event) => setDraft({ ...draft, currentWeeklySessions: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Minutos ativos por semana <small>Caminhada, esporte, bicicleta e exercícios.</small><input inputMode="numeric" type="number" min="0" max="2000" value={draft.weeklyActivityMinutes ?? ""} onChange={(event) => setDraft({ ...draft, weeklyActivityMinutes: event.target.value ? Number(event.target.value) : 0 })} /></label></div>
            <div className="metric-form-grid"><label className="field-label">Sono médio por noite<input type="number" inputMode="decimal" min="0" max="12" step="0.5" value={draft.averageSleepHours || ""} onChange={(event) => setDraft({ ...draft, averageSleepHours: event.target.value ? Number(event.target.value) : undefined })} placeholder="Ex.: 6,5" /></label><label className="field-label">Estresse atual<select value={draft.stressLevel || ""} onChange={(event) => setDraft({ ...draft, stressLevel: event.target.value })}><option value="">Selecione</option><option>Baixo</option><option>Moderado</option><option>Alto</option></select></label><label className="field-label">Como costuma se recuperar?<select value={draft.recoveryFeeling || ""} onChange={(event) => setDraft({ ...draft, recoveryFeeling: event.target.value })}><option value="">Selecione</option><option>Boa</option><option>Regular</option><option>Ruim</option></select></label></div>
            <div className="safety-note metric-note"><span>i</span><p>IMC, gasto de repouso e projeções são estimativas de triagem, não diagnóstico ou prescrição nutricional.</p></div>
            <button className="primary-button" disabled={!draft.birthDate || !draft.heightCm || !draft.weightKg || !draft.activityLevel || !draft.averageSleepHours || !draft.stressLevel || !draft.recoveryFeeling} onClick={() => setStep(3)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 3 && (
          <section className="form-panel">
            <p className="eyebrow">PERSONALIZAÇÃO</p><h1>Como você treina hoje?</h1>
            <p className="field-title">Nível de experiência</p><div className="choice-row">{experiences.map((item) => <button type="button" key={item} aria-pressed={draft.experience === item} className={draft.experience === item ? "selected" : ""} onClick={() => setDraft({ ...draft, experience: item })}>{item}</button>)}</div>
            <p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button type="button" key={day} aria-pressed={draft.days.includes(day)} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div>
            <p className="field-title">Duração ideal</p><div className="choice-grid two-columns">{durations.map((item) => <button type="button" key={item} aria-pressed={draft.duration === item} className={draft.duration === item ? "selected" : ""} onClick={() => setDraft({ ...draft, duration: item })}>{item}</button>)}</div>
            <p className="field-title">Onde você vai treinar?</p><div className="choice-row">{["Academia", "Em casa", "Ambos"].map((item) => <button type="button" key={item} aria-pressed={draft.location === item} className={draft.location === item ? "selected" : ""} onClick={() => setDraft({ ...draft, location: item })}>{item}</button>)}</div>
            <p className="field-title">Equipamentos disponíveis</p><div className="condition-grid">{equipmentOptions.map((item) => <button type="button" key={item} aria-pressed={(draft.availableEquipment || []).includes(item)} className={(draft.availableEquipment || []).includes(item) ? "selected" : ""} onClick={() => toggleListField("availableEquipment", item)}>{item}</button>)}</div>
            <div className="metric-form-grid"><label className="field-label">Meses de treino consistente<input type="number" inputMode="numeric" min="0" max="600" value={draft.monthsConsistent ?? ""} onChange={(event) => setDraft({ ...draft, monthsConsistent: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Meses sem treinar<input type="number" inputMode="numeric" min="0" max="600" value={draft.monthsSinceTraining ?? ""} onChange={(event) => setDraft({ ...draft, monthsSinceTraining: event.target.value ? Number(event.target.value) : 0 })} /></label></div>
            <label className="field-label">Exercícios preferidos <small>Separe por vírgulas.</small><input value={draft.preferredExercises || ""} onChange={(event) => setDraft({ ...draft, preferredExercises: event.target.value })} placeholder="Ex.: remada, leg press" /></label><label className="field-label">Exercícios rejeitados <small>Não entrarão na seleção automática.</small><input value={draft.rejectedExercises || ""} onChange={(event) => setDraft({ ...draft, rejectedExercises: event.target.value })} placeholder="Ex.: corrida, agachamento com barra" /></label>
            <button className="primary-button" disabled={!draft.experience || draft.days.length === 0 || !draft.duration || !draft.location} onClick={() => setStep(4)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 4 && (
          <form className="form-panel" onSubmit={saveProfile}>
            <p className="eyebrow">PERSONALIZAÇÃO</p><h1>Últimos cuidados.</h1><p className="lead compact">Conte o que devemos considerar antes de definir seu primeiro treino.</p>
            <p className="field-title">Cuidados especiais</p>
            <div className="condition-grid">{specialConditionOptions.map((item) => <button type="button" key={item.id} aria-pressed={(draft.specialConditions || []).includes(item.id)} className={(draft.specialConditions || []).includes(item.id) ? "selected" : ""} onClick={() => toggleSpecialCondition(item.id)}>{item.label}</button>)}</div>
            {(draft.specialConditions || []).some((item) => ["postpartum", "cesarean"].includes(item)) && <section className="postpartum-profile-card"><p className="field-title">Recuperação pós-parto</p><div className="metric-form-grid"><label className="field-label">Data do parto<input type="date" value={draft.deliveryDate || ""} onChange={(event) => setDraft({ ...draft, deliveryDate: event.target.value })} /></label><label className="field-label">Tipo de parto<select value={draft.deliveryType || ""} onChange={(event) => setDraft({ ...draft, deliveryType: event.target.value })}><option value="">Selecione</option><option>Cesárea</option><option>Vaginal</option></select></label></div><label className="clearance-check"><input type="checkbox" checked={draft.incisionHealed || false} onChange={(event) => setDraft({ ...draft, incisionHealed: event.target.checked })} /><span><strong>Cicatriz fechada e sem sinais de infecção</strong><small>Sem calor, vermelhidão progressiva, secreção ou febre.</small></span></label><p className="field-title">Sintomas atuais <small>Marque tudo o que estiver presente.</small></p><div className="condition-grid symptom-grid">{postpartumSymptomOptions.map((item) => <button type="button" key={item.id} aria-pressed={(draft.postpartumSymptoms || []).includes(item.id)} className={(draft.postpartumSymptoms || []).includes(item.id) ? "selected warning" : ""} onClick={() => toggleListField("postpartumSymptoms", item.id)}>{item.label}</button>)}</div></section>}
            <label className="field-label">Dores, limitações ou exercícios a evitar<textarea value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Ex.: desconforto no joelho direito, evitar corrida..." rows={5} /></label>
            {(draft.specialConditions || []).some((item) => ["postpartum", "cesarean", "pregnancy", "cardiovascular"].includes(item)) && <label className="clearance-check"><input type="checkbox" checked={draft.medicalClearance || false} onChange={(event) => setDraft({ ...draft, medicalClearance: event.target.checked })} /><span><strong>Tenho liberação profissional para treinar</strong><small>Marque apenas se essa orientação já foi recebida.</small></span></label>}
            <div className="summary-card"><Avatar profile={draft} /><div><strong>{draft.name}</strong><span>{draft.goal} · {draft.experience}</span><small>{draft.days.length} dias por semana · {draft.duration}</small></div></div>
            <div className="safety-note"><span>!</span><p>O aplicativo organiza treinos e registros, mas não substitui avaliação médica ou profissional.</p></div>
            <button className="primary-button" type="submit">Concluir meu perfil <span>✓</span></button>
          </form>
        )}
      </main>
    );
  }

  if (activeSession && sessionOpen) {
    return <AdaptiveWorkoutSession session={activeSession} preferences={preferences} onExit={() => setSessionOpen(false)} onPersist={persistActiveSession} onFinish={(session) => finishWorkout(session)} />;
  }

  const tabContent = {
    today: <Today profile={profile} online={online} installed={installed} setTab={setTab} onEditProfile={openProfileEditor} exportBackup={exportBackup} program={program!} startWorkout={startWorkout} skipWorkout={skipWorkout} activeSession={activeSession} continueWorkout={() => setSessionOpen(true)} endWorkout={() => setEndSessionPrompt(true)} checkIns={checkIns} history={history} onCheckIn={registerCheckIn} onRecovery24h={registerRecovery24h} />,
    program: <Program profile={profile} program={program!} previewWorkout={setPreviewWorkout} openExercises={() => setTab("exercises")} onEditProfile={openProfileEditor} />,
    exercises: <Exercises onBack={() => setTab("program")} />,
    progress: <Progress profile={profile} history={history} checkIns={checkIns} measurements={measurements} setTab={setTab} />,
    profile: <ProfileView profile={profile} draft={draft} setDraft={setDraft} editing={editingProfile} setEditing={setEditingProfile} cancelEditing={cancelProfileEdit} saveProfile={saveProfile} handlePhoto={handlePhoto} toggleDay={toggleDay} toggleSpecialCondition={toggleSpecialCondition} toggleListField={toggleListField} theme={theme} changeTheme={changeTheme} exportBackup={exportBackup} preferences={preferences} changePreference={changePreference} installedAppVersion={installedAppVersion} updateStatus={updateStatus} lastUpdateCheck={lastUpdateCheck} updateApplication={updateApplication} />,
  }[tab];

  const showBottomNav = !editingProfile && !previewWorkout;

  return (
    <main className="app-shell"><div className="mobile-app">
      {savedMessage && <div className="toast">✓ {savedMessage}</div>}
      <div className={`app-content ${showBottomNav ? "" : "without-nav"}`}>{previewWorkout ? <WorkoutPreview workout={previewWorkout} onBack={() => setPreviewWorkout(null)} onStart={() => { setPreviewWorkout(null); startWorkout(previewWorkout); }} /> : tabContent}</div>
      {showBottomNav && <nav className="bottom-nav" aria-label="Navegação principal">
        <NavButton active={tab === "today"} label="Hoje" icon="⌂" onClick={() => setTab("today")} />
        <NavButton active={tab === "program" || tab === "exercises"} label="Treinos" icon="▤" onClick={() => setTab("program")} />
        <NavButton active={tab === "progress"} label="Progresso" icon="↗" onClick={() => setTab("progress")} />
        <NavButton active={tab === "profile"} label="Ajustes" icon="○" onClick={() => setTab("profile")} />
      </nav>}
      {discardProfilePrompt && <ConfirmDialog title="Descartar alterações?" description="As mudanças feitas no perfil ainda não foram salvas." confirmLabel="Descartar" onConfirm={discardProfileChanges} onCancel={() => setDiscardProfilePrompt(false)} />}
      {endSessionPrompt && activeSession && <ConfirmDialog title="Encerrar sessão?" description="O progresso atual será salvo como treino parcialmente concluído." confirmLabel="Salvar e encerrar" onConfirm={() => finishWorkout(activeSession, "partial")} onCancel={() => setEndSessionPrompt(false)} />}
    </div></main>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={onClick}><span aria-hidden="true">{icon}</span><small>{label}</small></button>;
}

function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel }: { title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><div className="dialog-icon" aria-hidden="true">!</div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p><div><button onClick={onCancel}>Continuar</button><button className="danger" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

function ScreenHeader({ title, profile, kicker, onProfileClick }: { title: string; profile: Profile; kicker?: string; onProfileClick?: () => void }) {
  return <header className="screen-header"><div><p>{kicker}</p><h1>{title}</h1></div>{onProfileClick ? <button className="avatar-button" aria-label="Editar informações do perfil" onClick={onProfileClick}><Avatar profile={profile} size="small" /></button> : <Avatar profile={profile} size="small" />}</header>;
}

function cycleDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function WorkoutBlockOverview({ title, items, block }: { title: string; items: GeneratedWorkout["main"]; block: "warmup" | "main" | "cooldown" }) {
  return <section className={`workout-block block-${block}`}><header><span aria-hidden="true">{block === "warmup" ? "01" : block === "main" ? "02" : "03"}</span><div><small>BLOCO</small><strong>{title}</strong></div></header><div>{items.map((item) => <article key={item.exercise.id}><div><strong>{item.exercise.name}</strong><small>{item.exercise.equipment}</small></div><b>{item.sets}× {item.reps}</b></article>)}</div></section>;
}

function Today({ profile, online, installed, setTab, onEditProfile, exportBackup, program, startWorkout, skipWorkout, activeSession, continueWorkout, endWorkout, checkIns, history, onCheckIn, onRecovery24h }: { profile: Profile; online: boolean; installed: boolean; setTab: (tab: AppTab) => void; onEditProfile: () => void; exportBackup: () => void; program: GeneratedProgram; startWorkout: (workout: GeneratedWorkout, options?: Partial<Pick<ActiveWorkoutSession, "plannedDate" | "sequenceNumber" | "sequenceAdvance" | "sequenceAction">>) => void; skipWorkout: (workout: GeneratedWorkout, plannedDate: string, sequenceNumber: number) => void; activeSession: ActiveWorkoutSession | null; continueWorkout: () => void; endWorkout: () => void; checkIns: CheckIn[]; history: WorkoutHistory[]; onCheckIn: () => void; onRecovery24h: (historyId: string, response: string) => void }) {
  const [now] = useState(() => new Date());
  const recommendedIndex = recommendedWorkoutIndex(history, program.workouts.length);
  const calendar = useMemo(() => buildCalendarSchedule({ startDate: now, days: 10, availableDays: profile.days, workouts: program.workouts, recommendedIndex }), [now, profile.days, program.workouts, recommendedIndex]);
  const [selectedDateKey, setSelectedDateKey] = useState(() => toLocalDateKey(now));
  const [confirmAdvance, setConfirmAdvance] = useState(false);
  const [adaptationChoice, setAdaptationChoice] = useState<"pending" | "accepted" | "ignored">("pending");
  const [protocolChoice, setProtocolChoice] = useState<"pending" | "accepted" | "ignored">("pending");
  const selectedDay = calendar.find((day) => day.dateKey === selectedDateKey) || calendar[0];
  const workout = selectedDay?.workout || null;
  const adherence = calculateAdherence(history, now, profile.days);
  const returnAdaptation = getReturnAdaptation(history, now);
  const protocols = eligibleProtocols({ experience: program.effectiveExperience, recovery: program.recoveryClass, adherencePercentage: adherence.adherencePercentage, painScore: Math.max(...history.slice(0, 3).map((item) => item.painScore || 0), 0), inactivityDays: returnAdaptation.inactivityDays, sessionsThisWeek: history.filter((item) => now.getTime() - new Date(item.completedAt).getTime() <= 7 * 86_400_000).length });
  const suggestedProtocol = protocols[0];
  const sequenceNumber = completedSequenceCount(history) + (selectedDay?.sequenceOffset || 0) + 1;
  const selectedLabel = selectedDay ? new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(selectedDay.date) : todayLabel();
  const metricsComplete = Boolean(profile.birthDate && profile.heightCm && profile.weightKg && profile.activityLevel);
  const checkedToday = checkIns.some((item) => localDateKey(new Date(item.checkedAt)) === localDateKey());
  const streak = attendanceStreak(checkIns, history);
  const pendingRecovery = history.find((item) => !item.recovery24h && now.getTime() - new Date(item.completedAt).getTime() >= 12 * 3_600_000 && now.getTime() - new Date(item.completedAt).getTime() <= 72 * 3_600_000);
  const activeSummary = activeSession ? summarizeActiveSession(activeSession, now.getTime()) : null;
  const lastActiveMinutes = activeSession ? Math.max(0, Math.round((now.getTime() - new Date(activeSession.updatedAt).getTime()) / 60_000)) : 0;
  const beginSelectedWorkout = () => {
    if (!workout || !selectedDay) return;
    if (selectedDay.sequenceOffset > 0) { setConfirmAdvance(true); return; }
    let prepared = adaptationChoice === "accepted" ? applyReturnAdaptation(workout, returnAdaptation) : workout;
    if (protocolChoice === "accepted" && suggestedProtocol) prepared = { ...prepared, notices: [...prepared.notices, `${suggestedProtocol.name}: ${suggestedProtocol.explanation}`] };
    startWorkout(prepared, { plannedDate: selectedDay.dateKey, sequenceNumber, sequenceAdvance: 1, sequenceAction: "recommended" });
  };
  const manuallyAdvance = () => {
    if (!workout || !selectedDay) return;
    let prepared = adaptationChoice === "accepted" ? applyReturnAdaptation(workout, returnAdaptation) : workout;
    if (protocolChoice === "accepted" && suggestedProtocol) prepared = { ...prepared, notices: [...prepared.notices, `${suggestedProtocol.name}: ${suggestedProtocol.explanation}`] };
    startWorkout(prepared, { plannedDate: selectedDay.dateKey, sequenceNumber, sequenceAdvance: selectedDay.sequenceOffset + 1, sequenceAction: "manually_advanced" });
    setConfirmAdvance(false);
  };
  const repeatPrevious = () => {
    const previous = program.workouts[(recommendedIndex - 1 + program.workouts.length) % program.workouts.length];
    if (previous) startWorkout(previous, { plannedDate: toLocalDateKey(now), sequenceNumber: Math.max(1, completedSequenceCount(history)), sequenceAdvance: 0, sequenceAction: "repeated" });
  };
  return (
    <section className="screen">
      <ScreenHeader title={`Olá, ${profile.name.split(" ")[0]}`} kicker={todayLabel()} profile={profile} onProfileClick={onEditProfile} />
      <div className={`connection-pill ${online ? "online" : "offline"}`}><span />{online ? "Dados locais prontos" : "Modo offline"}</div>
      {activeSession && activeSummary && <article className="resume-session-card"><p>TREINO EM ANDAMENTO</p><h2>{activeSession.workout.name}</h2><span>{activeSummary.completedExercises} de {activeSummary.totalExercises} exercícios · última atividade {lastActiveMinutes < 1 ? "agora" : `há ${lastActiveMinutes} min`}</span><div><button className="resume-primary" onClick={continueWorkout}>Continuar treino</button><button onClick={endWorkout}>Encerrar sessão</button></div></article>}
      <button className={`checkin-card ${checkedToday ? "checked" : ""}`} aria-pressed={checkedToday} disabled={checkedToday} onClick={onCheckIn}><span aria-hidden="true">{checkedToday ? "✓" : "●"}</span><div><strong>{checkedToday ? "Check-in feito hoje" : "Fazer check-in"}</strong><small>{checkedToday ? "Sua presença já foi registrada." : "Registre sua presença com um toque."}</small></div><b>{streak > 0 ? `${streak} ${streak === 1 ? "dia" : "dias"}` : "+1"}</b></button>
      {pendingRecovery && <article className="recovery-followup"><p>RESPOSTA DE 24 HORAS</p><h2>Como você ficou após {pendingRecovery.workoutName}?</h2><div>{["Melhor", "Igual", "Piorou", "Muito cansada"].map((response) => <button key={response} onClick={() => onRecovery24h(pendingRecovery.id, response)}>{response}</button>)}</div></article>}
      {!metricsComplete && <button className="profile-completion-card" onClick={() => setTab("profile")}><span>!</span><div><strong>Complete seus dados de desempenho</strong><small>Informe nascimento, altura, peso e rotina para liberar métricas e previsões.</small></div><b>→</b></button>}
      <div className="week-strip" aria-label="Calendário de próximos treinos">{calendar.map((day) => <button type="button" key={day.dateKey} aria-pressed={selectedDay?.dateKey === day.dateKey} className={`${day.isToday ? "today" : ""} ${selectedDay?.dateKey === day.dateKey ? "selected" : ""} ${day.workout ? "training-day" : "rest-day"}`} onClick={() => setSelectedDateKey(day.dateKey)}><small>{day.weekdayShort}</small><span>{day.dayNumber}</span><em>{day.monthShort}</em>{day.workout && <i aria-hidden="true" />}</button>)}</div>
      {workout ? <article className="hero-card workout-hero"><div className="hero-orbit" aria-hidden="true"><span>{workout.estimatedMinutes}</span></div><p>{selectedDay?.isToday ? "TREINO DO DIA" : "TREINO PLANEJADO"}</p><h2>{workout.name}</h2><span>{workout.focus} · {workout.main.length + workout.warmup.length + workout.cooldown.length} movimentos · aproximadamente {workout.estimatedMinutes} min</span><small className="cycle-validity">{selectedLabel} · posição {sequenceNumber} da sequência</small><button onClick={() => activeSession ? continueWorkout() : beginSelectedWorkout()}>{activeSession ? "Continuar treino" : selectedDay?.sequenceOffset ? "Avançar e iniciar" : "Iniciar treino"} <b>→</b></button></article> : <article className="hero-card rest-hero"><div className="hero-orbit" aria-hidden="true"><span>☾</span></div><p>RECUPERAÇÃO</p><h2>Dia sem treino planejado</h2><span>{selectedLabel}. Escolha outro dia no calendário para consultar o próximo treino.</span></article>}
      <div className="sequence-nav"><button onClick={repeatPrevious} disabled={!history.length || !program.workouts.length}>↶ Repetir anterior</button><button onClick={() => setSelectedDateKey(calendar[0]?.dateKey)}>Recomendado</button><button onClick={() => { const next = calendar.find((day) => day.sequenceOffset === 1 && day.workout); if (next) setSelectedDateKey(next.dateKey); }}>Próximo →</button></div>
      <article className="recommendation-card"><p>POR QUE ESTE TREINO?</p><strong>{program.recommendationReason || "A sessão segue sua sequência registrada."}</strong><span>Fase {program.cycleNumber}: {program.phaseCompletedSessions || 0} de {program.phaseRequiredSessions || 12} sessões consolidadas.</span></article>
      {returnAdaptation.level !== "none" && adaptationChoice === "pending" && <article className="suggestion-card"><p>AJUSTE DE RETORNO</p><h2>{returnAdaptation.explanation}</h2><div><button onClick={() => setAdaptationChoice("accepted")}>Aceitar ajuste</button><button onClick={onEditProfile}>Editar dados</button><button onClick={() => setAdaptationChoice("ignored")}>Ignorar</button></div></article>}
      {suggestedProtocol && protocolChoice === "pending" && <article className="suggestion-card"><p>TÉCNICA OPCIONAL</p><h2>{suggestedProtocol.name}</h2><span>{suggestedProtocol.explanation}</span><div><button onClick={() => setProtocolChoice("accepted")}>Aceitar</button><button onClick={onEditProfile}>Editar</button><button onClick={() => setProtocolChoice("ignored")}>Ignorar</button></div></article>}
      <div className="section-heading"><div><p>{selectedDay?.isToday ? "HOJE" : "DATA SELECIONADA"}</p><h2>{workout ? "Plano da sessão" : "Recuperação planejada"}</h2></div></div>
      {workout ? <><div className="workout-blocks-overview"><WorkoutBlockOverview title="Aquecimento e mobilidade" items={workout.warmup} block="warmup" /><WorkoutBlockOverview title="Parte principal" items={workout.main} block="main" /><WorkoutBlockOverview title="Encerramento e alongamento" items={workout.cooldown} block="cooldown" /></div>{selectedDay?.sequenceOffset === 0 && <button className="skip-workout-button" onClick={() => skipWorkout(workout, selectedDay.dateKey, sequenceNumber)}>Pular este treino e avançar a sequência</button>}</> : <article className="safety-block"><p>Recuperação também faz parte do plano. O próximo treino permanece na sequência.</p></article>}
      {workout && workout.notices.length > 0 && <article className="safety-block compact">{workout.notices.map((notice) => <p key={notice}>! {notice}</p>)}</article>}
      <div className="metrics-grid"><article><p>Objetivo</p><strong>{profile.goal}</strong><span>foco principal</span></article><article><p>Rotina efetiva</p><strong>{program.effectiveDays}x</strong><span>por semana</span></article><article><p>Recuperação</p><strong>{program.recoveryClass}</strong><span>{program.specialPhase || program.effectiveExperience}</span></article></div>
      {!installed && <article className="install-card"><span aria-hidden="true">⇧</span><div><strong>Usar em tela cheia no iPhone</strong><p>Instale o atalho Angels Fit para abrir o app com rapidez, mesmo offline.</p><a href="/AngelsFit.mobileconfig">Ver instruções de instalação</a></div></article>}
      <div className="quick-actions"><button onClick={exportBackup}><span>↓</span><div><strong>Fazer backup</strong><small>Salvar uma cópia dos dados</small></div></button><button onClick={() => setTab("profile")}><span>○</span><div><strong>Meu perfil</strong><small>Revisar preferências</small></div></button></div>
      {confirmAdvance && <ConfirmDialog title="Avançar a sequência?" description={`Você selecionou ${workout?.name}. Os treinos anteriores serão marcados como avançados manualmente.`} confirmLabel="Avançar e iniciar" onConfirm={manuallyAdvance} onCancel={() => setConfirmAdvance(false)} />}
    </section>
  );
}

function Program({ profile, program, previewWorkout, openExercises, onEditProfile }: { profile: Profile; program: GeneratedProgram; previewWorkout: (workout: GeneratedWorkout) => void; openExercises: () => void; onEditProfile: () => void }) {
  return (
    <section className="screen">
      <ScreenHeader title="Meu programa" kicker="PLANEJAMENTO" profile={profile} onProfileClick={onEditProfile} />
      <article className="program-overview"><p>PROGRAMA DE {profile.name.toUpperCase()}</p><h2>{program.title}</h2><div><span><strong>{program.effectiveDays}</strong> dias efetivos</span><span><strong>{profile.duration}</strong> por sessão</span></div><div className="program-progress"><span style={{ width: `${Math.max(8, ((14 - program.daysRemaining) / 14) * 100)}%` }} /></div><small>{program.status === "ready" ? `${cycleDateLabel(program.validFrom)} a ${cycleDateLabel(program.validUntil)} · ${program.daysRemaining} dias restantes` : program.split}</small>{program.specialPhase && <em className="program-phase">{program.specialPhase}</em>}</article>
      <div className="section-heading"><div><p>CICLO DE 2 SEMANAS</p><h2>Treinos deste ciclo</h2></div></div>
      {program.workouts.length > 0 ? <div className="program-list">{program.workouts.map((workout, index) => <button key={workout.id} aria-label={`Ver treino ${workout.name}`} onClick={() => previewWorkout(workout)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{workout.name}</strong><small>{workout.warmup.length + workout.main.length + workout.cooldown.length} movimentos · {workout.estimatedMinutes} min · 3 blocos</small></div><b>Ver</b></button>)}</div> : <article className="safety-block">{program.notices.map((notice) => <p key={notice}>! {notice}</p>)}</article>}
      <button className="library-entry" onClick={openExercises}><span aria-hidden="true">◎</span><div><strong>Biblioteca de exercícios</strong><small>Consulte execução, músculos e alternativas.</small></div><b>Ver →</b></button>
      <article className="upgrade-card"><span>↻</span><div><strong>Próxima revisão em {program.daysRemaining} {program.daysRemaining === 1 ? "dia" : "dias"}</strong><p>{program.progressionNote}</p></div></article>
      {program.specialPhase && <details className="methodology-card"><summary>Critérios do programa pós-parto</summary><p>O programa avança por blocos de duas semanas. Liberação, cicatrização e sintomas podem ser registrados, mas permanecem informativos e não bloqueiam o acesso aos treinos.</p><div><a href="https://bjsm.bmj.com/content/59/8/515" target="_blank" rel="noreferrer">Diretriz canadense 2025</a><a href="https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/04/physical-activity-and-exercise-during-pregnancy-and-the-postpartum-period" target="_blank" rel="noreferrer">ACOG · exercício pós-parto</a></div></details>}
    </section>
  );
}

function WorkoutPreview({ workout, onBack, onStart }: { workout: GeneratedWorkout; onBack: () => void; onStart: () => void }) {
  const items = [...workout.warmup, ...workout.main, ...workout.cooldown];
  return <section className="screen workout-preview"><header className="preview-header"><button onClick={onBack}>← Programa</button><span>Overview do treino</span></header><div className="preview-hero"><p>PLANO COMPLETO DA SESSÃO</p><h1>{workout.name}</h1><span>{workout.focus} · {items.length} movimentos · cerca de {workout.estimatedMinutes} min</span></div><div className="workout-blocks-overview preview-blocks"><WorkoutBlockOverview title="Aquecimento e mobilidade" items={workout.warmup} block="warmup" /><WorkoutBlockOverview title="Parte principal" items={workout.main} block="main" /><WorkoutBlockOverview title="Encerramento e alongamento" items={workout.cooldown} block="cooldown" /></div><footer className="preview-actions"><button onClick={onBack}>Agora não</button><button className="start" onClick={onStart}>Iniciar treino →</button></footer></section>;
}

function ExerciseDemo({ exerciseId, exerciseName, compact = false }: { exerciseId: string; exerciseName: string; compact?: boolean }) {
  const bundledMedia = exerciseMedia[exerciseId];
  const [remoteGif, setRemoteGif] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setVideoReady(false);
    setRemoteGif(null);
    setMediaStatus(bundledMedia?.imageUrl && !bundledMedia.videoUrl ? "ready" : "loading");
    if (bundledMedia) return;
    const query = exerciseMediaQueries[exerciseId];
    if (!query) { setMediaStatus("error"); return; }
    const cacheKey = `angels-fit.exercise-media.${exerciseId}`;
    const cached = window.sessionStorage.getItem(cacheKey);
    if (cached) { setRemoteGif(cached); setMediaStatus("ready"); return; }
    const controller = new AbortController();
    fetch(`https://oss.exercisedb.dev/api/v1/exercises/search?search=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const responsePayload = payload as { data?: Array<{ name?: string; gifUrl?: string }> } | null;
        const wanted = query.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter((token) => !["machine", "exercise", "stretch"].includes(token));
        const ranked = (responsePayload?.data || []).map((item: { name?: string; gifUrl?: string }) => {
          const available = new Set((item.name || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/));
          return { item, coverage: wanted.filter((token) => available.has(token)).length / Math.max(1, wanted.length) };
        }).sort((a: { coverage: number }, b: { coverage: number }) => b.coverage - a.coverage);
        const gifUrl = ranked[0]?.coverage >= 0.75 ? ranked[0].item.gifUrl : null;
        if (gifUrl) { window.sessionStorage.setItem(cacheKey, gifUrl); setRemoteGif(gifUrl); setMediaStatus("ready"); }
        else setMediaStatus("error");
      }).catch(() => setMediaStatus("error"));
    return () => controller.abort();
  }, [bundledMedia, exerciseId, exerciseName, retry]);
  const media = bundledMedia || (remoteGif ? { exerciseName, providerName: exerciseName, videoUrl: null, imageUrl: null, gifUrl: remoteGif } : null);
  if (!media && mediaStatus === "loading") return <div className={`exercise-media-state media-loading${compact ? " compact" : ""}`} role="status"><span /><p>Carregando demonstração…</p></div>;
  if (!media || mediaStatus === "error") return <div className={`exercise-media-state media-error${compact ? " compact" : ""}`}><strong>Demonstração indisponível</strong><p>Siga as instruções de execução abaixo.</p><button onClick={() => setRetry((value) => value + 1)}>Tentar novamente</button></div>;
  return <figure className={`exercise-demo${compact ? " compact" : ""}`}>
    <div className="exercise-demo-frame">
      {mediaStatus === "loading" && <div className="media-skeleton" aria-hidden="true" />}
      {(media.gifUrl || media.imageUrl) && <img src={media.gifUrl || media.imageUrl || undefined} alt={media.gifUrl ? `Demonstração em movimento de ${exerciseName}` : `Posição de referência para ${exerciseName}`} loading="lazy" onLoad={() => setMediaStatus("ready")} onError={() => setMediaStatus("error")} />}
      {media.videoUrl && <video className={videoReady ? "ready" : ""} src={media.videoUrl} poster={media.imageUrl || undefined} autoPlay loop muted playsInline preload="metadata" onCanPlay={() => { setVideoReady(true); setMediaStatus("ready"); }} onError={() => setMediaStatus("error")} aria-label={`Demonstração em movimento de ${exerciseName}`} />}
      <span aria-hidden="true">EXECUÇÃO</span>
    </div>
    {!compact && <figcaption>Demonstração ilustrativa em loop · confira as instruções abaixo.</figcaption>}
  </figure>;
}

function Exercises({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const [openExercise, setOpenExercise] = useState<string | null>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = exercises.filter((exercise) => {
    const matchesSearch = !normalizedSearch || `${exercise.name} ${exercise.muscleGroups.join(" ")} ${exercise.equipment}`.toLocaleLowerCase("pt-BR").includes(normalizedSearch);
    const matchesFilter = filter === "Todos" || (filter === "Academia" && exercise.locations.includes("Academia")) || (filter === "Casa" && exercise.locations.includes("Em casa")) || (filter === "Mobilidade" && ["mobility", "cooldown"].includes(exercise.movement)) || (filter === "Baixo impacto" && exercise.impact === "baixo");
    return matchesSearch && matchesFilter;
  });
  const filters = ["Todos", "Academia", "Casa", "Mobilidade", "Baixo impacto"];
  return <section className="screen"><button className="section-back" onClick={onBack}>← Treinos</button><div className="simple-header"><p>BIBLIOTECA</p><h1>{filtered.length} {filtered.length === 1 ? "exercício" : "exercícios"}</h1></div><label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Buscar exercício ou músculo</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar exercício ou músculo" />{search && <button aria-label="Limpar busca" onClick={() => setSearch("")}>×</button>}</label><div className="filter-chips" aria-label="Filtrar exercícios">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="exercise-list">{filtered.map((exercise) => { const open = openExercise === exercise.id; const detailsId = `exercise-${exercise.id}`; return <article key={exercise.id} className={open ? "open" : ""}><button className="exercise-trigger" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpenExercise(open ? null : exercise.id)}><span aria-hidden="true">{exercise.movement === "warmup" ? "↗" : exercise.movement === "cooldown" ? "↓" : "●"}</span><div><strong>{exercise.name}</strong><small>{exercise.muscleGroups.join(" · ")} · {exercise.equipment}</small></div><b aria-hidden="true">⌄</b></button>{open && <div className="exercise-details" id={detailsId}><ExerciseDemo key={exercise.id} exerciseId={exercise.id} exerciseName={exercise.name} /><p><strong>Execução</strong>{exercise.instructions}</p><p><strong>Erros comuns</strong>{exercise.commonErrors}</p><div>{exercise.tags.slice(0, 4).map((tag) => <span key={tag}>{tag.replace("-", " ")}</span>)}</div></div>}</article>; })}</div>{filtered.length === 0 && <article className="large-empty-state compact-state"><div className="exercise-glyph" aria-hidden="true"><span /></div><h2>Nada encontrado</h2><p>Tente outro nome, grupo muscular ou filtro.</p><button className="reset-filters" onClick={() => { setSearch(""); setFilter("Todos"); }}>Limpar filtros</button></article>}</section>;
}

function buildWeeklySessions(history: WorkoutHistory[]) {
  const now = Date.now();
  return Array.from({ length: 6 }, (_, displayIndex) => {
    const bucket = 5 - displayIndex;
    const count = history.filter((item) => {
      const ageDays = (now - new Date(item.completedAt).getTime()) / 86_400_000;
      return ageDays >= bucket * 7 && ageDays < (bucket + 1) * 7;
    }).length;
    return { label: bucket === 0 ? "Agora" : `-${bucket}s`, value: count };
  });
}

function MetricBars({ items, suffix = "", relative = false }: { items: Array<{ label: string; value: number }>; suffix?: string; relative?: boolean }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  const min = relative ? Math.min(...items.map((item) => item.value)) : 0;
  return <div className="metric-bars">{items.map((item, index) => { const height = relative ? 24 + ((item.value - min) / Math.max(max - min, 1)) * 76 : Math.max(item.value > 0 ? 12 : 2, (item.value / max) * 100); return <div key={`${item.label}-${index}`}><span className="bar-track"><i style={{ height: `${height}%` }} /></span><strong>{item.value ? `${formatMetric(item.value, item.value % 1 ? 1 : 0)}${suffix}` : "0"}</strong><small>{item.label}</small></div>; })}</div>;
}

function Progress({ profile, history, checkIns, measurements, setTab }: { profile: Profile; history: WorkoutHistory[]; checkIns: CheckIn[]; measurements: BodyMeasurement[]; setTab: (tab: AppTab) => void }) {
  const [now] = useState(() => Date.now());
  const age = calculateAge(profile.birthDate);
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);
  const waistRatio = waistToHeightRatio(profile.waistCm, profile.heightCm);
  const restingEnergy = estimateRestingEnergy(profile.weightKg, profile.heightCm, age, profile.biologicalSex);
  const recentWorkouts = history.filter((item) => now - new Date(item.completedAt).getTime() <= 28 * 86_400_000);
  const recentCheckIns = checkIns.filter((item) => now - new Date(item.checkedAt).getTime() <= 28 * 86_400_000);
  const attendanceDays = new Set([...recentWorkouts.map((item) => localDateKey(new Date(item.completedAt))), ...recentCheckIns.map((item) => localDateKey(new Date(item.checkedAt)))]).size;
  const monthlyAdherence = calculateAdherence(history, new Date(now), profile.days);
  const adherence = monthlyAdherence.adherencePercentage;
  const plannedWeekly = Math.max(profile.days.length, 1);
  const streak = attendanceStreak(checkIns, history);
  const minutes = history.reduce((total, item) => total + item.durationMinutes, 0);
  const weekly = buildWeeklySessions(history);
  const weightItems = [...measurements].slice(0, 6).reverse().map((item) => ({ label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(item.recordedAt)), value: item.weightKg }));
  const volumeItems = [...history].filter((item) => (item.totalVolumeKg || 0) > 0).slice(0, 6).reverse().map((item, index) => ({ label: `T${index + 1}`, value: Math.round(item.totalVolumeKg || 0) }));
  const complete = Boolean(profile.birthDate && profile.heightCm && profile.weightKg && profile.activityLevel);
  const hasActivity = history.length > 0 || checkIns.length > 0;
  const activities = [
    ...history.map((item) => ({ id: `workout-${item.id}`, type: "Treino concluído", title: item.workoutName, date: item.completedAt, meta: `${item.completedExercises}/${item.totalExercises} movimentos · ${item.durationMinutes} min${item.sessionRpe ? ` · RPE ${item.sessionRpe}` : ""}${item.cardioMinutes ? ` · cardio ${item.cardioMinutes} min ${item.cardioIntensity?.toLowerCase()}` : ""}${item.symptoms?.length ? " · sintomas registrados" : ""}` })),
    ...checkIns.map((item) => ({ id: `checkin-${item.id}`, type: "Check-in", title: "Presença registrada", date: item.checkedAt, meta: "Sua consistência conta" })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 12);

  return <section className="screen performance-screen"><div className="simple-header"><p>CONSISTÊNCIA + EVOLUÇÃO</p><h1>Progresso</h1></div>{!hasActivity && <article className="progress-welcome"><span aria-hidden="true">↗</span><div><strong>Seu progresso começa hoje.</strong><p>Faça um check-in ou conclua o primeiro treino para começar a acompanhar sua consistência.</p><button onClick={() => setTab("today")}>Ir para Hoje →</button></div></article>}<div className="progress-summary"><article><strong>{checkIns.length}</strong><span>check-ins</span></article><article><strong>{history.length}</strong><span>treinos</span></article><article><strong>{streak}</strong><span>{streak === 1 ? "dia seguido" : "dias seguidos"}</span></article></div>{!complete && <button className="profile-completion-card" onClick={() => setTab("profile")}><span>!</span><div><strong>Complete seus dados</strong><small>Informe os dados do perfil para liberar todas as métricas.</small></div><b>→</b></button>}{hasActivity && <article className="adherence-card"><div><p>ASSIDUIDADE · 28 DIAS</p><strong>{adherence}%</strong><span>{attendanceDays} {attendanceDays === 1 ? "dia com presença" : "dias com presença"} · meta de {plannedWeekly}x/semana</span></div><div className="adherence-ring" style={{ background: `conic-gradient(var(--accent) ${adherence * 3.6}deg, var(--surface-3) 0deg)` }}><span>{attendanceDays}</span><small>presenças</small></div></article>}<div className="performance-section"><div className="section-heading"><div><p>FREQUÊNCIA</p><h2>Treinos nas últimas 6 semanas</h2></div></div>{history.length ? <article className="chart-card"><MetricBars items={weekly} /></article> : <article className="data-empty"><strong>O gráfico será ativado no primeiro treino</strong><p>Se preferir, use o check-in para registrar que você compareceu hoje.</p></article>}</div><div className="section-heading"><div><p>INDICADORES PESSOAIS</p><h2>Dados de referência</h2></div></div><div className="performance-kpis"><article><p>IMC</p><strong>{bmi !== null ? formatMetric(bmi) : "—"}</strong><span>{bmiCategory(bmi, age)}</span></article><article><p>Cintura/altura</p><strong>{waistRatio !== null ? formatMetric(waistRatio, 2) : "—"}</strong><span>{waistRatioCategory(waistRatio)}</span></article><article><p>Atividade semanal</p><strong>{profile.weeklyActivityMinutes || 0}</strong><span>minutos informados</span></article><article><p>Gasto em repouso</p><strong>{restingEnergy ? `${restingEnergy}` : "—"}</strong><span>{restingEnergy ? "kcal/dia estimadas" : "sexo biológico opcional"}</span></article></div><div className="performance-section"><div className="section-heading"><div><p>CARGA DE TREINO</p><h2>Volume registrado</h2></div></div>{volumeItems.length ? <article className="chart-card"><MetricBars items={volumeItems} suffix=" kg" /></article> : <article className="data-empty"><strong>Registre carga e repetições</strong><p>O volume aparecerá depois dos primeiros treinos registrados.</p></article>}</div><div className="performance-section"><div className="section-heading"><div><p>COMPOSIÇÃO CORPORAL</p><h2>Tendência de peso</h2></div></div>{weightItems.length > 1 ? <article className="chart-card"><MetricBars items={weightItems} suffix=" kg" relative /></article> : <article className="data-empty"><strong>Mais uma medição libera a tendência</strong><p>Atualize seu peso em outra data para comparar a evolução.</p></article>}</div><div className="section-heading"><div><p>ATIVIDADE</p><h2>Histórico recente</h2></div><span className="version-badge">{minutes} min</span></div>{activities.length ? <div className="activity-list">{activities.map((item) => <article key={item.id}><span aria-hidden="true">{item.type === "Check-in" ? "✓" : "↗"}</span><div><small>{item.type}</small><strong>{item.title}</strong><p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.date))} · {item.meta}</p></div></article>)}</div> : <article className="data-empty"><strong>Nenhuma atividade registrada</strong><p>Seu primeiro check-in aparecerá aqui.</p></article>}<details className="methodology-card"><summary>Sobre estas métricas</summary><p>As métricas ajudam no acompanhamento pessoal e usam os dados informados no perfil e nos treinos. Não substituem avaliação clínica, diagnóstico ou orientação nutricional.</p></details></section>;
}

function PerformanceLegacy({ profile, history, checkIns, measurements, setTab }: { profile: Profile; history: WorkoutHistory[]; checkIns: CheckIn[]; measurements: BodyMeasurement[]; setTab: (tab: AppTab) => void }) {
  const [now] = useState(() => Date.now());
  const age = calculateAge(profile.birthDate);
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);
  const waistRatio = waistToHeightRatio(profile.waistCm, profile.heightCm);
  const restingEnergy = estimateRestingEnergy(profile.weightKg, profile.heightCm, age, profile.biologicalSex);
  const weekly = buildWeeklySessions(history);
  const recent28Days = history.filter((item) => now - new Date(item.completedAt).getTime() <= 28 * 86_400_000);
  const recentCheckIns = checkIns.filter((item) => now - new Date(item.checkedAt).getTime() <= 28 * 86_400_000);
  const attendanceDays = new Set([...recent28Days.map((item) => localDateKey(new Date(item.completedAt))), ...recentCheckIns.map((item) => localDateKey(new Date(item.checkedAt)))]).size;
  const observedWeeklyPace = attendanceDays / 4;
  const plannedWeekly = Math.max(profile.days.length, 1);
  const adherence = Math.min(100, Math.round((observedWeeklyPace / plannedWeekly) * 100));
  const projectedSessions = Math.round(observedWeeklyPace * 4);
  const duration = Number.parseInt(profile.duration, 10) || 45;
  const projectedMinutes = projectedSessions * duration;
  const weightProjection = linearProjection(measurements, 28);
  const latestE1rm = Math.max(...history.map((item) => item.estimatedOneRepMax || 0), 0);
  const volumeItems = [...history].filter((item) => (item.totalVolumeKg || 0) > 0).slice(0, 6).reverse().map((item, index) => ({ label: `T${index + 1}`, value: Math.round(item.totalVolumeKg || 0) }));
  const weightItems = [...measurements].slice(0, 6).reverse().map((item) => ({ label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(item.recordedAt)), value: item.weightKg }));
  const complete = Boolean(profile.birthDate && profile.heightCm && profile.weightKg && profile.activityLevel);
  const confidence = history.length >= 8 ? "mais estável" : history.length >= 3 ? "moderada" : "inicial";
  const hasActivity = history.length > 0 || checkIns.length > 0;
  const streak = attendanceStreak(checkIns, history);
  void hasActivity;
  void streak;

  return <section className="screen performance-screen"><div className="simple-header"><p>CIÊNCIA + CONSISTÊNCIA</p><h1>Desempenho</h1></div>{!complete && <button className="profile-completion-card" onClick={() => setTab("profile")}><span>!</span><div><strong>Dados incompletos</strong><small>Edite o perfil para calcular IMC, cintura/altura e estimativas.</small></div><b>→</b></button>}<div className="performance-kpis"><article><p>IMC</p><strong>{bmi !== null ? formatMetric(bmi) : "—"}</strong><span>{bmiCategory(bmi, age)}</span></article><article><p>Cintura/altura</p><strong>{waistRatio !== null ? formatMetric(waistRatio, 2) : "—"}</strong><span>{waistRatioCategory(waistRatio)}</span></article><article><p>Atividade semanal</p><strong>{profile.weeklyActivityMinutes || 0}</strong><span>de 150 min moderados</span></article><article><p>Gasto em repouso</p><strong>{restingEnergy ? `${restingEnergy}` : "—"}</strong><span>{restingEnergy ? "kcal/dia estimadas" : "sexo biológico opcional"}</span></article></div><article className="adherence-card"><div><p>ADERÊNCIA ESTIMADA</p><strong>{adherence}%</strong><span>{formatMetric(observedWeeklyPace, 1)} de {plannedWeekly} treinos/semana</span></div><div className="adherence-ring" style={{ background: `conic-gradient(var(--accent) ${adherence * 3.6}deg, var(--surface-3) 0deg)` }}><span>{recent28Days.length}</span><small>28 dias</small></div></article><div className="performance-section"><div className="section-heading"><div><p>FREQUÊNCIA</p><h2>Treinos nas últimas 6 semanas</h2></div></div><article className="chart-card"><MetricBars items={weekly} /></article></div><div className="performance-section"><div className="section-heading"><div><p>CARGA DE TREINO</p><h2>Volume registrado</h2></div></div>{volumeItems.length ? <article className="chart-card"><MetricBars items={volumeItems} suffix=" kg" />{latestE1rm > 0 && <p className="chart-footnote">Maior força estimada recente: {formatMetric(latestE1rm)} kg. Estimativa válida apenas para séries de até 10 repetições.</p>}</article> : <article className="data-empty"><strong>Registre carga e repetições</strong><p>O gráfico de volume e a força estimada aparecerão após os próximos treinos.</p></article>}</div><div className="performance-section"><div className="section-heading"><div><p>COMPOSIÇÃO CORPORAL</p><h2>Tendência de peso</h2></div></div>{weightItems.length ? <article className="chart-card"><MetricBars items={weightItems} suffix=" kg" relative /></article> : <article className="data-empty"><strong>Sem medições</strong><p>Atualize seu peso no perfil para criar a linha histórica.</p></article>}</div><div className="section-heading"><div><p>PRÓXIMAS 4 SEMANAS</p><h2>Previsões conservadoras</h2></div><span className="version-badge">confiança {confidence}</span></div><div className="forecast-grid"><article><span>01</span><strong>{projectedSessions} treinos</strong><p>Projeção se o ritmo recente for mantido.</p></article><article><span>02</span><strong>{projectedMinutes} minutos</strong><p>Estimativa baseada na duração planejada.</p></article><article><span>03</span><strong>{weightProjection ? `${weightProjection.change >= 0 ? "+" : ""}${formatMetric(weightProjection.change)} kg` : "Aguardando dados"}</strong><p>{weightProjection ? `Tendência matemática para ${formatMetric(weightProjection.projected)} kg; não é meta.` : "São necessárias medições em datas separadas."}</p></article></div><details className="methodology-card"><summary>Como calculamos</summary><p><strong>IMC:</strong> peso ÷ altura². É triagem, não mede gordura diretamente.</p><p><strong>Cintura/altura:</strong> cintura ÷ altura; abaixo de 0,50 é a referência prática.</p><p><strong>Atividade:</strong> comparação com 150 minutos moderados por semana e força em 2 dias.</p><p><strong>Gasto de repouso:</strong> equação de Mifflin–St Jeor; não é meta de ingestão.</p><p><strong>Força estimada:</strong> fórmula de Epley aplicada apenas a 1–10 repetições.</p><div><a href="https://www.cdc.gov/bmi/faq/" target="_blank" rel="noreferrer">CDC · IMC</a><a href="https://www.nice.org.uk/guidance/ng246/chapter/Identifying-and-assessing-overweight-obesity-and-central-adiposity" target="_blank" rel="noreferrer">NICE · cintura/altura</a><a href="https://www.who.int/initiatives/behealthy/physical-activity" target="_blank" rel="noreferrer">OMS · atividade física</a></div></details><p className="performance-disclaimer">Métricas e previsões servem para acompanhamento pessoal. Não substituem avaliação clínica, diagnóstico ou orientação nutricional.</p></section>;
}

function History({ history }: { history: WorkoutHistory[] }) {
  const minutes = history.reduce((total, item) => total + item.durationMinutes, 0);
  return <section className="screen"><div className="simple-header"><p>EVOLUÇÃO</p><h1>Histórico</h1></div><article className="history-summary"><div><span>{history.length}</span><small>treinos</small></div><div><span>{minutes}</span><small>minutos</small></div><div><span>{history.length ? `${Math.min(history.length, 7)}x` : "—"}</span><small>sequência</small></div></article><div className="section-heading"><div><p>ATIVIDADE</p><h2>Últimos treinos</h2></div></div>{history.length ? <div className="history-list">{history.map((item) => <article key={item.id}><div><strong>{item.workoutName}</strong><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.completedAt))}</small></div><span>{item.completedExercises}/{item.totalExercises}<small>exercícios</small></span></article>)}</div> : <article className="large-empty-state compact-state"><div className="calendar-glyph">01</div><h2>O começo fica registrado aqui.</h2><p>Ao concluir o primeiro treino, você verá duração e exercícios concluídos.</p></article>}</section>;
}

function playTimerSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 740;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.28);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  } catch {
    // Audio feedback is optional and never blocks the workout.
  }
}

function AdaptiveWorkoutSession({ session, preferences, onExit, onPersist, onFinish }: { session: ActiveWorkoutSession; preferences: AppPreferences; onExit: () => void; onPersist: (session: ActiveWorkoutSession) => void; onFinish: (session: ActiveWorkoutSession) => void }) {
  const normalizedSession = normalizeActiveWorkoutSession(session);
  const [state, setState] = useState(normalizedSession);
  const stateRef = useRef(normalizedSession);
  const onPersistRef = useRef(onPersist);
  const [now, setNow] = useState(() => Date.now());
  const [exitPrompt, setExitPrompt] = useState(false);
  const [quickAction, setQuickAction] = useState<"substitute" | "pain" | null>(null);
  const [substitutionReason, setSubstitutionReason] = useState("Equipamento indisponível");
  const [selectedAlternative, setSelectedAlternative] = useState("");
  const [painRegion, setPainRegion] = useState("");
  const [painIntensity, setPainIntensity] = useState("0");
  const readiness = sessionReadiness(state);
  const baseItems = [...state.workout.warmup, ...state.workout.main, ...state.workout.cooldown];
  const items = baseItems.map((item) => {
    let adjusted = item;
    if (state.workout.main.includes(item)) {
      if (readiness === "muito baixa") adjusted = { ...item, sets: 1, targetRpe: "RPE 3-4", note: `${item.note} Sessão convertida em recuperação leve.` };
      else if (readiness === "baixa") adjusted = { ...item, sets: effectiveSets(item.sets, readiness), targetRpe: "RPE 4-5", note: `${item.note} Volume reduzido pela prontidão de hoje.` };
      else if (readiness === "moderada") adjusted = { ...item, note: `${item.note} Use cerca de 5% menos carga ou retire uma série acessória.` };
    }
    const replacement = exercises.find((exercise) => exercise.id === state.exerciseOverrides[item.exercise.id]);
    return replacement ? { ...adjusted, exercise: replacement, note: `${adjusted.note} Substituição registrada nesta sessão.` } : adjusted;
  });
  const current = items[state.currentExerciseIndex];
  const currentSlotId = baseItems[state.currentExerciseIndex]?.exercise.id || current?.exercise.id || "";
  const restRemaining = getRestRemainingSeconds(state, now);
  const elapsed = getElapsedSeconds(state, now);
  useEffect(() => {
    stateRef.current = state;
    onPersistRef.current = onPersist;
    onPersist(state);
  }, [state, onPersist]);

  useEffect(() => {
    if (state.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "active" || !preferences.keepAwake) return;
    const navigatorWithWakeLock = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    let wakeLock: { release: () => Promise<void> } | undefined;
    navigatorWithWakeLock.wakeLock?.request("screen").then((lock) => { wakeLock = lock; }).catch(() => undefined);
    return () => { void wakeLock?.release().catch(() => undefined); };
  }, [preferences.keepAwake, state.status]);

  useEffect(() => {
    if (!state.restEndsAt || restRemaining > 0) return;
    if (preferences.sound) playTimerSound();
    void hapticImpact(preferences.vibration);
    setState((currentState) => skipRest(currentState));
  }, [preferences.sound, preferences.vibration, restRemaining, state.restEndsAt]);

  useEffect(() => {
    const handleVisibility = () => { if (document.visibilityState === "hidden") onPersistRef.current(stateRef.current); };
    const handleBack = () => {
      setExitPrompt(true);
      window.history.pushState({ angelsFitSession: true }, "");
    };
    window.history.pushState({ angelsFitSession: true }, "");
    window.addEventListener("popstate", handleBack);
    document.addEventListener("visibilitychange", handleVisibility);
    let removeNativeListener: () => void = () => undefined;
    void registerNativeBackButton(() => setExitPrompt(true)).then((remove) => { removeNativeListener = remove; });
    return () => {
      window.removeEventListener("popstate", handleBack);
      document.removeEventListener("visibilitychange", handleVisibility);
      removeNativeListener();
    };
  }, []);

  function patch(patchValue: Partial<ActiveWorkoutSession>) {
    setState((currentState) => patchActiveSession(currentState, patchValue));
  }

  function patchMap(field: "loads" | "actualReps" | "rir", exerciseId: string, value: string) {
    setState((currentState) => patchActiveSession(currentState, { [field]: { ...currentState[field], [exerciseId]: value } }));
  }

  function toggleSeries(series: number) {
    if (!current || !currentSlotId) return;
    setState((currentState) => {
      const currentDone = currentState.completedSeries[currentSlotId] || [];
      const completing = !currentDone.includes(series);
      let next = patchActiveSession(currentState, {
        completedSeries: {
          ...currentState.completedSeries,
          [currentSlotId]: completing ? [...currentDone, series].sort((a, b) => a - b) : currentDone.filter((item) => item !== series),
        },
      });
      if (completing && current.rest > 0) next = startRest(next, current.rest);
      return next;
    });
    void hapticImpact(preferences.vibration);
  }

  function replaceCurrentExercise() {
    if (!current || !currentSlotId || !selectedAlternative) return;
    setState((currentState) => patchActiveSession(currentState, {
      exerciseOverrides: { ...currentState.exerciseOverrides, [currentSlotId]: selectedAlternative },
      substitutions: [...currentState.substitutions, {
        fromExerciseId: currentSlotId,
        toExerciseId: selectedAlternative,
        reason: substitutionReason,
        changedAt: new Date().toISOString(),
      }],
    }));
    setQuickAction(null);
    setSelectedAlternative("");
    void hapticImpact(preferences.vibration);
  }

  function registerPainEvent() {
    if (!current || !currentSlotId || !painRegion || Number(painIntensity) < 1) return;
    setState((currentState) => patchActiveSession(currentState, {
      painEvents: [...currentState.painEvents, {
        exerciseId: currentSlotId,
        region: painRegion,
        intensity: Number(painIntensity),
        recordedAt: new Date().toISOString(),
      }],
    }));
    setQuickAction(null);
    setPainRegion("");
    setPainIntensity("0");
    void hapticImpact(preferences.vibration);
  }

  if (state.status === "setup") return <main className="session-shell session-setup"><header className="session-header"><button className="session-close" onClick={() => setExitPrompt(true)}>Fechar</button><div><small>TREINO DO DIA</small><strong>{state.workout.name}</strong></div><span>{items.length} mov.</span></header><section className="session-setup-content"><p className="eyebrow">CHECK-IN DE PRONTIDÃO</p><h1>Como você chega hoje?</h1><p className="setup-lead">Leva menos de 15 segundos. As respostas ajustam a sessão sem bloquear o treino.</p><div className="readiness-grid"><label>Horas de sono<input type="number" inputMode="decimal" min="0" max="14" step="0.5" value={state.sleepLastNight} onChange={(event) => patch({ sleepLastNight: event.target.value })} /></label><label>Energia (1-5)<input type="number" inputMode="numeric" min="1" max="5" value={state.energy} onChange={(event) => patch({ energy: event.target.value })} /></label><label>Estresse (1-5)<input type="number" inputMode="numeric" min="1" max="5" value={state.stress} onChange={(event) => patch({ stress: event.target.value })} /></label><label>Dor atual (0-10)<input type="number" inputMode="numeric" min="0" max="10" value={state.painBefore} onChange={(event) => patch({ painBefore: event.target.value })} /></label></div><label className="readiness-check"><input type="checkbox" checked={state.newPain} onChange={(event) => patch({ newPain: event.target.checked })} /><span>Tenho dor nova, tontura, falta de ar incomum ou piora relevante.</span></label><label className="readiness-check"><input type="checkbox" checked={state.postpartumAlert} onChange={(event) => patch({ postpartumAlert: event.target.checked })} /><span>Tenho sangramento aumentado, dor na cicatriz, peso pélvico ou escape urinário novo.</span></label><article className={`readiness-result readiness-${readiness.replace(" ", "-")}`}><small>RECOMENDAÇÃO DE HOJE</small><strong>Prontidão {readiness}</strong><p>{readiness === "atenção" ? "Sinais registrados. Ajuste o esforço ao seu conforto e considere orientação profissional." : readiness === "muito baixa" ? "O treino será convertido em sessão leve." : readiness === "baixa" ? "O volume será reduzido em aproximadamente 30%." : readiness === "moderada" ? "Mantenha os movimentos com carga menor ou menos acessórios." : "Siga a prescrição planejada."}</p></article><div className="cardio-setup-card"><span aria-hidden="true">♥</span><label>Duração do cardio (min)<input type="number" inputMode="numeric" min="0" max="120" value={state.cardioMinutes} onChange={(event) => patch({ cardioMinutes: event.target.value })} placeholder="Ex.: 20" /></label><label>Intensidade<select value={state.cardioIntensity} onChange={(event) => patch({ cardioIntensity: event.target.value })}><option value="">Selecione</option><option>Leve</option><option>Moderada</option><option>Intensa</option><option>Sem cardio hoje</option></select></label></div><button className="primary-button" disabled={!state.sleepLastNight || !state.energy || !state.stress || state.painBefore === "" || !state.cardioIntensity || (state.cardioIntensity !== "Sem cardio hoje" && (!state.cardioMinutes || Number(state.cardioMinutes) < 1))} onClick={() => setState((currentState) => beginActiveSession(currentState))}>Aplicar ajuste e começar <span>→</span></button></section>{exitPrompt && <ConfirmDialog title="Sair do treino?" description="O check-in e o progresso já estão salvos neste aparelho." confirmLabel="Salvar e sair" onConfirm={onExit} onCancel={() => setExitPrompt(false)} />}</main>;

  if (state.status === "feedback") return <main className="session-shell session-feedback"><header className="session-header"><button className="session-close" onClick={() => setState((currentState) => patchActiveSession(currentState, { status: "active", elapsedStartedAt: new Date().toISOString() }))}>← Voltar</button><div><small>AVALIAÇÃO FINAL</small><strong>{state.workout.name}</strong></div><span>{Math.round(elapsed / 60)} min</span></header><section className="session-setup-content"><p className="eyebrow">RESPOSTA AO TREINO</p><h1>Como foi a sessão?</h1><p className="setup-lead">Esses dados ficam no histórico e ajudam a acompanhar sua evolução.</p><div className="readiness-grid"><label>Esforço da sessão (RPE 1-10)<input type="number" min="1" max="10" value={state.sessionRpe} onChange={(event) => patch({ sessionRpe: event.target.value })} /></label><label>Dor ao terminar (0-10)<input type="number" min="0" max="10" value={state.painAfter} onChange={(event) => patch({ painAfter: event.target.value })} /></label></div><p className="field-title">Sintomas durante ou logo após</p><div className="condition-grid symptom-grid">{postpartumSymptomOptions.map((item) => <button type="button" key={item.id} aria-pressed={state.postSymptoms.includes(item.id)} className={state.postSymptoms.includes(item.id) ? "selected warning" : ""} onClick={() => patch({ postSymptoms: state.postSymptoms.includes(item.id) ? state.postSymptoms.filter((value) => value !== item.id) : [...state.postSymptoms, item.id] })}>{item.label}</button>)}</div>{state.postSymptoms.length > 0 && <article className="readiness-result readiness-atenção"><strong>Sintomas registrados</strong><p>As informações ficarão visíveis no resumo da sessão.</p></article>}<button className="primary-button" disabled={!state.sessionRpe || state.painAfter === ""} onClick={() => onFinish(state)}>Salvar e concluir <span>✓</span></button></section></main>;

  if (!current) return <main className="session-shell"><section className="large-empty-state compact-state"><div className="dialog-icon">!</div><h2>Não foi possível abrir este exercício</h2><p>Seu progresso está salvo. Volte à tela Hoje e tente novamente.</p><button className="reset-filters" onClick={onExit}>Voltar para Hoje</button></section></main>;

  const doneSeries = state.completedSeries[currentSlotId] || [];
  const alternative = exercises.find((item) => current.exercise.alternativeIds.includes(item.id));
  const alternatives = exercises.filter((exercise) => exercise.id !== current.exercise.id && (current.exercise.alternativeIds.includes(exercise.id) || exercise.movement === current.exercise.movement)).slice(0, 6);
  const currentPains = state.painEvents.filter((event) => event.exerciseId === currentSlotId);
  return (
    <main className="session-shell">
      <header className="session-header"><button className="session-close" onClick={() => setExitPrompt(true)}>Fechar</button><div><small>{state.workout.name}</small><strong>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</strong></div><span>{state.currentExerciseIndex + 1}/{items.length}</span></header>
      <div className="session-progress"><span style={{ width: `${((state.currentExerciseIndex + 1) / items.length) * 100}%` }} /></div>
      <section className="session-content">
        <p className="eyebrow">{state.currentExerciseIndex < state.workout.warmup.length ? "AQUECIMENTO E MOBILIDADE" : state.currentExerciseIndex >= state.workout.warmup.length + state.workout.main.length ? "ENCERRAMENTO E ALONGAMENTO" : "PARTE PRINCIPAL"}</p>
        <h1>{current.exercise.name}</h1>
        <p className="muscle-line">{current.exercise.muscleGroups.join(" · ")} · {current.exercise.equipment}</p>
        {state.exerciseOverrides[currentSlotId] && <span className="substitution-badge">Exercício substituído nesta sessão</span>}
        <div className="prescription-grid"><div><small>SÉRIES</small><strong>{current.sets}</strong></div><div><small>REPETIÇÕES</small><strong>{current.reps}</strong></div><div><small>DESCANSO</small><strong>{current.rest ? `${current.rest}s` : "—"}</strong></div><div><small>ESFORÇO</small><strong>{current.targetRpe}</strong></div></div>
        {restRemaining > 0 && <div className="rest-timer rest-timer-expanded"><span>DESCANSO</span><strong>{Math.floor(restRemaining / 60).toString().padStart(2, "0")}:{(restRemaining % 60).toString().padStart(2, "0")}</strong><small>Próximo: {doneSeries.length < current.sets ? `série ${doneSeries.length + 1}` : items[state.currentExerciseIndex + 1]?.exercise.name || "finalização"}</small><div><button onClick={() => setState((currentState) => addRestSeconds(currentState, 15))}>+15 s</button>{state.restPausedSeconds === null ? <button onClick={() => setState((currentState) => pauseRest(currentState))}>Pausar</button> : <button onClick={() => setState((currentState) => resumeRest(currentState))}>Retomar</button>}<button onClick={() => setState((currentState) => skipRest(currentState))}>Pular</button></div></div>}
        <div className="series-row" aria-label="Séries concluídas">{Array.from({ length: current.sets }, (_, series) => series + 1).map((series) => <button key={series} aria-pressed={doneSeries.includes(series)} className={doneSeries.includes(series) ? "done" : ""} onClick={() => toggleSeries(series)}>{doneSeries.includes(series) ? "✓" : series}</button>)}</div>
        <div className="session-fields three-fields"><label>Carga usada<input inputMode="decimal" value={state.loads[currentSlotId] || ""} onChange={(event) => patchMap("loads", currentSlotId, event.target.value)} placeholder={current.loadSuggestion} /></label><label>Repetições feitas<input inputMode="numeric" value={state.actualReps[currentSlotId] || ""} onChange={(event) => patchMap("actualReps", currentSlotId, event.target.value)} placeholder={current.reps} /></label><label>RIR da série<input inputMode="numeric" type="number" min="0" max="10" value={state.rir[currentSlotId] || ""} onChange={(event) => patchMap("rir", currentSlotId, event.target.value)} placeholder="Ex.: 3" /></label></div>
        <ExerciseDemo key={current.exercise.id} exerciseId={current.exercise.id} exerciseName={current.exercise.name} compact />
        <details className="technique-card" open><summary>Como executar</summary><p>{current.exercise.instructions}</p><small>Cadência: {current.tempo}</small></details>
        <details className="technique-card"><summary>Erros e alternativa</summary><p>{current.exercise.commonErrors}</p>{alternative && <small>Alternativa sugerida: {alternative.name}</small>}</details>
        <p className="individual-note">{current.note}</p>
        <label className="session-note">Anotação deste exercício<textarea rows={3} value={state.notes[currentSlotId] || ""} onChange={(event) => setState((currentState) => patchActiveSession(currentState, { notes: { ...currentState.notes, [currentSlotId]: event.target.value } }))} placeholder="Carga, ajuste do banco, sensação ou observação…" /></label>
        <div className="session-quick-actions"><button onClick={() => { setSelectedAlternative(alternatives[0]?.id || ""); setQuickAction("substitute"); }}>↻ Substituir exercício</button><button onClick={() => setQuickAction("pain")}>! Registrar desconforto</button></div>
        {currentPains.length > 0 && <div className="pain-event-list">{currentPains.map((event) => <span key={event.recordedAt}>{event.region} · {event.intensity}/10</span>)}</div>}
      </section>
      <footer className="session-nav"><button disabled={state.currentExerciseIndex === 0} onClick={() => patch({ currentExerciseIndex: Math.max(0, state.currentExerciseIndex - 1) })}>← Voltar</button>{state.currentExerciseIndex < items.length - 1 ? <button className="next" onClick={() => patch({ currentExerciseIndex: Math.min(items.length - 1, state.currentExerciseIndex + 1) })}>Próximo →</button> : <button className="next" onClick={() => setState((currentState) => enterFeedback(currentState))}>Revisar sessão →</button>}</footer>
      {quickAction === "substitute" && <div className="bottom-sheet-backdrop" role="presentation" onClick={() => setQuickAction(null)}><section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="substitution-title" onClick={(event) => event.stopPropagation()}><header><div><small>AJUSTE DA SESSÃO</small><h2 id="substitution-title">Substituir exercício</h2></div><button aria-label="Fechar" onClick={() => setQuickAction(null)}>×</button></header><p>Escolha uma alternativa para {current.exercise.name}. O histórico manterá o motivo da troca.</p><div className="sheet-options">{alternatives.map((exercise) => <button key={exercise.id} aria-pressed={selectedAlternative === exercise.id} onClick={() => setSelectedAlternative(exercise.id)}><strong>{exercise.name}</strong><small>{exercise.equipment} · {exercise.muscleGroups.join(" · ")}</small></button>)}</div><label>Motivo<select value={substitutionReason} onChange={(event) => setSubstitutionReason(event.target.value)}><option>Equipamento indisponível</option><option>Desconforto ou dor</option><option>Preferência pessoal</option><option>Outro</option></select></label><button className="sheet-primary" disabled={!selectedAlternative} onClick={replaceCurrentExercise}>Aplicar substituição</button></section></div>}
      {quickAction === "pain" && <div className="bottom-sheet-backdrop" role="presentation" onClick={() => setQuickAction(null)}><section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="pain-title" onClick={(event) => event.stopPropagation()}><header><div><small>SEGURANÇA</small><h2 id="pain-title">Registrar desconforto</h2></div><button aria-label="Fechar" onClick={() => setQuickAction(null)}>×</button></header><p>O registro fica associado a {current.exercise.name} e aparece no resumo do treino.</p><label>Região do corpo<input value={painRegion} onChange={(event) => setPainRegion(event.target.value)} placeholder="Ex.: joelho direito" /></label><label>Intensidade: <strong>{painIntensity}/10</strong><input type="range" min="0" max="10" value={painIntensity} onChange={(event) => setPainIntensity(event.target.value)} /></label><div className="safety-note"><span>!</span><p>Interrompa o exercício em caso de dor aguda, tontura, falta de ar incomum ou piora relevante.</p></div><button className="sheet-primary danger" disabled={!painRegion.trim() || Number(painIntensity) < 1} onClick={registerPainEvent}>Salvar registro</button></section></div>}
      {exitPrompt && <ConfirmDialog title="Sair do treino?" description="Exercício, séries, carga, repetições e timer já estão salvos." confirmLabel="Salvar e sair" onConfirm={onExit} onCancel={() => setExitPrompt(false)} />}
    </main>
  );
}

function AdaptiveWorkoutSessionLegacy({ workout, onExit, onFinish }: { workout: GeneratedWorkout; onExit: () => void; onFinish: (workout: GeneratedWorkout, completedExercises: number, elapsedSeconds: number, metrics: { totalVolumeKg: number; estimatedOneRepMax: number; cardioMinutes: number; cardioIntensity: string; sessionRpe: number; averageRir: number; painScore: number; symptoms: string[] }) => void }) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState(0);
  const [completedSeries, setCompletedSeries] = useState<Record<string, number[]>>({});
  const [loads, setLoads] = useState<Record<string, string>>({});
  const [actualReps, setActualReps] = useState<Record<string, string>>({});
  const [rir, setRir] = useState<Record<string, string>>({});
  const [exitPrompt, setExitPrompt] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [cardioMinutes, setCardioMinutes] = useState("");
  const [cardioIntensity, setCardioIntensity] = useState("");
  const [sleepLastNight, setSleepLastNight] = useState("");
  const [energy, setEnergy] = useState("");
  const [stress, setStress] = useState("");
  const [painBefore, setPainBefore] = useState("");
  const [newPain, setNewPain] = useState(false);
  const [postpartumAlert, setPostpartumAlert] = useState(false);
  const [sessionRpe, setSessionRpe] = useState("");
  const [painAfter, setPainAfter] = useState("");
  const [postSymptoms, setPostSymptoms] = useState<string[]>([]);

  const penalty = (Number(sleepLastNight) < 6 ? 2 : Number(sleepLastNight) < 7 ? 1 : 0) + (Number(energy) <= 2 ? 2 : Number(energy) === 3 ? 1 : 0) + (Number(stress) >= 4 ? 2 : Number(stress) === 3 ? 1 : 0) + (Number(painBefore) >= 4 ? 2 : Number(painBefore) >= 2 ? 1 : 0);
  const readiness = newPain || postpartumAlert || Number(painBefore) >= 7 ? "atenção" : penalty >= 6 ? "muito baixa" : penalty >= 4 ? "baixa" : penalty >= 2 ? "moderada" : "alta";
  const baseItems = [...workout.warmup, ...workout.main, ...workout.cooldown];
  const items = baseItems.map((item) => {
    if (!workout.main.includes(item)) return item;
    if (readiness === "muito baixa") return { ...item, sets: 1, targetRpe: "RPE 3-4", note: `${item.note} Sessão convertida em recuperação leve.` };
    if (readiness === "baixa") return { ...item, sets: Math.max(1, Math.ceil(item.sets * 0.7)), targetRpe: "RPE 4-5", note: `${item.note} Volume reduzido pela prontidão de hoje.` };
    if (readiness === "moderada") return { ...item, note: `${item.note} Use cerca de 5% menos carga ou retire uma série acessória.` };
    return item;
  });
  const current = items[index];

  useEffect(() => {
    if (!sessionStarted || showFeedback) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    const navigatorWithWakeLock = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    let wakeLock: { release: () => Promise<void> } | undefined;
    navigatorWithWakeLock.wakeLock?.request("screen").then((lock) => { wakeLock = lock; }).catch(() => undefined);
    return () => { window.clearInterval(timer); wakeLock?.release().catch(() => undefined); };
  }, [sessionStarted, showFeedback]);

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setTimeout(() => setRest((value) => Math.max(0, value - 1)), 1000);
    if (rest === 1 && "vibrate" in navigator) navigator.vibrate?.(180);
    return () => window.clearTimeout(timer);
  }, [rest]);

  if (!current) return null;
  const doneSeries = completedSeries[current.exercise.id] || [];
  const completedExercises = items.filter((item) => (completedSeries[item.exercise.id] || []).length >= item.sets).length;
  const alternative = exercises.find((item) => current.exercise.alternativeIds.includes(item.id));

  function toggleSeries(series: number) {
    setCompletedSeries((state) => {
      const currentDone = state[current.exercise.id] || [];
      return { ...state, [current.exercise.id]: currentDone.includes(series) ? currentDone.filter((item) => item !== series) : [...currentDone, series] };
    });
    if (!doneSeries.includes(series) && current.rest > 0) setRest(current.rest);
  }

  function metrics() {
    let totalVolumeKg = 0;
    let estimatedOneRepMax = 0;
    for (const item of items) {
      const load = Number.parseFloat((loads[item.exercise.id] || "0").replace(",", "."));
      const repetitions = Number.parseInt(actualReps[item.exercise.id] || "0", 10);
      const setsDone = (completedSeries[item.exercise.id] || []).length;
      if (load > 0 && repetitions > 0 && setsDone > 0) totalVolumeKg += load * repetitions * setsDone;
      const estimate = epleyEstimatedOneRepMax(load, repetitions);
      if (estimate) estimatedOneRepMax = Math.max(estimatedOneRepMax, estimate);
    }
    const rirValues = Object.values(rir).map(Number).filter(Number.isFinite);
    return { totalVolumeKg: Math.round(totalVolumeKg), estimatedOneRepMax: Math.round(estimatedOneRepMax * 10) / 10, cardioMinutes: Number.parseInt(cardioMinutes || "0", 10), cardioIntensity, sessionRpe: Number(sessionRpe), averageRir: rirValues.length ? Math.round((rirValues.reduce((sum, value) => sum + value, 0) / rirValues.length) * 10) / 10 : 0, painScore: Number(painAfter), symptoms: postSymptoms };
  }

  if (!sessionStarted) return <main className="session-shell session-setup"><header className="session-header"><button className="session-close" onClick={() => setExitPrompt(true)}>Fechar</button><div><small>TREINO DO DIA</small><strong>{workout.name}</strong></div><span>{items.length} mov.</span></header><section className="session-setup-content"><p className="eyebrow">CHECK-IN DE PRONTIDÃO</p><h1>Como você chega hoje?</h1><p className="setup-lead">Registre como está se sentindo. As respostas orientam a recomendação, mas não bloqueiam o treino.</p><div className="readiness-grid"><label>Horas de sono<input type="number" inputMode="decimal" min="0" max="14" step="0.5" value={sleepLastNight} onChange={(event) => setSleepLastNight(event.target.value)} /></label><label>Energia (1-5)<input type="number" inputMode="numeric" min="1" max="5" value={energy} onChange={(event) => setEnergy(event.target.value)} /></label><label>Estresse (1-5)<input type="number" inputMode="numeric" min="1" max="5" value={stress} onChange={(event) => setStress(event.target.value)} /></label><label>Dor atual (0-10)<input type="number" inputMode="numeric" min="0" max="10" value={painBefore} onChange={(event) => setPainBefore(event.target.value)} /></label></div><label className="readiness-check"><input type="checkbox" checked={newPain} onChange={(event) => setNewPain(event.target.checked)} /><span>Tenho dor nova, tontura, falta de ar incomum ou piora relevante.</span></label><label className="readiness-check"><input type="checkbox" checked={postpartumAlert} onChange={(event) => setPostpartumAlert(event.target.checked)} /><span>Tenho sangramento aumentado, dor na cicatriz, peso pélvico ou escape urinário novo.</span></label><article className={`readiness-result readiness-${readiness.replace(" ", "-")}`}><small>RECOMENDAÇÃO DE HOJE</small><strong>Prontidão {readiness}</strong><p>{readiness === "atenção" ? "Sinais registrados. O treino continua disponível; ajuste o esforço ao seu conforto e considere orientação profissional." : readiness === "muito baixa" ? "O treino será convertido em sessão leve." : readiness === "baixa" ? "O volume será reduzido em aproximadamente 30%." : readiness === "moderada" ? "Mantenha os movimentos com carga menor ou menos acessórios." : "Siga a prescrição planejada."}</p></article><div className="cardio-setup-card"><span aria-hidden="true">♥</span><label>Duração do cardio (min)<input type="number" inputMode="numeric" min="0" max="120" value={cardioMinutes} onChange={(event) => setCardioMinutes(event.target.value)} placeholder="Ex.: 20" /></label><label>Intensidade<select value={cardioIntensity} onChange={(event) => setCardioIntensity(event.target.value)}><option value="">Selecione</option><option>Leve</option><option>Moderada</option><option>Intensa</option><option>Sem cardio hoje</option></select></label></div><button className="primary-button" disabled={!sleepLastNight || !energy || !stress || painBefore === "" || !cardioIntensity || (cardioIntensity !== "Sem cardio hoje" && (!cardioMinutes || Number(cardioMinutes) < 1))} onClick={() => setSessionStarted(true)}>Aplicar ajuste e começar <span>→</span></button></section>{exitPrompt && <ConfirmDialog title="Sair do treino?" description="A sessão ainda não foi iniciada." confirmLabel="Sair" onConfirm={onExit} onCancel={() => setExitPrompt(false)} />}</main>;

  if (showFeedback) return <main className="session-shell session-feedback"><header className="session-header"><button className="session-close" onClick={() => setShowFeedback(false)}>← Voltar</button><div><small>AVALIAÇÃO FINAL</small><strong>{workout.name}</strong></div><span>{Math.round(elapsed / 60)} min</span></header><section className="session-setup-content"><p className="eyebrow">RESPOSTA AO TREINO</p><h1>Como foi a sessão?</h1><p className="setup-lead">Esses dados registram sua resposta e ajudam a acompanhar a evolução.</p><div className="readiness-grid"><label>Esforço da sessão (RPE 1-10)<input type="number" min="1" max="10" value={sessionRpe} onChange={(event) => setSessionRpe(event.target.value)} /></label><label>Dor ao terminar (0-10)<input type="number" min="0" max="10" value={painAfter} onChange={(event) => setPainAfter(event.target.value)} /></label></div><p className="field-title">Sintomas durante ou logo após</p><div className="condition-grid symptom-grid">{postpartumSymptomOptions.map((item) => <button type="button" key={item.id} aria-pressed={postSymptoms.includes(item.id)} className={postSymptoms.includes(item.id) ? "selected warning" : ""} onClick={() => setPostSymptoms((current) => current.includes(item.id) ? current.filter((value) => value !== item.id) : [...current, item.id])}>{item.label}</button>)}</div>{postSymptoms.length > 0 && <article className="readiness-result readiness-atenção"><strong>Sintomas registrados</strong><p>As informações ficam no histórico e não bloqueiam o próximo treino ou a progressão do bloco.</p></article>}<button className="primary-button" disabled={!sessionRpe || painAfter === ""} onClick={() => onFinish(workout, completedExercises, elapsed, metrics())}>Salvar e concluir <span>✓</span></button></section></main>;

  return <main className="session-shell"><header className="session-header"><button className="session-close" onClick={() => setExitPrompt(true)}>Fechar</button><div><small>{workout.name}</small><strong>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</strong></div><span>{index + 1}/{items.length}</span></header><div className="session-progress"><span style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div><section className="session-content"><p className="eyebrow">{index < workout.warmup.length ? "AQUECIMENTO E MOBILIDADE" : index >= workout.warmup.length + workout.main.length ? "ENCERRAMENTO E ALONGAMENTO" : "PARTE PRINCIPAL"}</p><h1>{current.exercise.name}</h1><p className="muscle-line">{current.exercise.muscleGroups.join(" · ")} · {current.exercise.equipment}</p><div className="prescription-grid"><div><small>SÉRIES</small><strong>{current.sets}</strong></div><div><small>REPETIÇÕES</small><strong>{current.reps}</strong></div><div><small>DESCANSO</small><strong>{current.rest ? `${current.rest}s` : "—"}</strong></div><div><small>ESFORÇO</small><strong>{current.targetRpe}</strong></div></div>{rest > 0 && <div className="rest-timer"><span>DESCANSO</span><strong>{rest}s</strong><button onClick={() => setRest(0)}>Pular</button></div>}<div className="series-row" aria-label="Séries concluídas">{Array.from({ length: current.sets }, (_, series) => series + 1).map((series) => <button key={series} aria-pressed={doneSeries.includes(series)} className={doneSeries.includes(series) ? "done" : ""} onClick={() => toggleSeries(series)}>{doneSeries.includes(series) ? "✓" : series}</button>)}</div><div className="session-fields three-fields"><label>Carga usada<input inputMode="decimal" value={loads[current.exercise.id] || ""} onChange={(event) => setLoads({ ...loads, [current.exercise.id]: event.target.value })} placeholder={current.loadSuggestion} /></label><label>Repetições feitas<input inputMode="numeric" value={actualReps[current.exercise.id] || ""} onChange={(event) => setActualReps({ ...actualReps, [current.exercise.id]: event.target.value })} placeholder={current.reps} /></label><label>RIR da série<input inputMode="numeric" type="number" min="0" max="10" value={rir[current.exercise.id] || ""} onChange={(event) => setRir({ ...rir, [current.exercise.id]: event.target.value })} placeholder="Ex.: 3" /></label></div><ExerciseDemo key={current.exercise.id} exerciseId={current.exercise.id} exerciseName={current.exercise.name} compact /><details className="technique-card" open><summary>Como executar</summary><p>{current.exercise.instructions}</p><small>Cadência: {current.tempo}</small></details><details className="technique-card"><summary>Erros e alternativa</summary><p>{current.exercise.commonErrors}</p>{alternative && <small>Alternativa sugerida: {alternative.name}</small>}</details><p className="individual-note">{current.note}</p></section><footer className="session-nav"><button disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>← Voltar</button>{index < items.length - 1 ? <button className="next" onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))}>Próximo →</button> : <button className="next" onClick={() => setShowFeedback(true)}>Revisar sessão →</button>}</footer>{exitPrompt && <ConfirmDialog title="Sair do treino?" description="A sessão ainda não foi concluída. Os dados preenchidos serão descartados." confirmLabel="Descartar sessão" onConfirm={onExit} onCancel={() => setExitPrompt(false)} />}</main>;
}

function WorkoutSession({ workout, onExit, onFinish }: { workout: GeneratedWorkout; onExit: () => void; onFinish: (workout: GeneratedWorkout, completedExercises: number, elapsedSeconds: number, metrics: { totalVolumeKg: number; estimatedOneRepMax: number; cardioMinutes: number; cardioIntensity: string }) => void }) {
  const items = [...workout.warmup, ...workout.main, ...workout.cooldown];
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState(0);
  const [completedSeries, setCompletedSeries] = useState<Record<string, number[]>>({});
  const [loads, setLoads] = useState<Record<string, string>>({});
  const [actualReps, setActualReps] = useState<Record<string, string>>({});
  const [exitPrompt, setExitPrompt] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [cardioMinutes, setCardioMinutes] = useState("");
  const [cardioIntensity, setCardioIntensity] = useState("");
  const current = items[index];

  useEffect(() => {
    if (!sessionStarted) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    const navigatorWithWakeLock = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    let wakeLock: { release: () => Promise<void> } | undefined;
    navigatorWithWakeLock.wakeLock?.request("screen").then((lock) => { wakeLock = lock; }).catch(() => undefined);
    return () => { window.clearInterval(timer); wakeLock?.release().catch(() => undefined); };
  }, [sessionStarted]);

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setTimeout(() => setRest((value) => Math.max(0, value - 1)), 1000);
    if (rest === 1 && "vibrate" in navigator) navigator.vibrate?.(180);
    return () => window.clearTimeout(timer);
  }, [rest]);

  if (!current) return null;
  const doneSeries = completedSeries[current.exercise.id] || [];
  const completedExercises = items.filter((item) => (completedSeries[item.exercise.id] || []).length >= item.sets).length;
  const alternative = exercises.find((item) => current.exercise.alternativeIds.includes(item.id));

  function toggleSeries(series: number) {
    setCompletedSeries((state) => {
      const currentDone = state[current.exercise.id] || [];
      return { ...state, [current.exercise.id]: currentDone.includes(series) ? currentDone.filter((item) => item !== series) : [...currentDone, series] };
    });
    if (!doneSeries.includes(series) && current.rest > 0) setRest(current.rest);
  }

  function calculateSessionMetrics() {
    let totalVolumeKg = 0;
    let estimatedOneRepMax = 0;
    for (const item of items) {
      const load = Number.parseFloat((loads[item.exercise.id] || "0").replace(",", "."));
      const repetitions = Number.parseInt(actualReps[item.exercise.id] || "0", 10);
      const setsDone = (completedSeries[item.exercise.id] || []).length;
      if (load > 0 && repetitions > 0 && setsDone > 0) totalVolumeKg += load * repetitions * setsDone;
      const estimate = epleyEstimatedOneRepMax(load, repetitions);
      if (estimate) estimatedOneRepMax = Math.max(estimatedOneRepMax, estimate);
    }
    return { totalVolumeKg: Math.round(totalVolumeKg), estimatedOneRepMax: Math.round(estimatedOneRepMax * 10) / 10, cardioMinutes: Number.parseInt(cardioMinutes || "0", 10), cardioIntensity };
  }

  if (!sessionStarted) return <main className="session-shell session-setup"><header className="session-header"><button className="session-close" onClick={() => setExitPrompt(true)}>Fechar</button><div><small>TREINO DO DIA</small><strong>{workout.name}</strong></div><span>{items.length} mov.</span></header><section className="session-setup-content"><p className="eyebrow">ANTES DE COMEÇAR</p><h1>Planeje seu cardio</h1><p className="setup-lead">Registre a duração e a intensidade planejadas. Esses dados entrarão no seu histórico ao concluir a sessão.</p><div className="cardio-setup-card"><span aria-hidden="true">♥</span><label>Duração do cardio (min)<input type="number" inputMode="numeric" min="0" max="120" value={cardioMinutes} onChange={(event) => setCardioMinutes(event.target.value)} placeholder="Ex.: 20" /></label><label>Intensidade<select value={cardioIntensity} onChange={(event) => setCardioIntensity(event.target.value)}><option value="">Selecione</option><option>Leve</option><option>Moderada</option><option>Intensa</option><option>Sem cardio hoje</option></select></label></div><div className="setup-summary"><strong>3 blocos</strong><span>{workout.warmup.length} aquecimento · {workout.main.length} principais · {workout.cooldown.length} encerramento</span></div><button className="primary-button" disabled={!cardioIntensity || (cardioIntensity !== "Sem cardio hoje" && (!cardioMinutes || Number(cardioMinutes) < 1))} onClick={() => setSessionStarted(true)}>Começar sessão <span>→</span></button></section>{exitPrompt && <ConfirmDialog title="Sair do treino?" description="A sessão ainda não foi iniciada." confirmLabel="Sair" onConfirm={onExit} onCancel={() => setExitPrompt(false)} />}</main>;

  return <main className="session-shell"><header className="session-header"><button className="session-close" onClick={() => setExitPrompt(true)}>Fechar</button><div><small>{workout.name}</small><strong>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</strong></div><span>{index + 1}/{items.length}</span></header><div className="session-progress"><span style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div><section className="session-content"><p className="eyebrow">{index < workout.warmup.length ? "AQUECIMENTO E MOBILIDADE" : index >= workout.warmup.length + workout.main.length ? "ENCERRAMENTO E ALONGAMENTO" : "PARTE PRINCIPAL"}</p><h1>{current.exercise.name}</h1><p className="muscle-line">{current.exercise.muscleGroups.join(" · ")} · {current.exercise.equipment}</p><div className="prescription-grid"><div><small>SÉRIES</small><strong>{current.sets}</strong></div><div><small>REPETIÇÕES</small><strong>{current.reps}</strong></div><div><small>DESCANSO</small><strong>{current.rest ? `${current.rest}s` : "—"}</strong></div><div><small>ESFORÇO</small><strong>{current.targetRpe}</strong></div></div>{current.exercise.movement === "cardio" && <div className="session-fields cardio-session-fields"><label>Duração do cardio<input type="number" inputMode="numeric" min="0" max="120" value={cardioMinutes} onChange={(event) => setCardioMinutes(event.target.value)} /></label><label>Intensidade<select value={cardioIntensity} onChange={(event) => setCardioIntensity(event.target.value)}><option>Leve</option><option>Moderada</option><option>Intensa</option><option>Sem cardio hoje</option></select></label></div>}{rest > 0 && <div className="rest-timer"><span>DESCANSO</span><strong>{rest}s</strong><button onClick={() => setRest(0)}>Pular</button></div>}<div className="series-row" aria-label="Séries concluídas">{Array.from({ length: current.sets }, (_, series) => series + 1).map((series) => <button key={series} aria-pressed={doneSeries.includes(series)} aria-label={`Série ${series}${doneSeries.includes(series) ? " concluída" : ""}`} className={doneSeries.includes(series) ? "done" : ""} onClick={() => toggleSeries(series)}>{doneSeries.includes(series) ? "✓" : series}</button>)}</div><div className="session-fields"><label>Carga usada<input inputMode="decimal" value={loads[current.exercise.id] || ""} onChange={(event) => setLoads({ ...loads, [current.exercise.id]: event.target.value })} placeholder={current.loadSuggestion} /></label><label>Repetições feitas<input inputMode="numeric" value={actualReps[current.exercise.id] || ""} onChange={(event) => setActualReps({ ...actualReps, [current.exercise.id]: event.target.value })} placeholder={current.reps} /></label></div><details className="technique-card" open><summary>Como executar</summary><p>{current.exercise.instructions}</p><small>Cadência: {current.tempo}</small></details><details className="technique-card"><summary>Erros e alternativa</summary><p>{current.exercise.commonErrors}</p>{alternative && <small>Alternativa sugerida: {alternative.name}</small>}</details><p className="individual-note">{current.note}</p></section><footer className="session-nav"><button disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>← Voltar</button>{index < items.length - 1 ? <button className="next" onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))}>Próximo →</button> : <button className="next" onClick={() => onFinish(workout, completedExercises, elapsed, calculateSessionMetrics())}>Concluir treino</button>}</footer>{exitPrompt && <ConfirmDialog title="Sair do treino?" description="A sessão ainda não foi concluída. Os dados preenchidos serão descartados." confirmLabel="Descartar sessão" onConfirm={onExit} onCancel={() => setExitPrompt(false)} />}</main>;
}

function WorkoutSessionLegacy({ workout, onExit, onFinish }: { workout: GeneratedWorkout; onExit: () => void; onFinish: (workout: GeneratedWorkout, completedExercises: number, elapsedSeconds: number, metrics: { totalVolumeKg: number; estimatedOneRepMax: number }) => void }) {
  const items = [...workout.warmup, ...workout.main, ...workout.cooldown];
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [rest, setRest] = useState(0);
  const [completedSeries, setCompletedSeries] = useState<Record<string, number[]>>({});
  const [loads, setLoads] = useState<Record<string, string>>({});
  const [actualReps, setActualReps] = useState<Record<string, string>>({});
  const current = items[index];

  useEffect(() => {
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    const navigatorWithWakeLock = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
    let wakeLock: { release: () => Promise<void> } | undefined;
    navigatorWithWakeLock.wakeLock?.request("screen").then((lock) => { wakeLock = lock; }).catch(() => undefined);
    return () => { window.clearInterval(timer); wakeLock?.release().catch(() => undefined); };
  }, []);

  useEffect(() => {
    if (rest <= 0) return;
    const timer = window.setTimeout(() => setRest((value) => Math.max(0, value - 1)), 1000);
    if (rest === 1 && "vibrate" in navigator) navigator.vibrate?.(180);
    return () => window.clearTimeout(timer);
  }, [rest]);

  if (!current) return null;
  const doneSeries = completedSeries[current.exercise.id] || [];
  const completedExercises = items.filter((item) => (completedSeries[item.exercise.id] || []).length >= item.sets).length;
  const alternative = exercises.find((item) => current.exercise.alternativeIds.includes(item.id));

  function toggleSeries(series: number) {
    setCompletedSeries((state) => {
      const currentDone = state[current.exercise.id] || [];
      return { ...state, [current.exercise.id]: currentDone.includes(series) ? currentDone.filter((item) => item !== series) : [...currentDone, series] };
    });
    if (!doneSeries.includes(series) && current.rest > 0) setRest(current.rest);
  }

  function calculateSessionMetrics() {
    let totalVolumeKg = 0;
    let estimatedOneRepMax = 0;
    for (const item of items) {
      const load = Number.parseFloat((loads[item.exercise.id] || "0").replace(",", "."));
      const repetitions = Number.parseInt(actualReps[item.exercise.id] || "0", 10);
      const setsDone = (completedSeries[item.exercise.id] || []).length;
      if (load > 0 && repetitions > 0 && setsDone > 0) totalVolumeKg += load * repetitions * setsDone;
      const estimate = epleyEstimatedOneRepMax(load, repetitions);
      if (estimate) estimatedOneRepMax = Math.max(estimatedOneRepMax, estimate);
    }
    return { totalVolumeKg: Math.round(totalVolumeKg), estimatedOneRepMax: Math.round(estimatedOneRepMax * 10) / 10 };
  }

  return <main className="session-shell"><header className="session-header"><button onClick={onExit}>Fechar</button><div><small>{workout.name}</small><strong>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</strong></div><span>{index + 1}/{items.length}</span></header><div className="session-progress"><span style={{ width: `${((index + 1) / items.length) * 100}%` }} /></div><section className="session-content"><p className="eyebrow">{index < workout.warmup.length ? "AQUECIMENTO" : index >= workout.warmup.length + workout.main.length ? "FINALIZAÇÃO" : "PARTE PRINCIPAL"}</p><h1>{current.exercise.name}</h1><p className="muscle-line">{current.exercise.muscleGroups.join(" · ")} · {current.exercise.equipment}</p><div className="prescription-grid"><div><small>SÉRIES</small><strong>{current.sets}</strong></div><div><small>REPETIÇÕES</small><strong>{current.reps}</strong></div><div><small>DESCANSO</small><strong>{current.rest ? `${current.rest}s` : "—"}</strong></div><div><small>ESFORÇO</small><strong>{current.targetRpe}</strong></div></div>{rest > 0 && <div className="rest-timer"><span>DESCANSO</span><strong>{rest}s</strong><button onClick={() => setRest(0)}>Pular</button></div>}<div className="series-row">{Array.from({ length: current.sets }, (_, series) => series + 1).map((series) => <button key={series} className={doneSeries.includes(series) ? "done" : ""} onClick={() => toggleSeries(series)}>{doneSeries.includes(series) ? "✓" : series}</button>)}</div><div className="session-fields"><label>Carga usada<input inputMode="decimal" value={loads[current.exercise.id] || ""} onChange={(event) => setLoads({ ...loads, [current.exercise.id]: event.target.value })} placeholder={current.loadSuggestion} /></label><label>Repetições feitas<input inputMode="numeric" value={actualReps[current.exercise.id] || ""} onChange={(event) => setActualReps({ ...actualReps, [current.exercise.id]: event.target.value })} placeholder={current.reps} /></label></div><details className="technique-card" open><summary>Como executar</summary><p>{current.exercise.instructions}</p><small>Cadência: {current.tempo}</small></details><details className="technique-card"><summary>Erros e alternativa</summary><p>{current.exercise.commonErrors}</p>{alternative && <small>Alternativa sugerida: {alternative.name}</small>}</details><p className="individual-note">{current.note}</p></section><footer className="session-nav"><button disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>← Voltar</button>{index < items.length - 1 ? <button className="next" onClick={() => setIndex((value) => Math.min(items.length - 1, value + 1))}>Próximo →</button> : <button className="next" onClick={() => onFinish(workout, completedExercises, elapsed, calculateSessionMetrics())}>Concluir treino</button>}</footer></main>;
}

function PrescriptionProfileFields({ draft, setDraft, toggleListField }: { draft: Profile; setDraft: (profile: Profile) => void; toggleListField: (field: "secondaryGoals" | "availableEquipment" | "postpartumSymptoms", value: string) => void }) {
  const postpartum = (draft.specialConditions || []).some((item) => ["postpartum", "cesarean"].includes(item));
  return <div className="prescription-profile-fields"><p className="field-title">Objetivos secundários <small>Até dois.</small></p><div className="choice-grid">{goals.filter((goal) => goal !== draft.goal).map((goal) => <button type="button" key={goal} disabled={!(draft.secondaryGoals || []).includes(goal) && (draft.secondaryGoals || []).length >= 2} aria-pressed={(draft.secondaryGoals || []).includes(goal)} className={(draft.secondaryGoals || []).includes(goal) ? "selected" : ""} onClick={() => toggleListField("secondaryGoals", goal)}>{goal}</button>)}</div><p className="field-title">Equipamentos disponíveis</p><div className="condition-grid">{equipmentOptions.map((item) => <button type="button" key={item} aria-pressed={(draft.availableEquipment || []).includes(item)} className={(draft.availableEquipment || []).includes(item) ? "selected" : ""} onClick={() => toggleListField("availableEquipment", item)}>{item}</button>)}</div><div className="metric-form-grid"><label className="field-label">Meses de treino consistente<input type="number" min="0" max="600" value={draft.monthsConsistent ?? ""} onChange={(event) => setDraft({ ...draft, monthsConsistent: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Meses sem treinar<input type="number" min="0" max="600" value={draft.monthsSinceTraining ?? ""} onChange={(event) => setDraft({ ...draft, monthsSinceTraining: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Sono médio<input type="number" min="0" max="12" step="0.5" value={draft.averageSleepHours || ""} onChange={(event) => setDraft({ ...draft, averageSleepHours: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Estresse<select value={draft.stressLevel || ""} onChange={(event) => setDraft({ ...draft, stressLevel: event.target.value })}><option value="">Selecione</option><option>Baixo</option><option>Moderado</option><option>Alto</option></select></label><label className="field-label">Recuperação percebida<select value={draft.recoveryFeeling || ""} onChange={(event) => setDraft({ ...draft, recoveryFeeling: event.target.value })}><option value="">Selecione</option><option>Boa</option><option>Regular</option><option>Ruim</option></select></label></div><label className="field-label">Exercícios preferidos<input value={draft.preferredExercises || ""} onChange={(event) => setDraft({ ...draft, preferredExercises: event.target.value })} placeholder="Separe por vírgulas" /></label><label className="field-label">Exercícios rejeitados<input value={draft.rejectedExercises || ""} onChange={(event) => setDraft({ ...draft, rejectedExercises: event.target.value })} placeholder="Não entrarão na seleção" /></label>{postpartum && <section className="postpartum-profile-card"><p className="field-title">Recuperação pós-parto</p><div className="metric-form-grid"><label className="field-label">Data do parto<input type="date" value={draft.deliveryDate || ""} onChange={(event) => setDraft({ ...draft, deliveryDate: event.target.value })} /></label><label className="field-label">Tipo de parto<select value={draft.deliveryType || ""} onChange={(event) => setDraft({ ...draft, deliveryType: event.target.value })}><option value="">Selecione</option><option>Cesárea</option><option>Vaginal</option></select></label></div><label className="clearance-check"><input type="checkbox" checked={draft.incisionHealed || false} onChange={(event) => setDraft({ ...draft, incisionHealed: event.target.checked })} /><span><strong>Cicatriz fechada e sem sinais de infecção</strong><small>Sem calor, vermelhidão progressiva, secreção ou febre.</small></span></label><p className="field-title">Sintomas atuais</p><div className="condition-grid symptom-grid">{postpartumSymptomOptions.map((item) => <button type="button" key={item.id} aria-pressed={(draft.postpartumSymptoms || []).includes(item.id)} className={(draft.postpartumSymptoms || []).includes(item.id) ? "selected warning" : ""} onClick={() => toggleListField("postpartumSymptoms", item.id)}>{item.label}</button>)}</div></section>}</div>;
}

type ProfileViewProps = { profile: Profile; draft: Profile; setDraft: (profile: Profile) => void; editing: boolean; setEditing: (value: boolean) => void; cancelEditing: () => void; saveProfile: (event?: FormEvent) => void; handlePhoto: (event: ChangeEvent<HTMLInputElement>) => void; toggleDay: (day: string) => void; toggleSpecialCondition: (condition: string) => void; toggleListField: (field: "secondaryGoals" | "availableEquipment" | "postpartumSymptoms", value: string) => void; theme: "dark" | "light"; changeTheme: () => void; exportBackup: () => void; preferences: AppPreferences; changePreference: (name: keyof AppPreferences, value: boolean) => void; installedAppVersion: string; updateStatus: UpdateStatus; lastUpdateCheck: string | null; updateApplication: () => void };

function ProfileView(props: ProfileViewProps) {
  const { profile, editing, setEditing, theme, changeTheme, exportBackup, preferences, changePreference, installedAppVersion, updateStatus, lastUpdateCheck, updateApplication } = props;
  if (editing) return <ProfileViewBase {...props} />;
  const updateMessage = updateStatus === "checking" ? "Verificando versões e protegendo seus dados…" : updateStatus === "current" ? "Você está usando a versão mais recente." : updateStatus === "available" ? "Nova versão de conteúdo encontrada." : updateStatus === "offline" ? "Sem conexão. Seu treino salvo continua disponível." : updateStatus === "native-required" ? "O contêiner instalado precisa de uma atualização nativa." : updateStatus === "error" ? "A atualização falhou. Seus dados foram preservados." : "Verifique conteúdo e aplicativo sem apagar seus dados.";
  return <section className="screen"><div className="profile-hero"><Avatar profile={profile} size="large" /><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}>Editar perfil</button></div><div className="profile-facts"><div><small>Dados corporais</small><strong>{profile.heightCm && profile.weightKg ? `${profile.heightCm} cm · ${formatMetric(profile.weightKg)} kg${profile.waistCm ? ` · cintura ${formatMetric(profile.waistCm)} cm` : ""}` : "Complete seus dados para liberar métricas"}</strong></div><div><small>Rotina</small><strong>{profile.activityLevel || "Não informada"} · {profile.weeklyActivityMinutes || 0} min ativos/semana</strong></div><div><small>Disponibilidade</small><strong>{profile.days.join(" · ")}</strong></div><div><small>Sessão ideal</small><strong>{profile.duration} · {profile.location}</strong></div><div><small>Cuidados</small><strong>{(profile.specialConditions || []).length ? specialConditionOptions.filter((item) => profile.specialConditions?.includes(item.id)).map((item) => item.label).join(" · ") : "Nenhum cuidado especial marcado"}</strong></div><div><small>Observações</small><strong>{profile.limitations || "Nenhuma limitação informada"}</strong></div></div><div className="section-heading"><div><p>AJUSTES</p><h2>Experiência do treino</h2></div></div><div className="settings-list"><button onClick={changeTheme}><span>{theme === "dark" ? "☾" : "☀"}</span><div><strong>Aparência</strong><small>{theme === "dark" ? "Tema escuro" : "Tema claro"}</small></div><b>Alterar</b></button><button onClick={() => changePreference("vibration", !preferences.vibration)}><span>≋</span><div><strong>Vibração</strong><small>Feedback ao concluir séries e descanso</small></div><b>{preferences.vibration ? "Ativa" : "Inativa"}</b></button><button onClick={() => changePreference("sound", !preferences.sound)}><span>♪</span><div><strong>Som do timer</strong><small>Aviso opcional ao terminar o descanso</small></div><b>{preferences.sound ? "Ativo" : "Inativo"}</b></button><button onClick={() => changePreference("keepAwake", !preferences.keepAwake)}><span>◉</span><div><strong>Manter tela ligada</strong><small>Durante uma sessão em andamento</small></div><b>{preferences.keepAwake ? "Ativo" : "Inativo"}</b></button><a className="settings-link" href="/AngelsFit.mobileconfig"><span>⇩</span><div><strong>Usar em tela cheia no iPhone</strong><small>Instale o atalho Angels Fit e veja como remover quando quiser.</small></div><b>Ver</b></a><button onClick={exportBackup}><span>↓</span><div><strong>Exportar backup</strong><small>Perfil, programa, medições, check-ins e histórico</small></div><b>Exportar</b></button></div><section className={`update-card update-${updateStatus}`}><div><p>SOBRE E ATUALIZAÇÃO</p><h2>Angels Fit</h2><span>{updateMessage}</span></div><dl><div><dt>Aplicativo instalado</dt><dd>{installedAppVersion}{isNativeApp() ? " · nativo" : " · web"}</dd></div><div><dt>Conteúdo</dt><dd>{CONTENT_VERSION}</dd></div><div><dt>Schema local</dt><dd>{CURRENT_DATA_SCHEMA_VERSION}</dd></div><div><dt>Compatibilidade mínima</dt><dd>{MINIMUM_SUPPORTED_APP_VERSION}</dd></div><div><dt>Última verificação</dt><dd>{lastUpdateCheck ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastUpdateCheck)) : "Ainda não verificado"}</dd></div></dl><button className="primary-button" disabled={updateStatus === "checking"} onClick={updateApplication}>{updateStatus === "checking" ? "Verificando…" : "Atualizar aplicativo"} <span>↻</span></button>{updateStatus === "native-required" && <button className="native-update-link" onClick={() => { void openExternal("https://github.com/MarioSerafimCoder/BrasaFit/releases"); }}>Abrir atualização nativa</button>}</section><p className="app-version">ANGELS FIT · CONTEÚDO {CONTENT_VERSION}</p></section>;
}

function ProfileViewBase({ profile, draft, setDraft, editing, setEditing, cancelEditing, saveProfile, handlePhoto, toggleDay, toggleSpecialCondition, toggleListField, theme, changeTheme, exportBackup }: ProfileViewProps) {
  const canSave = Boolean(draft.name.trim() && draft.goal && draft.experience && draft.days.length && draft.duration && draft.location);
  if (editing) return <section className="screen profile-edit-screen"><div className="edit-header"><button onClick={cancelEditing}>Cancelar</button><h1>Editar perfil</h1><button className="save-link" disabled={!canSave} onClick={() => saveProfile()}>Salvar</button></div><label className="photo-picker compact-photo"><input type="file" accept="image/*" onChange={handlePhoto} /><Avatar profile={draft} size="large" /><span>Alterar foto</span></label><label className="field-label">Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><div className="edit-section-title"><span>01</span><div><strong>Dados de desempenho</strong><small>Peso, cintura e frequência de repouso criam novos registros de evolução.</small></div></div><div className="metric-form-grid"><label className="field-label">Data de nascimento<input type="date" value={draft.birthDate || ""} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></label><label className="field-label">Sexo biológico<select value={draft.biologicalSex || ""} onChange={(event) => setDraft({ ...draft, biologicalSex: event.target.value })}><option value="">Não informar</option><option>Feminino</option><option>Masculino</option></select></label><label className="field-label">Altura (cm)<input inputMode="decimal" type="number" min="100" max="250" value={draft.heightCm || ""} onChange={(event) => setDraft({ ...draft, heightCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Peso (kg)<input inputMode="decimal" type="number" min="25" max="400" step="0.1" value={draft.weightKg || ""} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Cintura (cm)<input inputMode="decimal" type="number" min="40" max="250" step="0.1" value={draft.waistCm || ""} onChange={(event) => setDraft({ ...draft, waistCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">FC de repouso<input inputMode="numeric" type="number" min="30" max="220" value={draft.restingHeartRate || ""} onChange={(event) => setDraft({ ...draft, restingHeartRate: event.target.value ? Number(event.target.value) : undefined })} /></label></div><p className="field-title">Rotina diária</p><div className="choice-grid two-columns">{activityLevels.map((item) => <button type="button" key={item} aria-pressed={draft.activityLevel === item} className={draft.activityLevel === item ? "selected" : ""} onClick={() => setDraft({ ...draft, activityLevel: item })}>{item}</button>)}</div><div className="metric-form-grid"><label className="field-label">Treinos atuais/semana<input inputMode="numeric" type="number" min="0" max="14" value={draft.currentWeeklySessions ?? ""} onChange={(event) => setDraft({ ...draft, currentWeeklySessions: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Minutos ativos/semana<input inputMode="numeric" type="number" min="0" max="2000" value={draft.weeklyActivityMinutes ?? ""} onChange={(event) => setDraft({ ...draft, weeklyActivityMinutes: event.target.value ? Number(event.target.value) : 0 })} /></label></div><div className="edit-section-title"><span>02</span><div><strong>Treino e preferências</strong><small>Estas escolhas ajustam o programa gerado.</small></div></div><p className="field-title">Objetivo</p><div className="choice-grid">{goals.map((goal) => <button type="button" key={goal} aria-pressed={draft.goal === goal} className={draft.goal === goal ? "selected" : ""} onClick={() => setDraft({ ...draft, goal })}>{goal}</button>)}</div><p className="field-title">Nível de experiência</p><div className="choice-row">{experiences.map((item) => <button type="button" key={item} aria-pressed={draft.experience === item} className={draft.experience === item ? "selected" : ""} onClick={() => setDraft({ ...draft, experience: item })}>{item}</button>)}</div><p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button type="button" key={day} aria-pressed={draft.days.includes(day)} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div><p className="field-title">Duração ideal</p><div className="choice-grid two-columns">{durations.map((item) => <button type="button" key={item} aria-pressed={draft.duration === item} className={draft.duration === item ? "selected" : ""} onClick={() => setDraft({ ...draft, duration: item })}>{item}</button>)}</div><p className="field-title">Onde você vai treinar?</p><div className="choice-row">{["Academia", "Em casa", "Ambos"].map((item) => <button type="button" key={item} aria-pressed={draft.location === item} className={draft.location === item ? "selected" : ""} onClick={() => setDraft({ ...draft, location: item })}>{item}</button>)}</div><div className="edit-section-title"><span>03</span><div><strong>Cuidados e segurança</strong><small>Ajude o programa a respeitar seus limites.</small></div></div><div className="condition-grid">{specialConditionOptions.map((item) => <button type="button" key={item.id} aria-pressed={(draft.specialConditions || []).includes(item.id)} className={(draft.specialConditions || []).includes(item.id) ? "selected" : ""} onClick={() => toggleSpecialCondition(item.id)}>{item.label}</button>)}</div><PrescriptionProfileFields draft={draft} setDraft={setDraft} toggleListField={toggleListField} /><label className="field-label">Limitações<textarea rows={4} value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Nenhuma informada" /></label>{(draft.specialConditions || []).some((item) => ["postpartum", "cesarean", "pregnancy", "cardiovascular"].includes(item)) && <label className="clearance-check"><input type="checkbox" checked={draft.medicalClearance || false} onChange={(event) => setDraft({ ...draft, medicalClearance: event.target.checked })} /><span><strong>Tenho liberação profissional para treinar</strong><small>Marque apenas se essa orientação já foi recebida.</small></span></label>}<button className="primary-button profile-save-cta" disabled={!canSave} onClick={() => saveProfile()}>Salvar alterações <span>✓</span></button></section>;

  return <section className="screen"><div className="profile-hero"><Avatar profile={profile} size="large" /><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}>Editar perfil</button></div><div className="profile-facts"><div><small>Dados corporais</small><strong>{profile.heightCm && profile.weightKg ? `${profile.heightCm} cm · ${formatMetric(profile.weightKg)} kg${profile.waistCm ? ` · cintura ${formatMetric(profile.waistCm)} cm` : ""}` : "Complete seus dados para liberar métricas"}</strong></div><div><small>Rotina</small><strong>{profile.activityLevel || "Não informada"} · {profile.weeklyActivityMinutes || 0} min ativos/semana</strong></div><div><small>Disponibilidade</small><strong>{profile.days.join(" · ")}</strong></div><div><small>Sessão ideal</small><strong>{profile.duration} · {profile.location}</strong></div><div><small>Cuidados</small><strong>{(profile.specialConditions || []).length ? specialConditionOptions.filter((item) => profile.specialConditions?.includes(item.id)).map((item) => item.label).join(" · ") : "Nenhum cuidado especial marcado"}</strong></div><div><small>Observações</small><strong>{profile.limitations || "Nenhuma limitação informada"}</strong></div></div><div className="settings-list"><button onClick={changeTheme}><span>{theme === "dark" ? "☾" : "☀"}</span><div><strong>Aparência</strong><small>{theme === "dark" ? "Tema escuro" : "Tema claro"}</small></div><b>Alterar</b></button><a className="settings-link" href="/AngelsFit.mobileconfig"><span>⇩</span><div><strong>Usar em tela cheia no iPhone</strong><small>Instale o atalho Angels Fit e veja como remover quando quiser.</small></div><b>Ver</b></a><button onClick={exportBackup}><span>↓</span><div><strong>Exportar backup</strong><small>Perfil, programa, medições, check-ins e histórico</small></div><b>Exportar</b></button><div><span>●</span><div><strong>Armazenamento</strong><small>Dados salvos somente neste aparelho</small></div><b className="safe-status">Local</b></div></div><p className="app-version">ANGELS FIT · SEU TREINO, SEU RITMO</p></section>;
}

function ProfileViewLegacy({ profile, draft, setDraft, editing, setEditing, saveProfile, handlePhoto, toggleDay, toggleSpecialCondition, theme, changeTheme, exportBackup }: { profile: Profile; draft: Profile; setDraft: (profile: Profile) => void; editing: boolean; setEditing: (value: boolean) => void; saveProfile: (event?: FormEvent) => void; handlePhoto: (event: ChangeEvent<HTMLInputElement>) => void; toggleDay: (day: string) => void; toggleSpecialCondition: (condition: string) => void; theme: "dark" | "light"; changeTheme: () => void; exportBackup: () => void }) {
  if (editing) return <section className="screen profile-edit-screen"><div className="edit-header"><button onClick={() => { setDraft(profile); setEditing(false); }}>Cancelar</button><h1>Editar perfil</h1><button className="save-link" onClick={() => saveProfile()}>Salvar</button></div><label className="photo-picker compact-photo"><input type="file" accept="image/*" onChange={handlePhoto} /><Avatar profile={draft} size="large" /><span>Alterar foto</span></label><label className="field-label">Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><div className="edit-section-title"><span>01</span><div><strong>Dados de desempenho</strong><small>Alterações de peso, cintura e frequência de repouso criam um novo registro histórico.</small></div></div><div className="metric-form-grid"><label className="field-label">Data de nascimento<input type="date" value={draft.birthDate || ""} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></label><label className="field-label">Sexo biológico<select value={draft.biologicalSex || ""} onChange={(event) => setDraft({ ...draft, biologicalSex: event.target.value })}><option value="">Não informar</option><option>Feminino</option><option>Masculino</option></select></label><label className="field-label">Altura (cm)<input type="number" min="100" max="250" value={draft.heightCm || ""} onChange={(event) => setDraft({ ...draft, heightCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Peso (kg)<input type="number" min="25" max="400" step="0.1" value={draft.weightKg || ""} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Cintura (cm)<input type="number" min="40" max="250" step="0.1" value={draft.waistCm || ""} onChange={(event) => setDraft({ ...draft, waistCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">FC de repouso<input type="number" min="30" max="220" value={draft.restingHeartRate || ""} onChange={(event) => setDraft({ ...draft, restingHeartRate: event.target.value ? Number(event.target.value) : undefined })} /></label></div><p className="field-title">Rotina diária</p><div className="choice-grid two-columns">{activityLevels.map((item) => <button key={item} className={draft.activityLevel === item ? "selected" : ""} onClick={() => setDraft({ ...draft, activityLevel: item })}>{item}</button>)}</div><div className="metric-form-grid"><label className="field-label">Treinos atuais/semana<input type="number" min="0" max="14" value={draft.currentWeeklySessions ?? ""} onChange={(event) => setDraft({ ...draft, currentWeeklySessions: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Minutos ativos/semana<input type="number" min="0" max="2000" value={draft.weeklyActivityMinutes ?? ""} onChange={(event) => setDraft({ ...draft, weeklyActivityMinutes: event.target.value ? Number(event.target.value) : 0 })} /></label></div><div className="edit-section-title"><span>02</span><div><strong>Treino e segurança</strong><small>Esses dados alteram o programa gerado.</small></div></div><p className="field-title">Objetivo</p><div className="choice-grid">{goals.map((goal) => <button key={goal} className={draft.goal === goal ? "selected" : ""} onClick={() => setDraft({ ...draft, goal })}>{goal}</button>)}</div><p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button key={day} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div><p className="field-title">Cuidados especiais</p><div className="condition-grid">{specialConditionOptions.map((item) => <button key={item.id} className={(draft.specialConditions || []).includes(item.id) ? "selected" : ""} onClick={() => toggleSpecialCondition(item.id)}>{item.label}</button>)}</div><label className="field-label">Limitações<textarea rows={4} value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Nenhuma informada" /></label>{(draft.specialConditions || []).some((item) => ["postpartum", "cesarean", "pregnancy", "cardiovascular"].includes(item)) && <label className="clearance-check"><input type="checkbox" checked={draft.medicalClearance || false} onChange={(event) => setDraft({ ...draft, medicalClearance: event.target.checked })} /><span><strong>Tenho liberação profissional para treinar</strong><small>Marque apenas se essa orientação já foi recebida.</small></span></label>}</section>;

  return <section className="screen"><div className="profile-hero"><Avatar profile={profile} size="large" /><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}>Editar perfil</button></div><div className="profile-facts"><div><small>Dados corporais</small><strong>{profile.heightCm && profile.weightKg ? `${profile.heightCm} cm · ${formatMetric(profile.weightKg)} kg${profile.waistCm ? ` · cintura ${formatMetric(profile.waistCm)} cm` : ""}` : "Complete seus dados para liberar métricas"}</strong></div><div><small>Rotina</small><strong>{profile.activityLevel || "Não informada"} · {profile.weeklyActivityMinutes || 0} min ativos/semana</strong></div><div><small>Disponibilidade</small><strong>{profile.days.join(" · ")}</strong></div><div><small>Sessão ideal</small><strong>{profile.duration} · {profile.location}</strong></div><div><small>Cuidados</small><strong>{(profile.specialConditions || []).length ? specialConditionOptions.filter((item) => profile.specialConditions?.includes(item.id)).map((item) => item.label).join(" · ") : "Nenhum cuidado especial marcado"}</strong></div><div><small>Observações</small><strong>{profile.limitations || "Nenhuma limitação informada"}</strong></div></div><div className="settings-list"><button onClick={changeTheme}><span>{theme === "dark" ? "☾" : "☀"}</span><div><strong>Aparência</strong><small>{theme === "dark" ? "Tema escuro" : "Tema claro"}</small></div><b>Alterar</b></button><a className="settings-link" href="/AngelsFit.mobileconfig"><span>⇩</span><div><strong>Instalar perfil iOS</strong><small>Atalho em tela cheia removível quando quiser</small></div><b>Baixar</b></a><button onClick={exportBackup}><span>↓</span><div><strong>Exportar backup</strong><small>Perfil, programa, medições e histórico</small></div><b>Exportar</b></button><div><span>●</span><div><strong>Armazenamento</strong><small>Dados salvos neste aparelho</small></div><b className="safe-status">Offline</b></div></div><p className="app-version">ANGELS FIT · versão 4.1 · base {EXERCISE_DATABASE_VERSION}</p></section>;
}

void [PerformanceLegacy, History, AdaptiveWorkoutSessionLegacy, WorkoutSession, WorkoutSessionLegacy, ProfileViewLegacy];
