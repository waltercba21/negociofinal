// public/js/arca/index.js
(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    limit: 50,
    offset: 0,
    rows: [],
    selectedId: null,
    search: "",
  };

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
      <tr class="row" data-id="${r.id}">
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
            const obsLine = r.obs_code ? `${r.obs_code} — ${r.obs_msg || ""}` : "";
            return `
        <div class="histItem">
          <div class="histTop">
            <div>${badge(r.estado)} <span class="muted">Cbte ${r.cbte_tipo}-${r.cbte_nro} · ${r.cbte_fch}</span></div>
            <div class="histMeta">${r.created_at || ""}</div>
          </div>
          ${caeLine ? `<div class="histObs">${caeLine}</div>` : ""}
          ${obsLine ? `<div class="histObs">${obsLine}</div>` : ""}
        </div>
      `;
          })
          .join("")
      : `<div class="muted">Sin intentos ARCA.</div>`;

    const pdfBtn = document.getElementById("btnPDF");
    if (pdfBtn) {
      if (rows.length && rows[0].estado === "EMITIDO") {
        pdfBtn.style.display = "inline-flex";
        pdfBtn.href = `/arca/pdf/${rows[0].id}`; // arca_id más reciente
      } else {
        pdfBtn.style.display = "none";
        pdfBtn.href = "#";
      }
    }
  }

  async function emitirSeleccionada() {
    const id = state.selectedId;
    if (!id) return;

    const { isConfirmed, value } = await Swal.fire({
      title: `Emitir ARCA — Factura #${id}`,
      confirmButtonText: "Emitir",
      showCancelButton: true,
      cancelButtonText: "Cancelar",
      focusConfirm: false,

      html: `
  <div style="display:grid;gap:10px;text-align:left">
    <label>Cbte tipo (6=B, 1=A)</label>
    <input id="sw_cbte" class="swal2-input" value="6" />

    <label>Doc tipo (99=CF, 80=CUIT, 96=DNI)</label>
    <input id="sw_doc_tipo" class="swal2-input" value="99" />

    <label>Doc nro (CF=0)</label>
    <input id="sw_doc_nro" class="swal2-input" value="0" />

    <label>Cond IVA receptor</label>
    <select id="sw_cond" class="swal2-input"></select>

    <label>Receptor (nombre / razón social)</label>
    <input id="sw_nombre" class="swal2-input" placeholder="Opcional / autocompleta si está en cache" />

    <div id="sw_hint" style="font-size:12px;color:#667085"></div>
  </div>
`,

      didOpen: () => {
        const hint = document.getElementById("sw_hint");
        const inpCbte = document.getElementById("sw_cbte");
        const inpTipo = document.getElementById("sw_doc_tipo");
        const inpNro = document.getElementById("sw_doc_nro");
        const selCond = document.getElementById("sw_cond");
        const inpNom = document.getElementById("sw_nombre");

        const setHint = (t) => {
          if (hint) hint.textContent = t || "";
        };

        const on = (el, fn) => {
          if (!el) return;
          el.addEventListener("input", fn);
          el.addEventListener("change", fn);
        };

        async function loadCondIvaOptions() {
          const cbteTipo = Number(inpCbte.value || 0);
          selCond.innerHTML = `<option value="">Cargando...</option>`;

          const r = await fetch(`/arca/params/cond-iva-receptor?cbte_tipo=${cbteTipo}`);
          const txt = await r.text();
          let data = {};
          try { data = txt ? JSON.parse(txt) : {}; } catch { data = {}; }

          const rows = Array.isArray(data.rows) ? data.rows.slice() : [];

          // Para B: agregar Consumidor Final (5) si no viene
          if (cbteTipo === 6 && !rows.some((x) => Number(x.id) === 5)) {
            rows.unshift({ id: 5, desc: "Consumidor Final", cmp_clase: "B/C" });
          }

          selCond.innerHTML = rows
            .map((o) => `<option value="${o.id}">${o.id} - ${o.desc}</option>`)
            .join("");

          if (cbteTipo === 6 && rows.some((o) => Number(o.id) === 5)) selCond.value = "5";
          else if (cbteTipo === 1 && rows.some((o) => Number(o.id) === 1)) selCond.value = "1";
          else selCond.value = rows[0]?.id ? String(rows[0].id) : "";
        }

        function applyRules() {
          const cbteTipo = Number(inpCbte.value || 0);

          if (cbteTipo === 1) {
            inpTipo.value = "80";
            setHint("Factura A: DocTipo 80 (CUIT) + Cond IVA válida (ej. 1).");
            return;
          }

          if (cbteTipo === 6) {
            setHint("Factura B: recomendado CF (DocTipo 99, DocNro 0, Cond IVA 5).");
            if (Number(inpTipo.value || 0) === 99) inpNro.value = "0";
            return;
          }

          setHint("");
        }

        let t = null;

        async function buscarReceptorCache() {
          const doc_tipo = Number(inpTipo.value || 0);
          const doc_nro = Number(String(inpNro.value || "").trim() || 0);

          // No buscar CF o inválidos
          if (!Number.isFinite(doc_tipo) || doc_tipo <= 0) return;
          if (!Number.isFinite(doc_nro) || doc_nro <= 0) {
            setHint("");
            return;
          }
          if (doc_tipo === 99 && doc_nro === 0) {
            setHint("");
            return;
          }

          setHint("Buscando receptor en cache…");

          try {
            const rr = await fetch(`/arca/receptor?doc_tipo=${doc_tipo}&doc_nro=${doc_nro}`);
            const ttxt = await rr.text();
            let data = {};
            try { data = ttxt ? JSON.parse(ttxt) : {}; } catch { data = {}; }

            if (!rr.ok) throw new Error("no-cache");

            const nombre = (data.razon_social || data.nombre || "").trim();
            if (nombre) inpNom.value = nombre;

            const cond = Number(data.cond_iva_id || 0);
            if (cond > 0) {
              if (![...selCond.options].some((o) => Number(o.value) === cond)) {
                const opt = document.createElement("option");
                opt.value = String(cond);
                opt.textContent = `${cond} - (cache)`;
                selCond.appendChild(opt);
              }

              // Si estamos en B y cache trae 1 => pasar a A
              if (Number(inpCbte.value) === 6 && cond === 1) {
                inpCbte.value = "1";
                applyRules();
                await loadCondIvaOptions();
              }

              selCond.value = String(cond);
            }

            setHint("Receptor cargado desde cache.");
          } catch {
            setHint("Sin cache (podés completar a mano).");
          }
        }

        function scheduleBuscar() {
          clearTimeout(t);
          t = setTimeout(buscarReceptorCache, 350);
        }

        on(inpCbte, async () => {
          applyRules();
          await loadCondIvaOptions();
        });

        on(inpTipo, scheduleBuscar);
        on(inpNro, scheduleBuscar);

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
        const receptor_cond_iva_id = Number(document.getElementById("sw_cond").value);
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

        // Reglas mínimas para evitar errores comunes
        if (cbte_tipo === 1) {
          if (doc_tipo !== 80)
            return Swal.showValidationMessage("Factura A requiere DocTipo 80 (CUIT)");
          if (String(doc_nro).length !== 11)
            return Swal.showValidationMessage("CUIT inválido (11 dígitos)");
        }

        if (cbte_tipo === 6) {
          // No permitir RI (1) en B
          if (receptor_cond_iva_id === 1)
            return Swal.showValidationMessage("Condición IVA 1 (RI) no es válida para Factura B");
          // Si es CF, debe ser 99/0
          if (doc_tipo === 99 && doc_nro !== 0)
            return Swal.showValidationMessage("Consumidor Final: DocNro debe ser 0");
        }

        return { cbte_tipo, doc_tipo, doc_nro, receptor_cond_iva_id, receptor_nombre };
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
          ? `<div style="margin-top:10px;font-size:12px;color:#667085">${resp.obs_code || ""} ${resp.obs_msg || ""}</div>`
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

  // Init
  loadList().catch((err) => {
    $("arcaTbody").innerHTML = `<tr><td colspan="6" class="muted">${err.message}</td></tr>`;
  });
})();
