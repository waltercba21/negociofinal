const conexion = require('../config/conexion');
const producto = require('../models/producto');
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
    .normalize("NFD")                        // separa acentos
    .replace(/[\u0300-\u036f]/g, "")         // quita diacríticos
    .replace(/\s+/g, '')                     // quita espacios
    .toLowerCase();                          // a minúsculas
}

const productosPorPagina = 10;
// ==============================
// Helpers genéricos (compatibles)
// ==============================
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}

function numOr0(v) {
  // Soporta "10,5" y "10.5"
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

// ✅ Siempre trata el valor como proveedor_id (no índice)
const mapearProveedorDesignado = (proveedorDesignado) => {
  return (proveedorDesignado == null || proveedorDesignado === '') ? '' : String(proveedorDesignado);
};

// ==============================
// Utilidades numéricas específicas
// ==============================
function numInt(v) {
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}
function numF(v) { // float con coma o punto
  return numOr0(v);
}

// ==============================
// (Opcional) Dedupe por si llega repetido el mismo proveedor
// ==============================
function dedupeProveedorRows(productoId, proveedoresArr, codigosArr, preciosListaArr) {
  const seen = new Set();
  const filas = [];

  for (let i = 0; i < proveedoresArr.length; i++) {
    const proveedor_id = proveedoresArr[i] ? Number(proveedoresArr[i]) : null;
    if (!proveedor_id) continue;

    const key = `${productoId}-${proveedor_id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    filas.push({
      producto_id: Number(productoId),
      proveedor_id,
      codigo: (codigosArr[i] ?? null) || null,
      precio_lista: Number(preciosListaArr[i]) || 0
    });
  }
  return filas;
}

// ==============================
// LEGACY: Upsert crudo (NO guarda IVA/desc/costos)
// Úsalo solo si la tabla no tiene esas columnas o en otros flujos viejos.
// En el flujo de editar usamos el UPSERT completo dentro del controlador.
// ==============================
async function upsertProductoProveedorRaw(con, row) {
  const sql = `
    INSERT INTO producto_proveedor
      (producto_id, proveedor_id, precio_lista, codigo)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      precio_lista = VALUES(precio_lista),
      codigo      = VALUES(codigo)
  `;
  const params = [
    Number(row.producto_id),
    Number(row.proveedor_id),
    Number(row.precio_lista) || 0,
    row.codigo || null
  ];

  if (con.promise && typeof con.promise === 'function') {
    await con.promise().query(sql, params);
  } else {
    await new Promise((resolve, reject) => {
      con.query(sql, params, (err) => (err ? reject(err) : resolve()));
    });
  }
}

// ==============================
// Elegir proveedor más barato (por costo_iva del form)
// ==============================
function pickCheapestProveedorId(body) {
  const provIds = toArray(body.proveedores);
  const civas   = toArray(body.costo_iva);

  let ganador = 0;
  let min = Number.POSITIVE_INFINITY;

  for (let i = 0; i < Math.max(provIds.length, civas.length); i++) {
    const pid = numInt(provIds[i]);
    const ci  = numF(civas[i]);
    if (pid && ci > 0 && ci < min) {
      min = ci; ganador = pid;
    }
  }
  return ganador || 0;
}

// ==============================
// Filas completas producto_proveedor (GUARDA TODO)
// Alinear índices de los arrays del form y normalizar tipos
// ==============================
function buildProveedorRows(productoId, body) {
  const provIds   = toArray(body.proveedores);              // proveedor_id[]
  const codigos   = toArray(body.codigo);                   // codigo[]
  const plistas   = toArray(body.precio_lista);             // precio_lista[]
  const descs     = toArray(body.descuentos_proveedor_id);  // descuento[] (%)
  const cnnetos   = toArray(body.costo_neto);               // costo_neto[]
  const ivas      = toArray(body.IVA);                      // IVA[] (21 / 10.5)
  const civas     = toArray(body.costo_iva);                // costo_iva[]

  const filas = [];
  const len = Math.max(
    provIds.length, codigos.length, plistas.length,
    descs.length, cnnetos.length, ivas.length, civas.length
  );

  for (let i = 0; i < len; i++) {
    const proveedor_id = numInt(provIds[i]);
    if (!proveedor_id) continue;

    filas.push({
      producto_id: Number(productoId),
      proveedor_id,
      codigo: strOrNull(codigos[i]) || '',
      precio_lista: numF(plistas[i]),
      descuento: numF(descs[i]),     // %
      costo_neto: numF(cnnetos[i]),
      iva: numF(ivas[i]),            // 21 o 10.5
      costo_iva: numF(civas[i])
    });
  }
  return filas;
}


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
    crear: async function (req, res) {
  try {
    let categorias, marcas, modelos;

    // Catálogos
    categorias = await producto.obtenerCategorias(conexion);
    marcas     = await producto.obtenerMarcas(conexion);
    modelos    = await producto.obtenerModelosPorMarca(conexion); // si tu fn devuelve todos, OK

    // Proveedores + descuentos
    const [proveedoresRaw, descuentos] = await Promise.all([
      producto.obtenerProveedores(conexion),
      producto.obtenerDescuentosProveedor(conexion)
    ]);

    const proveedores = (proveedoresRaw || []).map(p => {
      const d = (descuentos || []).find(x => x.proveedor_id === p.id);
      return { ...p, descuento: d ? Number(d.descuento) || 0 : 0 };
    });

    // Defaults para que la vista no explote si no viene body
    const utilidadDefault = Number(req.body?.utilidad) || 0;
    const basePrecio      = Number(req.body?.precio_venta) || 0;

    const preciosConDescuento = proveedores.map(p =>
      Math.ceil(basePrecio - (basePrecio * (Number(p.descuento) || 0) / 100))
    );
    const descuentoProveedor = proveedores.map(p => Number(p.descuento) || 0);

    return res.render('crear', {
      categorias,
      marcas,
      modelos,
      proveedores,
      preciosConDescuento,
      utilidad: utilidadDefault,
      descuentoProveedor,
      producto: { oferta: 0 } // para el checkbox
    });
  } catch (error) {
    console.error('Error en crear:', error);
    return res.status(500).send('Error: ' + error.message);
  }
},
guardar: async function (req, res) {
  console.log("===== Inicio del controlador guardar =====");

  try {
    // 1) Insertar PRODUCTO (escalares)
    const datosProducto = {
      nombre: strOrNull(req.body.nombre),
      descripcion: strOrNull(req.body.descripcion),
      categoria_id: numOr0(req.body.categoria) || null,
      marca_id: numOr0(req.body.marca) || null,
      modelo_id: numOr0(req.body.modelo_id) || null,
      utilidad: numOr0(req.body.utilidad),
      precio_venta: numOr0(req.body.precio_venta),
      estado: strOrNull(req.body.estado) || 'activo',
      stock_minimo: numOr0(req.body.stock_minimo),
      stock_actual: numOr0(req.body.stock_actual),
      oferta: Number(req.body.oferta) === 1 ? 1 : 0,
      calidad_original: req.body.calidad_original ? 1 : 0,
      calidad_vic: req.body.calidad_vic ? 1 : 0
    };
    console.log("[GUARDAR] datosProducto:", datosProducto);

    const ins = await producto.insertarProducto(conexion, datosProducto);
    const productoId = ins && ins.insertId;
    console.log("[GUARDAR] productoId:", productoId);
    if (!productoId) throw new Error('No se obtuvo insertId al crear el producto');

    // 2) Proveedores → UPSERT (solo columnas reales)
    const filas = buildProveedorRows(productoId, req.body);
    console.log("[GUARDAR] filas producto_proveedor:", filas.length, filas[0] || '(sin filas)');

    for (let i = 0; i < filas.length; i++) {
      const row = filas[i];
      const sql = `
        INSERT INTO producto_proveedor
          (producto_id, proveedor_id, precio_lista, codigo)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          precio_lista = VALUES(precio_lista),
          codigo      = VALUES(codigo)
      `;
      const params = [row.producto_id, row.proveedor_id, row.precio_lista, row.codigo];
      console.log(`[GUARDAR] UPSERT fila ${i}:`, params);
      await conexion.promise().query(sql, params);
    }

    // 3) Proveedor asignado: prioridad manual; si no hay, más barato por costo_iva[]
    let proveedorAsignado = numOr0(req.body.proveedor_designado) || null;
    console.log("[GUARDAR] proveedor_designado recibido:", req.body.proveedor_designado, "→", proveedorAsignado);
    if (!proveedorAsignado) {
      proveedorAsignado = pickCheapestProveedorId(req.body);
      console.log("[GUARDAR] proveedor más barato por costo_iva[]:", proveedorAsignado);
    }

    if (proveedorAsignado) {
      await producto.actualizar(conexion, { id: productoId, proveedor_id: proveedorAsignado });
      console.log("[GUARDAR] productos.proveedor_id actualizado a:", proveedorAsignado);
    }

    // 4) Imágenes nuevas (si llegan)
    if (req.files && req.files.length > 0) {
      console.log("[GUARDAR] Cant. imágenes:", req.files.length);
      await Promise.all(
        req.files.map(f => producto.insertarImagenProducto(conexion, {
          producto_id: productoId,
          imagen: f.filename
        }))
      );
    }

    console.log("===== Fin guardar (OK) =====");
    return res.redirect("/productos/panelControl");
  } catch (error) {
    console.error("===== Error durante la ejecución en guardar =====");
    console.error(error);
    return res.status(500).send("Error: " + error.message);
  }
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
actualizar: async function (req, res) {
  console.log("===== Inicio del controlador actualizar =====");
  try {
    const productoId = numInt(req.params.id || req.body.id);
    if (!productoId) throw new Error('Los datos del producto deben incluir un ID');

    // --- LOG de lo que llega del form (clave para diagnosticar) ---
    console.log('[ACTUALIZAR][INPUT] proveedores   =', toArray(req.body.proveedores));
    console.log('[ACTUALIZAR][INPUT] IVA[]        =', toArray(req.body.IVA));
    console.log('[ACTUALIZAR][INPUT] IVA_producto =', req.body.IVA_producto);
    console.log('[ACTUALIZAR][INPUT] costo_iva[]  =', toArray(req.body.costo_iva));
    console.log('[ACTUALIZAR][INPUT] precio_lista[] =', toArray(req.body.precio_lista));
    console.log('[ACTUALIZAR][INPUT] codigo[]     =', toArray(req.body.codigo));
    console.log('[ACTUALIZAR][INPUT] proveedor_designado (hidden)=', req.body.proveedor_designado);

    // 1) Datos escalares del producto (SIN tocar IVA todavía)
    const datosProducto = {
      id            : productoId,
      nombre        : req.body.nombre ?? null,
      descripcion   : (req.body.descripcion ?? '').trim() || null,
      categoria_id  : numInt(req.body.categoria) || null,
      marca_id      : numInt(req.body.marca) || null,
      modelo_id     : numInt(req.body.modelo_id) || null,
      utilidad      : numOr0(req.body.utilidad),
      precio_venta  : numOr0(req.body.precio_venta),
      estado        : (req.body.estado ?? 'activo'),
      stock_minimo  : numInt(req.body.stock_minimo),
      stock_actual  : numInt(req.body.stock_actual),
      oferta        : Number(req.body.oferta) === 1 ? 1 : 0,
      calidad_original : req.body.calidad_original ? 1 : 0,
      calidad_vic      : req.body.calidad_vic ? 1 : 0
      // IVA lo seteamos más abajo
    };
    console.log('[ACTUALIZAR] datosProducto (sin IVA aún)=', datosProducto);
    await producto.actualizar(conexion, datosProducto);

    // 2) Eliminar proveedores marcados (si vinieron)
    const aEliminar = toArray(req.body.eliminar_proveedores).map(numInt).filter(Boolean);
    console.log('[ACTUALIZAR] eliminar_proveedores[] =', aEliminar);
    if (aEliminar.length){
      const sqlDel = `
        DELETE FROM producto_proveedor
        WHERE producto_id = ? AND proveedor_id IN (${aEliminar.map(()=>'?').join(',')})
      `;
      console.log('[ACTUALIZAR][SQL] DELETE producto_proveedor', { sql: sqlDel, params: [productoId, ...aEliminar] });
      await conexion.promise().query(sqlDel, [productoId, ...aEliminar]);
    }

    // 3) UPSERT mínimo de producto_proveedor (precio_lista/codigo)
    const provIds = toArray(req.body.proveedores);
    const codigos = toArray(req.body.codigo);
    const plist   = toArray(req.body.precio_lista);

    const sqlUpsert = `
      INSERT INTO producto_proveedor
        (producto_id, proveedor_id, precio_lista, codigo)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        precio_lista = VALUES(precio_lista),
        codigo      = VALUES(codigo)
    `;
    for (let i = 0; i < Math.max(provIds.length, codigos.length, plist.length); i++){
      const proveedor_id = numInt(provIds[i]);
      if (!proveedor_id) continue;
      const params = [
        productoId,
        proveedor_id,
        numOr0(plist[i]),
        (codigos[i] == null || String(codigos[i]).trim()==='') ? null : String(codigos[i]).trim()
      ];
      console.log(`[ACTUALIZAR][SQL] UPSERT fila ${i}:`, params);
      await conexion.promise().query(sqlUpsert, params);
    }

    // 4) Determinar proveedor asignado y el IVA (un solo IVA en productos)
    const arrIVA    = toArray(req.body.IVA);        // array por card
    const arrCIva   = toArray(req.body.costo_iva);  // para elegir más barato si falta designado
    let proveedorAsignado = numInt(req.body.proveedor_designado) || 0;
    console.log('[ACTUALIZAR] proveedor_designado (pre) =', proveedorAsignado);

    // Si no hay proveedor designado, elegir por menor costo_iva
    if (!proveedorAsignado) {
      let bestIdx = -1, best = Number.POSITIVE_INFINITY;
      for (let i=0;i<Math.max(provIds.length, arrCIva.length);i++){
        const pid = numInt(provIds[i]);
        const ci  = numOr0(arrCIva[i]);
        if (pid && ci>0 && ci<best){ best=ci; bestIdx=i; proveedorAsignado=pid; }
      }
      // Si no encontró, usar el primero válido
      if (!proveedorAsignado) {
        for (let i=0;i<provIds.length;i++){
          const pid = numInt(provIds[i]);
          if (pid){ proveedorAsignado = pid; break; }
        }
      }
      console.log('[ACTUALIZAR] proveedor_designado (auto)=', proveedorAsignado);
    }

    // 👉 Priorizar el hidden "IVA_producto" sincronizado por el JS
    const ivaProductoHidden = numOr0(req.body.IVA_producto);
    console.log('[ACTUALIZAR] IVA_producto (hidden)=', ivaProductoHidden);

    let ivaProducto = 21; // default
    if (ivaProductoHidden > 0) {
      ivaProducto = ivaProductoHidden;
      console.log('[ACTUALIZAR] IVA elegido por hidden =', ivaProducto);
    } else if (proveedorAsignado) {
      let idx = provIds.findIndex(v => numInt(v) === proveedorAsignado);
      if (idx < 0) idx = 0; // fallback al primero
      ivaProducto = numOr0(arrIVA[idx] ?? 21);
      console.log('[ACTUALIZAR] IVA elegido por índice =', ivaProducto, '(idx=', idx, ')');
    } else {
      ivaProducto = numOr0(arrIVA[0] ?? 21);
      console.log('[ACTUALIZAR] IVA elegido default/primero =', ivaProducto);
    }

    await producto.actualizar(conexion, { id: productoId, proveedor_id: proveedorAsignado || null, IVA: ivaProducto });
    console.log('[ACTUALIZAR] productos.proveedor_id =', proveedorAsignado, ' | productos.IVA =', ivaProducto);

    // 5) Imágenes nuevas (si hay)
    if (req.files && req.files.length > 0) {
      console.log("[ACTUALIZAR] Cant. imágenes nuevas:", req.files.length);
      await Promise.all(
        req.files.map(f => producto.insertarImagenProducto(conexion, {
          producto_id: productoId,
          imagen: f.filename
        }))
      );
    }

    // Redirección
    const pagina = req.body.pagina || 1;
    const busqueda = req.body.busqueda ? encodeURIComponent(req.body.busqueda) : '';
    console.log("===== Fin actualizar (OK) =====");
    return res.redirect(`/productos/panelControl?pagina=${pagina}&busqueda=${busqueda}`);
  } catch (error) {
    console.error("===== Error durante la ejecución en actualizar =====");
    console.error(error);
    return res.status(500).send("Error: " + error.message);
  }
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
eliminarProveedor: async function (req, res) {
  try {
    const proveedorId = Number(req.params.id || req.body.proveedorId || 0);
    const productoId  = Number((req.query && req.query.productoId) || req.body.productoId || 0);

    console.log('🗑️ [CTRL] eliminarProveedor →', { proveedorId, productoId }, 'url=', req.originalUrl);

    if (!productoId || !proveedorId) {
      return res.status(400).json({ success:false, message:'Faltan productoId o proveedorId' });
    }

    // 1) Anular referencias en presupuesto_productos (solo ese par producto/proveedor)
    //    (dejamos el presupuesto vivo, pero sin proveedor asociado)
    const sqlNullRefs = `
      UPDATE presupuesto_productos
      SET proveedor_id = NULL
      WHERE producto_id = ? AND proveedor_id = ?
    `;
    const paramsNull = [productoId, proveedorId];
    try {
      const [rNull] = await conexion.promise().query(sqlNullRefs, paramsNull);
      console.log('🗑️ [CTRL] Nullify refs presupuesto_productos:', rNull && rNull.affectedRows);
    } catch (eNull) {
      // No es fatal; seguimos, pero lo logueamos para diagnóstico
      console.warn('⚠️ [CTRL] No se pudo nullificar refs (continuo):', eNull.code || eNull.message);
    }

    // 2) Intentar borrar la relación producto_proveedor
    const result = await producto.eliminarProveedor(conexion, proveedorId, productoId);
    console.log('🗑️ [CTRL] delete producto_proveedor result =', result);
    let affected = (result && (result.affectedRows || (result[0] && result[0].affectedRows))) || 0;

    // 3) Si aún está bloqueado por FK, intentamos nullificar y reintentar una vez
    if (affected === 0) {
      // Reintento solo si existe realmente la fila (para no dar 404 falso)
      const [rowsExist] = await conexion.promise().query(
        'SELECT 1 FROM producto_proveedor WHERE producto_id=? AND proveedor_id=? LIMIT 1',
        [productoId, proveedorId]
      );
      const existe = Array.isArray(rowsExist) ? rowsExist.length > 0 : !!rowsExist;
      if (existe) {
        try {
          // por si quedó alguna referencia que no matcheó en el paso 1
          const [rNull2] = await conexion.promise().query(sqlNullRefs, paramsNull);
          console.log('🔁 [CTRL] Nullify refs (retry) affected=', rNull2 && rNull2.affectedRows);
          const result2 = await producto.eliminarProveedor(conexion, proveedorId, productoId);
          console.log('🔁 [CTRL] delete (retry) result =', result2);
          affected = (result2 && (result2.affectedRows || (result2[0] && result2[0].affectedRows))) || 0;
        } catch (eRetry) {
          if (eRetry && (eRetry.code === 'ER_ROW_IS_REFERENCED' || eRetry.code === 'ER_ROW_IS_REFERENCED_2' || eRetry.errno === 1451)) {
            console.error('❌ [CTRL] Bloqueado por FK incluso tras nullify:', eRetry.sqlMessage || eRetry.message);
            return res.status(409).json({
              success:false,
              message:'No se puede eliminar: el proveedor sigue referenciado en otra tabla.',
              code:eRetry.code, errno:eRetry.errno
            });
          }
          throw eRetry;
        }
      }
    }

    if (affected > 0) {
      return res.json({ success:true, affectedRows: affected });
    }
    return res.status(404).json({ success:false, message:'No se encontró relación producto-proveedor para borrar.' });

  } catch (e) {
    if (e && (e.code === 'ER_ROW_IS_REFERENCED' || e.code === 'ER_ROW_IS_REFERENCED_2' || e.errno === 1451)) {
      console.error('❌ [CTRL] Bloqueado por FK:', e.sqlMessage || e.message);
      return res.status(409).json({
        success:false,
        message:'No se puede eliminar: el proveedor está referenciado en otra tabla.',
        code:e.code, errno:e.errno
      });
    }
    console.error('❌ [CTRL] Error eliminando proveedor:', e);
    return res.status(500).json({ success:false, message:'Error interno', code:e.code, errno:e.errno });
  }
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
  const PDFDocument = require('pdfkit');
  const streamBuffers = require('stream-buffers');

  // Buffer para enviar el PDF como attachment
  const buffer = new streamBuffers.WritableStreamBuffer({
    initialSize: 1024 * 1024,
    incrementAmount: 1024 * 1024
  });

  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(buffer);

  // Normalización de parámetros (permitimos "TODOS" y "Mostrar Todas")
  const proveedorIdRaw = req.query.proveedor;
  const categoriaIdRaw  = req.query.categoria;

  const proveedorId = (!proveedorIdRaw || proveedorIdRaw === 'TODOS') ? null : proveedorIdRaw;
  const categoriaId  = (!categoriaIdRaw  || categoriaIdRaw === '' || categoriaIdRaw === 'TODAS') ? null : categoriaIdRaw;

  try {
    // Nombres bonitos para cabecera
    const proveedores = await producto.obtenerProveedores(conexion);
    const categorias  = await producto.obtenerCategorias(conexion);

    const proveedorSel = proveedorId ? proveedores.find(p => String(p.id) === String(proveedorId)) : null;
    const categoriaSel = categoriaId ? categorias.find(c => String(c.id) === String(categoriaId)) : null;

    const nombreProveedor = proveedorSel ? proveedorSel.nombre : 'Todos los proveedores';
    const nombreCategoria = categoriaSel ? categoriaSel.nombre : 'Todas las categorías';

    // Título
    const titulo = `Lista de precios - ${nombreProveedor}${categoriaSel ? ' - ' + nombreCategoria : ''}`;
    doc.fontSize(16).text(titulo, { align: 'center', width: doc.page.width - 60 });
    doc.moveDown(1.5);

    // Traer productos (usa tu método existente, que ya filtra si vienen IDs)
    let productos = await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, categoriaId);

    // Deduplicar por código/ID (por seguridad)
    if (Array.isArray(productos)) {
      const vistos = new Set();
      productos = productos.filter(p => {
        const key = `${p.codigo_proveedor || ''}::${p.nombre}`;
        if (vistos.has(key)) return false;
        vistos.add(key);
        return true;
      });
    } else {
      productos = [];
    }

    // Si no hay resultados
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

    // Helpers
    const formatearMoneda = (n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return 'N/A';
      // Formato simple sin separadores raros
      return '$' + num.toFixed(2);
    };

    // Encabezado
    const drawHeader = () => {
      doc.fontSize(10).fillColor('black');
      const y = doc.y;
      doc.text('Código',           40,  y, { width: 120 });
      doc.text('Descripción',     165,  y, { width: 260 });
      doc.text('Precio de lista', 430,  y, { width: 80, align: 'right' });
      doc.text('Precio de venta', 515,  y, { width: 80, align: 'right' });
      doc.moveDown(1.2);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.6);
    };

    const ensurePage = (nextRowHeight = 18) => {
      if (doc.y + nextRowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        drawHeader();
      }
    };

    // Pintar encabezado inicial
    drawHeader();

    // Filas
    productos.forEach(p => {
      ensurePage();
      const precioLista = formatearMoneda(p.precio_lista);
      const precioVenta = formatearMoneda(p.precio_venta);

      doc.fontSize(8).fillColor('black');
      const y = doc.y;

      doc.text(p.codigo_proveedor || '-', 40,  y, { width: 120 });
      doc.text(p.nombre || '-',            165, y, { width: 260 });
      doc.text(precioLista,                430, y, { width: 80, align: 'right' });
      doc.text(precioVenta,                515, y, { width: 80, align: 'right' });

      doc.moveDown(0.6);
    });

    // Fin
    doc.end();
  } catch (error) {
    console.error('❌ Error en generarPDF:', error);
    return res.status(500).send('Error al generar el PDF');
  }

  // Enviar el archivo
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
// productosController.js
generarPDFProveedor: async function (req, res) {
  const PDFDocument = require('pdfkit');
  const streamBuffers = require('stream-buffers');
  const buffer = new streamBuffers.WritableStreamBuffer({
    initialSize: 1024 * 1024,
    incrementAmount: 1024 * 1024
  });

  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(buffer);

  // Normalización
  const proveedorIdRaw = req.query.proveedor;
  const categoriaIdRaw = req.query.categoria;
  const tipo = req.query.tipo;

  const proveedorId = (!proveedorIdRaw || proveedorIdRaw === 'TODOS') ? null : proveedorIdRaw;
  const categoriaId = (!categoriaIdRaw || categoriaIdRaw === 'TODAS' || categoriaIdRaw === '') ? null : categoriaIdRaw;

  try {
    const proveedores = await producto.obtenerProveedores(conexion);
    const categorias  = await producto.obtenerCategorias(conexion);
    const proveedor   = proveedorId ? proveedores.find(p => String(p.id) === String(proveedorId)) : null;
    const categoria   = categoriaId ? categorias.find(c => String(c.id) === String(categoriaId)) : null;

    const nombreProveedor = proveedor ? proveedor.nombre : 'Todos los proveedores';
    const nombreCategoria = categoria ? categoria.nombre : 'Todas las categorías';

    // Título
    const titulos = {
      pedido: `Faltantes (Proveedor más barato) - ${nombreProveedor}${categoria ? ' - ' + nombreCategoria : ''}`,
      asignado: `Faltantes del proveedor asignado - ${nombreProveedor}${categoria ? ' - ' + nombreCategoria : ''}`,
      porCategoria: `Stock por categoría - ${nombreCategoria}${proveedor ? ' - ' + nombreProveedor : ''}`,
      categoriaProveedorMasBarato: `Proveedor más barato por categoría - ${nombreProveedor} - ${nombreCategoria}`,
      stock: `Stock - ${nombreProveedor}${categoria ? ' - ' + nombreCategoria : ''}`
    };
    const titulo = titulos[tipo] || titulos.stock;

    doc.fontSize(14).text(titulo, { align: 'center', width: doc.page.width - 60 });
    doc.moveDown(1.5);

    // === Obtener productos según tipo ===
    let productos = [];
    if (tipo === 'pedido') {
      // faltantes con proveedor más barato (ya viene filtrado por stock en SQL)
      productos = await producto.obtenerProductosProveedorMasBaratoConStock(conexion, proveedorId, categoriaId);
    } else if (tipo === 'asignado') {
      if (!proveedorId) {
        productos = [];
      } else {
        // solo asignados a ese proveedor
        productos = await producto.obtenerProductosAsignadosAlProveedor(conexion, proveedorId, categoriaId);
        // faltantes: coerción numérica segura (null/strings → 0)
        productos = productos.filter(p => (Number(p.stock_actual) || 0) < (Number(p.stock_minimo) || 0));
      }
    } else if (tipo === 'porCategoria') {
      productos = categoriaId
        ? await producto.obtenerProductosPorCategoria(conexion, categoriaId)
        : await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, null);
    } else if (tipo === 'categoriaProveedorMasBarato') {
      productos = (proveedorId && categoriaId)
        ? await producto.obtenerProductosPorCategoriaYProveedorMasBarato(conexion, proveedorId, categoriaId)
        : [];
    } else {
      // stock completo/filtrado
      productos = await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, categoriaId);
    }

    // Deduplicar por ID por las dudas
    productos = (productos || []).filter((v, i, self) =>
      i === self.findIndex(t => String(t.id || '') === String(v.id || ''))
    );

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

    // Helpers de render
    const formatearMoneda = (n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return 'N/A';
      return '$' + num.toFixed(2);
    };

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

    // Columnas
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
          { t: String(Number(p.stock_actual) || 0),     w: 100, a: 'center' },
        ]);
      });
    } else {
      drawHeader(COLS_STOCK);
      productos.forEach(p => {
        drawRow([
          { t: (p.codigo_proveedor || p.codigo || '-'),             w: 80 },
          { t: p.nombre || '-',                                     w: 290 },
          { t: String(Number(p.stock_minimo) || 0),                 w: 80, a: 'center' },
          { t: String(Number(p.stock_actual) || 0),                 w: 90, a: 'center' },
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
},
apiProveedoresDeProducto : async function (req, res) {
  try {
    const { productoId } = req.params;
    if (!productoId) return res.status(400).json({ error: 'productoId requerido' });

    const lista = await producto.obtenerProveedoresOrdenadosPorCosto(conexion, Number(productoId));
    return res.json(lista);
  } catch (e) {
    console.error('Error apiProveedoresDeProducto:', e);
    res.status(500).json({ error: 'Error obteniendo proveedores' });
  }
},
apiProveedorSiguiente : async function (req, res) {
  try {
    const productoId = Number(req.query.producto_id);
    const actualId   = req.query.actual_id ? Number(req.query.actual_id) : null;
    if (!productoId) return res.status(400).json({ error: 'producto_id requerido' });

    const lista = await producto.obtenerProveedoresOrdenadosPorCosto(conexion, productoId);
    if (!lista.length) return res.json(null);

    // Si no vino actual, devolvemos el primero (más barato)
    if (!actualId) return res.json(lista[0]);

    // Buscar el siguiente de forma cíclica
    const idx = lista.findIndex(p => p.id === actualId);
    const siguiente = idx === -1 ? lista[0] : lista[(idx + 1) % lista.length];
    res.json(siguiente);
  } catch (e) {
    console.error('Error apiProveedorSiguiente:', e);
    res.status(500).json({ error: 'Error obteniendo siguiente proveedor' });
  }
},




} 