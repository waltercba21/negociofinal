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
    function normalizarClave(texto) {
      return texto
        .normalize("NFD")                        
        .replace(/[\u0300-\u036f]/g, "")        
        .replace(/\s+/g, '')                     
        .toLowerCase();                          
    }
const productosPorPagina = 10; 
module.exports = {
    index: async (req, res) => {
        try {
          // Obtener últimos 3 productos y últimas 12 ofertas en paralelo
          const [productos, productosOfertaRaw] = await Promise.all([
            new Promise((resolve, reject) => {
              producto.obtenerUltimos(conexion, 3, (error, resultado) => {
                if (error) reject(error);
                else resolve(resultado);
              });
            }),
            new Promise((resolve, reject) => {
              producto.obtenerUltimasOfertas(conexion, 12, (error, resultado) => {
                if (error) reject(error);
                else resolve(resultado);
              });
            })
          ]);
      
          // Obtener imágenes de productos en oferta
          const productoIds = productosOfertaRaw.map(p => p.id);
          const imagenes = await producto.obtenerImagenesProducto(conexion, productoIds);
      
          // Asociar imágenes a cada producto de oferta
          const productosOferta = productosOfertaRaw.map(producto => {
            const imgs = imagenes
              .filter(img => img.producto_id === producto.id)
              .map(img => img.imagen);
            return {
              ...producto,
              imagenes: imgs
            };
          });
      
          let cantidadCarrito = 0;
      
          // Si el usuario está logueado, obtener cantidad de productos en el carrito
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
      
          // Renderizar vista con todos los datos
          res.render('index', {
            productos,
            productosOferta,
            cantidadCarrito,
            producto: null // para evitar error en head.ejs
          });
      
        } catch (error) {
          console.error("❌ Error en index:", error);
          return res.status(500).send("Error interno del servidor");
        }
      },      
lista: async function (req, res) {
    try {
      /** ───────────────────────────
       * 1. Parámetros y validaciones
       * ─────────────────────────── */
      const pagina    = req.query.pagina    ? Number(req.query.pagina)    : 1;
      const categoria = req.query.categoria ? Number(req.query.categoria) : undefined;
      const marca     = req.query.marca     ? Number(req.query.marca)     : undefined;
      const modelo    = req.query.modelo    ? Number(req.query.modelo)    : undefined;

      console.log("\n🔎 Consulta recibida:", { pagina, categoria, marca, modelo });

      if (
        (categoria && isNaN(categoria)) ||
        (marca     && isNaN(marca))     ||
        (modelo    && isNaN(modelo))
      ) {
        console.log("❌ Parámetros inválidos.");
        return res.status(400).send("Parámetros inválidos.");
      }

      const seHizoBusqueda  = !!(categoria || marca || modelo);
      let   productos       = [];
      let   numeroDePaginas = 1;               // ← se recalcula cuando toca

      /** ───────────────────────────
       * 2. Consulta de productos
       * ─────────────────────────── */
      if (seHizoBusqueda) {

        /* ========= A) Solo CATEGORÍA ========= */
        if (categoria && !marca && !modelo) {
          const offset = (pagina - 1) * productosPorPagina;

          // Nueva función paginada que creaste en el modelo
          const { productos: listaCategoria, total } =
                await producto.obtenerProductosPorCategoriaPaginado(
                       conexion, categoria, offset, productosPorPagina);

          productos       = listaCategoria;
          numeroDePaginas = Math.max(1, Math.ceil(total / productosPorPagina));

        /* ========= B) Filtros combinados (marca / modelo) ========= */
        } else {
          console.log(`📌 Filtros combinados — marca: ${marca} modelo: ${modelo}`);

          const offset = (pagina - 1) * productosPorPagina;

          // Si aún no tienes un método paginado, implementa uno similar.
          // Mientras tanto, este ejemplo supone que el método devuelve { productos, total }
          const { productos: listaFiltros, total } =
                await producto.obtenerPorFiltrosPaginado(
                       conexion, { categoria, marca, modelo }, offset, productosPorPagina);

          productos       = listaFiltros;
          numeroDePaginas = Math.max(1, Math.ceil(total / productosPorPagina));
        }

        /* ========= Carga de imágenes y proveedor más barato ========= */
        const productoIds = productos.map(p => p.id);
        if (productoIds.length) {
          const todasLasImagenes = await producto.obtenerImagenesProducto(conexion, productoIds);

          for (const prod of productos) {
            prod.imagenes     = todasLasImagenes.filter(img => img.producto_id === prod.id);
            prod.precio_venta = prod.precio_venta ? parseFloat(prod.precio_venta) : "No disponible";

            const proveedor = await producto.obtenerProveedorMasBaratoPorProducto(conexion, prod.id);
            prod.proveedor_nombre  = proveedor ? proveedor.proveedor_nombre  : "Sin proveedor";
            prod.codigo_proveedor  = proveedor ? proveedor.codigo_proveedor  : "";
          }
        }
      } else {
        console.log("🛑 Sin filtros: no se mostrarán productos.");
      }

      /** ───────────────────────────
       * 3. Cargar selectores y ordenar
       * ─────────────────────────── */
      const [categorias, marcas] = await Promise.all([
        producto.obtenerCategorias(conexion),
        producto.obtenerMarcas(conexion),
      ]);

      let modelosPorMarca = marca
        ? await producto.obtenerModelosPorMarca(conexion, marca)
        : [];

      // Función de orden “inteligente” de modelos
      const normalizarModelo = (nombre) => {
        const partes = nombre.split("/");
        if (partes.length === 2 && !isNaN(partes[0]) && !isNaN(partes[1])) {
          return parseInt(partes[0]) + parseInt(partes[1]) / 100;
        }
        const match = nombre.match(/\d+/g);
        return match ? parseInt(match.join("")) : Number.MAX_SAFE_INTEGER;
      };

      categorias.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
      marcas.sort    ((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
      modelosPorMarca.sort((a, b) => normalizarModelo(a.nombre) - normalizarModelo(b.nombre));

      const modeloSeleccionado = modelo ? modelosPorMarca.find(m => m.id === modelo) : null;

      /** ───────────────────────────
       * 4. Render de la vista
       * ─────────────────────────── */
      res.render("productos", {
        productos,
        categorias,
        marcas,
        modelosPorMarca,
        categoriaSeleccionada : categoria
          ? categorias.find(cat => cat.id === categoria)?.nombre
          : "Todos",
        numeroDePaginas,
        pagina,
        modelo                : modeloSeleccionado,
        req,
        seHizoBusqueda,
        isUserLoggedIn        : !!req.session.usuario,
        isAdminUser           : req.session.usuario &&
                                 adminEmails.includes(req.session.usuario?.email),
      });

    } catch (error) {
      console.error("❌ Error en productosController.lista:", error);

      // Render de emergencia para no romper UX
      res.status(500).render("productos", {
        productos       : [],
        categorias      : [],
        marcas          : [],
        modelosPorMarca : [],
        categoriaSeleccionada : "Todos",
        numeroDePaginas : 1,
        pagina          : 1,
        modelo          : null,
        seHizoBusqueda  : false,
        req,
        isUserLoggedIn  : !!req.session.usuario,
        isAdminUser     : req.session.usuario &&
                          adminEmails.includes(req.session.usuario?.email),
      });
    }
  },
      ofertas: async function (req, res) {
        try {
          const isUserLoggedIn = !!req.session.usuario;
          const isAdminUser = isUserLoggedIn && req.session.usuario.rol === 'admin';
      
          const paginaSolicitada = parseInt(req.query.pagina) || 1;
          const productosPorPagina = 20;
      
          const categoriaSeleccionada = req.query.categoria_id || '';
          const marcaSeleccionada = req.query.marca_id || '';
      
          // 🔍 Obtener categorías y marcas para los filtros
          const categorias = await producto.obtenerCategorias(conexion);
          const marcas = await producto.obtenerMarcas(conexion);
      
          // 🔍 Obtener productos en oferta aplicando filtros
          const todosLosProductos = await new Promise((resolve, reject) => {
            producto.obtenerProductosOfertaFiltrados(conexion, {
              categoria_id: categoriaSeleccionada,
              marca_id: marcaSeleccionada
            }, (error, resultados) => {
              if (error) {
                console.error("❌ Error al obtener productos en oferta filtrados:", error);
                return reject(error);
              }
              resolve(resultados);
            });
          });
      
          const totalProductos = todosLosProductos.length;
          const numeroDePaginas = Math.ceil(totalProductos / productosPorPagina);
          const pagina = Math.min(Math.max(paginaSolicitada, 1), numeroDePaginas || 1);
      
          const inicio = (pagina - 1) * productosPorPagina;
          const productosPagina = todosLosProductos.slice(inicio, inicio + productosPorPagina);
      
          // 🔄 Cargar imágenes para los productos de esta página
          const productoIds = productosPagina.map(p => p.id);
          if (productoIds.length > 0) {
            const todasLasImagenes = await producto.obtenerImagenesProducto(conexion, productoIds);
            productosPagina.forEach(producto => {
              producto.imagenes = todasLasImagenes.filter(img => img.producto_id === producto.id);
              producto.precio_venta = producto.precio_venta
                ? Math.round(parseFloat(producto.precio_venta))
                : "No disponible";
            });
          }
      
          console.log(`✅ Mostrando página ${pagina} de ofertas filtradas con ${productosPagina.length} productos`);
      
          res.render("ofertas", {
            productos: productosPagina,
            categorias,
            marcas,
            categoriaSeleccionada,
            marcaSeleccionada,
            isUserLoggedIn,
            isAdminUser,
            pagina,
            numeroDePaginas
          });
      
        } catch (error) {
          console.error("❌ Error en el controlador ofertas:", error);
          res.status(500).render("ofertas", {
            productos: [],
            categorias: [],
            marcas: [],
            categoriaSeleccionada: '',
            marcaSeleccionada: '',
            isUserLoggedIn: !!req.session.usuario,
            isAdminUser: req.session.usuario && req.session.usuario.rol === 'admin',
            pagina: 1,
            numeroDePaginas: 1
          });
        }
      },      
   buscar: async (req, res) => {
  try {
    const { q: busqueda_nombre, categoria_id, marca_id, modelo_id } = req.query;
    req.session.busquedaParams = { busqueda_nombre, categoria_id, marca_id, modelo_id };

    const limite = req.query.limite ? parseInt(req.query.limite) : 100;

    const productos = await producto.obtenerPorFiltros(
      conexion,
      categoria_id,
      marca_id,
      modelo_id,
      busqueda_nombre,
      limite
    );

    const productoIds = productos.map(p => p.id);
    const todasLasImagenes = await producto.obtenerImagenesProducto(conexion, productoIds);

    for (const prod of productos) {
      // Agregar imágenes
      prod.imagenes = todasLasImagenes.filter(img => img.producto_id === prod.id);

      // Obtener todos los proveedores del producto
      const proveedores = await producto.obtenerProveedoresPorProducto(conexion, prod.id);
      prod.proveedores = proveedores;

      // Buscar el proveedor más barato (si tenés esta lógica)
      const proveedorMasBarato = await producto.obtenerProveedorMasBaratoPorProducto(conexion, prod.id);

      prod.proveedor_nombre = proveedorMasBarato?.proveedor_nombre || 'Sin proveedor';
      prod.codigo_proveedor = proveedorMasBarato?.codigo_proveedor || '-';
    }

    res.json(productos);
  } catch (error) {
    console.error("❌ Error en /productos/api/buscar:", error);
    res.status(500).json({ error: 'Ocurrió un error al buscar productos.' });
  }
},

    detalle: async function (req, res) {
        const id = req.params.id;
      
        try {
          const productoData = await new Promise((resolve, reject) => {
            producto.obtenerPorId(conexion, id, (error, resultado) => {
              if (error) return reject(error);
              resolve(resultado);
            });
          });
      
          if (!productoData || productoData.length === 0) {
            return res.status(404).send('Producto no encontrado');
          }
      
          productoData[0].precio_venta = parseFloat(productoData[0].precio_venta);

      
          const imagenes = await producto.obtenerImagenesProducto(conexion, [productoData[0].id]);
          productoData[0].imagenes = imagenes || [];
      
          const isUserLoggedIn = !!req.session.usuario;
          const isAdminUser = isUserLoggedIn && req.session.usuario.rol === 'admin';
      
          let cantidadCarrito = 0;
      
          if (isUserLoggedIn) {
            const id_usuario = req.session.usuario.id;
            const carritoActivo = await new Promise((resolve, reject) => {
              carrito.obtenerCarritoActivo(id_usuario, (error, resultado) => {
                if (error) return reject(error);
                resolve(resultado);
              });
            });
      
            if (carritoActivo && carritoActivo.length > 0) {
              const id_carrito = carritoActivo[0].id;
              const productosCarrito = await new Promise((resolve, reject) => {
                carrito.obtenerProductosCarrito(id_carrito, (error, resultado) => {
                  if (error) return reject(error);
                  resolve(resultado);
                });
              });
      
              cantidadCarrito = productosCarrito.length;
            }
          }
      
          res.render('detalle', {
            producto: productoData[0],
            cantidadCarrito,
            isUserLoggedIn,
            isAdminUser
          });
      
        } catch (error) {
          console.log('Error en detalle:', error);
          return res.status(500).send('Error interno del servidor');
        }
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
                categorias,
                marcas,
                modelos,
                proveedores,
                preciosConDescuento,
                utilidad: req.body.utilidad,
                descuentoProveedor,
                producto: { oferta: 0 } 
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
            oferta: Number(req.body.oferta) === 1 ? 1 : 0,
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
  if (!req.body.proveedores || req.body.proveedores.length === 0) {
    res.status(400).send('Error: proveedor_id no puede ser nulo');
    return;
  }

  // Arrays que vienen del form
  const arrProveedores = req.body.proveedores;             // [proveedor_id,...]
  const arrDescuentos  = req.body.descuentos_proveedor_id; // [%...]
  const arrCostoNeto   = req.body.costo_neto;              // [...]
  const arrIVA         = req.body.IVA;                     // [...]
  const arrCostoIVA    = req.body.costo_iva;               // [...]

  // 1) Determinar índice base
  let idx = null;
  if (typeof req.body.proveedor_designado !== 'undefined' && req.body.proveedor_designado !== '') {
    idx = parseInt(req.body.proveedor_designado, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= arrProveedores.length) idx = null;
  }

  if (idx === null) {
    // fallback: más barato por costo_iva
    let min = Infinity, minIdx = 0;
    (arrCostoIVA || []).forEach((v, i) => {
      const n = parseFloat(v);
      if (!Number.isNaN(n) && n < min) { min = n; minIdx = i; }
    });
    idx = minIdx;
  }

  // 2) Armar datos coherentes usando el índice elegido
  const proveedorElegidoId = Array.isArray(arrProveedores) ? arrProveedores[idx] : arrProveedores;
  const descuentoElegido   = Array.isArray(arrDescuentos)  ? arrDescuentos[idx]  : arrDescuentos;
  const costoNetoElegido   = Array.isArray(arrCostoNeto)   ? arrCostoNeto[idx]   : arrCostoNeto;
  const ivaElegido         = Array.isArray(arrIVA)         ? arrIVA[idx]         : arrIVA;
  const costoIvaElegido    = Array.isArray(arrCostoIVA)    ? arrCostoIVA[idx]    : arrCostoIVA;

  let datosProducto = {
    id: req.body.id,
    nombre: req.body.nombre,
    descripcion: req.body.descripcion,
    categoria_id: req.body.categoria,
    marca_id: req.body.marca,
    modelo_id: req.body.modelo_id,
    utilidad: req.body.utilidad,
    precio_venta: req.body.precio_venta,  // lo revalidamos abajo
    estado: req.body.estado,
    paginaActual: req.body.paginaActual,
    stock_minimo: req.body.stock_minimo,
    stock_actual: req.body.stock_actual,

    // 👇 ahora NO usamos [0], usamos el índice elegido
    descuentos_proveedor_id: descuentoElegido,
    costo_neto: costoNetoElegido,
    IVA: ivaElegido,
    costo_iva: costoIvaElegido,

    // checkboxes
    oferta: Array.isArray(req.body.oferta) ? (req.body.oferta.includes('1') ? 1 : 0) : Number(req.body.oferta) || 0,
    calidad_original: req.body.calidad_original ? 1 : 0,
    calidad_vic: req.body.calidad_vic ? 1 : 0,

    // 👇 guardar el proveedor designado (o el más barato si no había designado)
    proveedor_id: proveedorElegidoId
  };

  // 🔄 Redondeo del precio de venta (y opcionalmente recalcular)
  const redondearPrecioVenta = (precio) => {
    const valor = Number(precio) || 0;
    const resto = valor % 100;
    return resto < 50 ? valor - resto : valor + (100 - resto);
  };

  // (Opcional) recalcular server-side por coherencia
  if (datosProducto.utilidad && costoIvaElegido) {
    const u = parseFloat(datosProducto.utilidad) || 0;
    const base = parseFloat(costoIvaElegido) || 0;
    const pvCalc = Math.ceil(base * (1 + u / 100));
    datosProducto.precio_venta = pvCalc;
  }

  if (datosProducto.precio_venta) {
    datosProducto.precio_venta = redondearPrecioVenta(datosProducto.precio_venta);
  }

  producto.actualizar(conexion, datosProducto)
    .then(() => {
      if (req.files) {
        const promesasArchivos = req.files.map(file => producto.actualizarArchivo(conexion, datosProducto, file));
        return Promise.all(promesasArchivos);
      } else {
        return Promise.resolve();
      }
    })
    .then(() => {
      const proveedores = req.body.proveedores.map((proveedorId, index) => ({
        producto_id: datosProducto.id,
        proveedor_id: proveedorId,
        precio_lista: req.body.precio_lista[index],
        codigo: req.body.codigo[index]
      }));
      const promesasProveedor = proveedores.map((proveedor) => producto.actualizarProductoProveedor(conexion, proveedor));
      return Promise.all(promesasProveedor);
    })
    .then(() => producto.actualizarStock(conexion, datosProducto.id, datosProducto.stock_minimo, datosProducto.stock_actual))
    .then(() => producto.obtenerPosicion(conexion, datosProducto.id))
    .then(() => {
      const pagina = req.body.paginaActual || 1;
      const busqueda = req.body.busqueda || '';
      res.redirect(`/productos/panelControl?pagina=${pagina}&busqueda=${encodeURIComponent(busqueda)}`);
      console.log("🔁 REDIRECT a panelControl:", `/productos/panelControl?pagina=${pagina}&busqueda=${encodeURIComponent(busqueda)}`);
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

    let busqueda = '';

    // 🔥 ESTA PARTE NUEVA
    if (!req.query.busqueda && req.session.busqueda) {
      console.log("🧹 Limpiando búsqueda de la sesión...");
      req.session.busqueda = null;
    }

    // 📚 Después sigue el flujo normal
    if (typeof req.query.busqueda === 'string') {
      busqueda = req.query.busqueda.trim();
      req.session.busqueda = busqueda;
    } else if (typeof req.session.busqueda === 'string') {
      busqueda = req.session.busqueda.trim();
    }

    console.log("🧩 Busqueda recibida en panelControl:", busqueda);

    const productosPorPagina = 30;
    const saltar = (paginaActual - 1) * productosPorPagina;

    let productos;
    if (busqueda) {
      productos = await producto.obtenerPorFiltros(conexion, categoriaSeleccionada, null, null, busqueda, 1000);

      const productoIds = productos.map(p => p.id);
      if (productoIds.length > 0) {
        const imagenesPorProducto = await producto.obtenerImagenesProducto(conexion, productoIds);

        productos = productos.map(producto => ({
          ...producto,
          imagenes: imagenesPorProducto
            .filter(img => img.producto_id === producto.id)
            .map(img => img.imagen),
          categoria: producto.categoria || producto.categoria_nombre || 'Sin categoría'
        }));
      }
    } else {
      productos = await producto.obtenerTodos(conexion, saltar, productosPorPagina, categoriaSeleccionada);

      productos = productos.map(producto => ({
        ...producto,
        categoria: producto.categoria || producto.categoria_nombre || 'Sin categoría',
        imagenes: Array.isArray(producto.imagenes)
          ? producto.imagenes
          : (producto.imagen ? [producto.imagen] : [])
      }));
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

            doc.fontSize(7)
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
generarPDFProveedor: async function (req, res) {
  const PDFDocument = require('pdfkit');
  const streamBuffers = require('stream-buffers');
  const buffer = new streamBuffers.WritableStreamBuffer({
    initialSize: 1024 * 1024,
    incrementAmount: 1024 * 1024
  });

  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(buffer);

  // Normalizamos parámetros
  const proveedorIdRaw = req.query.proveedor;
  const categoriaIdRaw = req.query.categoria;
  const tipo = req.query.tipo;

  const proveedorId = (!proveedorIdRaw || proveedorIdRaw === 'TODOS') ? null : proveedorIdRaw;
  const categoriaId = (!categoriaIdRaw || categoriaIdRaw === 'TODAS' || categoriaIdRaw === '') ? null : categoriaIdRaw;

  try {
    const proveedores = await producto.obtenerProveedores(conexion);
    const categorias = await producto.obtenerCategorias(conexion);
    const proveedor = proveedorId ? proveedores.find(p => String(p.id) === String(proveedorId)) : null;
    const categoria = categoriaId ? categorias.find(c => String(c.id) === String(categoriaId)) : null;

    const nombreProveedor = proveedor ? proveedor.nombre : 'Todos los proveedores';
    const nombreCategoria = categoria ? categoria.nombre : 'Todas las categorías';

    // Título
    const titulos = {
      pedido: `Faltantes (Proveedor más barato) - ${nombreProveedor}${categoria ? ' - ' + nombreCategoria : ''}`,
      asignado: `Asignados al proveedor - ${nombreProveedor}${categoria ? ' - ' + nombreCategoria : ''}`,
      porCategoria: `Stock por categoría - ${nombreCategoria}${proveedor ? ' - ' + nombreProveedor : ''}`,
      categoriaProveedorMasBarato: `Proveedor más barato por categoría - ${nombreProveedor} - ${nombreCategoria}`,
      stock: `Stock - ${nombreProveedor}${categoria ? ' - ' + nombreCategoria : ''}`
    };
    const titulo = titulos[tipo] || `Stock - ${nombreProveedor}${categoria ? ' - ' + nombreCategoria : ''}`;

    doc.fontSize(14).text(titulo, { align: 'center', width: doc.page.width - 60 });
    doc.moveDown(1.5);

    // Obtener productos según tipo (reutilizamos tus queries)
    let productos = [];
    if (tipo === 'pedido') {
      productos = await producto.obtenerProductosProveedorMasBaratoConStock(conexion, proveedorId, categoriaId);
    } else if (tipo === 'asignado') {
      if (!proveedorId) {
        // Para "Asignados" tiene sentido exigir proveedor
        productos = [];
      } else {
        productos = await producto.obtenerProductosAsignadosAlProveedor(conexion, proveedorId, categoriaId);
      }
    } else if (tipo === 'porCategoria') {
      if (!categoriaId) {
        // Si pide por categoría pero viene "TODAS", degradamos a stock completo
        productos = await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, null);
      } else {
        productos = await producto.obtenerProductosPorCategoria(conexion, categoriaId);
      }
    } else if (tipo === 'categoriaProveedorMasBarato') {
      if (!proveedorId || !categoriaId) {
        productos = []; // hace falta ambos
      } else {
        productos = await producto.obtenerProductosPorCategoriaYProveedorMasBarato(conexion, proveedorId, categoriaId);
      }
    } else {
      // stock (completo / filtrado)
      productos = await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, categoriaId);
    }

    // Log previo
    console.log("✅ Productos obtenidos:", productos?.length || 0);

    // Deduplicado por id (ahora sí llega p.id en todos los queries que usamos acá)
    productos = (productos || []).filter((v, i, self) => {
      return i === self.findIndex(t => String(t.id || '') === String(v.id || ''));
    });

    if (!productos.length) {
      doc.fontSize(12).fillColor('red').text('No hay productos que cumplan los criterios.');
      doc.end();
      buffer.on('finish', function () {
        const pdfData = buffer.getContents();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=productos.pdf');
        res.send(pdfData);
      });
      return;
    }

    // === Encabezado (reutilizable) ===
    const drawHeader = (cols) => {
      doc.fontSize(10).fillColor('black');
      const y = doc.y;
      let x = 40;
      cols.forEach(col => {
        doc.text(col.t, x, y, { width: col.w, align: col.a || 'left' });
        x += col.w;
      });
      doc.moveDown(1.2);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.6);
    };

    // === Fila (reutilizable) ===
    const drawRow = (vals) => {
      if (doc.y + 20 > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
      }
      doc.fontSize(8).fillColor('black');
      const y = doc.y;
      let x = 40;
      vals.forEach(v => {
        doc.text(v.t, x, y, { width: v.w, align: v.a || 'left' });
        x += v.w;
      });
      doc.moveDown(0.6);
    };

    // Config columnas por tipo
    const COLS_STOCK = [
      { t: 'Código',       w: 80 },
      { t: 'Descripción',  w: 290 },
      { t: 'Stock Mín.',   w: 80, a: 'center' },
      { t: 'Stock Act.',   w: 90, a: 'center' },
    ];

    const COLS_SIMPLE = [
      { t: 'Código',       w: 100 },
      { t: 'Descripción',  w: 330 },
      { t: 'Stock Act.',   w: 100, a: 'center' },
    ];

    // Render según tipo
    if (tipo === 'porCategoria' || tipo === 'categoriaProveedorMasBarato') {
      drawHeader(COLS_SIMPLE);
      productos.forEach(p => {
        drawRow([
          { t: (p.codigo_proveedor || p.codigo || '-'), w: 100 },
          { t: p.nombre || '-',                         w: 330 },
          { t: (p.stock_actual != null ? String(p.stock_actual) : '0'), w: 100, a: 'center' },
        ]);
      });
    } else {
      drawHeader(COLS_STOCK);
      productos.forEach(p => {
        // Para "stock": mostrar todos; para otros (pedido/asignado) solo faltantes
        const mostrar = (tipo === 'stock') || (Number(p.stock_actual) < Number(p.stock_minimo || 0));
        if (!mostrar) return;

        drawRow([
          { t: (p.codigo_proveedor || p.codigo || '-'), w: 80 },
          { t: p.nombre || '-',                         w: 290 },
          { t: (p.stock_minimo != null ? String(p.stock_minimo) : '0'), w: 80, a: 'center' },
          { t: (p.stock_actual != null ? String(p.stock_actual) : '0'), w: 90, a: 'center' },
        ]);
      });
    }

    doc.end();

  } catch (error) {
    console.error('❌ Error al generar el PDF:', error);
    return res.status(500).send('Error al generar el PDF');
  }

  buffer.on('finish', function () {
    const pdfData = buffer.getContents();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=productos.pdf');
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
        const siguienteIDFactura = await producto.obtenerSiguienteIDFactura(); 
        res.render('facturasMostrador', { idFactura: siguienteIDFactura }); 
    } catch (error) {
        res.status(500).send('Error al obtener el siguiente ID de factura.');
    }
},
procesarFormulario: async (req, res) => {
  console.log("🔍 Datos recibidos en el servidor:", req.body);

  try {
      const { nombreCliente, fechaPresupuesto, totalPresupuesto, invoiceItems } = req.body;
      const totalLimpio = totalPresupuesto.replace('$', '').replace(',', '');

      const fechaHoraActual = new Date();
      const creadoEn = fechaHoraActual.toISOString().slice(0, 19).replace('T', ' ');

      const presupuesto = {
          nombre_cliente: nombreCliente,
          fecha: fechaPresupuesto,
          total: totalLimpio,
          creado_en: creadoEn 
      };

      const presupuestoId = await producto.guardarPresupuesto(presupuesto);

      const items = await Promise.all(invoiceItems.map(async item => {
          const producto_id = await producto.obtenerProductoIdPorCodigo(item.producto_id, item.descripcion);

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
        const totalLimpio = totalPresupuesto.replace('$', '').replace(',', '');
        const metodosPagoString = Array.isArray(metodosPago) ? metodosPago.join(', ') : metodosPago;

        const fechaHoraActual = new Date();
        const creadoEn = fechaHoraActual.toISOString().slice(0, 19).replace('T', ' ');

        const factura = {
            nombre_cliente: nombreCliente,
            fecha: fechaPresupuesto,
            total: totalLimpio,
            metodos_pago: metodosPagoString,
            creado_en: creadoEn
        };

        const facturaId = await producto.guardarFactura(factura);

        if (!Array.isArray(invoiceItems) || invoiceItems.length === 0) {
            return res.status(400).json({ error: 'No se proporcionaron items de factura.' });
        }

        const items = await Promise.all(invoiceItems.map(async item => {
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

        await producto.guardarItemsFactura(items);

        res.status(200).json({ message: 'FACTURA GUARDADA CORRECTAMENTE' });

    } catch (error) {
        console.error('Error al guardar la factura:', error);
        res.status(500).json({ error: 'Error al guardar la factura: ' + error.message });
    }
},
listadoPresupuestos: (req, res) => {
  const { fechaInicio, fechaFin } = req.query;

  // Si no se pasaron fechas, se usa la de hoy
  const hoy = new Date().toISOString().split('T')[0];

  res.render('listadoPresupuestos', {
      fechaInicio: fechaInicio || hoy,
      fechaFin: fechaFin || hoy
  });
},
listaFacturas: (req, res) => {
  const { fechaInicio, fechaFin } = req.query;
  const hoy = new Date().toISOString().split('T')[0];
  res.render('listaFacturas', {
    fechaInicio: fechaInicio || hoy,
    fechaFin: fechaFin || hoy
  });
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
        
        const facturas = await producto.getAllFacturas(fechaInicio, fechaFin);
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
                res.json({
                    factura: data.factura,
                    items: data.items
                });
            } else {
                res.status(404).json({ message: 'Factura no encontrada o no tiene items.' });
            }
        })
        .catch(error => {
            res.status(500).json({ message: 'Error interno del servidor' });
        });
},
facturaVista: async (req, res) => {
  const id = req.params.id;
  try {
    const data = await producto.obtenerDetalleFactura(id);
    if (data && data.items.length > 0) {
      res.render('factura', {
        factura: data.factura,
        detalles: data.items
      });
    } else {
      res.status(404).send('Factura no encontrada o no tiene productos.');
    }
  } catch (error) {
    console.error('Error al cargar factura:', error);
    res.status(500).send('Error interno del servidor');
  }
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
  function normalizarClave(texto) {
    return texto
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function limpiarPrecio(valor) {
    if (!valor) return 0;
    let original = valor.toString().trim();

    if (typeof valor === 'number') {
      return Math.round(valor * 100) / 100;
    }

    original = original.replace(/\$/g, '').replace(/\s+/g, '');

    if (original.includes('.') && original.includes(',')) {
      original = original.replace(/\./g, '').replace(',', '.');
    } else if (original.includes(',') && !original.includes('.')) {
      original = original.replace(',', '.');
    }

    if (original.includes('.')) {
      const [entero, decimal] = original.split('.');
      if (decimal.length > 2) {
        original = `${entero}.${decimal.substring(0, 2)}`;
      }
    }

    const numero = parseFloat(original);
    if (numero > 100000) {
      console.warn(`⚠️ Precio posiblemente mal interpretado: ${valor} → ${numero}`);
    }

    return numero;
  }

  try {
    const proveedor_id = req.body.proveedor;
    const file = req.files[0];
    let productosActualizados = [];

    if (!proveedor_id || !file) {
      return res.status(400).send('Proveedor y archivo son requeridos.');
    }

    const workbook = xlsx.readFile(file.path);
    const sheet_name_list = workbook.SheetNames;
    const codigosProcesados = new Set();

    for (const sheet_name of sheet_name_list) {
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name]);
      console.log(`📄 Hoja: "${sheet_name}" con ${data.length} filas`);

      for (const row of data) {
        const claves = Object.keys(row);
        const codigoColumn = claves.find(key => normalizarClave(key).includes('codigo'));
        const precioColumn = claves.find(key => normalizarClave(key).includes('precio'));

        if (!codigoColumn || !precioColumn) {
          console.warn(`⚠️ No se detectó columna válida de código o precio`);
          continue;
        }

        const codigoRaw = row[codigoColumn];
        const precioRaw = row[precioColumn];
        if (!codigoRaw || !precioRaw) continue;

        const codigo = codigoRaw.toString().trim();
        const precio = limpiarPrecio(precioRaw);
        if (!codigo || isNaN(precio) || precio <= 0) {
          console.warn(`⚠️ Código o precio inválido: código="${codigo}", precio="${precio}"`);
          continue;
        }

        if (codigosProcesados.has(codigo)) {
          console.log(`🔁 Código ${codigo} ya procesado en este lote, se omite.`);
          continue;
        }
        codigosProcesados.add(codigo);

        // 🔎 Consultar precio anterior real antes de actualizar
        const precioAnterior = await new Promise(resolve => {
          const sql = `SELECT precio_lista FROM producto_proveedor WHERE proveedor_id = ? AND codigo = ? LIMIT 1`;
          conexion.query(sql, [proveedor_id, codigo], (err, resQuery) => {
            if (err || resQuery.length === 0) return resolve(0);
            resolve(resQuery[0].precio_lista);
          });
        });

        // Comparar con todos los códigos similares
        const codigosRelacionados = await new Promise(resolve => {
          const sql = `
            SELECT DISTINCT codigo, precio_lista 
            FROM producto_proveedor 
            WHERE proveedor_id = ? AND codigo LIKE ?
          `;
          conexion.query(sql, [proveedor_id, `${codigo}%`], (err, resQuery) => {
            if (err || resQuery.length === 0) return resolve([]);
            resolve(resQuery);
          });
        });

        const algunoDiferente = codigosRelacionados.some(p => Math.abs(precio - p.precio_lista) >= 0.01);
        const mismoPrecio = !algunoDiferente;

        console.log(`➡️ Actualizando precio: código=${codigo}, nuevo=${precio}, anterior=${precioAnterior} | mismoPrecio=${mismoPrecio}`);

        const resultado = await producto.actualizarPreciosPDF(precio, codigo, proveedor_id);

        if (!Array.isArray(resultado)) {
          console.warn(`❌ No se pudo actualizar el producto con código ${codigo}`);
          continue;
        }

        resultado.forEach(p => {
          productosActualizados.push({
            producto_id: p.producto_id,
            codigo: p.codigo,
            nombre: p.nombre,
            precio_lista_antiguo: precioAnterior, // ✅ correcto ahora
            precio_lista_nuevo: precio,
            precio_venta: p.precio_venta || 0,
            sin_cambio: mismoPrecio
          });
        });
      }
    }

    // 🧹 Eliminar duplicados
    productosActualizados = productosActualizados.filter(
      (value, index, self) =>
        index === self.findIndex(t =>
          t.codigo === value.codigo &&
          t.producto_id === value.producto_id
        )
    );

    console.log("✅ Lista final de productos actualizados:");
    console.log(JSON.stringify(productosActualizados, null, 2));

    fs.unlinkSync(file.path);
    res.render('productosActualizados', { productos: productosActualizados });

  } catch (error) {
    console.error("❌ Error en actualizarPreciosExcel:", error);
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
},
historialPedidos: async (req, res) => {
  try {
    const { fechaDesde, fechaHasta, proveedor } = req.query;

    const historial = await producto.obtenerHistorialPedidosFiltrado(conexion, fechaDesde, fechaHasta, proveedor);
    const proveedores = await producto.obtenerProveedores(conexion);

    res.render('historialPedidos', {
      historial,
      proveedores,
      fechaDesde,
      fechaHasta,
      proveedorSeleccionado: proveedor || ''
    });
  } catch (error) {
    console.error('❌ Error en historialPedidos:', error.message);
    res.status(500).send("Error al cargar el historial de pedidos");
  }
},
verPedido: async (req, res) => {
  try {
    const pedidoId = req.params.id;
    const detalle = await producto.obtenerDetallePedido(pedidoId);

    if (detalle.length === 0) {
      return res.status(404).send("Pedido no encontrado");
    }

    // Obtenemos datos generales del pedido (fecha, proveedor, etc.)
    const pedido = {
      fecha: detalle[0].fecha,
      proveedor: detalle[0].proveedor,
      productos: detalle,
      total: detalle.reduce((acc, item) => acc + Number(item.subtotal), 0)

    };

    res.render('verPedido', { pedido });
  } catch (error) {
    console.error("Error al obtener detalle del pedido:", error);
    res.status(500).send("Error al cargar detalle del pedido");
  }
},
eliminarPedido: async (req, res) => {
  const { id } = req.params;

  try {
    const affectedRows = await producto.eliminarPedido(conexion, id);
    res.json({ message: 'Pedido eliminado correctamente', affectedRows });
  } catch (error) {
    console.error('❌ Error al eliminar pedido:', error);
    res.status(500).json({ message: 'Error al eliminar el pedido: ' + error.message });
  }
},
masVendidos: async (req, res) => {
  try {
    // Si hay parámetros duplicados, quedate con el primero
    const getFirst = (v) => Array.isArray(v) ? v[0] : v;

    let categoria_id = getFirst(req.query.categoria_id) || null;
    let desde        = getFirst(req.query.desde) || null;
    let hasta        = getFirst(req.query.hasta) || null;

    // Pasar al modelo
    const [productos, categorias] = await Promise.all([
      producto.obtenerMasVendidos(conexion, { categoria_id, desde, hasta, limit: 100 }),
      producto.obtenerCategorias(conexion)
    ]);

    res.render('productosMasVendidos', {
      productos,
      categorias,
      filtros: { categoria_id: categoria_id || '', desde: desde || '', hasta: hasta || '' }
    });

  } catch (error) {
    console.error('❌ Error al obtener productos más vendidos:', error);
    res.status(500).send('Error al obtener productos más vendidos');
  }
}




} 