// Lector de tiendas compartido: lo usan GitHub Actions (scraper/run.mjs) y la extensión de Edge.
import { SOURCES } from "./sources.js";
import { matches, inRange } from "./parse.js";

const UA = "RadarOfertasPersonal/1.0 (uso personal; +https://github.com/tomycampeon1-sketch/radar-ofertas-edge)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => (n == null ? "?" : "$" + Math.round(n).toLocaleString("es-AR"));

export async function fetchText(url, accept, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "es-AR,es;q=0.9" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) {
    const e = new Error(`HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.text();
}

// Lee una tienda para todos los productos. Devuelve { porProducto: {id: [ofertas]}, estado }.
export async function scrapeStore(tienda, productos, { fetchImpl = fetch, log = () => {}, pausaMs = 1500, usarExtra = true } = {}) {
  const src = SOURCES[tienda.id];
  const estado = { nombre: tienda.nombre, ok: false, metodo: null, ofertas: 0, error: null };
  const porProducto = {};
  if (!src) return { porProducto, estado };
  if (!src.metodos.length && !(usarExtra && src.extra)) {
    estado.error = "Sin lectura automática (solo enlace)";
    return { porProducto, estado };
  }
  let fallas = 0;
  let metodoBueno = null; // una vez que un método anda, se usa ese
  for (const p of productos) {
    if (fallas >= 3) break; // la tienda nos está bloqueando: no insistir
    const metodos = metodoBueno ? [metodoBueno] : src.metodos;
    let lista = null;
    for (const m of metodos) {
      try {
        await sleep(pausaMs);
        const body = await fetchText(m.url(p.busqueda), m.accept, fetchImpl);
        const parsed = m.parse(body);
        if (parsed.length) {
          lista = parsed;
          metodoBueno = m;
          estado.metodo = m.nombre;
          break;
        }
      } catch (e) {
        estado.error = `${m.nombre}: ${e.message}`;
        fallas++;
      }
    }
    if (usarExtra && src.extra) {
      for (const ex of (p.extra || []).filter((x) => x.tienda === tienda.id)) {
        try {
          await sleep(pausaMs);
          const body = await fetchText(ex.url, src.extra.accept, fetchImpl);
          const parsed = src.extra.parse(body, ex.url).map((o) => ({ ...o, via: new URL(ex.url).hostname }));
          if (parsed.length) {
            lista = [...(lista || []), ...parsed];
            estado.metodo = estado.metodo || "extra";
          } else {
            log(`  ${tienda.nombre} / ${p.id}: ${new URL(ex.url).hostname} no trajo precio`);
          }
        } catch (e) {
          log(`  ${tienda.nombre} / ${p.id}: ${new URL(ex.url).hostname} ${e.message}`);
        }
      }
    }
    if (!lista) continue;
    const buenas = lista.filter((o) => matches(o.titulo, p) && inRange(o.contado, p));
    if (buenas.length) {
      porProducto[p.id] = buenas;
      estado.ok = true;
      estado.ofertas += buenas.length;
    } else {
      const ej = lista.slice(0, 2).map((o) => `"${String(o.titulo).slice(0, 60)}" ${money(o.contado)}`).join(" · ");
      log(`  ${tienda.nombre} / ${p.id}: ${lista.length} resultado(s) descartado(s), ej.: ${ej}`);
    }
  }
  if (estado.ok) estado.error = null;
  else if (!estado.error) estado.error = "Ningún resultado coincidió con los productos";
  return { porProducto, estado };
}

export async function scrapeAll(config, opts = {}) {
  const log = opts.log || console.log;
  const resultados = {};
  const estado = {};
  for (const t of config.tiendas) {
    const r = await scrapeStore(t, config.productos, { ...opts, log });
    estado[t.id] = r.estado;
    for (const [pid, ofertas] of Object.entries(r.porProducto)) (resultados[pid] ||= {})[t.id] = ofertas;
    log(`${t.nombre}: ${r.estado.ok ? `${r.estado.ofertas} ofertas (${r.estado.metodo})` : `sin datos (${r.estado.error})`}`);
  }
  return { resultados, estado };
}
