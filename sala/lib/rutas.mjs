// Rutas del proyecto, calculadas una sola vez a partir de la ubicación de este archivo.
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));

export const DIR_SALA = path.resolve(aqui, "..");
export const DIR_PUBLICO = path.join(DIR_SALA, "publico");
export const DIR_PROYECTO = path.resolve(DIR_SALA, "..");
export const DIR_SESIONES = path.join(DIR_PROYECTO, "sessions");
export const DIR_BRAINS = path.join(DIR_PROYECTO, ".claude", "skills", "roast-room", "brains");
