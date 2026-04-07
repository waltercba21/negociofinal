#!/usr/bin/env python3
"""
parser_precios.py  v3
Motor inteligente de detección y normalización de listas de precios de proveedores.
Entrada : ruta a archivo .xlsx o .xls
Salida  : JSON stdout  { items:[{codigo,precio,descripcion,hoja}], errores:[], hojas:[] }

Estrategia de detección (por orden):
  1. Header completo: si fila encabezado da TANTO codigo COMO precio → usar directamente
  2. Header parcial : si fila encabezado da codigo pero NO precio → retener codigo del header,
                      buscar precio + descripcion vía heurística sobre columnas numéricas
  3. Heurística pura: si no hay header detectable → inferir todo por tipos de dato
"""

import sys, os, re, json, subprocess, tempfile, shutil, unicodedata
import openpyxl

# ─── Utilidades ───────────────────────────────────────────────────────────────

def norm(v):
    if v is None: return ''
    s = unicodedata.normalize('NFD', str(v))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'\s+', ' ', s).strip().lower()

def limpiar_precio(v):
    if v is None or v == '': return None
    if isinstance(v, (int, float)):
        return float(v) if 0 < v < 1_000_000_000 else None
    s = re.sub(r'[$\s]', '', str(v).strip())
    if re.search(r'\.\d{3},', s): s = s.replace('.','').replace(',','.')
    elif ',' in s and '.' not in s: s = s.replace(',','.')
    try:
        n = float(s)
        return n if 0 < n < 1_000_000_000 else None
    except: return None

def limpiar_codigo(v):
    if v is None: return None
    s = str(v).strip()
    if re.match(r'^\d+\.0$', s): s = s[:-2]
    return s if len(s) >= 1 else None

def es_fila_vacia(row):
    return all(c is None or str(c).strip() == '' for c in row)

# ─── Detección de fila encabezado ─────────────────────────────────────────────

_CLAVES_ENC = ['codigo','cod.','precio','articulo','descripcion',
               'detalle','producto','nombre','importe','referencia']

def es_fila_encabezado(row):
    celdas = [c for c in row if c is not None and str(c).strip()]
    if not celdas: return False
    cortas = sum(1 for c in celdas if len(str(c).strip()) < 25)
    if cortas / len(celdas) < 0.5: return False
    joined = norm(' '.join(str(c) for c in celdas))
    return any(k in joined for k in _CLAVES_ENC)

# ─── Candidatos y matching ────────────────────────────────────────────────────

_CAND_PRECIO = [
    'precio de lista pesos','precio de lista ars','precio de lista',
    'precio lista pesos','precio lista ars','precio lista',
    'precio unitario','precio','importe','valor',
]
_EXCLUIR_PRECIO = ['usd','dolar','dollar','u$s','us$','oferta','minimo','online','costo']

_CAND_CODIGO = [
    'cod_articulo','codigo unico','codigo articulo','codigo',
    'cod. izq.','cod. izq','cod. der','cod.','cod',
    'item','referencia','ref',
]
_CAND_DESC = [
    'descripcion','detalle de los productos','detalle','articulo',
    'nombre','producto','denominacion',
]

def _match(hn, candidates, min_sw=7, min_inc=8):
    if len(hn) > 30: return False
    for c in candidates:
        cn = norm(c)
        if hn == cn: return True
        if len(cn) >= min_sw and hn.startswith(cn): return True
        if len(cn) >= min_inc and cn in hn: return True
    return False

def _precio_excluido(hn):
    return any(e in hn for e in _EXCLUIR_PRECIO)

# ─── Detección de columnas desde header ───────────────────────────────────────

