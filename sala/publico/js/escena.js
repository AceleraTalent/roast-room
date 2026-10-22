// La escena: asientos alrededor de la mesa, globos de diálogo, flechas de réplica, fichas de voto.
import { $, $$, esc, acotar, colorDe, formasDe, rostro } from "./util.js";
import { estado } from "./estado.js";
import { reproductor as rep } from "./reproductor.js";

const FORMAS = ["reposo", "abierta", "media", "parpadeo"];
// Posición de cada asiento: x (% del ancho), y (% desde abajo del busto) y por (% desde abajo de la placa).
// x, y, por: disposición en arco para escritorio. mx, my, mpor: disposición 2×2 para pantallas angostas.
const POSICIONES = [
  { x: 15, y: 4, por: 3, mx: 27, my: 34, mpor: 36 },
  { x: 38.5, y: 9, por: 3, mx: 73, my: 34, mpor: 36 },
  { x: 61.5, y: 9, por: 3, mx: 27, my: 5, mpor: 7 },
  { x: 85, y: 4, por: 3, mx: 73, my: 5, mpor: 7 },
];

const caraDe = (clave) => $(`#asiento-${clave} .rostro`);
const ponerForma = (clave, forma) => { const r = caraDe(clave); if (r) r.dataset.forma = forma; };

export function montarEscena() {
  $("#asientos").innerHTML = estado.asientos.map((a, i) => `
    <div class="asiento" id="asiento-${a.clave}" data-asiento="${a.clave}" tabindex="0" role="button"
         aria-label="${esc(a.nombre)}, ${esc(a.pilar)}. Abrir tarjeta."
         style="--x:${POSICIONES[i].x}%; --y:${POSICIONES[i].y}%; --mx:${POSICIONES[i].mx}%; --my:${POSICIONES[i].my}%; --retraso:-${(i * 1.7) % 5}s">
      <div class="burbuja-piensa" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="interior">
        <div class="rostro" data-forma="reposo">
          ${FORMAS.map((f) => `<img class="f-${f}" src="${rostro(a.clave, f)}" alt="" draggable="false">`).join("")}
        </div>
      </div>
    </div>`).join("");
  $("#placas").innerHTML = estado.asientos.map((a, i) => `
    <div class="placa" id="placa-${a.clave}" data-asiento="${a.clave}"
         style="--x:${POSICIONES[i].x}%; --por:${POSICIONES[i].por}%; --mx:${POSICIONES[i].mx}%; --mpor:${POSICIONES[i].mpor}%; --color:${a.color}">
      <b>${esc(a.nombre)}</b>
      <small>${esc(a.pilar)}</small>
      <div class="datos"><span class="pesos" title="Peso en esta decisión"></span><span class="chip" hidden></span><span class="nota" hidden></span></div>
    </div>`).join("");
  $$(".asiento").forEach((el) => el.style.setProperty("--color", estado.porClave[el.dataset.asiento].color));
}

/** Atenúa a quien no está sentado y dibuja el peso de cada asiento en su placa. */
export function aplicarMesa(apertura) {
  for (const a of estado.asientos) {
    const ausente = !apertura.mesa.includes(a.clave);
    $(`#asiento-${a.clave}`).classList.toggle("ausente", ausente);
    const p = $(`#placa-${a.clave}`);
    p.classList.toggle("ausente", ausente);
    const peso = apertura.pesos[a.clave]?.peso || 1;
    p.title = `Peso ${peso} de 3. ${apertura.pesos[a.clave]?.motivo || ""}`.trim();
    $(".pesos", p).innerHTML = [1, 2, 3].map((n) => `<i class="${n <= peso ? "" : "vacio"}"></i>`).join("");
  }
}

export function pensar(clave, encendido) {
  $(`#asiento-${clave}`)?.classList.toggle("piensa", encendido);
}

// ---------- orador, foco y globos ----------
export function fijarOrador(clave, objetivo = null) {
  estado.orador = clave;
  $$(".asiento").forEach((el) => {
    const habla = el.dataset.asiento === clave;
    el.classList.toggle("habla", habla);
    el.classList.toggle("apagado", Boolean(clave) && !habla && el.dataset.asiento !== objetivo);
    if (habla) el.classList.remove("piensa");
    el.style.rotate = "";
  });
  $$(".placa").forEach((el) => el.classList.toggle("habla", el.dataset.asiento === clave));
  const foco = $("#foco");
  if (!clave) { foco.classList.remove("on"); return; }
  const el = $(`#asiento-${clave}`);
  const marco = $("#escenario").getBoundingClientRect();
  const c = caraDe(clave).getBoundingClientRect();
  foco.style.left = `${c.left + c.width / 2 - marco.left}px`;
  foco.style.top = `${c.top + c.height * 0.42 - marco.top}px`;
  foco.style.setProperty("--halo", `${estado.porClave[clave].color}66`);
  foco.classList.add("on");
  if (objetivo) {
    const dx = caraDe(objetivo).getBoundingClientRect().left - c.left;
    el.style.rotate = `${Math.sign(dx) * 2.2}deg`;
  }
}

export function quitarGlobo() { $("#globo")?.remove(); }

function nuevoGlobo(clase) {
  quitarGlobo();
  const g = document.createElement("div");
  g.id = "globo";
  g.className = `globo ${clase}`;
  $("#avisos").appendChild(g);
  return g;
}

function anclarGlobo(globo, clave) {
  const marco = $("#avisos").getBoundingClientRect();
  const cara = caraDe(clave).getBoundingClientRect();
  const cx = cara.left + cara.width / 2 - marco.left;
  const ancho = globo.offsetWidth;
  const izq = acotar(cx - ancho / 2, 0, Math.max(0, marco.width - ancho));
  globo.style.left = `${izq}px`;
  globo.style.setProperty("--cola", `${acotar(cx - izq, 26, ancho - 26)}px`);
}

