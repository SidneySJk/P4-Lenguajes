const Recursos = ('./CicloRecursos');

class CicloRecursos {
    
    constructor() {
        this.instanciaJuego;
        this.intervaloId = null;
        this.porTick = null;
        this.activo = false;
    }

    iniciarCiclo(juego, segundos=2000) {
        if (this.activo) {
            console.warn('Ciclo ya activo');
            return;
        }
        this.activo = true;
        this.intervaloId = setInterval(() => {
            this.iniciarTick(juego); 
        }, segundos);

        console.log('Ciclo de ticks establecido');
    }
 
    iniciarTick(juego) {
        if(juego.estado !== 'activo') {
            return;
        }

        const sistemas = juego.galaxy.getSistemas();
        const eventos = [];

        for (const sistema of sistemas) {
        if (!sistema.propietarioId) {
            continue;
        }

        const jugador = juego.jugadores.get(sistema.propietarioId);
        if (!jugador || jugador.eliminado) {
            continue;
        }

        // Generar recursos
        const producido = sistema.producir();
        jugador.sumarRecursos(producido);

        eventos.push({
            tipe: 'resources_produced',
            sistemaId: sistema.id,
            jugadorId: jugador.id,
            producido: producido.toJSON(),
            totalRecursos: jugador.recursos.toJSON(),
        });
        }

        // Emitir evento único con todos los cambios del ciclo
        if (this._emitEvent) {
        this._emitEvent('production_cycle', {
            timestamp: Date.now(),
            events: eventos,
        });
        }
    }

    detenerCiclo() {
        if (this.intervaloId) {
            clearInterval(this.intervaloId);
            this.intervaloId = null;
        }
        this.activo = false;
        console.log('Ciclodetenido');
    }

    iniciarEventEmitter(callback) {
        this._emitEvent = callback;
    }

  /**
   * Retorna el estado actual del scheduler.
   * @returns {Object}
   */
    getStatus() {
        return { running: this.activo,
        intervalHandle: this.intervaloId !== null,
        };
    }
}



module.exports = CicloRecursos;