def detectar_columnas_header(header_row):
    """
    Detecta código, precio y descripción desde una fila de encabezado.
    Retorna dict {codigo, precio, descripcion, codigo_alt}.
    Un campo None indica que no se encontró.
    """
    result = {'codigo': None, 'precio': None, 'descripcion': None, 'codigo_alt': None}

    # Precio: recorrer candidatos en orden de especificidad (más específico primero)
    for cand in _CAND_PRECIO:
        cn = norm(cand)
        for idx, cell in enumerate(header_row):
            if cell is None: continue
            hn = norm(str(cell))
            if _precio_excluido(hn): continue
            if hn == cn or (len(cn) >= 7 and hn.startswith(cn)) or (len(cn) >= 8 and cn in hn):
                result['precio'] = idx
                break
        if result['precio'] is not None: break

    # Código y descripción (en un solo recorrido)
    for idx, cell in enumerate(header_row):
        if cell is None: continue
        hn = norm(str(cell))
        if not hn: continue

        if result['codigo'] is None and _match(hn, _CAND_CODIGO):
            result['codigo'] = idx
        elif result['codigo_alt'] is None and _match(hn, _CAND_CODIGO):
            result['codigo_alt'] = idx

        # Descripción: solo si la columna no es ya el código
        if (result['descripcion'] is None
                and _match(hn, _CAND_DESC)
                and idx != result['codigo']
                and idx != result['codigo_alt']):
            result['descripcion'] = idx

    return result

# ─── Detección heurística ─────────────────────────────────────────────────────

def detectar_precio_heuristica(rows, excluir_cols=None):
    """
    Encuentra la columna de precio y descripción por tipos de dato.
    excluir_cols: set de índices a ignorar (ya asignados desde header).
    Retorna dict {precio, descripcion}.
    """
    excluir = excluir_cols or set()
    sample = [r for r in rows if not es_fila_vacia(r)][:40]
    if not sample: return {'precio': None, 'descripcion': None}

    ncols = max((len(r) for r in sample), default=0)
    stats = []

    for c in range(ncols):
        if c in excluir: continue
        vals = [r[c] for r in sample if c < len(r) and r[c] is not None and str(r[c]).strip()]
        if not vals:
            stats.append({'col':c,'precio_score':0,'avg_len':0,'total':0,'avg_num':0}); continue
        ok = [p for p in [limpiar_precio(v) for v in vals] if p is not None]
        stats.append({
            'col': c,
            'precio_score': len(ok)/len(vals),
            'avg_len': sum(len(str(v).strip()) for v in vals)/len(vals),
            'total': len(vals),
            'avg_num': sum(ok)/len(ok) if ok else 0,
        })

    precio_cols = [s for s in stats if s['precio_score'] > 0.7 and s['avg_num'] > 500]
    if not precio_cols: return {'precio': None, 'descripcion': None}
    precio_col = max(precio_cols, key=lambda s: s['avg_num'])

    antes = [s for s in stats
             if s['col'] < precio_col['col']
             and s['total'] >= len(sample) * 0.3
             and s['avg_len'] > 2]

    desc_col = max(antes, key=lambda s: s['avg_len']) if antes else None

    return {
        'precio': precio_col['col'],
        'descripcion': desc_col['col'] if desc_col else None,
    }

def detectar_columnas_heuristica(rows):
    """
    Detección completa cuando no hay header. Infiere codigo, precio, descripcion.
    """
    sample = [r for r in rows if not es_fila_vacia(r)][:40]
    if not sample: return None

    ncols = max((len(r) for r in sample), default=0)
    stats = []
    for c in range(ncols):
        vals = [r[c] for r in sample if c < len(r) and r[c] is not None and str(r[c]).strip()]
        if not vals:
            stats.append({'col':c,'precio_score':0,'avg_len':0,'total':0,'avg_num':0}); continue
        ok = [p for p in [limpiar_precio(v) for v in vals] if p is not None]
        stats.append({
            'col': c,
            'precio_score': len(ok)/len(vals),
            'avg_len': sum(len(str(v).strip()) for v in vals)/len(vals),
            'total': len(vals),
            'avg_num': sum(ok)/len(ok) if ok else 0,
        })

    precio_cols = [s for s in stats if s['precio_score'] > 0.7 and s['avg_num'] > 500]
    if not precio_cols: return None
    precio_col = max(precio_cols, key=lambda s: s['avg_num'])

    antes = [s for s in stats
             if s['col'] < precio_col['col']
             and s['total'] >= len(sample) * 0.3
             and s['avg_len'] > 1]
    if not antes: return None

    desc_col = max(antes, key=lambda s: s['avg_len'])
    codigo_cands = [s for s in antes if s['col'] != desc_col['col']]
    codigo_col = min(codigo_cands, key=lambda s: s['avg_len']) if codigo_cands else desc_col

    return {
        'codigo': codigo_col['col'],
        'precio': precio_col['col'],
        'descripcion': desc_col['col'] if desc_col != codigo_col else None,
        'codigo_alt': None,
    }

