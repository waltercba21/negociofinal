const conexion = require('../config/conexion')
const producto = require('../models/producto')
var borrar = require('fs');
const PDFDocument = require('pdfkit');
const blobStream  = require('blob-stream');
var streamBuffers = require('stream-buffers');

function calcularNumeroDePaginas(conexion) {
    return new Promise((resolve, reject) => {
        producto.contarProductos(conexion, (error, resultado) => {
            if (error) {
                reject(error);
            } else {
                const numeroDePaginas = Math.ceil(resultado[0].total / 10);
                resolve(numeroDePaginas);
            }
        });
    });
}

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
                        console.error('Error al obtener el total de productos:', error);
                        reject(error);
                    } else {
                        resolve(resultados[0].total);
                    }
                });
            });
            let numeroDePaginas = Math.ceil(totalProductos / 30);
    
            if (categoria || marca || modelo) {  
                productos = await new Promise((resolve, reject) => {
                    if (categoria) {
                        producto.obtenerProductosPorCategoria(conexion, categoria, (error, resultados) => {
                            if (error) {
                                console.error('Error al obtener productos por categoría:', error);
                                reject(error);
                            } else {
                                resolve(resultados);
                            }
                        });
                    } else {
                        // Solo pasa categoria si no es undefined
                        producto.obtenerPorFiltros(conexion, categoria !== undefined ? categoria : null, marca, modelo, (error, resultados) => {
                            if (error) {
                                console.error('Error al obtener productos por filtros:', error);
                                reject(error);
                            } else {
                                resolve(resultados);
                            }
                        });
                    }
                });
            } else {
                productos = await new Promise((resolve, reject) => {
                    producto.obtener(conexion, pagina, (error, resultados) => {
                        if (error) {
                            console.error('Error al obtener productos:', error);
                            reject(error);
                        } else {
                            resolve(resultados);
                        }
                    });
                });
            }
            const categorias = await producto.obtenerCategorias(conexion);
            console.log('Categorías obtenidas:', categorias);
    
            const marcas = await producto.obtenerMarcas(conexion);
            console.log('Marcas obtenidas:', marcas);
    
            let modelosPorMarca;
            if (marca) {
                modelosPorMarca = await producto.obtenerModelosPorMarca(conexion, marca);
            }
    
            let modeloSeleccionado;
            if (modelo && modelosPorMarca) {
                modeloSeleccionado = modelosPorMarca.find(m => m.id === modelo);
            }
    
            if (productos.length === 0) {
                console.log('No se encontraron productos para estos filtros');
            } else {
                productos.forEach(producto => {
                    producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    const categoriaProducto = categorias.find(categoria => categoria.id === producto.categoria_id);
                    if (categoriaProducto) {
                        producto.categoria = categoriaProducto.nombre;
                    }
                });
            }
            res.render('productos', { productos, categorias, marcas, modelosPorMarca, numeroDePaginas, pagina, modelo: modeloSeleccionado });
        }  catch (error) {
            console.error('Error al obtener productos, categorías, marcas o modelos:', error);
            res.render('productos', { productos: [], categorias: [], marcas: [], modelosPorMarca: [], numeroDePaginas: 1, pagina, modelo });
        }
    },
    buscar: function (req, res) {
        const consulta = req.query.query;
        const categoria = req.query.categoria ? Number(req.query.categoria) : null;
        const marca = req.query.marca ? Number(req.query.marca) : null;
        const modelo = req.query.modelo ? Number(req.query.modelo) : null;
    
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
            producto.obtenerPorFiltros(conexion, categoria, marca, modelo)
                .then(productos => {
                    productos.forEach(producto => {
                        producto.precio = parseFloat(producto.precio).toLocaleString('de-DE');
                    });
                    res.json({ productos });
                })
                .catch(error => {
                    console.error(error);
                    res.status(500).send('Error interno del servidor');
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
        let categorias, marcas, modelos, proveedores;
    
        // Obtén las categorías
        producto.obtenerCategorias(conexion).then(result => {
            categorias = result;
    
            // Obtén las marcas
            return producto.obtenerMarcas(conexion);
        }).then(result => {
            marcas = result;
    
            // Obtén los modelos
            return producto.obtenerModelosPorMarca(conexion);
        }).then(result => {
            modelos = result;
    
            // Obtén los proveedores
            return producto.obtenerProveedores(conexion);
        }).then(result => {
            proveedores = result;
    
            // Renderiza la vista con los datos obtenidos
            res.render('crear', {
                categorias: categorias,
                marcas: marcas,
                modelos: modelos,
                proveedores: proveedores,
                producto: {}, // Añade un objeto producto vacío aquí
                modelosPorMarca: [] // Añade un array modelosPorMarca vacío aquí
            });
        }).catch(error => {
            return res.status(500).send('Error: ' + error.message);
        });
    },
      guardar: function(req, res) {
        const datos = req.body;
        if (!datos.nombre || !datos.precio || !datos.utilidad) {
          return res.status(400).send('Faltan datos del producto');
        }
        let precioProveedorMasBarato = Math.min(...datos.precio); 
        datos.precioFinal = precioProveedorMasBarato + (precioProveedorMasBarato * (datos.utilidad / 100));
        datos.precioFinal = parseFloat(datos.precioFinal.toFixed(2)); 
    
        // Agregar cálculo del precio de costo
        if (datos.descuento) {
          datos.precioCosto = precioProveedorMasBarato - (precioProveedorMasBarato * (datos.descuento / 100));
          datos.precioCosto = parseFloat(datos.precioCosto.toFixed(2));
        }
    
        if (!req.file) {
          return res.status(400).send('No se proporcionó un archivo');
        }
        let archivo = req.file;
        producto.insertar(conexion, datos, archivo, function(error, result) {
          if (error) {
            return res.status(500).send('Error al guardar producto: ' + error.message);
          } else {
            // Aquí insertamos en la tabla producto_proveedor
            producto.insertarProductoProveedor(conexion, result.insertId, datos.proveedor, datos.precio, datos.codigo, function(error, result) {
              if (error) {
                return res.status(500).send('Error al guardar en producto_proveedor: ' + error.message);
              } else {
                res.redirect('/productos');
              }
            });
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
    editar : async function (req, res) { 
        try {
            let productoResult = await producto.retornarDatosId(conexion, req.params.id);
            if (!productoResult[0]) {
                console.error("No se encontró el producto con el id:", req.params.id);
                res.status(404).send("No se encontró el producto");
                return;
            }
            let categorias = await producto.obtenerCategorias(conexion);
            let proveedores = await producto.obtenerProveedores(conexion);
            let marcas = await producto.obtenerMarcas(conexion);
            let modelos = await producto.obtenerModelosPorMarca(conexion, productoResult[0].marcaId); // Asegúrate de tener una función obtenerModelos en tu modelo
            res.render('editar', { 
                producto: productoResult[0],
                categorias: categorias,
                proveedores: proveedores,
                marcas: marcas,
                modelos: modelos // Pasa los modelos a la vista
            });
        } catch (error) {
            console.error("Error al obtener los datos:", error);
            res.status(500).send("Error al obtener los datos");
        }
    },
    actualizar: function (req, res) {
        console.log('Iniciando la actualización del producto');
    
        producto.retornarDatosId(conexion,req.params.id)
            .then(registros => {
                if (registros.length === 0) {
                    console.error("No se encontró ningún producto con el ID proporcionado");
                    res.status(404).send("No se encontró ningún producto con el ID proporcionado");
                    return;
                }
    
                console.log('Datos del producto obtenidos correctamente');
    
                // Agrega el ID del producto a req.body
                req.body.id = req.params.id;
    
                if(req.file && req.file.filename){
                    console.log('Archivo presente');
                    var nombreImagen = '/public/images/' + (registros[0].imagen);
                    if(borrar.existsSync(nombreImagen)){
                        console.log('Borrando imagen existente');
                        borrar.unlinkSync(nombreImagen);
                    }
    
                    producto.actualizarArchivo(conexion,req.body, req.file, function (error){
                        if (error) {
                            console.error("Error al actualizar el archivo del producto:", error);
                            res.status(500).send("Error al actualizar el producto");
                            return;
                        }
    
                        console.log('Archivo del producto actualizado correctamente');
                    });
                }
    
                producto.actualizar(conexion,req.body, req.file, function(error){
                    if (error) {
                        console.error("Error al actualizar el producto:", error);
                        res.status(500).send("Error al actualizar el producto");
                        return;
                    }
    
                    console.log('Producto actualizado correctamente');
    
                    req.session.save(function(err) {
                        console.log('Redirigiendo a panel de control');
                        res.redirect('/productos/panelControl?pagina=' + req.session.paginaActual + '&proveedor=' + req.session.proveedorActual);
                    });
                });
            });
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
    panelControl: async function(req, res) {
        try {
            let proveedores = await producto.obtenerProveedores(conexion);
            let categorias = await producto.obtenerCategorias(conexion);
            const proveedorSeleccionado = req.query.proveedor;
            const categoriaSeleccionada = req.query.categoria;
            let paginaActual = req.query.pagina ? Number(req.query.pagina) : 1;
            if (isNaN(paginaActual) || paginaActual < 1) {
                paginaActual = 1;
            }
            const productosPorPagina = 10;
            const saltar = (paginaActual - 1) * productosPorPagina;
            console.log('Proveedor seleccionado:', proveedorSeleccionado);
            console.log('Categoría seleccionada:', categoriaSeleccionada);
            let numeroDePaginas = await calcularNumeroDePaginas(conexion);
            console.log('Número de páginas:', numeroDePaginas);
            let productos = await producto.obtenerTodos(conexion, saltar, categoriaSeleccionada);
            console.log('Productos:', productos);
            res.render('panelControl', { proveedores: proveedores, proveedorSeleccionado: proveedorSeleccionado, categorias: categorias, categoriaSeleccionada: categoriaSeleccionada, numeroDePaginas: numeroDePaginas, productos: productos, paginaActual: paginaActual });
        } catch (error) {
            console.log('Error:', error);
            return res.status(500).send('Error: ' + error.message);
        }
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
modificarPorProveedor: async function (req, res) {
    try {
        let proveedores = await producto.obtenerProveedores(conexion);
        let productos = [];
        let proveedor = {};

        if (req.query.proveedor) {
            proveedor = proveedores.find(p => p.id == req.query.proveedor);
            productos = await producto.obtenerProductosPorProveedor(conexion, req.query.proveedor);
        }

        res.render('modificarPorProveedor', { proveedores: proveedores, productos: productos, proveedor: proveedor });
    } catch (error) {
        console.error(error);
        res.status(500).send('Hubo un error al obtener los datos');
    }
},
actualizarPorProveedor : function(req, res) {
    let proveedorId = req.body.proveedor;
    let porcentajeCambio = Number(req.body.porcentaje) / 100;
    let tipoCambio = req.body.tipoCambio;
    if (tipoCambio === 'descuento') {
        porcentajeCambio = -porcentajeCambio;
    }
    producto.actualizarPreciosPorProveedor( proveedorId, porcentajeCambio, function(err) {
        if (err) {
            console.error(err);
            res.redirect('/productos/panelControl?error=Hubo un error al actualizar los precios');
        } else {
            // Redirige a la vista de los productos del proveedor que se acaba de actualizar
            res.redirect('/productos/modificarPorProveedor?proveedor=' + proveedorId);
        }
    });
},
actualizarPrecio: function(req, res) {
    let idProducto = req.body.id;
    let nuevoPrecio = req.body.precio;
    let proveedorId = req.body.proveedor; // Asegúrate de que este valor se envía en el formulario
    producto.actualizarPrecio(idProducto, nuevoPrecio, function(err) {
        if (err) {
            console.error(err);
            res.redirect('/productos/modificarPorProveedor?error=Hubo un error al actualizar el precio');
        } else {
            // Redirige a la vista de los productos del proveedor que se acaba de actualizar
            res.redirect('/productos/modificarPorProveedor?proveedor=' + proveedorId);
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
    producto.obtenerModelosPorMarca(conexion, marcaId)
      .then(modelos => {
        res.json(modelos);
      })
      .catch(error => {
        console.log('Error al obtener modelos:', error);
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
    producto.obtenerProductosPorCategoria(categoriaId, (error, productos) => {
      if (error) {
        res.status(500).send(error);
      } else {
        res.render('productos', { productos });
      }
    });
  },

}