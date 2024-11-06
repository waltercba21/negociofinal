const conexion = require('../config/conexion')
const producto = require('../models/producto')
var borrar = require('fs');
const PDFDocument = require('pdfkit');
const blobStream  = require('blob-stream');
var streamBuffers = require('stream-buffers');
const xlsx = require('xlsx');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');

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
const compararCodigos = (codigo1, codigo2) => {
    for (let i = 0; i <= codigo1.length - 4; i++) {
        const substring = codigo1.substring(i, i + 4);
        if (codigo2.includes(substring)) {
            return true;
        }
    }
    return false;
};

module.exports = {
    index: (req, res) => {
        producto.obtenerUltimos(conexion, 3, (error, productos) => {
            if (error) {
                return res.status(500).send('Error al obtener los productos');
            } else {
                producto.obtenerProductosOferta(conexion, (error, productosOferta) => {
                    if (error) {
                        return res.status(500).send('Error al obtener las ofertas');
                    } else {
                        res.render('index', { productos, productosOferta });
                    }
                }); 
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
    buscar: async (req, res) => {
        try {
            const { q: busqueda_nombre, categoria_id, marca_id, modelo_id } = req.query;
            
            req.session.busquedaParams = { busqueda_nombre, categoria_id, marca_id, modelo_id };
            
            const limite = busqueda_nombre || categoria_id || marca_id || modelo_id ? undefined : 10;
            const productos = await producto.obtenerPorFiltros(conexion, categoria_id, marca_id, modelo_id, busqueda_nombre, limite);
            
            res.json(productos);
        } catch (error) {
            res.status(500).json({ error: 'Ocurrió un error al buscar productos.' });
        }
    },
    
    
    detalle: function (req, res) {
        const id = req.params.id;
        producto.obtenerPorId(conexion, id, function(error, producto) {
          if (error) {
            console.log('Error al obtener producto:', error);
            return res.status(500).send('Error al obtener el producto');
          } else if (producto.length === 0) {
            return res.status(404).send('Producto no encontrado');
          } else {
            producto[0].precio_venta = Number(producto[0].precio_venta).toLocaleString('es-ES');
            res.render('detalle', { 
                producto: producto[0], 
            });
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
            stock_actual: req.body.stock_actual,
            calidad_original: req.body.calidad_original_fitam ? 1 : 0 , 
            calidad_vic: req.body.calidad_vic ? 1 : 0
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
    eliminarSeleccionados: async (req, res) => {
        const { ids } = req.body;
        console.log("IDs recibidos para eliminar:", ids); // Verificar IDs
        try {
            await producto.eliminar(ids);
            res.json({ success: true });
        } catch (error) {
            console.error("Error en el controlador al eliminar productos:", error);
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
            productoResult.calidad_original_fitam = result.calidad_original_fitam;
            productoResult.calidad_vic = result.calidad_vic; 
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
                    producto.obtenerStock(conexion, req.params.id) 
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
            utilidad: req.body.utilidad,
            precio_venta: req.body.precio_venta,
            estado: req.body.estado,
            paginaActual: req.body.paginaActual,
            stock_minimo: req.body.stock_minimo,
            stock_actual: req.body.stock_actual,
            descuentos_proveedor_id: req.body.descuentos_proveedor_id[0],
            costo_neto: req.body.costo_neto[0],
            IVA: req.body.IVA[0],
            costo_iva: req.body.costo_iva[0],
            oferta: req.body.oferta === 'on' ? 1 : 0,
            calidad_original: req.body.calidad_original ? 1 : 0, 
            calidad_vic: req.body.calidad_vic ? 1 : 0 
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
            .then(() => {
                const proveedores = req.body.proveedores.map((proveedorId, index) => {
                    return {
                        producto_id: datosProducto.id,
                        proveedor_id: proveedorId,
                        precio_lista: req.body.precio_lista[index],
                        codigo: req.body.codigo[index]
                    };
                });
                const promesasProveedor = proveedores.map((proveedor) => {
                    return producto.actualizarProductoProveedor(conexion, proveedor);
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
            const proveedorSeleccionado = req.query.proveedor || req.session.proveedorSeleccionado || null;
            const categoriaSeleccionada = req.query.categoria || req.session.categoriaSeleccionada || null;
            let paginaActual = req.query.pagina ? Number(req.query.pagina) : (req.session.paginaActual || 1);
            if (isNaN(paginaActual) || paginaActual < 1) {
                paginaActual = 1;
            }
            req.session.paginaActual = paginaActual;
            const busqueda = req.query.busqueda || req.session.busqueda || ''; 
            req.session.busqueda = busqueda; 
            const productosPorPagina = 30;
            const saltar = (paginaActual - 1) * productosPorPagina;
            let productos;
            if (busqueda) {
                productos = await producto.obtenerPorFiltros(conexion, categoriaSeleccionada, null, null, busqueda);
            } else {
                productos = await producto.obtenerTodos(conexion, saltar, productosPorPagina, categoriaSeleccionada);
            }
            let numeroDePaginas = await producto.calcularNumeroDePaginas(conexion, productosPorPagina);
            req.session.proveedorSeleccionado = proveedorSeleccionado;
            req.session.categoriaSeleccionada = categoriaSeleccionada;
            res.render('panelControl', {
                proveedores: proveedores,
                proveedorSeleccionado: proveedorSeleccionado,
                categorias: categorias,
                categoriaSeleccionada: categoriaSeleccionada,
                numeroDePaginas: numeroDePaginas,
                productos: productos,
                paginaActual: paginaActual,
                busqueda: busqueda 
            });
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
    let productoId = req.body.productoId;
    producto.eliminarProveedor(conexion, proveedorId, productoId).then(() => {
        res.json({ success: true });
    }).catch(error => {
        console.error("Error eliminando el proveedor:", error); 
        res.status(500).json({ success: false, error: "Error al eliminar el proveedor. Por favor, intente nuevamente más tarde." });
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
            doc.fontSize(8)
                .text('Código', 20, currentY) // Mover la columna Código más a la izquierda
                .text('Descripción', 80, currentY) // Reducir el espacio entre Código y Descripción
                .text('Precio de lista', 390, currentY, {
                    width: 100,
                    align: 'right'
                })
                .text('Precio de venta', 480, currentY, {
                    width: 100,
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
                    .text(producto.codigo_proveedor, 20, currentY) // Mover la columna Código más a la izquierda
                    .text(producto.nombre, 80, currentY, {
                        width: 400 // Ajustar el ancho del nombre del producto
                    })
                    .text(precioListaFormateado, 390, currentY, {
                        width: 100,
                        align: 'right'
                    })
                    .text(precioVentaFormateado, 480, currentY, {
                        width: 100,
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
    console.log('Proveedor ID:', req.query.proveedor);
    var doc = new PDFDocument;
    var buffer = new streamBuffers.WritableStreamBuffer({
        initialSize: (1024 * 1024),   
        incrementAmount: (1024 * 1024) 
    });
    doc.pipe(buffer);
    
    const proveedorId = req.query.proveedor; 
    
    try {
        const proveedores = await producto.obtenerProveedores(conexion);
        console.log('Proveedores:', proveedores);
        
        let proveedor;
        if (proveedorId) {
            proveedor = proveedores.find(p => p.id == proveedorId);
            if (!proveedor) {
                return res.status(400).send('Proveedor no encontrado');
            }
        }
        
        console.log('Proveedor seleccionado:', proveedor);
        var nombreProveedor = proveedor ? proveedor.nombre : 'Productos con un solo proveedor';
        
        doc.fontSize(14)
           .text(nombreProveedor, {
               align: 'center',
               width: doc.page.width - 100
           });
        
        var obtenerProductos = producto.obtenerProductosPorProveedorConStock(conexion, proveedorId);
        
        obtenerProductos.then(productos => {
            console.log('Productos:', productos);
            
            // Función para normalizar las descripciones eliminando números y caracteres especiales al inicio
            function normalizeString(str) {
                return str.replace(/^[^a-zA-Z]+/, '').toLowerCase();
            }
            
            // Ordenar los productos por el campo nombre normalizado
            productos.sort((a, b) => {
                const nameA = normalizeString(a.nombre);
                const nameB = normalizeString(b.nombre);
                return nameA.localeCompare(nameB);
            });
            
            let currentY = doc.y;
            doc.fontSize(12)
               .fillColor('black')
               .text('Código', 60, currentY, {align: 'left', width: 100})
               .text('Descripción', 150, currentY, {align: 'left', width: 220})
               .text('Stock Mínimo', 400, currentY, {align: 'center', width: 80})
               .text('Stock Actual', 480, currentY, {align: 'center', width: 80})
               .moveDown(2);
            
            productos.forEach(producto => {
                if (producto.stock_actual < producto.stock_minimo) {
                    currentY = doc.y;
                    if (currentY + 50 > doc.page.height - doc.page.margins.bottom) {
                        doc.addPage();
                        currentY = doc.y;
                    }
                    doc.fontSize(8)
                       .text(producto.codigo_proveedor, 60, currentY, {align: 'left', width: 100})
                       .text(producto.nombre, 150, currentY, {align: 'left', width: 220})
                       .text(producto.stock_minimo ? producto.stock_minimo.toString() : '0', 400, currentY, {align: 'center', width: 80})
                       .text(producto.stock_actual ? producto.stock_actual.toString() : 'Sin Stock', 480, currentY, {align: 'center', width: 80})
                       .moveDown(1);
                }
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
generarPedidoPDF: async function (req, res) {
    console.log('Proveedor ID:', req.query.proveedor);
    var doc = new PDFDocument;
    var buffer = new streamBuffers.WritableStreamBuffer({
      initialSize: (1024 * 1024),   
      incrementAmount: (1024 * 1024) 
    });
    doc.pipe(buffer);
  
    const proveedorId = req.query.proveedor; 
  
    try {
      const proveedores = await producto.obtenerProveedores(conexion);
      console.log('Proveedores:', proveedores);
      
      let proveedor;
      if (proveedorId) {
        proveedor = proveedores.find(p => p.id == proveedorId);
        if (!proveedor) {
          return res.status(400).send('Proveedor no encontrado');
        }
      }
      
      console.log('Proveedor seleccionado:', proveedor);
      var nombreProveedor = proveedor ? proveedor.nombre : 'Productos con un solo proveedor';
      
      doc.fontSize(14)
         .text(nombreProveedor, {
             align: 'center',
             width: doc.page.width - 100
         });
  
      var obtenerProductos = producto.obtenerProductosParaPedidoPorProveedorConStock(conexion, proveedorId);
      
      obtenerProductos.then(productos => {
        console.log('Productos:', productos);
  
        // Función para normalizar las descripciones eliminando números y caracteres especiales al inicio
        function normalizeString(str) {
          return str.replace(/^[^a-zA-Z]+/, '').toLowerCase();
        }
  
        // Ordenar los productos por el campo nombre normalizado
        productos.sort((a, b) => {
          const nameA = normalizeString(a.nombre);
          const nameB = normalizeString(b.nombre);
          return nameA.localeCompare(nameB);
        });
  
        let currentY = doc.y;
        doc.fontSize(12)
           .fillColor('black')
           .text('Código', 60, currentY, {align: 'left', width: 100})
           .text('Descripción', 150, currentY, {align: 'left', width: 220})
           .text('Stock Mínimo', 370, currentY, {align: 'center', width: 50})
           .text('Stock Actual', 430, currentY, {align: 'center', width: 50})
           .text('Cantidad a Pedir', 510, currentY, {align: 'left', width: 100})
           .moveDown(2);
  
           productos.forEach(producto => {
            if (producto.stock_actual <= producto.stock_minimo) {
              currentY = doc.y;
              if (currentY + 50 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                currentY = doc.y;
              }
              doc.fontSize(8)
                 .text(producto.codigo_proveedor, 60, currentY, {align: 'left', width: 100})
                 .text(producto.nombre, 150, currentY, {align: 'left', width: 220})
                 .text(producto.stock_minimo ? producto.stock_minimo.toString() : '0', 370, currentY, {align: 'center', width: 50}) // Ajustado
                 .text(producto.stock_actual ? producto.stock_actual.toString() : 'Sin Stock', 430, currentY, {align: 'center', width: 50}) // Ajustado
                 .text(producto.stock_actual < producto.stock_minimo ? `PEDIR ${producto.stock_minimo - producto.stock_actual}` : 'REVISAR STOCK', 510, currentY, {align: 'center', width: 100}) // Ajustado
                 .moveDown(1);
            }
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
      res.setHeader('Content-Disposition', 'attachment; filename=pedido.pdf');
      res.send(pdfData);
    });
  },
presupuestoMostrador: async function(req, res) {
    try {
      const siguienteID = await producto.obtenerSiguienteID();
      res.render('presupuestoMostrador', { idPresupuesto: siguienteID });
    } catch (error) {
      console.error('Error al obtener el siguiente ID de presupuesto:', error.message);
      res.status(500).send('Error al obtener el siguiente ID de presupuesto.');
    }
  },
  facturasMostrador: async function(req, res) {
    try {
        const siguienteIDFactura = await producto.obtenerSiguienteIDFactura(); // Obtener el siguiente ID de facturas
        res.render('facturasMostrador', { idFactura: siguienteIDFactura }); // Cambiar el nombre a idFactura
    } catch (error) {
        console.error('Error al obtener el siguiente ID de factura:', error.message);
        res.status(500).send('Error al obtener el siguiente ID de factura.');
    }
},
  procesarFormulario: async (req, res) => {
    try {
        const { nombreCliente, fechaPresupuesto, totalPresupuesto, invoiceItems } = req.body;
        const totalLimpio = totalPresupuesto.replace('$', '').replace(',', '');
        const presupuesto = {
            nombre_cliente: nombreCliente,
            fecha: fechaPresupuesto,
            total: totalLimpio
        };
        const presupuestoId = await producto.guardarPresupuesto(presupuesto);
        const items = await Promise.all(invoiceItems.map(async item => {
            const producto_id = await producto.obtenerProductoIdPorCodigo(item.producto_id);
            // Actualizar stock del producto
            await producto.actualizarStockPresupuesto(producto_id, item.cantidad);
            return [
                presupuestoId,
                producto_id,
                item.cantidad,
                item.precio_unitario,
                item.subtotal
            ];
        }));
        await producto.guardarItemsPresupuesto(items);
        res.status(200).json({ message: 'PRESUPUESTO GUARDADO CORRECTAMENTE' });
    } catch (error) {
        console.error('Error al guardar el presupuesto:', error);
        res.status(500).json({ error: 'Error al guardar el presupuesto: ' + error.message });
    }
},
procesarFormularioFacturas: async (req, res) => {
    try {
        const { nombreCliente, fechaPresupuesto, totalPresupuesto, invoiceItems, metodosPago } = req.body;

        // Registrar los datos recibidos
        console.log("Datos recibidos:", { nombreCliente, fechaPresupuesto, totalPresupuesto, invoiceItems, metodosPago });

        // Limpieza del total recibido
        const totalLimpio = totalPresupuesto.replace('$', '').replace(',', '');

        // Convertir el arreglo de métodos de pago a una cadena
        const metodosPagoString = Array.isArray(metodosPago) ? metodosPago.join(', ') : metodosPago;

        const factura = {
            nombre_cliente: nombreCliente,
            fecha: fechaPresupuesto,
            total: totalLimpio,
            metodos_pago: metodosPagoString // Agregar métodos de pago
        };

        // Guardar la factura en la base de datos
        const facturaId = await producto.guardarFactura(factura);

        if (!Array.isArray(invoiceItems) || invoiceItems.length === 0) {
            console.error("No se proporcionaron items de factura.");
            return res.status(400).json({ error: 'No se proporcionaron items de factura.' });
        }

        // Procesar los items de la factura
        const items = await Promise.all(invoiceItems.map(async item => {
            console.log("Procesando item:", item);
            const producto_id = await producto.obtenerProductoIdPorCodigo(item.producto_id);
            
            if (!producto_id) {
                throw new Error(`Producto con ID ${item.producto_id} no encontrado.`);
            }

            await producto.actualizarStockPresupuesto(producto_id, item.cantidad);

            return [
                facturaId, // Cambia de presupuestoId a facturaId
                producto_id,
                item.cantidad,
                item.precio_unitario,
                item.subtotal
            ];
        }));

        console.log("Items a guardar en la base de datos:", items);

        await producto.guardarItemsFactura(items);

        res.status(200).json({ message: 'FACTURA GUARDADA CORRECTAMENTE' });
    } catch (error) {
        console.error('Error al guardar la factura:', error);
        res.status(500).json({ error: 'Error al guardar la factura: ' + error.message });
    }
},

listadoPresupuestos : (req, res) => {
    res.render('listadoPresupuestos');
},
listaFacturas : (req, res) => {
    res.render('listaFacturas'); 
},
getPresupuestos: async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const presupuestos = await producto.getAllPresupuestos(fechaInicio, fechaFin);
        res.json(presupuestos);
    } catch (error) {
        console.error('Error al obtener presupuestos:', error);
        res.status(500).json({ error: 'Error al obtener presupuestos' });
    }
},
getFacturas: async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        console.log(`Buscando facturas desde ${fechaInicio} hasta ${fechaFin}`);
        
        const facturas = await producto.getAllFacturas(fechaInicio, fechaFin);
        console.log('Facturas encontradas:', facturas);
        
        res.json(facturas);
    } catch (error) {
        console.error('Error al obtener facturas:', error);
        res.status(500).json({ error: 'Error al obtener facturas' });
    }
},
editPresupuesto : (req, res) => {
    const { id } = req.params;
    const { nombre_cliente, fecha, total, items } = req.body;

    console.log('Request received to edit presupuesto:', { id, nombre_cliente, fecha, total, items });
    producto.editarPresupuesto(id, nombre_cliente, fecha, total, items)
        .then(affectedRows => {
            console.log('Presupuesto editado exitosamente:', affectedRows);
            res.status(200).json({ message: 'Presupuesto editado exitosamente', affectedRows });
        })
        .catch(error => {
            console.error('Error al editar presupuesto:', error);
            res.status(500).json({ message: 'Error al editar presupuesto: ' + error.message });
        });
},
editarFacturas : (req, res) => {
    const { id } = req.params;
    const { nombre_cliente, fecha, total, items } = req.body;
    console.log('Request received to edit presupuesto:', { id, nombre_cliente, fecha, total, items });
    producto.editarFacturas(id, nombre_cliente, fecha, total, items)
        .then(affectedRows => {
            console.log('Presupuesto editado exitosamente:', affectedRows);
            res.status(200).json({ message: 'Presupuesto editado exitosamente', affectedRows });
        })
        .catch(error => {
            console.error('Error al editar presupuesto:', error);
            res.status(500).json({ message: 'Error al editar presupuesto: ' + error.message });
        });
},
presupuesto : (req, res) => {
    const id = req.params.id;
    producto.obtenerDetallePresupuesto(id)
        .then(data => {
            if (data && data.items.length > 0) {
                res.render('presupuesto', {
                    presupuesto: data.presupuesto,
                    detalles: data.items 
                });
            } else {
                res.status(404).send('Presupuesto no encontrado');
            }
        })
        .catch(error => {
            res.status(500).send('Error interno del servidor');
        });
},
factura: (req, res) => {
    const id = req.params.id;
    producto.obtenerDetalleFactura(id)
        .then(data => {
            if (data && data.items && data.items.length > 0) {
                // Enviar los datos como JSON
                res.json({
                    factura: data.factura,
                    items: data.items
                });
            } else {
                res.status(404).json({ message: 'Factura no encontrada o no tiene items.' });
            }
        })
        .catch(error => {
            console.error("Error al cargar detalles de la factura:", error);
            res.status(500).json({ message: 'Error interno del servidor' });
        });
},


deletePresupuesto : (req, res) => {
    const { id } = req.params;
    producto.eliminarPresupuesto(conexion, id)
        .then(affectedRows => {
            res.json({ message: 'Presupuesto eliminado exitosamente', affectedRows });
        })
        .catch(error => {
            res.status(500).json({ message: 'Error al eliminar presupuesto: ' + error.message });
        });
},

deleteFactura: (req, res) => {
    const { id } = req.params;
    producto.eliminarFactura(id)
        .then(affectedRows => {
            res.json({ message: 'Presupuesto eliminado exitosamente', affectedRows });
        })
        .catch(error => {
            res.status(500).json({ message: 'Error al eliminar presupuesto: ' + error.message });
        });
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
        const proveedor_id = req.body.proveedor;
        const file = req.files[0];
        let productosActualizados = [];
        let noEncontrados = []; // Array para guardar los códigos de productos no encontrados

        if (!proveedor_id || !file) {
            return res.status(400).send('Proveedor y archivo son requeridos.');
        }

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
                        let codigo = row[codigoColumn].toString().trim();
                        let precioRaw = row[precioColumn];

                        if (typeof precioRaw === 'number') precioRaw = precioRaw.toString();
                        const precio = parseFloat(precioRaw.replace(',', '.'));

                        if (!isNaN(precio) && precio > 0) {
                            promises.push(
                                producto.actualizarPreciosPDF(precio, codigo, proveedor_id)
                                    .then(async productosActualizadosTemp => {
                                        if (productosActualizadosTemp && productosActualizadosTemp.length > 0) {
                                            productosActualizados.push(...productosActualizadosTemp);
                                            for (const productoActualizado of productosActualizadosTemp) {
                                                await producto.asignarProveedorMasBarato(conexion, productoActualizado.codigo);
                                            }
                                        } else {
                                            noEncontrados.push(codigo); // Añadir a la lista de productos no encontrados
                                        }
                                    })
                                    .catch(error => console.log(`Error al actualizar el producto con el código ${codigo}:`, error))
                            );
                        }
                    }
                }
            }

            await Promise.all(promises);

            // Verifica si hay productos no encontrados
            if (noEncontrados.length > 0) {
                // Crear el PDF en memoria
                const doc = new PDFDocument();
                const bufferStream = new streamBuffers.WritableStreamBuffer();

                doc.pipe(bufferStream);
                doc.fontSize(16).text('Productos no encontrados en la base de datos', { align: 'center' });
                doc.moveDown();

                noEncontrados.forEach(codigo => {
                    doc.fontSize(12).text(`Código: ${codigo}`);
                });

                doc.end();

                // Espera a que el buffer esté listo y luego envíalo al cliente
                bufferStream.on('finish', () => {
                    const pdfData = bufferStream.getContents();
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', 'attachment; filename=productos_no_encontrados.pdf');
                    res.send(pdfData);
                });
            } else {
                // Si no hay productos no encontrados, redirige a la vista de productos actualizados
                res.render('productosActualizados', {
                    productos: productosActualizados,
                    mensaje: 'Todos los productos fueron actualizados correctamente.',
                    pdfPath: null
                });
            }

            // Eliminar el archivo subido después de procesarlo
            fs.unlinkSync(file.path);

        } else {
            res.status(400).send('Tipo de archivo no soportado. Por favor, sube un archivo .xlsx');
        }
    } catch (error) {
        console.log("Error durante el procesamiento de archivos", error);
        res.status(500).send(error.message);
    }
},
seleccionarProveedorMasBarato: async function(conexion, productoId) {
    try {
        const proveedores = await producto.obtenerProveedoresProducto(conexion, productoId);
        if (proveedores.length === 0) {
            throw new Error(`No se encontraron proveedores para el producto con ID ${productoId}`);
        }

        let proveedorMasBarato = proveedores[0];
        proveedores.forEach(proveedor => {
            const costoConIva = proveedor.precio_lista - (proveedor.precio_lista * (proveedor.descuento / 100));
            if (costoConIva < proveedorMasBarato.precio_lista - (proveedorMasBarato.precio_lista * (proveedorMasBarato.descuento / 100))) {
                proveedorMasBarato = proveedor;
            }
        });
        await producto.asignarProveedorMasBarato(conexion, productoId, proveedorMasBarato.proveedor_id);
    } catch (error) {
        console.error(`Error al seleccionar el proveedor más barato para el producto con ID ${productoId}:`, error);
        throw error; 
    }
},
generarPedidoManual: async (req, res) => {
    try {
        const proveedores = await producto.obtenerProveedores(conexion);
        res.render('pedidoManual', { proveedores });
    } catch (error) {
        console.error("Error al generar el pedido manual:", error);
        res.status(500).send("Error al generar el pedido manual: " + error.message);
    }
},
guardarPedido: async (req, res) => {
    try {
        const { proveedor_id, total, productos } = req.body;
        
        if (!proveedor_id || !total || productos.length === 0) {
            return res.status(400).json({ message: 'Datos del pedido incompletos' });
        }

        // Crear el pedido y obtener el ID del nuevo pedido
        const pedido_id = await producto.crearPedido(proveedor_id, total);
        
        // Verificar que el pedido se creó correctamente
        if (!pedido_id) {
            throw new Error('No se pudo crear el pedido');
        }

        // Iterar sobre los productos y crear los items del pedido
        for (let item of productos) { // Cambié 'producto' por 'item' para evitar el conflicto de nombres
            const { id, cantidad, costo_neto } = item;

            // Validar que los datos de cada producto sean correctos
            if (!id || !cantidad || !costo_neto) {
                throw new Error('Datos de producto incompletos');
            }

            // Calcular el subtotal
            const subtotal = cantidad * parseFloat(costo_neto);

            // Crear el item del pedido
            await producto.crearPedidoItem(pedido_id, id, cantidad, costo_neto, subtotal);
        }

        res.status(200).json({ message: 'Pedido guardado con éxito', pedido_id });
    } catch (err) {
        console.error('Error en guardarPedido:', err.message);
        res.status(500).json({ message: 'Error al guardar el pedido', error: err.message });
    }
}




} 