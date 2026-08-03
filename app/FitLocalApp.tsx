"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type AppTab = "today" | "program" | "exercises" | "history" | "profile";

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
  createdAt: string;
};

const PROFILE_KEY = "fitlocal.profile.v1";
const THEME_KEY = "fitlocal.theme.v1";

const initialProfile: Profile = {
  id: "mario",
  name: "Mário",
  photo: "",
  goal: "Hipertrofia",
  experience: "Intermediário",
  days: ["Seg", "Qua", "Sex"],
  duration: "45 min",
  location: "Academia",
  limitations: "",
  createdAt: "",
};

const goals = ["Hipertrofia", "Força", "Condicionamento", "Mobilidade", "Retorno aos treinos"];
const experiences = ["Iniciante", "Intermediário", "Avançado"];
const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const durations = ["30 min", "45 min", "60 min", "75 min+"];

function todayLabel() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).format(new Date());
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

  useEffect(() => {
    const storedProfile = window.localStorage.getItem(PROFILE_KEY);
    const storedTheme = window.localStorage.getItem(THEME_KEY);
    if (storedProfile) {
      try {
        const parsed = JSON.parse(storedProfile) as Profile;
        setProfile(parsed);
        setDraft(parsed);
      } catch {
        window.localStorage.removeItem(PROFILE_KEY);
      }
    }
    const nextTheme = storedTheme === "light" ? "light" : "dark";
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

  const completion = useMemo(() => {
    if (!profile) return 0;
    const values = [profile.name, profile.goal, profile.experience, profile.duration, profile.location, profile.days.length];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [profile]);

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
    const next = { ...draft, name: draft.name.trim(), createdAt: draft.createdAt || new Date().toISOString() };
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    setProfile(next);
    setDraft(next);
    setEditingProfile(false);
    setTab("today");
    setSavedMessage("Perfil salvo no aparelho");
    window.setTimeout(() => setSavedMessage(""), 2600);
  }

  function exportBackup() {
    if (!profile) return;
    const backup = { app: "FitLocal", version: 1, exportedAt: new Date().toISOString(), profile, workouts: [], history: [] };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fitlocal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) {
    return <main className="loading-screen"><div className="brand-mark" aria-hidden="true"><span /></div><p>FITLOCAL</p></main>;
  }

  if (!profile) {
    return (
      <main className="onboarding-shell">
        <div className="onboarding-top">
          <div className="wordmark"><div className="brand-mark" aria-hidden="true"><span /></div>FITLOCAL</div>
          {step > 0 && <button className="text-button" onClick={() => setStep((current) => Math.max(0, current - 1))}>Voltar</button>}
        </div>
        <div className="step-dots" aria-label={`Etapa ${step + 1} de 4`}>
          {[0, 1, 2, 3].map((item) => <span key={item} className={item <= step ? "active" : ""} />)}
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
            <p className="eyebrow">ETAPA 1 DE 3</p><h1>Vamos começar por você.</h1><p className="lead compact">Essas informações ajudam a organizar o programa certo.</p>
            <label className="photo-picker"><input type="file" accept="image/*" onChange={handlePhoto} /><Avatar profile={draft} size="large" /><span>{draft.photo ? "Trocar foto" : "Adicionar foto"}</span></label>
            <label className="field-label">Como devemos chamar você?<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Seu nome" autoComplete="name" /></label>
            <p className="field-title">Seu principal objetivo</p>
            <div className="choice-grid">{goals.map((goal) => <button key={goal} className={draft.goal === goal ? "selected" : ""} onClick={() => setDraft({ ...draft, goal })}>{goal}</button>)}</div>
            <button className="primary-button" disabled={!draft.name.trim() || !draft.goal} onClick={() => setStep(2)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 2 && (
          <section className="form-panel">
            <p className="eyebrow">ETAPA 2 DE 3</p><h1>Como você treina hoje?</h1>
            <p className="field-title">Nível de experiência</p><div className="choice-row">{experiences.map((item) => <button key={item} className={draft.experience === item ? "selected" : ""} onClick={() => setDraft({ ...draft, experience: item })}>{item}</button>)}</div>
            <p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button key={day} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div>
            <p className="field-title">Duração ideal</p><div className="choice-grid two-columns">{durations.map((item) => <button key={item} className={draft.duration === item ? "selected" : ""} onClick={() => setDraft({ ...draft, duration: item })}>{item}</button>)}</div>
            <p className="field-title">Onde você vai treinar?</p><div className="choice-row">{["Academia", "Em casa", "Ambos"].map((item) => <button key={item} className={draft.location === item ? "selected" : ""} onClick={() => setDraft({ ...draft, location: item })}>{item}</button>)}</div>
            <button className="primary-button" disabled={!draft.experience || draft.days.length === 0} onClick={() => setStep(3)}>Continuar <span>→</span></button>
          </section>
        )}

        {step === 3 && (
          <form className="form-panel" onSubmit={saveProfile}>
            <p className="eyebrow">ETAPA 3 DE 3</p><h1>Últimos cuidados.</h1><p className="lead compact">Conte o que devemos considerar antes de definir seu primeiro treino.</p>
            <label className="field-label">Dores, limitações ou exercícios a evitar<textarea value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Ex.: desconforto no joelho direito, evitar corrida..." rows={5} /></label>
            <div className="summary-card"><Avatar profile={draft} /><div><strong>{draft.name}</strong><span>{draft.goal} · {draft.experience}</span><small>{draft.days.length} dias por semana · {draft.duration}</small></div></div>
            <div className="safety-note"><span>!</span><p>O aplicativo organiza treinos e registros, mas não substitui avaliação médica ou profissional.</p></div>
            <button className="primary-button" type="submit">Concluir meu perfil <span>✓</span></button>
          </form>
        )}
      </main>
    );
  }

  const tabContent = {
    today: <Today profile={profile} online={online} installed={installed} completion={completion} setTab={setTab} exportBackup={exportBackup} />,
    program: <Program profile={profile} />,
    exercises: <Exercises />,
    history: <History />,
    profile: <ProfileView profile={profile} draft={draft} setDraft={setDraft} editing={editingProfile} setEditing={setEditingProfile} saveProfile={saveProfile} handlePhoto={handlePhoto} toggleDay={toggleDay} theme={theme} changeTheme={changeTheme} exportBackup={exportBackup} />,
  }[tab];

  return (
    <main className="app-shell"><div className="mobile-app">
      {savedMessage && <div className="toast">✓ {savedMessage}</div>}
      <div className="app-content">{tabContent}</div>
      <nav className="bottom-nav" aria-label="Navegação principal">
        <NavButton active={tab === "today"} label="Hoje" icon="⌂" onClick={() => setTab("today")} />
        <NavButton active={tab === "program"} label="Programa" icon="▤" onClick={() => setTab("program")} />
        <NavButton active={tab === "exercises"} label="Exercícios" icon="◎" onClick={() => setTab("exercises")} />
        <NavButton active={tab === "history"} label="Histórico" icon="↗" onClick={() => setTab("history")} />
        <NavButton active={tab === "profile"} label="Perfil" icon="○" onClick={() => setTab("profile")} />
      </nav>
    </div></main>
  );
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: string; onClick: () => void }) {
  return <button className={active ? "active" : ""} onClick={onClick}><span aria-hidden="true">{icon}</span><small>{label}</small></button>;
}

