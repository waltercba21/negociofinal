var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
const session = require('express-session');
const dotenv = require('dotenv');
dotenv.config();

// Middlewares
const adminMiddleware = require('./middleware/adminMiddleware');
const middlewares = require('./middleware/middlewares');
const calcularCantidadCarrito = require('./middleware/carritoMiddleware');

// Rutas
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var productosRouter = require('./routes/productos');
var administracionRouter = require('./routes/administracion');
var carritoRoutes = require('./routes/carrito');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

// Configurar el motor de vistas
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Configurar la sesión
app.use(session({
  secret: 'tu secreto',
  resave: false,
  saveUninitialized: true,
  cookie: {
    maxAge: 6200000
  }
}));

// Middleware para manejar sesiones expiradas
app.use((req, res, next) => {
  if (req.session.usuario && Date.now() > req.session.cookie.expires) {
    return res.redirect('/');
  }
  next();
});

// Middlewares generales
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de administración y variables globales
app.use(adminMiddleware);
app.use(middlewares.setGlobalVariables);

// ✅ Middleware para calcular la cantidad de productos en el carrito
app.use(calcularCantidadCarrito);

// Variables locales para la sesión y autenticación
app.use((req, res, next) => {
  res.locals.isLogged = req.session.usuario !== undefined;
  res.locals.userLogged = req.session.usuario || {};
  res.locals.cantidadProductosCarrito = res.locals.cantidadProductosCarrito || 0;
  next();
});

// Rutas
app.use('/', indexRouter);
console.log("Router montado correctamente");
app.use('/users', usersRouter);
app.use('/productos', productosRouter);
app.use('/administracion', administracionRouter);
app.use('/carrito', carritoRoutes);

// WebSockets con Socket.io
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');
});

// Exportar la aplicación y el servidor WebSocket
module.exports = { app: app, io: io };
