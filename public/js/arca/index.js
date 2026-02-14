
// SweetAlert2: estilos/acciones consistentes (usa las clases .btn del CSS de la página)
const ARCA_SWAL = (() => {
  const confirm = Swal.mixin({
    buttonsStyling: false,
    reverseButtons: true,
    focusCancel: true,
    customClass: {
      confirmButton: "btn primary",
      cancelButton: "btn secondary",
      denyButton: "btn danger",
    },
  });

  const toast = Swal.mixin({
    toast: true,
    position: "top-end",
    timer: 1800,
    timerProgressBar: true,
    showConfirmButton: false,
    buttonsStyling: false,
  });

  return { confirm, toast };
})();
// public/js/arca/index.js
(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    limit: 50,
    offset: 0,
    rows: [],
    selectedId: null,
    selectedArcaId: null,
    selectedArcaEstado: null,
    search: "",
  };

 const DRAFT_PREFIX = "arca_emit_draft_v1:";
const wsfeHistEl = $("wsfeHist");
const wsfeBadgeEl = $("wsfeBadge");
const btnAuditarWsfe = $("btnAuditarWsfe");

function draftKeyForFactura(facturaId) {
  return `${DRAFT_PREFIX}${Number(facturaId)}`;
}

function loadDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null") || null; }
  catch { return null; }
}

function saveDraft(key, d) {
  try { sessionStorage.setItem(key, JSON.stringify(d || {})); }
  catch {}
}


  function money(n) {
    const x = Number(n || 0);
    return x.toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function badge(estado) {
    if (!estado) return `<span class="badge b-none">SIN</span>`;
    if (estado === "EMITIDO") return `<span class="badge b-ok">EMITIDO</span>`;
    if (estado === "PENDIENTE") return `<span class="badge b-pend">PEND.</span>`;
    if (estado === "RECHAZADO") return `<span class="badge b-bad">RECHAZ.</span>`;
    return `<span class="badge b-none">${estado}</span>`;
  }

  async function fetchJSON(url, opts) {
    const r = await fetch(url, opts);
    const txt = await r.text();
    let data = {};
    try {
      data = txt ? JSON.parse(txt) : {};
    } catch {
      data = { raw: txt };
    }
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data;
  }

  function renderPager() {
    const from = state.offset + 1;
    const to = state.offset + state.rows.length;
    $("arcaPage").textContent = state.rows.length ? `${from}–${to}` : "0–0";
  }

  function applySearch(rows) {
    const s = (state.search || "").toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        String(r.id).includes(s) ||
        String(r.nombre_cliente || "").toLowerCase().includes(s)
    );
  }

function renderList() {
  const tbody = $("arcaTbody");
  const rows = applySearch(state.rows);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Sin resultados</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map(
      (r) => `
        <tr class="arca-row ${Number(r.id) === Number(state.selectedId) ? "is-selected" : ""}" data-id="${r.id}">
          <td><strong>#${r.id}</strong></td>
          <td class="muted">${r.fecha || "-"}</td>
          <td>${(r.nombre_cliente || "").toUpperCase()}</td>
          <td><strong>${money(r.total)}</strong></td>
          <td class="muted">${r.metodos_pago || "-"}</td>
          <td>
            ${badge(r.arca_estado)}
            ${
              r.arca_cae
                ? `<div class="muted" style="margin-top:4px;font-size:12px">CAE ${r.arca_cae}</div>`
                : ""
            }
          </td>
        </tr>
      `
    )
    .join("");

  tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => onSelect(Number(tr.dataset.id)));
  });
}

  async function loadList() {
    $("arcaTbody").innerHTML = `<tr><td colspan="6" class="muted">Cargando…</td></tr>`;
    const q = new URLSearchParams({
      limit: String(state.limit),
      offset: String(state.offset),
    });
    const data = await fetchJSON(`/arca/ui/facturas?${q.toString()}`);
    state.rows = data.rows || [];
    renderList();
    renderPager();
  }

  // ---------------- WSFE UI ----------------
  function wsfeBadge(ok) {
    if (ok === true) return `<span class="badge b-ok">OK</span>`;
    if (ok === false) return `<span class="badge b-bad">DIF</span>`;
    return `<span class="badge b-none">—</span>`;
  }

  function renderWsfeHistory(rows) {
    if (!wsfeHistEl) return;

    if (!rows || !rows.length) {
      wsfeHistEl.innerHTML = `<div class="muted">Sin auditorías WSFE.</div>`;
      if (wsfeBadgeEl) wsfeBadgeEl.style.display = "none";
      return;
    }

    const last = rows[0];
    if (wsfeBadgeEl) {
      wsfeBadgeEl.style.display = "inline-flex";
      wsfeBadgeEl.className = `badge ${last.ok ? "b-ok" : "b-bad"}`;
      wsfeBadgeEl.textContent = last.ok ? "OK" : "DIF";
    }

    wsfeHistEl.innerHTML = rows
      .map((r) => {
        const diffsKeys = r.diffs ? Object.keys(r.diffs) : [];
        const diffsLine = diffsKeys.length
          ? `<div class="histObs"><b>Diferencias:</b> ${diffsKeys.join(
              ", "
            )}</div>`
          : ``;

        return `
          <div class="histItem">
            <div class="histTop">
              <div>${wsfeBadge(r.ok)} <span class="muted">Audit ID ${
          r.id
        }</span></div>
              <div class="histMeta">${r.created_at || ""}</div>
            </div>
            ${diffsLine}
          </div>
        `;
      })
      .join("");
  }

  async function loadWsfeHistory(arcaId) {
    if (!wsfeHistEl) return;
    wsfeHistEl.innerHTML = `<div class="muted">Cargando auditorías WSFE…</div>`;

    try {
      const data = await fetchJSON(`/arca/wsfe/consultas/${arcaId}?limit=20`);
      renderWsfeHistory(data.rows || []);
    } catch (e) {
      wsfeHistEl.innerHTML = `<div class="muted">${
        e.message || "Error cargando auditorías WSFE"
      }</div>`;
      if (wsfeBadgeEl) wsfeBadgeEl.style.display = "none";
    }
  }
