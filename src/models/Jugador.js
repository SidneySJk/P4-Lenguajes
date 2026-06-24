const Recursos = require('./Recursos');

class Jugador {
  constructor(id, nickname) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.nickname = nickname;
    /** @type {recursos} */
    this.recursos = new Recursos(0, 0, 0);
    /** @type {boolean} True si fue eliminado */
    this.eliminado = false;
    /** @type {number} Timestamp de cuando fue eliminado */
    this.horaEliminado = null;
    /** @type {Object} Info de lasesión actual */
    this.sesionActual = {
      juegoId:   null,
      socketId: null,
      horaInicio: null,
    };
  }

  sumarRecursos(recursos) {
    this.recursos = this.recursos.sumar(recursos);
  }

  restarRecursos(costo) {
    if (!this.recursos.cubreCosto(costo)) {
      return false;
    }
    this.recursos = this.recursos.restar(costo);
    return true;
  }

  cubreCosto(costo) {
    return this.recursos.cubreCosto(costo);
  }

  eliminar() {
    this.eliminado  = true;
    this.horaEliminado = Date.now();
  }

  estadosIniciales(juegoId, socketId) {
    this.recursos    = new Recursos(0, 0, 0);
    this.eliminado   = false;
    this.horaEliminado = null;
    this.sesionActual = {
      juegoId,
      socketId,
      horaInicio: Date.now(),
    };
  }

  getPuntajeRecursos() {
    return this.recursos.score();
  }

  activo() {
    return !this.eliminado && this.sesionActual.socketId !== null;
  }

  getSesionDuracion() {
    if (!this.sesionActual.horaInicio) return 0;
    return Math.floor((Date.now() - this.sesionActual.horaInicio) / 1000);
  }

  toJSON() {
    return {
      id:           this.id,
      nickname:     this.nickname,
      recursos:    this.recursos.toJSON(),
      eliminado:   this.eliminado,
      horaEliminado: this.horaEliminado,
      sesionActual:      this.sesionActual,
    };
  }
}

module.exports = Jugador;
