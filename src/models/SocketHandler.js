const Jugador = require('./Jugador');
const Combate = require('./Combate');

/**
 * SocketHandler maneja los eventos socket.io del servidor.
 * Se encarga de:
 * - Conectar y desconectar jugadores
 * - Enrutar acciones como construir, mover y atacar
 * - Validar acciones
 * - Mostrar cambios a al cliente.
 */

 /**
   * Parametros de entrada.
   * 
   * @param {Socket} socket - Conexion del cliente (un jugador individual).
   * @param {Object} data - Datos enviados por el cliente.
   * @param {Function} callback - Función de respuesta al cliente.
   */

class SocketHandler {
  /**
   * Constructor del manejador de sockets.
   * 
   * @param {Server} io - Instancia de socket.io.
   * @param {administradorJuego} administradorJuego - Singleton.
   */
  constructor(io, administradorJuego) {
    /** @type {Server} */
    this.io = io;
    /** @type {administradorJuego} */
    this.administradorJuego = administradorJuego;
    /** @type {Map<string, string>} */
    this.socketToPlayer = new Map();
    /** @type {Map<string, string>} */
    this.socketToGame = new Map();
    this._setupListeners();
  }

  /**
   * Listeners globales de socket.io.
   * @private
   */
  _setupListeners() {
    this.io.on('connection', (socket) => {
      console.log(`Cliente conectado: ${socket.id}`);
      socket.on('disconnect', () => this._onDisconnect(socket));
      socket.on('list_games', (callback) => this._onListGames(socket, callback));
      socket.on('create_game', (data, callback) => this._onCreateGame(socket, data, callback));
      socket.on('join_game', (data, callback) => this._onJoinGame(socket, data, callback));
      socket.on('start_game', (data, callback) => this._onStartGame(socket, data, callback));
      socket.on('build', (data, callback) => this._onBuild(socket, data, callback));
      socket.on('move_fleet', (data, callback) => this._onMoveFleet(socket, data, callback));
      socket.on('attack', (data, callback) => this._onAttack(socket, data, callback));
      socket.on('error', (err) => console.error(`Error en socket ${socket.id}:`, err));
    });
  }

  /**
   * Desconectar cliente.
   * @private
   */
  _onDisconnect(socket) {
    console.log(`Desconectado: ${socket.id}`);
    const juegoId = this.socketToGame.get(socket.id);
    const jugadorId = this.socketToPlayer.get(socket.id);
    if (juegoId && jugadorId) {
      const juego = this.administradorJuego.getJuego(juegoId);
      if (juego) {
        const jugador = juego.jugadores.get(jugadorId);
        if (jugador) {
          jugador.sesionActual.socketId = null;
          this._broadcastToGame(juegoId, 'player_disconnected', { jugadorId: jugadorId });
        }
      }
    }

    this.socketToPlayer.delete(socket.id);
    this.socketToGame.delete(socket.id);
  }

