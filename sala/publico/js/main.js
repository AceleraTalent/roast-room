// Arranque de la sala: conecta la sesión (en vivo o guardada), traduce cada paso a escena y panel,
// y registra los controles e interacciones.
import { $, $$, esc, limpiar, primerasFrases, reloj, coma, acortar } from "./util.js";
import { estado, reiniciarSesion } from "./estado.js";
import { reproductor as rep } from "./reproductor.js";
import * as escena from "./escena.js";
import * as panel from "./panel.js";
import { aviso, abrirGuia, abrirTarjeta, abrirHistorial, copiarEjemplo, GUIA } from "./dialogos.js";
import { mostrarSentencia, abrirSentencia, cerrarSentencia, sentenciaAbierta, imprimir } from "./veredicto.js";

const INICIO_HTML = $("#inicio").innerHTML;
const NOMBRE_RONDA = ["", "Apertura", "Debate", "Voto"];
const FASES_DEL_CHAIR = new Set(["brief", "fracturas", "pesando", "sentencia"]);
let informeDisponible = false;

// ---------------------------------------------------------------- arranque
async function arrancar() {
  const { asientos } = await fetch("/api/asientos").then((r) => r.json());
  estado.asientos = asientos;
  estado.porClave = Object.fromEntries(asientos.map((a) => [a.clave, a]));
  escena.montarEscena();
  escena.iniciarParpadeos();
  conectarControles();
  rep.manejador = manejar;
  rep.alCambiar = pintarMando;
  new ResizeObserver(() => escena.dibujarFlechas()).observe($("#escenario"));
  const enHash = new URLSearchParams(location.hash.slice(1)).get("sesion"); // leerlo antes de que salir() lo borre
  salir();
  const { enCurso } = await fetch("/api/sesiones").then((r) => r.json());
  if (enHash) abrirSesion(enHash);
  else if (enCurso) abrirSesion(enCurso);
  setInterval(vigilarSesionNueva, 3000);
  setInterval(pintarEspera, 1000);
}

/** Si Claude Code empieza una sesión mientras la sala está abierta, la sala la toma sola. */
const vistas = new Set();
async function vigilarSesionNueva() {
  const { enCurso } = await fetch("/api/sesiones").then((r) => r.json()).catch(() => ({}));
  if (!enCurso || vistas.has(enCurso) || enCurso === estado.sesion) return;
  vistas.add(enCurso);
  abrirSesion(enCurso);
}

// ---------------------------------------------------------------- sesiones
function limpiarTodo() {
  estado.fuente?.close();
  estado.fuente = null;
  rep.reiniciar();
  reiniciarSesion();
  escena.reiniciarEscena();
  panel.reiniciarPanel();
  panel.vaciarBitacora('<div class="vacio">Una línea por asesor mientras el consejo habla. Haz clic en un asesor o en una línea para leer su tarjeta completa.</div>');
  cerrarSentencia();
  $("#inicio").innerHTML = INICIO_HTML;
  $("#espera").hidden = true;
}

function salir() {
  limpiarTodo();
  estado.sesion = null;
  history.replaceState(null, "", location.pathname);
  $("#inicio").hidden = false;
  $("#mando").hidden = true;
  $("#btnNueva").hidden = true;
  panel.tituloBitacora("Para empezar");
  panel.vaciarBitacora(GUIA);
  enlazarInicio();
}

function abrirSesion(id) {
  limpiarTodo();
  estado.sesion = id;
  estado.enVivo = true;
  vistas.add(id);
  history.replaceState(null, "", `#sesion=${encodeURIComponent(id)}`);
  $("#inicio").hidden = true;
  $("#mando").hidden = false;
  $("#btnNueva").hidden = false;
  panel.tituloBitacora("Bitácora");
  escena.chair("El consejo toma asiento", { puntos: true });
  fetch("/api/sesiones").then((r) => r.json()).then(({ sesiones }) => { informeDisponible = Boolean(sesiones.find((s) => s.id === id)?.informe); });
  const fuente = new EventSource(`/api/seguir/${encodeURIComponent(id)}`);
  estado.fuente = fuente;
  fuente.onmessage = (m) => {
    const paso = JSON.parse(m.data);
    if (paso.tipo === "fin") { estado.enVivo = false; fuente.close(); return; }
    rep.empujar(paso);
  };
}