function ScreenHeader({ title, profile, kicker }: { title: string; profile: Profile; kicker?: string }) {
  return <header className="screen-header"><div><p>{kicker}</p><h1>{title}</h1></div><Avatar profile={profile} size="small" /></header>;
}

function Today({ profile, online, installed, completion, setTab, exportBackup }: { profile: Profile; online: boolean; installed: boolean; completion: number; setTab: (tab: AppTab) => void; exportBackup: () => void }) {
  return (
    <section className="screen">
      <ScreenHeader title={`Olá, ${profile.name.split(" ")[0]}`} kicker={todayLabel()} profile={profile} />
      <div className={`connection-pill ${online ? "online" : "offline"}`}><span />{online ? "Dados locais prontos" : "Modo offline"}</div>
      <article className="hero-card"><div className="hero-orbit" aria-hidden="true"><span>{completion}%</span></div><p>PRÓXIMO PASSO</p><h2>Seu primeiro treino está quase pronto.</h2><span>Perfil concluído. Agora podemos atribuir um programa pensado para seu objetivo.</span><button onClick={() => setTab("program")}>Ver programa <b>→</b></button></article>
      <div className="week-strip">{weekDays.map((day, index) => <div key={day} className={index === 0 ? "today" : ""}><small>{day}</small><span>{new Date().getDate() + index}</span></div>)}</div>
      <div className="section-heading"><div><p>HOJE</p><h2>Treino do dia</h2></div><span className="version-badge">conteúdo v1.0</span></div>
      <article className="empty-workout-card"><div className="empty-icon" aria-hidden="true">+</div><div><h3>Nenhum treino atribuído</h3><p>Envie seu primeiro programa e ele aparecerá aqui automaticamente na próxima atualização.</p></div></article>
      <div className="metrics-grid"><article><p>Objetivo</p><strong>{profile.goal}</strong><span>foco principal</span></article><article><p>Rotina</p><strong>{profile.days.length}x</strong><span>por semana</span></article><article><p>Duração</p><strong>{profile.duration.replace(" min", "")}</strong><span>minutos</span></article></div>
      {!installed && <article className="install-card"><span aria-hidden="true">⇧</span><div><strong>Instale no iPhone</strong><p>No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p></div></article>}
      <div className="quick-actions"><button onClick={exportBackup}><span>↓</span><div><strong>Fazer backup</strong><small>Salvar uma cópia dos dados</small></div></button><button onClick={() => setTab("profile")}><span>○</span><div><strong>Meu perfil</strong><small>Revisar preferências</small></div></button></div>
    </section>
  );
}

