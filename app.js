var createError = require('http-errors');
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

//Rutas
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var productosRouter = require('./routes/productos');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(session({
  secret: 'tu secreto',
  resave: false,
  saveUninitialized: true,
  cookie: { 
    maxAge: 6200000 
  }
}));

app.use((req, res, next) => {
  // Inicializa el carrito si no existe
  req.session.carrito = req.session.carrito || [];
  next();
});

app.use((req, res, next) => {
  // Si el usuario ha iniciado sesión y la sesión ha expirado, redirige al index
  if (req.session.usuario && Date.now() > req.session.cookie.expires) {
    res.redirect('/');
    return;
  }

  // Si la sesión está activa o el usuario no ha iniciado sesión, continúa con la siguiente función middleware
  next();
});

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use(adminMiddleware)
// Usar el middleware global
app.use(middlewares.setGlobalVariables);
app.use((req, res, next) => {
  res.locals.isLogged = req.session.usuario !== undefined;
  res.locals.userLogged = req.session.usuario || {}; // Inicializar como objeto vacío si no hay usuario en sesión
  next();
})
  
//Utilizacion de las Rutas
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/productos', productosRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;