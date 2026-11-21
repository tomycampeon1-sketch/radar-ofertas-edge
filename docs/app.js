// Página del radar: lee la base compartida (data/db.json) y arma el comparador.
(function () {
  const $ = (id) => document.getElementById(id);
  const money = (n) => (n == null || !isFinite(n) ? "—" : "$" + Math.round(n).toLocaleString("es-AR"));
  const pct = (x) => (x == null || !isFinite(x) ? "—" : (x > 0 ? "+" : "") + (x * 100).toFixed(1).replace(".", ",") + "%");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safe = (u) => (/^https:\/\//.test(u || "") ? u : null);
  const fecha = (iso) => (iso ? new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : "");
  const hace = (iso) => {
    if (!iso) return "nunca";
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 60) return `hace ${Math.max(1, m)} min`;
    const h = Math.round(m / 60);
    return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
  };
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
  };

  let db = null;

  // ---------- cálculos ----------
  // Todas las opciones de un producto: lo leído por el radar y las referencias de la investigación.
  function opciones(p) {
    const auto = (p.ofertas || []).map((o) => ({
      tienda: o.tienda, url: o.url, contado: o.contado, lista: o.lista,
      cuotas: o.cuotas, fuente: o.viejo ? "viejo" : "auto", fecha: o.fecha, titulo: o.titulo, via: o.via
    }));
    const ref = (p.referencia || []).map((r) => ({
      tienda: r.tienda, url: r.fuente, contado: r.contado, lista: null,
      cuotas: r.cuotas ? { n: r.cuotas, monto: r.cuotaMonto, total: r.total, sinInteres: r.sinInteres } : null,
      fuente: "nota", fecha: r.fecha, aviso: r.aviso, particular: !!r.particular, totalLista: !r.cuotas ? r.total : null
    }));
    return { auto, ref, todas: [...auto, ...ref] };
  }

  // Mejor contado y mejor plan sin interés. Si el radar tiene datos al día se usan esos; si no, la referencia.
  function mejores(p) {
    const { auto, ref } = opciones(p);
    const pick = (list) => {
      const c = list.filter((o) => o.contado && !o.particular && o.tienda !== "Estimado").sort((a, b) => a.contado - b.contado)[0]
        || list.filter((o) => o.contado && !o.particular).sort((a, b) => a.contado - b.contado)[0] || null;
      const q = list.filter((o) => o.cuotas && o.cuotas.sinInteres && o.cuotas.total).sort((a, b) => a.cuotas.total - b.cuotas.total || b.cuotas.n - a.cuotas.n)[0] || null;
      return { c, q };
    };
    const a = pick(auto), r = pick(ref);
    return { contado: a.c || r.c, cuotas: a.q || r.q };
  }

  // Valor de hoy de n cuotas de "monto", descontando inflación mensual i
  function valorActual(monto, n, i) {
    if (!i) return monto * n;
    return monto * (1 - Math.pow(1 + i, -n)) / i;
  }

  const inflacion = () => (Number($("inflacion").value) || 0) / 100;
  const tag = (f) => `<span class="tag ${f}">${f === "auto" ? "al día" : f}</span>`;

  // ---------- comparador GTA 6 ----------
  function cardConsola(p) {
    const m = mejores(p);
    const c = m.contado, q = m.cuotas;
    let html = `<div class="card"><h3>${esc(p.nombre)}</h3>${p.nota ? `<p class="nota">${esc(p.nota)}</p>` : ""}<dl class="kv">`;
    html += `<dt>Mejor contado</dt><dd>${c ? `${linkOr(money(c.contado), c.url)}<span class="sub">${esc(c.tienda)} ${tag(c.fuente)} ${fecha(c.fecha)}</span>` : "—"}</dd>`;
    html += `<dt>Mejor en cuotas sin interés</dt><dd>${q ? `${linkOr(`${q.cuotas.n} × ${money(q.cuotas.monto)}`, q.url)}<span class="sub">total ${money(q.cuotas.total)} · ${esc(q.tienda)} ${tag(q.fuente)}</span>` : "—"}</dd>`;
    let verdict = "";
    if (c && q) {
      const recargo = q.cuotas.total / c.contado - 1;
      const va = valorActual(q.cuotas.monto, q.cuotas.n, inflacion());
      html += `<dt>Recargo por pagar en cuotas</dt><dd>${pct(recargo)}<span class="sub">${c.tienda === q.tienda ? "en la misma tienda" : `contra el contado de ${esc(c.tienda)}`}</span></dd>`;
      html += `<dt>Valor de hoy de esas cuotas</dt><dd>${money(va)}<span class="sub">con ${($("inflacion").value || 0)}% de inflación mensual</span></dd>`;
      verdict = va < c.contado
        ? `<div class="verdict good">Conviene en cuotas: con la inflación, pagar ${q.cuotas.n} cuotas equivale a ${money(va)} de hoy, menos que ${money(c.contado)} de contado.</div>`
        : `<div class="verdict warn">Conviene de contado: ahorrás ${money(q.cuotas.total - c.contado)} y, aun descontando la inflación, las cuotas valen ${money(va - c.contado)} más.</div>`;
    }
    html += `</dl>${verdict}${linksTiendas(p)}</div>`;
    return { html, contado: c && c.contado, nombre: p.nombre };
  }

  function linkOr(text, url) {
    const u = safe(url);
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${text}</a>` : text;
  }

  function linksTiendas(p) {
    const tiendas = db.tiendas || {};
    const links = Object.entries(p.enlaces || {}).map(([id, u]) => `<a class="pill" href="${esc(u)}" target="_blank" rel="noopener">${esc((tiendas[id] || {}).nombre || id)}</a>`);
    return links.length ? `<div class="links">${links.join("")}</div>` : "";
  }

  function renderGta() {
    const consolas = db.productos.filter((p) => p.grupo === "consola").map(cardConsola);
    $("consolas").innerHTML = consolas.map((c) => c.html).join("");

    // PC: suma de piezas
    const barato = $("cpuBarato").checked;
    const piezas = db.productos.filter((p) => p.grupo === "pc" && (barato ? p.pieza !== "procesador" : p.pieza !== "procesador-barato"));
    let total = 0, totalCuotas = 0, faltan = 0, estimadas = 0;
    const filas = piezas.map((p) => {
      const m = mejores(p);
      const c = m.contado;
      if (c) total += c.contado; else faltan++;
      if (c && c.tienda === "Estimado") estimadas++;
      const cuotaTotal = m.cuotas ? m.cuotas.cuotas.total : c ? c.contado : 0;
      totalCuotas += cuotaTotal;
      return `<tr><td>${esc(p.nombre)}</td><td class="r">${c ? linkOr(money(c.contado), c.url) : "—"}</td><td>${c ? `${esc(c.tienda)} ${tag(c.fuente)}` : ""}</td>
        <td class="r">${m.cuotas ? `${m.cuotas.cuotas.n} × ${money(m.cuotas.cuotas.monto)}` : "—"}</td></tr>`;
    });
    filas.push(`<tr><th>Total</th><th class="r">${money(total)}</th><th>${estimadas ? `${estimadas} pieza(s) estimadas` : ""}</th><th class="r">${totalCuotas ? `≈ 12 × ${money(totalCuotas / 12)}` : ""}</th></tr>`);
    $("pc").innerHTML = `<div class="tablewrap"><table><thead><tr><th>Pieza</th><th class="r">Contado</th><th>Dónde</th><th class="r">Cuotas sin interés</th></tr></thead><tbody>${filas.join("")}</tbody></table></div>
      <p class="muted small">No incluye monitor 1440p ni Windows. GTA 6 todavía no tiene versión de PC ni requisitos oficiales: este armado es una estimación basada en cómo corre en PS5.</p>`;

    // Veredicto
    const ps5 = consolas.find((c) => /PS5 Slim Digital/i.test(c.nombre));
    const masBarata = consolas.filter((c) => c.contado).sort((a, b) => a.contado - b.contado)[0];
    const veces = ps5 && ps5.contado ? total / ps5.contado : null;
    $("veredicto").innerHTML = `<p class="big">La forma más barata de jugar GTA 6 hoy: ${esc(ps5 ? ps5.nombre : "una consola")}${ps5 && ps5.contado ? ` desde ${money(ps5.contado)}` : ""}.</p>
      <p>GTA 6 salió el 19/11/2026 solo para PS5 y Xbox Series. La PC para 2K sale ${money(total)}${veces ? `, ${veces.toFixed(1).replace(".", ",")} veces una PS5` : ""}, y todavía no hay versión de PC anunciada.</p>
      ${masBarata && ps5 && masBarata.nombre !== ps5.nombre ? `<p class="muted small">La más barata de todas es ${esc(masBarata.nombre)} (${money(masBarata.contado)}), pero con 512 GB queda justa para un juego de 212 GB.</p>` : ""}`;
  }

  // ---------- ofertas nuevas ----------
  function renderAlertas() {
    const list = db.alertas || [];
    const visto = LS.get("radar-visto", null);
    const nuevas = visto ? list.filter((a) => a.fecha > visto).length : list.length;
    $("badge").hidden = !nuevas;
    $("badge").textContent = nuevas;
    $("alertas").innerHTML = list.length
      ? list.map((a) => `<a class="alert" href="${esc(safe(a.url) || "#")}" target="_blank" rel="noopener"><div><div class="t">${esc(a.titulo)}</div><div>${esc(a.mensaje)}</div><div class="muted small">${hace(a.fecha)}</div></div></a>`).join("")
      : `<div class="empty">Todavía no se detectaron ofertas nuevas. El radar compara cada lectura con la anterior, así que las primeras aparecen después de un par de actualizaciones.</div>`;
  }

  // ---------- todos los precios ----------
  function spark(hist) {
    if (!hist || hist.length < 2) return "";
    const vals = hist.map((h) => h[1]);
    const min = Math.min(...vals), max = Math.max(...vals), w = 120, h = 28;
    const d = vals.map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / (max - min || 1)) * (h - 6)).toFixed(1)}`).join("");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-label="Historial: mínimo ${money(min)}, máximo ${money(max)}"><path d="${d}"/></svg>`;
  }

  function renderProductos() {
    const f = ($("filtro").value || "").toLowerCase();
    const g = $("grupo").value;
    const abiertos = LS.get("radar-abiertos", []);
    const list = db.productos.filter((p) => (!g || p.grupo === g) && (!f || p.nombre.toLowerCase().includes(f)));
    $("productos").innerHTML = list.map((p) => {
      const m = mejores(p);
      const { todas } = opciones(p);
      const filas = todas
        .sort((a, b) => (a.contado || a.cuotas?.total || 1e12) - (b.contado || b.cuotas?.total || 1e12))
        .map((o) => {
          const rec = o.contado && o.cuotas && o.cuotas.total ? o.cuotas.total / o.contado - 1 : null;
          return `<tr><td>${linkOr(esc(o.tienda), o.url)}${o.titulo ? `<div class="muted small">${esc(o.titulo.slice(0, 70))}</div>` : ""}${o.aviso ? `<div class="muted small">${esc(o.aviso)}</div>` : ""}</td>
            <td class="r">${money(o.contado)}${o.lista ? `<div class="muted small"><s>${money(o.lista)}</s></div>` : ""}</td>
            <td class="r">${o.cuotas ? `${o.cuotas.n} × ${money(o.cuotas.monto)}<div class="muted small">${o.cuotas.sinInteres ? "sin interés" : "con interés"} · total ${money(o.cuotas.total)}</div>` : o.totalLista ? `<span class="muted small">lista ${money(o.totalLista)}</span>` : "—"}</td>
            <td class="r">${pct(rec)}</td><td>${tag(o.fuente)} <span class="muted small">${fecha(o.fecha)}</span></td></tr>`;
        });
      return `<details class="prod" data-id="${esc(p.id)}" ${abiertos.includes(p.id) ? "open" : ""}><summary><span class="name">${esc(p.nombre)}</span>${spark(p.historia)}
          <span class="price">${m.contado ? money(m.contado.contado) : "—"}</span>${m.contado ? tag(m.contado.fuente) : ""}</summary>
        <div class="body"><div class="tablewrap"><table><thead><tr><th>Tienda</th><th class="r">Contado</th><th class="r">Cuotas</th><th class="r">Recargo</th><th>Dato</th></tr></thead><tbody>${filas.join("") || `<tr><td colspan="5" class="muted">Sin precios todavía.</td></tr>`}</tbody></table></div>
        ${linksTiendas(p)}</div></details>`;
    }).join("") || `<div class="empty">No hay productos con ese nombre.</div>`;
    $("productos").querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => {
      const ids = [...$("productos").querySelectorAll("details[open]")].map((x) => x.dataset.id);
      LS.set("radar-abiertos", ids);
    }));
  }

  function renderTiendas() {
    $("tiendas").innerHTML = `<div class="stores">${Object.values(db.tiendas || {}).map((t) =>
      `<div class="store"><span class="dot ${t.ok ? "ok" : t.ultimaOk ? "" : "bad"}"></span><b>${esc(t.nombre)}</b><div class="muted small">${t.ok ? `${t.ofertas} precio(s) leídos` : esc(t.error || "Todavía sin lectura")}${t.ultimaOk && !t.ok ? ` · última lectura buena ${hace(t.ultimaOk)}` : ""}</div></div>`).join("")}</div>
      <p class="muted small">Las tiendas sin lectura automática igual aparecen como botones para buscar el producto ahí.</p>`;
  }

  function renderAll() {
    const ok = Object.values(db.tiendas || {}).filter((t) => t.ok).length;
    const total = Object.keys(db.tiendas || {}).length;
    $("actualizado").textContent = `Actualizado ${hace(db.actualizado)} · ${ok} de ${total} tiendas leídas en la última revisión`;
    renderGta();
    renderAlertas();
    renderProductos();
    renderTiendas();
  }

  // ---------- pestañas y controles ----------
  function setTab(name) {
    document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.id === "tab-" + name));
    LS.set("radar-tab", name);
    if (name === "ofertas" && db && (db.alertas || []).length) {
      LS.set("radar-visto", db.alertas[0].fecha);
      setTimeout(renderAlertas, 1500);
    }
  }
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  ["inflacion", "cpuBarato"].forEach((id) => $(id).addEventListener("input", () => {
    LS.set("radar-" + id, id === "cpuBarato" ? $(id).checked : $(id).value);
    renderGta();
  }));
  ["filtro", "grupo"].forEach((id) => $(id).addEventListener("input", renderProductos));

  async function init() {
    const fromHash = location.hash.slice(1);
    try {
      const res = await fetch("data/db.json?t=" + Date.now(), { cache: "no-store" });
      db = await res.json();
    } catch (e) {
      $("actualizado").textContent = "No pude leer la base de datos (data/db.json).";
      return;
    }
    $("inflacion").value = LS.get("radar-inflacion", db.inflacionMensual ?? 2);
    $("cpuBarato").checked = !!LS.get("radar-cpuBarato", false);
    renderAll();
    setTab(["gta", "ofertas", "precios", "info"].includes(fromHash) ? fromHash : LS.get("radar-tab", "gta"));
  }
  init();
})();
