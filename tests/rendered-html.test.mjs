import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Angels Fit application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="pt-BR"/i);
  assert.match(html, /<title>Angels Fit — Seu treino, seu ritmo<\/title>/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /class="loading-screen"/i);
  assert.match(html, />ANGELS FIT</i);
  assert.doesNotMatch(html, /codex-preview|Starter Project|Building your site/i);
});

test("includes the mobile check-in, two-week workout and protected interaction flows", async () => {
  const [app, css, engine, data, postpartum, media, mediaQueries] = await Promise.all([
    readFile(new URL("../app/FitLocalApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/workout-engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/workout-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/postpartum-program.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/exercise-media.generated.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/exercise-media-queries.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Fazer check-in/);
  assert.match(app, /Check-in registrado/);
  assert.match(app, /Descartar alterações\?/);
  assert.match(app, /Descartar sessão/);
  assert.match(app, /TREINO DO DIA/);
  assert.match(app, /Overview do treino/);
  assert.match(app, /Aquecimento e mobilidade/);
  assert.match(app, /Encerramento e alongamento/);
  assert.match(app, /Duração do cardio/);
  assert.match(app, /CHECK-IN DE PRONTIDÃO/);
  assert.match(app, /RESPOSTA DE 24 HORAS/);
  assert.match(app, /RIR da série/);
  assert.match(app, /label="Progresso"/);
  assert.doesNotMatch(app, /label="Histórico"/);
  assert.doesNotMatch(app, /TREINO GERADO PARA VOCÊ/);
  assert.match(engine, /setDate\(cycleEnd\.getDate\(\) \+ 13\)/);
  assert.match(engine, /reviewPreviousCycle/);
  assert.match(engine, /postpartumProgram/);
  const postpartumEngine = engine.slice(engine.indexOf("function postpartumProgram"), engine.indexOf("export function generateProgram"));
  assert.doesNotMatch(postpartumEngine, /clearance_required|workouts:\s*\[\]/);
  assert.match(postpartumEngine, /status: "ready"/);
  assert.match(engine, /Math\.floor\(cycleIndex \/ 2\)/);
  assert.match(data, /EXERCISE_DATABASE_VERSION = "4\.1"/);
  assert.ok((data.match(/id: "/g) || []).length >= 63, "exercise library should contain at least 63 movements");
  assert.match(postpartum, /block: 1, weeks: "10-11"/);
  assert.match(postpartum, /block: 8, weeks: "24-25"/);
  assert.match(engine, /Liberação e sintomas podem ser atualizados a qualquer momento e não bloqueiam/);
  assert.match(app, /Demonstração ilustrativa em loop/);
  assert.ok((media.match(/videoUrl/g) || []).length >= 10, "common movements should have bundled media");
  assert.ok((mediaQueries.match(/:\s*"/g) || []).length >= 70, "all movements should have an on-demand media query");
  assert.match(app, /oss\.exercisedb\.dev\/api\/v1\/exercises\/search/);
  assert.match(css, /\.checkin-card/);
  assert.match(css, /\.confirm-dialog/);
  assert.match(css, /\.workout-block/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*1fr\)/);
});
