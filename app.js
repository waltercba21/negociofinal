var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var logger = require('morgan');
const session = require('express-session');
const dotenv = require('dotenv');
dotenv.config();
const calcularCantidadCarrito = require('./middleware/carritoMiddleware');
const mercadopago = require('mercadopago');

// **Cargar módulos de rutas después de inicializar el servidor**
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var productosRouter = require('./routes/productos');
var administracionRouter = require('./routes/administracion');
var carritoRoutes = require('./routes/carrito');
var pedidosRoutes = require('./routes/pedidos');

// **Crear la aplicación Express**
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        transports: ["websocket", "polling"], // ✅ Permitir WebSockets y Polling
        credentials: true
    }
});

// **Forzar WebSockets cuando sea posible**
io.engine.on("connection_error", (err) => {
    console.error("⚠️ Error de conexión en socket.io:", err.message);
});

// **Asignar `socket.io` globalmente en la aplicación**
app.set("io", io);

// **Configuración de Mercado Pago**
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

// **Middleware para sesiones**
app.use(session({
  secret: 'tu_secreto',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 6200000 }
}));

// **Middleware estándar**
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }));
app.use(bodyParser.json({ limit: '50mb' }));

// **Configurar archivos estáticos**
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// **Configurar el motor de vistas**
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// **Middleware de autenticación y globales**
app.use(calcularCantidadCarrito);
app.use((req, res, next) => {
  res.locals.producto = null;
  res.locals.isLogged = req.session.usuario !== undefined;
  res.locals.userLogged = req.session.usuario || {};
  next();
});

// **Definir rutas**
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/productos', productosRouter);
app.use('/administracion', administracionRouter);
app.use('/carrito', carritoRoutes);
app.use('/pedidos', pedidosRoutes);

// **Ruta de prueba para verificar `socket.io`**
app.get('/socket-test', (req, res) => {
    res.send("✅ WebSockets está funcionando correctamente en el servidor.");
});

// **Configuración de WebSockets**
io.on("connection", (socket) => {
    console.log("🔌 Cliente conectado a WebSockets.");

    socket.on("disconnect", () => {
        console.log("❌ Cliente desconectado.");
    });

    socket.on("nuevoPedido", (data) => {
        console.log("🔔 Evento 'nuevoPedido' recibido:", data);
    });
});

// **Iniciar el servidor**
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
  console.log("🛜 WebSocket corriendo en el mismo servidor");
});

module.exports = { app, server };
