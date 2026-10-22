#!/usr/bin/env node
// Genera el reporte de una sesión del Roast Room.
//
// Uso:
//   node .claude/skills/roast-room/scripts/generate_report.mjs sessions/<id-de-sesion>
//
// Lee brief.json, round-1.json, round-2.json y round-3.json de la carpeta de la
// sesión, valida su forma, recalcula los promedios, verifica cada cita atribuida
// a un id de fuente (S###) contra los brains y escribe index.html en la misma
// carpeta: un documento autosuficiente (CSS incrustado, sin dependencias) que se
// exporta a PDF desde el navegador con el botón "Descargar PDF".
//
// Código de salida: 0 si el reporte se generó, 1 si faltan archivos o campos
// obligatorios. Las citas no verificadas son advertencias: salen en consola y en
// la sección de alertas del reporte, pero no bloquean la generación.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BRAINS_DIR = join(SKILL_DIR, "brains");

const SEATS = {
  hormozi: { name: "Alex Hormozi", short: "Hormozi", brain: "alex-hormozi", pillar: "Ofertas, precios y ventas" },
  musk: { name: "Elon Musk", short: "Musk", brain: "elon-musk", pillar: "Primeros principios, costos y escala radical" },
  vega: { name: "Freddy Vega", short: "Vega", brain: "freddy-vega", pillar: "Comunidad, adquisición orgánica, educación y retención" },
  borrero: { name: "Simón Borrero", short: "Borrero", brain: "simon-borrero", pillar: "Marketplaces, hipercrecimiento, unit economics y capital" },
};

// ---------- carga y validación ----------

const errors = [];
const warnings = [];