// ---------------------------------------------------------------- pasos
async function manejar(p) {
  switch (p.tipo) {
    case "fase": return enFase(p);
    case "apertura": return enApertura(p);
    case "ronda": return enRonda(p);
    case "turno": escena.pensar(p.asiento, true); return;
    case "intervencion": return enIntervencion(p);
    case "marcador": estado.espera = null; panel.actualizarMarcador(p.puntajes); return;
    case "fracturas": return enFracturas(p);
    case "sentencia": return enSentencia(p);
  }
}

async function enFase(p) {
  estado.espera = { fase: p.fase, desde: p.desde || Date.now() };
  panel.marcarRuta(p.fase);
  panel.divisor(p.etiqueta.replace(/^El Chair está /, "Chair: "));
  if (FASES_DEL_CHAIR.has(p.fase)) {
    escena.chair(p.etiqueta.replace(/^El Chair está /, "").replace(/^./, (c) => c.toUpperCase()), { puntos: true });
    await rep.dormir(1300);
  }
}

async function enApertura(p) {
  estado.apertura = p;
  estado.mesa = p.mesa;
  panel.montarOpciones(p.opciones, p.titulo);
  escena.aplicarMesa(p);
  escena.chair(p.titulo, { etiqueta: p.modo === "rapido" ? "Consejo rápido" : "Consejo completo" });
  await rep.dormir(1800);
}

async function enRonda(p) {
  estado.ronda = p.ronda;
  panel.ocultarFracturas();
  escena.limpiarRonda();
  escena.chair(p.etiqueta, { puntos: true, etiqueta: "La palabra está abierta" });
}

const mejorOpcion = (puntajes = {}) => Object.entries(puntajes).sort((a, b) => b[1] - a[1]).map(([letra, valor]) => ({ letra, valor }))[0] || null;
const posturaCorta = (t = "") => (/condicionad/i.test(t) ? "Sí, si" : /^s[ií]/i.test(t) ? "Sí" : /^no/i.test(t) ? "No" : "Habló");

async function enIntervencion(p) {
  const { ronda, asiento, datos } = p;
  estado.cartas[ronda][asiento] = p;
  const mejor = mejorOpcion(datos.puntajes);
  let linea, etiqueta = NOMBRE_RONDA[ronda], objetivo = null, pie = "";
  if (ronda === 1) {
    linea = primerasFrases(limpiar(datos.decision || datos.postura), 170);
    etiqueta = `${posturaCorta(datos.postura)}${mejor ? ` · respalda ${mejor.letra} (${mejor.valor}/10)` : ""}`;
  } else if (ronda === 2) {
    linea = primerasFrases(limpiar(datos.replica), 170);
    objetivo = datos.respondeA;
    if (objetivo) {
      estado.flechas = estado.flechas.filter((f) => f.de !== asiento);
      estado.flechas.push({ de: asiento, a: objetivo });
      escena.dibujarFlechas();
      etiqueta = `Le responde a ${estado.porClave[objetivo].corto}`;
    }
    pie = [datos.abogado ? `Abogado del diablo de la opción ${datos.abogado}` : "", datos.seMovio ? "Cambió de postura" : ""].filter(Boolean).join(" · ");
  } else {
    linea = primerasFrases(limpiar(datos.linea), 170);
    etiqueta = `Vota opción ${datos.voto}`;
  }
  panel.entrada({ ronda, clave: asiento, etiqueta: ronda === 1 ? posturaCorta(datos.postura) : ronda === 2 ? (objetivo ? `vs ${estado.porClave[objetivo].corto}` : "Debate") : `Vota ${datos.voto}`, texto: linea });
  await escena.hablar(asiento, linea || "Lo dejo en mi tarjeta.", { etiqueta, objetivo, pie });
  if (ronda === 3) {
    escena.soltarFicha(asiento, datos.voto);
    escena.actualizarPlaca(asiento, { chip: `Votó ${datos.voto}`, nota: "" });
  } else {
    escena.actualizarPlaca(asiento, {
      chip: ronda === 1 ? posturaCorta(datos.postura) : datos.seMovio ? "Se movió" : "Replicó",
      nota: mejor ? `${mejor.letra} ${mejor.valor}` : "",
    });
  }
  escena.fijarOrador(null);
}

