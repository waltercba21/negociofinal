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
    .normalize("NFD")                        
    .replace(/[\u0300-\u036f]/g, "")         
    .replace(/\s+/g, '')                     
    .toLowerCase();                          
}

const productosPorPagina = 20;
// ==============================
// Helpers genéricos (compatibles)
// ==============================
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v === undefined || v === null) return [];
  return [v];
}
function encontrarColumna(claves, candidatos /* array de strings */) {
  const normKeys = claves.map(k => ({ raw: k, norm: normalizarClave(k) }));
  const targets = candidatos.map(c => normalizarClave(c));

  // 1) match exacto con cualquier candidato
  for (const t of targets) {
    const hit = normKeys.find(k => k.norm === t);
    if (hit) return hit.raw;
  }
  // 2) fallback: includes (por ej. "precio" dentro de "preciolista")
  for (const t of targets) {
    const hit = normKeys.find(k => k.norm.includes(t));
    if (hit) return hit.raw;
  }
  return null;
}

function limpiarPrecio(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return Math.round(valor * 100) / 100;

  let original = valor.toString().trim();
  original = original.replace(/\$/g, '').replace(/\s+/g, '');

  if (original.includes('.') && original.includes(',')) {
    original = original.replace(/\./g, '').replace(',', '.');
  } else if (original.includes(',') && !original.includes('.')) {
    original = original.replace(',', '.');
  }

  // Limitar decimales a 2
  if (original.includes('.')) {
    const [entero, decimal] = original.split('.');
    if (decimal.length > 2) original = `${entero}.${decimal.substring(0, 2)}`;
  }

  const numero = parseFloat(original);
  return Number.isFinite(numero) ? numero : 0;
}