/** Mensaje del Chair, centrado arriba de la mesa. */
export function chair(texto, { puntos = false, etiqueta = "Chair" } = {}) {
  fijarOrador(null);
  const g = nuevoGlobo("chair");
  g.innerHTML = `<div class="quien"><span style="margin:0">${esc(etiqueta)}</span></div><p>${esc(texto)}${puntos ? '<span class="puntos"><span>.</span><span>.</span><span>.</span></span>' : ""}</p>`;
}

/** Un asiento habla: el globo se ancla a su cabeza, las palabras se iluminan y la boca se mueve. */
export async function hablar(clave, texto, { etiqueta = "", objetivo = null, pie = "" } = {}) {
  fijarOrador(clave, objetivo);
  const a = estado.porClave[clave];
  const g = nuevoGlobo("");
  g.style.setProperty("--color", a.color);
  const palabras = texto.split(/\s+/).filter(Boolean);
  g.innerHTML = `<div class="quien"><i></i>${esc(a.nombre)}<span>${esc(etiqueta)}</span></div>
    <p>${palabras.map((w) => `<span class="w">${esc(w)}</span>`).join(" ")}</p><div class="pie-globo"></div>`;
  anclarGlobo(g, clave);
  const marcas = $$(".w", g);
  for (let i = 0; i < palabras.length; i++) {
    if (rep.rapido) break;
    marcas[i].classList.add("on");
    const formas = formasDe(palabras[i].replace(/[^\p{L}]/gu, ""));
    const duracion = Math.max(170, palabras[i].length * 48);
    const trozo = duracion / (formas.length + 1);
    for (const f of formas) { ponerForma(clave, f); await rep.dormir(trozo); }
    ponerForma(clave, "reposo");
    const pausa = /[.!?]["”)]?$/.test(palabras[i]) ? 320 : /[,;:]$/.test(palabras[i]) ? 160 : 20;
    await rep.dormir(trozo + pausa);
  }
  marcas.forEach((m) => m.classList.add("on"));
  ponerForma(clave, "reposo");
  $(".pie-globo", g).textContent = pie;
  await rep.dormir(1200);
}

// ---------- placas, fichas y flechas ----------
export function actualizarPlaca(clave, { chip, nota } = {}) {
  const p = $(`#placa-${clave}`);
  if (chip !== undefined) { const c = $(".chip", p); c.textContent = chip; c.hidden = !chip; }
  if (nota !== undefined) { const n = $(".nota", p); n.textContent = nota; n.hidden = !nota; }
}

export function soltarFicha(clave, letra) {
  $(`#fichas .ficha[data-asiento="${clave}"]`)?.remove();
  const marco = $("#escenario").getBoundingClientRect();
  const p = $(`#placa-${clave}`).getBoundingClientRect();
  const f = document.createElement("div");
  f.className = "ficha";
  f.dataset.asiento = clave;
  f.style.setProperty("--color", colorDe(letra));
  f.textContent = letra;
  f.style.left = `${p.left + p.width / 2 - marco.left}px`;
  f.style.top = `${p.top - marco.top - 54}px`;
  $("#fichas").appendChild(f);
}

export function dibujarFlechas() {
  const marco = $("#escenario").getBoundingClientRect();
  const svg = $("#flechas");
  svg.setAttribute("viewBox", `0 0 ${marco.width} ${marco.height}`);
  const cabeza = (clave) => {
    const r = caraDe(clave).getBoundingClientRect();
    return { x: r.left + r.width / 2 - marco.left, y: r.top + r.height * 0.3 - marco.top };
  };
  const trazos = estado.flechas.map(({ de, a }, i, todas) => {
    const p = cabeza(de), q = cabeza(a);
    const mx = (p.x + q.x) / 2, my = Math.min(p.y, q.y) - 46 - Math.abs(p.x - q.x) * 0.14;
    return `<path class="${i < todas.length - 1 ? "vieja" : ""}" d="M${p.x},${p.y - 10} Q${mx},${my} ${q.x},${q.y - 22}" marker-end="url(#punta)"/>`;
  });
  svg.innerHTML = `<defs><marker id="punta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><polygon points="0,0 10,5 0,10" fill="#ffd166"/></marker></defs>${trazos.join("")}`;
}

export function limpiarRonda() {
  estado.flechas = [];
  dibujarFlechas();
  $("#fichas").innerHTML = "";
}

export function reiniciarEscena() {
  quitarGlobo();
  fijarOrador(null);
  limpiarRonda();
  $$(".asiento").forEach((el) => { el.classList.remove("ausente", "piensa", "habla", "apagado"); el.style.rotate = ""; });
  $$(".placa").forEach((el) => { el.classList.remove("ausente", "habla"); $(".pesos", el).innerHTML = ""; });
  estado.asientos.forEach((a) => { ponerForma(a.clave, "reposo"); actualizarPlaca(a.clave, { chip: "", nota: "" }); });
}

/** Parpadeos al azar para que la sala se sienta viva entre intervenciones. */
export function iniciarParpadeos() {
  estado.asientos.forEach((a, i) => {
    const parpadear = () => {
      const r = caraDe(a.clave);
      if (r && r.dataset.forma === "reposo") {
        r.dataset.forma = "parpadeo";
        setTimeout(() => { if (r.dataset.forma === "parpadeo") r.dataset.forma = "reposo"; }, 140);
      }
      setTimeout(parpadear, 2600 + Math.random() * 4200);
    };
    setTimeout(parpadear, 700 + i * 600);
  });
}