async function enFracturas(p) {
  escena.fijarOrador(null);
  escena.quitarGlobo();
  panel.mostrarFracturas(p);
  panel.notaChair(`<b>La pelea:</b> ${esc(p.lista.map((f) => f.pregunta).join(" "))}`);
  await rep.dormir(3200 + 1700 * p.lista.length);
}

async function enSentencia(p) {
  estado.espera = null;
  estado.sentencia = p;
  panel.marcarRuta("sentencia");
  escena.quitarGlobo();
  escena.fijarOrador(null);
  escena.limpiarRonda();
  panel.ocultarFracturas();
  panel.actualizarMarcador(p.sentencia.puntajes);
  panel.notaChair(`<b>Veredicto: ${esc(p.sentencia.etiqueta)}.</b> ${esc(acortar(p.sentencia.resumen, 170))}`);
  $("#mando").hidden = true;
  const inicio = $("#inicio");
  inicio.hidden = false;
  inicio.innerHTML = `<span class="latido"><i></i>Sesión terminada</span><h2>${esc(p.sentencia.etiqueta)}</h2>
    <div class="fila"><button type="button" class="boton primario" data-accion="leer">Leer el veredicto</button>
    <button type="button" class="boton suave" data-accion="pdf">Descargar PDF</button>
    <button type="button" class="boton suave" data-accion="repetir">Repetir este consejo</button></div>`;
  await rep.dormir(1500);
  if (estado.sentencia === p) mostrarSentencia(p, informeDisponible);
}

// ---------------------------------------------------------------- mando y espera
function pintarMando() {
  const pend = rep.pendientes;
  $("#cola").textContent = pend ? `${pend} líneas en cola` : "";
  const b = $("#btnPausa");
  b.textContent = rep.pausado ? "▶" : "❚❚";
  b.title = rep.pausado ? "Reanudar (barra espaciadora)" : "Pausar (barra espaciadora)";
}