async function auditarWsfeActual() {
  if (!btnAuditarWsfe) return;
  const arcaId = state.selectedArcaId;
  const estado = state.selectedArcaEstado;
  if (!arcaId) return;

  // Acción sensible: si está PENDIENTE, se consulta y puede reconciliar.
  if (estado === "PENDIENTE") {
    const ok = await ARCA_SWAL.confirm.fire({
  icon: "warning",
  title: "Confirmar en ARCA",
  text: `Se consultará WSFE y puede reconciliar si corresponde`,
  showCancelButton: true,
  confirmButtonText: "Confirmar",
  cancelButtonText: "Cancelar"
});

    if (!ok.isConfirmed) return;
  }

  btnAuditarWsfe.disabled = true;

  try {
    const url =
      estado === "PENDIENTE"
        ? `/arca/wsfe/consultar/${arcaId}?reconciliar=1`
        : `/arca/wsfe/consultar/${arcaId}`;

    const resp = await fetchJSON(url);
    await loadWsfeHistory(arcaId);

    ARCA_SWAL.toast.fire({
      icon: "success",
      title:
        estado === "PENDIENTE"
          ? (resp.reconciliado ? "Confirmado en ARCA" : "Sin confirmación en WSFE")
          : "Auditoría WSFE ejecutada",
    });

    await loadList();
    if (state.selectedId) await onSelect(state.selectedId);
  } catch (e) {
    ARCA_SWAL.confirm.fire({
      icon: "error",
      title: "WSFE",
      text: e.message || "Error consultando",
    });
  } finally {
    btnAuditarWsfe.disabled = false;
  }
}


  // ---------------- Selección / detalle ----------------
  async function onSelect(id) {
    state.selectedId = id;

    $("arcaEmpty").style.display = "none";
    $("arcaDetail").style.display = "block";
    $("btnEmitir").disabled = false;

    const [det, hist] = await Promise.all([
      fetchJSON(`/arca/ui/facturas/${id}`),
      fetchJSON(`/arca/ui/arca-por-factura/${id}`),
    ]);

    $("dId").textContent = `#${det.factura.id}`;
    $("dFecha").textContent = det.factura.fecha || "-";
    $("dVend").textContent = (det.factura.nombre_cliente || "").toUpperCase();
    $("dPago").textContent = det.factura.metodos_pago || "-";
    $("dTotal").textContent = money(det.factura.total);

    $("itemsTbody").innerHTML = (det.items || [])
      .map(
        (it) => `
      <tr>
        <td>${it.descripcion || "(sin nombre)"}</td>
        <td>${it.cantidad}</td>
        <td>${money(it.precio_unitario)}</td>
        <td><strong>${money(it.subtotal)}</strong></td>
      </tr>
    `
      )
      .join("");

    const rows = hist.rows || [];
    $("arcaHist").innerHTML = rows.length
      ? rows
          .map((r) => {
            const caeLine = r.cae ? `CAE ${r.cae} · Vto ${r.cae_vto}` : "";
            const obsLine = r.obs_code
              ? `${r.obs_code} — ${r.obs_msg || ""}`
              : "";
            return `
        <div class="histItem">
          <div class="histTop">
            <div>${badge(
              r.estado
            )} <span class="muted">Cbte ${r.cbte_tipo}-${r.cbte_nro} · ${
              r.cbte_fch
            }</span></div>
            <div class="histMeta">${r.created_at || ""}</div>
          </div>
          ${caeLine ? `<div class="histObs">${caeLine}</div>` : ""}
          ${obsLine ? `<div class="histObs">${obsLine}</div>` : ""}
        </div>
      `;
          })
          .join("")
      : `<div class="muted">Sin intentos ARCA.</div>`;

   // --- WSFE UI ---
state.selectedArcaId = null;
state.selectedArcaEstado = null;
if (btnAuditarWsfe) btnAuditarWsfe.disabled = true;

if (wsfeHistEl)
  wsfeHistEl.innerHTML = `<div class="muted">Seleccioná un comprobante EMITIDO o PENDIENTE.</div>`;
if (wsfeBadgeEl) wsfeBadgeEl.style.display = "none";

const lastPending = (rows || []).find((x) => x.estado === "PENDIENTE");
const lastEmitted = (rows || []).find((x) => x.estado === "EMITIDO");
const target = lastPending || lastEmitted;

if (target && target.id) {
  state.selectedArcaId = target.id;
  state.selectedArcaEstado = target.estado;

  if (btnAuditarWsfe) {
  btnAuditarWsfe.disabled = false;
  btnAuditarWsfe.classList.toggle("warn", target.estado === "PENDIENTE");
  btnAuditarWsfe.classList.toggle("secondary", target.estado !== "PENDIENTE");
  btnAuditarWsfe.textContent =
    target.estado === "PENDIENTE" ? "Confirmar en ARCA" : "Auditar WSFE";
}


  await loadWsfeHistory(state.selectedArcaId);
} else {
  if (wsfeHistEl)
    wsfeHistEl.innerHTML = `<div class="muted">No hay comprobante EMITIDO ni PENDIENTE.</div>`;
}


    const pdfBtn = document.getElementById("btnPDF");
    if (pdfBtn) {
      if (rows.length && rows[0].estado === "EMITIDO") {
        pdfBtn.style.display = "inline-flex";
        pdfBtn.href = `/arca/pdf/${rows[0].id}`;
      } else {
        pdfBtn.style.display = "none";
        pdfBtn.href = "#";
      }
    }
  }

  // ---------------- Emisión ----------------
  async function emitirSeleccionada() {
    const id = state.selectedId;
    if (!id) return;

    const { isConfirmed, value } = await Swal.fire({
      title: `Emitir ARCA — Factura #${id}`,
      confirmButtonText: "Emitir",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      focusConfirm: false,
      allowEnterKey: false,
html: `
  <div class="arca-swal-form">

    <div class="f">
      <label>Tipo de comprobante</label>
      <select id="sw_cbte" class="swal2-input">
        <option value="1">Factura A (1)</option>
        <option value="6">Factura B (6)</option>
      </select>
    </div>

    <div class="f">
      <label>Tipo de documento</label>
      <select id="sw_doc_tipo" class="swal2-input">
        <option value="80">CUIT (80)</option>
        <option value="96">DNI (96)</option>
        <option value="99">Consumidor Final (99)</option>
      </select>
    </div>

    <div class="f">
      <label>Número Documento</label>
      <input id="sw_doc_nro" class="swal2-input" value="" />
    </div>

    <div class="f">
      <label>Condición IVA</label>
      <select id="sw_cond" class="swal2-input"></select>
    </div>

    <div class="f">
      <label>Nombre Cliente / Razón Social</label>
      <input id="sw_nombre" class="swal2-input" placeholder="Opcional / autocompleta si está en cache" />
    </div>

    <div class="f">
      <label>Domicilio</label>
      <input id="sw_dom" class="swal2-input" placeholder="Opcional" />
    </div>

    <div class="full" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:2px">
      <button type="button" id="sw_cache_btn" class="btn secondary" style="margin:0">Guardar en cache</button>
      <button type="button" id="sw_resolve_btn" class="btn secondary" style="margin:0;display:none">Resolver por padrón</button>
      <span id="sw_cache_status" style="font-size:12px;color:#475467;font-weight:800"></span>
    </div>

  </div>
`,


      didOpen: () => {
        const hint = document.getElementById("sw_hint");
        const inpCbte = document.getElementById("sw_cbte");
        const inpTipo = document.getElementById("sw_doc_tipo");
        const inpNro = document.getElementById("sw_doc_nro");

       inpNro.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  // Enter NO confirma/cierra el modal, solo autocompleta
  e.preventDefault();
  e.stopPropagation();

  // cancela debounce pendiente
  clearTimeout(t);

  toggleResolveBtn();

  const { doc_tipo, doc_nro_str } = currentDoc();

  // CUIT válido => resolver por padrón
  if (doc_tipo === 80 && /^\d{11}$/.test(doc_nro_str)) {
    await resolverPadron();
    return;
  }

  // otros => intenta cache
  await buscarReceptorCache();
});


        const selCond = document.getElementById("sw_cond");
        const inpNom = document.getElementById("sw_nombre");
        const inpDom = document.getElementById("sw_dom");

        const btnCache = document.getElementById("sw_cache_btn");
        const btnResolve = document.getElementById("sw_resolve_btn");
        const stCache = document.getElementById("sw_cache_status");
        const draftKey = draftKeyForFactura(id);

        const setHint = (t) => {
          if (hint) hint.textContent = t || "";
        };
        const setSt = (t) => {
          if (stCache) stCache.textContent = t || "";
        };

        const draft =
         loadDraft(draftKey) || {
            cbte_tipo: 6,
            doc_tipo: 99,
            doc_nro: "",
            receptor_cond_iva_id: null,
            receptor_nombre: "",
            domicilio: "",
          };

        const setVal = (el, v) => {
          if (el && v !== undefined && v !== null) el.value = String(v);
        };

        function syncDraftFromUI() {
          draft.cbte_tipo = Number(inpCbte.value || 0) || 6;
          draft.doc_tipo = Number(inpTipo.value || 0) || 99;
          const nroTrim = String(inpNro.value || "").trim();
          draft.doc_nro = nroTrim ? nroTrim : (draft.doc_tipo === 99 ? "0" : "");

          draft.receptor_cond_iva_id = Number(selCond.value || 0) || null;
          draft.receptor_nombre = (inpNom.value || "").trim();
          draft.domicilio = (inpDom.value || "").trim();
          saveDraft(draftKey, draft);

        }

        const on = (el, fn) => {
          if (!el) return;
          el.addEventListener("input", fn);
          el.addEventListener("change", fn);
        };

        function currentDoc() {
          const doc_tipo = Number(inpTipo.value || 0);
          const doc_nro_str = String(inpNro.value || "").trim();
          const doc_nro = Number(doc_nro_str || 0);
          return { doc_tipo, doc_nro_str, doc_nro };
        }

        async function loadCondIvaOptions() {
          const cbteTipo = Number(inpCbte.value || 0);
          selCond.innerHTML = `<option value="">Cargando...</option>`;

          const r = await fetch(
            `/arca/params/cond-iva-receptor?cbte_tipo=${cbteTipo}`
          );
          const txt = await r.text();
          let data = {};
          try {
            data = txt ? JSON.parse(txt) : {};
          } catch {
            data = {};
          }

          const rows = Array.isArray(data.rows) ? data.rows.slice() : [];

          if (cbteTipo === 6 && !rows.some((x) => Number(x.id) === 5)) {
            rows.unshift({ id: 5, desc: "Consumidor Final", cmp_clase: "B/C" });
          }

          selCond.innerHTML = rows
            .map((o) => `<option value="${o.id}">${o.id} - ${o.desc}</option>`)
            .join("");

          if (cbteTipo === 6 && rows.some((o) => Number(o.id) === 5))
            selCond.value = "5";
          else if (cbteTipo === 1 && rows.some((o) => Number(o.id) === 1))
            selCond.value = "1";
          else selCond.value = rows[0]?.id ? String(rows[0].id) : "";
        }

        function applyRules() {
          const cbteTipo = Number(inpCbte.value || 0);

          if (cbteTipo === 1) {
  inpTipo.value = "80";
  if (String(inpNro.value || "").trim() === "0") inpNro.value = "";
  setHint("Factura A: DocTipo 80 (CUIT) + Cond IVA válida (ej. 1).");
  return;
}


          if (cbteTipo === 6) {
  setHint("Factura B: recomendado CF (DocTipo 99, DocNro 0, Cond IVA 5).");
  if (Number(inpTipo.value || 0) === 99) inpNro.value = "0";
  else if (String(inpNro.value || "").trim() === "0") inpNro.value = "";
  return;
}


          setHint("");
        }

        function toggleResolveBtn() {
          const { doc_tipo, doc_nro_str, doc_nro } = currentDoc();
          const show =
            doc_tipo === 80 && /^\d{11}$/.test(doc_nro_str) && doc_nro > 0;
          if (btnResolve) btnResolve.style.display = show ? "inline-flex" : "none";
        }
        let lookupSeq = 0;

        async function buscarReceptorCache() {
          const { doc_tipo, doc_nro_str, doc_nro } = currentDoc();
          const key = `${doc_tipo}:${doc_nro_str}`;
          const seq = ++lookupSeq;

           setSt("");
           toggleResolveBtn();

          if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) return;
          if (!/^\d+$/.test(doc_nro_str)) return;
          if (!Number.isFinite(doc_nro) || doc_nro <= 0) {
            setHint("");
            return;
          }
          if (doc_tipo === 99 && doc_nro === 0) {
            setHint("");
            return;
          }

          setHint("Buscando receptor en cache…");
           inpNom.value = "";
          inpDom.value = "";
          try {
            const data = await fetchJSON(
              `/arca/receptor?doc_tipo=${doc_tipo}&doc_nro=${doc_nro}`
            );
            const now = currentDoc();
if (seq !== lookupSeq) return;
if (`${now.doc_tipo}:${now.doc_nro_str}` !== key) return;


            const nombre = (data.razon_social || data.nombre || "").trim();
            if (nombre) inpNom.value = nombre;

            const dom = (data.domicilio || "").trim();
            if (dom) inpDom.value = dom;

            const cond = Number(data.cond_iva_id || 0);
            if (cond > 0) {
              if (![...selCond.options].some((o) => Number(o.value) === cond)) {
                const opt = document.createElement("option");
                opt.value = String(cond);
                opt.textContent = `${cond} - (cache)`;
                selCond.appendChild(opt);
              }

              if (Number(inpCbte.value) === 6 && cond === 1) {
                inpCbte.value = "1";
                applyRules();
                await loadCondIvaOptions();
              }

              selCond.value = String(cond);
            }

            setHint("Receptor cargado desde cache.");
          } catch {
            setHint("Sin cache (podés completar a mano o guardar en cache).");
          }
         
          syncDraftFromUI();
        }

        async function guardarCache() {
          const { doc_tipo, doc_nro_str, doc_nro } = currentDoc();
          setSt("");

          if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) {
            setSt("DocTipo inválido");
            return;
          }
          if (!/^\d+$/.test(doc_nro_str)) {
            setSt("DocNro inválido");
            return;
          }
          if (doc_tipo === 99) {
            setSt("No se cachea CF");
            return;
          }
          if (!Number.isFinite(doc_nro) || doc_nro <= 0) {
            setSt("DocNro debe ser > 0");
            return;
          }
          if (doc_tipo === 80 && doc_nro_str.length !== 11) {
            setSt("CUIT debe tener 11 dígitos");
            return;
          }

          const payload = {
            doc_tipo,
            doc_nro,
            nombre: (inpNom.value || "").trim() || null,
            razon_social: (inpNom.value || "").trim() || null,
            cond_iva_id: Number(selCond.value || 0) || null,
            domicilio: (inpDom.value || "").trim() || null,
          };

          setSt("Guardando…");
          try {
            await fetchJSON("/arca/receptor/cache", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            setSt("Guardado.");
          } catch (e) {
            setSt(e.message || "Error guardando");
          }
        

          syncDraftFromUI();
        }

       async function resolverPadron() {
  const { doc_tipo, doc_nro_str, doc_nro } = currentDoc();
  setSt("");

  if (!(doc_tipo === 80 && /^\d{11}$/.test(doc_nro_str) && doc_nro > 0)) return;

  const key = `${doc_tipo}:${doc_nro_str}`;
  const seq = ++lookupSeq;

  setSt("Resolviendo en padrón…");

  // opcional: limpiar mientras carga
  inpNom.value = "";
  inpDom.value = "";

  try {
    const data = await fetchJSON(
      `/arca/receptor?doc_tipo=80&doc_nro=${doc_nro}&resolve=1&refresh=1`
    );

    // anti-race: si cambió el CUIT mientras esperábamos, ignorar
    const now = currentDoc();
    if (seq !== lookupSeq) return;
    if (`${now.doc_tipo}:${now.doc_nro_str}` !== key) return;

    const nombre = (data.razon_social || data.nombre || "").trim();
    if (nombre) inpNom.value = nombre;

    const dom = (data.domicilio || "").trim();
    if (dom) inpDom.value = dom;

    const cond = Number(data.cond_iva_id || 0);
    if (cond > 0) {
      if (![...selCond.options].some((o) => Number(o.value) === cond)) {
        const opt = document.createElement("option");
        opt.value = String(cond);
        opt.textContent = `${cond} - (padrón)`;
        selCond.appendChild(opt);
      }
      selCond.value = String(cond);
    }

    setSt("Resuelto.");
  } catch (e) {
    setSt(e.message || "No se pudo resolver");
  }

  syncDraftFromUI();
}


        let t = null;
        function scheduleBuscar() {
          clearTimeout(t);
          t = setTimeout(buscarReceptorCache, 350);
        }

        if (btnCache) btnCache.addEventListener("click", guardarCache);
        if (btnResolve) btnResolve.addEventListener("click", resolverPadron);

        // Restaurar valores
        setVal(inpCbte, draft.cbte_tipo);
        setVal(inpTipo, draft.doc_tipo);
        setVal(inpNro, draft.doc_nro);
        setVal(inpNom, draft.receptor_nombre);
        setVal(inpDom, draft.domicilio);

        // Guardar borrador en cada cambio
        const hook = (el) => {
          if (!el) return;
          el.addEventListener("input", syncDraftFromUI);
          el.addEventListener("change", syncDraftFromUI);
        };
        [inpCbte, inpTipo, inpNro, selCond, inpNom, inpDom].forEach(hook);

        on(inpCbte, async () => {
          applyRules();
          await loadCondIvaOptions();
          scheduleBuscar();
        });
on(inpTipo, () => {
  toggleResolveBtn();

  if (Number(inpTipo.value || 0) !== 99 && String(inpNro.value || "").trim() === "0") {
    inpNro.value = "";
    syncDraftFromUI();
  }

  scheduleBuscar();
});

        on(inpNro, () => {
          toggleResolveBtn();
          scheduleBuscar();
        });

        (async () => {
          applyRules();
          await loadCondIvaOptions();
          scheduleBuscar();
        })();
      },

      preConfirm: () => {
        const cbte_tipo = Number(document.getElementById("sw_cbte").value);
        const doc_tipo = Number(document.getElementById("sw_doc_tipo").value);
        const doc_nro = Number(document.getElementById("sw_doc_nro").value);
        const receptor_cond_iva_id = Number(
          document.getElementById("sw_cond").value
        );
        const receptor_nombre =
          (document.getElementById("sw_nombre").value || "").trim() || null;

        if (!Number.isFinite(cbte_tipo) || cbte_tipo <= 0)
          return Swal.showValidationMessage("cbte_tipo inválido");
        if (!Number.isFinite(doc_tipo) || doc_tipo <= 0)
          return Swal.showValidationMessage("doc_tipo inválido");
        if (!Number.isFinite(doc_nro) || doc_nro < 0)
          return Swal.showValidationMessage("doc_nro inválido");
        if (!Number.isFinite(receptor_cond_iva_id) || receptor_cond_iva_id <= 0)
          return Swal.showValidationMessage("condición IVA inválida");

        if (cbte_tipo === 1) {
          if (doc_tipo !== 80)
            return Swal.showValidationMessage(
              "Factura A requiere DocTipo 80 (CUIT)"
            );
          if (String(doc_nro).length !== 11)
            return Swal.showValidationMessage("CUIT inválido (11 dígitos)");
        }

        if (cbte_tipo === 6) {
          if (receptor_cond_iva_id === 1)
            return Swal.showValidationMessage(
              "Condición IVA 1 (RI) no es válida para Factura B"
            );
          if (doc_tipo === 99 && doc_nro !== 0)
            return Swal.showValidationMessage(
              "Consumidor Final: DocNro debe ser 0"
            );
        }

        return {
          cbte_tipo,
          doc_tipo,
          doc_nro,
          receptor_cond_iva_id,
          receptor_nombre,
        };
      },
    });

    if (!isConfirmed) return;

    $("btnEmitir").disabled = true;

    try {
      const resp = await fetchJSON(`/arca/emitir-desde-factura/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });

      const extraObs =
        resp.obs_code || resp.obs_msg
          ? `<div style="margin-top:10px;font-size:12px;color:#667085">${resp.obs_code || ""} ${
              resp.obs_msg || ""
            }</div>`
          : "";

      await Swal.fire({
        icon: resp.estado === "EMITIDO" ? "success" : "error",
        title: resp.estado,
        html:
          resp.estado === "EMITIDO"
            ? `CAE <b>${resp.cae}</b><br/>Vto <b>${resp.cae_vto}</b><br/>Cbte nro <b>${resp.cbte_nro}</b>${extraObs}`
            : `${resp.obs_code || ""} ${resp.obs_msg || ""}`,
      });

      await loadList();
      await onSelect(id);
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Error",
        text: e.message || "Error emitiendo",
      });
    } finally {
      $("btnEmitir").disabled = false;
    }
  }

  // Eventos
  $("arcaReload").addEventListener("click", () => loadList());
  $("arcaPrev").addEventListener("click", () => {
    state.offset = Math.max(state.offset - state.limit, 0);
    loadList();
  });
  $("arcaNext").addEventListener("click", () => {
    state.offset = state.offset + state.limit;
    loadList();
  });

  $("arcaSearch").addEventListener("input", (e) => {
    state.search = (e.target.value || "").trim();
    renderList();
    renderPager();
  });

  $("btnEmitir").addEventListener("click", emitirSeleccionada);
  if (btnAuditarWsfe) btnAuditarWsfe.addEventListener("click", auditarWsfeActual);

  // Init
  loadList().catch((err) => {
    $("arcaTbody").innerHTML = `<tr><td colspan="6" class="muted">${err.message}</td></tr>`;
  });
})();
(function reportesInit(){
  const $ = (s) => document.querySelector(s);

  function todayISO(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const repDesde = $("#repDesde");
  const repHasta = $("#repHasta");
  const repTipo = $("#repTipo");
  const repEstado = $("#repEstado");
  const cierreFecha = $("#cierreFecha");

  if (repDesde && repHasta && cierreFecha) {
    repDesde.value = todayISO();
    repHasta.value = todayISO();
    cierreFecha.value = todayISO();
  }

  async function getJSON(url){
    const r = await fetch(url, { headers: { "Accept":"application/json" } });
    const j = await r.json().catch(()=>null);
    if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
    return j;
  }

  function money(n){
    const x = Number(n || 0);
    return x.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderResumen(items){
    const wrap = $("#tblResumen");
    if (!wrap) return;

    if (!items?.length) {
      wrap.innerHTML = `<div class="hint">Sin datos en el rango.</div>`;
      return;
    }

    const rows = items.map(r => `
      <div class="tr">
        <div>${r.fecha}</div>
        <div>$ ${money(r.total_facturas)}</div>
        <div>$ ${money(r.total_nc)}</div>
        <div><b>$ ${money(r.total_neto_ventas)}</b></div>
        <div><button class="btn secondary" data-ver-dia="${r.fecha}">Ver día</button></div>
      </div>
    `).join("");

   wrap.innerHTML = `
  <div class="gtable" style="--cols: 140px 1fr 1fr 1fr 140px">
    <div class="thead">...</div>
    ${rows}
  </div>
`;


    wrap.querySelectorAll("[data-ver-dia]").forEach(btn=>{
      btn.addEventListener("click", ()=> {
        const f = btn.getAttribute("data-ver-dia");
        repDesde.value = f;
        repHasta.value = f;
        listarComprobantes();
      });
    });
  }

  function tipoLabel(t){
    const n = Number(t);
    if (n===1) return "Factura A";
    if (n===6) return "Factura B";
    if (n===3) return "NC A";
    if (n===8) return "NC B";
    return `Tipo ${t}`;
  }

  function renderComprobantes(items){
    const wrap = $("#tblComprobantes");
    if (!wrap) return;

    if (!items?.length) {
      wrap.innerHTML = `<div class="hint">Sin comprobantes para el filtro.</div>`;
      return;
    }

    const rows = items.map(it => `
      <div class="tr">
        <div>#${it.id}</div>
        <div>${tipoLabel(it.cbte_tipo)}</div>
        <div>${it.pto_vta}-${it.cbte_nro}</div>
        <div>${String(it.cbte_fch).slice(0,4)}-${String(it.cbte_fch).slice(4,6)}-${String(it.cbte_fch).slice(6,8)}</div>
        <div>${it.estado}</div>
        <div>$ ${money(it.imp_total)}</div>
        <div class="actions" style="justify-content:flex-end;">
          <a class="btn secondary" href="/arca/pdf/${it.id}" target="_blank">PDF</a>
          <a class="btn secondary" href="/arca/wsfe/consultar/${it.id}?audit=1" target="_blank">Auditar</a>
          ${[1,6].includes(Number(it.cbte_tipo)) ? `<button class="btn danger" data-nc="${it.id}">NC</button>` : ``}
        </div>
      </div>
    `).join("");

  wrap.innerHTML = `
  <div class="gtable" style="--cols: 90px 160px 160px 140px 120px 140px minmax(240px, 1fr)">
    <div class="thead">...</div>
    ${rows}
  </div>
`;



    wrap.querySelectorAll("[data-nc]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const arcaId = btn.getAttribute("data-nc");
        const ok = await Swal.fire({
          icon: "warning",
          title: "Emitir Nota de Crédito",
          text: `Se emitirá una NC asociada al comprobante ARCA #${arcaId}.`,
          showCancelButton: true,
          confirmButtonText: "Emitir NC",
          cancelButtonText: "Cancelar"
        });
        if (!ok.isConfirmed) return;

        try{
          const r = await fetch(`/arca/emitir-nc/${arcaId}`, {
            method:"POST",
            headers: { "Content-Type":"application/json", "Accept":"application/json" },
            body: "{}"
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
          await Swal.fire({ icon:"success", title:"NC emitida", text:`ARCA #${j.arca_id} - CAE ${j.cae}` });
          listarComprobantes();
        }catch(e){
          Swal.fire({ icon:"error", title:"Error", text: String(e.message || e) });
        }
      });
    });
  }

  async function verResumen(){
    try{
      const d = repDesde.value;
      const h = repHasta.value;
      const j = await getJSON(`/arca/reportes/resumen?desde=${encodeURIComponent(d)}&hasta=${encodeURIComponent(h)}`);
      renderResumen(j.resumen);
    }catch(e){
      Swal.fire({ icon:"error", title:"Error", text: String(e.message || e) });
    }
  }

  async function listarComprobantes(){
    try{
      const d = repDesde.value;
      const h = repHasta.value;
      const tipo = repTipo.value;
      const estado = repEstado.value;

      const qs = new URLSearchParams({ desde:d, hasta:h });
      if (tipo) qs.set("tipo", tipo);
      if (estado) qs.set("estado", estado);

      const j = await getJSON(`/arca/reportes/comprobantes?${qs.toString()}`);
      renderComprobantes(j.items);
    }catch(e){
      Swal.fire({ icon:"error", title:"Error", text: String(e.message || e) });
    }
  }

  async function crearCierre(){
    try{
      const f = cierreFecha.value;
      const ok = await Swal.fire({
        icon:"question",
        title:"Crear cierre diario",
        text:`Se guardará el snapshot del día ${f}.`,
        showCancelButton:true,
        confirmButtonText:"Crear cierre",
        cancelButtonText:"Cancelar"
      });
      if (!ok.isConfirmed) return;

      const r = await fetch("/arca/cierres-diarios", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Accept":"application/json" },
        body: JSON.stringify({ fecha: f })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);

      const c = j.cierre;
      await Swal.fire({
        icon:"success",
        title: j.existente ? "Cierre ya existía" : "Cierre creado",
        html: `
          <div style="text-align:left">
            <div><b>Fecha:</b> ${c.fecha}</div>
            <div><b>Facturado:</b> $ ${money(c.total_facturado)}</div>
            <div><b>NC:</b> $ ${money(c.total_nc)}</div>
            <div><b>Neto ventas:</b> $ ${money(c.total_neto_ventas)}</div>
            <div><b>Comprobantes:</b> ${c.cant_comprobantes}</div>
          </div>`
      });

      verResumen();
    }catch(e){
      Swal.fire({ icon:"error", title:"Error", text: String(e.message || e) });
    }
  }

  $("#btnRepResumen")?.addEventListener("click", verResumen);
  $("#btnRepListar")?.addEventListener("click", listarComprobantes);
  $("#btnCierre")?.addEventListener("click", crearCierre);
})();
