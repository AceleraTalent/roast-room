// Reproductor: todos los pasos pasan por una sola cola ordenada, así los asientos hablan de a
// uno aunque el Chair los haya escrito a la vez. Admite pausa, tres velocidades, saltar lo que
// está en cola y cancelar limpiamente al cambiar de sesión.
export const CANCELADO = Symbol("cancelado");

export const reproductor = {
  cola: [],
  ocupado: false,
  epoca: 0,
  velocidad: 1,
  pausado: false,
  rapido: false,
  reanudadores: [],
  manejador: null,
  alCambiar: () => {},

  empujar(paso) {
    this.cola.push(paso);
    this.alCambiar();
    this.bombear();
  },

  async bombear() {
    if (this.ocupado) return;
    this.ocupado = true;
    const mia = this.epoca;
    while (this.cola.length && mia === this.epoca) {
      await this.puerta(mia);
      if (mia !== this.epoca) break;
      const paso = this.cola.shift();
      this.alCambiar();
      try { await this.manejador(paso); } catch (e) { if (e !== CANCELADO) console.error(e); }
    }
    if (mia === this.epoca) {
      this.ocupado = false;
      this.rapido = false;
      this.alCambiar();
    }
  },

  /** Espera mientras esté en pausa (salvo que se esté saltando). */
  puerta(epoca) {
    if (!this.pausado || this.rapido) return Promise.resolve();
    return new Promise((res) => this.reanudadores.push(() => res(epoca)));
  },

  /** Duerme `ms` ajustados por la velocidad, respetando pausa, salto y cancelación. */
  async dormir(ms) {
    const epoca = this.epoca;
    let resto = ms / this.velocidad;
    while (resto > 0 && !this.rapido) {
      if (epoca !== this.epoca) throw CANCELADO;
      if (this.pausado) { await this.puerta(epoca); continue; }
      const trozo = Math.min(50, resto);
      await new Promise((r) => setTimeout(r, trozo));
      resto -= trozo;
    }
    if (epoca !== this.epoca) throw CANCELADO;
  },

  pausar(valor = !this.pausado) {
    this.pausado = valor;
    if (!valor) this.reanudadores.splice(0).forEach((r) => r());
    this.alCambiar();
  },

  saltar() {
    this.rapido = true;
    this.pausar(false);
  },

  reiniciar() {
    this.epoca++;
    this.cola.length = 0;
    this.ocupado = false;
    this.rapido = false;
    this.pausado = false;
    this.reanudadores.splice(0).forEach((r) => r());
    this.alCambiar();
  },

  get pendientes() {
    return this.cola.filter((p) => p.tipo === "intervencion").length;
  },
};
