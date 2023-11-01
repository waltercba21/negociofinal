const conexion = require('../config/conexion')
const producto = require('../models/producto')
var borrar = require('fs');


module.exports = {
    index : function (req,res){
                res.render('index');
    },
    lista: function (req, res) {
        const categoria = req.query.categoria;
        if (categoria) {
            producto.obtenerPorCategoria(conexion, categoria, function (error, productos) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                } else {
                    console.log('Productos obtenidos:', productos);
                    res.render('productos', { productos: productos });
                }
            });
        } else {
            producto.obtener(conexion, function (error, productos) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                } else {
                    console.log('Productos obtenidos:', productos);
                    res.render('productos', { productos: productos });
                }
            });
        }
    },
    
    crear: function(req,res){
        res.render('crear')
    },
    guardar: function(req,res){  
        producto.insertar(conexion,req.body,req.file,function(error){
             res.redirect('/productos');
        })
    },
    eliminar: function(req,res){
       producto.retornarDatosId(conexion,req.params.id,function (error, registros){
        var nombreImagen = '/public/images/' + (registros [0].imagen);
        
        if(borrar.existsSync(nombreImagen)){
            borrar.unlinkSync(nombreImagen);
        }
        producto.borrar(conexion,req.params.id, function (error){

            res.redirect('/productos');
        })
       });
    },

    editar : function (req,res){
        producto.retornarDatosId(conexion,req.params.id,function (error, registros){
            console.log(registros[0])
            res.render('editar', {producto: registros[0]});
        });
    },
    
    actualizar: function (req, res) {    
    if(req.file){
        if(req.file.filename){
            producto.retornarDatosId(conexion,req.body.id,function (error, registros){
                var nombreImagen = '/public/images/' + (registros [0].imagen);
                
                if(borrar.existsSync(nombreImagen)){
                    borrar.unlinkSync(nombreImagen);
                }
               producto.actualizarArchivo(conexion,req.body, req.file, function (error){})

               });
        }
    }
    if(req.body.nombre){producto.actualizar(conexion,req.body,function(error){

        });
    }
    res.redirect('/productos');
    
},
carrito : function (req,res){
    // Obtener los productos en el carrito de la sesión
    var productosEnCarrito = req.session.carrito || [];
    // Imprimir los productos en el carrito
    console.log('Productos en el carrito:', productosEnCarrito);
    // Renderizar la vista del carrito y pasar los productos en el carrito a la vista
    res.render('carrito', { productos: productosEnCarrito });
},
    panelControl: function (req,res){

    producto.obtener(conexion,function(error,datos){
        res.render('panelControl', { title: 'Productos', productos:datos });
    })
},
buscarPorNombre: function (req, res) {
    const nombre = req.query.query; // 

    if (!nombre) {
        producto.obtenerTodos(conexion, (error, productos) => {
            if (error) {
                console.error(error);
                res.status(500).send('Error interno del servidor');
                return;
            }
            res.json({ productos });
        });
    } else {
        producto.obtenerPorNombre(conexion, nombre, (error, productos) => {
          if (error) {
            console.error(error);
            res.status(500).send('Error interno del servidor');
            return;
          }

          res.json({ productos });
        });
    }   
},
todos: function (req, res) {
    producto.obtener(conexion, function (error, productos) {
        if (error) {
            console.log('Error al obtener productos:', error);
        } else {
            console.log('Productos obtenidos:', productos);
            res.render('productos', { productos: productos });
        }
    });
},
agregarAlCarrito: function (req, res) {
    console.log ('Funcion agregarAlCarrito llamada con el id:', req.params.id)

    const productoId = req.params.id;
    const usuarioId = req.session.usuario.id; // Asegúrate de tener el id del usuario en la sesión
    const cantidad = 1; // puedes cambiar esto por la cantidad que el usuario seleccionó
    const metodoEnvio = req.body.metodo_envio; // obtén el método de envío
    const imagen = req.body.imagen; // obtén la imagen del producto

    producto.retornarDatosId(conexion, productoId, function (error, productos) {
      if (error) {
        console.log('Error al obtener el producto:', error);
        res.redirect('/productos');
      } else {
        // Agregar el producto al carrito en la sesión
        if (!req.session.carrito) {
          req.session.carrito = [];
        }
        // Agregar una propiedad de cantidad al producto
        productos[0].cantidad = cantidad;
        req.session.carrito.push(productos[0]); // Agregar solo el primer producto al carrito

        // Obtén el precio del producto
        const precio = productos[0].precio;
        // Calcula el precio total que es el precio del producto multiplicado por la cantidad
        const precioTotal = precio * cantidad;

        // Insertar o actualizar el producto en el carrito en la base de datos
        conexion.query('INSERT INTO carritos (usuario_id, producto_id, cantidad, precio_total, metodo_envio, imagen) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cantidad = cantidad + ?', [usuarioId, productoId, cantidad, precioTotal, metodoEnvio, imagen, cantidad], function (error) {
          if (error) {
            console.log('Error al guardar el carrito en la base de datos:', error);
          }

          // Redirigir al usuario a la vista del carrito
          res.redirect('/productos/carrito');
        });
      }
    });
},

  eliminarDelCarrito : function(req, res) {
    console.log('Función eliminarDelCarrito llamada');
    const productoId = req.params.id;
    console.log('productoId:', productoId);
    const usuarioId = req.session.usuario.id; 
    console.log('usuarioId:', usuarioId);

    // Encuentra el producto en la sesión del carrito
    const index = req.session.carrito.findIndex(producto => producto.producto_id === productoId);

    // Si el producto está en el carrito, elimínalo
    if (index !== -1) {
        req.session.carrito.splice(index, 1);
    }

    // Elimina el producto del carrito de compras en la base de datos
    conexion.query('DELETE FROM carritos WHERE producto_id = ? AND usuario_id = ?', [productoId, usuarioId], function (error) {
        if (error) {
            console.log('Error al eliminar el producto del carrito en la base de datos:', error);
        } else {
            // Redirige al usuario de vuelta al carrito
            res.redirect('/productos/carrito');
        }
    });
},
  
  actualizarCantidadCarrito: function(req, res) {
    const productoId = Number(req.params.id);
    const nuevaCantidad = Number(req.body.cantidad);
    const carrito = req.session.carrito || [];

    for (var i = 0; i < carrito.length; i++) {
      if (Number(carrito[i].id) === productoId) {
        carrito[i].cantidad = nuevaCantidad;
        break;
      }
    }

    req.session.carrito = carrito;
    res.redirect('/productos/carrito');
},
vaciarCarrito : function(req, res) {
    req.session.carrito = [];
    res.redirect('/productos/carrito');
},
mostrarCompra : function(req, res) {
    res.render('compra');
  },
completarCompra : function(req, res) {
   
    res.redirect('/');
  },


}