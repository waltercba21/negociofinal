const conexion = require('../config/conexion')
const producto = require('../models/producto')
var borrar = require('fs');
const PDFDocument = require('pdfkit');
const blobStream  = require('blob-stream');
var streamBuffers = require('stream-buffers');
const xlsx = require('xlsx');
const fs = require('fs');
const pdfParse = require('pdf-parse');

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
            res.render('productos', { productos: [], categorias: [], marcas: [], modelosPorMarca: [], numeroDePaginas: 1, pagina, modelo });
        }
    },
    buscar : async (req, res) => {
        const busqueda_nombre = req.query.q;
        const categoria_id = req.query.categoria_id;
        const marca_id = req.query.marca_id; 
        const modelo_id = req.query.modelo_id;
        const limite = !busqueda_nombre ? 10 : undefined;
        const productos = await producto.obtenerPorFiltros(conexion, categoria_id, marca_id, modelo_id, busqueda_nombre, limite); 
        res.json(productos); 
    },
    buscarConCodigoPrecio : async (req, res) => {
        const busqueda_nombre = req.query.q;
        if (!busqueda_nombre || !busqueda_nombre.trim()) { 
            res.json([]);
            return;
        }
        const limite = !busqueda_nombre ? 10 : undefined;
        const productos = await producto.obtenerPorFiltrosConCodigoPrecio(conexion, busqueda_nombre, limite); 
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
            return producto.obtenerMarcas(conexion);
        }).then(result => {
            marcas = result;
            return producto.obtenerModelosPorMarca(conexion);
        }).then(result => {
            modelos = result;
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
        }).then(() => {
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
            estado: req.body.estado,
            stock_minimo: req.body.stock_minimo, 
            stock_actual: req.body.stock_actual  
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
            res.status(500).send('Error: ' + error.message);
        });
    },
    eliminarSeleccionados : async (req, res) => {
        const { ids } = req.body;
        try {
            await producto.eliminar(ids);
            res.json({ success: true });
        } catch (error) {
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
            productoResult.paginaActual = req.query.pagina;
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
                    producto.obtenerDescuentosProveedor(conexion),
                    producto.obtenerStock(conexion, req.params.id) // Añadir la obtención de datos de stock
                ]).then(([categoriasResult, marcasResult, proveedoresResult, modelosResult, descuentosProveedoresResult, stockResult]) => {
                    res.render('editar', {
                        producto: productoResult,
                        productoProveedores: productoProveedoresResult,
                        categorias: categoriasResult,
                        marcas: marcasResult,
                        proveedores: proveedoresResult,
                        modelos: modelosResult,
                        descuentosProveedor: descuentosProveedoresResult,
                        stock: stockResult 
                    });
                }).catch(error => {
                    if (!responseSent) {
                        res.status(500).send("Error al obtener los datos: " + error.message);
                    }
                });
            }).catch(error => {
                if (!responseSent) {
                    res.status(500).send("Error al obtener los datos de producto_proveedor: " + error.message);
                }
            });
        }).catch(error => {
            if (!responseSent) {
                res.status(500).send("Error al obtener los datos del producto: " + error.message);
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
            descuentos_proveedor_id: req.body.descuentos_proveedor_id ,
            costo_neto: req.body.costo_neto,
            IVA: req.body.IVA[0],
            costo_iva: req.body.costo_iva,
            utilidad: req.body.utilidad,
            precio_venta: req.body.precio_venta,
            estado: req.body.estado,
            paginaActual: req.body.paginaActual,
            stock_minimo: req.body.stock_minimo, 
            stock_actual: req.body.stock_actual,
        };
        producto.actualizar(conexion, datosProducto)
        .then(() => {
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
                return producto.actualizarProductoProveedor(conexion, datosProductoProveedor);
            });
            return Promise.all(promesasProveedor);
        })
        .then(() => {
            return producto.actualizarStock(conexion, datosProducto.id, datosProducto.stock_minimo, datosProducto.stock_actual); 
        })
        .then(() => {
            return producto.obtenerPosicion(conexion, datosProducto.id);
        })
        .then(() => {
            res.redirect('/productos/panelControl?pagina=' + req.session.paginaActual);
        })
        .catch(error => {
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
    panelControl: async (req, res) => {
        try {
            let proveedores = await producto.obtenerProveedores(conexion);
            let categorias = await producto.obtenerCategorias(conexion);
            const proveedorSeleccionado = req.query.proveedor;
            const categoriaSeleccionada = req.query.categoria;
            let paginaActual = req.query.pagina ? Number(req.query.pagina) : 1;
            if (isNaN(paginaActual) || paginaActual < 1) {
                paginaActual = 1;
            }
            // Guardar la página actual en la sesión
            req.session.paginaActual = paginaActual;
            const productosPorPagina = 30;
            const saltar = (paginaActual - 1) * productosPorPagina;
            let numeroDePaginas = await producto.calcularNumeroDePaginas(conexion, productosPorPagina);
            let productos = await producto.obtenerTodos(conexion, saltar, productosPorPagina, categoriaSeleccionada);
            res.render('panelControl', { proveedores: proveedores, proveedorSeleccionado: proveedorSeleccionado, categorias: categorias, categoriaSeleccionada: categoriaSeleccionada, numeroDePaginas: numeroDePaginas, productos: productos, paginaActual: paginaActual }); 
        } catch (error) {
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
            productos.forEach(producto => {
                producto.precio_venta = parseFloat(producto.precio_venta).toLocaleString('de-DE');
            });
            res.render('productos', { productos: productos });
        }
    });
},
eliminarProveedor: function(req, res) {
    let proveedorId = req.params.id;
    producto.eliminarProveedor(conexion, proveedorId).then(() => {
        res.json({ success: true });
    }).catch(error => {
        res.status(500).json({ success: false, error: error });
    });
},
eliminarImagen: function(req, res) {
    let imagenId = req.params.id;
    producto.eliminarImagen(imagenId).then(() => {
        res.json({ success: true });
    }).catch(error => {
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
            res.redirect('/productos/modificarPorProveedor?proveedor=' + proveedorId);
        }
    });
},
actualizarPrecio: function(req, res) {
    let idProducto = req.body.id;
    let nuevoPrecio = req.body.precio_venta;
    let proveedorId = req.body.proveedor; 
    producto.actualizarPrecio(idProducto, nuevoPrecio, function(err) {
        if (err) {
            console.error(err);
            res.redirect('/productos/modificarPorProveedor?error=Hubo un error al actualizar el precio');
        } else {
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
  generarPDF: async function (req, res) {
    var doc = new PDFDocument;
    var buffer = new streamBuffers.WritableStreamBuffer({
        initialSize: (1024 * 1024),
        incrementAmount: (1024 * 1024)
    });
    doc.pipe(buffer);
    const proveedorId = req.query.proveedor;
    const categoriaId = req.query.categoria;
    if (!proveedorId) {
        return res.status(400).send('No se ha proporcionado un ID de proveedor');
    }
    try {
        const proveedores = await producto.obtenerProveedores(conexion);
        var proveedor = proveedores.find(p => p.id == proveedorId);
        if (!proveedor) {
            return res.status(400).send('Proveedor no encontrado');
        }
        var nombreProveedor = proveedor.nombre;
        doc.fontSize(20)
            .text(nombreProveedor, 0, 50, {
                align: 'center',
                width: doc.page.width
            });
        if (categoriaId) {
            const categorias = await producto.obtenerCategorias(conexion);
            var categoria = categorias.find(c => c.id == categoriaId);
            if (!categoria) {
                return res.status(400).send('Categoría no encontrada');
            }
            var nombreCategoria = categoria.nombre;
            doc.fontSize(12)
                .text(nombreCategoria, 0, doc.y, {
                    align: 'center',
                    width: doc.page.width
                });
            doc.moveDown(2);
        }
        var obtenerProductos;
        if (categoriaId) {
            obtenerProductos = producto.obtenerProductosPorProveedorYCategoría(conexion, proveedorId, categoriaId);
        } else {
            obtenerProductos = producto.obtenerProductosPorProveedor(conexion, proveedorId);
        }

        obtenerProductos.then(productos => {
            var currentY = doc.y;
            doc.fontSize(10)
                .text('Código', 50, currentY)
                .text('Descripción', 150, currentY) // Ajusta la posición de la descripción
                .text('Precio de lista', doc.page.width - 250, currentY, {
                    align: 'right'
                })
                .text('Precio de venta', doc.page.width - 100, currentY, {
                    align: 'right'
                });
            doc.moveDown();
            productos.forEach(producto => {
                var precioListaFormateado = '$' + parseFloat(producto.precio_lista).toFixed(2);
                var precioVentaFormateado = '$' + parseFloat(producto.precio_venta).toFixed(2);
                currentY = doc.y;
                if (currentY + 20 > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    currentY = doc.y;
                }
                doc.fontSize(8)
                    .text(producto.codigo_proveedor, 50, currentY)
                    .text(producto.nombre, 150, currentY, {
                        width: doc.page.width - 400 // Ajusta el ancho de la descripción
                    })
                    .text(precioListaFormateado, doc.page.width - 250, currentY, {
                        align: 'right'
                    })
                    .text(precioVentaFormateado, doc.page.width - 100, currentY, {
                        align: 'right'
                    });
                doc.moveDown();
            });
            doc.end();
        }).catch(error => {
            console.error('Error al obtener productos:', error);
            return res.status(500).send('Error al generar el PDF');
        });
    } catch (error) {
        console.error('Error en generarPDF:', error);
        return res.status(500).send('Error al generar el PDF');
    }
    buffer.on('finish', function () {
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
generarStockPDF: async function (req, res) {
    var doc = new PDFDocument;
    var buffer = new streamBuffers.WritableStreamBuffer({
        initialSize: (1024 * 1024),   
        incrementAmount: (1024 * 1024) 
    });
    doc.pipe(buffer);
    const proveedorId = req.query.proveedor; 
    if (!proveedorId) {
        return res.status(400).send('No se ha proporcionado un ID de proveedor');
    }
    try {
        const proveedores = await producto.obtenerProveedores(conexion);
        var proveedor = proveedores.find(p => p.id == proveedorId);
        if (!proveedor) {
            return res.status(400).send('Proveedor no encontrado');
        }
        var nombreProveedor = proveedor.nombre;
        doc.fontSize(20)
           .text(nombreProveedor, 50, 80, {
               align: 'center',
               width: doc.page.width - 100
           });
        var obtenerProductos = producto.obtenerProductosPorProveedorConStock(conexion, proveedorId);
        obtenerProductos.then(productos => {
            var currentY = doc.y;
            doc.fontSize(10)
            .fillColor('blue')
            .text('Código', 70, currentY + 10, {align: 'center', width: 90})
            .text('Descripción', 170, currentY + 10, {align: 'center', width: 250})
            .text('Stock', 470, currentY + 10, {align: 'center', width: 40}) 
            .text('Mínimo', 470, currentY + 20, {align: 'center', width: 40}) 
            .text('Stock', 520, currentY + 10, {align: 'center', width: 40}) 
            .text('Actual', 520, currentY + 20, {align: 'center', width: 40}) 
            .fillColor('black');
            doc.moveTo(160, currentY)
               .lineTo(160, currentY + 40)
               .moveTo(460, currentY)
               .lineTo(460, currentY + 40)
               .moveTo(515, currentY)
               .lineTo(515, currentY + 40)
               .stroke();
            doc.moveTo(70, currentY + 40)
               .lineTo(570, currentY + 40)
               .stroke();
            doc.moveDown(3);
            productos.forEach(producto => {
                currentY = doc.y;
                if (currentY + 40 > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    currentY = doc.y;
                }
                doc.fontSize(8);
            
                doc.text(producto.codigo_proveedor, 70, currentY + 10, {align: 'left', width: 100,});
            
                doc.text(producto.nombre, 170, currentY + 10, {width: 220, ellipsis: true});
            
                doc.text(producto.stock_minimo ? producto.stock_minimo.toString() : '0', 470, currentY + 10, {width: 40, align: 'center'})
                    .text(producto.stock_actual ? producto.stock_actual.toString() : 'Sin Stock', 520, currentY + 10, {width: 40, align: 'center'}); 
            
                doc.moveTo(160, currentY)
                    .lineTo(160, currentY + 30)
                    .moveTo(460, currentY)
                    .lineTo(460, currentY + 30)
                    .moveTo(515, currentY)
                    .lineTo(515, currentY + 30)
                    .stroke();
                doc.moveTo(70, currentY + 30)
                   .lineTo(570, currentY + 30)
                   .stroke();
                doc.moveDown(2);
            });
            doc.end();
        }).catch(error => {
            console.log('Error al obtener productos:', error);
            return res.status(500).send('Error al generar el PDF');
        });
    } catch (error) {
        console.log('Error al obtener proveedores:', error);
        return res.status(500).send('Error al generar el PDF');
    }
    buffer.on('finish', function() {
        const pdfData = buffer.getContents();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=productos.pdf');
        res.send(pdfData);
    });
},
presupuestoMostrador:function(req, res) {
    res.render('presupuestoMostrador');
},
generarPresupuestoPDF: function(req, res) {
    let doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
        let pdfData = Buffer.concat(buffers);
        res.writeHead(200, {
            'Content-Length': Buffer.byteLength(pdfData),
            'Content-Type': 'application/pdf',
            'Content-disposition': 'attachment;filename=presupuesto.pdf', 
        });
        res.end(pdfData);
    });
    let datos = req.body;
    doc.fontSize(20).text('Presupuesto', {align: 'center'});
    doc.fontSize(14)
       .text(`Nombre del cliente: ${datos.nombreCliente}`, {align: 'left'})
       .text(`Fecha: ${datos.fecha}`, {align: 'left'})
       .text(`Presupuesto N°: ${datos.numeroPresupuesto}`, {align: 'left'});
    doc.moveDown();
    doc.fontSize(12)
       .text('Código', {align: 'left'})
       .text('Descripción', {align: 'left'})
       .text('Precio', {align: 'left'})
       .text('Cantidad', {align: 'left'})
       .text('Subtotal', {align: 'left'});
    if (Array.isArray(datos.productos)) {
        datos.productos.forEach(producto => {
            doc.moveDown();
            doc.text(producto.codigo, {align: 'left'})
               .text(producto.descripcion, {align: 'left'})
               .text(producto.precio, {align: 'left'})
               .text(producto.cantidad, {align: 'left'})
               .text(producto.subtotal, {align: 'left'});
        });
    } else {
        return res.status(400).send('Productos no es un array');
    }
    doc.end();
},
actualizarPrecios: function(req, res) {
    let datosProducto = {
        id: req.params.id,
        precio_lista: req.body.precio_lista,
        costo_neto: req.body.costo_neto,
        utilidad: req.body.utilidad
    };

    producto.actualizarPrecios(conexion, datosProducto)
    .then(() => {
        res.json(datosProducto);
    })
    .catch(error => {
        res.status(500).send('Error: ' + error.message);
    });
},  
actualizarPreciosExcel: async (req, res) => {
    try {
        const file = req.files[0];
        let productosActualizados = [];

        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
            const workbook = xlsx.readFile(file.path);
            const sheet_name_list = workbook.SheetNames;
            const promises = []; 

            for (const sheet_name of sheet_name_list) {
                const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name]);

                for (const row of data) {
                    const codigoColumn = Object.keys(row).find(key => key.toLowerCase().includes('código') || key.toLowerCase().includes('codigo'));
                    const precioColumn = Object.keys(row).find(key => key.toLowerCase().includes('precio'));

                    if (codigoColumn && precioColumn) {
                        console.log(`Procesando producto con código ${row[codigoColumn]} y precio ${row[precioColumn]}`);
                        promises.push(
                            producto.actualizarPreciosPDF(row[precioColumn], row[codigoColumn])
                                .then(productoActualizado => {
                                    if (productoActualizado !== null) {
                                        productosActualizados.push(productoActualizado);
                                    } else {
                                        console.log(`No se encontró ningún producto con el código ${row[codigoColumn]} en la base de datos.`);
                                        return { noExiste: true, codigo: row[codigoColumn] };
                                    }
                                })
                                .catch(error => {
                                    console.log(`Error al actualizar el producto con el código ${row[codigoColumn]}:`, error);
                                    return { error: true, message: `Error al actualizar el producto con el código ${row[codigoColumn]}: ${error.message}` };
                                })
                        );
                    } else {
                        console.error(`No se encontraron las columnas de código o precio en la fila: ${JSON.stringify(row)}`);
                    }
                }
            }

            const resultados = await Promise.all(promises);
            const errores = resultados.filter(resultado => resultado && resultado.error);
            const noEncontrados = resultados.filter(resultado => resultado && resultado.noExiste);

            if (errores.length > 0) {
                console.log("Errores al actualizar algunos productos:", errores);
            }

            if (noEncontrados.length > 0) {
                noEncontrados.forEach(item => {
                    console.log(`El producto con el código ${item.codigo} no existe en la base de datos.`);
                });
            }

            fs.unlinkSync(file.path);
            res.render('productosActualizados', { productos: productosActualizados });
        } else {
            res.status(400).send('Tipo de archivo no soportado. Por favor, sube un archivo .xlsx');
            return;
        }
    } catch (error) {
        console.log("Error durante el procesamiento de archivos", error);
        res.status(500).send(error.message);
    }
}
}