function pintarEspera() {
  const caja = $("#espera");
  const e = estado.espera;
  const ociosa = !rep.ocupado && !rep.cola.length;
  if (!e || !ociosa || !estado.enVivo || estado.sentencia) { caja.hidden = true; return; }
  const n = estado.apertura?.modo === "rapido" ? 2 : 3;
  const textos = {
    brief: ["Armando la mesa", "El Chair está sentando al consejo.", ""],
    ronda1: [`Ronda 1 de ${n}`, "Los asesores escriben sus posiciones iniciales.", "Escriben a la vez en Claude Code. Sus líneas suenan aquí apenas llegue la ronda."],
    fracturas: ["Entre rondas", "El Chair lee las aperturas y busca dónde chocan.", "La pelea aparece aquí enseguida y luego empieza el debate."],
    ronda2: [`Ronda 2 de ${n}`, "Los asesores leen las aperturas de los demás y contraatacan.", "Escriben a la vez en Claude Code. Sus líneas suenan aquí apenas llegue la ronda."],
    pesando: ["Entre rondas", "El Chair convierte el debate en un resumen para el voto.", "Después vota cada asesor."],
    ronda3: [`Ronda 3 de ${n}`, "Los asesores votan.", "Escriben a la vez en Claude Code. Sus votos suenan aquí apenas lleguen."],
    sentencia: ["Último paso", "El Chair puntúa la sala y escribe el veredicto.", "Cuando llegue, podrás descargarlo en PDF."],
  }[e.fase] || ["Trabajando", "El consejo está trabajando.", ""];
  if (caja.hidden) { escena.quitarGlobo(); caja.hidden = false; e.musa = 0; }
  const ronda = Number((e.fase.match(/^ronda(\d)$/) || [])[1]) || 0;
  $("#esperaPaso").textContent = textos[0];
  $("#esperaReloj").textContent = reloj(Date.now() - e.desde);
  $("#esperaTitulo").textContent = textos[1];
  $("#esperaDetalle").textContent = textos[2];
  const barra = $(".espera-barra", caja);
  if (ronda) {
    const sentados = estado.mesa.length || estado.asientos.length;
    const listos = estado.mesa.filter((k) => estado.cartas[ronda][k]).length;
    barra.classList.toggle("indeterminada", listos === 0);
    $("#esperaAvance").style.width = listos ? `${Math.round((listos / sentados) * 100)}%` : "";
    const faltan = estado.mesa.filter((k) => !estado.cartas[ronda][k]);
    if (faltan.length && Date.now() - (e.musa || 0) > 5200) {
      e.musa = Date.now();
      e.turnoMusa = ((e.turnoMusa ?? -1) + 1) % faltan.length;
      const a = estado.porClave[faltan[e.turnoMusa]];
      const musa = $("#esperaPensando");
      musa.classList.add("apagado");
      setTimeout(() => { musa.innerHTML = `<b>${esc(a.corto)}</b> está pesando: ${esc(a.pregunta.replace(/^./, (c) => c.toLowerCase()))}${listos ? ` · ${listos} de ${sentados} listos` : ""}`; musa.classList.remove("apagado"); }, 300);
    }
  } else { barra.classList.add("indeterminada"); $("#esperaAvance").style.width = ""; $("#esperaPensando").textContent = ""; }
}

// ---------------------------------------------------------------- controles
function enlazarInicio() {
  $("#btnUltima")?.addEventListener("click", async () => {
    const { sesiones } = await fetch("/api/sesiones").then((r) => r.json());
    if (!sesiones.length) return aviso("Todavía no hay sesiones. Corre /roast-room en Claude Code.");
    abrirSesion(sesiones[0].id);
  });
  $("#btnGuia2")?.addEventListener("click", abrirGuia);
}

function conectarControles() {
  $("#btnGuia").addEventListener("click", abrirGuia);
  $("#btnHistorial").addEventListener("click", () => abrirHistorial(abrirSesion));
  $("#btnNueva").addEventListener("click", salir);
  $("#btnPausa").addEventListener("click", () => rep.pausar());
  $("#btnSaltar").addEventListener("click", () => rep.saltar());
  $$(".velocidad button").forEach((b) => b.addEventListener("click", () => {
    rep.velocidad = Number(b.dataset.vel);
    $$(".velocidad button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  }));
  const abrirDesde = (e) => { const el = e.target.closest("[data-asiento]"); if (el && !el.classList.contains("entrada")) abrirTarjeta(el.dataset.asiento); };
  $("#asientos").addEventListener("click", abrirDesde);
  $("#placas").addEventListener("click", abrirDesde);
  $("#asientos").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirDesde(e); } });
  $("#bitacora").addEventListener("click", (e) => {
    const b = e.target.closest(".entrada");
    if (b) abrirTarjeta(b.dataset.asiento, Number(b.dataset.ronda));
  });
  document.addEventListener("click", (e) => {
    const accion = e.target.closest("[data-accion]")?.dataset.accion;
    if (accion === "pdf") imprimir();
    if (accion === "cerrar") cerrarSentencia();
    if (accion === "leer") abrirSentencia();
    if (accion === "repetir") abrirSesion(estado.sesion);
    if (e.target.closest("[data-copiar]")) copiarEjemplo();
    if (e.target.id === "sentencia") cerrarSentencia();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea") || document.querySelector("dialog[open]")) return;
    if (e.key === "Escape") cerrarSentencia();
    if (sentenciaAbierta()) return;
    if (e.code === "Space" && estado.sesion) { e.preventDefault(); rep.pausar(); }
    if (e.key === "ArrowRight" && estado.sesion) rep.saltar();
  });
}

arrancar();
