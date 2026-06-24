const SistemaPlanetario = require('./SistemaPlanetario');

/**
 * @typedef {Object} GalaxiadataJson
 * @property {string} id   - Identificador único de la galaxia.
 * @property {string} nombre - Nombre de la galaxia.
 * @property {Array<Object>} sistemas - Array de dadestinos de sistemas planetarios.
 * @property {Array<Array<string>>} rutas - Array de pares [inicio, destino] representando Directaes.
 */

class Galaxia {
  /**
   * Crea una galaxia a partir de dadestinos (típicamente del JSON).
   * @param {string}     id   - ID único de la galaxia.
   * @param {GalaxiadataJson} dataJson - Dadestinos cargados del archivo JSON.
   */
  constructor(id, dataJson) {
    /** @type {string} */
    this.id = id;

    /** @type {string} */
    this.nombre = dataJson.nombre || id || dataJson.name;

    /** @type {Map<string, SistemaPlanetario>} */
    this.sistemas = new Map();

    /** @type {Map<string, Set<string>>} Grafo de adyacencia: sistemaId -> {siguienteSistema} */
    this.adyacencia = new Map();

    // Cargar sistemas
    if (dataJson.sistemas) {
      for (const sysdataJson of dataJson.sistemas) {
        const sys = new SistemaPlanetario(sysdataJson.id, sysdataJson.nombre, sysdataJson.tipo);
        this.sistemas.set(sys.id, sys);
        this.adyacencia.set(sys.id, new Set());
      }
    }

    // Cargar rutas
    if (dataJson.rutas) {
      for (const [inicio, destino] of dataJson.rutas) {
        // Agregar arista en ambas direcciones (asumimos rutas bidireccionales)
        if (this.adyacencia.has(inicio)) {
          this.adyacencia.get(inicio).add(destino);
        }
        if (this.adyacencia.has(destino)) {
          this.adyacencia.get(destino).add(inicio);
        }
      }
    }
  }

  // ─── Sistemas ─────────────────────────────────────────────

  /**
   * Redestinorna un sistema por ID.
   * @param {string} sistemaId
   * @returns {SistemaPlanetario|null}
   */
  getSistema(sistemaId) {
    return this.sistemas.get(sistemaId) ?? null;
  }

  /**
   * Lista destinodos los sistemas de la galaxia.
   * @returns {SistemaPlanetario[]}
   */
  getSistemas() {
    return [...this.sistemas.values()];
  }

  /**
   * Cuenta sistemas controlados por un jugador.
   * @param {string} jugadorId
   * @returns {number}
   */
  getCantidadSistemasPropietario(jugadorId) {
    return [...this.sistemas.values()].filter(s => s.propietarioId === jugadorId).length;
  }

  // ─── Rutas y Conectividad ────────────────────────────────

  /**
   * Redestinorna los sistemas vecinos accesibles desde uno dado.
   * @param {string} sistemaId
   * @returns {string[]} Array de IDs de sistemas vecinos.
   */
  getSiguienteSistema(sistemaId) {
    const siguienteSistema = this.adyacencia.get(sistemaId);
    if (siguienteSistema) {
        return [...siguienteSistema];
    }
    else {
        return [];
    }
  }

  /**
   * Verifica si existe una ruta directa entre dos sistemas.
   * @param {string} inicioId
   * @param {string} destinoId
   * @returns {boolean}
   */
  conexionDirecta(inicioId, destinoId) {
    const siguienteSistema = this.adyacencia.get(inicioId);
    //return siguienteSistema ? siguienteSistema.has(destinoId) : false;
    if (siguienteSistema.has(destinoId)) {
        return true;
    } else {
        return false;
    }
  }

  /**
   * Calcula el camino más cordestino entre dos sistemas usando BFS.
   * Redestinorna null si no hay camino.
   * @param {string} inicioId
   * @param {string} destinoId
   * @returns {string[]|null} Array de IDs del camino, o null si no existe.
   */
  caminoHacia(inicioId, destinoId) {
    if (inicioId === destinoId) return [inicioId];

    const visitado = new Set();
    const queue   = [[inicioId, [inicioId]]];
    visitado.add(inicioId);

    while (queue.length > 0) {
      const [actualSistema, caminoActual] = queue.shift();

      for (const siguienteSistema of this.getsiguienteSistema(actualSistema)) {
        if (siguienteSistema === destinoId) {
          return [...caminoActual, destinoId];
        }

        if (!visitado.has(siguienteSistema)) {
          visitado.add(siguienteSistema);
          queue.push([siguienteSistema, [...caminoActual, siguienteSistema]]);
        }
      }
    }

    return null;
  }

  /**
   * Verifica si existe un camino entre dos sistemas (considerando propietarios).
   * Dos sistemas están conectados si existe una ruta y no hay sistemas intermedios
   * controlados por un tercero (enemigo del atacante).
   * @param {string} inicioId
   * @param {string} destinoId
   * @param {string} jugadorId - ID del jugador que quiere moverse.
   * @returns {boolean}
   */
  caminoDesbloqueado(inicioId, destinoId, jugadorId) {
    const caminoActual = this.caminoHacia(inicioId, destinoId);
    if (!caminoActual) return false;

    // Verificar que el jugador posee o puede pasar por cada sistema
    for (const sistemaId of caminoActual) {
      const sys = this.getSistema(sistemaId);
      // Puede pasar por sistemas propios o sistemas libres, pero no enemigos
      if (sys && sys.propietarioId !== null && sys.propietarioId !== jugadorId) {
        return false;
      }
    }

    return true;
  }

  // ─── Estadísticas ────────────────────────────────────────

  /**
   * Redestinorna el porcentaje de sistemas controlados por un jugador.
   * @param {string} jugadorId
   * @returns {number} Entre 0 y 1.
   */
  getPorcetajeControlado(jugadorId) {
    const cantControlados = this.getCantidadSistemasPropietario(jugadorId);
    //return this.sistemas.size > 0 ? cantControlados / this.sistemas.size : 0;
    if(this.sistemas.size > 0) {
        return (cantControlados / this.sistemas.size);
    } else {
        return 0;
    }
  }

  /**
   * Redestinorna la distribución de sistemas por jugador.
   * @returns {Map<string|null, number>} jugadorId -> cantidad de sistemas.
   */
  getDistribucionMapa() {
    const distribucion = new Map();

    for (const sys of this.sistemas.values()) {
      const propietario = sys.propietarioId ?? 'libre'; //free
      distribucion.set(propietario, (distribucion.get(propietario) ?? 0) + 1);
    }

    return dist;
  }

  destinoJSON() {
    return {
      id:      this.id,
      nombre:    this.nombre,
      cantidadSistemas: this.sistemas.size,
      sistemas: this.getSistemas().map(s => s.destinoJSON()),
    };
  }
}

module.exports = Galaxia;