# ─── Parsear una hoja ─────────────────────────────────────────────────────────

def parsear_hoja(sheet_name, ws):
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2: return []

    header_idx = -1
    cols = None
    data_rows = [r for r in rows if not es_fila_vacia(r)]

    # Buscar fila header en primeras 12 filas
    for i, row in enumerate(rows[:12]):
        if es_fila_vacia(row): continue
        if not es_fila_encabezado(row): continue
        detected = detectar_columnas_header(row)

        if detected['precio'] is not None and detected['codigo'] is not None:
            # Caso 1: header completo → usar directamente
            header_idx = i
            cols = detected
            break

        if detected['codigo'] is not None and detected['precio'] is None:
            # Caso 2: header parcial (tiene código, sin precio)
            # → retener código del header, buscar precio+desc vía heurística
            excluir = {detected['codigo']}
            if detected['codigo_alt'] is not None: excluir.add(detected['codigo_alt'])
            heur = detectar_precio_heuristica(data_rows, excluir_cols=excluir)
            if heur['precio'] is not None:
                header_idx = i
                cols = {
                    'codigo': detected['codigo'],
                    'codigo_alt': detected['codigo_alt'],
                    'precio': heur['precio'],
                    'descripcion': heur['descripcion'],
                }
                break

    # Caso 3: sin header utilizable → heurística completa
    if cols is None or cols['precio'] is None:
        cols = detectar_columnas_heuristica(data_rows)
        if not cols: return []
        header_idx = -1

    items = []
    for row in rows[header_idx + 1:]:
        if es_fila_vacia(row): continue

        def get(idx):
            return row[idx] if idx is not None and idx < len(row) else None

        precio = limpiar_precio(get(cols['precio']))
        if not precio: continue

        codigos = []
        c1 = limpiar_codigo(get(cols['codigo']))
        if c1: codigos.append(c1)
        c2 = limpiar_codigo(get(cols.get('codigo_alt')))
        if c2 and c2 not in codigos: codigos.append(c2)
        if not codigos: continue

        descripcion = str(get(cols['descripcion']) or '').strip()

        for codigo in codigos:
            items.append({'codigo': codigo, 'precio': precio,
                          'descripcion': descripcion, 'hoja': sheet_name})
    return items

# ─── Selección de hojas ───────────────────────────────────────────────────────

_HOJAS_IGNORAR = {
    'indice','encabezado','portada',
    'precio minimo online','precios minimos online',
    'hoja2','hoja3','page2','page3',
}

def seleccionar_hojas(sheet_names):
    if len(sheet_names) == 1: return sheet_names
    nn = [(n, norm(n)) for n in sheet_names]

    for name, n in nn:
        if 'lista abreviada' in n: return [name]  # distri

    # FAL: priorizar hoja maestra con todos los productos
    for name, n in nn:
        if n == _FAL_HOJA_MAESTRA: return [name]

    preferidas = [name for name, n in nn if n.startswith('lista de precio')]
    if preferidas: return preferidas  # LAM, SUDIMAR

    preferidas = [name for name, n in nn if n == 'page1']
    if preferidas: return preferidas  # MYL

    # Hojas que empiezan con 'lista' (ej: 'Lista 166' de Faros Ausili)
    preferidas = [name for name, n in nn if n.startswith('lista')]
    if preferidas: return preferidas

    hoja1 = [name for name, n in nn if n.startswith('hoja1')]
    if hoja1 and len(sheet_names) <= 4: return hoja1  # lider

    return [name for name, n in nn if n not in _HOJAS_IGNORAR]

# ─── Conversión .xls ─────────────────────────────────────────────────────────

