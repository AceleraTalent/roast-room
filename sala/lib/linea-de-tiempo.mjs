// Traduce la carpeta de una sesión (brief.json + round-1..3.json) a una lista ordenada de
// "pasos" que la sala reproduce. Es una función de los archivos: sirve igual para una sesión
// terminada que para una que el Chair todavía está escribiendo (se vuelve a calcular y se
// envían solo los pasos nuevos).
import fs from "node:fs";
import path from "node:path";
import { DIR_SESIONES } from "./rutas.mjs";
import { ASIENTOS, porClave, claveDe, verificarCitas } from "./asientos.mjs";

const AVISO = "Asesores simulados construidos a partir de la obra pública de cada persona y dibujados como caricaturas. No son las personas ni hablan en su nombre. Esto no es asesoría financiera ni legal.";
const ABANDONO_MS = 3 * 60 * 60 * 1000; // una sesión sin tocar por tanto tiempo se da por detenida
const ORDEN_DEBATE = ["hormozi", "vega", "musk", "borrero"]; // las parejas que se responden hablan seguidas

const leerJson = (ruta) => { try { return JSON.parse(fs.readFileSync(ruta, "utf8")); } catch { return null; } };
const modificado = (ruta) => { try { return fs.statSync(ruta).mtimeMs; } catch { return Date.now(); } };
const redondear = (n) => Math.round(n * 10) / 10;
const coma = (n) => String(n).replace(".", ",");

function nombreCorto(etiqueta = "") {
  const cabeza = etiqueta.split(/:\s/)[0];
  return cabeza.length <= 40 ? cabeza : cabeza.slice(0, 38).replace(/\s+\S*$/, "") + "…";
}

/** Promedio ponderado por opción, con la puntuación real de cada asiento. */
function ponderar(cartas, pesos, letras) {
  const salida = {};
  for (const letra of letras) {
    const filas = cartas.filter((c) => c.scores?.[letra] != null);
    if (!filas.length) continue;
    const peso = (c) => pesos[c.asiento]?.peso || 1;
    const total = filas.reduce((a, c) => a + peso(c), 0);
    const suma = filas.reduce((a, c) => a + peso(c) * c.scores[letra], 0);
    salida[letra] = {
      valor: redondear(suma / total),
      cuenta: `${letra}: ${filas.map((c) => `${peso(c)}×${c.scores[letra]}`).join(" + ")} = ${suma} ÷ ${total} = ${coma(redondear(suma / total))}`,
    };
  }
  return salida;
}

// Si la réplica abre resumiendo al rival ("Su argumento: ..."), se omite esa primera frase.
function sinResumen(texto) {
  const frases = String(texto || "").match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) || [texto];
  return /^(su|tu) argumento\b/i.test(frases[0].trim()) && frases.length > 1 ? frases.slice(1).join("").trim() : String(texto || "").trim();
}

// Antepone el nombre del rival a la réplica ("Vega, su parte más débil..."), sin duplicarlo si ya viene.
function dirigir(rival, frase) {
  if (!rival) return frase;
  const corto = porClave[rival].corto;
  if (new RegExp(`^${corto}\\b`, "i").test(frase)) return frase;
  const minuscula = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(frase) ? frase[0].toLowerCase() + frase.slice(1) : frase;
  return `${corto}, ${minuscula}`;
}

function datosDe(ronda, c) {
  const comunes = { puntajes: c.scores || {}, confianza: c.confidence ?? null, ruina: c.ruin_risk || "", puerta: c.door || "" };
  if (ronda === 1) return { ...comunes, postura: c.stance || "", decision: c.call || "", pregunta: c.question || "" };
  if (ronda === 2) {
    const rival = claveDe(c.responds_to);
    const frase = sinResumen(c.rebuttal);
    return {
      ...comunes, respondeA: rival, replica: dirigir(rival, frase),
      abogado: c.role === "abogado" ? c.advocate_option : "",
      concede: c.concede || "", seMovio: c.moved?.moved ? { porque: c.moved.because || "" } : null,
    };
  }
  return { ...comunes, voto: c.vote || "", linea: c.line || "", salvaguarda: c.safeguard || "", riesgo: c.main_risk || "" };
}

