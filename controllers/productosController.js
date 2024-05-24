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
            let numeroDePaginas = Math.ceil(totalProductos / 20);
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
            const marcas = await producto.obtenerMarcas(conexion);
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
                const productoIds = productos.map(producto => producto.id);
                const todasLasImagenesPromesas = productoIds.map(id => producto.obtenerImagenesProducto(conexion, id));
                const todasLasImagenes = (await Promise.all(todasLasImagenesPromesas)).flat();
                for (let producto of productos) {
                    console.log('Precio antes de la conversión:', producto.precio_venta);
                    if (producto.precio_venta !== null && !isNaN(parseFloat(producto.precio_venta))) {
                        producto.precio_venta = Number(producto.precio_venta);
                    } else {
                        producto.precio_venta = 'No disponible';
                    }
                    const categoriaProducto = categorias.find(categoria => categoria.id === producto.categoria_id);
                    if (categoriaProducto) {
                        producto.categoria = categoriaProducto.nombre;
                    }
                    producto.imagenes = todasLasImagenes.filter(imagen => imagen.producto_id.toString() === producto.id.toString());
                }
            }
            res.render('productos', { productos, categorias, marcas, modelosPorMarca, numeroDePaginas, pagina, modelo: modeloSeleccionado });
        }  catch (error) {
            console.error('Error al obtener productos, categorías, marcas o modelos:', error);
            res.render('productos', { productos: [], categorias: [], marcas: [], modelosPorMarca: [], numeroDePaginas: 1, pagina, modelo });
        }
    },
    buscar : async (req, res) => {
        const busqueda = req.query.q;
        const categoria_id = req.query.categoria_id;
        const marca_id = req.query.marca_id; 
        const modelo_id = req.query.modelo_id;
        const limite = !busqueda ? 10 : undefined;
        let productos;
    
        if (busqueda) {
            console.log('Realizando búsqueda con:', busqueda, categoria_id, marca_id, modelo_id);
            productos = await producto.buscar(conexion, busqueda, categoria_id, marca_id, modelo_id);
            console.log('Resultados de la búsqueda:', productos);
        } else {
            productos = await producto.obtenerPorFiltros(conexion, categoria_id, marca_id, modelo_id, limite); 
        }
    
        res.json(productos); 
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
            // Formatear el precio_venta para que no tenga decimales y tenga separadores de miles
            producto[0].precio_venta = Number(producto[0].precio_venta).toLocaleString('es-ES');
            res.render('detalle', { producto: producto[0] });
          }
        }); 
      },
      crear: function(req, res) {
        let categorias, marcas, modelos, proveedores, descuentoProveedor, preciosConDescuento;
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
            // Obtén los proveedores y sus descuentos
            return Promise.all([
                producto.obtenerProveedores(conexion),
                producto.obtenerDescuentosProveedor(conexion)
            ]);
        }).then(results => {
            proveedores = results[0].map(proveedor => {
                const descuento = results[1].find(desc => desc.proveedor_id === proveedor.id);
                return {
                    ...proveedor,
                    descuento: descuento ? descuento.descuento : 0
                };
            });
            preciosConDescuento = proveedores.map(proveedor => req.body.precio_venta * (1 - proveedor.descuento / 100));
            descuentoProveedor = proveedores.map(proveedor => proveedor.descuento);
            res.render('crear', {
                categorias: categorias,
                marcas: marcas,
                modelos: modelos, 
                proveedores: proveedores,
                producto: {}, 
                preciosConDescuento: preciosConDescuento,
                utilidad: req.body.utilidad,
                descuentosProveedor: descuentoProveedor 
            });
        }).catch(error => {
            return res.status(500).send('Error: ' + error.message);
        });
    },
    guardar: function(req, res) {
        if (!req.body.proveedores || req.body.proveedores.length === 0) {
            res.status(400).send('Error: proveedor_id no puede ser nulo');
            return;
        }
        if (!req.files || req.files.length === 0) {
            res.status(400).send('Error: no se cargaron archivos');
            return;
        }
        const proveedores = req.body.proveedores;
        const datosProducto = {
            nombre: req.body.nombre,
            descripcion: req.body.descripcion,
            categoria_id: req.body.categoria,
            marca_id: req.body.marca,
            modelo_id: req.body.modelo_id,
            descuentos_proveedor_id: req.body.descuentos_proveedor_id,
            costo_neto: req.body.costo_neto,
            IVA: req.body.IVA,
            costo_iva: req.body.costo_iva,
            utilidad: req.body.utilidad,
            precio_venta: req.body.precio_venta,
            estado: req.body.estado
        };
        producto.insertarProducto(conexion, datosProducto)
        .then(result => {
            const productoId = result.insertId;
            const codigos = req.body.codigo.split(',');
            const proveedores = req.body.proveedores.map((proveedorId, index) => {
                return {
                    id: proveedorId,
                    codigo: codigos[index],
                    precio_lista: req.body.precio_lista[index]
                };
            });
            const promesasProveedor = proveedores.map(proveedor => {
                const datosProductoProveedor = {
                    producto_id: productoId,
                    proveedor_id: proveedor.id,
                    precio_lista: proveedor.precio_lista, 
                    codigo: proveedor.codigo
                };
                return producto.insertarProductoProveedor(conexion, datosProductoProveedor);
            });
            const promesasImagenes = req.files.map(file => {
                return producto.insertarImagenProducto(conexion, { producto_id: productoId, imagen: file.filename });
            });
            return Promise.all([...promesasProveedor, ...promesasImagenes]);
        })
        .then(() => {
            res.redirect('/productos/panelControl');
        })
        .catch(error => {
            console.error('Error:', error); 
            res.status(500).send('Error: ' + error.message);
        });
    },
    eliminarSeleccionados : async (req, res) => {
        const { ids } = req.body;
        try {
            await producto.eliminar(ids);
            res.json({ success: true });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, error: error.message });
        }
    },
    editar: function(req, res) {
        let productoResult;
        let responseSent = false;
        producto.retornarDatosId(conexion, req.params.id).then(result => {
            if (!result) {
                res.status(404).send("No se encontró el producto");
                responseSent = true;
                return;
            }
            productoResult = result;
            productoResult.precio_lista = Math.round(productoResult.precio_lista);
            productoResult.costo_neto = Math.round(productoResult.costo_neto);
            productoResult.costo_iva = Math.round(productoResult.costo_iva);
            productoResult.utilidad = Math.round(productoResult.utilidad);
            productoResult.precio_venta = Math.round(productoResult.precio_venta);
    
            producto.retornarDatosProveedores(conexion, req.params.id).then(productoProveedoresResult => {
                productoProveedoresResult.forEach(productoProveedorResult => {
                    productoProveedorResult.precio_lista = Math.floor(productoProveedorResult.precio_lista);
                    productoProveedorResult.descuento = Math.floor(productoProveedorResult.descuento);
                    productoProveedorResult.costo_neto = Math.floor(productoProveedorResult.costo_neto);
                });
                Promise.all([
                    producto.obtenerCategorias(conexion),
                    producto.obtenerMarcas(conexion),
                    producto.obtenerProveedores(conexion),
                    producto.obtenerModelosPorMarca(conexion, productoResult.marca),
                    producto.obtenerDescuentosProveedor(conexion)
                ]).then(([categoriasResult, marcasResult, proveedoresResult, modelosResult, descuentosProveedoresResult]) => {
                    res.render('editar', {
                        producto: productoResult,
                        productoProveedores: productoProveedoresResult,
                        categorias: categoriasResult,
                        marcas: marcasResult,
                        proveedores: proveedoresResult,
                        modelos: modelosResult,
                        descuentosProveedor: descuentosProveedoresResult
                    });
                }).catch(error => {
                    console.error("Error al obtener los datos:", error);
                    if (!responseSent) {
                        res.status(500).send("Error al obtener los datos");
                    }
                });
            }).catch(error => {
                console.error("Error al obtener los datos de producto_proveedor:", error);
                if (!responseSent) {
                    res.status(500).send("Error al obtener los datos de producto_proveedor");
                }
            });
        }).catch(error => {
            console.error("Error al obtener los datos:", error);
            if (!responseSent) {
                res.status(500).send("Error al obtener los datos");
            }
        });
    },
    actualizar: function(req, res) {
        if (!req.body.proveedores || req.body.proveedores.length === 0) {
            res.status(400).send('Error: proveedor_id no puede ser nulo');
            return;
        }
        let datosProducto = {
            id: req.body.id,
            nombre: req.body.nombre, 
            descripcion: req.body.descripcion,
            categoria_id: req.body.categoria,
            marca_id: req.body.marca,
            modelo_id: req.body.modelo_id,
            descuentos_proveedor_id: req.body.descuentos_proveedor_id [0],
            costo_neto: req.body.costo_neto[0],
            IVA: req.body.IVA[0],
            costo_iva: req.body.costo_iva[0],
            utilidad: req.body.utilidad,
            precio_venta: req.body.precio_venta,
            estado: req.body.estado
        };
        producto.actualizar(conexion, datosProducto)
        .then(() => {
            // Si hay archivos, actualiza cada uno
            if (req.files) {
                const promesasArchivos = req.files.map(file => {
                    return producto.actualizarArchivo(conexion, datosProducto, file);
                });
                return Promise.all(promesasArchivos);
            } else {
                return Promise.resolve();
            }
        })
        .catch(error => {
        })
        .then(() => {
            const proveedores = req.body.proveedores.map((proveedorId, index) => {
                return {
                    id: proveedorId,
                    codigo: req.body['codigo'][index],
                    precio_lista: req.body.precio_lista[index],
                    costo_iva: req.body.costo_iva[index],
                    precio_venta: req.body.precio_venta
                };
            });
            const promesasProveedor = proveedores.map((proveedor, index) => {
                const datosProductoProveedor = {
                    producto_id: datosProducto.id,
                    proveedor_id: proveedor.id,
                    precio_lista: proveedor.precio_lista,
                    codigo: proveedor.codigo,
                    costo_iva: proveedor.costo_iva, 
                    precio_venta: proveedor.precio_venta
                };
                console.log('datosProductoProveedor:', datosProductoProveedor);
                return producto.actualizarProductoProveedor(conexion, datosProductoProveedor);
            });
            return Promise.all(promesasProveedor);
        })
        .then(() => {
            return producto.obtenerPosicion(conexion, datosProducto.id);
        })
        .then(posicion => {
            const productosPorPagina = 10;
            const pagina = Math.ceil(posicion / productosPorPagina);
            res.redirect('/productos/panelControl?pagina=' + pagina);
        })
        .catch(error => {
            console.error('Error:', error); 
            res.status(500).send('Error: ' + error.message);
        });
    },
    ultimos: function(req, res) {
        producto.obtenerUltimos(conexion, 3, function(error, productos) {
            if (error) {
                return res.status(500).send('Error al obtener los productos');
            } else {
                productos.forEach(producto => {
                    producto.precio_venta = parseFloat(producto.precio_venta).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
                });
                res.json(productos);
            }
        });
    },
    proveedores : async (req, res) => {
        let proveedores = await producto.obtenerProveedores(conexion);
        res.render('proveedores', { proveedores: proveedores });
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
            let numeroDePaginas = await calcularNumeroDePaginas(conexion);
            let productos = await producto.obtenerTodos(conexion, saltar, productosPorPagina, categoriaSeleccionada);
            
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
          producto.precio_venta = parseFloat(producto.precio_venta).toLocaleString('de-DE');
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
          producto.precio_venta = parseFloat(producto.precio_venta).toLocaleString('de-DE');
        });
        res.json({ productos });
      }); 
    }   
  },
  buscarProductos : async (req, res) => {
    try {
      const consulta = req.query.query;
      let productos;
      if (!consulta) {
        productos = await producto.findAll({
          attributes: ['id', 'nombre', 'imagen', 'precio_venta'], 
        });
      } else {
        productos = await producto.findAll({
          where: {
            nombre: {
              [Op.iLike]: '%' + consulta + '%'
            }
          },
          attributes: ['id', 'nombre', 'imagen', 'precio_venta'], 
        });
      }
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
                producto.precio_venta = parseFloat(producto.precio_venta).toLocaleString('de-DE');
            });

            console.log('Productos obtenidos:', productos);
            res.render('productos', { productos: productos });
        }
    });
},
eliminarProveedor: function(req, res) {
    let proveedorId = req.params.id;
    producto.eliminarProveedor(conexion, proveedorId).then(() => {
        res.json({ success: true });
    }).catch(error => {
        console.error("Error al eliminar el proveedor:", error);
        res.status(500).json({ success: false, error: error });
    });
},
eliminarImagen: function(req, res) {
    let imagenId = req.params.id;
    producto.eliminarImagen(imagenId).then(() => {
        res.json({ success: true });
    }).catch(error => {
        console.error("Error al eliminar la imagen:", error);
        res.status(500).json({ success: false, error: error });
    });
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
    let nuevoPrecio = req.body.precio_venta;
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
                    var precioFormateado = '$' + parseFloat(producto.precio_venta).toFixed(0);
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