def convertir_xls(input_path):
    tmp_dir = tempfile.mkdtemp(prefix='parser_pp_')
    # Ruta absoluta para que funcione cuando lo lanza Node.js (PATH reducido)
    lo_bin = None
    for candidate in ['/usr/bin/libreoffice', '/usr/local/bin/libreoffice',
                      '/opt/libreoffice/program/soffice', '/usr/lib/libreoffice/program/soffice']:
        if os.path.isfile(candidate):
            lo_bin = candidate
            break
    if not lo_bin:
        # Último recurso: buscar en PATH
        import shutil as _shutil
        lo_bin = _shutil.which('libreoffice') or _shutil.which('soffice')
    if not lo_bin:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError('No se encontró LibreOffice. Instalá libreoffice con: dnf install libreoffice-calc')

    r = subprocess.run(
        [lo_bin, '--headless', '--convert-to', 'xlsx', '--outdir', tmp_dir, input_path],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=120)
    if r.returncode != 0:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError('LibreOffice error: ' + (r.stderr or b'').decode('utf-8', errors='replace')[:200])
    out = os.path.join(tmp_dir, os.path.splitext(os.path.basename(input_path))[0] + '.xlsx')
    if not os.path.exists(out):
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError(f'No se encontró el archivo en {tmp_dir}')
    return out, tmp_dir

# ─── Detección y parser especializado para FAROS AUSILI ──────────────────────
# Su lista tiene:
#   col 0 = código, col 1 = descripción
#   col 2 = precio en PESOS (algunos productos)
#   col 3 = precio en DÓLARES (mayoría de productos) → convertir × TIPO_CAMBIO_USD
# La fila 6 (índice) tiene los encabezados "PESOS" y "DÓLARES" en esas columnas.

TIPO_CAMBIO_USD = 1500  # Tipo de cambio dólar oficial → pesos argentinos

def _es_archivo_faros_ausili(ws):
    """True si la hoja tiene la estructura característica de Faros Ausili."""
    rows = list(ws.iter_rows(values_only=True, max_row=10))
    for row in rows:
        if not row: continue
        # Normalizar cada celda quitando acentos para comparar
        vals_norm = set()
        for v in row:
            if v is not None and str(v).strip():
                s = unicodedata.normalize('NFD', str(v).strip())
                s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
                vals_norm.add(s.upper())
        if 'PESOS' in vals_norm and 'DOLARES' in vals_norm:
            return True
    return False

def parsear_hoja_faros_ausili(sheet_name, ws):
    """
    Parser especializado para FAROS AUSILI.
    - col 0: código
    - col 1: descripción
    - col 2: precio en PESOS (directo)
    - col 3: precio en DÓLARES (× TIPO_CAMBIO_USD para convertir a pesos)
    Si un producto tiene precio en PESOS usa ese; si tiene en DÓLARES lo convierte.
    """
    rows = list(ws.iter_rows(values_only=True))
    items = []

    for row in rows:
        if not row or all(c is None or str(c).strip() == '' for c in row):
            continue

        def get(idx):
            return row[idx] if idx < len(row) else None

        codigo = limpiar_codigo(get(0))
        if not codigo:
            continue

        descripcion = str(get(1) or '').strip()

        # Intentar precio en pesos primero (col 2)
        precio_pesos = limpiar_precio(get(2))
        # Intentar precio en dólares (col 3) y convertir
        precio_usd   = limpiar_precio(get(3))

        if precio_pesos and precio_pesos > 0:
            precio_final = precio_pesos
        elif precio_usd and precio_usd > 0:
            precio_final = round(precio_usd * TIPO_CAMBIO_USD, 2)
        else:
            continue  # Sin precio válido

        items.append({
            'codigo':      codigo,
            'precio':      precio_final,
            'descripcion': descripcion,
            'hoja':        sheet_name,
        })

    return items

# ─── Detección y mapeo especial para archivos DM ─────────────────────────────
# DM envía un único archivo con todos sus sub-proveedores mezclados.
# La columna "origen" y "padron" determinan a qué sub-proveedor pertenece cada fila.
# El usuario selecciona "DM" (id=8) y el sistema distribuye automáticamente.