// 👉 redondeo final como en front: a la centena más cercana (>=50 hacia arriba)
function redondearAlCentenar(n) {
  const resto = n % 100;
  return resto < 50 ? (n - resto) : (n + (100 - resto));
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
async function upsertProductoProveedorRaw(con, row) {
  const sql = `
    INSERT INTO producto_proveedor
      (producto_id, proveedor_id, precio_lista, codigo, presentacion, factor_unidad)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      precio_lista  = VALUES(precio_lista),
      codigo        = VALUES(codigo),
      presentacion  = VALUES(presentacion),
      factor_unidad = VALUES(factor_unidad)
  `;
  const params = [
    Number(row.producto_id),
    Number(row.proveedor_id),
    Number(row.precio_lista) || 0,
    row.codigo || null,
    normalizarPresentacion(row.presentacion),
    Number(row.factor_unidad) || 1
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

function buildProveedorRows(productoId, body) {
  const provIds     = toArray(body.proveedores);              // proveedor_id[]
  const codigos     = toArray(body.codigo);                   // codigo[]
  const plistas     = toArray(body.precio_lista);             // precio_lista[]
  const descs       = toArray(body.descuentos_proveedor_id);  // descuento[] (%)
  const cnnetos     = toArray(body.costo_neto);               // costo_neto[]
  const ivas        = toArray(body.IVA);                      // IVA[] (21 / 10.5)
  const civas       = toArray(body.costo_iva);                // costo_iva[]
  const presentacs  = toArray(body.presentacion);             // presentacion[]: unidad/juego
  const factores    = toArray(body.factor_unidad);            // factor_unidad[] (hidden)

  const filas = [];
  const len = Math.max(
    provIds.length, codigos.length, plistas.length,
    descs.length, cnnetos.length, ivas.length, civas.length,
    presentacs.length, factores.length
  );

  for (let i = 0; i < len; i++) {
    const proveedor_id = numInt(provIds[i]);
    if (!proveedor_id) continue;

    const presentacion = normalizarPresentacion(presentacs[i]);
    const factor_unidad = factorDesdePresentacion(presentacion, factores[i]);

    filas.push({
      producto_id : Number(productoId),
      proveedor_id,
      codigo      : strOrNull(codigos[i]) || '',
      precio_lista: numF(plistas[i]),
      descuento   : numF(descs[i]),     // %
      costo_neto  : numF(cnnetos[i]),
      iva         : numF(ivas[i]),      // 21 o 10.5
      costo_iva   : numF(civas[i]),     // ya viene normalizado por el front
      presentacion,
      factor_unidad
    });
  }
  return filas;
}

// Presentación normalizada
function normalizarPresentacion(v) {
  const s = (v ?? 'unidad').toString().trim().toLowerCase();
  return s === 'juego' ? 'juego' : 'unidad';
}

// Si viene factor en el form lo usamos; si no, derivamos por presentación
function factorDesdePresentacion(presentacion, factorFormulario) {
  const f = parseFloat(factorFormulario);
  if (!isNaN(f) && f > 0) return f;      // respeta el hidden que envía el front
  return presentacion === 'juego' ? 0.5   // juego/par → mitad
                                  : 1.0;  // unidad
}
// --- calcula en servidor el costo c/IVA por UNIDAD para el índice i ---
function costoConIVAPorUnidadFila(idx, body) {
  // reutilizamos tus helpers existentes
  const arr = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);

  const costo_neto   = numF(arr(body.costo_neto)[idx] ?? body.costo_neto ?? 0);
  const ivaSel       = numF(arr(body.IVA)[idx]        ?? body.IVA        ?? 21);
  const presentacion = normalizarPresentacion(arr(body.presentacion)[idx] ?? body.presentacion);
  const factor       = factorDesdePresentacion(presentacion, arr(body.factor_unidad)[idx] ?? body.factor_unidad);

  const cnUnidad = costo_neto * (factor || 1);
  const iva      = ivaSel || 21;

  return Math.ceil(cnUnidad + (cnUnidad * iva / 100));
}

// --- elige el proveedor más barato normalizando a UNIDAD (robusto en backend) ---
function pickCheapestProveedorIdServer(body) {
  const provIds = Array.isArray(body.proveedores) ? body.proveedores
                  : (body.proveedores ? [body.proveedores] : []);
  let ganador = 0, min = Number.POSITIVE_INFINITY;

  for (let i = 0; i < provIds.length; i++) {
    const pid = numInt(provIds[i]);
    if (!pid) continue;

    const costo = costoConIVAPorUnidadFila(i, body);
    if (costo > 0 && costo < min) { min = costo; ganador = pid; }
  }
  return ganador || 0;
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
      const pagina    = req.query.pagina    ? Number(req.query.pagina)    : 1;
      const categoria = req.query.categoria ? Number(req.query.categoria) : undefined;
      const marca     = req.query.marca     ? Number(req.query.marca)     : undefined;
      const modelo    = req.query.modelo    ? Number(req.query.modelo)    : undefined;

      if (
        (categoria && isNaN(categoria)) ||
        (marca     && isNaN(marca))     ||
        (modelo    && isNaN(modelo))
      ) {
        return res.status(400).send("Parámetros inválidos.");
      }

      const seHizoBusqueda  = !!(categoria || marca || modelo);
      let   productos       = [];
      let   numeroDePaginas = 1;  

      if (seHizoBusqueda) {
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

          const offset = (pagina - 1) * productosPorPagina;
          const { productos: listaFiltros, total } =
                await producto.obtenerPorFiltrosPaginado(
                       conexion, { categoria, marca, modelo }, offset, productosPorPagina);

          productos       = listaFiltros;
          numeroDePaginas = Math.max(1, Math.ceil(total / productosPorPagina));
        }
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

      const [categorias, marcas] = await Promise.all([
        producto.obtenerCategorias(conexion),
        producto.obtenerMarcas(conexion),
      ]);

      let modelosPorMarca = marca
        ? await producto.obtenerModelosPorMarca(conexion, marca)
        : [];

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
    const { q: busqueda_nombre, categoria_id, marca_id, modelo_id, proveedor_id } = req.query;
    req.session.busquedaParams = { busqueda_nombre, categoria_id, marca_id, modelo_id };

    const limite = req.query.limite ? parseInt(req.query.limite, 10) : 100;

    // ✅ NUEVO: si viene proveedor_id => filtra por producto_proveedor (NO afecta otros usos)
    let productos;
    const provIdNum = Number(proveedor_id);

    if (proveedor_id != null && proveedor_id !== '' && Number.isFinite(provIdNum) && provIdNum > 0) {
      productos = await producto.obtenerPorFiltrosYProveedor(
        conexion,
        categoria_id,
        marca_id,
        modelo_id,
        busqueda_nombre,
        limite,
        provIdNum
      );
    } else {
      // ✅ comportamiento original intacto
      productos = await producto.obtenerPorFiltros(
        conexion,
        categoria_id,
        marca_id,
        modelo_id,
        busqueda_nombre,
        limite
      );
    }

    // Imágenes (si hay IDs)
    const productoIds = productos.map(p => p.id);
    const todasLasImagenes = productoIds.length
      ? await producto.obtenerImagenesProducto(conexion, productoIds)
      : [];

    // Enriquecer cada producto
    for (const prod of productos) {
      prod.imagenes = todasLasImagenes.filter(img => img.producto_id === prod.id);

      const proveedores = (await producto.obtenerProveedoresPorProducto(conexion, prod.id)) || [];
      prod.proveedores = proveedores;

      let provAsignado = null;
      if (prod.proveedor_id != null) {
        provAsignado =
          proveedores.find(p => Number(p.id ?? p.proveedor_id) === Number(prod.proveedor_id)) || null;
      }

      let provMasBarato = null;
      try {
        provMasBarato = await producto.obtenerProveedorMasBaratoPorProducto(conexion, prod.id);
      } catch (_) {
        provMasBarato = null;
      }

      const provParaCard = provAsignado || provMasBarato || null;

      prod.proveedor_nombre =
        provParaCard?.proveedor_nombre ??
        provParaCard?.nombre_proveedor ??
        provParaCard?.nombre ??
        'Sin proveedor';

      prod.codigo_proveedor = provParaCard?.codigo ?? provParaCard?.codigo_proveedor ?? '-';

      prod.proveedor_asignado_id = prod.proveedor_id ?? null;

      prod.utilidad = Number(prod.utilidad) || 0;
    }

    // LOG búsquedas (igual)
    try {
      const termino = (req.query.q || '').toString().trim();
      const usuario_id = req.session?.usuario?.id || null;

      if (termino.length >= 2 && Array.isArray(productos) && productos.length) {
        const ids = productos.slice(0, 20).map(p => Number(p.id)).filter(Boolean);

        if (ids.length) {
          producto
            .registrarConsultasBusqueda(conexion, { productoIds: ids, termino, usuario_id })
            .catch(e => console.warn('⚠️ No se pudo registrar búsqueda:', e.code || e.message));
        }
      }
    } catch (e) {
      console.warn('⚠️ No se pudo registrar búsqueda:', e.code || e.message);
    }

    return res.json(productos);
  } catch (error) {
    console.error("❌ Error en /productos/api/buscar:", error);
    return res.status(500).json({ error: 'Ocurrió un error al buscar productos.' });
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
    const ins = await producto.insertarProducto(conexion, datosProducto);
    const productoId = ins && ins.insertId;
    if (!productoId) throw new Error('No se obtuvo insertId al crear el producto');

    // 2) Proveedores → UPSERT (incluye presentacion + factor_unidad)
    const filas = buildProveedorRows(productoId, req.body);

    for (let i = 0; i < filas.length; i++) {
      const row = filas[i];
      const sql = `
        INSERT INTO producto_proveedor
          (producto_id, proveedor_id, precio_lista, codigo, presentacion, factor_unidad)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          precio_lista  = VALUES(precio_lista),
          codigo        = VALUES(codigo),
          presentacion  = VALUES(presentacion),
          factor_unidad = VALUES(factor_unidad)
      `;
      const params = [
        row.producto_id,
        row.proveedor_id,
        row.precio_lista,
        row.codigo,
        row.presentacion,
        row.factor_unidad
      ];
      await conexion.promise().query(sql, params);
    }

    // 3) Proveedor asignado: prioridad manual; si no hay, más barato (normalizado a unidad)
    let proveedorAsignado = numOr0(req.body.proveedor_designado) || null;
    if (!proveedorAsignado) {
      proveedorAsignado = pickCheapestProveedorIdServer(req.body);
    }

    if (proveedorAsignado) {
      await producto.actualizar(conexion, { id: productoId, proveedor_id: proveedorAsignado });
    }

    // 4) Imágenes (igual que ya tenías)
    if (req.files && req.files.length > 0) {
      await Promise.all(
        req.files.map(f =>
          producto.insertarImagenProducto(conexion, {
            producto_id: productoId,
            imagen: f.filename
            // posicion: si querés, podés enviar i+1
          })
        )
      );
    }

    return res.redirect("/productos/panelControl");
  } catch (error) {
    console.error('[CREAR][GUARDAR] Error:', error);
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

    // Copia y normalización suave (no tocamos IVA aquí)
    productoResult = { ...result };
    productoResult.precio_lista  = Math.round(Number(productoResult.precio_lista  || 0));
    productoResult.costo_neto    = Math.round(Number(productoResult.costo_neto    || 0));
    productoResult.costo_iva     = Math.round(Number(productoResult.costo_iva     || 0));
    productoResult.utilidad      = Math.round(Number(productoResult.utilidad      || 0));
    productoResult.precio_venta  = Math.round(Number(productoResult.precio_venta  || 0));
    productoResult.calidad_original_fitam = result.calidad_original_fitam;
    productoResult.calidad_vic    = result.calidad_vic;

    // params de navegación
    productoResult.paginaActual = req.query.pagina;
    productoResult.busqueda     = req.query.busqueda;

    // Traer proveedores del producto (DEBE incluir pp.iva)
    return producto.retornarDatosProveedores(conexion, req.params.id);

  }).then(productoProveedoresResult => {
    if (responseSent) return;

    // Normalización de filas proveedor-producto
    productoProveedoresResult.forEach(pp => {
      pp.precio_lista = Math.floor(Number(pp.precio_lista || 0));
      if (isFinite(pp.descuento))  pp.descuento  = Math.floor(Number(pp.descuento));
      if (isFinite(pp.costo_neto)) pp.costo_neto = Math.floor(Number(pp.costo_neto));

      // 👇 Asegurar IVA-numérico por proveedor (tolerar "10,5")
      const ivaRaw = (pp.iva !== undefined && pp.iva !== null)
        ? pp.iva
        : (productoResult.IVA ?? 21);
      pp.iva = Number(String(ivaRaw).replace(',', '.'));
      if (!Number.isFinite(pp.iva) || pp.iva <= 0) pp.iva = 21;
    });

    console.log('[GET /editar] IVA por proveedor ->',
      productoProveedoresResult.map(pp => ({ prov: pp.proveedor_id, iva: pp.iva })));

    // Cargas auxiliares
    return Promise.all([
      producto.obtenerCategorias(conexion),
      producto.obtenerMarcas(conexion),
      producto.obtenerProveedores(conexion),
      producto.obtenerModelosPorMarca(conexion, productoResult.marca), // (siempre usaste esto)
      producto.obtenerDescuentosProveedor(conexion),
      producto.obtenerStock(conexion, req.params.id)
    ]).then(([categoriasResult, marcasResult, proveedoresResult, modelosResult, descuentosProveedoresResult, stockResult]) => {
      if (responseSent) return;
      console.log('🔁 GET /productos/editar/:id');
      console.log('🧩 req.query.pagina:', req.query.pagina);
      console.log('🧩 req.query.busqueda:', req.query.busqueda);

      res.render('editar', {
        producto: productoResult,
        productoProveedores: productoProveedoresResult, // 👈 usamos este en EJS
        categorias: categoriasResult,
        marcas: marcasResult,
        proveedores: proveedoresResult,
        modelos: modelosResult,
        descuentosProveedor: descuentosProveedoresResult,
        stock: stockResult
      });
    });

  }).catch(error => {
    if (!responseSent) {
      console.error(error);
      res.status(500).send("Error al obtener los datos: " + error.message);
    }
  });
},
actualizar: async function (req, res) {
  console.log("===== Inicio del controlador actualizar =====");
  try {
    const productoId = numInt(req.params.id || req.body.id);
    if (!productoId) throw new Error('Los datos del producto deben incluir un ID');

    // ---------- LOG de entrada ----------
    const provIds   = toArray(req.body.proveedores);            // definido arriba y reutilizado en toda la fn
    const codigos   = toArray(req.body.codigo);
    const plist     = toArray(req.body.precio_lista);
    const arrIVA    = toArray(req.body.IVA);
    const arrPres   = toArray(req.body.presentacion);
    const arrFactor = toArray(req.body.factor_unidad);
    const arrCNeto  = toArray(req.body.costo_neto);             // neto SIN IVA (front)
    const arrCIva   = toArray(req.body.costo_iva);              // CON IVA por UNIDAD (front)

    console.log('[ACTUALIZAR][INPUT] proveedores        =', provIds);
    console.log('[ACTUALIZAR][INPUT] precio_lista[]     =', plist);
    console.log('[ACTUALIZAR][INPUT] codigo[]           =', codigos);
    console.log('[ACTUALIZAR][INPUT] IVA[]              =', arrIVA);
    console.log('[ACTUALIZAR][INPUT] presentacion[]     =', arrPres);
    console.log('[ACTUALIZAR][INPUT] factor_unidad[]    =', arrFactor);
    console.log('[ACTUALIZAR][INPUT] costo_neto[]       =', arrCNeto);
    console.log('[ACTUALIZAR][INPUT] costo_iva[] (unit) =', arrCIva);
    console.log('[ACTUALIZAR][INPUT] IVA_producto       =', req.body.IVA_producto);
    console.log('[ACTUALIZAR][INPUT] proveedor_designado(hidden)=', req.body.proveedor_designado);

    // ---------- 1) Datos escalares del producto ----------
    const datosProducto = {
      id               : productoId,
      nombre           : req.body.nombre ?? null,
      descripcion      : (req.body.descripcion ?? '').trim() || null,
      categoria_id     : numInt(req.body.categoria) || null,
      marca_id         : numInt(req.body.marca) || null,
      modelo_id        : numInt(req.body.modelo_id) || null,
      utilidad         : numOr0(req.body.utilidad),
      precio_venta     : numOr0(req.body.precio_venta),
      estado           : (req.body.estado ?? 'activo'),
      stock_minimo     : numInt(req.body.stock_minimo),
      stock_actual     : numInt(req.body.stock_actual),
      oferta           : Number(req.body.oferta) === 1 ? 1 : 0,
      calidad_original : req.body.calidad_original ? 1 : 0,
      calidad_vic      : req.body.calidad_vic ? 1 : 0
      // IVA del producto lo seteamos más abajo
    };
    console.log('[ACTUALIZAR] datosProducto (sin IVA aún)=', datosProducto);
    await producto.actualizar(conexion, datosProducto);

    // ---------- 2) Eliminar proveedores marcados ----------
    const aEliminarProv = toArray(req.body.eliminar_proveedores).map(numInt).filter(Boolean);
    console.log('[ACTUALIZAR] eliminar_proveedores[] =', aEliminarProv);
    if (aEliminarProv.length){
      const sqlDel = `
        DELETE FROM producto_proveedor
        WHERE producto_id = ? AND proveedor_id IN (${aEliminarProv.map(()=>'?').join(',')})
      `;
      console.log('[ACTUALIZAR][SQL] DELETE producto_proveedor', { sql: sqlDel, params: [productoId, ...aEliminarProv] });
      await conexion.promise().query(sqlDel, [productoId, ...aEliminarProv]);
    }

    // ---------- 3) UPSERT producto_proveedor (sin descuento ni costos) ----------
    const normalizarPres = (v) => {
      const s = (v ?? 'unidad').toString().trim().toLowerCase();
      return s === 'juego' ? 'juego' : 'unidad';
    };
    const normalizarIVA = (v) => {
      const n = Number(String(v ?? '').replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : 21;
    };
    const normalizarFactor = (pres, f) => {
      const nf = Number(f);
      if (Number.isFinite(nf) && nf > 0) return nf;
      return pres === 'juego' ? 0.5 : 1;
    };

    const sqlUpsert = `
      INSERT INTO producto_proveedor
        (producto_id, proveedor_id, precio_lista, codigo, iva, presentacion, factor_unidad)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        precio_lista  = VALUES(precio_lista),
        codigo        = VALUES(codigo),
        iva           = VALUES(iva),
        presentacion  = VALUES(presentacion),
        factor_unidad = VALUES(factor_unidad)
    `;

    const filas = Math.max(provIds.length, codigos.length, plist.length, arrIVA.length, arrPres.length, arrFactor.length);
    for (let i = 0; i < filas; i++){
      const proveedor_id = numInt(provIds[i]);
      if (!proveedor_id) continue;

      const precio_lista = numOr0(plist[i]);
      const codigo       = (codigos[i] == null || String(codigos[i]).trim()==='') ? null : String(codigos[i]).trim();
      const iva          = normalizarIVA(arrIVA[i]);
      const presentacion = normalizarPres(arrPres[i]);
      const factor       = normalizarFactor(presentacion, arrFactor[i]);

      const params = [ productoId, proveedor_id, precio_lista, codigo, iva, presentacion, factor ];
      console.log(`[ACTUALIZAR][SQL] UPSERT fila ${i}:`, params);
      await conexion.promise().query(sqlUpsert, params);
    }

    // ---------- 4) Proveedor asignado + IVA del producto ----------
    let proveedorAsignado = numInt(req.body.proveedor_designado) || 0;
    console.log('[ACTUALIZAR] proveedor_designado (pre) =', proveedorAsignado);

    // si no hay manual, elegir por menor costo_iva (ya normalizado a UNIDAD por el front)
    if (!proveedorAsignado) {
      let bestIdx = -1, best = Number.POSITIVE_INFINITY;
      for (let i=0;i<Math.max(provIds.length, arrCIva.length);i++){
        const pid = numInt(provIds[i]);
        const ci  = numOr0(arrCIva[i]);
        if (pid && ci>0 && ci<best){ best=ci; bestIdx=i; proveedorAsignado=pid; }
      }
      if (!proveedorAsignado) {
        // fallback: primer proveedor válido
        for (let i=0;i<provIds.length;i++){
          const pid = numInt(provIds[i]);
          if (pid){ proveedorAsignado = pid; break; }
        }
      }
      console.log('[ACTUALIZAR] proveedor_designado (auto)=', proveedorAsignado);
    }

    // IVA del producto (hidden seteado por el front al proveedor ganador)
    const ivaProductoHidden = numOr0(req.body.IVA_producto);
    console.log('[ACTUALIZAR] IVA_producto (hidden)=', ivaProductoHidden);

    let ivaProducto = 21;
    if (ivaProductoHidden > 0) {
      ivaProducto = ivaProductoHidden;
      console.log('[ACTUALIZAR] IVA elegido por hidden =', ivaProducto);
    } else if (proveedorAsignado) {
      let idx = provIds.findIndex(v => numInt(v) === proveedorAsignado);
      if (idx < 0) idx = 0;
      const ivaIdxRaw = arrIVA[idx] ?? 21;
      ivaProducto = Number(String(ivaIdxRaw).replace(',', '.')) || 21;
      console.log('[ACTUALIZAR] IVA elegido por índice =', ivaProducto, '(idx=', idx, ')');
    } else {
      const iva0 = arrIVA[0] ?? 21;
      ivaProducto = Number(String(iva0).replace(',', '.')) || 21;
      console.log('[ACTUALIZAR] IVA elegido default/primero =', ivaProducto);
    }

    await producto.actualizar(conexion, { id: productoId, proveedor_id: proveedorAsignado || null, IVA: ivaProducto });
    console.log('[ACTUALIZAR] productos.proveedor_id =', proveedorAsignado, ' | productos.IVA =', ivaProducto);

    // ---------- 4.b) ACTUALIZAR costos en tabla productos (por UNIDAD) del proveedor asignado ----------
    // OJO: acá usamos proveedorAsignado y provIds ya definidos arriba
    let idxAsignado = provIds.findIndex(v => numInt(v) === (proveedorAsignado || 0));
    if (idxAsignado < 0) {
      idxAsignado = Math.max(0, provIds.findIndex(v => numInt(v))); // primer válido
    }

    const presAsig   = (idxAsignado >= 0) ? String(arrPres[idxAsignado] || 'unidad').toLowerCase() : 'unidad';
    const factorAsig = (idxAsignado >= 0)
      ? (Number(arrFactor[idxAsignado]) || (presAsig === 'juego' ? 0.5 : 1))
      : 1;

    const cnRaw      = (idxAsignado >= 0) ? numOr0(arrCNeto[idxAsignado]) : 0; // SIN IVA
    const cnUnidad   = Math.ceil(cnRaw * factorAsig);                           // normalizar a UNIDAD si era juego
    const civaUnidad = (idxAsignado >= 0) ? Math.ceil(numOr0(arrCIva[idxAsignado])) : 0; // CON IVA por UNIDAD (ya normalizado por front)

    console.log('[ACTUALIZAR] costos asignado → idx=', idxAsignado,
                'pres=', presAsig, 'factor=', factorAsig,
                'costo_neto(unidad)=', cnUnidad, 'costo_iva(unidad)=', civaUnidad);

    await producto.actualizar(conexion, {
      id: productoId,
      costo_neto: cnUnidad,
      costo_iva : civaUnidad
    });

    // ---------- 5) IMÁGENES (igual que ya tenías) ----------
    {
      const path = require('path');
      const fs   = require('fs');
      const IMG_TABLE = 'imagenes_producto';

      const aEliminarImgs = toArray(req.body.eliminar_imagenes).map(numInt).filter(Boolean);
      const delSet = new Set(aEliminarImgs);
      if (aEliminarImgs.length) {
        try {
          const [rows] = await conexion.promise().query(
            `SELECT imagen FROM ${IMG_TABLE} WHERE id IN (${aEliminarImgs.map(()=>'?').join(',')}) AND producto_id=?`,
            [...aEliminarImgs, productoId]
          );
          (rows || []).forEach(r => {
            try {
              const p = (r.imagen || '').toString();
              if (!p) return;
              const abs = path.isAbsolute(p)
                ? p
                : path.join(__dirname, '..', 'public', p.replace(/^\/+/, ''));
              if (fs.existsSync(abs)) fs.unlinkSync(abs);
            } catch (_) {}
          });
        } catch (e) {
          console.warn('[ACTUALIZAR] No se pudo recuperar nombres de archivo para borrar:', e.message);
        }

        await conexion.promise().query(
          `DELETE FROM ${IMG_TABLE} WHERE id IN (${aEliminarImgs.map(()=>'?').join(',')}) AND producto_id=?`,
          [...aEliminarImgs, productoId]
        );
        console.log('[ACTUALIZAR] Eliminadas imágenes:', aEliminarImgs);
      }

      let ordenExistentes = toArray(req.body.orden_imagenes_existentes).map(numInt).filter(Boolean).filter(id => !delSet.has(id));

      let nuevasIds = [];
      if (req.files && req.files.length > 0) {
        console.log("[ACTUALIZAR] Cant. imágenes nuevas:", req.files.length);
        for (const f of req.files) {
          const r = await producto.insertarImagenProducto(conexion, {
            producto_id: productoId,
            imagen: f.filename
          });
          const insertId = r?.insertId || (Array.isArray(r) && r[0]?.insertId) || null;
          if (insertId) nuevasIds.push(insertId);
        }
      }

      const portadaTipo        = (req.body.portada_tipo || 'existente').trim();
      const portadaExistenteId = numInt(req.body.portada_existente_id);
      const portadaNuevaIndex  = numInt(req.body.portada_nueva_index);

      let finalOrder = [];
      if (portadaTipo === 'existente' && portadaExistenteId) {
        const resto = ordenExistentes.filter(id => id !== portadaExistenteId);
        finalOrder = [portadaExistenteId, ...resto, ...nuevasIds];
      } else if (portadaTipo === 'nueva' && nuevasIds.length > 0) {
        const portadaNuevaId = nuevasIds[Math.max(0, Math.min(portadaNuevaIndex, nuevasIds.length - 1))] || nuevasIds[0];
        const otrasNuevas = nuevasIds.filter(id => id !== portadaNuevaId);
        finalOrder = [portadaNuevaId, ...ordenExistentes, ...otrasNuevas];
      } else {
        finalOrder = [...ordenExistentes, ...nuevasIds];
      }

      if (finalOrder.length > 0) {
        let pos = 1;
        for (const imgId of finalOrder) {
          await conexion.promise().query(
            `UPDATE ${IMG_TABLE} SET posicion=? WHERE id=? AND producto_id=?`,
            [pos++, imgId, productoId]
          );
        }
        console.log('[ACTUALIZAR] Orden final (posicion):', finalOrder);
      } else {
        console.log('[ACTUALIZAR] El producto quedó sin imágenes.');
      }
    }

    // ---------- Redirect ----------
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

  const buffer = new streamBuffers.WritableStreamBuffer({
    initialSize: 1024 * 1024,
    incrementAmount: 1024 * 1024
  });

  const doc = new PDFDocument({ margin: 30 });
  doc.pipe(buffer);

  // Normalización de parámetros
  const proveedorIdRaw = req.query.proveedor;
  const categoriaIdRaw  = req.query.categoria;

  const proveedorId = (!proveedorIdRaw || proveedorIdRaw === 'TODOS') ? null : proveedorIdRaw;
  const categoriaId  = (!categoriaIdRaw  || categoriaIdRaw === '' || categoriaIdRaw === 'TODAS') ? null : categoriaIdRaw;

  try {
    // Nombres bonitos
    const proveedores = await producto.obtenerProveedores(conexion);
    const categorias  = await producto.obtenerCategorias(conexion);

    const proveedorSel = proveedorId ? proveedores.find(p => String(p.id) === String(proveedorId)) : null;
    const categoriaSel = categoriaId ? categorias.find(c => String(c.id) === String(categoriaId)) : null;

    const nombreProveedor = proveedorSel ? proveedorSel.nombre : 'Todos los proveedores';
    const nombreCategoria = categoriaSel ? categoriaSel.nombre : 'Todas las categorías';

    // Título
    const titulo = `Lista de precios - ${nombreProveedor}${categoriaSel ? ' - ' + nombreCategoria : ''}`;
    doc.fontSize(16).text(titulo, { align: 'center', width: doc.page.width - 60 });
    doc.moveDown(1.2);

    // 🔑 Traer productos (ahora el modelo acepta proveedor=null para "solo categoría")
    let productos = await producto.obtenerProductosPorProveedorYCategoria(conexion, proveedorId, categoriaId);

    // Deduplicar por código/ID (defensivo)
    if (Array.isArray(productos)) {
      const vistos = new Set();
      productos = productos.filter(p => {
        const key = `${p.id || ''}::${p.codigo_proveedor || ''}`;
        if (vistos.has(key)) return false;
        vistos.add(key);
        return true;
      });
    } else {
      productos = [];
    }

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

    // ===== Helpers de layout / formato =====
    const fmtAr = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 });

    const formatearMoneda = (n) => {
      const num = Number(n);
      if (!Number.isFinite(num)) return 'N/A';
      return fmtAr.format(num);
    };

    // Coordenadas/anchos (ajustadas: Descripción más a la izquierda y más ancha)
    const X_COD   = 40,  W_COD = 100;
    const X_DESC  = 150, W_DESC = 280;   // ← más a la izquierda y más ancha que antes
    const X_PLIST = 430, W_PLIST = 80;
    const X_PVENT = 515, W_PVENT = 80;

    const drawHeader = () => {
      doc.fontSize(10).fillColor('black');
      const y = doc.y;
      doc.text('Código',           X_COD,  y, { width: W_COD });
      doc.text('Descripción',      X_DESC, y, { width: W_DESC });
      doc.text('Precio de lista',  X_PLIST, y, { width: W_PLIST, align: 'right' });
      doc.text('Precio de venta',  X_PVENT, y, { width: W_PVENT, align: 'right' });
      doc.moveDown(0.8);
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
      doc.moveDown(0.4);
    };

    // ensurePage ahora acepta alto de próxima fila
    const ensurePage = (rowH = 18) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + rowH > bottom) {
        doc.addPage();
        drawHeader();
      }
    };

    drawHeader();

    // ===== Filas con alto dinámico (evita solapado de renglones) =====
    productos.forEach(p => {
      const nombre = p.nombre || '-';
      const codigo = p.codigo_proveedor || '-';
      const precioLista = formatearMoneda(p.precio_lista);
      const precioVenta = formatearMoneda(p.precio_venta);

      // Calculamos el alto que ocupará la descripción
      const descHeight = doc.heightOfString(nombre, { width: W_DESC, align: 'left' });
      const baseRowH = 16;                     // alto mínimo de fila
      const rowH = Math.max(baseRowH, descHeight);

      ensurePage(rowH + 4);                    // +4 de padding inferior

      const y = doc.y;
      doc.fontSize(8).fillColor('black');

      doc.text(codigo,       X_COD,  y, { width: W_COD });
      doc.text(nombre,       X_DESC, y, { width: W_DESC });
      doc.text(precioLista,  X_PLIST, y, { width: W_PLIST, align: 'right' });
      doc.text(precioVenta,  X_PVENT, y, { width: W_PVENT, align: 'right' });

      // Avanzamos en Y manualmente según el alto de la fila
      doc.y = y + rowH + 4;
    });

    doc.end();
  } catch (error) {
    console.error('❌ Error en generarPDF:', error);
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
  try {
    const proveedor_id = Number(req.body.proveedor);
    const file = req.files && req.files[0];

    if (!proveedor_id || !file) {
      return res.status(400).send('Proveedor y archivo son requeridos.');
    }

    const quitarAcentos = (txt = '') => txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const norm = (txt = '') => quitarAcentos(String(txt).trim().toLowerCase());
    const str = (x) => (x ?? '').toString().trim();

    function encontrarColumna(claves = [], candidatos = []) {
      const set = claves.map(c => ({ raw: c, n: norm(c) }));
      for (const cand of candidatos) {
        const nCand = norm(cand);
        const hit = set.find(k => k.n === nCand || k.n.includes(nCand) || nCand.includes(k.n));
        if (hit) return hit.raw;
      }
      return null;
    }

    function limpiarPrecio(valor) {
      if (valor === null || valor === undefined) return 0;

      if (typeof valor === 'number' && Number.isFinite(valor)) {
        return Math.round((valor + Number.EPSILON) * 100) / 100;
      }

      let s = String(valor).trim();
      s = s.replace(/\$/g, '').replace(/\s+/g, '');

      const comaDec = /,\d{1,2}$/.test(s);
      if (comaDec) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        const partes = s.split('.');
        if (partes.length > 2) {
          const dec = partes.pop();
          s = partes.join('') + '.' + dec;
        }
      }

      const n = Number(s);
      if (!Number.isFinite(n) || n <= 0) return 0;
      return Math.round((n + Number.EPSILON) * 100) / 100;
    }

    const incluye = (haystack, needle) =>
      str(haystack).toUpperCase().includes(str(needle).toUpperCase());

    // Fallback SOLO para NUEVOS (si no existe en DB)
    function detectarPresentacionFila({ proveedorNombre, sheetName, codigo, descripcion }) {
      const esMYL = str(proveedorNombre).toUpperCase() === 'MYL';
      const esBAIML =
        incluye(sheetName, 'BAIML') ||
        str(codigo).toUpperCase().startsWith('BAIML') ||
        incluye(descripcion, 'BAIML');

      if (esMYL && esBAIML) return { presentacion: 'juego' };
      return { presentacion: 'unidad' };
    }

    // redondeo a centena (igual idea que usás en otros lados)
    function redondearAlCentenar(valor) {
      let n = Number(valor) || 0;
      const resto = n % 100;
      n = (resto < 50) ? (n - resto) : (n + (100 - resto));
      return Math.ceil(n);
    }

    let proveedorNombre = '';
    try {
      const [provRow] = await conexion.promise().query(
        'SELECT nombre FROM proveedores WHERE id=? LIMIT 1',
        [proveedor_id]
      );
      proveedorNombre = (provRow && provRow[0] && provRow[0].nombre) ? provRow[0].nombre : '';
    } catch {}

    const PROVEEDOR_OFERTAS_ID = 24;

    // === Precarga: precio_lista anterior + presentacion guardada ===
    const [ppInfoRows] = await conexion.promise().query(
      `SELECT 
          codigo,
          precio_lista,
          LOWER(COALESCE(presentacion,'unidad')) AS presentacion
       FROM producto_proveedor
       WHERE proveedor_id = ?`,
      [proveedor_id]
    );

    const ppInfoMap = new Map();
    (ppInfoRows || []).forEach(r => {
      const k = norm(r.codigo);
      ppInfoMap.set(k, {
        precio_lista: Number(r.precio_lista || 0),
        presentacion: (r.presentacion === 'juego') ? 'juego' : 'unidad'
      });
    });

    let productosActualizados = [];
    const codigosProcesados = new Set();     // guardo norm(codigo)
    const productosTocados = new Set();
    const nuevosProductos = [];
    const codigosNuevosSet = new Set();

    const workbook = xlsx.readFile(file.path);
    const sheets = workbook.SheetNames;

    for (const sheet of sheets) {
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);

      for (const row of data) {
        const claves = Object.keys(row);

        const codigoColumn = encontrarColumna(claves, ['codigo', 'código', 'cod.', 'cod', 'item', 'articulo', 'artículo']);
        const precioColumn = encontrarColumna(claves, ['precio', 'importe', 'valor', 'unitario', 'p.unit']);
        const descColumn   = encontrarColumna(claves, ['descripcion', 'descripción', 'detalle', 'producto', 'nombre']);

        if (!codigoColumn || !precioColumn) continue;

        const codigoRaw = str(row[codigoColumn]);
        const codigoKey = norm(codigoRaw);
        const precioBruto = limpiarPrecio(row[precioColumn]);
        const descRaw = descColumn ? str(row[descColumn]) : '';

        if (!codigoRaw || !Number.isFinite(precioBruto) || precioBruto <= 0) continue;
        if (codigosProcesados.has(codigoKey)) continue;

        // marcamos procesado SIEMPRE (también sirve para ofertas faltantes)
        codigosProcesados.add(codigoKey);

        const infoBD = ppInfoMap.get(codigoKey);

        // regla principal: si existe en DB -> RESPETAR presentacion DB
        let presentacionUsada = infoBD?.presentacion;
        if (!presentacionUsada) {
          const det = detectarPresentacionFila({
            proveedorNombre,
            sheetName: sheet,
            codigo: codigoRaw,
            descripcion: descRaw
          });
          presentacionUsada = det.presentacion; // SOLO fallback (para nuevos)
        }

        const precioAnterior = infoBD?.precio_lista || 0;

        // Importante: guardamos "precio_lista" tal cual viene del Excel
        // La normalización a unidad la hace el MODEL usando presentacion de DB.
        const precioListaNuevo = precioBruto;

        const resultado = await producto.actualizarPreciosPDF(precioListaNuevo, codigoRaw, proveedor_id);

        if (Array.isArray(resultado) && resultado.length) {
          resultado.forEach(p => {
            productosActualizados.push({
              producto_id: p.producto_id,
              codigo: p.codigo,
              nombre: p.nombre,
              precio_lista_antiguo: precioAnterior,
              precio_lista_nuevo: precioListaNuevo,
              precio_venta: p.precio_venta || 0,
              presentacion_usada: presentacionUsada,
              sin_cambio: Math.abs((precioAnterior || 0) - precioListaNuevo) < 0.01
            });
            productosTocados.add(Number(p.producto_id));
          });
        } else {
          // no existe en DB → listado de nuevos
          if (!codigosNuevosSet.has(codigoKey)) {
            codigosNuevosSet.add(codigoKey);
            nuevosProductos.push({
              codigo: codigoRaw,
              descripcion: descRaw || '(sin descripción)',
              precio: precioListaNuevo,
              presentacion_sugerida: presentacionUsada
            });
          }
        }
      }
    }

    // dedupe
    productosActualizados = productosActualizados.filter(
      (v, i, s) => i === s.findIndex(t => t.producto_id === v.producto_id && t.codigo === v.codigo)
    );

    // === Recalcular PV para productos "tocados" cuyo proveedor asignado NO es el que estás actualizando ===
    // (tu lógica original) pero ahora respeta presentacion + iva del proveedor asignado
    if (productosTocados.size > 0) {
      const ids = Array.from(productosTocados);

      const [rowsProd] = await conexion.promise().query(
        `SELECT id, proveedor_id AS asignado_id, utilidad, COALESCE(IVA,21) AS IVA
           FROM productos
          WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids
      );

      const mapProd = new Map();
      (rowsProd || []).forEach(r => {
        mapProd.set(Number(r.id), {
          asignado_id: Number(r.asignado_id || 0),
          utilidad: Number(r.utilidad || 0),
          IVA: Number(r.IVA || 21)
        });
      });

      for (const prodId of ids) {
        const meta = mapProd.get(prodId);
        if (!meta || !meta.asignado_id) continue;
        if (meta.asignado_id === proveedor_id) continue;

        const [ppRows] = await conexion.promise().query(
          `SELECT 
              pp.precio_lista,
              LOWER(COALESCE(pp.presentacion,'unidad')) AS presentacion,
              COALESCE(pp.iva, ?) AS iva_prov,
              COALESCE(dp.descuento, 0) AS descuento
           FROM producto_proveedor pp
           LEFT JOIN descuentos_proveedor dp ON dp.proveedor_id = pp.proveedor_id
           WHERE pp.producto_id = ? AND pp.proveedor_id = ?
           LIMIT 1`,
          [meta.IVA || 21, prodId, meta.asignado_id]
        );

        if (!ppRows || ppRows.length === 0) continue;

        const pl = Number(ppRows[0].precio_lista || 0);
        const desc = Number(ppRows[0].descuento || 0);
        const pres = (ppRows[0].presentacion === 'juego') ? 'juego' : 'unidad';
        const ivaProv = Number(ppRows[0].iva_prov || meta.IVA || 21);

        if (!(pl > 0)) continue;

        // neto sobre el precio_lista (puede ser juego o unidad)
        const costoNeto = pl - (pl * desc / 100);

        // normalizar a UNIDAD si es juego (par)
        const factor = (pres === 'juego') ? 0.5 : 1;
        const costoNetoUnidad = costoNeto * factor;

        const costoIVAUnidad = costoNetoUnidad * (1 + (ivaProv / 100));
        let nuevoPV = costoIVAUnidad * (1 + (meta.utilidad || 0) / 100);
        nuevoPV = redondearAlCentenar(nuevoPV);

        await conexion.promise().query(
          `UPDATE productos SET precio_venta=? WHERE id=?`,
          [nuevoPV, prodId]
        );
      }
    }

    // === Ofertas faltantes (corrigiendo set por norm) ===
    let ofertasFaltantes = [];
    if (proveedor_id === PROVEEDOR_OFERTAS_ID) {
      const [rows] = await conexion.promise().query(`
        SELECT pp.producto_id, pp.codigo, pp.precio_lista AS precio_lista_oferta,
               p.nombre, p.precio_venta, p.oferta
          FROM producto_proveedor pp
          JOIN productos p ON p.id = pp.producto_id
         WHERE pp.proveedor_id = ?`, [proveedor_id]);

      ofertasFaltantes = (rows || [])
        .filter(r => {
          const cod = str(r.codigo);
          return cod && !codigosProcesados.has(norm(cod));
        })
        .map(r => ({
          producto_id: r.producto_id,
          codigo: r.codigo,
          nombre: r.nombre,
          precio_lista_oferta: Number(r.precio_lista_oferta || 0),
          precio_venta: Number(r.precio_venta || 0),
          oferta_flag: Number(r.oferta) === 1 ? 'SI' : 'NO'
        }));
    }

    try { fs.unlinkSync(file.path); } catch {}

    if (!req.session) req.session = {};
    req.session.nuevosProductos = {
      proveedor_id,
      proveedor_nombre: proveedorNombre,
      fecha: new Date(),
      items: nuevosProductos
    };

    res.render('productosActualizados', {
      productos: productosActualizados,
      ofertasFaltantes,
      cantidadNuevos: nuevosProductos.length
    });

  } catch (error) {
    console.error('❌ Error en actualizarPreciosExcel:', error);
    res.status(500).send(error.message);
  }
},

descargarPDFNuevos : async (req, res) => {
  try {
    const data = req.session && req.session.nuevosProductos;
    if (!data || !data.items || data.items.length === 0) {
      return res.status(404).send('No hay productos nuevos detectados en la última importación.');
    }

    const proveedor = data.proveedor_nombre || `Proveedor_${data.proveedor_id}`;
    const fecha = new Date(data.fecha || Date.now());
    const yyyy = fecha.getFullYear();
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const dd = String(fecha.getDate()).padStart(2, '0');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="PRODUCTOS_NUEVOS_${proveedor.replace(/\s+/g,'_')}_${yyyy}-${mm}-${dd}.pdf"`
    );

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Título
    doc.fontSize(16).text('PRODUCTOS NUEVOS', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).text(`Proveedor: ${proveedor}`, { align: 'center' });
    doc.text(`Fecha: ${dd}/${mm}/${yyyy}`, { align: 'center' });
    doc.moveDown(1);

    // Encabezados de tabla
    const colX = { codigo: 40, descrip: 170, precio: 480 };
    const rowHeight = 20;

    doc.fontSize(11).text('Código', colX.codigo, doc.y, { width: 120, continued: false });
    doc.text('Descripción', colX.descrip, doc.y, { width: 290 });
    doc.text('Precio', colX.precio, doc.y, { width: 100, align: 'right' });
    doc.moveTo(40, doc.y + 5).lineTo(555, doc.y + 5).stroke();
    doc.moveDown(0.5);

    // Filas
    data.items.forEach(item => {
      const precioFmt = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.precio || 0);
      const yStart = doc.y;
      // Código
      doc.fontSize(10).text(item.codigo || '', colX.codigo, yStart, { width: 120 });
      // Descripción (ajusta altura)
      const descHeight = doc.heightOfString(item.descripcion || '', { width: 290 });
      doc.text(item.descripcion || '', colX.descrip, yStart, { width: 290 });
      // Precio
      doc.text(`$ ${precioFmt}`, colX.precio, yStart, { width: 100, align: 'right' });

      const h = Math.max(rowHeight, descHeight);
      doc.moveDown(h / 14); // ajuste fino para mantener separación visual
      if (doc.y > 760) doc.addPage();
    });

    doc.end();
  } catch (err) {
    console.error('❌ Error al generar PDF de nuevos:', err);
    res.status(500).send('Error al generar PDF.');
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

    const pedidoId = req.query.pedido_id ? Number(req.query.pedido_id) : null;

    let proveedorId = null;
    let pedidoItems = [];

    if (pedidoId) {
      const pedido = await producto.obtenerPedidoPorId(conexion, pedidoId);
      if (pedido) {
        proveedorId = pedido.proveedor_id;
        pedidoItems = await producto.obtenerItemsPedido(conexion, pedidoId, proveedorId);
      }
    }

    res.render('pedidoManual', { proveedores, pedidoId, proveedorId, pedidoItems });
  } catch (error) {
    console.error("Error al generar el pedido manual:", error);
    res.status(500).send("Error al generar el pedido manual: " + error.message);
  }
},
guardarPedido: async (req, res) => {
  try {
    const { pedido_id, proveedor_id, total, productos } = req.body;

    if (!proveedor_id || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ message: 'Datos incompletos' });
    }

    const pedidoId = await producto.upsertPedido(conexion, {
      pedido_id: pedido_id ? Number(pedido_id) : null,
      proveedor_id: Number(proveedor_id),
      total: Number(total) || 0,
      productos
    });

    return res.json({ pedido_id: pedidoId });
  } catch (e) {
    console.error('❌ guardarPedido:', e);
    return res.status(500).json({ message: e.message });
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
recomendacionesProveedor: async (req, res) => {
  try {
    const getFirst = (v) => Array.isArray(v) ? v[0] : v;

    const proveedor_id = getFirst(req.query.proveedor_id) || '';
    let stock_max = parseInt(getFirst(req.query.stock_max) || '6', 10);
    const desde = getFirst(req.query.desde) || '';
    const hasta = getFirst(req.query.hasta) || '';

    if (!Number.isFinite(stock_max) || stock_max < 1) stock_max = 1;
    if (stock_max > 100) stock_max = 100;

    const proveedores = await producto.obtenerProveedores(conexion);

    return res.render('recomendacionesProveedor', {
      proveedores,
      filtros: { proveedor_id, stock_max, desde, hasta }
    });

  } catch (error) {
    console.error('❌ Error en recomendacionesProveedor:', error);
    return res.status(500).send('Error al mostrar filtros');
  }
},
recomendacionesProveedorPDF: async (req, res) => {
  const PDFDocument = require('pdfkit');
  const streamBuffers = require('stream-buffers');

  try {
    const getFirst = (v) => Array.isArray(v) ? v[0] : v;

    const proveedor_id = getFirst(req.query.proveedor_id) || '';
    let stock_max = parseInt(getFirst(req.query.stock_max) || '6', 10);
    const desde = getFirst(req.query.desde) || null;
    const hasta = getFirst(req.query.hasta) || null;

    if (!proveedor_id) return res.status(400).send('Proveedor requerido');
    if (!Number.isFinite(stock_max) || stock_max < 1) stock_max = 1;
    if (stock_max > 100) stock_max = 100;

    const proveedores = await producto.obtenerProveedores(conexion);
    const prov = proveedores.find(p => String(p.id) === String(proveedor_id));
    const provNombre = prov ? prov.nombre : `Proveedor ${proveedor_id}`;

    const [stockBajoRaw, masVendidosRaw] = await Promise.all([
      producto.obtenerProductosProveedorConStockHasta(conexion, { proveedor_id, stock_max }),
      producto.obtenerMasVendidosPorProveedor(conexion, { proveedor_id, desde, hasta, limit: 100 })
    ]);

    // ✅ FILTRO: los más vendidos también deben cumplir stock_actual <= stock_max
    const masVendidos = (masVendidosRaw || []).filter(p => Number(p.stock_actual || 0) <= stock_max);

    // ✅ No duplicar: si está en "más vendidos" va en bloque 2, se saca del bloque 1
    const vendidosIds = new Set(masVendidos.map(p => String(p.id)));
    const stockBajo = (stockBajoRaw || []).filter(p => !vendidosIds.has(String(p.id)));

    const buffer = new streamBuffers.WritableStreamBuffer({
      initialSize: 1024 * 1024,
      incrementAmount: 1024 * 1024
    });

    const doc = new PDFDocument({ margin: 36, size: 'A4' });
    doc.pipe(buffer);

    const L = doc.page.margins.left;
    const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    const ensure = (h = 18) => {
      const bottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + h > bottom) doc.addPage();
    };

    const hr = () => {
      doc.moveDown(0.3);
      doc.moveTo(L, doc.y)
        .lineTo(L + W, doc.y)
        .strokeColor('#dfe7f2')
        .stroke();
      doc.strokeColor('black');
      doc.moveDown(0.6);
    };

    const sectionCentered = (t) => {
      ensure(30);
      doc.x = L;
      doc.fontSize(12).fillColor('#1f487e').text(t, L, doc.y, { width: W, align: 'center' });
      doc.fillColor('black');
      doc.moveDown(0.5);
    };

    // ====== TÍTULO ======
    doc.x = L;
    doc.fontSize(15).text(`LISTADO PEDIDO - ${provNombre}`, L, doc.y, { width: W, align: 'center' });
    doc.moveDown(0.3);

    const dDesde = desde || '...';
    const dHasta = hasta || '...';
    doc.fontSize(10).fillColor('#444').text(
      `Stock Menos o Igual a ${stock_max} desde ${dDesde} / ${dHasta}`,
      L,
      doc.y,
      { width: W, align: 'center' }
    );
    doc.fillColor('black');
    doc.moveDown(1);

    // ====== 1) LISTADO DE PRODUCTOS ======
    sectionCentered('Listado de Productos');
    doc.fontSize(9);

    const X = L, WN = 330, WC = 110, WS = 60;
    doc.text('Producto', X, doc.y, { width: WN });
    doc.text('Código',   X + WN, doc.y, { width: WC });
    doc.text('Stock',    X + WN + WC, doc.y, { width: WS, align: 'right' });
    hr();

    (stockBajo || []).forEach(p => {
      ensure(18);
      const y = doc.y;
      doc.fontSize(8).text(p.nombre || '-', X, y, { width: WN });
      doc.text(p.codigo_proveedor || p.codigo || '-', X + WN, y, { width: WC });
      doc.text(String(Number(p.stock_actual || 0)), X + WN + WC, y, { width: WS, align: 'right' });
      doc.moveDown(0.6);
    });

    if (!(stockBajo || []).length) {
      doc.fontSize(9).fillColor('#666')
        .text('Sin resultados.', L, doc.y, { width: W })
        .fillColor('black');
    }

    doc.moveDown(0.8);

    // ====== 2) MÁS VENDIDOS (FILTRADOS POR STOCK) ======
    sectionCentered('Productos Mas Vendidos Para Pedir');
    doc.fontSize(9);

    const WV = 70;
    doc.text('Producto', X, doc.y, { width: WN + WC - 40 });
    doc.text('Vendido',  X + (WN + WC - 40), doc.y, { width: WV, align: 'right' });
    doc.text('Stock',    X + (WN + WC - 40) + WV, doc.y, { width: 60, align: 'right' });
    hr();

    (masVendidos || []).forEach(p => {
      ensure(18);
      const y = doc.y;
      doc.fontSize(8).text(p.nombre || '-', X, y, { width: WN + WC - 40 });
      doc.text(String(Number(p.total_vendido || 0)), X + (WN + WC - 40), y, { width: WV, align: 'right' });
      doc.text(String(Number(p.stock_actual || 0)), X + (WN + WC - 40) + WV, y, { width: 60, align: 'right' });
      doc.moveDown(0.6);
    });

    if (!(masVendidos || []).length) {
      doc.fontSize(9).fillColor('#666')
        .text('Sin ventas en el rango (o no hay más vendidos con stock dentro del umbral).', L, doc.y, { width: W })
        .fillColor('black');
    }

    doc.end();

    buffer.on('finish', function () {
      const pdfData = buffer.getContents();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="PEDIDO_${provNombre.replace(/\s+/g, '_')}.pdf"`
      );
      res.send(pdfData);
    });

  } catch (error) {
    console.error('❌ Error en recomendacionesProveedorPDF:', error);
    return res.status(500).send('Error al generar PDF');
  }
},

} 