export function construirSesion(id) {
  const dir = path.join(DIR_SESIONES, id);
  const brief = leerJson(path.join(dir, "brief.json"));
  if (!brief) return null;
  const archivo = (n) => path.join(dir, n);
  const rondas = { 1: leerJson(archivo("round-1.json")), 2: leerJson(archivo("round-2.json")), 3: leerJson(archivo("round-3.json")) };

  const opciones = (brief.options || []).map((o) => ({ letra: String(o.id).toUpperCase(), nombre: nombreCorto(o.label), completa: o.label, delChair: Boolean(o.added_by_chair) }));
  const letras = opciones.map((o) => o.letra);
  const pesos = Object.fromEntries(ASIENTOS.map((a) => [a.clave, { peso: 1, motivo: "" }]));
  for (const s of brief.seats || []) {
    const k = claveDe(s.seat);
    if (k) pesos[k] = { peso: Math.max(1, Math.min(3, Number(s.weight) || 1)), motivo: s.reason || "" };
  }
  const sentados = [...new Set((brief.seats || []).map((s) => claveDe(s.seat)).filter(Boolean))];
  const mesa = sentados.length ? sentados : ASIENTOS.map((a) => a.clave);
  const titulo = brief.title || brief.decision || id;
  const modo = ["rapido", "quick"].includes(brief.mode) ? "rapido" : "completo";

  const pasos = [];
  const desde0 = modificado(archivo("brief.json"));
  const agregar = (tipo, datos = {}) => pasos.push({ tipo, ...datos });
  const fase = (nombre, etiqueta, desde) => agregar("fase", { fase: nombre, etiqueta, desde });
  const abrirRonda = (n, etiqueta, desde) => {
    fase(`ronda${n}`, etiqueta, desde);
    agregar("ronda", { ronda: n, etiqueta, desde });
    for (const a of mesa) agregar("turno", { ronda: n, asiento: a });
  };
  const jugarRonda = (n) => {
    const orden = n === 2 ? ORDEN_DEBATE : ASIENTOS.map((a) => a.clave);
    const cartas = (rondas[n]?.cards || [])
      .map((c) => ({ ...c, asiento: claveDe(c.seat) }))
      .filter((c) => mesa.includes(c.asiento))
      .sort((x, y) => orden.indexOf(x.asiento) - orden.indexOf(y.asiento));
    for (const c of cartas) {
      const texto = c.raw || "";
      agregar("intervencion", { ronda: n, asiento: c.asiento, nombre: porClave[c.asiento].nombre, texto, datos: datosDe(n, c), citas: verificarCitas(c.asiento, texto) });
    }
    const completa = cartas.length === mesa.length;
    if (completa) agregar("marcador", { ronda: n, puntajes: ponderar(cartas, pesos, letras) });
    return completa;
  };

  fase("brief", "El Chair está leyendo la pregunta", desde0);
  agregar("apertura", {
    titulo, decision: brief.decision || "", negocio: brief.context?.business || "", opciones,
    supuestos: brief.assumptions || [], pesos, mesa, modo, inclinacion: brief.lean || null,
  });

  let estado = "en-curso";
  abrirRonda(1, "Ronda 1: posiciones iniciales", desde0);
  if (rondas[1] && jugarRonda(1)) {
    const notas = rondas[1].chair_notes || {};
    fase("fracturas", "El Chair está buscando las líneas de fractura", modificado(archivo("round-1.json")));
    agregar("fracturas", {
      lista: (notas.cruxes || []).map((q) => ({
        pregunta: q.text || q.question || "",
        bandos: Object.entries(q.sides || {}).map(([postura, ks]) => ({ postura, asientos: ks.map(claveDe).filter(Boolean) })),
      })),
      nota: notas.consensus?.reason || "",
    });
    abrirRonda(2, "Ronda 2: el debate", modificado(archivo("round-1.json")));
    if (rondas[2] && jugarRonda(2)) {
      fase("pesando", "El Chair está pesando el debate", modificado(archivo("round-2.json")));
      abrirRonda(3, "Ronda 3: la votación", modificado(archivo("round-2.json")));
      if (rondas[3] && jugarRonda(3)) {
        fase("sentencia", "El Chair está escribiendo el veredicto", modificado(archivo("round-3.json")));
        if (rondas[3].verdict) {
          pasos.push(armarSentencia(rondas, rondas[3].verdict, pesos, letras, opciones));
          estado = "terminada";
        }
      }
    }
  }
  return { id, titulo, modo, estado, pasos, opciones, informe: fs.existsSync(archivo("index.html")) };
}

