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

  // ---------- imágenes ----------
  const iconName = (p) => (window.RADAR_ICON_FOR ? window.RADAR_ICON_FOR(p) : "cpu");
  const iconSvg = (name) => (window.RADAR_ICONS || {})[name] || "";
  // Foto de la tienda si la hay; si no hay o no carga, queda la ilustración.
  function media(p, cls, extra = "") {
    const img = safe(p.imagen);
    const name = iconName(p);
    if (!img) return `<div class="${cls}">${extra}${iconSvg(name)}</div>`;
    return `<div class="${cls}" data-fallback="${esc(name)}">${extra}<img src="${esc(img)}" alt="${esc(p.nombre)}" loading="lazy" referrerpolicy="no-referrer"></div>`;
  }
  document.addEventListener("error", (e) => {
    const el = e.target;
    if (el.tagName === "IMG" && el.parentElement && el.parentElement.dataset.fallback) {
      el.outerHTML = iconSvg(el.parentElement.dataset.fallback);
    }
  }, true);

  // ---------- datos ----------
  // Todas las opciones de un producto: lo leído por el radar y las referencias de la investigación.
  function opciones(p) {
    const auto = (p.ofertas || []).map((o) => ({
      tienda: o.tienda, url: o.url, contado: o.contado, lista: o.lista,
      cuotas: o.cuotas, fuente: o.viejo ? "viejo" : "auto", fecha: o.fecha, titulo: o.titulo, via: o.via,
      medios: o.cuotas && o.cuotas.medios ? "Tarjetas: " + o.cuotas.medios.join(", ") : null
    }));
    const ref = (p.referencia || []).map((r) => ({
      tienda: r.tienda, url: r.fuente, contado: r.contado, lista: null,
      cuotas: r.cuotas ? { n: r.cuotas, monto: r.cuotaMonto, total: r.total, sinInteres: r.sinInteres } : null,
      fuente: "nota", fecha: r.fecha, aviso: r.aviso, particular: !!r.particular, medios: r.medios || null,
      totalLista: !r.cuotas ? r.total : null
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
  const valorActual = (monto, n, i) => (!i ? monto * n : monto * (1 - Math.pow(1 + i, -n)) / i);
  const inflacion = () => (Number($("inflacion").value) || 0) / 100;
  const tag = (f) => `<span class="tag ${f}">${f === "auto" ? "al día" : f === "nota" ? "precio anterior" : f}</span>`;

  // ¿Qué tipo de cuotas son? Compara contra el contado de la misma tienda o, si no hay, el mejor contado.
  function tipoCuotas(o, mejorContado) {
    if (!o || !o.cuotas) return null;
    if (!o.cuotas.sinInteres) return { cls: "con", label: "Con interés", rec: null };
    const base = o.contado || mejorContado;
    const rec = base && o.cuotas.total ? o.cuotas.total / base - 1 : null;
    if (rec != null && rec > 0.01) return { cls: "lista", label: `Sin interés, ${pct(rec)} sobre ${o.contado ? "su contado" : "el mejor contado"}`, corto: `Sin interés ${pct(rec)}`, rec };
    return { cls: "sin", label: "Sin interés real", rec };
  }
  const chip = (t, corto) => (t ? `<span class="chip ${t.cls}" title="${esc(t.label)}">${esc(corto && t.corto ? t.corto : t.label)}</span>` : "");

  function linkOr(text, url) {
    const u = safe(url);
    return u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${text}</a>` : text;
  }

  function linksTiendas(p) {
    const tiendas = db.tiendas || {};
    const links = Object.entries(p.enlaces || {}).map(([id, u]) => `<a class="pill" href="${esc(u)}" target="_blank" rel="noopener">${esc((tiendas[id] || {}).nombre || id)}</a>`);
    return links.length ? `<div class="links">${links.join("")}</div>` : "";
  }

  // Todas las formas de pagar sin interés que conocemos, de la más barata a la más cara
  function planesSinInteres(p, mejorContado) {
    const planes = opciones(p).todas.filter((o) => o.cuotas && o.cuotas.sinInteres && o.cuotas.total)
      .sort((a, b) => a.cuotas.total - b.cuotas.total || b.cuotas.n - a.cuotas.n);
    if (!planes.length) return `<div class="empty-plans">Todavía no encontramos planes sin interés para este producto. Buscalo en cada tienda con los botones de abajo.</div>`;
    return planes.map((o) => {
      const t = tipoCuotas(o, mejorContado);
      return `<div class="plan"><span class="st">${linkOr(esc(o.tienda), o.url)}</span><span class="amt">${o.cuotas.n} × ${money(o.cuotas.monto)}</span>
        <span class="meta">${chip(t)}<span>total ${money(o.cuotas.total)}</span>${o.medios ? `<span>· ${esc(o.medios)}</span>` : ""}${tag(o.fuente)}<span>${fecha(o.fecha)}</span></span></div>`;
    }).join("");
  }

  // ---------- comparador GTA 6 ----------
  function cardConsola(p, destacado) {
    const m = mejores(p);
    const c = m.contado, q = m.cuotas;
    const mejorC = c && c.contado;
    let cuotaHtml = `<div class="cuota-box"><div class="line"><span class="price-label">En cuotas sin interés</span><span class="muted small">Sin dato todavía</span></div></div>`;
    let verdict = "";
    if (q) {
      const t = tipoCuotas(q, mejorC);
      cuotaHtml = `<div class="cuota-box"><div class="price-label">Mejor plan en cuotas</div><div class="line"><span class="big">${linkOr(`${q.cuotas.n} × ${money(q.cuotas.monto)}`, q.url)}</span>${chip(t)}</div>
        <div class="sub">Total ${money(q.cuotas.total)} en ${esc(q.tienda)} ${tag(q.fuente)}${q.medios ? ` · ${esc(q.medios)}` : ""}</div></div>`;
      if (mejorC) {
        const va = valorActual(q.cuotas.monto, q.cuotas.n, inflacion());
        verdict = va < mejorC
          ? `<div class="verdict good"><b>Conviene en cuotas.</b> Con ${esc($("inflacion").value || 0)}% de inflación mensual, esas ${q.cuotas.n} cuotas equivalen a ${money(va)} de hoy, menos que ${money(mejorC)} de contado.</div>`
          : `<div class="verdict warn"><b>Conviene de contado.</b> Ahorrás ${money(q.cuotas.total - mejorC)}. Aun descontando la inflación, las cuotas valen ${money(va - mejorC)} más.</div>`;
      }
    }
    const nPlanes = opciones(p).todas.filter((o) => o.cuotas && o.cuotas.sinInteres).length;
    const ribbon = destacado ? `<span class="ribbon">Recomendada</span>` : "";
    if (!c && !q) {
      // Sin ningún precio: tarjeta corta con los botones para buscarla en cada tienda
      return `<article class="card sin-datos ${destacado ? "top-pick" : ""}">
        ${media(p, "media chica", ribbon)}
        <div class="card-body">
          <h3>${esc(p.nombre)}</h3>${p.nota ? `<p class="nota">${esc(p.nota)}</p>` : ""}
          <div class="aguardando"><b>Sin precio de tienda todavía.</b> Aparece en la próxima lectura de tu Edge. Mientras, buscala acá:</div>
          ${linksTiendas(p)}
        </div></article>`;
    }
    return `<article class="card ${destacado ? "top-pick" : ""}">
      ${media(p, "media", ribbon)}
      <div class="card-body">
        <h3>${esc(p.nombre)}</h3>${p.nota ? `<p class="nota">${esc(p.nota)}</p>` : ""}
        <div><div class="price-label">De contado</div>
          <div class="price-row"><span class="price-big">${c ? linkOr(money(c.contado), c.url) : "—"}</span>${c ? tag(c.fuente) : ""}</div>
          ${c ? `<div class="where">en ${esc(c.tienda)} · ${fecha(c.fecha)}${c.url ? ` · ${linkOr("ver publicación", c.url)}` : ""}</div>` : `<div class="where">Sin precio de contado todavía.</div>`}</div>
        ${q ? cuotaHtml : ""}
        ${verdict}
        ${nPlanes ? `<details class="opts"><summary>Opciones para pagar sin interés (${nPlanes})</summary>${planesSinInteres(p, mejorC)}</details>` : ""}
        <details class="opts"><summary>Buscar en cada tienda</summary><div style="padding-top:8px">${linksTiendas(p)}</div></details>
      </div></article>`;
  }

  function piezasPc() {
    const barato = $("cpuBarato").checked;
    return db.productos.filter((p) => p.grupo === "pc" && (barato ? p.pieza !== "procesador" : p.pieza !== "procesador-barato"));
  }

  function totalPc() {
    let total = 0, cuotasTotal = 0, estimadas = 0, faltan = 0;
    for (const p of piezasPc()) {
      if (p.yaTengo) continue; // lo que ya tenés no suma
      const m = mejores(p);
      if (!m.contado) faltan++;
      if (m.contado) total += m.contado.contado;
      if (m.contado && m.contado.tienda === "Estimado") estimadas++;
      cuotasTotal += m.cuotas ? m.cuotas.cuotas.total : m.contado ? m.contado.contado : 0;
    }
    return { total, cuotasTotal, estimadas, faltan };
  }

  function renderGta() {
    const consolas = db.productos.filter((p) => p.grupo === "consola");
    const tienePrecio = (p) => (mejores(p).contado ? 1 : 0);
    const orden = [...consolas].sort((a, b) => (b.id === "ps5-slim-digital") - (a.id === "ps5-slim-digital") || tienePrecio(b) - tienePrecio(a));
    $("consolas").innerHTML = orden.map((p) => cardConsola(p, p.id === "ps5-slim-digital")).join("");

    const parts = piezasPc().map((p) => {
      if (p.yaTengo) {
        return `<div class="part ya">${media(p, "thumb")}<div><div class="n">${esc(p.nombre)}</div>
          <div class="p"><span class="chip sin">Ya la tenés</span></div><div class="w">No suma al total</div></div></div>`;
      }
      const m = mejores(p);
      const c = m.contado, q = m.cuotas;
      const t = q ? tipoCuotas(q, c && c.contado) : null;
      return `<div class="part">${media(p, "thumb")}<div><div class="n">${esc(p.nombre)}</div>
        <div class="p">${c ? linkOr(money(c.contado), c.url) : "—"}</div>
        <div class="w">${c ? (c.tienda === "Estimado" ? `Estimado, sin link de compra` : `${esc(c.tienda)} ${tag(c.fuente)}`) : "Sin precio de tienda todavía"}</div>
        ${q ? `<div class="w"><span>${q.cuotas.n} × ${money(q.cuotas.monto)}</span>${chip(t, true)}</div>` : `<div class="w">Sin plan sin interés conocido</div>`}</div></div>`;
    });
    const { total, cuotasTotal, estimadas, faltan } = totalPc();
    $("pc").innerHTML = `<div class="pc-grid">${parts.join("")}</div>
      <div class="pc-total"><div><div class="k">Total de contado</div><div class="v">${money(total)}</div></div>
        <div><div class="k">En 12 cuotas</div><div class="v">≈ 12 × ${money(cuotasTotal / 12)}</div></div>
        <div class="muted small" style="flex:1;min-width:220px">${faltan ? `<b>Faltan precios de ${faltan} pieza(s): el total todavía no está completo.</b> ` : ""}${estimadas ? `${estimadas} pieza(s) son estimaciones. ` : ""}No suma ${piezasPc().filter((p) => p.yaTengo).map((p) => p.pieza).concat("monitor 2K").join(" ni ")} porque ya los tenés, ni Windows. GTA 6 todavía no tiene versión de PC ni requisitos oficiales: el armado es una estimación para 2K a 120 fps con DLSS 4 y generación de cuadros.</div></div>`;
    renderHero();
  }

  function renderHero() {
    const ps5 = db.productos.find((p) => p.id === "ps5-slim-digital");
    const m = ps5 ? mejores(ps5) : {};
    const { total } = totalPc();
    // La consola más barata que hoy tiene precio de tienda
    const conPrecio = db.productos.filter((p) => p.grupo === "consola").map((p) => ({ p, c: mejores(p).contado })).filter((x) => x.c && x.c.tienda !== "Estimado")
      .sort((a, b) => a.c.contado - b.c.contado);
    const barata = conPrecio[0];
    const base = m.contado ? { p: ps5, c: m.contado } : barata;
    const veces = base ? total / base.c.contado : null;
    $("titular").textContent = base
      ? `Jugar GTA 6 hoy: ${base.p.nombre} desde ${money(base.c.contado)}`
      : "La forma más barata de jugar GTA 6";
    $("bajada").textContent = `GTA 6 salió el 19/11/2026 solo para PS5 y Xbox Series. ${ps5 && !m.contado ? "La PS5 Slim Digital (la recomendada) todavía no tiene precio de tienda. " : ""}Armar la PC para 2K a 120 fps (ya tenés monitor) sale ${money(total)}${veces ? `, ${veces.toFixed(1).replace(".", ",")} veces más` : ""}, y todavía no hay versión de PC anunciada.`;
    const t = m.cuotas ? tipoCuotas(m.cuotas, m.contado && m.contado.contado) : null;
    $("stats").innerHTML = [
      { k: "Consola más barata hoy", v: barata ? money(barata.c.contado) : "—", s: barata ? `${barata.p.nombre} en ${barata.c.tienda}` : "todavía sin precio de tienda", u: barata && barata.c.url },
      { k: "PS5 Slim Digital (recomendada)", v: m.contado ? money(m.contado.contado) : "—", s: m.contado ? `de contado en ${m.contado.tienda}` : m.cuotas ? "" : "esperando precio de tienda", u: m.contado && m.contado.url },
      { k: "PS5 en cuotas sin interés", v: m.cuotas ? `${m.cuotas.cuotas.n} × ${money(m.cuotas.cuotas.monto)}` : "—", s: m.cuotas ? `total ${money(m.cuotas.cuotas.total)} en ${m.cuotas.tienda}${t && t.rec > 0.01 ? ` (${pct(t.rec)} vs contado)` : ""}` : "sin plan conocido todavía", u: m.cuotas && m.cuotas.url },
      { k: "Te falta para la PC 2K 120 fps", v: money(total), s: "ya tenés el monitor 2K", u: null, go: "pc" }
    ].map((x) => {
      const u = safe(x.u);
      const inner = `<div class="k">${esc(x.k)}</div><div class="v">${esc(x.v)}</div><div class="s">${esc(x.s)}</div>`;
      return u ? `<a class="stat link" href="${esc(u)}" target="_blank" rel="noopener">${inner}</a>` : x.go ? `<a class="stat link" href="#pc-titulo">${inner}</a>` : `<div class="stat">${inner}</div>`;
    }).join("");
    renderDestacadas();
  }

  // Últimas ofertas detectadas, arriba del comparador
  function renderDestacadas() {
    const el = $("destacadas");
    if (!el) return;
    const prod = Object.fromEntries(db.productos.map((p) => [p.id, p]));
    const list = (db.alertas || []).filter((a) => safe(a.url)).slice(0, 4);
    el.hidden = !list.length;
    el.innerHTML = list.length ? `<div class="dest-head"><h2 class="section-title">Ofertas recientes</h2><a href="#ofertas" data-go="ofertas">Ver todas</a></div>
      <div class="dest-grid">${list.map((a) => `<a class="dest" href="${esc(safe(a.url))}" target="_blank" rel="noopener">${prod[a.productoId] ? media(prod[a.productoId], "thumb") : ""}<div><div class="t">${esc(a.titulo)}</div><div class="small">${esc(a.mensaje)}</div><div class="muted small">${hace(a.fecha)}</div></div></a>`).join("")}</div>` : "";
    const go = el.querySelector("[data-go]");
    if (go) go.addEventListener("click", (e) => { e.preventDefault(); setTab("ofertas"); window.scrollTo({ top: 0 }); });
  }

  // ---------- ofertas nuevas ----------
  function renderAlertas() {
    const list = db.alertas || [];
    const visto = LS.get("radar-visto", null);
    const nuevas = visto ? list.filter((a) => a.fecha > visto).length : list.length;
    $("badge").hidden = !nuevas;
    $("badge").textContent = nuevas;
    const prod = Object.fromEntries(db.productos.map((p) => [p.id, p]));
    $("alertas").innerHTML = list.length
      ? list.map((a) => `<a class="alert" href="${esc(safe(a.url) || "#")}" target="_blank" rel="noopener">${prod[a.productoId] ? media(prod[a.productoId], "thumb") : ""}<div><div class="t">${esc(a.titulo)}</div><div>${esc(a.mensaje)}</div><div class="muted small">${hace(a.fecha)}</div></div></a>`).join("")
      : `<div class="empty">Todavía no se detectaron ofertas nuevas. El radar compara cada lectura con la anterior, así que las primeras aparecen después de un par de actualizaciones.</div>`;
  }

  // ---------- todos los precios ----------
  function spark(hist) {
    if (!hist || hist.length < 2) return "";
    const vals = hist.map((h) => h[1]);
    const min = Math.min(...vals), max = Math.max(...vals), w = 110, h = 28;
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
      const mejorC = m.contado && m.contado.contado;
      const filas = opciones(p).todas
        .sort((a, b) => (a.contado || a.cuotas?.total || 1e12) - (b.contado || b.cuotas?.total || 1e12))
        .map((o) => {
          const t = tipoCuotas(o, mejorC);
          return `<tr><td>${linkOr(esc(o.tienda), o.url)}${o.titulo ? `<div class="muted small">${esc(o.titulo.slice(0, 70))}</div>` : ""}${o.via === "tu compu" ? `<div class="muted small">leído desde tu compu</div>` : ""}${o.aviso ? `<div class="muted small">${esc(o.aviso)}</div>` : ""}</td>
            <td class="r">${money(o.contado)}${o.lista ? `<div class="muted small"><s>${money(o.lista)}</s></div>` : ""}</td>
            <td>${o.cuotas ? `<b>${o.cuotas.n} × ${money(o.cuotas.monto)}</b> <span class="muted small">total ${money(o.cuotas.total)}</span><div style="margin-top:4px">${chip(t)}</div>${o.medios ? `<div class="muted small">${esc(o.medios)}</div>` : ""}` : o.totalLista ? `<span class="muted small">precio de lista ${money(o.totalLista)}</span>` : `<span class="muted">—</span>`}</td>
            <td>${tag(o.fuente)} <span class="muted small">${fecha(o.fecha)}</span></td></tr>`;
        });
      return `<details class="prod" data-id="${esc(p.id)}" ${abiertos.includes(p.id) ? "open" : ""}><summary>${media(p, "thumb")}<span class="name">${esc(p.nombre)}</span>${spark(p.historia)}
          <span class="price">${m.contado ? money(m.contado.contado) : "—"}</span>${m.contado ? tag(m.contado.fuente) : ""}</summary>
        <div class="body"><div class="tablewrap"><table><thead><tr><th>Tienda</th><th class="r">Contado</th><th>Cuotas</th><th>Dato</th></tr></thead><tbody>${filas.join("") || `<tr><td colspan="4" class="muted">Sin precios todavía.</td></tr>`}</tbody></table></div>
        <div style="margin-top:10px">${linksTiendas(p)}</div></div></details>`;
    }).join("") || `<div class="empty">No hay productos con ese nombre.</div>`;
    $("productos").querySelectorAll("details").forEach((d) => d.addEventListener("toggle", () => {
      LS.set("radar-abiertos", [...$("productos").querySelectorAll("details[open]")].map((x) => x.dataset.id));
    }));
  }

  function renderTiendas() {
    $("tiendas").innerHTML = `<div class="stores">${Object.values(db.tiendas || {}).map((t) =>
      `<div class="store"><span class="dot ${t.ok ? "ok" : t.ultimaOk ? "" : "bad"}"></span><b>${esc(t.nombre)}</b><div class="muted small">${t.ok ? `${t.ofertas} precio(s) leídos${t.metodo === "desde tu compu" ? " desde tu compu" : ""}` : esc(t.error || "Todavía sin lectura")}${t.ultimaOk && !t.ok ? ` · última lectura buena ${hace(t.ultimaOk)}` : ""}</div></div>`).join("")}</div>
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
