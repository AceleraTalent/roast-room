// Estado compartido de la sala. Un solo objeto mutable: los módulos lo leen y lo actualizan.
export const estado = {
  asientos: [],          // lista de asientos (desde /api/asientos)
  porClave: {},          // mismo contenido indexado por clave
  sesion: null,          // id de la sesión que se está viendo
  fuente: null,          // EventSource abierto, si la sesión se sigue en vivo
  enVivo: false,         // true mientras Claude Code todavía escribe la sesión
  apertura: null,        // paso "apertura" de la sesión actual
  mesa: [],              // claves de los asientos sentados
  ronda: 0,
  cartas: { 1: {}, 2: {}, 3: {} },   // intervenciones por ronda y asiento
  lider: null,           // letra de la opción que va ganando
  flechas: [],           // réplicas dibujadas en la ronda actual
  orador: null,          // quién habla ahora
  espera: null,          // { fase, desde } mientras el Chair o los asientos escriben
  sentencia: null,       // paso "sentencia" ya recibido
};

export function reiniciarSesion() {
  Object.assign(estado, {
    apertura: null, mesa: [], ronda: 0, cartas: { 1: {}, 2: {}, 3: {} }, lider: null,
    flechas: [], orador: null, espera: null, sentencia: null, enVivo: false,
  });
}