function armarSentencia(rondas, v, pesos, letras, opciones) {
  const cartas3 = rondas[3].cards.map((c) => ({ ...c, asiento: claveDe(c.seat) }));
  const votos = {};
  for (const c of cartas3) votos[c.vote] = (votos[c.vote] || 0) + 1;
  const cartas2 = rondas[2]?.cards || [];
  const confianza = cartas2.length ? redondear(cartas2.reduce((a, c) => a + (c.confidence || 0), 0) / cartas2.length) : null;
  const disidente = v.dissent ? claveDe(v.dissent.seat) : null;
  const cartaDisidente = cartas3.find((c) => c.asiento === disidente);
  const entre = (ks) => ks.map((k) => porClave[claveDe(k)]?.corto || k).join(" y ");
  return {
    tipo: "sentencia",
    sentencia: {
      etiqueta: v.label, resumen: v.summary || "", empate: Boolean(v.tie), ganadora: v.option,
      porque: (v.why || []).map((w) => ({ texto: w.text, asiento: claveDe(w.seat) })),
      condiciones: (v.conditions || []).map((c) => ({ texto: c.text || c, asiento: claveDe(c.seat) })),
      riesgos: (v.risks || []).map((r) => ({ texto: r.text, asiento: claveDe(r.seat), senal: r.early_signal || "" })),
      disidencia: v.dissent ? { asiento: disidente, texto: v.dissent.text, riesgo: cartaDisidente?.main_risk || "" } : null,
      pasos: [
        v.actions?.this_week && { cuando: "Esta semana", accion: v.actions.this_week },
        v.actions?.next_30_days && { cuando: "En 30 días", accion: v.actions.next_30_days },
      ].filter(Boolean),
      criterioDeSalida: v.actions?.kill_criteria || "",
      peleas: (rondas[2]?.chair_notes?.friction || []).map((f) => ({ entre: entre(f.between || []), historia: f.summary })),
      notasDelChair: v.chair_notes || [],
      puntajes: ponderar(cartas3, pesos, letras), votos, confianza, aviso: AVISO,
    },
    tabla: cartas3.map((c) => ({ asiento: c.asiento, peso: pesos[c.asiento]?.peso || 1, puntajes: c.scores, voto: c.vote, linea: c.line })),
    opciones,
  };
}

export function listarSesiones() {
  if (!fs.existsSync(DIR_SESIONES)) return [];
  return fs.readdirSync(DIR_SESIONES)
    .filter((d) => fs.existsSync(path.join(DIR_SESIONES, d, "brief.json")))
    .map((d) => resumir(construirSesion(d)))
    .filter(Boolean)
    .sort((a, b) => (a.id < b.id ? 1 : -1));
}

/** Marca como "detenida" una sesión inconclusa que lleva horas sin tocarse. */
export function conEstado(sesion) {
  if (!sesion || sesion.estado !== "en-curso") return sesion;
  const dir = path.join(DIR_SESIONES, sesion.id);
  let ultimo = 0;
  try { ultimo = Math.max(...fs.readdirSync(dir).map((n) => fs.statSync(path.join(dir, n)).mtimeMs)); } catch { /* carpeta vacía */ }
  return Date.now() - ultimo > ABANDONO_MS ? { ...sesion, estado: "detenida" } : sesion;
}

function resumir(s) {
  if (!s) return null;
  const { id, titulo, modo, estado, informe } = conEstado(s);
  return { id, titulo, modo, estado, informe };
}
