const fs   = require('fs');
const path = require('path');
const Juego = require('./Juego');
const Galaxia = require('./Galaxia');

/**
 * @typedef {Object} GameConfig
 * @property {string}  nombre               - Nombre de la partida.
 * @property {number}  maxJugadores         - Cantidad máxima de jugadores.
 * @property {number}  duracionMs           - Duración máxima en milisegundos.
 * @property {string}  nivelRecursos        - 'bajo' | 'normal' | 'alto'
 * @property {string}  galaxiaId            - ID de la galaxia predefinida.
 * @property {number}  [esperaMs]           - Tiempo de espera antes de expirar (default 60s).
 * @property {number}  [porcentajeVictoria] - % de sistemas para ganar (default 0.6).
 */

class administradorJuego {
  /**
   * Constructor privado. Usar getInstancia() para obtener la instancia.
   * @private
   */
  constructor() {
    /** @type {Map<string, Game>} */
    this.juegos = new Map();
    /** @type {Map<string, Galaxia>} Galaxias predefinidas cargadas. */
    this.galaxias = new Map();
    /** @type {string} Ruta a la carpeta de configuración de galaxias. */
    this.galaxiasPath = process.env.GALAXIES_PATH ?? path.join(__dirname, '../config/galaxia');

    this._cargarGalaxias();
  }

  // ─── Singleton ────────────────────────────────────────────

  /**
   * Retorna la instancia única de administradorJuego.
   * Implementa patrón Singleton.
   * @returns {administradorJuego}
   */
  static getInstancia() {
    if (!administradorJuego._instancia) {
      administradorJuego._instancia = new administradorJuego();
    }
    return administradorJuego._instancia;
  }

  // ─── Galaxias ─────────────────────────────────────────────

  /**
   * Carga todas las galaxias desde archivos JSON en la carpeta de configuración.
   * Archivos deben tener formato: "galaxyname.json"
   * @private
   */
  _cargarGalaxias() {
    try {
      if (!fs.existsSync(this.galaxiasPath)) {
        console.warn(`Carpeta de galaxias no existe: ${this.galaxiasPath}`);
        return;
      }

      const archivos = fs.readdirSync(this.galaxiasPath).filter(f => f.endsWith('.json'));

      for (const archivo of archivos) {
        const pathArchivo = path.join(this.galaxiasPath, archivo);
        try {
          const data = JSON.parse(fs.readFileSync(pathArchivo, 'utf8'));
          const galaxia = new Galaxia(data.id || archivo.replace('.json', ''), data);
          this.galaxias.set(galaxia.id, galaxia);
          console.log(`Galaxia cargada: ${galaxia.id}`);
        } catch (err) {
          console.error(`Error cargando galaxia ${archivo}:`, err.message);
        }
      }
    } catch (err) {
      console.error('Error al cargar galaxias:', err.message);
    }
  }

  /**
   * Retorna una galaxia por ID.
   * @param {string} galaxiaId
   * @returns {Galaxia|null}
   */
  getGalaxia(galaxiaId) {
    return this.galaxias.get(galaxiaId) ?? null;
  }

  /**
   * Lista todas las galaxias disponibles.
   * @returns {Galaxia[]}
   */
  listaGalaxias() {
    return [...this.galaxias.values()];
  }

  // ─── Partidas ─────────────────────────────────────────────

  /**
   * Crea una nueva partida con la configuración indicada.
   * @param {GameConfig} config
   * @returns {Game|null} La nueva partida, o null si hay error.
   * @throws {Error} Si la galaxia no existe o la configuración no es valida.
   */
  crearJuego(config) {
    // Validar que la galaxia existe
    const galaxia = this.getGalaxia(config.galaxiaId);
    if (!galaxia) {
      throw new Error(`Galaxia no encontrada: ${config.galaxiaId}`);
    }
    const juegoId = this._generarJuegoId();
    const juego = new Juego(juegoId, {
      nombre:             config.nombre,
      maxJugadores:       config.maxJugadores,
      duracionMs:         config.duracionMs,
      nivelRecursos:      config.nivelRecursos,
      esperaMs:           config.esperaMs ?? 60_000,
      porcentajeVictoria: config.porcentajeVictoria ?? 0.6,
      galaxia:            galaxia,
    });

    this.juegos.set(juegoId, juego);
    if (typeof juego.activarTimerExpiracion === 'function') {
      juego.activarTimerExpiracion();
    }
    console.log(`Partida creada: ${juegoId} (${config.nombre})`);
    
    return juego;
  }

