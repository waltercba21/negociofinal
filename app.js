// app.js
require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const session = require('express-session');
const mercadopago = require('mercadopago');

const adminMiddleware = require('./middleware/adminMiddleware');
const middlewares = require('./middleware/middlewares');

// Routers
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const productosRouter = require('./routes/productos');
const administracionRouter = require('./routes/administracion');
const carritoRoutes = require('./routes/carrito');
const pedidosRoutes = require('./routes/pedidos');
const whatsappRoutes = require('./routes/whatsapp');
const analyticsRoutes = require('./routes/analytics');
const reportesRoutes = require('./routes/reportes');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, { cors: { origin: '*' } });
app.set('io', io);

// --- Mercado Pago ---
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn('⚠️ Falta MP_ACCESS_TOKEN en .env');
}
mercadopago.configure({ access_token: process.env.MP_ACCESS_TOKEN || '' });

// --- Vistas ---
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// --- Proxy y sesión ---
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1); // si estás detrás de Nginx
app.use(session({
  secret: process.env.SESSION_SECRET || 'cambia-este-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 2, // 2h
    sameSite: 'lax',
    secure: process.env.TRUST_PROXY === '1' // true si usás HTTPS detrás de proxy
  }
}));

// --- Logger y parsers ---
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));
app.use(cookieParser());

// --- Estáticos ---
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Variables globales y auth ---
app.use(middlewares.setGlobalVariables);
app.use(adminMiddleware);

// --- Locals por si alguna vista accede a estas claves ---
app.use((req, res, next) => {
  res.locals.producto = null;
  res.locals.isLogged = !!req.session.usuario;
  res.locals.userLogged = req.session.usuario || {};

  res.locals.cantidadCarrito = 0; // <- para que header.ejs nunca rompa
  next();
});


// --- Rutas ---
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/productos', productosRouter);
app.use('/administracion', administracionRouter);
app.use('/carrito', carritoRoutes);
app.use('/pedidos', pedidosRoutes);
app.use('/whatsapp', express.urlencoded({ extended: true }), whatsappRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/reportes', reportesRoutes);

// --- WebSockets ---
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado');
  socket.on('disconnect', () => console.log('❌ Cliente desconectado'));
  socket.on('nuevoPedido', (data) => {
    console.log("🔔 'nuevoPedido' recibido:", data);
  });
});

// --- 404 y 500 (sin vistas para evitar errores) ---
app.use((req, res) => {
  res.status(404).send('No encontrado');
});

app.use((err, req, res, next) => {
  console.error('💥 Error no controlado:', err);
  if (req.xhr || (req.headers.accept || '').includes('application/json')) {
    return res.status(500).json({ error: 'Error interno' });
  }
  res.status(500).send('Error interno');
});

// --- Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});

module.exports = { app, io, server };