_DM_COLUMNAS = {'cod_articulo', 'padron', 'origen', 'articulo', 'precio', 'marca'}

def _es_archivo_dm(ws):
    """True si la hoja tiene la estructura característica de DM."""
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i > 5: break
        if row and any(c is not None for c in row):
            celdas = {norm(str(c)) for c in row if c is not None and str(c).strip()}
            if len(_DM_COLUMNAS & celdas) >= 4:
                return True
    return False

def _mapear_subproveedor_dm(padron, origen):
    """
    Devuelve lista de proveedor_ids para una fila del archivo DM.
    Basado en los sub-proveedores reales de la BD:
      8  DM            14 DM LAM       18 DM VIDRIOS
      12 DM FAL        15 DM FITAM     19 DM LAMPARAS
      16 DM VIC        17 DM AP        34 DM LAMPARAS LED
    """
    p = padron.strip().upper() if padron else ''
    o = origen.strip().upper() if origen else ''

    provs = []

    # Origen → sub-proveedor específico
    if o == 'VIC':         provs.append(16)   # DM VIC
    if o == 'LAM':         provs.append(14)   # DM LAM
    if o == 'FITAM':       provs.append(15)   # DM FITAM
    if o == 'A-PLASTIC':   provs.append(17)   # DM AP
    if o == 'FAL':         provs.append(12)   # DM FAL
    if o == 'POLICARBONATO' or p == 'VIDRIOS DE OPTICA':
        provs.append(18)                       # DM VIDRIOS
    if p == 'LAMPARAS':
        provs.append(19)                       # DM LAMPARAS
        provs.append(34)                       # DM LAMPARAS LED

    # Todo lo demás va al proveedor DM genérico (id=8)
    if not provs or o in (
        'DEPO','IMPORTADO','NACIONAL','ORIGINAL','T-ORIGINAL','ORIGINAL-A',
        'BRASIL','TAIWAN','ARGENTA','HELLA','INOVOX','MARELLI','VALEO','ORGUS',
        'DAM','CELCO','EURO','HT','LEDEX','COFRAN','BORHAM','PHILIPS',
        'FICO','FTM','METAGAL','VIEW-MAX','SAN JUSTO','','.','BRASIL'
    ):
        provs.append(8)                        # DM genérico

    # Deduplicar manteniendo orden
    seen = set()
    return [p for p in provs if not (p in seen or seen.add(p))]

def parsear_hoja_dm(sheet_name, ws):
    """
    Parser especializado para el archivo DM.
    Devuelve items con campo extra 'proveedor_id_override' (lista de ids).
    Header: cod_articulo | marca | padron | articulo | origen | precio
    """
    rows = list(ws.iter_rows(values_only=True))
    if not rows: return []

    # Buscar fila header
    header_idx = -1
    col_cod = col_padron = col_origen = col_articulo = col_precio = None

    for i, row in enumerate(rows[:5]):
        if not row: continue
        cells_norm = [norm(str(c)) if c else '' for c in row]
        if 'cod_articulo' in cells_norm and 'precio' in cells_norm:
            header_idx = i
            col_cod     = cells_norm.index('cod_articulo')
            col_precio  = cells_norm.index('precio')
            col_padron  = cells_norm.index('padron') if 'padron' in cells_norm else None
            col_origen  = cells_norm.index('origen') if 'origen' in cells_norm else None
            col_articulo= cells_norm.index('articulo') if 'articulo' in cells_norm else None
            break

    if header_idx < 0 or col_precio is None: return []

    items = []
    for row in rows[header_idx + 1:]:
        if not row or all(c is None or str(c).strip() == '' for c in row): continue

        def get(idx):
            return row[idx] if idx is not None and idx < len(row) else None

        precio = limpiar_precio(get(col_precio))
        if not precio: continue

        codigo = limpiar_codigo(get(col_cod))
        if not codigo: continue

        padron  = str(get(col_padron)  or '').strip()
        origen  = str(get(col_origen)  or '').strip()
        articulo= str(get(col_articulo) or '').strip()

        prov_ids = _mapear_subproveedor_dm(padron, origen)

        for prov_id in prov_ids:
            items.append({
                'codigo':               codigo,
                'precio':               precio,
                'descripcion':          articulo,
                'hoja':                 sheet_name,
                'proveedor_id_override': prov_id,
            })

    return items


