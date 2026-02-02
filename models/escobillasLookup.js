'use strict';

function normalizeText(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCodigo(s) {
  if (!s) return '';
  return String(s).toUpperCase().replace(/[^0-9A-Z]+/g, '').trim();
}

function extractYear(qNorm) {
  const m = qNorm.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0], 10) : null;
}

function isEscobillaIntent(qNorm) {
  return qNorm.includes('ESCOBILL');
}

function stripNoise(qNorm) {
  return qNorm
    .replace(/\bESCOBILLAS?\b/g, ' ')
    .replace(/\bLIMPIA\b/g, ' ')
    .replace(/\bPARABRISAS\b/g, ' ')
    .replace(/\bLIMPIAPARABRISAS\b/g, ' ')
    .replace(/\bTRICO\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveMarcaModelo(con, qVehNorm) {
  const [marcas] = await con.promise().query(
    `SELECT id, nombre, nombre_norm FROM vehiculo_marcas ORDER BY CHAR_LENGTH(nombre_norm) DESC`
  );

  const marca = (marcas || []).find(m => qVehNorm.includes(m.nombre_norm));
  if (!marca) return { marca: null, modelo: null };

  const [aliasRows] = await con.promise().query(
    `
    SELECT
      mo.id AS modelo_id,
      mo.nombre AS modelo_nombre,
      va.alias_norm
    FROM vehiculo_modelo_alias va
    JOIN vehiculo_modelos mo ON mo.id = va.modelo_id
    WHERE mo.marca_id = ?
    ORDER BY CHAR_LENGTH(va.alias_norm) DESC
    `,
    [marca.id]
  );

  const hit = (aliasRows || []).find(r => qVehNorm.includes(r.alias_norm));
  if (!hit) return { marca: { id: marca.id, nombre: marca.nombre }, modelo: null };

  return {
    marca: { id: marca.id, nombre: marca.nombre },
    modelo: { id: hit.modelo_id, nombre: hit.modelo_nombre }
  };
}

async function pickAplicacion(con, modeloId, anio) {
  const targetYm = anio ? (anio * 100 + 1) : null;

  if (targetYm) {
    const [rows] = await con.promise().query(
      `
      SELECT id, desde_ym, hasta_ym, notas
      FROM escobillas_aplicaciones
      WHERE modelo_id = ?
        AND desde_ym <= ?
        AND (hasta_ym IS NULL OR hasta_ym >= ?)
      ORDER BY COALESCE(hasta_ym, 999999) DESC, desde_ym DESC
      LIMIT 1
      `,
      [modeloId, targetYm, targetYm]
    );
    return rows?.[0] || null;
  }

  const [rows] = await con.promise().query(
    `
    SELECT id, desde_ym, hasta_ym, notas
    FROM escobillas_aplicaciones
    WHERE modelo_id = ?
    ORDER BY COALESCE(hasta_ym, 999999) DESC, desde_ym DESC
    LIMIT 1
    `,
    [modeloId]
  );
  return rows?.[0] || null;
}

async function getItems(con, aplicacionId) {
  const [rows] = await con.promise().query(
    `
    SELECT ubicacion, tecnologia, codigo, codigo_norm
    FROM escobillas_aplicacion_items
    WHERE aplicacion_id = ?
    ORDER BY
      FIELD(ubicacion,'DEL_CON','DEL_PAS','TRAS'),
      FIELD(tecnologia,'FLEX','STEEL','REAR','CONVENCIONAL')
    `,
    [aplicacionId]
  );
  return rows || [];
}

async function findProductoUnidad(con, codigoNorm, tecnologia) {
  const [rows] = await con.promise().query(
    `
    SELECT
      p.id,
      p.nombre,
      p.precio_venta,
      p.stock_actual
    FROM escobillas_codigo_producto cp
    JOIN productos p ON p.id = cp.producto_id
    WHERE cp.codigo_norm = ?
      AND cp.tecnologia = ?
    ORDER BY cp.prioridad ASC
    LIMIT 1
    `,
    [codigoNorm, tecnologia]
  );
  return rows?.[0] || null;
}

async function findProductoKit(con, codCon, codPas, tecnologia) {
  const [rows] = await con.promise().query(
    `
    SELECT
      p.id,
      p.nombre,
      p.precio_venta,
      p.stock_actual
    FROM escobillas_kit_producto k
    JOIN productos p ON p.id = k.producto_id
    WHERE k.tecnologia = ?
      AND k.codigo_conductor_norm = ?
      AND k.codigo_acompanante_norm = ?
    ORDER BY k.prioridad ASC
    LIMIT 1
    `,
    [tecnologia, codCon, codPas]
  );
  return rows?.[0] || null;
}

function groupByPos(items) {
  const out = { DEL_CON: [], DEL_PAS: [], TRAS: [] };
  for (const it of items) {
    const u = it.ubicacion;
    if (!out[u]) out[u] = [];
    out[u].push({
      tecnologia: it.tecnologia,
      codigo: it.codigo,
      codigo_norm: it.codigo_norm
    });
  }
  return out;
}

function pickFirstByTech(list, techOrder) {
  for (const t of techOrder) {
    const hit = (list || []).find(x => x.tecnologia === t);
    if (hit) return hit;
  }
  return (list && list[0]) ? list[0] : null;
}

async function tryBuscar(con, qRaw) {
  const qNorm = normalizeText(qRaw);
  if (!isEscobillaIntent(qNorm)) return null;

  const anio = extractYear(qNorm);
  const qVehNorm = stripNoise(qNorm);

  const { marca, modelo } = await resolveMarcaModelo(con, qVehNorm);

  if (!marca) {
    return {
      tipo: 'escobillas',
      ok: false,
      motivo: 'No se pudo identificar la marca del vehículo.',
      q: qRaw
    };
  }
  if (!modelo) {
    return {
      tipo: 'escobillas',
      ok: false,
      motivo: 'Se identificó la marca pero no el modelo. Probá: "ESCOBILLA ' + marca.nombre + ' 207".',
      q: qRaw
    };
  }

  const aplic = await pickAplicacion(con, modelo.id, anio);
  if (!aplic) {
    return {
      tipo: 'escobillas',
      ok: false,
      motivo: 'No hay aplicación cargada para ese vehículo.',
      vehiculo: { marca: marca.nombre, modelo: modelo.nombre, anio }
    };
  }

  const items = await getItems(con, aplic.id);
  const pos = groupByPos(items);

  // Elegimos qué mostrar como “principal”
  const principalCon = pickFirstByTech(pos.DEL_CON, ['FLEX','STEEL']);
  const principalPas = pickFirstByTech(pos.DEL_PAS, ['FLEX','STEEL']);
  const principalTras = pickFirstByTech(pos.TRAS, ['REAR','FLEX','STEEL','CONVENCIONAL']);

  // Enriquecer con productos (unidad)
  async function enrich(it) {
    if (!it) return null;
    const codigoNorm = normalizeCodigo(it.codigo_norm || it.codigo);
    const tecnologia = it.tecnologia;
    const prod = await findProductoUnidad(con, codigoNorm, tecnologia);
    return { ...it, producto: prod || null };
  }

  const conductorAll = await Promise.all((pos.DEL_CON || []).map(enrich));
  const acompananteAll = await Promise.all((pos.DEL_PAS || []).map(enrich));
  const traseraAll = await Promise.all((pos.TRAS || []).map(enrich));

  const conductorMain = await enrich(principalCon);
  const acompananteMain = await enrich(principalPas);
  const traseraMain = await enrich(principalTras);

  // Kit (si hay par conductor+acompanante) por FLEX y/o STEEL
  const kits = [];
  for (const t of ['FLEX','STEEL']) {
    const c = (pos.DEL_CON || []).find(x => x.tecnologia === t);
    const p = (pos.DEL_PAS || []).find(x => x.tecnologia === t);
    if (c && p) {
      const prodKit = await findProductoKit(con, normalizeCodigo(c.codigo_norm), normalizeCodigo(p.codigo_norm), t);
      if (prodKit) kits.push({ tecnologia: t, producto: prodKit });
    }
  }

  return {
    tipo: 'escobillas',
    ok: true,
    vehiculo: { marca: marca.nombre, modelo: modelo.nombre, anio },
    aplicacion: { desde_ym: aplic.desde_ym, hasta_ym: aplic.hasta_ym, notas: aplic.notas || null },
    principal: {
      conductor: conductorMain,
      acompanante: acompananteMain,
      trasera: traseraMain
    },
    alternativas: {
      conductor: conductorAll.filter(Boolean),
      acompanante: acompananteAll.filter(Boolean),
      trasera: traseraAll.filter(Boolean)
    },
    kits
  };
}

module.exports = { tryBuscar };
