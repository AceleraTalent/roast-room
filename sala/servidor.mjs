// Servidor local de la sala: estáticos, un par de endpoints JSON y un stream de pasos (SSE)
// que sigue en vivo la sesión que Claude Code esté escribiendo.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DIR_PUBLICO, DIR_SESIONES } from "./lib/rutas.mjs";
import { ASIENTOS } from "./lib/asientos.mjs";
import { construirSesion, listarSesiones, conEstado } from "./lib/linea-de-tiempo.mjs";

const PUERTO = Number(process.env.PORT) || 4730;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".json": "application/json; charset=utf-8",
};

function responder(res, codigo, cuerpo, tipo = MIME[".json"]) {
  res.writeHead(codigo, { "content-type": tipo, "cache-control": "no-store" });
  res.end(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo));
}

const sesionEnCurso = () => listarSesiones().find((s) => s.estado === "en-curso")?.id ?? null;

function seguirSesion(id, req, res) {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
  res.write(": conectado\n\n");
  let enviados = 0;
  const empujar = () => {
    const s = conEstado(construirSesion(id));
    if (!s) return;
    for (; enviados < s.pasos.length; enviados++) res.write(`data: ${JSON.stringify(s.pasos[enviados])}\n\n`);
    if (s.estado !== "en-curso") {
      res.write(`data: ${JSON.stringify({ tipo: "fin", estado: s.estado })}\n\n`);
      clearInterval(reloj);
      res.end();
    }
  };
  const reloj = setInterval(empujar, 1000);
  req.on("close", () => clearInterval(reloj));
  empujar();
}

function servirArchivo(ruta, res) {
  const archivo = path.normalize(path.join(DIR_PUBLICO, ruta === "/" ? "index.html" : ruta));
  const existe = archivo.startsWith(DIR_PUBLICO) && fs.existsSync(archivo) && fs.statSync(archivo).isFile();
  if (!existe) return responder(res, 404, "No encontrado", "text/plain; charset=utf-8");
  res.writeHead(200, { "content-type": MIME[path.extname(archivo)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(archivo).pipe(res);
}

/** El reporte HTML que genera generate_report.mjs dentro de la carpeta de la sesión. */
function servirInforme(id, res) {
  const archivo = path.join(DIR_SESIONES, id, "index.html");
  const seguro = path.dirname(archivo) === path.join(DIR_SESIONES, path.basename(id)) && fs.existsSync(archivo);
  if (!seguro) return responder(res, 404, "Esa sesión todavía no tiene informe.", "text/plain; charset=utf-8");
  res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
  fs.createReadStream(archivo).pipe(res);
}

const servidor = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);
  const ultimo = decodeURIComponent(pathname.split("/").pop());
  try {
    if (pathname === "/api/asientos") return responder(res, 200, { asientos: ASIENTOS });
    if (pathname === "/api/sesiones") return responder(res, 200, { sesiones: listarSesiones(), enCurso: sesionEnCurso() });
    if (pathname.startsWith("/api/sesiones/")) {
      const s = conEstado(construirSesion(ultimo));
      return s ? responder(res, 200, s) : responder(res, 404, { error: "no existe esa sesión" });
    }
    if (pathname.startsWith("/api/seguir/")) {
      return construirSesion(ultimo) ? seguirSesion(ultimo, req, res) : responder(res, 404, { error: "no existe esa sesión" });
    }
    if (pathname.startsWith("/informe/")) return servirInforme(ultimo, res);
    return servirArchivo(pathname, res);
  } catch (e) {
    return responder(res, 500, { error: String(e.message || e) });
  }
});

servidor.listen(PUERTO, "127.0.0.1", () => {
  console.log(`Sala del consejo en http://localhost:${PUERTO}`);
  console.log("Corre /roast-room en Claude Code: la sala reproduce la sesión mientras se escribe.");
});
