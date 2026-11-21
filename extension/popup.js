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
  return chrome.storage.local.get(["feed", "watchlist", "watchState", "lastRun", "lastErrors", "settings", "shared"]);
}

function renderFeed(s) {
  const feed = s.feed || [];
  if (!feed.length) return `<div class="empty">Todavía no hay novedades.<br>Tocá <b>Verificar ahora</b> o esperá al próximo chequeo automático.</div>`;
  return feed
    .map(
      (f) => `<a class="item ${f.seen ? "" : "unseen"}" href="${esc(safeUrl(f.url) || "#")}" target="_blank">
        ${f.thumbnail ? `<img src="${esc(f.thumbnail)}" alt="">` : ""}
        <div><div class="t">${esc(f.title)}</div><div>${esc(f.message)}</div>
        <div class="muted small">${ago(f.time)}</div></div></a>`
    )
    .join("");
}

function renderWatch(s) {
  const list = s.watchlist || DEFAULT_WATCHLIST;
  const ws = s.watchState || {};
  const enabled = (s.settings && s.settings.enabledStores) || DEFAULT_SETTINGS.enabledStores;
  return list
    .map((w) => {
      const st = ws[w.id] || {};
      const links = STORES.filter((x) => x.search && enabled.includes(x.id))
        .map((x) => `<a class="pill" href="${esc(x.search(w.query))}" target="_blank">${esc(x.name)}</a>`)
        .join("");
      return `<div class="item"><div style="flex:1">
        <div class="t">${esc(w.query)}</div>
        <div>${st.cheapest ? `Más barato en ML: <a href="${esc(safeUrl(st.cheapest.url) || "#")}" target="_blank"><b>${money(st.cheapest.price)}</b></a>` : `<span class="muted">Sin datos todavía</span>`}
        ${w.maxPrice ? ` · tope ${money(w.maxPrice)}` : ""}</div>
        ${st.best ? `<div class="muted small">Mínimo visto: ${money(st.best)} · ${ago(st.checked)}</div>` : ""}
        <div class="links">${links}</div></div></div>`;
    })
    .join("") + `<p class="muted small">Los botones abren la búsqueda en cada tienda para comparar precios.</p>`;
}

const PAGE = "https://tomycampeon1-sketch.github.io/radar-ofertas-edge/";
function renderPrecios(s) {
  const sh = s.shared;
  if (!sh) return `<div class="empty">Todavía no leí la base de la página.<br>Tocá <b>Verificar ahora</b>.</div>`;
  const fila = (p) => `<a class="item" href="${esc(safeUrl(p.url) || PAGE + "#precios")}" target="_blank"><div style="flex:1">
      <div class="t">${esc(p.nombre)}</div>
      <div>${p.contado ? `<b>${money(p.contado)}</b> en ${esc(p.tienda)}` : '<span class="muted">Sin precio</span>'}
      ${p.alDia ? "" : '<span class="muted small">(nota)</span>'}</div>
      ${p.cuotas ? `<div class="muted small">${p.cuotas.n} × ${money(p.cuotas.monto)} sin interés en ${esc(p.cuotas.tienda)}</div>` : ""}</div></a>`;
  const cons = sh.productos.filter((p) => p.grupo === "consola").map(fila).join("");
  const pc = sh.productos.filter((p) => p.grupo !== "consola").map(fila).join("");
  return `<p class="muted small">Base actualizada ${ago(Date.parse(sh.actualizado))} · ${sh.tiendasOk} de ${sh.tiendasTotal} tiendas leídas. <a href="${PAGE}" target="_blank">Ver comparador completo</a></p>
    <div class="t" style="margin:6px 0">Consolas</div>${cons}<div class="t" style="margin:10px 0 6px">Piezas de PC</div>${pc}`;
}

function renderEvents() {
  return upcomingEvents(new Date(), 7)
    .map(
      (e) => `<div class="item"><div style="flex:1">
        <div class="t">${esc(e.name)} ${e.active ? '<span class="pill hot">¡Ahora!</span>' : e.daysUntil <= 7 ? `<span class="pill hot">en ${e.daysUntil} d</span>` : ""}</div>
        <div>${formatDate(e.start)} al ${formatDate(e.end)} <span class="muted small">(estimado)</span></div>
        ${e.url ? `<a class="small" href="${esc(e.url)}" target="_blank">Sitio oficial</a>` : ""}</div></div>`
    )
    .join("") + `<p class="muted small">Las fechas se estiman según cómo se repiten cada año. Además, la extensión revisa las portadas de las tiendas y te avisa cuando un evento aparece de verdad.</p>`;
}

async function render() {
  const s = await load();
  panel.innerHTML = tab === "feed" ? renderFeed(s) : tab === "precios" ? renderPrecios(s) : tab === "watch" ? renderWatch(s) : renderEvents();
  const errs = (s.lastErrors || []).length;
  statusEl.textContent = `Último chequeo: ${ago(s.lastRun)}${errs ? ` · ${errs} fuente(s) con error` : ""}`;
  statusEl.title = (s.lastErrors || []).join("\n");
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
