// El veredicto: hoja a pantalla completa y exportación a PDF mediante la impresión del navegador.
import { $, esc, coma, colorDe, rostro } from "./util.js";
import { estado } from "./estado.js";

const claseDe = (etiqueta) => (/NO (HACERLO|AHORA)/i.test(etiqueta) ? "no" : /PROBAR/i.test(etiqueta) ? "probar" : /CONDICIONES/i.test(etiqueta) ? "condiciones" : "");
const cara = (clave) => (estado.porClave[clave] ? `<img src="${rostro(clave)}" alt="" style="--color:${estado.porClave[clave].color}">` : "<span></span>");
const nombre = (clave) => estado.porClave[clave]?.corto || "";

export function mostrarSentencia(paso, informeDisponible) {
  const s = paso.sentencia;
  const ganadora = s.ganadora;
  const votos = Object.entries(s.votos).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${n} por ${l}`).join(", ");
  const barras = paso.opciones.map((o) => {
    const p = s.puntajes[o.letra];
    return `<div class="barra-fila ${o.letra === ganadora ? "gana" : ""}" style="--color:${colorDe(o.letra)}" title="${esc(p?.cuenta || "")}">
      <span class="letra">${o.letra}</span>
      <div><div style="font-size:12.5px;margin-bottom:3px;color:var(--texto-2)">${esc(o.nombre)}</div><div class="pista"><i style="width:${(p?.valor || 0) * 10}%"></i></div></div>
      <b>${coma(p?.valor)}</b></div>`;
  }).join("");
  const filas = paso.tabla.map((f) => `<tr>
      <td><span class="quien" style="--color:${estado.porClave[f.asiento].color}">${cara(f.asiento)}${esc(nombre(f.asiento))}</span></td>
      <td class="n">${f.peso}</td>
      ${paso.opciones.map((o) => `<td class="n">${coma(f.puntajes?.[o.letra])}</td>`).join("")}
      <td><span class="voto-pill" style="--color:${colorDe(f.voto)}">${esc(f.voto)}</span></td>
      <td>${esc(f.linea || "")}</td></tr>`).join("");
  const lista = (items, plantilla) => items.length ? `<ul class="lista">${items.map(plantilla).join("")}</ul>` : '<p class="tenue">Sin elementos.</p>';
  const avatar = (k) => `<span style="--color:${estado.porClave[k]?.color || "#777"}">${cara(k)}</span>`;

  $("#sentenciaHoja").innerHTML = `
    <div class="sen-cab">
      <div><small>El veredicto del consejo · ${esc(estado.apertura?.titulo || "")}</small><br><span class="etiqueta ${claseDe(s.etiqueta)}">${esc(s.etiqueta)}</span></div>
      <div class="sen-acciones">
        <button type="button" class="boton primario" data-accion="pdf">Descargar PDF</button>
        ${informeDisponible ? `<a class="boton suave" href="/informe/${encodeURIComponent(estado.sesion)}" target="_blank" rel="noopener">Informe completo</a>` : ""}
        <button type="button" class="boton suave" data-accion="cerrar">Volver a la mesa</button>
      </div>
    </div>
    <p class="sen-resumen">${esc(s.resumen)}</p>
    <div class="rejilla">
      <section class="bloque"><h3>Puntajes ponderados</h3><div class="barras">${barras}</div>
        <p class="sen-meta">Confianza ${coma(s.confianza)}/5 · votos: ${esc(votos)}${s.empate ? " · empate técnico" : ""}</p></section>
      <section class="bloque"><h3>Por qué</h3>${lista(s.porque, (w) => `<li>${avatar(w.asiento)}<span>${esc(w.texto)}</span></li>`)}</section>
      <section class="bloque"><h3>Condiciones</h3>${s.condiciones.length ? `<ul class="lista numerada">${s.condiciones.map((c) => `<li><span>${esc(c.texto)}${c.asiento ? ` <em class="tenue">(${esc(nombre(c.asiento))})</em>` : ""}</span></li>`).join("")}</ul>` : '<p class="tenue">Sin condiciones.</p>'}</section>
      <section class="bloque"><h3>Riesgos y señales tempranas</h3>${lista(s.riesgos, (r) => `<li>${avatar(r.asiento)}<span>${esc(r.texto)}${r.senal ? `<span class="senal">Señal: ${esc(r.senal)}</span>` : ""}</span></li>`)}</section>
      <section class="bloque"><h3>Próximos pasos</h3><ul class="lista pasos">${s.pasos.map((p) => `<li><b>${esc(p.cuando)}</b><span>${esc(p.accion)}</span></li>`).join("")}</ul>
        ${s.criterioDeSalida ? `<p class="sen-meta"><b>Se frena si:</b> ${esc(s.criterioDeSalida)}</p>` : ""}</section>
      <section class="bloque"><h3>Ojo con esto</h3>${s.disidencia ? `<p class="cita-disidente"><b>${esc(nombre(s.disidencia.asiento))}:</b> ${esc(s.disidencia.texto)}</p>${s.disidencia.riesgo ? `<p class="sen-meta">El riesgo que ve: ${esc(s.disidencia.riesgo)}</p>` : ""}` : '<p class="tenue">Voto unánime.</p>'}</section>
      ${s.peleas.length ? `<section class="bloque ancho"><h3>Dónde pelearon</h3>${lista(s.peleas, (f) => `<li><span></span><span><b>${esc(f.entre)}.</b> ${esc(f.historia)}</span></li>`)}</section>` : ""}
      <section class="bloque ancho"><h3>Cómo votó cada asiento</h3>
        <table class="tabla"><thead><tr><th>Asiento</th><th>Peso</th>${paso.opciones.map((o) => `<th>${o.letra}</th>`).join("")}<th>Voto</th><th>Su línea</th></tr></thead><tbody>${filas}</tbody></table></section>
      ${s.notasDelChair.length ? `<section class="bloque ancho"><h3>Notas del Chair</h3><ul class="lista">${s.notasDelChair.map((n) => `<li><span></span><span>${esc(n)}</span></li>`).join("")}</ul></section>` : ""}
    </div>
    <div class="sen-pie"><span>${esc(s.aviso)}</span></div>`;
  abrirSentencia();
}

export function abrirSentencia() { $("#sentencia").hidden = false; $("#sentencia").scrollTop = 0; }
export function cerrarSentencia() { $("#sentencia").hidden = true; }
export const sentenciaAbierta = () => !$("#sentencia").hidden;

/** "Descargar PDF": abre la impresión del navegador con la hoja del veredicto; ahí se elige "Guardar como PDF". */
export function imprimir() {
  const previo = document.title;
  document.title = `Roast Room · ${estado.apertura?.titulo || "veredicto"}`;
  window.print();
  setTimeout(() => { document.title = previo; }, 500);
}
