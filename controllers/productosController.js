const conexion = require('../config/conexion')
const producto = require('../models/producto')
var borrar = require('fs');

module.exports = {
    index : function (req,res){
        producto.obtenerUltimos(conexion, 3, function(error, productos) {
            if (error) {
                console.log('Error al obtener productos:', error);
                return res.status(500).send('Error al obtener los productos');
            } else {
                res.render('index', { productos: productos });
            }
        });
    },
    lista: function (req, res) {
        const categoria = req.query.categoria;
        var saltar = 0; // Añade esta línea
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
            producto.obtener(conexion, saltar, function (error, productos) { // Modifica esta línea
                if (error) {
                    console.log('Error al obtener productos:', error);
                } else {
                    // Formatear el precio de cada producto
                    productos.forEach(producto => {
                        producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    });
    
                    res.render('productos', { productos: productos });
                }
            });
        }
    },
    crear: function(req, res) {
        producto.obtenerCategorias(conexion, function(error, categorias) {
            if (error) {
                console.log('Error al obtener categorías:', error);
                return;
            }
            producto.obtenerProveedores(conexion, function(error, proveedores) {
                if (error) {
                    console.log('Error al obtener proveedores:', error);
                    return;
                }
                producto.obtenerMarcas(conexion, function(error, marcas) {
                    if (error) {
                        console.log('Error al obtener marcas:', error);
                        return;
                    }
                    let modelosPorMarca = {};
                    let contadorMarcas = 0;
                    marcas.forEach((marca) => {
                        producto.obtenerModelosPorMarca(conexion, marca.id, function(error, modelos) {
                            if (error) {
                                console.log('Error al obtener modelos:', error);
                                return;
                            }
                            modelosPorMarca[marca.id] = modelos;
                            contadorMarcas++;
                            if (contadorMarcas === marcas.length) {
                                // Renderiza tu vista pasando los datos
                                res.render('crear', { categorias: categorias, marcas: marcas, proveedores: proveedores, modelosPorMarca: modelosPorMarca });
                            }
                        });
                    });
                });
            });
        });
    },
    guardar: function(req, res) {
        const datos = req.body;
        if (!datos.nombre || !datos.precio) {
            return res.status(400).send('Faltan datos del producto');
        }
    
        datos.precio = parseFloat(datos.precio);
    
        if (!req.file) {
            return res.status(400).send('No se proporcionó un archivo');
        }
    
        // Asegúrate de que 'archivo' es un archivo
        let archivo = req.file;
    

        producto.insertar(conexion, datos, archivo, function(error, result) {
            if (error) {
                return res.status(500).send('Error al guardar producto: ' + error.message);
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
            if (error) {
                console.error("Error al obtener los datos del producto:", error);
                res.status(500).send("Error al obtener el producto");
                return;
            }
            console.log("Producto seleccionado para editar: ", registros[0]);
            res.render('editar', {producto: registros[0]});
        });
    }, 
    actualizar: function (req, res) {
        console.log('Iniciando la actualización del producto...');
        if(req.file && req.file.filename){
            console.log('Archivo recibido, obteniendo datos del producto...');
            producto.retornarDatosId(conexion,req.body.id,function (error, registros){
                if (error) {
                    console.error("Error al obtener los datos del producto:", error);
                    res.status(500).send("Error al actualizar el producto");
                    return;
                }
    
                console.log('Datos del producto obtenidos, borrando imagen existente...');
                var nombreImagen = '/public/images/' + (registros[0].imagen);
                if(borrar.existsSync(nombreImagen)){
                    borrar.unlinkSync(nombreImagen);
                }
    
                console.log('Imagen existente borrada, actualizando archivo...');
                producto.actualizarArchivo(conexion,req.body, req.file, function (error){
                    if (error) {
                        console.error("Error al actualizar el archivo del producto:", error);
                        res.status(500).send("Error al actualizar el producto");
                        return;
                    }
    
                    if(req.body.nombre){
                        console.log('Nombre recibido, actualizando producto...');
                        producto.actualizar(conexion,req.body, req.file, function(error){
                            if (error) {
                                console.error("Error al actualizar el producto:", error);
                                res.status(500).send("Error al actualizar el producto");
                                return;
                            }
    
                            console.log('Producto actualizado, redirigiendo...');
                            res.redirect('/productos');
                        });
                    } else {
                        console.log('No se recibió nombre, redirigiendo...');
                        res.redirect('/productos');
                    }
                });
            });
        } else if(req.body.nombre){
            console.log('No se recibió archivo pero se recibió nombre, actualizando producto...');
            producto.actualizar(conexion,req.body, req.file, function(error){
                if (error) {
                    console.error("Error al actualizar el producto:", error);
                    res.status(500).send("Error al actualizar el producto");
                    return;
                }
    
                console.log('Producto actualizado, redirigiendo...');
                res.redirect('/productos');
            });
        } else {
            console.log('No se recibió archivo ni nombre, redirigiendo...');
            res.redirect('/productos');
        }
    },
ultimos: function(req, res) {
    producto.obtenerUltimos(conexion, 3, function(error, productos) {
        if (error) {
            return res.status(500).send('Error al obtener los productos');
        } else {
            productos.forEach(producto => {
                producto.precio = parseFloat(producto.precio).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
            });
            res.json(productos);
        }
    });
},
panelControl: function (req, res) {
    var pagina = req.query.pagina || 1;
    var proveedor = req.query.proveedor; 
    var productosPorPagina = 20;
    var saltar = (pagina - 1) * productosPorPagina;
  
    var obtenerProductos = proveedor ? producto.obtenerProductosPorProveedor : producto.obtener;
    var contarProductos = proveedor ? producto.contarPorProveedor : producto.contar;
  
    producto.obtenerProveedores(conexion, function(error, proveedores) {
        if (error) {
            console.log('Error al obtener proveedores:', error);
        } else {
            if (proveedor) {
                obtenerProductos(conexion, proveedor, function (error, productos) {
                    manejarProductos(error, productos, proveedores);
                });
            } else {
                obtenerProductos(conexion, saltar, function (error, productos) {
                    manejarProductos(error, productos, proveedores);
                });
            }
        }
    });

    function manejarProductos(error, productos, proveedores) {
        if (error) {
            console.log('Error al obtener productos:', error);
        } else {
            productos.forEach(producto => {
                producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
            });
  
            function manejarConteo(error, resultado) {
                if (error) {
                    console.log('Error al contar productos:', error);
                } else {
                    var totalProductos = resultado[0].total;
                    res.render('panelControl', { 
                        title: 'Productos', 
                        productos: productos, 
                        totalProductos: totalProductos, 
                        productosPorPagina: productosPorPagina, 
                        proveedor: proveedor,
                        proveedores: proveedores,
                        proveedorSeleccionado: proveedor, 
                    });
                }
            }

            if (proveedor) {
                contarProductos(conexion, proveedor, function(error, resultado) {
                    manejarConteo(error, resultado);
                });
            } else {
                contarProductos(conexion, function(error, resultado) {
                    manejarConteo(error, resultado);
                });
            }
        }
    }
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
buscarProductos : async (req, res) => {
    try {
      // Obtiene la consulta de búsqueda de la URL
      const consulta = req.query.query;
  
      // Busca productos que coincidan con la consulta
      const productos = await producto.findAll({
        where: {
          nombre: {
            [Op.iLike]: '%' + consulta + '%'
          }
        }
      });
      res.json(productos);
    } catch (error) {
      console.error('Hubo un problema con la búsqueda de productos:', error);
      res.status(500).send('Hubo un problema con la búsqueda de productos');
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
        } else {
            const index = req.session.carrito.findIndex(producto => producto.id === carritoId);
            if (index !== -1) {
                req.session.carrito.splice(index, 1);
            }
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
    const proveedor = req.query.proveedor; 
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
    if (tipoCambio === 'descuento') {
        porcentajeCambio = -porcentajeCambio;
    }
    producto.obtenerProductosPorProveedor(conexion, proveedor, function(error, productos) {
        if (error) {
            console.log('Error al obtener productos:', error);
            return;
        }
        producto.actualizarPreciosPorProveedor(conexion, proveedor, porcentajeCambio, function(error, resultados) {
            if (error) {
                console.log('Error al actualizar precios:', error);
                return;
            }
            res.redirect('/productos/modificarPorProveedor?proveedor=' + proveedor);
        });
    });
},
obtenerProveedores: function(req, res) {
    producto.obtenerProveedores(conexion, function(error, proveedores) {
        if (error) {
            console.log('Error al obtener proveedores:', error);
            return;
        }
        res.render('crear', { proveedores: proveedores });
    });
},
obtenerModelosPorMarca: function(req, res) {
    var marcaId = req.params.marcaId;
    // Aquí debes llamar a la función que obtiene los modelos de la base de datos
    producto.obtenerModelosPorMarca(conexion, marcaId, function(error, modelos) {
        if (error) {
            console.log('Error al obtener modelos:', error);
            return;
        }
        // Devuelve los modelos como JSON
        res.json(modelos);
    });
}
}