function loadJson(dir, file, required) {
  const path = join(dir, file);
  if (!existsSync(path)) {
    if (required) errors.push(`Falta ${file}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    errors.push(`${file} no es JSON válido: ${e.message}`);
    return null;
  }
}

function need(obj, path, file) {
  const value = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const empty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
  if (empty) errors.push(`${file}: falta el campo "${path}"`);
  return value;
}

function seatKey(raw, file) {
  const key = String(raw || "").toLowerCase().trim();
  if (!SEATS[key]) errors.push(`${file}: asiento desconocido "${raw}" (usa hormozi, musk, vega o borrero)`);
  return key;
}

function checkScores(scores, optionIds, where) {
  if (!scores || typeof scores !== "object") {
    errors.push(`${where}: faltan las puntuaciones`);
    return;
  }
  for (const id of optionIds) {
    const v = scores[id];
    if (typeof v !== "number" || v < 1 || v > 10) errors.push(`${where}: la opción ${id} necesita una puntuación de 1 a 10 (tiene ${JSON.stringify(v)})`);
  }
}

function validate(brief, rounds) {
  need(brief, "decision", "brief.json");
  const options = need(brief, "options", "brief.json") || [];
  const optionIds = options.map((o) => o.id);
  if (optionIds.length < 2) errors.push("brief.json: se necesitan al menos dos opciones");
  const seats = need(brief, "seats", "brief.json") || [];
  for (const s of seats) {
    seatKey(s.seat, "brief.json");
    if (!(s.weight >= 1 && s.weight <= 3)) errors.push(`brief.json: el peso de ${s.seat} debe estar entre 1 y 3`);
  }
  rounds.forEach((round, i) => {
    const file = `round-${i + 1}.json`;
    if (!round) return;
    for (const card of need(round, "cards", file) || []) {
      const key = seatKey(card.seat, file);
      checkScores(card.scores, optionIds, `${file} (${key})`);
      if (i === 2 && !optionIds.includes(card.vote)) errors.push(`${file} (${key}): el voto "${card.vote}" no es una opción del brief`);
    }
  });
  if (rounds[2]) {
    need(rounds[2], "verdict.label", "round-3.json");
    need(rounds[2], "verdict.option", "round-3.json");
    need(rounds[2], "verdict.summary", "round-3.json");
  }
  return optionIds;
}

// ---------- cálculos ----------

function averages(cards, optionIds, weights) {
  const weighted = {};
  const simple = {};
  const votes = {};
  for (const id of optionIds) {
    let wsum = 0, wtotal = 0, sum = 0;
    for (const c of cards) {
      const w = weights[c.seat] ?? 1;
      wsum += w * c.scores[id];
      wtotal += w;
      sum += c.scores[id];
    }
    weighted[id] = cards.length ? round1(wsum / wtotal) : null;
    simple[id] = cards.length ? round1(sum / cards.length) : null;
    votes[id] = cards.filter((c) => c.vote === id).length;
  }
  return { weighted, simple, votes };
}

const round1 = (n) => Math.round(n * 10) / 10;

function compareRecorded(recorded, computed, label) {
  if (!recorded) return;
  for (const [id, value] of Object.entries(computed)) {
    if (value == null || recorded[id] == null) continue;
    if (Math.abs(recorded[id] - value) > 0.05) {
      warnings.push(`El ${label} registrado para ${id} (${recorded[id]}) no coincide con el recalculado (${value}). El reporte usa el recalculado.`);
    }
  }
}

// ---------- verificación de citas ----------

function norm(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function brainText(slug) {
  const dir = join(BRAINS_DIR, slug);
  if (!existsSync(dir)) return "";
  return norm(readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => readFileSync(join(dir, f), "utf8")).join(" "));
}

function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

function checkQuotes(brief, rounds) {
  const brains = Object.fromEntries(Object.entries(SEATS).map(([k, s]) => [k, brainText(s.brain)]));
  const allBrains = Object.values(brains).join(" ");
  const briefText = norm(collectStrings(brief).join(" "));
  const quoteRe = /["“]([^"“”\n]{20,500})["”][^\n"“]{0,40}?[(\[]S\d{3}/g;
  const unverified = [];
  const seen = new Set();
  let verified = 0;
  rounds.forEach((round, i) => {
    if (!round) return;
    const pieces = [];
    for (const card of round.cards || []) pieces.push({ seat: card.seat, text: collectStrings(card).join("\n") });
    pieces.push({ seat: null, text: collectStrings({ ...round, cards: undefined }).join("\n") });
    for (const { seat, text } of pieces) {
      for (const m of text.matchAll(quoteRe)) {
        const q = norm(m[1]);
        if (q.split(" ").length < 6 || seen.has(q)) continue;
        seen.add(q);
        const own = seat && brains[seat];
        if ((own && own.includes(q)) || allBrains.includes(q) || briefText.includes(q)) verified++;
        else unverified.push({ round: i + 1, seat, quote: m[1] });
      }
    }
  });
  for (const u of unverified) warnings.push(`Cita no verificada (ronda ${u.round}${u.seat ? `, ${SEATS[u.seat]?.short || u.seat}` : ""}): "${u.quote.slice(0, 120)}"`);
  return { verified, unverified };
}

// ---------- HTML ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const seatName = (k) => SEATS[k]?.short || k;
const fmt = (n) => (n == null ? "–" : String(n).replace(".", ","));
const list = (items, render = (x) => esc(x)) =>
  items && items.length ? `<ul>${items.map((x) => `<li>${render(x)}</li>`).join("")}</ul>` : "";
const withSeat = (x) => (typeof x === "string" ? esc(x) : `${esc(x.text)}${x.seat ? ` <span class="who">${esc(seatName(x.seat))}</span>` : ""}`);

function scoreCell(v, best) {
  if (v == null) return "<td>–</td>";
  const pct = Math.max(0, Math.min(100, (v / 10) * 100));
  return `<td class="${best ? "best" : ""}"><span class="num">${fmt(v)}</span><span class="bar"><i style="width:${pct}%"></i></span></td>`;
}

function matrix(title, cards, options, weights, totals, voteRow) {
  if (!cards || !cards.length) return "";
  const bestOf = (row) => Math.max(...options.map((o) => row[o.id] ?? -1));
  const rows = cards
    .map((c) => {
      const best = bestOf(c.scores);
      return `<tr><th scope="row">${esc(seatName(c.seat))}<small>peso ${weights[c.seat] ?? 1}</small></th>${options
        .map((o) => scoreCell(c.scores[o.id], c.scores[o.id] === best))
        .join("")}${voteRow ? `<td class="vote">${esc(c.vote || "")}</td>` : ""}</tr>`;
    })
    .join("");
  const wBest = bestOf(totals.weighted);
  const foot = `
    <tr class="total"><th scope="row">Promedio ponderado</th>${options.map((o) => scoreCell(totals.weighted[o.id], totals.weighted[o.id] === wBest)).join("")}${voteRow ? "<td></td>" : ""}</tr>
    <tr class="sub"><th scope="row">Promedio simple</th>${options.map((o) => `<td>${fmt(totals.simple[o.id])}</td>`).join("")}${voteRow ? "<td></td>" : ""}</tr>
    ${voteRow ? `<tr class="sub"><th scope="row">Votos</th>${options.map((o) => `<td>${totals.votes[o.id]}</td>`).join("")}<td></td></tr>` : ""}`;
  return `
  <div class="matrix">
    <h3>${esc(title)}</h3>
    <div class="scroll"><table>
      <thead><tr><th></th>${options.map((o) => `<th scope="col" title="${esc(o.label)}">${esc(o.id)}</th>`).join("")}${voteRow ? "<th>Voto</th>" : ""}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>${foot}</tfoot>
    </table></div>
  </div>`;
}

function rawCard(card) {
  return card.raw ? `<details><summary>Ver tarjeta textual</summary><pre>${esc(card.raw)}</pre></details>` : "";
}

function round1Section(r1) {
  if (!r1) return "";
  const notes = r1.chair_notes || {};
  const cards = r1.cards
    .map(
      (c) => `
    <article class="card">
      <header><h4>${esc(seatName(c.seat))}</h4><span class="tag">${esc(c.stance || "")}</span></header>
      <p class="call">${esc(c.call || "")}</p>
      ${list(c.why)}
      <dl>
        ${c.risk ? `<dt>Riesgo que ve</dt><dd>${esc(c.risk)}</dd>` : ""}
        ${c.change_mind ? `<dt>Qué lo haría cambiar</dt><dd>${esc(c.change_mind)}</dd>` : ""}
        ${c.question ? `<dt>Pregunta para el fundador</dt><dd>${esc(c.question)}</dd>` : ""}
      </dl>
      <p class="meta">Confianza ${esc(c.confidence ?? "–")}/5 · Riesgo de ruina: ${esc(c.ruin_risk || "–")} · Puerta ${esc(c.door || "–")}</p>
      ${rawCard(c)}
    </article>`,
    )
    .join("");
  const cruxes = (notes.cruxes || []).map((x) => (typeof x === "string" ? x : x.text));
  return `
  <section class="round">
    <h3>Ronda 1: posiciones iniciales</h3>
    <div class="cards">${cards}</div>
    ${cruxes.length ? `<div class="notes"><h4>Puntos de quiebre</h4>${list(cruxes)}</div>` : ""}
    ${notes.consensus ? `<p class="notes">Consenso: <strong>${notes.consensus.reached ? "sí" : "no"}</strong>. ${esc(notes.consensus.reason || "")}</p>` : ""}
  </section>`;
}

function round2Section(r2) {
  if (!r2) return "";
  const notes = r2.chair_notes || {};
  const friction = (notes.friction || [])
    .map((f) => `<li><strong>${esc((f.between || []).map(seatName).join(" contra "))}:</strong> ${esc(f.summary)}</li>`)
    .join("");
  const cards = r2.cards
    .map((c) => {
      const devil = c.role === "abogado";
      const moved = c.moved && c.moved.moved;
      return `
    <article class="card ${devil ? "devil" : ""}">
      <header><h4>${esc(seatName(c.seat))}${c.responds_to ? ` <span class="arrow">responde a</span> ${esc(seatName(c.responds_to))}` : ""}</h4>
        ${devil ? `<span class="tag warn">Abogado del diablo de ${esc(c.advocate_option || "")}</span>` : ""}</header>
      ${c.rebuttal ? `<p>${esc(c.rebuttal)}</p>` : ""}
      ${devil && c.best_case ? `<p class="label">El mejor caso para ${esc(c.advocate_option || "")}</p>${list(c.best_case)}` : ""}
      ${c.concede ? `<p><span class="label">Concede:</span> ${esc(c.concede)}</p>` : ""}
      <p class="meta">${moved ? `Se movió de ${esc(c.moved.from)} a ${esc(c.moved.to)}: ${esc(c.moved.because || "")}` : "No se movió"}</p>
      ${c.conditions && c.conditions.length ? `<p class="label">Condiciones para el sí</p>${list(c.conditions)}` : ""}
      ${rawCard(c)}
    </article>`;
    })
    .join("");
  return `
  <section class="round">
    <h3>Ronda 2: debate cruzado</h3>
    ${friction ? `<div class="notes"><h4>Momentos de mayor fricción</h4><ul>${friction}</ul></div>` : ""}
    <div class="cards">${cards}</div>
    ${notes.resolved && notes.resolved.length ? `<div class="notes"><h4>Puntos de quiebre resueltos</h4>${list(notes.resolved)}</div>` : ""}
    ${notes.open && notes.open.length ? `<div class="notes"><h4>Siguen abiertos</h4>${list(notes.open)}</div>` : ""}
  </section>`;
}

function round3Section(r3) {
  if (!r3) return "";
  const cards = r3.cards
    .map(
      (c) => `
    <article class="card">
      <header><h4>${esc(seatName(c.seat))}</h4><span class="tag">Vota ${esc(c.vote)}</span></header>
      ${c.line ? `<p class="call">${esc(c.line)}</p>` : ""}
      <dl>
        ${c.safeguard ? `<dt>Salvaguarda innegociable</dt><dd>${esc(c.safeguard)}</dd>` : ""}
        ${c.main_risk ? `<dt>Riesgo principal</dt><dd>${esc(c.main_risk)}</dd>` : ""}
      </dl>
      ${rawCard(c)}
    </article>`,
    )
    .join("");
  return `<section class="round"><h3>Ronda 3: votación final</h3><div class="cards">${cards}</div></section>`;
}

function alertsSection(r1, r2, r3, quoteCheck, brief) {
  const verdict = r3?.verdict || {};
  const ruin = [];
  for (const [i, r] of [r1, r2].entries())
    for (const c of r?.cards || []) if (c.ruin_risk && /probable|posible/.test(c.ruin_risk)) ruin.push(`${seatName(c.seat)} (ronda ${i + 1}): riesgo de ruina ${c.ruin_risk}`);
  const safeguards = (r3?.cards || []).filter((c) => c.safeguard).map((c) => ({ text: c.safeguard, seat: c.seat }));
  const risks = (verdict.risks || []).map((r) =>
    typeof r === "string" ? r : `${r.text}${r.early_signal ? `. Señal temprana: ${r.early_signal}` : ""}${r.seat ? ` (${seatName(r.seat)})` : ""}`,
  );
  const assumptions = brief.assumptions || [];
  return `
  <section id="alertas">
    <h2>Alertas y salvaguardas</h2>
    <div class="grid2">
      <div class="panel">
        <h3>Riesgos principales</h3>
        ${list(risks) || "<p>Sin riesgos registrados.</p>"}
        ${ruin.length ? `<h4>Riesgo de ruina señalado</h4>${list(ruin)}` : ""}
      </div>
      <div class="panel">
        <h3>Salvaguardas de cada asiento</h3>
        ${list(safeguards, withSeat) || "<p>Sin salvaguardas registradas.</p>"}
      </div>
    </div>
    ${assumptions.length ? `<div class="panel"><h3>Supuestos que pesaron</h3>${list(assumptions)}</div>` : ""}
    <div class="panel ${quoteCheck.unverified.length ? "warnbox" : ""}">
      <h3>Verificación de citas</h3>
      <p>${quoteCheck.verified} citas atribuidas verificadas contra los brains. ${quoteCheck.unverified.length ? `${quoteCheck.unverified.length} sin verificar: no las tomes como palabras de la persona real.` : "Ninguna sin verificar."}</p>
      ${list(quoteCheck.unverified, (u) => `${esc(u.quote)} <span class="who">ronda ${u.round}${u.seat ? `, ${esc(seatName(u.seat))}` : ""}</span>`)}
    </div>
  </section>`;
}

function render(brief, rounds, totals, quoteCheck, sessionId) {
  const [r1, r2, r3] = rounds;
  const options = brief.options;
  const weights = Object.fromEntries(brief.seats.map((s) => [s.seat, s.weight]));
  const verdict = r3?.verdict || {};
  const winner = options.find((o) => o.id === verdict.option);
  const winScore = totals.r3 ? totals.r3.weighted[verdict.option] : null;
  const actions = verdict.actions || {};
  const date = brief.created ? new Date(brief.created) : null;
  const dateText = date && !isNaN(date) ? date.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }) : "";
  const metrics = brief.context?.metrics || [];
  const incomplete = !r3;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roast Room: ${esc(brief.decision)}</title>
<style>
:root{--bg:#f7f5f0;--paper:#fff;--ink:#1d1b18;--muted:#6b665d;--line:#e3ded3;--accent:#c2410c;--accent-soft:#fdebe0;--good:#15803d;--good-soft:#e3f4e8;--warn:#b45309;--warn-soft:#fdf2dc;--bar:#e9e4d9}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--paper:#1d1b18;--ink:#f1ede4;--muted:#a59f93;--line:#34312b;--accent:#fb923c;--accent-soft:#3a2416;--good:#4ade80;--good-soft:#16301f;--warn:#fbbf24;--warn-soft:#352a12;--bar:#2c2925}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:980px;margin:0 auto;padding:32px 16px 64px}
h1{font-size:clamp(1.5rem,4vw,2.2rem);line-height:1.2;margin:.2em 0 .4em}
h2{font-size:1.35rem;margin:2.2em 0 .8em;padding-bottom:.3em;border-bottom:2px solid var(--line)}
h3{font-size:1.08rem;margin:1.4em 0 .6em}
h4{font-size:1rem;margin:0}
.eyebrow{color:var(--accent);font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.78rem}
.muted,.meta{color:var(--muted);font-size:.9rem}
.toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
button{font:inherit;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:8px 14px;border-radius:8px;cursor:pointer}
button.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.panel,.card,.verdict{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:12px 0}
.verdict{border-left:6px solid var(--accent)}
.verdict .label{display:inline-block;background:var(--accent-soft);color:var(--accent);font-weight:700;padding:4px 10px;border-radius:999px}
.score{font-size:2.6rem;font-weight:800;line-height:1}
.score small{font-size:1rem;color:var(--muted);font-weight:500}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:12px 0}
.kv div{background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.kv b{display:block;font-size:.78rem;color:var(--muted);font-weight:600}
.options li{margin:.2em 0}
.scroll{overflow-x:auto}
table{border-collapse:collapse;width:100%;background:var(--paper);border:1px solid var(--line);border-radius:12px;overflow:hidden}
th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
thead th{font-size:.85rem;color:var(--muted)}
th small{display:block;color:var(--muted);font-weight:400;font-size:.75rem}
td .num{display:inline-block;min-width:2.2em;font-weight:700}
td .bar{display:inline-block;vertical-align:middle;width:70px;height:6px;background:var(--bar);border-radius:3px;margin-left:6px}
td .bar i{display:block;height:100%;background:var(--muted);border-radius:3px}
td.best .bar i{background:var(--accent)}
td.best .num{color:var(--accent)}
tr.total th,tr.total td{border-top:2px solid var(--line);font-weight:700}
tr.sub td,tr.sub th{color:var(--muted);font-size:.9rem}
td.vote{font-weight:700}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px}
.card header{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px}
.card.devil{border-color:var(--warn);background:linear-gradient(var(--warn-soft),var(--paper) 120px)}
.tag{font-size:.78rem;font-weight:700;background:var(--good-soft);color:var(--good);padding:3px 9px;border-radius:999px;white-space:nowrap}
.tag.warn{background:var(--warn-soft);color:var(--warn)}
.arrow{color:var(--muted);font-weight:400;font-size:.85rem}
.call{font-weight:600}
.label{font-weight:700;margin:.6em 0 .2em}
.who{color:var(--muted);font-size:.85rem}
dl{margin:.6em 0}dt{font-weight:700;font-size:.85rem}dd{margin:0 0 .5em}
.notes{margin:12px 0}
.warnbox{border-color:var(--warn);background:var(--warn-soft)}
details{margin-top:8px}summary{cursor:pointer;color:var(--muted);font-size:.85rem}
pre{white-space:pre-wrap;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;background:var(--bg);border-radius:8px;padding:10px;margin:8px 0 0}
.banner{background:var(--warn-soft);border:1px solid var(--warn);border-radius:10px;padding:10px 14px;margin:12px 0}
footer{margin-top:48px;color:var(--muted);font-size:.85rem}
@media print{
  :root{--bg:#fff;--paper:#fff;--ink:#000;--muted:#555;--line:#ccc;--accent:#c2410c;--bar:#eee}
  body{background:#fff;font-size:12px}
  main{max-width:none;padding:0}
  .toolbar{display:none}
  details{display:block}details>summary{display:none}details pre{display:block}
  .card,.panel,.verdict,table{break-inside:avoid}
  h2{break-after:avoid}
  .cards{grid-template-columns:1fr 1fr}
}
</style>
</head>
<body>
<main>
  <p class="eyebrow">Roast Room · sesión ${esc(sessionId)}${dateText ? ` · ${esc(dateText)}` : ""}</p>
  <h1>${esc(brief.decision)}</h1>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">Descargar PDF</button>
    <button onclick="document.querySelectorAll('details').forEach(function(d){d.open=!d.open})">Mostrar u ocultar tarjetas textuales</button>
  </div>
  ${incomplete ? `<div class="banner">Sesión incompleta: falta round-3.json, así que no hay veredicto todavía.</div>` : ""}

  <section id="veredicto">
    <h2>Resumen ejecutivo</h2>
    ${
      r3
        ? `<div class="verdict">
      <span class="label">${esc(verdict.label)}</span>
      <div class="grid2" style="align-items:end;margin-top:12px">
        <div><p class="muted" style="margin:0">Opción ganadora</p><h3 style="margin:.2em 0">${esc(verdict.option)}${winner ? `: ${esc(winner.label)}` : ""}</h3></div>
        <div><p class="muted" style="margin:0">Promedio ponderado</p><p class="score">${fmt(winScore)}<small> / 10</small></p></div>
      </div>
      <p>${esc(verdict.summary)}</p>
      ${verdict.tie ? `<p class="muted">Empate técnico: ${esc(verdict.tie_reason || "decidido por la calidad de los argumentos")}.</p>` : ""}
      ${verdict.why && verdict.why.length ? `<h4>Por qué ganó</h4>${list(verdict.why, withSeat)}` : ""}
      ${verdict.conditions && verdict.conditions.length ? `<h4>Condiciones de ejecución</h4>${list(verdict.conditions, withSeat)}` : ""}
      ${
        actions.this_week || actions.next_30_days || actions.kill_criteria
          ? `<h4>Acciones inmediatas</h4><ul>${actions.this_week ? `<li><strong>Esta semana:</strong> ${esc(actions.this_week)}</li>` : ""}${actions.next_30_days ? `<li><strong>Próximos 30 días:</strong> ${esc(actions.next_30_days)}</li>` : ""}${actions.kill_criteria ? `<li><strong>Criterio para abortar:</strong> ${esc(actions.kill_criteria)}</li>` : ""}</ul>`
          : ""
      }
      ${verdict.dissent ? `<h4>Disidencia</h4><p>${withSeat(verdict.dissent)}</p>` : ""}
    </div>`
        : "<p>Sin veredicto todavía.</p>"
    }
    <h3>El caso</h3>
    <ul class="options">${options.map((o) => `<li><strong>${esc(o.id)}.</strong> ${esc(o.label)}${o.added_by_chair ? ' <span class="who">(añadida por el Chair)</span>' : ""}</li>`).join("")}</ul>
    ${metrics.length ? `<div class="kv">${metrics.map((m) => `<div><b>${esc(m.name)}${m.assumed ? " (supuesto)" : ""}</b>${esc(m.value)}</div>`).join("")}</div>` : ""}
    ${brief.context?.business ? `<p><strong>Negocio:</strong> ${esc(brief.context.business)}</p>` : ""}
    ${brief.success ? `<p><strong>Éxito significa:</strong> ${esc(brief.success)}${brief.horizon ? ` (${esc(brief.horizon)})` : ""}</p>` : ""}
    ${brief.lean ? `<p><strong>Inclinación inicial del usuario:</strong> ${esc(brief.lean.option || "")}. ${esc(brief.lean.reason || "")}</p>` : ""}
  </section>

  <section id="matriz">
    <h2>Matriz comparativa de puntajes</h2>
    <p class="muted">Puntuación de 1 a 10 de cada asiento por opción. El promedio ponderado usa los pesos de relevancia que el Chair asignó a cada asiento: ${brief.seats.map((s) => `${esc(seatName(s.seat))} ${s.weight}`).join(", ")}.</p>
    ${totals.r3 ? matrix("Votación final (Ronda 3)", r3.cards, options, weights, totals.r3, true) : ""}
    ${totals.r2 ? matrix("Después del debate (Ronda 2)", r2.cards, options, weights, totals.r2, false) : ""}
    ${totals.r1 ? matrix("Posiciones iniciales (Ronda 1)", r1.cards, options, weights, totals.r1, false) : ""}
  </section>

  <section id="rondas">
    <h2>Desglose por rondas</h2>
    ${round1Section(r1)}
    ${round2Section(r2)}
    ${round3Section(r3)}
  </section>

  ${alertsSection(r1, r2, r3, quoteCheck, brief)}

  <footer>
    Los asientos son simulaciones construidas a partir de la obra pública de cada persona. No son las personas, no hablan por ellas y ninguna está afiliada a este proyecto. Solo las frases entre comillas con id de fuente (S###) verificado en su brain son citas textuales.
  </footer>
</main>
</body>
</html>
`;
}

// ---------- principal ----------

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Uso: node .claude/skills/roast-room/scripts/generate_report.mjs sessions/<id-de-sesion>");
    process.exit(1);
  }
  const dir = resolve(arg);
  if (!existsSync(dir)) {
    console.error(`No existe la carpeta de sesión: ${dir}`);
    process.exit(1);
  }

  const brief = loadJson(dir, "brief.json", true);
  const rounds = ["round-1.json", "round-2.json", "round-3.json"].map((f) => loadJson(dir, f, f === "round-1.json"));
  if (!brief) return fail();

  for (const r of rounds) for (const c of r?.cards || []) c.seat = String(c.seat || "").toLowerCase().trim();
  for (const s of brief.seats || []) s.seat = String(s.seat || "").toLowerCase().trim();

  const optionIds = validate(brief, rounds);
  if (errors.length) return fail();

  const weights = Object.fromEntries(brief.seats.map((s) => [s.seat, s.weight]));
  const totals = {};
  rounds.forEach((r, i) => {
    if (r) totals[`r${i + 1}`] = averages(r.cards, optionIds, weights);
  });
  if (rounds[2]?.results) {
    compareRecorded(rounds[2].results.weighted, totals.r3.weighted, "promedio ponderado");
    compareRecorded(rounds[2].results.simple, totals.r3.simple, "promedio simple");
  }
  if (rounds[2]) {
    const w = totals.r3.weighted;
    const top = optionIds.reduce((a, b) => (w[b] > w[a] ? b : a));
    const v = rounds[2].verdict.option;
    if (v !== top && Math.abs(w[top] - w[v]) > 0.3 && !rounds[2].verdict.tie)
      warnings.push(`El veredicto elige ${v} (${w[v]}) pero el mayor promedio ponderado es ${top} (${w[top]}). Revisa la justificación del Chair.`);
  }

  const quoteCheck = checkQuotes(brief, rounds);
  const sessionId = basename(dir);
  const out = join(dir, "index.html");
  writeFileSync(out, render(brief, rounds, totals, quoteCheck, sessionId));

  console.log(`Reporte generado: ${out}`);
  if (totals.r3) console.log(`Promedio ponderado final: ${optionIds.map((id) => `${id} ${fmt(totals.r3.weighted[id])}`).join(" · ")}`);
  console.log(`Citas verificadas: ${quoteCheck.verified}. Sin verificar: ${quoteCheck.unverified.length}.`);
  for (const w of warnings) console.log(`AVISO: ${w}`);
}

function fail() {
  console.error("No se pudo generar el reporte:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

main();
