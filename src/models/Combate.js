const Jugador = require('./Jugador');

class Combate {
   
  static determinarGanador(sistemaAtacante, atacanteId, flotasAtacantes, sistemaEnAtaque) {
    if (flotasAtacantes <= 0) {
      return {
        atacanteVictoria: false,
        atacantePerdidas: 0,
        defensaPerdidas: 0,
        propietario: sistemaEnAtaque.propietarioId,
        description: 'No hay flotas para atacar',
      };
    }

    // Calcular fuerzas de combate de ambos lados
    const atacanteFuerza = this._calcularFuerza(flotasAtacantes);
    const defensaFuerza = this._calcularFuerza(sistemaEnAtaque);

    // Calcular pérdidas
    const { atacantePerdidas, defensaPerdidas } = this._calcularPerdidas(
      atacanteFuerza,
      defensaFuerza
    );

    // Determinar ganador y nuevo propietario
    const atacanteFuerzasActuales = atacanteFuerza - atacantePerdidas;
    const defensaFuerzasActuales = defensaFuerza - defensaPerdidas;

    let atacanteVictoria = false;
    let propietario = sistemaEnAtaque.propietarioId;

    if (atacanteFuerzasActuales > defensaFuerzasActuales) {
      atacanteVictoria = true;
      propietario = atacanteId;
    }

    return {
      atacanteVictoria,
      atacantePerdidas,
      defensaPerdidas,
      propietario,
      atacanteFuerza,
      defensaFuerza,
      description: this._resultados(
        atacanteVictoria,
        atacanteFuerza,
        defensaFuerza,
        atacantePerdidas,
        defensaPerdidas
      ),
    };
  }

  /**
   * Calcula la fuerza de combate de un sistema o flota atacante.
   * 
   * Fuerza = sum(combatValue de cada instalación) + flotas enviadas.
   * 
   * @param {PlanetSystem|number} sistemaOflotas
   * @returns {number}
   * @private
   */
  static _calcularFuerza(sistemaOflotas) {
    // Si es un número, es la cantidad de flotas enviadas
    if (typeof sistemaOflotas === 'number') {
      return sistemaOflotas;
    }

    // Si es un sistema (PlanetSystem), contar su fuerza
    return sistemaOflotas.getCombatStrength();
  }

  /**
   * Calcula las pérdidas de combate según la fuerza de ambos lados.
   * 
   * Cada unidad de fuerza atacante causa 1 punto de daño al defensor.
   * Cada unidad de fuerza defensora causa 1 punto de daño al atacante.
   * 
   * Las pérdidas se distribuyen entre las instalaciones del defensor
   * en orden de prioridad: fortalezas (2 pts), flotas (1 pt), minas (1/3 pt).
   * 
   * @param {number} atacanteFuerza
   * @param {number} defensaFuerza
   * @returns {{ atacantePerdidas: number, defensaPerdidas: number }}
   * @private
   */
  static _calcularPerdidas(atacanteFuerza, defensaFuerza) {
    return {
      atacantePerdidas: Math.max(0, defensaFuerza),
      defensaPerdidas: Math.max(0, atacanteFuerza),
    };
  }

  /**
   * Construye una descripción legible del combate.
   * 
   * @param {boolean} atacanteVictoria
   * @param {number} atacanteFuerza
   * @param {number} defensaFuerza
   * @param {number} atacantePerdidas
   * @param {number} defensaPerdidas
   * @returns {string}
   * @private
   */
  static _resultados(atacanteVictoria, atacanteFuerza, defensaFuerza, atacantePerdidas, defensaPerdidas) {
    const result = atacanteVictoria ? 'VICTORIA ATACANTE' : 'VICTORIA DEFENSA';
    return (
      `${result}: ` +
      `Atacante (F:${atacanteFuerza} → ${atacanteFuerza - atacantePerdidas}) vs ` +
      `Defensor (F:${defensaFuerza} → ${defensaFuerza - defensaPerdidas})`
    );
  }

  /**
   * Aplica los resultados del combate al sistema defensor.
   * Destruye instalaciones según las pérdidas recibidas.
   * Transfiere la propiedad si el atacante ganó.
   * 
   * @param {PlanetSystem} sistemaEnAtaque
   * @param {string} propietario - ID del nuevo propietario (atacante si ganó, o defensor original).
   * @param {number} defensaPerdidas - Cantidad de fuerza Perdidasdida.
   */
  static aplicarResultadoDefensa(sistemaEnAtaque, propietario, defensaPerdidas) {
    // Aplicar pérdidas de instalaciones al defensor
    sistemaEnAtaque.aplicarPerdidaDefensas(defensaPerdidas);

    // Si cambió de dueño, actualizar propiedad
    if (propietario !== sistemaEnAtaque.propietarioId) {
      sistemaEnAtaque.setPropietarioId(propietario);
    }
  }

  /**
   * Valida que un movimiento de flotas sea legal.
   * 
   * @param {galaxia} galaxia
   * @param {PlanetSystem} sistemaAtacante
   * @param {PlanetSystem} sistemaEnAtaque
   * @param {string} jugadorId - ID del jugador que intenta mover.
   * @param {number} cantidadFlotas - Cantidad de flotas a enviar.
   * @returns {{ valid: boolean, reason: string|null }}
   */
  static validarCombate(galaxia, sistemaAtacante, sistemaEnAtaque, jugadorId, cantidadFlotas) {
    // Validar que el atacante sea dueño del sistema origen
    if (sistemaAtacante.propietarioId !== jugadorId) {
      return { valid: false, reason: 'No eres dueño del sistema de origen.' };
    }

    // Validar que hay suficientes flotas
    if (sistemaAtacante.getCantidadAstilleros() < cantidadFlotas) {
      return { valid: false, reason: 'Flotas insuficiente.' };
    }

    // Validar que el camino no esté bloqueado
    if (!galaxia.caminoDesbloqueado(sistemaAtacante.id, sistemaEnAtaque.id, jugadorId)) {
      return { valid: false, reason: 'El camino está bloqueado por flotas rivales' };
    }

    // Validar que no es el mismo sistema
    if (sistemaAtacante.id === sistemaEnAtaque.id) {
      return { valid: false, reason: 'Autoataque.' };
    }

    return { valid: true, reason: null };
  }
}

module.exports = Combate;