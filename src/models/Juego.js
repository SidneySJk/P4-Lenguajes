const Recursos    = require('./Recursos');
const Instalacion = require('./Instalacion');

const recursosIniciales_config = {
  bajo:    new Recursos(100, 50,  20),
  normal: new Recursos(300, 150, 50),
  alto:   new Recursos(500, 250, 100),
};

class Juego {
  constructor(id, config) {
    this.id = id;
    this.nombre = config.nombre;
    this.estado = 'espera';
    this.maxJugadores = config.maxJugadores;
    this.duracionMs = config.duracionMs;
    this.esperaMs = config.esperaMs ?? 60_000;
    this.porcentajeVictoria = config.porcentajeVictoria ?? 0.6;
    this.nivelRecursos = config.nivelRecursos ?? 'normal';
    this.galaxia = config.galaxia;
    this.jugadores = new Map();
    this.horaInicio = null;
    this.horaFinal = null;
    this._timerProduccion = null;
    this._timerExpiracion = null;
    this._timerFinPartida = null;
    this.callbackEvento = null;
  }

  // ─── Jugadores ───────────────────────────────────────────

  /**
   * Agrega un jugador a la partida.
   * Solo es válido mientras la partida esté en estado 'espera'.
   * @param {Object} jugador - Objeto jugador con al menos { id, nickname, Recursos }.
   * @throws {Error} Si la partida no está en espera o está llena.
   */
  agregarJugadorPartida(jugador) {
    if (this.estado !== 'espera') {
      throw new Error('No se puede unir a una partida que ya inició');
    }
    if (this.jugadores.size >= this.maxJugadores) {
      throw new Error('La partida está llena.');
    }
    if (this.jugadores.has(jugador.id)) {
      throw new Error('El jugador ya está en esta partida.');
    }
    //Se pone por default normal
    jugador.recursos = (recursosIniciales_config[this.nivelRecursos] ?? recursosIniciales_config.normal);
    this.jugadores.set(jugador.id, jugador); //Hacer un clave-valor del jugador y su id

    this._emit('jugador_joined', { jugadorId: jugador.id, nickname: jugador.nickname });

    if (this.jugadores.size === this.maxJugadores) {
      this._emit('room_full', { gameId: this.id });
    }
  }

  /**
   * Inicia la cuenta regresiva de 3 segundos y luego arranca la partida.
   * Requiere que la sala esté llena y el estado sea 'espera'.
   * @returns {Promise<void>}
   */
  iniciarPartida() {
    if (this.estado !== 'espera') {
      throw new Error('La partida no puede iniciar desde el estado actual.');
    }
    if (this.jugadores.size < 2) {
      throw new Error('Se necesitan al menos 2 jugadores para iniciar.');
    }

    this.estado = 'iniciada';
    this._emit('countdown', { seconds: 3 });

    return new Promise(resolve => {
      setTimeout(() => {
        this._estadosIniciales();
        resolve();
      }, 3000);
    });
  }

  /**
   * Lógica interna de inicio: asigna bases, activa timers.
   * @private
   */
  _estadosIniciales() {
    this._asignarSistemasBase();
    this.estado    = 'en_progreso';
    this.horaInicio = Date.now();

    // Timer de producción cada 20 s (configurable via env)
    const cicloSeg = parseInt(process.env.PRODUCTION_CYCLE_SEC ?? '20', 10);
    this._timerProduccion = setInterval(() => this._produccionPorTick(), cicloSeg * 1000);

    // Timer de fin de partida
    this._timerFinPartida = setTimeout(() => this.finPartida('timeout'), this.duracionMs);

    this._emit('game_started', { gameId: this.id, horaInicio: this.horaInicio });
  }

  /**
   * Asigna aleatoriamente un sistema base a cada jugador.
   * Los sistemas base no se repiten.
   * @private
   */
  _asignarSistemasBase() {
    const sistemas  = this.galaxia.getSistemas();
    const shuffled = [...sistemas].sort(() => Math.random() - 0.5);
    let index = 0;

    for (const jugador of this.jugadores.values()) {
      const sistema = shuffled[index++];
      sistema.setPropietarioId(jugador.id);

      // Astillero inicial gratuito
      const flotaInicial = new Instalacion('shipyard', jugador.id);
      sistema.agregarInstalaciones(flotaInicial);

      this._emit('base_assigned', { jugadorId: jugador.id, sistemaId: sistema.id });
    }
  }

  // ─── Producción ──────────────────────────────────────────

