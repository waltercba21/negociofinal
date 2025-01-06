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

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var productosRouter = require('./routes/productos');
var administracionRouter = require('./routes/administracion');
var carritoRoutes = require('./routes/carrito');
var app = express();
var server = require('http').Server(app); // Agregamos esta línea
var io = require('socket.io')(server); // Y esta también

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
  secret: 'tu secreto',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    maxAge: 6200000, 
    secure: true, // Asegúrate de usar HTTPS para que esto funcione
    httpOnly: true, // Protege contra ataques de XSS
  }
}));

app.use((req, res, next) => {
  if (req.session.usuario && Date.now() > req.session.cookie.expires) {
    res.redirect('/');
    return;
  }
  next();
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({limit: '50mb', extended: false}));
app.use(bodyParser.json({limit: '50mb'}));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(adminMiddleware)
app.use(middlewares.setGlobalVariables);
app.use((req, res, next) => {
  res.locals.isLogged = !!req.session.usuario; // Booleano
  res.locals.userLogged = req.session.usuario || null; // Datos del usuario
  next();
});

app.use('/', indexRouter);
console.log("Router montado correctamente");
app.use('/users', usersRouter);
app.use('/productos', productosRouter);
app.use ('/administracion',administracionRouter);
app.use('/carrito', carritoRoutes);

io.on('connection', (socket) => { 
  console.log('Un cliente se ha conectado');
});

module.exports = {app: app, io: io};
