const Recursos = require('./Recursos');
const Instalacion = require('./Instalacion');

/**
 * @typedef {'minero'|'energetico'|'cientifico'|'balanciado'} TipoPlaneta
 */
// typedef {d|s|w|1}
/**
 * Producción base por ciclo según tipo de planeta.
 * Configurable externombrente (p. ej. cargado desde config.json).
 * @type {Record<TipoPlaneta, Recursos>}
 */

const productores_config = {
  minero:     new Recursos(100, 30, 10),
  energetico:  new Recursos(50,  50, 10),
  cientifico: new Recursos(40,  40, 30),
  balanceado:   new Recursos(35,  35, 35),
};

class SistemaPlanetario {
    constructor(id, nombre, tipo) {
        if (!productores_config[tipo]) {
            throw new Error(`Tipo de planeta inválido: ${tipo}`);
        }
        this.id = id;
        this.nombre = nombre;
        this.tipo = tipo;
        this.descripcion;
        this.tiempoCiclo = 20;
        this.propietarioId;
        this.cantidadFlotas;
        this.instalaciones = [];
        this.estado = 'inexplorado';
    }

    producir() {
        if (!this.propietarioId) return new Recursos();
    
        const base  = productores_config[this.tipo];
        const minas = this.getActiveinstalaciones('mina').length;
        const bonus = new Recursos(minas * 50, minas * 25, minas * 10);
    
        return base.add(bonus);
      }

      // ─── Instalaciones ───────────────────────────────────────
    
      /**
       * Agrega una instalación al sistema.
       * @param {instalacion} instalacion
       * @throws {Error} Si el sistema no está controlado o la instalación no pertenece al dueño.
       */
    setInstalaciones(instalacion) {
        if (!this.propietarioId) {
          throw new Error('No se puede construir en un sistema sin dueño.');
        }
        if (instalacion.propietarioId !== this.propietarioId) {
          throw new Error('La instalación debe pertenecer al dueño del sistema.');
        }
        this.instalaciones.push(instalacion);
      }
    
      /**
       * Retorna las instalaciones activas (no destruidas) de un tipo dado.
       * Si no se pasa tipo, retorna todas las activas.
       * @param {instalacionType} [type]
       * @returns {instalacion[]}
       */
      getInstalacionesActivas(tipo) {
        return this.instalaciones.filter(
          i => !i.destruido && (tipo === undefined || i.tipo === tipo)
        );
      }
    
      /**
       * Retorna la cantidad de flotas (astilleros) estacionadas en el sistema.
       * @returns {number}
       */
      getCantidadAstilleros() {
        return this.getInstalacionesActivas('astillero').length;
      }
    
      // ─── Propiedad ───────────────────────────────────────────
    
      /**
       * Asigna un nuevo propietario al sistema y lo marca como controlado.
       * Pasa ownerId = null para liberarlo.
       * @param {string|null} propietarioId
       */
      setPropietarioId(id) {
        this.propietarioId = id;
        this.estado  = id ? 'controlado' : 'Inexplorado';
      }
    
      /**
       * Indica si el sistema está libre (sin dueño).
       * @returns {boolean}
       */
      libre() {
        return this.propietarioId === null;
      }
    
      // ─── Combate ─────────────────────────────────────────────
    
      /**
       * Calcula la fuerza de combate total del sistema (flotas + fortalezas).
       * Fórmula: cada shipyard = 1 punto, cada fortress = 2 puntos.
       * Las minas reducen flotas atacantes (1 mina neutraliza 1/3 de flota).
       * @returns {number}
       */
      getFuerzaCombate() {
        return this.getInstalacionesActivas().reduce(
          (total, inst) => total + inst.getValorCombate(),
          0
        );
      }
    
      /**
       * Aplica el resultado de un combate al sistema defensor.
       * Destruye instalaciones según las pérdidas recibidas.
       * @param {number} losses - Unidades de fuerza perdidas por el defensor.
       */
      aplicarPerdidaDefensas(perdidas) {
        let restantes = perdidas;
    
        // Primero se destruyen fortalezas (valor 2), luego flotas (valor 1)
        for (const tipo of ['fortaleza', 'astillero', 'mina']) {
          const instalacionesActivas = this.getInstalacionesActivas(tipo);
          for (const inst of instalacionesActivas) {
            if (restantes <= 0) break;
            inst.destruido();
            restantes -= inst.getValorCombate() || 1;
          }
          if (restantes <= 0) break;
        }
      }
    
      // ─── Puntaje ─────────────────────────────────────────────
    
      /**
       * Calcula el puntaje de infraestructura activa en este sistema.
       * Usado al finalizar la partida si se alcanza el tiempo máximo.
       * @returns {number}
       */
      getPuntuacionInfraestructura() {
        return this.getInstalacionesActivas().reduce(
          (total, inst) => total + inst.getValorPuntuacion(),
          0
        );
      }
    
      toJSON() {
        return {
          id:            this.id,
          nombre:          this.nombre,
          tipo:          this.tipo,
          propietarioId:       this.propietarioId,
          estado:        this.estado,
          instalaciones: this.instalaciones.map(i => i.toJSON()),
          cantidadFlotas:    this.getCantidadAstilleros(),
        };
      }
}

SistemaPlanetario.productores_config = productores_config;

module.exports = SistemaPlanetario;
