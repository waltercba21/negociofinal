const conexion = require('../config/conexion')
const pool = require('../config/conexion');
const producto = require('../models/producto')
var borrar = require('fs');
const PDFDocument = require('pdfkit');
const blobStream  = require('blob-stream');
var streamBuffers = require('stream-buffers');

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
    lista: async function (req, res) {
        const pagina = req.query.pagina !== undefined ? Number(req.query.pagina) : 1;
        const categoria = req.query.categoria !== undefined ? Number(req.query.categoria) : undefined;
        const marca = req.query.marca !== undefined ? Number(req.query.marca) : undefined;
        const modelo = req.query.modelo !== undefined ? Number(req.query.modelo) : undefined;
    
        if ((marca !== undefined && isNaN(marca)) || (modelo !== undefined && isNaN(modelo))) {
            console.log('Error: marca o modelo no son números válidos');
            return res.redirect('/error');
        }
    
        try {
            let productos;
            const totalProductos = await new Promise((resolve, reject) => {
                producto.obtenerTotal(conexion, (error, resultados) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(resultados[0].total);
                    }
                });
            });
            let numeroDePaginas = Math.ceil(totalProductos / 30);
    
            if (categoria || marca || modelo) {  
                productos = await producto.obtenerPorFiltros(conexion, categoria, marca, modelo);
            } else {
                productos = await new Promise((resolve, reject) => {
                    producto.obtener(conexion, pagina, (error, resultados) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(resultados);
                        }
                    });
                });
          }
    
            const categorias = await producto.obtenerCategorias(conexion);
            const marcas = await new Promise((resolve, reject) => {
                producto.obtenerMarcas(conexion, (error, resultados) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(resultados);
                    }
                });
            });
    
            let modelosPorMarca;
            if (marca) {
                modelosPorMarca = await new Promise((resolve, reject) => {
                    producto.obtenerModelosPorMarca(conexion, marca, (error, resultados) => {
                        if (error) {
                            reject(error);
                        } else {
                            resolve(resultados);
                        }
                    });
                });
            }
    
            if (productos.length === 0) {
                console.log('No se encontraron productos para estos filtros');
            } else {
                console.log('Productos obtenidos:', productos);
                productos.forEach(producto => {
                    producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    const categoriaProducto = categorias.find(categoria => categoria.id === producto.categoria_id);
                    if (categoriaProducto) {
                        producto.categoria = categoriaProducto.nombre;
                    }
                });
            }
            res.render('productos', { productos, categorias, marcas, modelosPorMarca, numeroDePaginas, pagina, modelo });
        }  catch (error) {
            console.log('Error al obtener productos, categorías, marcas o modelos:', error);
            res.render('productos', { productos: [], categorias: [], marcas: [], modelosPorMarca: [], numeroDePaginas: 1, pagina, modelo });
        }
    },
    buscar: function (req, res) {
        const consulta = req.query.query;
        const categoria = req.query.categoria;
        const marca = req.query.marca;
        const modelo = req.query.modelo;
    
        if (consulta) {
            producto.obtenerPorNombre(conexion, consulta, (error, productos) => {
                if (error) {
                    res.status(500).send('Error interno del servidor');
                    return;
                }
                productos.forEach(producto => {
                    producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                });
                res.json({ productos });
            });
        } else if (categoria || marca || modelo) {
            producto.obtenerPorFiltros(conexion, categoria, marca, modelo, (error, productos) => {
                if (error) {
                    res.status(500).send('Error interno del servidor');
                    return;
                }
                productos.forEach(producto => {
                    producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                });
                res.json({ productos });
            });
        } else {
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
        }
    },
    detalle: function (req, res) {
        const id = req.params.id;
        producto.obtenerPorId(conexion, id, function(error, producto) {
          if (error) {
            console.log('Error al obtener producto:', error);
            return res.status(500).send('Error al obtener el producto');
          } else if (producto.length === 0) {
            // No se encontró ningún producto con el id proporcionado
            return res.status(404).send('Producto no encontrado');
          } else {
            res.render('detalle', { producto: producto[0] });
          }
        });
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
                conexion.query('DELETE FROM carritos WHERE producto_id=?', [req.params.id], function(error, resultados) {
                    if (error) {
                        console.error(error);
                        res.status(500).send('Error al eliminar las referencias al producto en el carrito');
                        return;
                    }
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
    calcularNumeroDePaginas: function() {
        return new Promise((resolve, reject) => {
            producto.contarProductos(conexion, function(error, resultado) {
                if (error) {
                    reject(error);
                } else {
                    const totalProductos = resultado[0].total; // obtiene el total de productos
                    const productosPorPagina = 10; // establece la cantidad de productos que quieres mostrar por página
                    const numeroDePaginas = Math.ceil(totalProductos / productosPorPagina);
                    resolve(numeroDePaginas);
                }
            });
        });
    },
    panelControl: (req, res) => { // Cambia "function" a "=>"
        producto.obtenerProveedores(conexion, function(error, proveedores) {
            if (error) {
                return res.status(500).send('Error al obtener proveedores: ' + error.message);
            }
            producto.obtenerCategorias(conexion)
                .then(categorias => {
                    const proveedorSeleccionado = req.body.proveedor; // o req.query.proveedor
                    const categoriaSeleccionada = req.body.categoria; // o req.query.categoria
                    this.calcularNumeroDePaginas() // "this" se refiere al objeto que contiene "panelControl"
                        .then(numeroDePaginas => {
                            res.render('panelControl', { proveedores: proveedores, proveedorSeleccionado: proveedorSeleccionado, categorias: categorias, categoriaSeleccionada: categoriaSeleccionada, numeroDePaginas: numeroDePaginas });
                        })
                        .catch(error => {
                            return res.status(500).send('Error al calcular el número de páginas: ' + error.message);
                        });
                })
                .catch(error => {
                    return res.status(500).send('Error al obtener categorías: ' + error.message);
                });
        });
    },
buscarPorNombre: function (req, res) {
    const consulta = req.query.query; 
    if (!consulta) {
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
      producto.obtenerPorNombre(conexion, consulta, (error, productos) => {
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
            // Obtener los datos del usuario
            conexion.query('SELECT * FROM usuarios WHERE id = ?', [usuarioId], function (error, usuarios) {
                if (error) {
                    console.log('Error al recuperar los datos del usuario:', error);
                    return;
                }
                // Asegúrate de que se encontró al usuario
                if (usuarios.length > 0) {
                    var usuario = usuarios[0];
                    // Renderizar la vista con los productos y los datos del usuario
                    res.render('carrito', { productos: productosEnCarrito, usuario: usuario });
                } else {
                    console.log('No se encontró al usuario con id:', usuarioId);
                }
            });
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
    if (tipoCambio === 'descuento') {
        porcentajeCambio = -porcentajeCambio;
    }
    producto.actualizarPreciosPorProveedor(pool,proveedorId, porcentajeCambio, function(err) {
        if (err) {
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
    producto.obtenerModelosPorMarca(conexion, marcaId, function(error, modelos) {
        if (error) {
            console.log('Error al obtener modelos:', error);
            return;
        }
        res.json(modelos);
    });
},
generarPDF: function (req, res) {
    
    var doc = new PDFDocument;
    
    var buffer = new streamBuffers.WritableStreamBuffer({
        initialSize: (1024 * 1024),   
        incrementAmount: (1024 * 1024) 
    });
    doc.pipe(buffer);
    // Obtener el ID del proveedor y la categoría de los parámetros de consulta
    const proveedorId = req.query.proveedor; 
    const categoriaId = req.query.categoria;
    if (!proveedorId) {
        return res.status(400).send('No se ha proporcionado un ID de proveedor');
    }

    // Obtener el nombre del proveedor
    producto.obtenerProveedores(conexion, function(error, proveedores) {
        if (error) { 
            console.log('Error al obtener proveedores:', error);
            return res.status(500).send('Error al generar el PDF');
        }

        var proveedor = proveedores.find(p => p.id == proveedorId);
        if (!proveedor) {
            return res.status(400).send('Proveedor no encontrado');
        }

        var nombreProveedor = proveedor.nombre;

        // Título
        doc.fontSize(20)
           .text(nombreProveedor, 0, 50, {
               align: 'center',
               width: doc.page.width
           });

        // Obtener el nombre de la categoría
        producto.obtenerCategorias(conexion, function(error, categorias) {
            if (error) {
                console.log('Error al obtener categorías:', error);
                return res.status(500).send('Error al generar el PDF');
            }

            var categoria = categorias.find(c => c.id == categoriaId);
            if (!categoria) {
                return res.status(400).send('Categoría no encontrada');
            }

            var nombreCategoria = categoria.nombre;

            // Subtítulo
            doc.fontSize(16)
               .text(nombreCategoria, 0, doc.y, {
                   align: 'center',
                   width: doc.page.width
               });

            doc.moveDown(2); // Agrega espacio debajo del subtítulo

            // Obtener los productos por proveedor y categoría
            producto.obtenerProductosPorProveedorYCategoría(conexion, proveedorId, categoriaId, function(error, productos) {
                if (error) {
                    console.log('Error al obtener productos:', error);
                    return res.status(500).send('Error al generar el PDF');
                }
                // Agregar los productos al PDF
                productos.forEach(producto => {
                    var precioFormateado = '$' + parseFloat(producto.precio).toFixed(0);
                    // Guardar la posición actual del cursor
                    var currentY = doc.y;
                    // Verificar si hay suficiente espacio en la página actual
                    if (currentY + 20 > doc.page.height - doc.page.margins.bottom) {
                        doc.addPage();
                    }
                    // Escribir el nombre del producto
                    doc.fontSize(10)
                       .text(producto.nombre, 50, doc.y);
                    // Escribir el precio en la misma línea
                    doc.text(precioFormateado, doc.page.width - 150, doc.y, {
                           align: 'right'
                       });
                    doc.moveDown();
                });
                // Finalizar el documento PDF
                doc.end();
            });
        });
    });
    buffer.on('finish', function() {
        const pdfData = buffer.getContents();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=productos.pdf');
        res.send(pdfData);
    });
},
getProductosPorCategoria : async (req, res) => {
    const categoriaId = req.query.categoria;
    producto.obtenerPorCategoria(categoriaId, (error, productos) => {
      if (error) {
        res.status(500).send(error);
      } else {
        res.render('productos', { productos });
      }
    });
  },

}