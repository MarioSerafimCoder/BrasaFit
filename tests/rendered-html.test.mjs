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

test("server-renders the BrasaFit application shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="pt-BR"/i);
  assert.match(html, /<title>BrasaFit — Seu treino, seu ritmo<\/title>/i);
  assert.match(html, /manifest\.webmanifest/i);
  assert.match(html, /class="loading-screen"/i);
  assert.match(html, />BRASAFIT</i);
  assert.doesNotMatch(html, /codex-preview|Starter Project|Building your site/i);
});

test("includes the mobile check-in and protected interaction flows", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../app/FitLocalApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(app, /Fazer check-in/);
  assert.match(app, /Check-in registrado/);
  assert.match(app, /Descartar alterações\?/);
  assert.match(app, /Descartar sessão/);
  assert.match(app, /Resumo do treino/);
  assert.match(app, /label="Progresso"/);
  assert.doesNotMatch(app, /label="Histórico"/);
  assert.match(css, /\.checkin-card/);
  assert.match(css, /\.confirm-dialog/);
  assert.match(css, /grid-template-columns:\s*repeat\(5,\s*1fr\)/);
});