  /**
   * Obtiene una partida activa por ID.
   * @param {string} gameId
   * @returns {Game|null}
   */
  getJuego(juegoId) {
    return this.juegos.get(juegoId) ?? null;
  }

  /**
   * Lista todas las partidas activas (no expiradas ni terminadas).
   * @param {Object} [filters]
   * @param {string} [filters.status] - Filtrar por estado ('espera', 'en_progreso', etc).
   * @returns {Game[]}
   */
  listaJuegos(filters = {}) {
    let resultado = [...this.juegos.values()];

    // Filtrar por estado (nombres de estado en español)
    if (filters.estado) {
      resultado = resultado.filter(g => g.estado === filters.estado);
    }

    // Excluir expiradas y terminadas (opcional)
    resultado = resultado.filter(g => g.estado !== 'expirado' && g.estado !== 'finalizado');

    return resultado;
  }

  /**
   * Retorna las partidas esperando jugadores (estado 'espera').
   * Estas son las que se muestran en el lobby.
   * @returns {Game[]}
   */
  getJuegosDisponibles() {
    return this.listaJuegos({ estado: 'espera' });
  }

  /**
   * Elimina una partida de la memoria (para limpieza).
   * Típicamente se llama cuando termina y se archiva.
   * @param {string} gameId
   * @returns {boolean} true si se eliminó, false si no existía.
   */
  eliminarJuego(juegoId) {
    return this.juegos.delete(juegoId);
  }

  /**
   * Retorna estadísticas del servidor.
   * @returns {Object}
   */
  getStats() {
    const juegos = [...this.juegos.values()];

    const espera = juegos.filter(j => j.estado === 'espera').length;
    const enProgreso = juegos.filter(j => j.estado === 'en_progreso').length;
    const finalizado = juegos.filter(j => j.estado === 'finalizado').length;
    const expirado = juegos.filter(j => j.estado === 'expirado').length;

    const totalJugadores = juegos.reduce((sum, j) => sum + j.jugadores.size, 0);

    return {
      juegoStats: {
        espera: espera,
        enProgreso: enProgreso,
        finalizado: finalizado,
        expirado: expirado,
        total: juegos.length,
      },
      totalJugadores,
      galaxiasCargadas: this.galaxias.size,
    };
  }

  // ─── Utilitarios ──────────────────────────────────────────

  /**
   * Genera un ID único para una nueva partida.
   * Formato: "game_" + timestamp + 4 dígitos aleatorios.
   * @returns {string}
   * @private
   */
  _generarJuegoId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `game_${timestamp}_${random}`;
  }

  /**
   * Limpia partidas terminadas o expiradas (para mantenimiento).
   * Se puede ejecutar periódicamente desde el servidor.
   * @returns {number} Cantidad de partidas eliminadas.
   */
  limpiar() {
    let removido = 0;

    for (const [juegoId, juego] of this.juegos.entries()) {
      if (juego.estado === 'finalizado' || juego.estado === 'expirado') {
        this.juegos.delete(juegoId);
        removido++;
      }
    }

    if (removido > 0) {
      console.log(`${removido} partida(s) eliminada(s)`);
    }

    return removido;
  }

  toJSON() {
    return {
      partidasActivas: this.juegos.size,
      galaxiasCargadas:  this.galaxias.size,
      stats:           this.getStats(),
    };
  }
}

module.exports = administradorJuego;
