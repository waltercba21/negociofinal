const conexion = require('../config/conexion')
const producto = require('../models/producto')
const carrito = require('../models/carrito'); // Ajusta la ruta según corresponda
var borrar = require('fs');
const PDFDocument = require('pdfkit');
const blobStream  = require('blob-stream');
var streamBuffers = require('stream-buffers');
const xlsx = require('xlsx');
const fs = require('fs');
const pdfParse = require('pdf-parse');

    const adminEmails = ['walter@autofaros.com.ar'];

module.exports = {
    index : async (req, res) => {
        try {
            // Obtener los últimos 3 productos y los productos en oferta en paralelo
            const [productos, productosOferta] = await Promise.all([
                new Promise((resolve, reject) => {
                    producto.obtenerUltimos(conexion, 3, (error, resultado) => {
                        if (error) reject(error);
                        else resolve(resultado);
                    });
                }),
                new Promise((resolve, reject) => {
                    producto.obtenerProductosOferta(conexion, (error, resultado) => {
                        if (error) reject(error);
                        else resolve(resultado);
                    });
                })
            ]);
    
            console.log("✅ Productos en oferta obtenidos:", productosOferta); // Verificar que se están obteniendo
    
            let cantidadCarrito = 0;
    
            // Si el usuario está autenticado, obtenemos la cantidad de productos en el carrito
            if (req.session?.usuario) {
                const id_usuario = req.session.usuario.id;
    
                try {
                    const carritoActivo = await new Promise((resolve, reject) => {
                        carrito.obtenerCarritoActivo(id_usuario, (error, resultado) => {
                            if (error) reject(error);
                            else resolve(resultado);
                        });
                    });
    
                    if (carritoActivo && carritoActivo.length > 0) {
                        const id_carrito = carritoActivo[0].id;
    
                        const productosCarrito = await new Promise((resolve, reject) => {
                            carrito.obtenerProductosCarrito(id_carrito, (error, resultado) => {
                                if (error) reject(error);
                                else resolve(resultado);
                            });
                        });
    
                        cantidadCarrito = productosCarrito.length;
                    }
                } catch (error) {
                    console.error("❌ Error al obtener el carrito:", error);
                }
            }
    
            // Renderizar la vista con los datos obtenidos
            res.render('index', {
                productos,
                productosOferta,
                cantidadCarrito,
                producto: null // Evita error en head.ejs
            });
    
        } catch (error) {
            console.error("❌ Error en index:", error);
            return res.status(500).send("Error interno del servidor");
        }
    },
    lista: async function (req, res) {
        try {
            const pagina = req.query.pagina ? Number(req.query.pagina) : 1;
            const categoria = req.query.categoria ? Number(req.query.categoria) : undefined;
            const marca = req.query.marca ? Number(req.query.marca) : undefined;
            const modelo = req.query.modelo ? Number(req.query.modelo) : undefined;
            const productosPorPagina = 10;
    
            console.log("\n🔎 Consulta recibida con parámetros:", { pagina, categoria, marca, modelo });
    
            if ((marca && isNaN(marca)) || (modelo && isNaN(modelo)) || (categoria && isNaN(categoria))) {
                console.log("❌ Error: Algún parámetro no es un número válido.");
                return res.status(400).send("Parámetros inválidos.");
            }
    
            let productos = [];
    
            // **📌 Caso 1: Filtrar solo por categoría**
            if (categoria && !marca && !modelo) {
                console.log(`📌 Filtrando SOLO por categoría ID: ${categoria}`);
    
                productos = await new Promise((resolve, reject) => {
                    producto.obtenerProductosPorCategoria(conexion, categoria, (error, resultados) => {
                        if (error) {
                            console.error("❌ Error al obtener productos por categoría:", error);
                            return reject(error);
                        }
                        console.log(`✅ Productos encontrados para categoría ${categoria}:`, resultados.length);
                        resolve(resultados);
                    });
                });
    
            // **📌 Caso 2: Obtener productos con filtros avanzados**
            } else if (marca || modelo) {
                console.log(`📌 Filtrando con marca: ${marca}, modelo: ${modelo}`);
    
                productos = await new Promise((resolve, reject) => {
                    producto.obtenerPorFiltros(conexion, categoria, marca, modelo, pagina, (error, resultados) => {
                        if (error) {
                            console.error("❌ Error al obtener productos por filtros:", error);
                            return reject(error);
                        }
                        console.log(`✅ Productos encontrados con filtros:`, resultados.length);
                        resolve(resultados);
                    });
                });
    
            // **📌 Caso 3: No hay filtros → Mostrar todos los productos paginados**
            } else {
                console.log("📌 No hay filtros. Mostrando todos los productos paginados.");
    
                productos = await new Promise((resolve, reject) => {
                    producto.obtenerTodosPaginados(conexion, pagina, productosPorPagina, (error, resultados) => {
                        if (error) {
                            console.error("❌ Error al obtener todos los productos:", error);
                            return reject(error);
                        }
                        console.log(`✅ Productos obtenidos sin filtros:`, resultados.length);
                        resolve(resultados);
                    });
                });
            }
    
            // **📌 Si no hay productos, evitar errores posteriores**
            if (!productos || productos.length === 0) {
                console.log("⚠ No se encontraron productos con los filtros aplicados.");
                return res.render("productos", {
                    productos: [],
                    categorias: [],
                    marcas: [],
                    modelosPorMarca: [],
                    categoriaSeleccionada: "Todos",
                    numeroDePaginas: 1,
                    pagina: 1,
                    modelo: null,
                    req,
                    isUserLoggedIn: !!req.session.usuario,
                    isAdminUser: req.session.usuario && adminEmails.includes(req.session.usuario?.email),
                });
            }
    
            // **📌 Obtener categorías y marcas para la vista**
            const [categorias, marcas] = await Promise.all([
                producto.obtenerCategorias(conexion),
                producto.obtenerMarcas(conexion),
            ]);
    
            // **📌 Obtener modelos de la marca seleccionada (si aplica)**
            const modelosPorMarca = marca ? await producto.obtenerModelosPorMarca(conexion, marca) : [];
            const modeloSeleccionado = modelo ? modelosPorMarca.find(m => m.id === modelo) : null;
    
            // **📌 Obtener imágenes para los productos**
            const productoIds = productos.map(p => p.id);
    
            if (productoIds.length > 0) {
                console.log("📌 Buscando imágenes para productos:", productoIds);
    
                const todasLasImagenes = await producto.obtenerImagenesProducto(conexion, productoIds);
    
                productos.forEach(producto => {
                    producto.imagenes = todasLasImagenes.filter(img => img.producto_id === producto.id);
                    producto.precio_venta = producto.precio_venta ? parseFloat(producto.precio_venta) : "No disponible";
                });
            }
    
            console.log(`✅ Enviando ${productos.length} productos a la vista.`);
    
            // **✅ Renderizar la vista de productos**
            res.render("productos", {
                productos,
                categorias,
                marcas,
                modelosPorMarca,
                categoriaSeleccionada: categoria ? categorias.find(cat => cat.id === categoria)?.nombre : "Todos",
                numeroDePaginas: 1,
                pagina,
                modelo: modeloSeleccionado,
                req,
                isUserLoggedIn: !!req.session.usuario,
                isAdminUser: req.session.usuario && adminEmails.includes(req.session.usuario?.email),
            });
    
        } catch (error) {
            console.error("❌ Error en el controlador lista:", error);
            res.status(500).render("productos", {
                productos: [],
                categorias: [],
                marcas: [],
                modelosPorMarca: [],
                categoriaSeleccionada: "Todos",
                numeroDePaginas: 1,
                pagina: 1,
                modelo: null,
                req,
                isUserLoggedIn: !!req.session.usuario,
                isAdminUser: req.session.usuario && adminEmails.includes(req.session.usuario?.email),
            });
        }
    },
    
    ofertas: (req, res) => {
        producto.obtenerOfertas(conexion, (error, productos) => {
          if (error) {
            return res.status(500).send('Error al obtener los productos en oferta');
          } else {
            res.render('ofertas', { productos });
          }
        });
      },
    buscar: async (req, res) => {
        try {
            const { q: busqueda_nombre, categoria_id, marca_id, modelo_id } = req.query;
            
            req.session.busquedaParams = { busqueda_nombre, categoria_id, marca_id, modelo_id };
            
            const limite = req.query.limite ? parseInt(req.query.limite) : 100;

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
            } 
            
            if (!producto || producto.length === 0) {
                return res.status(404).send('Producto no encontrado');
            }
    
            // Formatear precio para la vista
            producto[0].precio_venta = Number(producto[0].precio_venta).toLocaleString('es-ES');
    
            let cantidadCarrito = 0;
    
            if (req.session && req.session.usuario) {
                const id_usuario = req.session.usuario.id;
    
                carrito.obtenerCarritoActivo(id_usuario, (error, carritoActivo) => {
                    if (carritoActivo && carritoActivo.length > 0) {
                        const id_carrito = carritoActivo[0].id;
    
                        carrito.obtenerProductosCarrito(id_carrito, (error, productosCarrito) => {
                            if (productosCarrito) {
                                cantidadCarrito = productosCarrito.length;
                            }
    
                            // Renderizar vista detalle con el producto y la cantidad en el carrito
                            res.render('detalle', { 
                                producto: producto[0], 
                                cantidadCarrito
                            });
                        });
                    } else {
                        res.render('detalle', { 
                            producto: producto[0], 
                            cantidadCarrito: 0
                        });
                    }
                });
            } else {
                res.render('detalle', { 
                    producto: producto[0], 
                    cantidadCarrito: 0
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
    guardar: function (req, res) {
        console.log("Inicio del controlador guardar...");
    
        // Verificar si el campo proveedores está presente y no está vacío
        console.log("req.body.proveedores:", req.body.proveedores);
        if (!req.body.proveedores || req.body.proveedores.length === 0) {
            res.status(400).send("Error: proveedor_id no puede ser nulo");
            return;
        }
    
        // Verificar si se recibieron archivos
        console.log("req.files:", req.files);
        if (!req.files || req.files.length === 0) {
            res.status(400).send("Error: no se cargaron archivos");
            return;
        }
    
        // Preparar los datos del producto
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
            oferta: req.body.oferta && req.body.oferta === '1' ? 1 : 0,
            calidad_original: req.body.calidad_original_fitam ? 1 : 0,
            calidad_vic: req.body.calidad_vic ? 1 : 0,
        };
    
        console.log("Datos preparados para insertar en productos:", datosProducto);
    
        // Intentar insertar el producto en la base de datos
        producto
            .insertarProducto(conexion, datosProducto)
            .then((result) => {
                console.log("Producto insertado con éxito. ID generado:", result.insertId);
                const productoId = result.insertId;
    
                // Manejar los proveedores asociados
                const codigos = req.body.codigo.split(",");
                console.log("Codigos de los productos:", codigos);
    
                const proveedores = req.body.proveedores.map((proveedorId, index) => {
                    return {
                        id: proveedorId,
                        codigo: codigos[index],
                        precio_lista: req.body.precio_lista[index],
                    };
                });
    
                console.log("Datos de los proveedores asociados:", proveedores);
    
                const promesasProveedor = proveedores.map((proveedor) => {
                    const datosProductoProveedor = {
                        producto_id: productoId,
                        proveedor_id: proveedor.id,
                        precio_lista: proveedor.precio_lista,
                        codigo: proveedor.codigo,
                    };
    
                    console.log("Datos para insertar en producto_proveedor:", datosProductoProveedor);
                    return producto.insertarProductoProveedor(conexion, datosProductoProveedor);
                });
    
                // Manejar las imágenes asociadas
                console.log("Archivos subidos (imágenes):", req.files);
                const promesasImagenes = req.files.map((file) => {
                    const datosImagen = { producto_id: productoId, imagen: file.filename };
                    console.log("Datos para insertar en imágenes:", datosImagen);
                    return producto.insertarImagenProducto(conexion, datosImagen);
                });
    
                // Ejecutar todas las promesas y capturar errores individuales
                return Promise.allSettled([...promesasProveedor, ...promesasImagenes]).then((results) => {
                    results.forEach((result, index) => {
                        if (result.status === "fulfilled") {
                            console.log(`Operación ${index + 1} completada con éxito:`, result.value);
                        } else {
                            console.error(`Operación ${index + 1} falló:`, result.reason);
                        }
                    });
                });
            })
            .then(() => {
                console.log("Todas las operaciones completadas con éxito.");
                res.redirect("/productos/panelControl");
            })
            .catch((error) => {
                console.error("Error durante la ejecución:", error.message);
                res.status(500).send("Error: " + error.message);
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
            productoResult.calidad_original_fitam = result.calidad_original_fitam;
            productoResult.calidad_vic = result.calidad_vic; 
            productoResult.paginaActual = req.query.pagina;
            productoResult.busqueda = req.query.busqueda;   

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
                    console.log('🔁 GET /productos/editar/:id');
                    console.log('🧩 req.query.pagina:', req.query.pagina);
                    console.log('🧩 req.query.busqueda:', req.query.busqueda);
                    console.log('📦 productoResult.paginaActual:', productoResult.paginaActual);
                    console.log('📦 productoResult.busqueda:', productoResult.busqueda);

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
        console.log("📩 POST recibido en actualizar");
        console.log("➡️ req.body.pagina:", req.body.pagina);
        console.log("➡️ req.body.busqueda:", req.body.busqueda);

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
            oferta: req.body.oferta && req.body.oferta === '1' ? 1 : 0,
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
                const pagina = req.body.pagina || 1;
                const busqueda = req.body.busqueda || '';
                console.log('📥 Redireccionando a:', `/productos/panelControl?pagina=${pagina}&busqueda=${encodeURIComponent(busqueda)}`);
                res.redirect(`/productos/panelControl?pagina=${pagina}&busqueda=${encodeURIComponent(busqueda)}`);
                
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
                productos = await producto.obtenerPorFiltros(conexion, categoriaSeleccionada, null, null, busqueda, 1000);
            } else {
                productos = await producto.obtenerTodos(conexion, saltar, productosPorPagina, categoriaSeleccionada);
            }
    
            // ✅ Normalizar productos: aseguramos 'categoria' e 'imagenes[]'
            productos = productos.map(p => ({
                ...p,
                categoria: p.categoria || p.categoria_nombre || 'Sin categoría',
                imagenes: Array.isArray(p.imagenes)
                    ? p.imagenes
                    : (p.imagen ? [p.imagen] : [])
            }));
    
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
                busquedaActual: busqueda,
            });
        } catch (error) {
            console.error('❌ Error en panelControl:', error);
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
        let proveedorSeleccionado = req.query.proveedor ? req.query.proveedor : null;
        let proveedor = {};

        if (proveedorSeleccionado) {
            proveedor = proveedores.find(p => p.id == proveedorSeleccionado) || {};
            productos = await producto.obtenerProductosPorProveedorYCategoría(conexion, proveedorSeleccionado);
        }

        res.render('modificarPorProveedor', { 
            proveedores, 
            productos, 
            proveedor, 
            proveedorSeleccionado  // 👉 Enviamos esta variable a la vista
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Hubo un error al obtener los datos');
    }
},
actualizarPorProveedor: function (req, res) {
    console.log("📌 Datos recibidos:", req.body);

    const proveedorId = req.body.proveedor && req.body.proveedor !== '' ? Number(req.body.proveedor) : null;
    const tipoCambio = req.body.tipoCambio;
    let porcentaje = req.body.porcentaje ? Number(req.body.porcentaje) / 100 : null;

    if (tipoCambio === 'descuento') porcentaje = -porcentaje;

    if (!proveedorId || isNaN(porcentaje)) {
        console.error("❌ Parámetros inválidos");
        return res.status(400).send("Error en los datos");
    }

    conexion.getConnection((err, conn) => {
        if (err) {
            console.error('❌ Error de conexión:', err);
            return res.status(500).send("Error de conexión");
        }

        producto.actualizarPreciosPorProveedorConCalculo(conn, proveedorId, porcentaje, (error, count) => {
            conn.release();

            if (error) {
                console.error("❌ Error al actualizar:", error);
                return res.redirect(`/productos/modificarPorProveedor?proveedor=${proveedorId}&error=Hubo un error`);
            }

            res.redirect(`/productos/modificarPorProveedor?proveedor=${proveedorId}&success=${count} productos actualizados`);
        });
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
        const proveedor = proveedores.find(p => p.id == proveedorId);
        if (!proveedor) {
            return res.status(400).send('Proveedor no encontrado');
        }
        const nombreProveedor = proveedor.nombre;
        doc.fontSize(20)
            .text(nombreProveedor, 0, 50, {
                align: 'center',
                width: doc.page.width
            });

        if (categoriaId) {
            const categorias = await producto.obtenerCategorias(conexion);
            const categoria = categorias.find(c => c.id == categoriaId);
            if (!categoria) {
                return res.status(400).send('Categoría no encontrada');
            }
            const nombreCategoria = categoria.nombre;
            doc.fontSize(12)
                .text(nombreCategoria, 0, doc.y, {
                    align: 'center',
                    width: doc.page.width
                });
            doc.moveDown(2);
        }

        const productos = await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, categoriaId);

        var currentY = doc.y;
        doc.fontSize(8)
            .text('Código', 20, currentY)
            .text('Descripción', 80, currentY)
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
            const precioListaFormateado = producto.precio_lista ? '$' + parseFloat(producto.precio_lista).toFixed(2) : 'N/A';
            const precioVentaFormateado = producto.precio_venta ? '$' + parseFloat(producto.precio_venta).toFixed(2) : 'N/A';
            currentY = doc.y;

            if (currentY + 20 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                currentY = doc.y;
            }

            doc.fontSize(8)
                .text(producto.codigo_proveedor, 20, currentY)
                .text(producto.nombre, 80, currentY, {
                    width: 400
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

        buffer.on('finish', function () {
            const pdfData = buffer.getContents();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=productos.pdf');
            res.send(pdfData);
        });
    } catch (error) {
        console.error('Error en generarPDF:', error);
        return res.status(500).send('Error al generar el PDF');
    }
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
    const PDFDocument = require('pdfkit');
    const streamBuffers = require('stream-buffers');
    const buffer = new streamBuffers.WritableStreamBuffer({
        initialSize: (1024 * 1024),
        incrementAmount: (1024 * 1024)
    });
    const doc = new PDFDocument;
    doc.pipe(buffer);

    const proveedorId = req.query.proveedor;
    const categoriaId = req.query.categoria;

    try {
        const proveedores = await producto.obtenerProveedores(conexion);
        const categorias = await producto.obtenerCategorias(conexion);

        let proveedor = proveedores.find(p => p.id == proveedorId);
        let categoria = categorias.find(c => c.id == categoriaId);

        const nombreProveedor = proveedor ? proveedor.nombre : 'Todos los proveedores';
        const nombreCategoria = categoria ? categoria.nombre : 'Todas las categorías';

        doc.fontSize(14)
           .text(`Listado de Stock - ${nombreProveedor} - ${nombreCategoria}`, {
               align: 'center',
               width: doc.page.width - 100
           });

        const productos = await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, categoriaId);

        // Generar tabla de productos
        let currentY = doc.y + 20;
        doc.fontSize(12)
           .fillColor('black')
           .text('Código', 60, currentY, { align: 'left', width: 100 })
           .text('Descripción', 150, currentY, { align: 'left', width: 220 })
           .text('Stock Mínimo', 400, currentY, { align: 'center', width: 80 })
           .text('Stock Actual', 480, currentY, { align: 'center', width: 80 })
           .moveDown(2);

        productos.forEach(producto => {
            if (producto.stock_actual < producto.stock_minimo) {
                currentY = doc.y;
                if (currentY + 50 > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    currentY = doc.y;
                }
                doc.fontSize(8)
                   .text(producto.codigo_proveedor, 60, currentY, { align: 'left', width: 100 })
                   .text(producto.nombre, 150, currentY, { align: 'left', width: 220 })
                   .text(producto.stock_minimo ? producto.stock_minimo.toString() : '0', 400, currentY, { align: 'center', width: 80 })
                   .text(producto.stock_actual ? producto.stock_actual.toString() : 'Sin Stock', 480, currentY, { align: 'center', width: 80 })
                   .moveDown(1);
            }
        });

        doc.end();
    } catch (error) {
        res.status(500).send('Error al generar el PDF');
    }

    buffer.on('finish', function () {
        const pdfData = buffer.getContents();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=productos.pdf');
        res.send(pdfData);
    });
},
generarPedidoPDF: async function (req, res) {
    const PDFDocument = require('pdfkit');
    const streamBuffers = require('stream-buffers');
    const buffer = new streamBuffers.WritableStreamBuffer({
        initialSize: (1024 * 1024),
        incrementAmount: (1024 * 1024)
    });
    const doc = new PDFDocument;
    doc.pipe(buffer);

    const proveedorId = req.query.proveedor;
    const categoriaId = req.query.categoria;

    try {
        const proveedores = await producto.obtenerProveedores(conexion);
        let proveedor = proveedores.find(p => p.id == proveedorId);
        const nombreProveedor = proveedor ? proveedor.nombre : 'Todos los proveedores';

        // Título centrado
        doc.fontSize(14)
           .text(`Pedido de Productos - ${nombreProveedor}`, {
               align: 'center',
               width: doc.page.width - 100
           });

        // Obtener productos
        const productos = await producto.obtenerProductosParaPedidoPorProveedorConStock(conexion, proveedorId, categoriaId);

        // Encabezado de la tabla ajustado
        let currentY = doc.y + 20;
        doc.fontSize(12)
           .fillColor('black')
           .text('Código', 60, currentY, { align: 'left', width: 80 })       // Más a la izquierda
           .text('Descripción', 150, currentY, { align: 'left', width: 250 }) // Ancho ampliado
           .text('Stock Mínimo', 420, currentY, { align: 'center', width: 80 })
           .text('Stock Actual', 500, currentY, { align: 'center', width: 80 })
           .moveDown(2);

        // Cuerpo de la tabla ajustado
        productos.forEach(producto => {
            currentY = doc.y;
            if (currentY + 50 > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
                currentY = doc.y;
            }
            doc.fontSize(8)
               .text(producto.codigo_proveedor, 60, currentY, { align: 'left', width: 80 })       // Más a la izquierda
               .text(producto.nombre, 150, currentY, { align: 'left', width: 250 })               // Ancho ampliado
               .text(producto.stock_minimo ? producto.stock_minimo.toString() : '0', 420, currentY, { align: 'center', width: 80 })
               .text(producto.stock_actual ? producto.stock_actual.toString() : 'Sin Stock', 500, currentY, { align: 'center', width: 80 })
               .moveDown(1);
        });

        doc.end();
    } catch (error) {
        console.log('Error al generar el PDF:', error);
        res.status(500).send('Error al generar el PDF');
    }

    buffer.on('finish', function () {
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
    console.log("🔍 Datos recibidos en el servidor:", req.body);

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
        const producto_id = await producto.obtenerProductoIdPorCodigo(item.producto_id, item.descripcion);
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
            const producto_id = await producto.obtenerProductoIdPorCodigo(item.producto_id, item.descripcion);
            
            if (!producto_id) {
                throw new Error(`Producto con ID ${item.producto_id} y descripción ${item.descripcion} no encontrado.`);
            }

            await producto.actualizarStockPresupuesto(producto_id, item.cantidad);

            return [
                facturaId, 
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
      const proveedor_id = req.body.proveedor; // Obtener el proveedor seleccionado
      const file = req.files[0]; // Suponiendo que multer está configurado para manejar archivos
      let productosActualizados = [];
  
      // Validar que se ha seleccionado un proveedor y que se ha subido un archivo
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
              let codigoRaw = row[codigoColumn];
              let precioRaw = row[precioColumn];
              
              let codigo = codigoRaw.toString().trim();
              
              if (typeof precioRaw === 'number') {
                precioRaw = precioRaw.toString();
              }
              
              if (typeof precioRaw === 'string') {
                const precio = parseFloat(precioRaw.replace(',', '.'));
                
                if (isNaN(precio) || precio <= 0) {
                  console.error(`Precio inválido para el código ${codigo}: ${precioRaw}`);
                  continue;
                }
                
                promises.push(
                  producto.actualizarPreciosPDF(precio, codigo, proveedor_id)
                    .then(async productosActualizadosTemp => {
                      if (productosActualizadosTemp && productosActualizadosTemp.length > 0) {
                        productosActualizados.push(...productosActualizadosTemp);
                        for (const productoActualizado of productosActualizadosTemp) {
                          const proveedorMasBarato = await producto.obtenerProveedorMasBarato(conexion, productoActualizado.codigo);
                          if (proveedorMasBarato) {
                            await producto.asignarProveedorMasBarato(conexion, productoActualizado.codigo, proveedorMasBarato.proveedor_id);
                          } else {
                            console.log(`No se encontró ningún proveedor para el producto con código ${productoActualizado.codigo}`);
                          }
                        }
                      } else {
                        console.log(`No se encontró ningún producto con el código ${codigo} en la base de datos.`);
                        return { noExiste: true, codigo: codigo };
                      }
                    })
                    .catch(error => {
                      console.log(`Error al actualizar el producto con el código ${codigo}:`, error);
                      return { error: true, message: `Error al actualizar el producto con el código ${codigo}: ${error.message}` };
                    })
                );
              } else {
                console.error(`Tipo de dato no esperado para el precio en el código ${codigo}: ${typeof precioRaw}`);
              }
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
        
        // Eliminar el archivo subido después de procesarlo
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
  },
  seleccionarProveedorMasBarato : async (conexion, productoId) => {
    try {
      const proveedorMasBarato = await producto.obtenerProveedorMasBarato(conexion, productoId);
      if (proveedorMasBarato) {
        await producto.asignarProveedorMasBarato(conexion, productoId, proveedorMasBarato.proveedor_id);
      } else {
        console.log(`No se encontró ningún proveedor para el producto con ID ${productoId}`);
      }
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