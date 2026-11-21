import { STORES, DEFAULT_WATCHLIST, DEFAULT_SETTINGS } from "./lib/config.js";
import { upcomingEvents, formatDate } from "./lib/events.js";

const panel = document.getElementById("panel");
const statusEl = document.getElementById("status");
let tab = "feed";

const money = (n) => (n == null ? "?" : "$" + Math.round(n).toLocaleString("es-AR"));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ago = (t) => {
  if (!t) return "nunca";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};
const safeUrl = (u) => (/^https:\/\//.test(u || "") ? u : null);

async function load() {
  return chrome.storage.local.get(["feed", "watchlist", "watchState", "lastRun", "lastErrors", "settings", "shared", "aporte"]);
}

const ICON = { producto: "💰", base: "📉", tienda: "🛒", cuotas: "💳", evento: "📅" };
const thumb = (img, emoji) => `<div class="thumb">${safeUrl(img) ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer">` : emoji}</div>`;

function cuotaChip(c, contado) {
  if (!c) return "";
  const rec = contado && c.total ? c.total / contado - 1 : 0;
  return rec > 0.01 ? `<span class="chip lista">sin interés, +${(rec * 100).toFixed(1).replace(".", ",")}%</span>` : `<span class="chip sin">sin interés real</span>`;
}

function renderFeed(s) {
  const feed = s.feed || [];
  if (!feed.length) return `<div class="empty">Todavía no hay novedades.<br>Cuando aparezca una oferta nueva te aviso con una notificación.</div>`;
  return feed
    .map((f) => {
      const tagName = safeUrl(f.url) ? "a" : "div";
      return `<${tagName} class="item ${f.seen ? "" : "unseen"}" ${tagName === "a" ? `href="${esc(f.url)}" target="_blank"` : ""}>
        ${thumb(f.thumbnail, ICON[f.kind] || "🔔")}
        <div class="body"><div class="t">${esc(f.title)}</div><div>${esc(f.message)}</div>
        <div class="meta muted small">${ago(f.time)}${f.store ? ` · ${esc(f.store)}` : ""}</div></div></${tagName}>`;
    })
    .join("");
}

function renderWatch(s) {
  const list = s.watchlist || DEFAULT_WATCHLIST;
  const ws = s.watchState || {};
  const enabled = (s.settings && s.settings.enabledStores) || DEFAULT_SETTINGS.enabledStores;
  const on = s.settings && s.settings.notifyWatchlist;
  return (on ? "" : `<p class="note">Esta lista se revisa desde tu compu solo si activás "Revisar también Productos que sigo" en Opciones. Los botones abren la búsqueda en cada tienda.</p>`) +
    list
      .map((w) => {
        const st = ws[w.id] || {};
        const links = STORES.filter((x) => x.search && enabled.includes(x.id))
          .map((x) => `<a class="pill" href="${esc(x.search(w.query))}" target="_blank">${esc(x.name)}</a>`)
          .join("");
        return `<div class="item"><div class="body">
          <div class="t">${esc(w.query)}</div>
          <div class="meta">${st.cheapest ? `<a href="${esc(safeUrl(st.cheapest.url) || "#")}" target="_blank"><b>${money(st.cheapest.price)}</b></a> en Mercado Libre` : `<span class="muted small">Sin datos de esta compu todavía</span>`}${w.maxPrice ? `<span class="muted small">· tope ${money(w.maxPrice)}</span>` : ""}</div>
          <div class="links">${links}</div></div></div>`;
      })
      .join("");
}

const PAGE = "https://tomycampeon1-sketch.github.io/radar-ofertas-edge/";
function renderPrecios(s) {
  const sh = s.shared;
  if (!sh) return `<div class="empty">Todavía no leí la base de la página.<br>Tocá <b>Verificar ahora</b>.</div>`;
  const fila = (p) => {
    const url = safeUrl(p.url);
    const tagName = url ? "a" : "div";
    return `<${tagName} class="item" ${url ? `href="${esc(url)}" target="_blank"` : ""}>${thumb(p.imagen, p.grupo === "consola" ? "🎮" : "🖥️")}
      <div class="body"><div class="t">${esc(p.nombre)}</div>
      ${p.contado ? `<div class="meta"><span class="price">${money(p.contado)}</span><span class="muted small">en ${esc(p.tienda)}${p.alDia ? "" : " · precio anterior"}</span></div>` : `<div class="muted small">Todavía sin precio de tienda</div>`}
      ${p.cuotas ? `<div class="meta small">${p.cuotas.n} × ${money(p.cuotas.monto)} en ${esc(p.cuotas.tienda)} ${cuotaChip(p.cuotas, p.contado)}</div>` : ""}</div></${tagName}>`;
  };
  const cons = sh.productos.filter((p) => p.grupo === "consola").map(fila).join("");
  const pc = sh.productos.filter((p) => p.grupo !== "consola" && p.contado && p.url).map(fila).join("");
  return `<div class="group">Consolas</div>${cons}<div class="group">Piezas de PC</div>${pc || `<div class="empty">Sin precios todavía.</div>`}
    <p class="note">Base actualizada ${ago(Date.parse(sh.actualizado))} · ${sh.tiendasOk} de ${sh.tiendasTotal} tiendas leídas. Cada precio abre la publicación para comprar. <a href="${PAGE}" target="_blank">Comparador completo</a></p>`;
}

function renderEvents() {
  return upcomingEvents(new Date(), 7)
    .map(
      (e) => `<div class="item">${thumb(null, e.active ? "🔥" : "📅")}<div class="body">
        <div class="t">${esc(e.name)} ${e.active ? '<span class="chip hot">¡Ahora!</span>' : e.daysUntil <= 7 ? `<span class="chip hot">en ${e.daysUntil} d</span>` : ""}</div>
        <div class="muted small">${formatDate(e.start)} al ${formatDate(e.end)} (fecha estimada)</div>
        ${e.url ? `<a class="small" href="${esc(e.url)}" target="_blank">Sitio oficial</a>` : ""}</div></div>`
    )
    .join("") + `<p class="note">Las fechas se estiman según cómo se repiten cada año. Además, la extensión revisa las portadas de las tiendas y te avisa cuando un evento aparece de verdad.</p>`;
}

async function render() {
  const s = await load();
  panel.innerHTML = tab === "feed" ? renderFeed(s) : tab === "precios" ? renderPrecios(s) : tab === "watch" ? renderWatch(s) : renderEvents();
  const errs = (s.lastErrors || []).length;
  statusEl.textContent = `Último chequeo: ${ago(s.lastRun)}${errs ? ` · ${errs} fuente(s) con error` : ""}`;
  statusEl.title = (s.lastErrors || []).join("\n");
  if (s.aporte && (s.aporte.ultimaSubida || s.aporte.ultimoError)) {
    statusEl.textContent += s.aporte.ultimoError ? " · aporte con error" : ` · aporte ${ago(s.aporte.ultimaSubida)}`;
    if (s.aporte.ultimoError) statusEl.title += `\nAporte: ${s.aporte.ultimoError}`;
  }
}

document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
    tab = b.dataset.tab;
    render();
  })
);

document.getElementById("run").addEventListener("click", async (ev) => {
  const btn = ev.currentTarget;
  btn.disabled = true;
  btn.textContent = "Revisando…";
  const r = await chrome.runtime.sendMessage({ type: "runNow" });
  btn.disabled = false;
  btn.textContent = "Verificar ahora";
  await render();
  if (r && typeof r.found === "number") statusEl.textContent = `${r.found} novedad(es) nueva(s)` + (r.errors.length ? ` · ${r.errors.length} con error` : "");
});

document.getElementById("opts").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

render().then(() => setTimeout(() => chrome.runtime.sendMessage({ type: "markSeen" }), 1500));
