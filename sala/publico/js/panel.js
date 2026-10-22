// Panel de la decisión (opciones y marcador), ruta de avance, bitácora lateral y panel de fracturas.
import { $, $$, esc, colorDe, coma, rostro, acortar } from "./util.js";
import { estado } from "./estado.js";

// ---------- ruta de avance ----------
const RUTA = ["brief", "ronda1", "fracturas", "ronda2", "ronda3", "sentencia"];
const PASO_DE_FASE = { brief: "brief", ronda1: "ronda1", fracturas: "fracturas", ronda2: "ronda2", pesando: "ronda3", ronda3: "ronda3", sentencia: "sentencia" };

export function marcarRuta(fase) {
  const idx = RUTA.indexOf(PASO_DE_FASE[fase] || fase);
  $$("#ruta li").forEach((li) => {
    const i = RUTA.indexOf(li.dataset.paso);
    li.classList.toggle("hecho", i < idx || (fase === "sentencia" && i === idx));
    li.classList.toggle("activo", i === idx && fase !== "sentencia");
  });
}

// ---------- opciones y marcador ----------
export function montarOpciones(opciones, titulo) {
  $("#decision").hidden = false;
  $("#decisionTitulo").textContent = titulo;
  $("#opciones").innerHTML = opciones.map((o) => `
    <li class="opcion" data-letra="${o.letra}" style="--color:${colorDe(o.letra)}" title="${esc(o.completa)}">
      <span class="corona">VA ADELANTE</span>
      <div class="opcion-cab"><span class="letra">${o.letra}</span><span class="nombre">${esc(o.nombre)}${o.delChair ? " ·&nbsp;añadida" : ""}</span></div>
      <div class="valor">-</div>
      <div class="barra"><i></i></div>
    </li>`).join("");
}

export function actualizarMarcador(puntajes) {
  const mejor = Object.entries(puntajes).sort((a, b) => b[1].valor - a[1].valor)[0]?.[0] || null;
  estado.lider = mejor;
  for (const [letra, p] of Object.entries(puntajes)) {
    const el = $(`.opcion[data-letra="${letra}"]`);
    if (!el) continue;
    $(".valor", el).textContent = coma(p.valor);
    $(".barra i", el).style.width = `${p.valor * 10}%`;
    el.title = p.cuenta;
    el.classList.toggle("lidera", letra === mejor);
  }
}

// ---------- bitácora ----------
function agregar(nodo) {
  const caja = $("#bitacora");
  $(".vacio", caja)?.remove();
  caja.appendChild(nodo);
  caja.scrollTop = caja.scrollHeight;
}

export function tituloBitacora(texto) { $("#bitacoraTitulo").textContent = texto; }

export function divisor(texto) {
  const d = document.createElement("div");
  d.className = "divisor";
  d.textContent = texto;
  agregar(d);
}

export function notaChair(html) {
  const n = document.createElement("div");
  n.className = "nota-chair";
  n.innerHTML = html;
  agregar(n);
}

export function entrada({ ronda, clave, etiqueta, texto }) {
  const a = estado.porClave[clave];
  const b = document.createElement("button");
  b.type = "button";
  b.className = "entrada";
  b.dataset.asiento = clave;
  b.dataset.ronda = ronda;
  b.style.setProperty("--color", a.color);
  b.innerHTML = `<img src="${rostro(clave)}" alt=""><div><div class="quien"><span>${esc(a.corto)}</span><em>${esc(etiqueta)}</em></div><p>${esc(acortar(texto, 120))}</p></div>`;
  agregar(b);
}

export function vaciarBitacora(html) { $("#bitacora").innerHTML = html; }

// ---------- fracturas ----------
export function mostrarFracturas(paso) {
  const panel = $("#fracturas");
  panel.hidden = false;
  panel.innerHTML = `<h3>${paso.nota ? "Por qué pelean" : "Líneas de fractura"}</h3>` + paso.lista.map((f, i) => `
    <div class="fractura" style="animation-delay:${i * 0.2}s">
      <b>${esc(f.pregunta)}</b>
      <div class="versus">${f.bandos.map((b, j) => `
        ${j ? '<span class="vs">VS</span>' : ""}
        <div class="bando"><span class="caras">${b.asientos.filter((k) => estado.porClave[k]).map((k) => `<img src="${rostro(k)}" alt="${esc(estado.porClave[k].corto)}" title="${esc(estado.porClave[k].corto)}">`).join("")}</span><span class="texto">${esc(acortar(b.postura, 60))}</span></div>`).join("")}
      </div>
    </div>`).join("");
}

export function ocultarFracturas() { $("#fracturas").hidden = true; }

export function reiniciarPanel() {
  $("#decision").hidden = true;
  $("#opciones").innerHTML = "";
  ocultarFracturas();
  $$("#ruta li").forEach((li) => li.classList.remove("activo", "hecho"));
}