# ─── Detección y parser especializado para FAL (F066) ────────────────────────
# El archivo F066 es .xls con múltiples hojas por marca + una hoja maestra
# "LISTA PRECIOS GESTION AL DIA" que contiene todos los productos.
# Estructura hoja maestra: col 0=codigo, col 3=descripcion, col 4=precio

_FAL_HOJA_MAESTRA = 'lista precios gestion al dia'

def _es_hoja_maestra_fal(ws):
    """True si la hoja es la hoja maestra de FAL con todos los productos."""
    rows = list(ws.iter_rows(values_only=True, max_row=2))
    if not rows or not rows[0]: return False
    vals = [norm(str(v)) for v in rows[0] if v is not None]
    return 'codigo' in vals and 'precio1' in vals and 'descripcion' in vals

def parsear_hoja_fal(sheet_name, ws):
    """
    Parser para la hoja maestra de FAL.
    col 0=codigo, col 3=descripcion, col 4=precio
    """
    rows = list(ws.iter_rows(values_only=True))
    if len(rows) < 2: return []
    items = []
    for row in rows[1:]:
        if not row or all(c is None or str(c).strip() == '' for c in row):
            continue
        def get(idx): return row[idx] if idx < len(row) else None
        codigo = limpiar_codigo(get(0))
        if not codigo: continue
        descripcion = str(get(3) or '').strip()
        precio = limpiar_precio(get(4))
        if not precio or precio <= 0: continue
        items.append({'codigo': codigo, 'precio': precio,
                      'descripcion': descripcion, 'hoja': sheet_name})
    return items


def _parsear_xls_con_xlrd(file_path):
    """
    Parsea archivos .xls directamente con xlrd (sin LibreOffice).
    Soporta el formato FAL (F066) con hoja maestra 'LISTA PRECIOS GESTION AL DIA'.
    """
    import xlrd as _xlrd
    errores = []
    todos = []

    try:
        wb = _xlrd.open_workbook(file_path)
    except Exception as e:
        return {'items': [], 'hojas': [], 'errores': [f'No se pudo leer el .xls: {e}']}

    sheet_names = wb.sheet_names()
    hojas = seleccionar_hojas(sheet_names)

    for sh in hojas:
        ws = wb.sheet_by_name(sh)
        try:
            rows_raw = []
            for i in range(ws.nrows):
                row = [ws.cell_value(i, j) for j in range(ws.ncols)]
                rows_raw.append(row)

            if not rows_raw: continue

            # Detectar hoja maestra FAL
            header = rows_raw[0]
            vals_h = [norm(str(v)) for v in header if v is not None and str(v).strip()]
            if 'codigo' in vals_h and 'precio1' in vals_h and 'descripcion' in vals_h:
                # Parser FAL: col 0=codigo, col 3=descripcion, col 4=precio
                for row in rows_raw[1:]:
                    if not row or all(str(c).strip() == '' for c in row): continue
                    def get(idx): return row[idx] if idx < len(row) else None
                    codigo = limpiar_codigo(get(0))
                    if not codigo: continue
                    descripcion = str(get(3) or '').strip()
                    precio = limpiar_precio(get(4))
                    if not precio or precio <= 0: continue
                    todos.append({'codigo': codigo, 'precio': precio,
                                  'descripcion': descripcion, 'hoja': sh})
            else:
                # Parser genérico: buscar código en col 0, precio en col 4
                # (estructura estándar de hojas por marca de FAL)
                for row in rows_raw[1:]:
                    if not row or all(str(c).strip() == '' for c in row): continue
                    def get(idx): return row[idx] if idx < len(row) else None
                    codigo = limpiar_codigo(get(0))
                    if not codigo or codigo.startswith('*'): continue
                    precio = limpiar_precio(get(4)) if len(row) > 4 else None
                    if not precio or precio <= 0: continue
                    descripcion = str(get(2) or '').strip()
                    todos.append({'codigo': codigo, 'precio': precio,
                                  'descripcion': descripcion, 'hoja': sh})
        except Exception as e:
            errores.append(f'Hoja "{sh}": {e}')

    dedup = {}
    for item in todos:
        key = item['codigo'].strip().upper()
        if key not in dedup or item['precio'] > dedup[key]['precio']:
            dedup[key] = item

    return {'items': list(dedup.values()), 'hojas': hojas, 'errores': errores}


