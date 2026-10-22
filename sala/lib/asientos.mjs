// Los cuatro asientos del consejo y la verificación de citas contra sus brains.
import fs from "node:fs";
import path from "node:path";
import { DIR_BRAINS } from "./rutas.mjs";

export const ASIENTOS = [
  {
    clave: "hormozi", nombre: "Alex Hormozi", corto: "Hormozi", carpeta: "alex-hormozi", color: "#ff7a59",
    pilar: "Ofertas, precios y ventas",
    pregunta: "¿La gente va a pagar, cuánto, y cómo cerramos?",
  },
  {
    clave: "musk", nombre: "Elon Musk", corto: "Musk", carpeta: "elon-musk", color: "#6aa7ff",
    pilar: "Primeros principios, costos y escala radical",
    pregunta: "¿Está limitado por la física y las matemáticas o por la sabiduría convencional?",
  },
  {
    clave: "vega", nombre: "Freddy Vega", corto: "Vega", carpeta: "freddy-vega", color: "#5fd3a0",
    pilar: "Comunidad, adquisición orgánica y retención",
    pregunta: "¿Crea valor real, construye comunidad leal y escala de forma orgánica?",
  },
  {
    clave: "borrero", nombre: "Simón Borrero", corto: "Borrero", carpeta: "simon-borrero", color: "#ffc15e",
    pilar: "Marketplaces, hipercrecimiento y capital",
    pregunta: "¿Cómo dominamos el mercado, construimos densidad y ejecutamos a velocidad extrema?",
  },
];

export const porClave = Object.fromEntries(ASIENTOS.map((a) => [a.clave, a]));

const sinTildes = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "Hormozi", "hormozi", "Simón Borrero" → "borrero". Devuelve null si no es ningún asiento. */
export function claveDe(texto) {
  const t = sinTildes(texto).replace(/\(.*$/, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const palabras = t.split(" ");
  return ASIENTOS.find((x) => palabras.includes(x.clave))?.clave ?? null;
}

// ---- verificación de citas ----
const leer = (ruta) => { try { return fs.readFileSync(ruta, "utf8"); } catch { return ""; } };
const normalizar = (t) =>
  sinTildes(t).replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

const pajares = new Map();
function pajarDe(clave) {
  if (!pajares.has(clave)) {
    const dir = path.join(DIR_BRAINS, porClave[clave].carpeta);
    const todo = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => leer(path.join(dir, f))).join(" ") : "";
    const n = normalizar(todo);
    pajares.set(clave, { n, compacto: n.replace(/ /g, "") });
  }
  return pajares.get(clave);
}

/** Frases entre comillas que el asiento atribuyó a una fuente (S###), marcadas como verificadas o no. */
export function verificarCitas(clave, texto) {
  const hallazgos = [];
  const patron = /["“]([^"“”\n]{20,400})["”][^\n"]{0,40}?[(\[](?:[^)\]\n]*?, )?(S\d{3})/g;
  const { n, compacto } = pajarDe(clave);
  for (let m = patron.exec(texto); m; m = patron.exec(texto)) {
    const frase = normalizar(m[1]);
    if (frase.split(" ").length < 5) continue;
    hallazgos.push({ cita: m[1], fuente: m[2], verificada: n.includes(frase) || compacto.includes(frase.replace(/ /g, "")) });
  }
  return hallazgos;
}
