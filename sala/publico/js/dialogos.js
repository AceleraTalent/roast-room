// Diálogos: tarjeta completa de un asiento, guía de uso, historial de sesiones y avisos.
import { $, $$, esc, rostro, coma, fechaDeId, colorDe } from "./util.js";
import { estado } from "./estado.js";

const NOMBRE_RONDA = ["", "Apertura", "Debate", "Voto"];
const EJEMPLO = "Tengo una startup B2B de software con $15,000 USD de facturación mensual y $100,000 en caja. ¿Gasto $80,000 en un equipo de ventas y busco una Seed, invierto $30,000 en producto y crecimiento orgánico, o regalo el software y cobro comisión a los proveedores? Mi churn mensual es 6%. Me inclino por contratar vendedores, pero me da miedo quedarme sin caja si la ronda no cierra.";

export const GUIA = `
  <div class="guia">
    <div><h4>Cómo usar la sala</h4>
      <ol>
        <li>Deja esta pestaña abierta (<code>npm start</code>).</li>
        <li>En Claude Code, dentro de esta carpeta, escribe <code>/roast-room</code> y tu decisión.</li>
        <li>Responde las preguntas del Chair. Después mira al consejo discutirlo aquí.</li>
        <li>Al final, baja el veredicto en PDF.</li>
      </ol></div>
    <div><h4>Qué poner en tu pregunta</h4>
      <ul>
        <li><b>La decisión</b> en una línea y tus <b>opciones</b> (dos o tres).</li>
        <li><b>Tus números</b>: facturación, caja, equipo, churn, lo que aplique.</li>
        <li><b>Tus límites</b> y cómo se ve el <b>éxito</b>, con fecha.</li>
        <li><b>Hacia dónde te inclinas</b>. El consejo lo pone a prueba.</li>
      </ul></div>
    <div><h4>Ejemplo</h4>
      <div class="ejemplo"><span><code>/roast-room</code> ${esc(EJEMPLO)}</span>
      <button class="boton suave chico" type="button" data-copiar>Copiar este ejemplo</button></div></div>
    <div><h4>Atajos</h4>
      <ul>
        <li><code>Espacio</code> pausa o reanuda · <code>→</code> salta lo que falta · <code>Esc</code> cierra el veredicto.</li>
        <li>Haz clic en un asesor o en una línea de la bitácora para leer su tarjeta completa.</li>
        <li>En "Sesiones" puedes repetir cualquier consejo guardado.</li>
      </ul></div>
  </div>`;

export function aviso(texto) {
  const t = $("#toast");
  t.textContent = texto;
  t.hidden = false;
  clearTimeout(aviso.reloj);
  aviso.reloj = setTimeout(() => (t.hidden = true), 5000);
}

export async function copiarEjemplo() {
  try { await navigator.clipboard.writeText(`/roast-room ${EJEMPLO}`); aviso("Copiado. Pégalo en Claude Code."); }
  catch { aviso("No pude copiar aquí. Selecciona el texto y cópialo."); }
}

export function abrirGuia() {
  $("#guiaCuerpo").innerHTML = GUIA;
  const d = $("#dlgGuia");
  if (!d.open) d.showModal();
}

export function abrirTarjeta(clave, ronda) {
  const a = estado.porClave[clave];
  const rondas = [1, 2, 3].filter((r) => estado.cartas[r][clave]);
  const actual = ronda || rondas[rondas.length - 1];
  const carta = estado.cartas[actual]?.[clave];
  const cuerpo = $("#tarjetaCuerpo");
  cuerpo.style.setProperty("--color", a.color);
  const puntajes = carta ? Object.entries(carta.datos.puntajes).map(([l, v]) => `<span style="--color:${colorDe(l)}"><b>${l}</b>${coma(v)}</span>`).join("") : "";
  cuerpo.innerHTML = `
    <div class="tarjeta-cab"><img src="${rostro(clave)}" alt=""><div><small>${esc(a.pilar)}</small><h3>${esc(a.nombre)}</h3><p class="tenue">Dueño de la pregunta: ${esc(a.pregunta)}</p></div></div>
    ${rondas.length ? `<div class="pestanas" role="tablist">${rondas.map((r) => `<button type="button" role="tab" data-ronda="${r}" aria-selected="${r === actual}">${NOMBRE_RONDA[r]}</button>`).join("")}</div>` : ""}
    ${carta ? `<div class="mini-puntajes">${puntajes}</div><div class="cuerpo-tarjeta">${esc(carta.texto)}</div>
      ${carta.citas.length ? `<ul class="citas">${carta.citas.map((c) => `<li class="${c.verificada ? "" : "mala"}">${c.verificada ? "✓" : "✗"} «${esc(c.cita.length > 110 ? c.cita.slice(0, 109) + "…" : c.cita)}» (${c.fuente}) ${c.verificada ? "verificada en el brain" : "no está en el brain"}</li>`).join("")}</ul>` : ""}`
      : '<p class="tenue">Este asiento todavía no habló.</p>'}
    <p class="tenue" style="font-size:12px;margin-top:10px">Asesor simulado construido a partir de la obra pública de ${esc(a.nombre)}. No es la persona.</p>`;
  $$("[data-ronda]", cuerpo).forEach((b) => b.addEventListener("click", () => abrirTarjeta(clave, Number(b.dataset.ronda))));
  const d = $("#dlgTarjeta");
  if (!d.open) d.showModal();
}

const ETIQUETA_ESTADO = { terminada: "terminada", "en-curso": "en curso", detenida: "detenida" };

export async function abrirHistorial(alElegir) {
  const { sesiones } = await fetch("/api/sesiones").then((r) => r.json());
  $("#historialLista").innerHTML = sesiones.length
    ? sesiones.map((s) => `<li>
        <button class="abrir" type="button" data-id="${esc(s.id)}"><b>${esc(s.titulo)}</b><small>${esc(fechaDeId(s.id))} · ${s.modo === "rapido" ? "rápido" : "completo"} · ${ETIQUETA_ESTADO[s.estado] || s.estado}</small></button>
        ${s.informe ? `<a class="informe" href="/informe/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">Informe</a>` : ""}</li>`).join("")
    : '<li class="tenue">Todavía no hay sesiones. Corre /roast-room en Claude Code y aparece aquí.</li>';
  $$("#historialLista .abrir").forEach((b) => b.addEventListener("click", () => { $("#dlgHistorial").close(); alElegir(b.dataset.id); }));
  $("#dlgHistorial").showModal();
}