  /**
   * Ciclo de producción: cada sistema controlado genera recursos
   * para su propietario. Se ejecuta cada PRODUCTION_CYCLE_SEC segundos.
   * @private
   */
  _produccionPorTick() {
    for (const sistema of this.galaxia.getSistemas()) {
      if (!sistema.propietarioId) continue;

      const jugador = this.jugadores.get(sistema.propietarioId);
      if (!jugador || jugador.eliminado) continue;

      const producido = sistema.producir();
      jugador.recursos = jugador.recursos.add(producido);

      this._emit('resorces_produced', {
        jugadorId:  jugador.id,
        sistemaId:  sistema.id,
        producido:  producido.toJSON(),
        total:     jugador.recursos.toJSON(),
      });
    }
  }

  // ─── Fin de partida ──────────────────────────────────────

  /**
   * Finaliza la partida por la razón indicada.
   * @param {'timeout'|'conquest'|'last_standing'} reason
   */
  finPartida(reason) {
    if (this.estado === 'finalizado') return;

    clearInterval(this._timerProduccion);
    clearTimeout(this._timerFinPartida);
    clearTimeout(this._timerExpiracion);

    this.estado  = 'finalizado';
    this.horaFinal = Date.now();
    /*
    const leaderboard = this.getLeaderboard();

    this._emit('game_ended', {
      gameId:      this.id,
      reason,
      winner:      leaderboard[0]?.jugadorId ?? null,
      leaderboard,
    });
    */ 
    this._emit('game_ended', {
      gameId: this.id,
      reason,
    }); 
  }

  /**
   * Verifica si se cumple alguna condición de fin de partida.
   * Debe llamarse después de cada acción relevante (conquista, eliminación).
   * @returns {boolean} true si la partida terminó.
   */
  checkFinPartidaCondicion() {
    const jugadorActivo = [...this.jugadores.values()].filter(p => !p.eliminated);

    // Condición 1: solo queda un jugador
    if (jugadorActivo.length === 1) {
      this.finPartida('last_standing');
      return true;
    }

    // Condición 2: un jugador controla el porcentaje requerido
    const totalSistemas = this.galaxia.getSistemas().length;
    const porcentaje = Math.ceil(totalSistemas * this.porcentajeVictoria);

    for (const jugador of jugadorActivo) {
      const controlados = this.galaxia.getSistemas()
        .filter(s => s.propietarioId === jugador.id).length;

      if (controlados >= porcentaje) {
        this.finPartida('conquest');
        return true;
      }
    }

    return false;
  }

  // ─── Leaderboard ─────────────────────────────────────────

  /**
   * Calcula y retorna el ranking de jugadores ordenado por puntaje descfinPartidaente.
   * Puntaje = (sistemas × 5000) + recursos.score() + infraestructura.
   * @returns {Array<Object>}
  
  getLeaderboard() {
    const sistemas = this.galaxia.getSistemas();

    return [...this.jugadores.values()]
      .map(jugador => {
        const controlled = sistemas.filter(s => s.propietarioId === jugador.id);

        const sistemaScore = controlled.length * 5000;
        const resScore    = jugador.Recursos.score();
        const infraScore  = controlled.reduce(
          (sum, s) => sum + s.getInfrastructureScore(), 0
        );
        const flotaInicials = controlled.reduce((sum, s) => sum + s.getflotaInicialCount(), 0);

        return {
          jugadorId:         jugador.id,
          nickname:         jugador.nickname,
          score:            sistemaScore + resScore + infraScore,
          sistemasControlled: controlled.length,
          Recursos:        jugador.Recursos.toJSON(),
          flotaInicials,
          eliminated:       jugador.eliminated ?? false,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((entry, i) => ({ ...entry, position: i + 1 }));
  }
  */
  // ─── Expiración de sala ──────────────────────────────────

  /**
   * Activa el timer de expiración de sala de espera.
   * Si transcurre esperaMs sin completar jugadores, la partida expira.
   */
  activarTimerExpiracion() {
    this._timerExpiracion = setTimeout(() => {
      if (this.estado === 'espera') {
        this.estado = 'expirado';
        this._emit('game_expired', { gameId: this.id });
      }
    }, this.esperaMs);
  }

  // ─── Utilidades ──────────────────────────────────────────

  /**
   * Emite un evento a todos los participantes vía WebSocket.
   * El SocketHandler debe asignar esta función al crear la partida.
   * @param {string} event - Nombre del evento.
   * @param {Object} data  - Payload del evento.
   * @private
   */
  _emit(evento, data) {
    if (typeof this.callbackEvento === 'function') {
      this.callbackEvento(evento, data);
    }
  }

  toJSON() {
    return {
      id:           this.id,
      nombre:         this.nombre,
      estado:       this.estado,
      maxJugadores:   this.maxJugadores,
      jugadoresActivos: this.jugadores.size, //currentjugadores
      galaxiaNombre:   this.galaxia?.nombre ?? null,
      horaInicio:    this.horaInicio,
      horaFinal:      this.horaFinal,
    };
  }
}

module.exports = Juego;