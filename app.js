var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
const session = require('express-session');
const adminMiddleware = require('./middleware/adminMiddleware');
const middlewares = require('./middleware/middlewares');
const dotenv = require('dotenv');
dotenv.config();
const calcularCantidadCarrito = require('./middleware/carritoMiddleware');
const mercadopago = require('mercadopago');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var productosRouter = require('./routes/productos');
var administracionRouter = require('./routes/administracion');
var carritoRoutes = require('./routes/carrito');
var pedidosRoutes = require('./routes/pedidos');

var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server, { cors: { origin: "*" } });  

// 🔹 **Asociar `socket.io` correctamente con Express**
app.set("io", io);  

// Configuración de Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

// Configuración de vistas y motor de plantillas
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Configuración de sesiones
app.use(session({
  secret: 'tu secreto',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 6200000 }
}));

// Middleware para calcular la cantidad en el carrito
app.use(calcularCantidadCarrito);

// Middleware para manejar sesiones expiradas
app.use((req, res, next) => {
  if (req.session.usuario && Date.now() > req.session.cookie.expires) {
    res.redirect('/');
    return;
  }
  next();
});

// Logger de solicitudes
app.use(logger('dev'));

// Configuración de parseo de JSON y formularios
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de autenticación y globales
app.use(adminMiddleware);
app.use(middlewares.setGlobalVariables);

// **Middleware para evitar errores de "producto is not defined" en todas las vistas**
app.use((req, res, next) => {
  res.locals.producto = null;
  res.locals.isLogged = req.session.usuario !== undefined;
  res.locals.userLogged = req.session.usuario || {};
  next();
});

// **Definir rutas DESPUÉS de configurar socket.io**
app.use('/', indexRouter);
console.log("Router montado correctamente");
app.use('/users', usersRouter);
app.use('/productos', productosRouter);
app.use('/administracion', administracionRouter);
app.use('/carrito', carritoRoutes);
app.use('/pedidos', pedidosRoutes);

// **Configuración de WebSockets**
io.on("connection", (socket) => {
  console.log("🔌 Un cliente se ha conectado al WebSocket");

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado");
  });

  socket.on("nuevoPedido", (data) => {
    console.log("🔔 Evento 'nuevoPedido' recibido en el servidor:", data);
  });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log("🛜 WebSocket corriendo en el mismo servidor");
});

module.exports = { app, server };
