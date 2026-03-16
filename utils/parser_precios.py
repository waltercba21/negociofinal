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

    preferidas = [name for name, n in nn if n.startswith('lista de precio')]
    if preferidas: return preferidas  # LAM, SUDIMAR, SUDIMAR LED

    preferidas = [name for name, n in nn if n == 'page1']
    if preferidas: return preferidas  # MYL

    hoja1 = [name for name, n in nn if n.startswith('hoja1')]
    if hoja1 and len(sheet_names) <= 4: return hoja1  # lider

    return [name for name, n in nn if n not in _HOJAS_IGNORAR]

# ─── Conversión .xls ─────────────────────────────────────────────────────────

def convertir_xls(input_path):
    tmp_dir = tempfile.mkdtemp(prefix='parser_pp_')
    r = subprocess.run(
        ['libreoffice','--headless','--convert-to','xlsx','--outdir', tmp_dir, input_path],
        capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError(f'LibreOffice error: {r.stderr[:200]}')
    out = os.path.join(tmp_dir, os.path.splitext(os.path.basename(input_path))[0] + '.xlsx')
    if not os.path.exists(out):
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise RuntimeError(f'No se encontró el archivo en {tmp_dir}')
    return out, tmp_dir

# ─── Función pública ──────────────────────────────────────────────────────────

def parsear_archivo(file_path):
    """
    Parsea un archivo Excel de lista de precios.
    Retorna: { items, hojas, errores }
    Cada item: { codigo:str, precio:float, descripcion:str, hoja:str }
    """
    errores = []
    tmp_dir = None
    path_usar = file_path

    if os.path.splitext(file_path)[1].lower() == '.xls':
        try:
            path_usar, tmp_dir = convertir_xls(file_path)
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
    for sh in hojas:
        try:
            todos.extend(parsear_hoja(sh, wb[sh]))
        except Exception as e:
            errores.append(f'Hoja "{sh}": {e}')
    wb.close()

    # Deduplicar por código normalizado → mayor precio
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
