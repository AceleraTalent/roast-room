// Prueba rápida: reconstruye la línea de tiempo de cada sesión guardada y revisa que la sala pueda reproducirla.
import { listarSesiones, construirSesion } from "./lib/linea-de-tiempo.mjs";

const sesiones = listarSesiones();
if (!sesiones.length) {
  console.log("No hay sesiones en sessions/. Corre /roast-room primero.");
  process.exit(0);
}

let fallas = 0;
for (const { id, estado } of sesiones) {
  const { pasos } = construirSesion(id);
  const cuenta = (tipo) => pasos.filter((p) => p.tipo === tipo).length;
  const sinDatos = pasos.filter((p) => p.tipo === "intervencion" && !p.datos.puntajes).length;
  const completa = estado !== "terminada" || (cuenta("sentencia") === 1 && cuenta("intervencion") === 12);
  const bien = cuenta("apertura") === 1 && sinDatos === 0 && completa;
  if (!bien) fallas++;
  console.log(`${bien ? "ok " : "MAL"} ${id} · ${estado} · ${pasos.length} pasos · ${cuenta("intervencion")} intervenciones · ${cuenta("fracturas")} fracturas`);
}
process.exit(fallas ? 1 : 0);