def parsear_archivo(file_path):
    """
    Parsea un archivo Excel de lista de precios.
    Retorna: { items, hojas, errores }
    Cada item: { codigo:str, precio:float, descripcion:str, hoja:str }
    """
    errores = []
    tmp_dir = None
    path_usar = file_path

    # Detectar formato por magic bytes, no por extensión.
    # OLE2 (.xls): D0 CF 11 E0  |  ZIP/xlsx: 50 4B 03 04
    # Así funciona aunque el archivo llegue sin extensión o con nombre raro.
    def _es_xls_ole2(path):
        try:
            with open(path, 'rb') as fh:
                return fh.read(4) == b'\xd0\xcf\x11\xe0'
        except Exception:
            return False

    ext = os.path.splitext(file_path)[1].lower()
    necesita_conversion = (ext == '.xls') or _es_xls_ole2(file_path)

    if necesita_conversion:
        # Intentar convertir con LibreOffice
        try:
            path_usar, tmp_dir = convertir_xls(file_path)
        except Exception as lo_err:
            # LibreOffice no disponible — intentar con xlrd directamente
            try:
                import xlrd as _xlrd
                return _parsear_xls_con_xlrd(file_path)
            except ImportError:
                return {'items': [], 'hojas': [], 'errores': [
                    f'No se pudo convertir el .xls: {lo_err}. Instalá xlrd: pip install xlrd'
                ]}
            except Exception as e:
                return {'items': [], 'hojas': [], 'errores': [str(e)]}

    try:
        wb = openpyxl.load_workbook(path_usar, read_only=True, data_only=True)
    except Exception as e:
        return {'items': [], 'hojas': [], 'errores': [f'No se pudo leer: {e}']}
    finally:
        if tmp_dir: shutil.rmtree(tmp_dir, ignore_errors=True)

    hojas = seleccionar_hojas(wb.sheetnames)
    todos = []
    es_dm = False

    for sh in hojas:
        ws = wb[sh]
        try:
            # Detectar si es archivo DM antes de parsear
            if _es_archivo_dm(ws):
                es_dm = True
                ws2 = wb[sh]
                todos.extend(parsear_hoja_dm(sh, ws2))
            elif _es_hoja_maestra_fal(ws):
                ws2 = wb[sh]
                todos.extend(parsear_hoja_fal(sh, ws2))
            elif _es_archivo_faros_ausili(ws):
                ws2 = wb[sh]
                todos.extend(parsear_hoja_faros_ausili(sh, ws2))
            else:
                todos.extend(parsear_hoja(sh, ws))
        except Exception as e:
            errores.append(f'Hoja "{sh}": {e}')
    wb.close()

    if es_dm:
        # Para DM: deduplicar por (codigo, proveedor_id_override) — precio mayor
        dedup = {}
        for item in todos:
            key = (item['codigo'].strip().upper(), item.get('proveedor_id_override', 0))
            if key not in dedup or item['precio'] > dedup[key]['precio']:
                dedup[key] = item
    else:
        # Normal: deduplicar solo por codigo → mayor precio
        dedup = {}
        for item in todos:
            key = item['codigo'].strip().upper()
            if key not in dedup or item['precio'] > dedup[key]['precio']:
                dedup[key] = item

    return {'items': list(dedup.values()), 'hojas': hojas, 'errores': errores}

# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Uso: parser_precios.py <archivo>'}))
        sys.exit(1)
    print(json.dumps(parsear_archivo(sys.argv[1]), ensure_ascii=False))