function Program({ profile }: { profile: Profile }) {
  return (
    <section className="screen">
      <ScreenHeader title="Meu programa" kicker="PLANEJAMENTO" profile={profile} />
      <article className="program-overview"><p>PROGRAMA DE {profile.name.toUpperCase()}</p><h2>{profile.goal}</h2><div><span><strong>{profile.days.length}</strong> dias/semana</span><span><strong>{profile.duration}</strong> por sessão</span></div><div className="program-progress"><span style={{ width: "0%" }} /></div><small>0% concluído · aguardando primeiro ciclo</small></article>
      <div className="section-heading"><div><p>SEMANA 1</p><h2>Seus treinos</h2></div></div>
      <article className="timeline-empty"><span className="timeline-dot" /><div><strong>Programa ainda não atribuído</strong><p>Quando você enviar os exercícios, séries e progressões, uma atualização adicionará tudo aqui sem apagar seu perfil.</p></div></article>
      <article className="upgrade-card"><span>↻</span><div><strong>Como chegam os upgrades?</strong><p>Você envia novos treinos ou ajustes, nós publicamos a atualização e o app baixa o conteúdo quando estiver online.</p></div></article>
    </section>
  );
}

function Exercises() {
  const [search, setSearch] = useState("");
  return <section className="screen"><div className="simple-header"><p>BIBLIOTECA</p><h1>Exercícios</h1></div><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar exercício" /></label><div className="filter-chips"><button className="active">Todos</button><button>Academia</button><button>Casa</button><button>Mobilidade</button></div><article className="large-empty-state"><div className="exercise-glyph" aria-hidden="true"><span /></div><h2>{search ? "Nada encontrado" : "Biblioteca pronta para crescer"}</h2><p>{search ? "Esse exercício ainda não está na sua biblioteca." : "Os exercícios dos seus próximos treinos serão organizados aqui, com instruções, alternativas e cuidados."}</p></article></section>;
}

