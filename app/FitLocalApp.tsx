"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { exercises, EXERCISE_DATABASE_VERSION } from "./workout-data";
import { GeneratedProgram, GeneratedWorkout, generateProgram, specialConditionOptions } from "./workout-engine";
import { BodyMeasurement, bmiCategory, calculateAge, calculateBmi, epleyEstimatedOneRepMax, estimateRestingEnergy, formatMetric, linearProjection, waistRatioCategory, waistToHeightRatio } from "./performance-metrics";

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
};

type WorkoutHistory = {
  id: string;
  workoutName: string;
  completedAt: string;
  durationMinutes: number;
  completedExercises: number;
  totalExercises: number;
  totalVolumeKg?: number;
  estimatedOneRepMax?: number;
  cardioMinutes?: number;
  cardioIntensity?: string;
};

type CheckIn = {
  id: string;
  checkedAt: string;
};

const PROFILE_KEY = "fitlocal.profile.v1";
const THEME_KEY = "fitlocal.theme.v1";
const HISTORY_KEY = "brasafit.history.v2";
const MEASUREMENTS_KEY = "brasafit.measurements.v3";
const CHECKINS_KEY = "brasafit.checkins.v1";

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
};

const goals = ["Hipertrofia", "Força", "Condicionamento", "Mobilidade", "Retorno aos treinos"];
const experiences = ["Iniciante", "Intermediário", "Avançado"];
const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const durations = ["30 min", "45 min", "60 min", "75 min+"];
const activityLevels = ["Sedentária", "Pouco ativa", "Ativa", "Muito ativa"];

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
  const [activeWorkout, setActiveWorkout] = useState<GeneratedWorkout | null>(null);
  const [history, setHistory] = useState<WorkoutHistory[]>([]);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [previewWorkout, setPreviewWorkout] = useState<GeneratedWorkout | null>(null);
  const [discardProfilePrompt, setDiscardProfilePrompt] = useState(false);

  useEffect(() => {
    const storedProfile = window.localStorage.getItem(PROFILE_KEY);
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile) as Profile;
        const normalized = { ...initialProfile, ...parsed, specialConditions: parsed.specialConditions || [], medicalClearance: parsed.medicalClearance || false };
        setProfile(normalized);
        setDraft(normalized);
      } catch {
        window.localStorage.removeItem(PROFILE_KEY);
      }
    }
    const nextTheme = storedTheme === "light" ? "light" : "dark";
    try {
      setHistory(JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]") as WorkoutHistory[]);
    } catch {
      window.localStorage.removeItem(HISTORY_KEY);
    }
    try {
      setMeasurements(JSON.parse(window.localStorage.getItem(MEASUREMENTS_KEY) || "[]") as BodyMeasurement[]);
    } catch {
      window.localStorage.removeItem(MEASUREMENTS_KEY);
    }
    try {
      setCheckIns(JSON.parse(window.localStorage.getItem(CHECKINS_KEY) || "[]") as CheckIn[]);
    } catch {
      window.localStorage.removeItem(CHECKINS_KEY);
    }
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setOnline(navigator.onLine);
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true);
    setHydrated(true);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const program = useMemo<GeneratedProgram | null>(() => profile ? generateProgram(profile, { history }) : null, [profile, history]);
  const profileDirty = Boolean(profile && JSON.stringify(profile) !== JSON.stringify(draft));

  useEffect(() => {
    if ((!editingProfile || !profileDirty) && !activeWorkout) return;
    const protectUnsavedWork = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectUnsavedWork);
    return () => window.removeEventListener("beforeunload", protectUnsavedWork);
  }, [activeWorkout, editingProfile, profileDirty]);

  function changeTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(THEME_KEY, next);
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
    const next = { ...draft, name: draft.name.trim(), specialConditions: draft.specialConditions || [], medicalClearance: draft.medicalClearance || false, createdAt: draft.createdAt || new Date().toISOString() };
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    if (next.weightKg) {
      const latest = measurements[0];
      const changed = !latest || latest.weightKg !== next.weightKg || latest.waistCm !== next.waistCm || latest.restingHeartRate !== next.restingHeartRate;
      if (changed) {
        const nextMeasurement: BodyMeasurement = { recordedAt: new Date().toISOString(), weightKg: next.weightKg, waistCm: next.waistCm, restingHeartRate: next.restingHeartRate };
        const nextMeasurements = [nextMeasurement, ...measurements].slice(0, 120);
        setMeasurements(nextMeasurements);
        window.localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(nextMeasurements));
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
    window.localStorage.setItem(CHECKINS_KEY, JSON.stringify(nextCheckIns));
    setSavedMessage("Check-in registrado");
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
    const backup = { app: "BrasaFit", version: 5, databaseVersion: EXERCISE_DATABASE_VERSION, exportedAt: new Date().toISOString(), profile, program, history, checkIns, measurements };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `brasafit-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function finishWorkout(workout: GeneratedWorkout, completedExercises: number, elapsedSeconds: number, metrics: { totalVolumeKg: number; estimatedOneRepMax: number; cardioMinutes: number; cardioIntensity: string }) {
    const record: WorkoutHistory = {
      id: `${Date.now()}`,
      workoutName: workout.name,
      completedAt: new Date().toISOString(),
      durationMinutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      completedExercises,
      totalExercises: workout.warmup.length + workout.main.length + workout.cooldown.length,
      totalVolumeKg: metrics.totalVolumeKg,
      estimatedOneRepMax: metrics.estimatedOneRepMax,
      cardioMinutes: metrics.cardioMinutes,
      cardioIntensity: metrics.cardioIntensity,
    };
    const nextHistory = [record, ...history];
    setHistory(nextHistory);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    setActiveWorkout(null);
    setTab("progress");
    setSavedMessage("Treino registrado");
    window.setTimeout(() => setSavedMessage(""), 2600);
  }

  if (!hydrated) {
    return <main className="loading-screen"><div className="brand-mark" aria-hidden="true"><span /></div><p>BRASAFIT</p></main>;
  }

  if (!profile) {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-top">
          <div className="wordmark"><div className="brand-mark" aria-hidden="true"><span /></div>BRASAFIT</div>
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
            <button className="primary-button" disabled={!draft.name.trim() || !draft.goal} onClick={() => setStep(2)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 2 && (
          <section className="form-panel">
            <p className="eyebrow">PERSONALIZAÇÃO</p><h1>Seu ponto de partida.</h1><p className="lead compact">Usaremos esses dados para métricas de saúde e evolução. Você poderá editá-los depois.</p>
            <div className="metric-form-grid"><label className="field-label">Data de nascimento<input type="date" value={draft.birthDate || ""} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></label><label className="field-label">Sexo biológico <small>Opcional; usado somente na estimativa metabólica.</small><select value={draft.biologicalSex || ""} onChange={(event) => setDraft({ ...draft, biologicalSex: event.target.value })}><option value="">Não informar</option><option>Feminino</option><option>Masculino</option></select></label><label className="field-label">Altura (cm)<input inputMode="decimal" type="number" min="100" max="250" value={draft.heightCm || ""} onChange={(event) => setDraft({ ...draft, heightCm: event.target.value ? Number(event.target.value) : undefined })} placeholder="175" /></label><label className="field-label">Peso atual (kg)<input inputMode="decimal" type="number" min="25" max="400" step="0.1" value={draft.weightKg || ""} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value ? Number(event.target.value) : undefined })} placeholder="78,5" /></label><label className="field-label">Cintura (cm) <small>Opcional; meça no meio entre costelas e quadril.</small><input inputMode="decimal" type="number" min="40" max="250" step="0.1" value={draft.waistCm || ""} onChange={(event) => setDraft({ ...draft, waistCm: event.target.value ? Number(event.target.value) : undefined })} placeholder="82" /></label><label className="field-label">Frequência cardíaca de repouso <small>Opcional, em batimentos por minuto.</small><input inputMode="numeric" type="number" min="30" max="220" value={draft.restingHeartRate || ""} onChange={(event) => setDraft({ ...draft, restingHeartRate: event.target.value ? Number(event.target.value) : undefined })} placeholder="68" /></label></div>
            <p className="field-title">Como é sua rotina diária?</p><div className="choice-grid two-columns">{activityLevels.map((item) => <button type="button" key={item} aria-pressed={draft.activityLevel === item} className={draft.activityLevel === item ? "selected" : ""} onClick={() => setDraft({ ...draft, activityLevel: item })}>{item}</button>)}</div>
            <div className="metric-form-grid"><label className="field-label">Treinos atuais por semana<input inputMode="numeric" type="number" min="0" max="14" value={draft.currentWeeklySessions ?? ""} onChange={(event) => setDraft({ ...draft, currentWeeklySessions: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Minutos ativos por semana <small>Caminhada, esporte, bicicleta e exercícios.</small><input inputMode="numeric" type="number" min="0" max="2000" value={draft.weeklyActivityMinutes ?? ""} onChange={(event) => setDraft({ ...draft, weeklyActivityMinutes: event.target.value ? Number(event.target.value) : 0 })} /></label></div>
            <div className="safety-note metric-note"><span>i</span><p>IMC, gasto de repouso e projeções são estimativas de triagem, não diagnóstico ou prescrição nutricional.</p></div>
            <button className="primary-button" disabled={!draft.birthDate || !draft.heightCm || !draft.weightKg || !draft.activityLevel} onClick={() => setStep(3)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 3 && (
          <section className="form-panel">
            <p className="eyebrow">PERSONALIZAÇÃO</p><h1>Como você treina hoje?</h1>
            <p className="field-title">Nível de experiência</p><div className="choice-row">{experiences.map((item) => <button type="button" key={item} aria-pressed={draft.experience === item} className={draft.experience === item ? "selected" : ""} onClick={() => setDraft({ ...draft, experience: item })}>{item}</button>)}</div>
            <p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button type="button" key={day} aria-pressed={draft.days.includes(day)} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div>
            <p className="field-title">Duração ideal</p><div className="choice-grid two-columns">{durations.map((item) => <button type="button" key={item} aria-pressed={draft.duration === item} className={draft.duration === item ? "selected" : ""} onClick={() => setDraft({ ...draft, duration: item })}>{item}</button>)}</div>
            <p className="field-title">Onde você vai treinar?</p><div className="choice-row">{["Academia", "Em casa", "Ambos"].map((item) => <button type="button" key={item} aria-pressed={draft.location === item} className={draft.location === item ? "selected" : ""} onClick={() => setDraft({ ...draft, location: item })}>{item}</button>)}</div>
            <button className="primary-button" disabled={!draft.experience || draft.days.length === 0 || !draft.duration || !draft.location} onClick={() => setStep(4)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 4 && (
          <form className="form-panel" onSubmit={saveProfile}>
            <p className="eyebrow">PERSONALIZAÇÃO</p><h1>Últimos cuidados.</h1><p className="lead compact">Conte o que devemos considerar antes de definir seu primeiro treino.</p>
            <p className="field-title">Cuidados especiais</p>
            <div className="condition-grid">{specialConditionOptions.map((item) => <button type="button" key={item.id} aria-pressed={(draft.specialConditions || []).includes(item.id)} className={(draft.specialConditions || []).includes(item.id) ? "selected" : ""} onClick={() => toggleSpecialCondition(item.id)}>{item.label}</button>)}</div>
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

  if (activeWorkout) {
    return <WorkoutSession workout={activeWorkout} onExit={() => setActiveWorkout(null)} onFinish={finishWorkout} />;
  }

  const tabContent = {
    today: <Today profile={profile} online={online} installed={installed} setTab={setTab} exportBackup={exportBackup} program={program!} startWorkout={setActiveWorkout} checkIns={checkIns} history={history} onCheckIn={registerCheckIn} />,
    program: <Program profile={profile} program={program!} previewWorkout={setPreviewWorkout} />,
    exercises: <Exercises />,
    progress: <Progress profile={profile} history={history} checkIns={checkIns} measurements={measurements} setTab={setTab} />,
    profile: <ProfileView profile={profile} draft={draft} setDraft={setDraft} editing={editingProfile} setEditing={setEditingProfile} cancelEditing={cancelProfileEdit} saveProfile={saveProfile} handlePhoto={handlePhoto} toggleDay={toggleDay} toggleSpecialCondition={toggleSpecialCondition} theme={theme} changeTheme={changeTheme} exportBackup={exportBackup} />,
  }[tab];

  const showBottomNav = !editingProfile && !previewWorkout;

  return (
    <main className="app-shell"><div className="mobile-app">
      {savedMessage && <div className="toast">✓ {savedMessage}</div>}
      <div className={`app-content ${showBottomNav ? "" : "without-nav"}`}>{previewWorkout ? <WorkoutPreview workout={previewWorkout} onBack={() => setPreviewWorkout(null)} onStart={() => { setPreviewWorkout(null); setActiveWorkout(previewWorkout); }} /> : tabContent}</div>
      {showBottomNav && <nav className="bottom-nav" aria-label="Navegação principal">
        <NavButton active={tab === "today"} label="Hoje" icon="⌂" onClick={() => setTab("today")} />
        <NavButton active={tab === "program"} label="Programa" icon="▤" onClick={() => setTab("program")} />
        <NavButton active={tab === "exercises"} label="Exercícios" icon="◎" onClick={() => setTab("exercises")} />
        <NavButton active={tab === "progress"} label="Progresso" icon="↗" onClick={() => setTab("progress")} />
        <NavButton active={tab === "profile"} label="Perfil" icon="○" onClick={() => setTab("profile")} />
      </nav>}
      {discardProfilePrompt && <ConfirmDialog title="Descartar alterações?" description="As mudanças feitas no perfil ainda não foram salvas." confirmLabel="Descartar" onConfirm={discardProfileChanges} onCancel={() => setDiscardProfilePrompt(false)} />}
    </div></main>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={onClick}><span aria-hidden="true">{icon}</span><small>{label}</small></button>;
}

function ConfirmDialog({ title, description, confirmLabel, onConfirm, onCancel }: { title: string; description: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><div className="dialog-icon" aria-hidden="true">!</div><h2 id="confirm-title">{title}</h2><p id="confirm-description">{description}</p><div><button onClick={onCancel}>Continuar</button><button className="danger" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

function ScreenHeader({ title, profile, kicker }: { title: string; profile: Profile; kicker?: string }) {
  return <header className="screen-header"><div><p>{kicker}</p><h1>{title}</h1></div><Avatar profile={profile} size="small" /></header>;
}

function cycleDateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
}

function WorkoutBlockOverview({ title, items, block }: { title: string; items: GeneratedWorkout["main"]; block: "warmup" | "main" | "cooldown" }) {
  return <section className={`workout-block block-${block}`}><header><span aria-hidden="true">{block === "warmup" ? "01" : block === "main" ? "02" : "03"}</span><div><small>BLOCO</small><strong>{title}</strong></div></header><div>{items.map((item) => <article key={item.exercise.id}><div><strong>{item.exercise.name}</strong><small>{item.exercise.equipment}</small></div><b>{item.sets}× {item.reps}</b></article>)}</div></section>;
}

function Today({ profile, online, installed, setTab, exportBackup, program, startWorkout, checkIns, history, onCheckIn }: { profile: Profile; online: boolean; installed: boolean; setTab: (tab: AppTab) => void; exportBackup: () => void; program: GeneratedProgram; startWorkout: (workout: GeneratedWorkout) => void; checkIns: CheckIn[]; history: WorkoutHistory[]; onCheckIn: () => void }) {
  const workout = program.workouts[program.todayWorkoutIndex] || program.workouts[0];
  const metricsComplete = Boolean(profile.birthDate && profile.heightCm && profile.weightKg && profile.activityLevel);
  const checkedToday = checkIns.some((item) => localDateKey(new Date(item.checkedAt)) === localDateKey());
  const streak = attendanceStreak(checkIns, history);
  return (
    <section className="screen">
      <ScreenHeader title={`Olá, ${profile.name.split(" ")[0]}`} kicker={todayLabel()} profile={profile} />
      <div className={`connection-pill ${online ? "online" : "offline"}`}><span />{online ? "Dados locais prontos" : "Modo offline"}</div>
      <button className={`checkin-card ${checkedToday ? "checked" : ""}`} aria-pressed={checkedToday} disabled={checkedToday} onClick={onCheckIn}><span aria-hidden="true">{checkedToday ? "✓" : "●"}</span><div><strong>{checkedToday ? "Check-in feito hoje" : "Fazer check-in"}</strong><small>{checkedToday ? "Sua presença já foi registrada." : "Registre sua presença com um toque."}</small></div><b>{streak > 0 ? `${streak} ${streak === 1 ? "dia" : "dias"}` : "+1"}</b></button>
      {!metricsComplete && <button className="profile-completion-card" onClick={() => setTab("profile")}><span>!</span><div><strong>Complete seus dados de desempenho</strong><small>Informe nascimento, altura, peso e rotina para liberar métricas e previsões.</small></div><b>→</b></button>}
      {workout ? <article className="hero-card workout-hero"><div className="hero-orbit" aria-hidden="true"><span>{workout.estimatedMinutes}</span></div><p>TREINO DO DIA</p><h2>{workout.name}</h2><span>{workout.focus} · {workout.main.length + workout.warmup.length + workout.cooldown.length} movimentos · aproximadamente {workout.estimatedMinutes} min</span><small className="cycle-validity">Ciclo {program.cycleNumber} · válido até {cycleDateLabel(program.validUntil)}</small><button onClick={() => startWorkout(workout)}>Iniciar treino <b>→</b></button></article> : <article className="hero-card safety-hero"><div className="hero-orbit" aria-hidden="true"><span>!</span></div><p>SEGURANÇA PRIMEIRO</p><h2>{program.title}</h2><span>{program.summary}</span><button onClick={() => setTab("profile")}>Revisar perfil <b>→</b></button></article>}
      <div className="week-strip">{weekDays.map((day, index) => <div key={day} className={index === 0 ? "today" : ""}><small>{day}</small><span>{new Date().getDate() + index}</span></div>)}</div>
      <div className="section-heading"><div><p>HOJE</p><h2>{workout ? "Plano da sessão" : "Atenção necessária"}</h2></div></div>
      {workout ? <div className="workout-blocks-overview"><WorkoutBlockOverview title="Aquecimento e mobilidade" items={workout.warmup} block="warmup" /><WorkoutBlockOverview title="Parte principal" items={workout.main} block="main" /><WorkoutBlockOverview title="Encerramento e alongamento" items={workout.cooldown} block="cooldown" /></div> : <article className="safety-block">{program.notices.map((notice) => <p key={notice}>! {notice}</p>)}</article>}
      {workout && workout.notices.length > 0 && <article className="safety-block compact">{workout.notices.map((notice) => <p key={notice}>! {notice}</p>)}</article>}
      <div className="metrics-grid"><article><p>Objetivo</p><strong>{profile.goal}</strong><span>foco principal</span></article><article><p>Rotina</p><strong>{profile.days.length}x</strong><span>por semana</span></article><article><p>Duração</p><strong>{profile.duration.replace(" min", "")}</strong><span>minutos</span></article></div>
      {!installed && <article className="install-card"><span aria-hidden="true">⇧</span><div><strong>Usar em tela cheia no iPhone</strong><p>Instale o atalho BrasaFit para abrir o app com rapidez, mesmo offline.</p><a href="/BrasaFit.mobileconfig">Ver instruções de instalação</a></div></article>}
      <div className="quick-actions"><button onClick={exportBackup}><span>↓</span><div><strong>Fazer backup</strong><small>Salvar uma cópia dos dados</small></div></button><button onClick={() => setTab("profile")}><span>○</span><div><strong>Meu perfil</strong><small>Revisar preferências</small></div></button></div>
    </section>
  );
}

function Program({ profile, program, previewWorkout }: { profile: Profile; program: GeneratedProgram; previewWorkout: (workout: GeneratedWorkout) => void }) {
  return (
    <section className="screen">
      <ScreenHeader title="Meu programa" kicker="PLANEJAMENTO" profile={profile} />
      <article className="program-overview"><p>PROGRAMA DE {profile.name.toUpperCase()}</p><h2>{program.title}</h2><div><span><strong>{profile.days.length}</strong> dias/semana</span><span><strong>{profile.duration}</strong> por sessão</span></div><div className="program-progress"><span style={{ width: `${Math.max(8, ((14 - program.daysRemaining) / 14) * 100)}%` }} /></div><small>{program.status === "ready" ? `${cycleDateLabel(program.validFrom)} a ${cycleDateLabel(program.validUntil)} · ${program.daysRemaining} dias restantes` : program.split}</small></article>
      <div className="section-heading"><div><p>CICLO DE 2 SEMANAS</p><h2>Treinos deste ciclo</h2></div></div>
      {program.workouts.length > 0 ? <div className="program-list">{program.workouts.map((workout, index) => <button key={workout.id} aria-label={`Ver treino ${workout.name}`} onClick={() => previewWorkout(workout)}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{workout.name}</strong><small>{workout.warmup.length + workout.main.length + workout.cooldown.length} movimentos · {workout.estimatedMinutes} min · 3 blocos</small></div><b>Ver</b></button>)}</div> : <article className="safety-block">{program.notices.map((notice) => <p key={notice}>! {notice}</p>)}</article>}
      <article className="upgrade-card"><span>↻</span><div><strong>Próxima revisão em {program.daysRemaining} {program.daysRemaining === 1 ? "dia" : "dias"}</strong><p>{program.progressionNote}</p></div></article>
    </section>
  );
}

function WorkoutPreview({ workout, onBack, onStart }: { workout: GeneratedWorkout; onBack: () => void; onStart: () => void }) {
  const items = [...workout.warmup, ...workout.main, ...workout.cooldown];
  return <section className="screen workout-preview"><header className="preview-header"><button onClick={onBack}>← Programa</button><span>Overview do treino</span></header><div className="preview-hero"><p>PLANO COMPLETO DA SESSÃO</p><h1>{workout.name}</h1><span>{workout.focus} · {items.length} movimentos · cerca de {workout.estimatedMinutes} min</span></div><div className="workout-blocks-overview preview-blocks"><WorkoutBlockOverview title="Aquecimento e mobilidade" items={workout.warmup} block="warmup" /><WorkoutBlockOverview title="Parte principal" items={workout.main} block="main" /><WorkoutBlockOverview title="Encerramento e alongamento" items={workout.cooldown} block="cooldown" /></div><footer className="preview-actions"><button onClick={onBack}>Agora não</button><button className="start" onClick={onStart}>Iniciar treino →</button></footer></section>;
}

function Exercises() {
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
  return <section className="screen"><div className="simple-header"><p>BIBLIOTECA</p><h1>{filtered.length} {filtered.length === 1 ? "exercício" : "exercícios"}</h1></div><label className="search-field"><span aria-hidden="true">⌕</span><span className="sr-only">Buscar exercício ou músculo</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar exercício ou músculo" />{search && <button aria-label="Limpar busca" onClick={() => setSearch("")}>×</button>}</label><div className="filter-chips" aria-label="Filtrar exercícios">{filters.map((item) => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="exercise-list">{filtered.map((exercise) => { const open = openExercise === exercise.id; const detailsId = `exercise-${exercise.id}`; return <article key={exercise.id} className={open ? "open" : ""}><button className="exercise-trigger" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpenExercise(open ? null : exercise.id)}><span aria-hidden="true">{exercise.movement === "warmup" ? "↗" : exercise.movement === "cooldown" ? "↓" : "●"}</span><div><strong>{exercise.name}</strong><small>{exercise.muscleGroups.join(" · ")} · {exercise.equipment}</small></div><b aria-hidden="true">⌄</b></button>{open && <div className="exercise-details" id={detailsId}><p><strong>Execução</strong>{exercise.instructions}</p><p><strong>Erros comuns</strong>{exercise.commonErrors}</p><div>{exercise.tags.slice(0, 4).map((tag) => <span key={tag}>{tag.replace("-", " ")}</span>)}</div></div>}</article>; })}</div>{filtered.length === 0 && <article className="large-empty-state compact-state"><div className="exercise-glyph" aria-hidden="true"><span /></div><h2>Nada encontrado</h2><p>Tente outro nome, grupo muscular ou filtro.</p><button className="reset-filters" onClick={() => { setSearch(""); setFilter("Todos"); }}>Limpar filtros</button></article>}</section>;
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
  const plannedWeekly = Math.max(profile.days.length, 1);
  const observedWeeklyPace = attendanceDays / 4;
  const adherence = Math.min(100, Math.round((observedWeeklyPace / plannedWeekly) * 100));
  const streak = attendanceStreak(checkIns, history);
  const minutes = history.reduce((total, item) => total + item.durationMinutes, 0);
  const weekly = buildWeeklySessions(history);
  const weightItems = [...measurements].slice(0, 6).reverse().map((item) => ({ label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(item.recordedAt)), value: item.weightKg }));
  const volumeItems = [...history].filter((item) => (item.totalVolumeKg || 0) > 0).slice(0, 6).reverse().map((item, index) => ({ label: `T${index + 1}`, value: Math.round(item.totalVolumeKg || 0) }));
  const complete = Boolean(profile.birthDate && profile.heightCm && profile.weightKg && profile.activityLevel);
  const hasActivity = history.length > 0 || checkIns.length > 0;
  const activities = [
    ...history.map((item) => ({ id: `workout-${item.id}`, type: "Treino concluído", title: item.workoutName, date: item.completedAt, meta: `${item.completedExercises}/${item.totalExercises} movimentos · ${item.durationMinutes} min${item.cardioMinutes ? ` · cardio ${item.cardioMinutes} min ${item.cardioIntensity?.toLowerCase()}` : ""}` })),
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

function ProfileView({ profile, draft, setDraft, editing, setEditing, cancelEditing, saveProfile, handlePhoto, toggleDay, toggleSpecialCondition, theme, changeTheme, exportBackup }: { profile: Profile; draft: Profile; setDraft: (profile: Profile) => void; editing: boolean; setEditing: (value: boolean) => void; cancelEditing: () => void; saveProfile: (event?: FormEvent) => void; handlePhoto: (event: ChangeEvent<HTMLInputElement>) => void; toggleDay: (day: string) => void; toggleSpecialCondition: (condition: string) => void; theme: "dark" | "light"; changeTheme: () => void; exportBackup: () => void }) {
  const canSave = Boolean(draft.name.trim() && draft.goal && draft.experience && draft.days.length && draft.duration && draft.location);
  if (editing) return <section className="screen profile-edit-screen"><div className="edit-header"><button onClick={cancelEditing}>Cancelar</button><h1>Editar perfil</h1><button className="save-link" disabled={!canSave} onClick={() => saveProfile()}>Salvar</button></div><label className="photo-picker compact-photo"><input type="file" accept="image/*" onChange={handlePhoto} /><Avatar profile={draft} size="large" /><span>Alterar foto</span></label><label className="field-label">Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><div className="edit-section-title"><span>01</span><div><strong>Dados de desempenho</strong><small>Peso, cintura e frequência de repouso criam novos registros de evolução.</small></div></div><div className="metric-form-grid"><label className="field-label">Data de nascimento<input type="date" value={draft.birthDate || ""} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></label><label className="field-label">Sexo biológico<select value={draft.biologicalSex || ""} onChange={(event) => setDraft({ ...draft, biologicalSex: event.target.value })}><option value="">Não informar</option><option>Feminino</option><option>Masculino</option></select></label><label className="field-label">Altura (cm)<input inputMode="decimal" type="number" min="100" max="250" value={draft.heightCm || ""} onChange={(event) => setDraft({ ...draft, heightCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Peso (kg)<input inputMode="decimal" type="number" min="25" max="400" step="0.1" value={draft.weightKg || ""} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Cintura (cm)<input inputMode="decimal" type="number" min="40" max="250" step="0.1" value={draft.waistCm || ""} onChange={(event) => setDraft({ ...draft, waistCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">FC de repouso<input inputMode="numeric" type="number" min="30" max="220" value={draft.restingHeartRate || ""} onChange={(event) => setDraft({ ...draft, restingHeartRate: event.target.value ? Number(event.target.value) : undefined })} /></label></div><p className="field-title">Rotina diária</p><div className="choice-grid two-columns">{activityLevels.map((item) => <button type="button" key={item} aria-pressed={draft.activityLevel === item} className={draft.activityLevel === item ? "selected" : ""} onClick={() => setDraft({ ...draft, activityLevel: item })}>{item}</button>)}</div><div className="metric-form-grid"><label className="field-label">Treinos atuais/semana<input inputMode="numeric" type="number" min="0" max="14" value={draft.currentWeeklySessions ?? ""} onChange={(event) => setDraft({ ...draft, currentWeeklySessions: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Minutos ativos/semana<input inputMode="numeric" type="number" min="0" max="2000" value={draft.weeklyActivityMinutes ?? ""} onChange={(event) => setDraft({ ...draft, weeklyActivityMinutes: event.target.value ? Number(event.target.value) : 0 })} /></label></div><div className="edit-section-title"><span>02</span><div><strong>Treino e preferências</strong><small>Estas escolhas ajustam o programa gerado.</small></div></div><p className="field-title">Objetivo</p><div className="choice-grid">{goals.map((goal) => <button type="button" key={goal} aria-pressed={draft.goal === goal} className={draft.goal === goal ? "selected" : ""} onClick={() => setDraft({ ...draft, goal })}>{goal}</button>)}</div><p className="field-title">Nível de experiência</p><div className="choice-row">{experiences.map((item) => <button type="button" key={item} aria-pressed={draft.experience === item} className={draft.experience === item ? "selected" : ""} onClick={() => setDraft({ ...draft, experience: item })}>{item}</button>)}</div><p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button type="button" key={day} aria-pressed={draft.days.includes(day)} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div><p className="field-title">Duração ideal</p><div className="choice-grid two-columns">{durations.map((item) => <button type="button" key={item} aria-pressed={draft.duration === item} className={draft.duration === item ? "selected" : ""} onClick={() => setDraft({ ...draft, duration: item })}>{item}</button>)}</div><p className="field-title">Onde você vai treinar?</p><div className="choice-row">{["Academia", "Em casa", "Ambos"].map((item) => <button type="button" key={item} aria-pressed={draft.location === item} className={draft.location === item ? "selected" : ""} onClick={() => setDraft({ ...draft, location: item })}>{item}</button>)}</div><div className="edit-section-title"><span>03</span><div><strong>Cuidados e segurança</strong><small>Ajude o programa a respeitar seus limites.</small></div></div><div className="condition-grid">{specialConditionOptions.map((item) => <button type="button" key={item.id} aria-pressed={(draft.specialConditions || []).includes(item.id)} className={(draft.specialConditions || []).includes(item.id) ? "selected" : ""} onClick={() => toggleSpecialCondition(item.id)}>{item.label}</button>)}</div><label className="field-label">Limitações<textarea rows={4} value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Nenhuma informada" /></label>{(draft.specialConditions || []).some((item) => ["postpartum", "cesarean", "pregnancy", "cardiovascular"].includes(item)) && <label className="clearance-check"><input type="checkbox" checked={draft.medicalClearance || false} onChange={(event) => setDraft({ ...draft, medicalClearance: event.target.checked })} /><span><strong>Tenho liberação profissional para treinar</strong><small>Marque apenas se essa orientação já foi recebida.</small></span></label>}<button className="primary-button profile-save-cta" disabled={!canSave} onClick={() => saveProfile()}>Salvar alterações <span>✓</span></button></section>;

  return <section className="screen"><div className="profile-hero"><Avatar profile={profile} size="large" /><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}>Editar perfil</button></div><div className="profile-facts"><div><small>Dados corporais</small><strong>{profile.heightCm && profile.weightKg ? `${profile.heightCm} cm · ${formatMetric(profile.weightKg)} kg${profile.waistCm ? ` · cintura ${formatMetric(profile.waistCm)} cm` : ""}` : "Complete seus dados para liberar métricas"}</strong></div><div><small>Rotina</small><strong>{profile.activityLevel || "Não informada"} · {profile.weeklyActivityMinutes || 0} min ativos/semana</strong></div><div><small>Disponibilidade</small><strong>{profile.days.join(" · ")}</strong></div><div><small>Sessão ideal</small><strong>{profile.duration} · {profile.location}</strong></div><div><small>Cuidados</small><strong>{(profile.specialConditions || []).length ? specialConditionOptions.filter((item) => profile.specialConditions?.includes(item.id)).map((item) => item.label).join(" · ") : "Nenhum cuidado especial marcado"}</strong></div><div><small>Observações</small><strong>{profile.limitations || "Nenhuma limitação informada"}</strong></div></div><div className="settings-list"><button onClick={changeTheme}><span>{theme === "dark" ? "☾" : "☀"}</span><div><strong>Aparência</strong><small>{theme === "dark" ? "Tema escuro" : "Tema claro"}</small></div><b>Alterar</b></button><a className="settings-link" href="/BrasaFit.mobileconfig"><span>⇩</span><div><strong>Usar em tela cheia no iPhone</strong><small>Instale o atalho BrasaFit e veja como remover quando quiser.</small></div><b>Ver</b></a><button onClick={exportBackup}><span>↓</span><div><strong>Exportar backup</strong><small>Perfil, programa, medições, check-ins e histórico</small></div><b>Exportar</b></button><div><span>●</span><div><strong>Armazenamento</strong><small>Dados salvos somente neste aparelho</small></div><b className="safe-status">Local</b></div></div><p className="app-version">BRASAFIT · SEU TREINO, SEU RITMO</p></section>;
}

function ProfileViewLegacy({ profile, draft, setDraft, editing, setEditing, saveProfile, handlePhoto, toggleDay, toggleSpecialCondition, theme, changeTheme, exportBackup }: { profile: Profile; draft: Profile; setDraft: (profile: Profile) => void; editing: boolean; setEditing: (value: boolean) => void; saveProfile: (event?: FormEvent) => void; handlePhoto: (event: ChangeEvent<HTMLInputElement>) => void; toggleDay: (day: string) => void; toggleSpecialCondition: (condition: string) => void; theme: "dark" | "light"; changeTheme: () => void; exportBackup: () => void }) {
  if (editing) return <section className="screen profile-edit-screen"><div className="edit-header"><button onClick={() => { setDraft(profile); setEditing(false); }}>Cancelar</button><h1>Editar perfil</h1><button className="save-link" onClick={() => saveProfile()}>Salvar</button></div><label className="photo-picker compact-photo"><input type="file" accept="image/*" onChange={handlePhoto} /><Avatar profile={draft} size="large" /><span>Alterar foto</span></label><label className="field-label">Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><div className="edit-section-title"><span>01</span><div><strong>Dados de desempenho</strong><small>Alterações de peso, cintura e frequência de repouso criam um novo registro histórico.</small></div></div><div className="metric-form-grid"><label className="field-label">Data de nascimento<input type="date" value={draft.birthDate || ""} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></label><label className="field-label">Sexo biológico<select value={draft.biologicalSex || ""} onChange={(event) => setDraft({ ...draft, biologicalSex: event.target.value })}><option value="">Não informar</option><option>Feminino</option><option>Masculino</option></select></label><label className="field-label">Altura (cm)<input type="number" min="100" max="250" value={draft.heightCm || ""} onChange={(event) => setDraft({ ...draft, heightCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Peso (kg)<input type="number" min="25" max="400" step="0.1" value={draft.weightKg || ""} onChange={(event) => setDraft({ ...draft, weightKg: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">Cintura (cm)<input type="number" min="40" max="250" step="0.1" value={draft.waistCm || ""} onChange={(event) => setDraft({ ...draft, waistCm: event.target.value ? Number(event.target.value) : undefined })} /></label><label className="field-label">FC de repouso<input type="number" min="30" max="220" value={draft.restingHeartRate || ""} onChange={(event) => setDraft({ ...draft, restingHeartRate: event.target.value ? Number(event.target.value) : undefined })} /></label></div><p className="field-title">Rotina diária</p><div className="choice-grid two-columns">{activityLevels.map((item) => <button key={item} className={draft.activityLevel === item ? "selected" : ""} onClick={() => setDraft({ ...draft, activityLevel: item })}>{item}</button>)}</div><div className="metric-form-grid"><label className="field-label">Treinos atuais/semana<input type="number" min="0" max="14" value={draft.currentWeeklySessions ?? ""} onChange={(event) => setDraft({ ...draft, currentWeeklySessions: event.target.value ? Number(event.target.value) : 0 })} /></label><label className="field-label">Minutos ativos/semana<input type="number" min="0" max="2000" value={draft.weeklyActivityMinutes ?? ""} onChange={(event) => setDraft({ ...draft, weeklyActivityMinutes: event.target.value ? Number(event.target.value) : 0 })} /></label></div><div className="edit-section-title"><span>02</span><div><strong>Treino e segurança</strong><small>Esses dados alteram o programa gerado.</small></div></div><p className="field-title">Objetivo</p><div className="choice-grid">{goals.map((goal) => <button key={goal} className={draft.goal === goal ? "selected" : ""} onClick={() => setDraft({ ...draft, goal })}>{goal}</button>)}</div><p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button key={day} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div><p className="field-title">Cuidados especiais</p><div className="condition-grid">{specialConditionOptions.map((item) => <button key={item.id} className={(draft.specialConditions || []).includes(item.id) ? "selected" : ""} onClick={() => toggleSpecialCondition(item.id)}>{item.label}</button>)}</div><label className="field-label">Limitações<textarea rows={4} value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Nenhuma informada" /></label>{(draft.specialConditions || []).some((item) => ["postpartum", "cesarean", "pregnancy", "cardiovascular"].includes(item)) && <label className="clearance-check"><input type="checkbox" checked={draft.medicalClearance || false} onChange={(event) => setDraft({ ...draft, medicalClearance: event.target.checked })} /><span><strong>Tenho liberação profissional para treinar</strong><small>Marque apenas se essa orientação já foi recebida.</small></span></label>}</section>;

  return <section className="screen"><div className="profile-hero"><Avatar profile={profile} size="large" /><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}>Editar perfil</button></div><div className="profile-facts"><div><small>Dados corporais</small><strong>{profile.heightCm && profile.weightKg ? `${profile.heightCm} cm · ${formatMetric(profile.weightKg)} kg${profile.waistCm ? ` · cintura ${formatMetric(profile.waistCm)} cm` : ""}` : "Complete seus dados para liberar métricas"}</strong></div><div><small>Rotina</small><strong>{profile.activityLevel || "Não informada"} · {profile.weeklyActivityMinutes || 0} min ativos/semana</strong></div><div><small>Disponibilidade</small><strong>{profile.days.join(" · ")}</strong></div><div><small>Sessão ideal</small><strong>{profile.duration} · {profile.location}</strong></div><div><small>Cuidados</small><strong>{(profile.specialConditions || []).length ? specialConditionOptions.filter((item) => profile.specialConditions?.includes(item.id)).map((item) => item.label).join(" · ") : "Nenhum cuidado especial marcado"}</strong></div><div><small>Observações</small><strong>{profile.limitations || "Nenhuma limitação informada"}</strong></div></div><div className="settings-list"><button onClick={changeTheme}><span>{theme === "dark" ? "☾" : "☀"}</span><div><strong>Aparência</strong><small>{theme === "dark" ? "Tema escuro" : "Tema claro"}</small></div><b>Alterar</b></button><a className="settings-link" href="/BrasaFit.mobileconfig"><span>⇩</span><div><strong>Instalar perfil iOS</strong><small>Atalho em tela cheia e não removível isoladamente</small></div><b>Baixar</b></a><button onClick={exportBackup}><span>↓</span><div><strong>Exportar backup</strong><small>Perfil, programa, medições e histórico</small></div><b>Exportar</b></button><div><span>●</span><div><strong>Armazenamento</strong><small>Dados salvos neste aparelho</small></div><b className="safe-status">Offline</b></div></div><p className="app-version">BRASAFIT · versão 3.0 · base {EXERCISE_DATABASE_VERSION}</p></section>;
}

void [PerformanceLegacy, History, WorkoutSessionLegacy, ProfileViewLegacy];
