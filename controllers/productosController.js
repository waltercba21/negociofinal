const conexion = require('../config/conexion')
const pool = require('../config/conexion');
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
        const categoriaQuery = req.query.categoria;
        var saltar = 0;
        if (categoriaQuery) {
            producto.obtenerIdPorCategoria(conexion, categoriaQuery, function (error, categoria_id) {
                if (error) {
                    console.log('Error al obtener id de la categoría:', error);
                } else {
                    producto.obtenerPorCategoria(conexion, categoria_id, function (error, productos) {
                        if (error) {
                            console.log('Error al obtener productos:', error);
                        } else {
                            if (productos.length === 0) {
                                console.log('No se encontraron productos para esta categoría');
                            } else {
                                productos.forEach(producto => {
                                    producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                                });
                                console.log('Productos obtenidos:', productos);
                                // Obtener categorías, marcas y modelos
                                const categoriasPromise = new Promise((resolve, reject) => {
                                    producto.obtenerCategorias(conexion, (error, categorias) => {
                                        if (error) reject(error);
                                        else resolve(categorias);
                                    });
                                });
                                const marcasPromise = new Promise((resolve, reject) => {
                                    producto.obtenerMarcas(conexion, (error, marcas) => {
                                        if (error) reject(error);
                                        else resolve(marcas);
                                    });
                                });
                                const modelosPromise = new Promise((resolve, reject) => {
                                    producto.obtenerModelosPorMarca(conexion, req.params.marcaId, (error, modelos) => {
                                        if (error) reject(error);
                                        else resolve(modelos);
                                    });
                                });
    
                                let modelosPorMarca = []; // Inicializar modelosPorMarca con un array vacío

                                Promise.all([categoriasPromise, marcasPromise, modelosPromise])
                                .then(([categorias, marcas, modelos]) => {
                                    // Renderizar la vista con los productos, categorías, marcas y modelos
                                    res.render('productos', { productos, categorias, marcas, modelosPorMarca: modelos });
                                })
                                .catch(error => {
                                    console.log('Error al obtener categorías, marcas o modelos:', error);
                                });
                            }
                        }
                    });
                }
            });
        } else {
            producto.obtener(conexion, saltar, function (error, productos) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                } else {
                    // Formatear el precio de cada producto
                    productos.forEach(producto => {
                        producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    });
    
                    // Obtener categorías, marcas y modelos
                    const categoriasPromise = new Promise((resolve, reject) => {
                        producto.obtenerCategorias(conexion, (error, categorias) => {
                            if (error) reject(error);
                            else resolve(categorias);
                        });
                    });
                    const marcasPromise = new Promise((resolve, reject) => {
                        producto.obtenerMarcas(conexion, (error, marcas) => {
                            if (error) reject(error);
                            else resolve(marcas);
                        });
                    });
                    const modelosPromise = new Promise((resolve, reject) => {
                        producto.obtenerModelosPorMarca(conexion, req.params.marcaId, (error, modelos) => {
                            if (error) reject(error);
                            else resolve(modelos);
                        });
                    });
    
                    Promise.all([categoriasPromise, marcasPromise, modelosPromise])
                        .then(([categorias, marcas, modelos]) => {
                            // Renderizar la vista con los productos, categorías, marcas y modelos
                            res.render('productos', { productos, categorias, marcas, modelos });
                        })
                        .catch(error => {
                            console.log('Error al obtener categorías, marcas o modelos:', error);
                        });
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
                                res.render('crear', { categorias: categorias, marcas: marcas, proveedores: proveedores, modelosPorMarca: modelosPorMarca, producto: {} });
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
        producto.retornarDatosId(conexion,req.params.id,function (error, productoResult){
            if (error) {
                console.error("Error al obtener los datos del producto:", error);
                res.status(500).send("Error al obtener el producto");
                return;
            }
            console.log("Producto seleccionado para editar: ", productoResult[0]);
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
                        producto.obtenerModelosPorMarca(conexion, productoResult[0].marca_id, function(error, modelos) {
                            if (error) {
                                console.log('Error al obtener modelos:', error);
                                return;
                            }
                            // Renderiza tu vista pasando los datos
                            res.render('editar', { producto: productoResult[0], categorias: categorias, marcas: marcas, proveedores: proveedores, modelos: modelos });
                        });
                    });
                });
            });
        });
    },
    actualizar: function (req, res) {
        if (!req.body.categoria_id || !req.body.marca_id || !req.body.proveedor_id) {
            res.status(400).send('Los datos del producto deben incluir un ID de categoría, un ID de marca y un ID de proveedor');
            return;
        }
        if(req.file && req.file.filename){
            producto.retornarDatosId(conexion,req.body.id,function (error, registros){
                if (error) {
                    console.error("Error al obtener los datos del producto:", error);
                    res.status(500).send("Error al actualizar el producto");
                    return;
                }
                var nombreImagen = '/public/images/' + (registros[0].imagen);
                if(borrar.existsSync(nombreImagen)){
                    borrar.unlinkSync(nombreImagen);
                }
                producto.actualizarArchivo(conexion,req.body, req.file, function (error){
                    if (error) {
                        res.status(500).send("Error al actualizar el producto");
                        return;
                    }
                    if(req.body.nombre){
                        producto.actualizar(conexion,req.body, req.file, function(error){
                            if (error) {
                                console.error("Error al actualizar el producto:", error);
                                res.status(500).send("Error al actualizar el producto");
                                return;
                            }
                            req.session.save(function(err) {
                                res.redirect('/productos/panelControl?pagina=' + req.session.paginaActual + '&proveedor=' + req.session.proveedorActual);
                            });
                        });
                    } else {
                        req.session.save(function(err) {
                            res.redirect('/productos/panelControl?pagina=' + req.session.paginaActual + '&proveedor=' + req.session.proveedorActual);
                        });
                    }
                });
            });
        } else if(req.body.nombre){
            producto.actualizar(conexion,req.body, req.file, function(error){
                if (error) {
                    res.status(500).send("Error al actualizar el producto");
                    return;
                }
                req.session.save(function(err) {
                    res.redirect('/productos/panelControl?pagina=' + req.session.paginaActual + '&proveedor=' + req.session.proveedorActual);
                });
            });
        } else {
            req.session.save(function(err) {
                res.redirect('/productos/panelControl?pagina=' + req.session.paginaActual + '&proveedor=' + req.session.proveedorActual);
            });
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
    var proveedor = req.query.proveedor ? Number(req.query.proveedor) : null;
    req.session.proveedorActual = proveedor;
    var pagina = req.query.pagina || 1;
    req.session.paginaActual = pagina;
    req.session.save(function(err) {
        if(err) {
            res.status(500).send("Error al guardar la sesión");
            return;
        }
        var proveedor = req.query.proveedor ? Number(req.query.proveedor) : null;
        var categoria = req.query.categoria ? Number(req.query.categoria) : null;
        var productosPorPagina = 20;
        var saltar = (pagina - 1) * productosPorPagina;
    
        var obtenerProductos = producto.obtenerTodos; 
        var contarProductos = producto.contarTodos; 
        var parametroObtenerProductos = null;
        var parametroContarProductos = null;

        if (categoria) {
            obtenerProductos = (conexion, saltar, parametro, callback) => producto.obtenerPorCategoria(conexion, parametro, callback);
            contarProductos = (conexion, parametro, callback) => producto.contarPorCategoria(conexion, parametro, callback);
            parametroObtenerProductos = parametroContarProductos = categoria;
        }
        if (proveedor) {
            obtenerProductos = (conexion, saltar, parametro, callback) => producto.obtenerProductosPorProveedor(conexion, parametro, saltar, callback);
            contarProductos = (conexion, parametro, callback) => producto.contarPorProveedor(conexion, parametro, callback);
            parametroObtenerProductos = parametroContarProductos = proveedor;
        }

        producto.obtenerProveedores(conexion, function(error, proveedoresResult) {
            if (error) {
                console.log('Error al obtener proveedores:', error);
                return;
            }
            producto.obtenerCategorias(conexion, function(error, categoriasResult) {
                if (error) {
                    console.log('Error al obtener categorias:', error);
                    return;
                }
                obtenerProductos(conexion, saltar, parametroObtenerProductos, function (error, productosResult) {
                    if (error) {
                        console.log('Error al obtener productos:', error);
                        return;
                    }
                    productosResult.forEach(producto => {
                        producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    });
                    contarProductos(conexion, parametroContarProductos, function(error, resultado) {
                        if (error) {
                            console.log('Error al contar productos:', error);
                            return;
                        }
                        var totalProductos = resultado.length > 0 ? resultado[0].total : 0;
                        res.render('panelControl', { 
                            title: 'Productos', 
                            productos: productosResult, 
                            totalProductos: totalProductos, 
                            productosPorPagina: productosPorPagina, 
                            proveedor: proveedor,
                            proveedores: proveedoresResult,
                            proveedorSeleccionado: proveedor,
                            categorias: categoriasResult,
                            categoriaSeleccionada: categoria
                        });
                    });
                });
            });
        });
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
            productos.forEach(producto => {
                producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
            });
            res.json({ productos });
        });
    } else {
        producto.obtenerPorNombre(conexion, nombre, (error, productos) => {
          if (error) {
            res.status(500).send('Error interno del servidor');
            return;
          }
          productos.forEach(producto => {
              producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
          });
          res.json({ productos });
        });
    }   
},
buscarProductos : async (req, res) => {
    try {
      const consulta = req.query.query;
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
    let proveedorId = req.query.proveedor; 
    producto.obtenerProveedores(conexion, function(error, proveedores) {
        if (error) {
            console.log('Error al obtener proveedores:', error);
            return;
        }
        let proveedor = null;
        let productos = [];
        if (proveedorId) {
            // Encuentra el proveedor con el proveedorId
            proveedor = proveedores.find(proveedor => proveedor.id == proveedorId);
            if (!proveedor) {
                console.log('No se encontró el proveedor:', proveedorId);
                return;
            }
            producto.obtenerProductosPorProveedor(conexion, proveedorId, 0, function(error, productosResult) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                    return;
                }
                productos = productosResult;
res.render('modificarPorProveedor', { proveedor: proveedor, proveedores: proveedores, productos: productos, proveedorSeleccionado: proveedorId });
            });
        } else {
res.render('modificarPorProveedor', { proveedor: proveedor, proveedores: proveedores, productos: productos, proveedorSeleccionado: proveedorId });
        }
    });
},
actualizarPorProveedor : function(req, res) {
    let proveedorId = req.body.proveedor;
    let porcentajeCambio = Number(req.body.porcentaje) / 100;
    let tipoCambio = req.body.tipoCambio;

    // Verificar si el tipo de cambio es un descuento y, de ser así, convertir el porcentaje de cambio en un número negativo
    if (tipoCambio === 'descuento') {
        porcentajeCambio = -porcentajeCambio;
    }

    // Llamar al método del modelo para actualizar los precios
    producto.actualizarPreciosPorProveedor(pool,proveedorId, porcentajeCambio, function(err) {
        if (err) {
            // Manejar el error como prefieras
            console.error(err);
            res.redirect('/productos/panelControl?error=Hubo un error al actualizar los precios');
        } else {
            res.redirect('/productos/panelControl?success=Los precios se actualizaron correctamente');
        }
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