function History() {
  return <section className="screen"><div className="simple-header"><p>EVOLUÇÃO</p><h1>Histórico</h1></div><article className="history-summary"><div><span>0</span><small>treinos</small></div><div><span>0</span><small>minutos</small></div><div><span>—</span><small>sequência</small></div></article><div className="section-heading"><div><p>ATIVIDADE</p><h2>Últimos treinos</h2></div></div><article className="large-empty-state compact-state"><div className="calendar-glyph">01</div><h2>O começo fica registrado aqui.</h2><p>Ao concluir o primeiro treino, você verá cargas, repetições, esforço e evolução.</p></article></section>;
}

function ProfileView({ profile, draft, setDraft, editing, setEditing, saveProfile, handlePhoto, toggleDay, theme, changeTheme, exportBackup }: { profile: Profile; draft: Profile; setDraft: (profile: Profile) => void; editing: boolean; setEditing: (value: boolean) => void; saveProfile: (event?: FormEvent) => void; handlePhoto: (event: ChangeEvent<HTMLInputElement>) => void; toggleDay: (day: string) => void; theme: "dark" | "light"; changeTheme: () => void; exportBackup: () => void }) {
  if (editing) return <section className="screen profile-edit-screen"><div className="edit-header"><button onClick={() => { setDraft(profile); setEditing(false); }}>Cancelar</button><h1>Editar perfil</h1><button className="save-link" onClick={() => saveProfile()}>Salvar</button></div><label className="photo-picker compact-photo"><input type="file" accept="image/*" onChange={handlePhoto} /><Avatar profile={draft} size="large" /><span>Alterar foto</span></label><label className="field-label">Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><p className="field-title">Objetivo</p><div className="choice-grid">{goals.map((goal) => <button key={goal} className={draft.goal === goal ? "selected" : ""} onClick={() => setDraft({ ...draft, goal })}>{goal}</button>)}</div><p className="field-title">Dias disponíveis</p><div className="days-picker">{weekDays.map((day) => <button key={day} className={draft.days.includes(day) ? "selected" : ""} onClick={() => toggleDay(day)}>{day}</button>)}</div><label className="field-label">Limitações<textarea rows={4} value={draft.limitations} onChange={(event) => setDraft({ ...draft, limitations: event.target.value })} placeholder="Nenhuma informada" /></label></section>;

  return <section className="screen"><div className="profile-hero"><Avatar profile={profile} size="large" /><h1>{profile.name}</h1><p>{profile.goal} · {profile.experience}</p><button onClick={() => setEditing(true)}>Editar perfil</button></div><div className="profile-facts"><div><small>Disponibilidade</small><strong>{profile.days.join(" · ")}</strong></div><div><small>Sessão ideal</small><strong>{profile.duration} · {profile.location}</strong></div><div><small>Observações</small><strong>{profile.limitations || "Nenhuma limitação informada"}</strong></div></div><div className="settings-list"><button onClick={changeTheme}><span>{theme === "dark" ? "☾" : "☀"}</span><div><strong>Aparência</strong><small>{theme === "dark" ? "Tema escuro" : "Tema claro"}</small></div><b>Alterar</b></button><button onClick={exportBackup}><span>↓</span><div><strong>Exportar backup</strong><small>Perfil e histórico em um arquivo</small></div><b>Exportar</b></button><div><span>●</span><div><strong>Armazenamento</strong><small>Dados salvos neste aparelho</small></div><b className="safe-status">Seguro</b></div></div><p className="app-version">FITLOCAL · versão 1.0</p></section>;
}
