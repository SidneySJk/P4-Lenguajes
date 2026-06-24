const Recursos = require('./Recursos');

/**
 * @tipodef {'mina'|'central de investigación'|'astillero'|'fortaleza'} InstalacionTipo
 */

/**
 * Costos y valores de combate por tipo de instalación.
 * Configurable externamente si se carga desde JSON.
 * @tipo {Record<InstalacionTipo, { cost: Resources, valorCombate: number, valorPuntuacion: number }>}
 */
const instalacion_config = {
  mina: {
    costo:        new Recursos(100, 0, 0),
    valorCombate: 0,          // Neutralizada por 1 flota cada 3 minas
    valorPuntuacion:  0,
  },
  centro_investigacion: {
    costo:        new Recursos(80, 50, 200),
    valorCombate: 0,          // No participa en combate
    valorPuntuacion:  150,        // Puntaje al finalizar partida
  },
  astillero: {
    costo:        new Recursos(150, 100, 10),
    valorCombate: 1,          // 1 flota equivalente
    valorPuntuacion:  0,
  },
  fortaleza: {
    costo:        new Recursos(200, 100, 30),
    valorCombate: 2,          // Requiere 2 astilleros para derribar
    valorPuntuacion:  100,        // Puntaje al finalizar partida
  },
};

class Instalacion {
  /**
   * Crea una instalación dentro de un sistema planetario.
   * @param {InstalacionTipo} tipo    - Tipo de instalación.
   * @param {string}           propietarioId - ID del jugador propietario.
   */
  constructor(tipo, propietarioId) {
    if (!instalacion_config[tipo]) {
      throw new Error(`Tipo de instalación inválido: ${tipo}`);
    }
    /** @tipo {string} */
    this.id = `${tipo}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    /** @tipo {InstalacionTipo} */
    this.tipo = tipo;
    /** @tipo {string} */
    this.propietarioId = propietarioId;
    /** @tipo {boolean} */
    this.destruido = false;
  }

  /**
   * Retorna el costo de construcción de esta instalación.
   * @returns {Resources}
   */
  getCosto() {
    return instalacion_config[this.tipo].costo;
  }

  /**
   * Retorna el valor de combate de esta instalación.
   * Las flotas (shipyard) valen 1, las fortalezas 2, el resto 0.
   * @returns {number}
   */
  getValorCombate() {
    return instalacion_config[this.tipo].valorCombate;
  }

  /**
   * Retorna el puntaje que aporta esta instalación al finalizar la partida.
   * @returns {number}
   */
  getValorPuntuacion() {
    return instalacion_config[this.tipo].valorPuntuacion;
  }

  /**
   * Marca la instalación como destruida.
   * @returns {void}
   */
  destruido() {
    this.destruido = true;
  }

  /**
   * Indica si esta instalación es una flota (astillero).
   * Útil para contar flotas disponibles para mover.
   * @returns {boolean}
   */
  esFlota() {
    return this.tipo === 'astillero';
  }

  toJSON() {
    return {
      id:        this.id,
      tipo:      this.tipo,
      propietarioId:   this.propietarioId,
      destruido: this.destruido,
    };
  }
}

Instalacion.CONFIG = instalacion_config;

module.exports = Instalacion;
