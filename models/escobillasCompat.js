'use strict';

function normalizeCodigo(v) {
  if (!v) return '';
  return String(v).toUpperCase().replace(/[^0-9A-Z]+/g, '').trim();
}

function normalizeTecnologiaUnidad(v) {
  const t = String(v || '').toUpperCase().trim();
  const allowed = new Set(['FLEX','STEEL','REAR','CONVENCIONAL']);
  return allowed.has(t) ? t : 'FLEX';
}

function normalizeTecnologiaKit(v) {
  const t = String(v || '').toUpperCase().trim();
  const allowed = new Set(['FLEX','STEEL']);
  return allowed.has(t) ? t : 'FLEX';
}

function normalizeTipo(v) {
  const s = String(v || '').toLowerCase().trim();
  return (s === 'kit') ? 'kit' : (s === 'unidad' ? 'unidad' : '');
}

async function getCodigosProducto(conexion, productoId) {
  const [rows] = await conexion.promise().query(
    `
    SELECT
      codigo_norm AS codigo,
      tecnologia,
      prioridad
    FROM escobillas_codigo_producto
    WHERE producto_id = ?
    ORDER BY prioridad ASC, codigo_norm ASC
    `,
    [Number(productoId)]
  );
  return rows || [];
}

async function deleteCodigosProducto(conexion, productoId) {
  await conexion.promise().query(
    `DELETE FROM escobillas_codigo_producto WHERE producto_id = ?`,
    [Number(productoId)]
  );
}

async function setCodigosProducto(conexion, productoId, jsonValue) {
  const pid = Number(productoId);
  if (!pid) return;

  let items = [];
  try {
    items = Array.isArray(jsonValue) ? jsonValue : JSON.parse(jsonValue || '[]');
  } catch {
    items = [];
  }

  const clean = [];
  for (const it of (items || [])) {
    const codigo = normalizeCodigo(it?.codigo ?? it);
    if (!codigo) continue;
    clean.push({
      codigo,
      tecnologia: normalizeTecnologiaUnidad(it?.tecnologia),
      prioridad: Number.isFinite(Number(it?.prioridad)) ? Number(it.prioridad) : 10
    });
  }

  await deleteCodigosProducto(conexion, pid);

  if (!clean.length) return;

  const values = clean.map(() => `(?, ?, ?, ?)`).join(',');
  const params = [];
  for (const c of clean) params.push(pid, c.codigo, c.tecnologia, c.prioridad);

  await conexion.promise().query(
    `
    INSERT INTO escobillas_codigo_producto (producto_id, codigo_norm, tecnologia, prioridad)
    VALUES ${values}
    `,
    params
  );
}

async function getKitProducto(conexion, productoId) {
  const [rows] = await conexion.promise().query(
    `
    SELECT
      tecnologia,
      codigo_conductor_norm AS conductor,
      codigo_acompanante_norm AS acompanante,
      prioridad
    FROM escobillas_kit_producto
    WHERE producto_id = ?
    ORDER BY prioridad ASC
    LIMIT 1
    `,
    [Number(productoId)]
  );
  return (rows && rows[0]) ? rows[0] : null;
}

async function deleteKitProducto(conexion, productoId) {
  await conexion.promise().query(
    `DELETE FROM escobillas_kit_producto WHERE producto_id = ?`,
    [Number(productoId)]
  );
}

async function setKitProducto(conexion, productoId, jsonValue) {
  const pid = Number(productoId);
  if (!pid) return;

  let obj = null;
  try {
    obj = (typeof jsonValue === 'object' && jsonValue !== null)
      ? jsonValue
      : JSON.parse(jsonValue || 'null');
  } catch {
    obj = null;
  }

  const tecnologia = normalizeTecnologiaKit(obj?.tecnologia);
  const conductor = normalizeCodigo(obj?.conductor);
  const acompanante = normalizeCodigo(obj?.acompanante);
  const prioridad = Number.isFinite(Number(obj?.prioridad)) ? Number(obj.prioridad) : 10;

  await deleteKitProducto(conexion, pid);

  if (!conductor || !acompanante) return;

  await conexion.promise().query(
    `
    INSERT INTO escobillas_kit_producto
      (producto_id, tecnologia, codigo_conductor_norm, codigo_acompanante_norm, prioridad)
    VALUES (?, ?, ?, ?, ?)
    `,
    [pid, tecnologia, conductor, acompanante, prioridad]
  );
}

async function saveFromRequest(conexion, productoId, body) {
  const tipo = normalizeTipo(body?.escobillas_tipo);
  if (!tipo) return;

  if (tipo === 'kit') {
    await setKitProducto(conexion, productoId, body?.escobillas_kit_json);
    await deleteCodigosProducto(conexion, productoId);
  } else {
    await setCodigosProducto(conexion, productoId, body?.escobillas_codigos_json);
    await deleteKitProducto(conexion, productoId);
  }
}

module.exports = {
  getCodigosProducto,
  getKitProducto,
  saveFromRequest
};