  /**
   * Lista de partidas disponibles en estado 'espera'.
   * @private
   */
  _onListGames(socket, callback) {
    try {
      const juegos = this.administradorJuego.getJuegosDisponibles();
      const data = juegos.map(g => ({
        juegosId:        g.id,
        nombre:          g.nombre,
        maxJugadores:    g.maxJugadores,
        jugadoresActuales: g.jugadores.size,
        nombreGalaxia:    g.galaxia.nombre,
        estado:        g.estado,
      }));

      callback({ success: true, data });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  }

  /**
   * Crear una nueva partida.
   * @private
   */
  _onCreateGame(socket, data, callback) {
    try {
      const config = {
        nombre:          data.nombre,
        maxJugadores:    data.maxJugadores ?? 4,
        duracionMs:    (data.duracionMinutos ?? 30) * 60_000,
        nivelRecursos: data.nivelRecursos ?? 'normal',
        galaxiaId:      data.galaxiaId,
      };
      const juego = this.administradorJuego.crearJuego(config);
      const jugador = new Jugador(socket.id, data.nickname);
      jugador.sesionActual.socketId = socket.id;
      callback({ success: true, juegoId: juego.id });
      socket.emit('game_created', { juegoId: juego.id });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  }

  /**
   * Unirse a una partida.
   * @private
   */
  _onJoinGame(socket, data, callback) {
    try {
      const juego = this.administradorJuego.getJuego(data.juegoId);
      if (!juego) {
        return callback({ success: false, error: 'Partida no encontrada' });
      }
      if (juego.estado !== 'espera') {
        return callback({ success: false, error: 'La partida no está en espera.' });
      }

      const jugador = new Jugador(socket.id, data.nickname);
      jugador.sesionActual.socketId = socket.id;
      juego.agregarJugadorPartida(jugador);
      this.socketToPlayer.set(socket.id, jugador.id);
      this.socketToGame.set(socket.id, juego.id);
      socket.join(`game_${juego.id}`);
      callback({
        success: true,
        juegoId:   juego.id,
        jugadorId: jugador.id,
      });
      this._broadcastToGame(juego.id, 'player_joined', {
        jugadorId:   jugador.id,
        nickname:   jugador.nickname,
        cantidadJugadores: juego.jugadores.size,
      });
      if (juego.jugadores.size === juego.maxJugadores) {
        this.io.to(`game_${juego.id}`).emit('room_full', { juegoId: juego.id });
      }
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  }

  /**
   * Iniciar la partida (solo quien creó puede hacerlo).
   * @private
   */
  _onStartGame(socket, data, callback) {
    try {
      const juego = this.administradorJuego.getJuego(data.juegoId);
      if (!juego) {
        return callback({ success: false, error: 'Partida no encontrada.' });
      }
      if (juego.jugadores.size < 2) {
        return callback({ success: false, error: 'Se necesitan al menos 2 jugadores.' });
      }

      juego.callbackEvento = (evento, eventoData) => {
        this._broadcastToGame(juego.id, evento, eventoData);
      };
      juego.iniciarPartida();
      callback({ success: true });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  }

  /**
   * Construir una instalación en un sistema.
   * @private
   */
  _onBuild(socket, data, callback) {
    try {
      const juego = this.administradorJuego.getJuego(data.juegoId);
      if (!juego) {
        return callback({ success: false, error: 'Partida no encontrada.' });
      }

      const jugadorId = this.socketToPlayer.get(socket.id);
      const jugador = juego.jugadores.get(jugadorId);

      if (!jugador) {
        return callback({ success: false, error: 'Jugador no encontrado.' });
      }

      const sistema = juego.galaxia.getSistema(data.sistemaId);

      if (!sistema) {
        return callback({ success: false, error: 'Sistema no encontrado.' });
      }
      if (sistema.propietarioId !== jugadorId) {
        return callback({ success: false, error: 'No eres dueño de este sistema.' });
      }

      const Instalacion = require('./Instalacion');
      const instalacionCosto = Instalacion.CONFIG[data.instalacionTipo]?.costo;

      if (!instalacionCosto) {
        return callback({ success: false, error: 'Tipo de instalación inválido.' });
      }
      if (!jugador.spendResources(instalacionCosto)) {
        return callback({ success: false, error: 'No tienes suficientes recursos.' });
      }

      const instalacion = new Instalacion(data.instalacionTipo, jugadorId);
      sistema.setInstalacion(instalacion);
      callback({ success: true, instalacion: instalacion.toJSON() });
      this._broadcastToGame(juego.id, 'installation_built', {
        sistemaId:      sistema.id,
        instalacionTipo: data.instalacionTipo,
        jugadorId,
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  }

  /**
   * Mover flota entre sistemas.
   * @private
   */
  _onMoveFleet(socket, data, callback) {
    try {
      const juego = this.administradorJuego.getJuego(data.juegoId);
      if (!juego) {
        return callback({ success: false, error: 'Partida no encontrada.' });
      }

      const jugadorId = this.socketToPlayer.get(socket.id);
      const sistemaOrigen = juego.galaxia.getSistema(data.fromSystemId);
      const sistemaDestino = juego.galaxia.getSistema(data.toSystemId);

      if (!sistemaOrigen || !sistemaDestino) {
        return callback({ success: false, error: 'Sistema no encontrado.' });
      }
      if (sistemaDestino.propietarioId && sistemaDestino.propietarioId !== jugadorId) {
        return callback({ success: false, error: 'Usa "attack" para conquistar sistemas enemigos.' });
      }
      if (!juego.galaxia.caminoDesbloqueado(sistemaOrigen.id, sistemaDestino.id, jugadorId)) {
        return callback({ success: false, error: 'El camino está bloqueado.' });
      }
      if (sistemaOrigen.getCantidadAstilleros() < data.cantidadAstilleros) {
        return callback({ success: false, error: 'No tienes suficientes flotas.' });
      }

      callback({ success: true });
      this._broadcastToGame(juego.id, 'fleet_moved', {
        sistemaOrigenId: sistemaOrigen.id,
        sistemaDestinoId: sistemaDestino.id,
        jugadorId,
        cantidadFlotas: data.cantidadAstilleros,
      });
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  }

  /**
   * Atacar un sistema enemigo.
   * @private
   */
  _onAttack(socket, data, callback) {
    try {
      const juego = this.administradorJuego.getJuego(data.juegoId);
      if (!juego) {
        return callback({ success: false, error: 'Partida no encontrada.' });
      }

      const jugadorId = this.socketToPlayer.get(socket.id);
      const sistemaOrigen = juego.galaxia.getSistema(data.sistemaOrigenId);
      const sistemaDestino = juego.galaxia.getSistema(data.sistemaDestinoId);

      if (!sistemaOrigen || !sistemaDestino) {
        return callback({ success: false, error: 'Sistema no encontrado.' });
      }

      const validacion = Combate.validarCombate(
        juego.galaxia, sistemaOrigen,
        sistemaDestino, jugadorId, 
        data.cantidadAstilleros
      );

      if (!validacion.valid) {
        return callback({ success: false, error: validacion.reason });
      }

      const result = Combate.determinarGanador(
        sistemaOrigen, jugadorId,
        data.cantidadAstilleros,
        sistemaDestino
      );
      Combate.aplicarResultadoDefensa(sistemaDestino, result.propietario, result.defensaPerdidas);
      callback({ success: true, result });
      this._broadcastToGame(juego.id, 'combat_resolved', {
        sistemaOrigenId:  sistemaOrigen.id,
        sistemaDestinoId:    sistemaDestino.id,
        jugadorId:    jugadorId,
        atacanteVictoria:  result.atacanteVictoria,
        propietario:      result.nuevoPropietario,
        descripcion:   result.descripcion,
      });
      juego.checkFinPartidaCondicion();
    } catch (err) {
      callback({ success: false, error: err.message });
    }
  }

  // Auxiliares
  
  /**
   * Emite un evento a todos los jugadores de una partida.
   * @private
   */
  _broadcastToGame(gameId, evento, data) {
    this.io.to(`game_${gameId}`).emit(evento, data);
  }

  /**
   * Emite un evento a un jugador específico.
   * @private
   */
  _emitToPlayer(jugadorId, evento, data) {
    // Encontrar el socketId asociado
    for (const [socketId, pId] of this.socketToPlayer.entries()) {
      if (pId === jugadorId) {
        this.io.to(socketId).emit(evento, data);
        break;
      }
    }
  }
}

module.exports = SocketHandler;
