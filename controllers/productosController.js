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
                    // Formatear el precio de cada producto
                    productos.forEach(producto => {
                        producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    });
    
                    console.log('Productos obtenidos:', productos);
                    res.render('productos', { productos: productos });
                }
            });
        } else {
            producto.obtener(conexion, function (error, productos) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                } else {
                    // Formatear el precio de cada producto
                    productos.forEach(producto => {
                        producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    });
    
                    console.log('Productos obtenidos:', productos);
                    res.render('productos', { productos: productos });
                }
            });
        }
    },
    crear: function(req,res){
        res.render('crear')
    },
    guardar: function(req, res) {
        const datos = req.body;
        datos.precio = parseFloat(datos.precio);
    
        producto.insertar(conexion, datos, req.file, function(error) {
            if (error) {
                console.log('Error al guardar producto:', error);
            } else {
                res.redirect('/productos');
            }
        });
    },
    eliminar: function(req,res){
        producto.retornarDatosId(conexion,req.params.id,function (error, registros){
            if (error) {
                console.error(error);
                res.status(500).send('Error al obtener el producto');
                return;
            }
            if (registros.length > 0) {
                var nombreImagen = '/public/images/' + (registros [0].imagen);
                if(borrar.existsSync(nombreImagen)){
                    borrar.unlinkSync(nombreImagen);
                }
    
                // Primero, elimina las referencias al producto en la tabla carritos
                conexion.query('DELETE FROM carritos WHERE producto_id=?', [req.params.id], function(error, resultados) {
                    if (error) {
                        console.error(error);
                        res.status(500).send('Error al eliminar las referencias al producto en el carrito');
                        return;
                    }
    
                    // Luego, elimina el producto
                    producto.borrar(conexion,req.params.id, function (error){ 
                        if (error) {
                            console.error(error);
                            res.status(500).send('Error al eliminar el producto');
                            return;
                        }
                        res.redirect('/productos/panelControl');
                    })
                });
            } else {
                res.status(404).send('Producto no encontrado');
            }
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
panelControl: function (req, res) {
    producto.obtener(conexion, function (error, productos) {
        if (error) {
            console.log('Error al obtener productos:', error);
        } else {
            // Formatear el precio de cada producto
            productos.forEach(producto => {
                producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
            });

            res.render('panelControl', { title: 'Productos', productos: productos });
        }
    });
},
buscarPorNombre: function (req, res) {
    const nombre = req.query.query; 
    if (!nombre) {
        producto.obtenerTodos(conexion, (error, productos) => {
            if (error) {
                console.error(error);
                res.status(500).send('Error interno del servidor');
                return;
            }
            // Formatear el precio de cada producto
            productos.forEach(producto => {
                producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
            });

            res.json({ productos });
        });
    } else {
        producto.obtenerPorNombre(conexion, nombre, (error, productos) => {
          if (error) {
            console.error(error);
            res.status(500).send('Error interno del servidor');
            return;
          }
          // Formatear el precio de cada producto
          productos.forEach(producto => {
              producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
          });

          res.json({ productos });
        });
    }   
},
todos: function (req, res) {
    producto.obtener(conexion, function (error, productos) {
        if (error) {
            console.log('Error al obtener productos:', error);
        } else {
            // Formatear el precio de cada producto
            productos.forEach(producto => {
                producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
            });

            console.log('Productos obtenidos:', productos);
            res.render('productos', { productos: productos });
        }
    });
},
carrito: function (req, res) {
    var usuarioId = req.session.usuario.id;
    conexion.query('SELECT carritos.*, productos.nombre, productos.imagen, productos.precio FROM carritos INNER JOIN productos ON carritos.producto_id = productos.id WHERE carritos.usuario_id = ?', [usuarioId], function (error, productosEnCarrito) {
        if (error) {
            console.log('Error al recuperar los productos del carrito:', error);
            return;
        }

        req.session.carrito = productosEnCarrito;
        req.session.save(function(err) {
            if (err) {
                console.log('Error al guardar la sesión:', err);
            }
            res.render('carrito', { productos: productosEnCarrito });
        });
    });
},

agregarAlCarrito: function (req, res) {
    console.log ('Funcion agregarAlCarrito llamada con el id:', req.params.id)
    const productoId = req.params.id;
    const usuarioId = req.session.usuario.id; 
    const cantidad = 1; 

    producto.retornarDatosId(conexion, productoId, function (error, productos) {
        if (error) {
            console.log('Error al obtener el producto:', error);
            return res.redirect('/productos');
        }

        const precioTotal = productos[0].precio * cantidad;

        conexion.query('INSERT INTO carritos (usuario_id, producto_id, cantidad, precio_total) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE cantidad = cantidad + ?', [usuarioId, productoId, cantidad, precioTotal, cantidad], function (error) {
            if (error) {
                console.log('Error al guardar el carrito en la base de datos:', error);
                return;
            }

            req.session.carrito = req.session.carrito || [];
            req.session.carrito.push(productos[0]);
            req.session.save(function(err) {
                if (err) {
                    console.log('Error al guardar la sesión:', err);
                }
                res.redirect('/productos/carrito');
            });
        });
    });
},

eliminarDelCarrito : function(req, res) {
    console.log('Función eliminarDelCarrito llamada');
    const carritoId = Number(req.params.id);
    console.log('carritoId:', carritoId);
    const usuarioId = req.session.usuario.id; 
    console.log('usuarioId:', usuarioId);
    conexion.query('DELETE FROM carritos WHERE id = ? AND usuario_id = ?', [carritoId, usuarioId], function (error, results) {
        if (error) {
            console.log('Error al eliminar el producto del carrito en la base de datos:', error);
        } else {
            console.log('Filas afectadas:', results.affectedRows);
            const index = req.session.carrito.findIndex(producto => producto.id === carritoId);
            if (index !== -1) {
                req.session.carrito.splice(index, 1);
            }
            console.log('Carrito después de la eliminación:', req.session.carrito);
            console.log('Sesión:', req.session);  // Agregado
            console.log('Carrito:', req.session.carrito);  // Agregado
            req.session.save(function(err) {
                if(err) {
                    console.log('Error al guardar la sesión:', err);
                }
                res.redirect('/productos/carrito');
            });
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
    const usuarioId = req.session.usuario.id;
    conexion.query('DELETE FROM carritos WHERE usuario_id = ?', [usuarioId], function (error, results) {
        if (error) {
            console.log('Error al vaciar el carrito en la base de datos:', error);
        } else {
            req.session.carrito = [];
            req.session.save(function(err) {
                if(err) {
                    console.log('Error al guardar la sesión:', err);
                }
                res.redirect('/productos/carrito');
            });
        }
    });
},
mostrarCompra : function(req, res) {
    var carrito = req.session.carrito || [];
    var mensaje = 'Estoy interesado en comprar los siguientes productos:\n';
    var totalPedido = 0;
    for (var i = 0; i < carrito.length; i++) {
        var costoProducto = carrito[i].precio * carrito[i].cantidad;
        totalPedido += costoProducto;
        mensaje += carrito[i].nombre + ' (Cantidad: ' + carrito[i].cantidad + ', Costo: $' + costoProducto + ')\n';
    }
    var metodoEnvio = req.session.metodoEnvio;
    mensaje += 'Método de envío: ' + metodoEnvio + '\n';
    var costoEnvio;
    switch (metodoEnvio) {
        case 'envio-dia':
            costoEnvio = 1000;
            break;
        case 'retiro-local':
            costoEnvio = 0;
            break;
        case 'envio-correo':
            costoEnvio = 2500;
            break;
    }
    totalPedido += costoEnvio;
    mensaje += 'Costo de envío: $' + costoEnvio + '\n';
    mensaje += 'Costo total del pedido: $' + totalPedido + '\n';
    console.log(mensaje); 
    var urlWhatsapp = 'https://wa.me/543513274715?text=' + encodeURIComponent(mensaje);
    res.redirect(urlWhatsapp);
},
seleccionarEnvio: function(req, res) {
    const metodoEnvio = req.body.envio;
    req.session.metodoEnvio = metodoEnvio;
    res.status(200).send({ message: 'Método de envío seleccionado correctamente.' });
},
getCarrito:function(req, res) {
    const carrito = req.session.carrito || [];
    const envio = req.session.envio || 'No seleccionado';
    const totalCantidad = carrito.reduce((total, producto) => total + producto.cantidad, 0);
    const totalPrecio = carrito.reduce((total, producto) => total + producto.precio * producto.cantidad, 0);
    res.json({ productos: carrito, envio: envio, totalCantidad: totalCantidad, totalPrecio: totalPrecio });
},
guardarCarrito :function(usuario_id, carrito, metodo_envio, callback) {
    const productos = carrito;
    for (let i = 0; i < productos.length; i++) {
        const producto_id = productos[i].id;
        const cantidad = productos[i].cantidad;
        const precio_total = productos[i].precio * cantidad;
        const sql = 'INSERT INTO carritos (usuario_id, producto_id, cantidad, precio_total, metodo_envio) VALUES (?, ?, ?, ?, ?)';
        connection.query(sql, [usuario_id, producto_id, cantidad, precio_total, metodo_envio], function(error, results) {
            if (error) throw error;
            callback(results);
        });
    }
},

modificarPorProveedor: function (req, res) {
    const proveedor = req.query.proveedor; // Obtén el proveedor de req.query
    producto.obtenerProductosPorProveedor(conexion, proveedor, function(error, productos) {
        if (error) {
            console.log('Error al obtener productos:', error);
        } else {
            res.render('modificarPorProveedor', { productos: productos, proveedor: proveedor });
        }
    });
},

actualizarPorProveedor: function (req, res) {
    let porcentajeCambio = req.body.porcentaje / 100;
    const tipoCambio = req.body.tipoCambio;
    const proveedor = req.body.proveedor; 

    // Si el tipo de cambio es un descuento, cambia el signo del porcentaje
    if (tipoCambio === 'descuento') {
        porcentajeCambio = -porcentajeCambio;
    }

    // Obtiene todos los productos del proveedor
    producto.obtenerProductosPorProveedor(conexion, proveedor, function(error, productos) {
        if (error) {
            console.log('Error al obtener productos:', error);
            return;
        }

        // Actualiza el precio de cada producto
        producto.actualizarPreciosPorProveedor(conexion, proveedor, porcentajeCambio, function(error, resultados) {
            if (error) {
                console.log('Error al actualizar precios:', error);
                return;
            }

            res.redirect('/productos/modificarPorProveedor?proveedor=' + proveedor);
        });
    });
}
}