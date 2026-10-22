// Utilidades pequeñas compartidas por los módulos de la sala.
export const $ = (selector, raiz = document) => raiz.querySelector(selector);
export const $$ = (selector, raiz = document) => [...raiz.querySelectorAll(selector)];

const ENTIDADES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

export const COLOR_OPCION = { A: "#ff7a59", B: "#5fd3a0", C: "#6aa7ff", D: "#a79fbd" };
export const colorDe = (letra) => COLOR_OPCION[letra] || "#a79fbd";

export const coma = (n) => (n == null ? "-" : String(n).replace(".", ","));

/** Quita las referencias de fuente "(S012)" y el énfasis de markdown para mostrar el texto limpio. */
export const limpiar = (t) => String(t ?? "")
  .replace(/\s*\((?:[^()]*?)\bS\d{3}\b[^()]*\)/g, "")
  .replace(/\*\*/g, "")
  .replace(/\s+/g, " ")
  .trim();

export function acortar(texto, max) {
  if (texto.length <= max) return texto;
  return texto.slice(0, max - 1).replace(/\s+\S*$/, "") + "…";
}

/** Junta frases completas hasta rondar `max` caracteres. */
export function primerasFrases(texto, max) {
  const frases = texto.match(/[^.!?]+[.!?]+["”)]?\s*|[^.!?]+$/g) || [texto];
  let salida = "";
  for (const f of frases) {
    if (salida && (salida + f).length > max) break;
    salida += f;
  }
  return acortar(salida.trim(), max + 40);
}

/** Acota un valor a un rango. */
export const acotar = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Secuencia de formas de boca para una palabra. Las vocales abiertas (a, e) abren la boca,
 * las redondas (o, u) la dejan a medias, la i sonríe a medias y las labiales la cierran.
 */
export function formasDe(palabra) {
  const limpia = palabra.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const secuencia = [];
  for (const letra of limpia) {
    let forma = null;
    if ("ae".includes(letra)) forma = "abierta";
    else if ("ouw".includes(letra)) forma = "media";
    else if (letra === "i" || letra === "y") forma = "media";
    else if ("bmpvf".includes(letra)) forma = "reposo";
    if (forma && forma !== secuencia[secuencia.length - 1]) secuencia.push(forma);
  }
  return secuencia.length ? secuencia : ["media"];
}

export const rostro = (clave, forma = "reposo") => `/rostros/${clave}-${forma}.webp`;

export function fechaDeId(id) {
  const m = String(id).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
}

export const reloj = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
