/**
 * Servidor de Colonias Galácticas
 * 
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const AdministradorJuego = require('./models/AdministradorJuego');
const SocketHandler = require('./models/SocketHandler');
const CicloRecursos = require('./models/CicloRecursos');

const config = {
  port: process.env.PORT ?? 3001,
  host: process.env.HOST ?? '0.0.0.0',
  productionCycleSec: parseInt(process.env.PRODUCTION_CYCLE_SEC ?? '20', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};


const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.use(express.json());
app.use(express.static('public'));

const administradorJuego = AdministradorJuego.getInstancia();

const socketHandler = new SocketHandler(io, administradorJuego);

const cicloRecursos = new CicloRecursos();

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);
  socket.on('')

  socket.on('attack', (data, callback) => {
    try {
      socketHandler._handleAttack(socket, data, callback);
      socket.emit()
    } catch (err) {
      callback({
        success: false,
        error: 'Error, ${data.jugadorId} no pudo atacar a ${data.sistemaDestinoId}: ' + err.message,
      })
    }
  })
  socket.on('disconnect', () => {
    console.log('Desconectado:', socket.id);
  });
});

/**
 * GET /api/salaEspera
 * Listar todas las partidas disponibles.
 */

app.post('/api/crearPartida', (req, res) => {
  try {
    const jugador = new Jugador(req.body.jugadorId, req.body.nickname);

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/unirsePartida', (req, res) => {
  try {
    const jugadorUnirse = new Jugador(req.body.jugadorId, req.body.nickname);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/juegos
 * Lista todas las partidas disponibles.
 */
app.get('/api/juegos', (req, res) => {
  try {
    const juegos = administradorJuego.getJuegosDisponibles();
    res.json({
      success: true,
      data: juegos.map(g => ({
        juegoId:        g.id,
        nombre:         g.nombre,
        maxJugadores:   g.maxJugadores,
        jugadoresActuales: g.jugadores.size,
        nombreGalaxia:  g.galaxia?.nombre,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/galaxias
 * Lista todas las galaxias disponibles.
 */
app.get('/api/galaxias', (req, res) => {
  try {
    const galaxias = administradorJuego.listaGalaxias();
    res.json({
      success: true,
      data: galaxias.map(g => ({
        id: g.id,
        nombre: g.nombre,
        sistemasCount: g.getSistemas?.().length ?? (g.sistemas?.length ?? 0),
      })),

    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/estadisticas
 * Estadísticas del servidor.
 */
app.get('/api/estadisticas', (req, res) => {
  try {
    const stats = administradorJuego.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * 5 minutos elimina partidas finalizadas.
 */
setInterval(() => {
  administradorJuego.limpiar();
}, 5 * 60 * 1000);


process.on('SIGTERM', () => {
  console.log(' SIGTERM recibido. Cerrando...');
  cicloRecursos.detenerCiclo?.();
  server.close(() => {
    console.log('Servidor cerrado.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log(' SIGINT recibido. Cerrando...');
  cicloRecursos.detenerCiclo?.();
  server.close(() => {
    console.log('Servidor cerrado.');
    process.exit(0);
  });
});

module.exports = { app, server, io, administradorJuego, socketHandler, cicloRecursos, gameManager: administradorJuego, resourceScheduler: cicloRecursos };
