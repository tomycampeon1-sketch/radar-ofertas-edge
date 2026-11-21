// Actualiza la base de datos compartida (docs/data/db.json).
// La corre GitHub Actions cada 6 horas; también se puede correr a mano: node scraper/run.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SOURCES } from "../extension/lib/core/sources.js";
import { matches, inRange } from "../extension/lib/core/parse.js";
import { scrapeAll } from "../extension/lib/core/scrape.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = path.join(ROOT, "docs/data/db.json");
const PAUSA_MS = Number(process.env.PAUSA_MS ?? 1500);
const MAX_ALERTAS = 150;
const MAX_HISTORIA = 240; // ~60 días a 4 lecturas por día
const APORTE_MAX_HORAS = 24;
const money = (n) => (n == null ? "?" : "$" + Math.round(n).toLocaleString("es-AR"));

export { scrapeAll };

// Suma los precios que leyó la extensión desde la compu de Tomas (docs/data/aportes.json)
// para las tiendas o productos que GitHub no pudo leer.
export function mergeAportes(scraped, aportes, config, now = new Date()) {
  if (!aportes || !aportes.tiendas) return scraped;
  const prods = Object.fromEntries(config.productos.map((p) => [p.id, p]));
  for (const [tid, ap] of Object.entries(aportes.tiendas)) {
    if (!ap || !ap.fecha || now - new Date(ap.fecha) > APORTE_MAX_HORAS * 3600000) continue;
    if (!config.tiendas.some((t) => t.id === tid)) continue;
    let usadas = 0;
    for (const [pid, ofertas] of Object.entries(ap.productos || {})) {
      const p = prods[pid];
      if (!p || scraped.resultados[pid]?.[tid]) continue; // GitHub ya tiene dato propio
      const buenas = (ofertas || []).filter((o) => o && typeof o.titulo === "string" && /^https:\/\//.test(o.url || "") && matches(o.titulo, p) && inRange(o.contado, p))
        .map((o) => ({ titulo: o.titulo, url: o.url, contado: Number(o.contado), lista: Number(o.lista) || null, cuotas: o.cuotas || null, imagen: /^https:\/\//.test(o.imagen || "") ? o.imagen : null, via: "tu compu", fecha: ap.fecha }));
      if (buenas.length) {
        (scraped.resultados[pid] ||= {})[tid] = buenas;
        usadas += buenas.length;
      }
    }
    if (usadas) {
      const e = (scraped.estado[tid] ||= { nombre: tid, ok: false, ofertas: 0 });
      if (!e.ok) e.metodo = "desde tu compu";
      e.ok = true;
      e.error = null;
      e.ofertas = (e.ofertas || 0) + usadas;
      e.aporte = ap.fecha;
    }
  }
  return scraped;
}

// ---------- armado de la base ----------
function hash(s) {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

const mejorContado = (ofertas) => ofertas.filter((o) => o.contado).sort((a, b) => a.contado - b.contado)[0] || null;
const mejorCuotas = (ofertas) =>
  ofertas
    .filter((o) => o.cuotas && o.cuotas.sinInteres && o.cuotas.n >= 3)
    .sort((a, b) => a.cuotas.total - b.cuotas.total || b.cuotas.n - a.cuotas.n)[0] || null;

export function buildDb(prev, config, { resultados, estado }, now = new Date()) {
  const iso = now.toISOString();
  const prevProd = Object.fromEntries((prev?.productos || []).map((p) => [p.id, p]));
  const nombreTienda = Object.fromEntries(config.tiendas.map((t) => [t.id, t.nombre]));
  const alertas = [];
  const productos = [];

  for (const p of config.productos) {
    const antes = prevProd[p.id] || {};
    const ofertas = [];
    for (const t of config.tiendas) {
      const nuevas = resultados[p.id]?.[t.id];
      if (nuevas) {
        // la más barata de contado y, si es otra, la de mejores cuotas
        const orden = [...nuevas].sort((a, b) => a.contado - b.contado);
        const elegidas = [orden[0]];
        const mc = mejorCuotas(orden);
        if (mc && mc !== orden[0]) elegidas.push(mc);
        for (const o of elegidas)
          ofertas.push({ tienda: nombreTienda[t.id], tiendaId: t.id, titulo: o.titulo, url: o.url, contado: o.contado, lista: o.lista || null, cuotas: o.cuotas || null, via: o.via || null, imagen: o.imagen || null, fuente: "auto", fecha: o.fecha || iso });
      } else {
        // la tienda falló esta vez: conservar lo último que vimos si tiene menos de 3 días
        for (const o of (antes.ofertas || []).filter((x) => x.tiendaId === t.id && x.fuente === "auto")) {
          if (now - new Date(o.fecha) < 3 * 86400000) ofertas.push({ ...o, viejo: true });
        }
      }
    }

    const mc = mejorContado(ofertas);
    const mq = mejorCuotas(ofertas);
    const historia = [...(antes.historia || [])];
    const nuevasHoy = ofertas.filter((o) => !o.viejo);
    const minHoy = mejorContado(nuevasHoy);
    if (minHoy) historia.push([iso.slice(0, 13), minHoy.contado]);
    while (historia.length > MAX_HISTORIA) historia.shift();

    // ---- detección de ofertas nuevas ----
    const add = (tipo, titulo, mensaje, o) => {
      const id = hash(`${p.id}|${tipo}|${o.tiendaId}|${o.contado}|${o.cuotas?.n || ""}`);
      alertas.push({ id, fecha: iso, productoId: p.id, producto: p.nombre, tipo, titulo, mensaje, url: o.url, tienda: o.tienda, precio: o.contado });
    };
    const prevMejor = antes.mejor?.contado?.precio;
    const minHist = (antes.historia || []).reduce((m, [, v]) => Math.min(m, v), Infinity);
    if (minHoy) {
      if (prevMejor && minHoy.contado <= prevMejor * 0.97) {
        add("baja", `📉 ${p.nombre}: ${money(minHoy.contado)}`, `Bajó de ${money(prevMejor)} a ${money(minHoy.contado)} en ${minHoy.tienda}.`, minHoy);
      } else if (Number.isFinite(minHist) && (antes.historia || []).length >= 3 && minHoy.contado < minHist) {
        add("minimo", `🏆 ${p.nombre}: mínimo histórico`, `${money(minHoy.contado)} en ${minHoy.tienda} (antes el mínimo era ${money(minHist)}).`, minHoy);
      }
      for (const o of nuevasHoy) {
        const desc = o.lista ? Math.round((1 - o.contado / o.lista) * 100) : 0;
        const yaEstaba = (antes.ofertas || []).some((x) => x.url === o.url && x.contado <= o.contado);
        if (desc >= 15 && !yaEstaba) add("descuento", `🔥 ${p.nombre}: ${desc}% OFF`, `${money(o.contado)} (antes ${money(o.lista)}) en ${o.tienda}.`, o);
        const cuotasAntes = (antes.ofertas || []).some((x) => x.tiendaId === o.tiendaId && x.cuotas?.sinInteres && x.cuotas.n >= (o.cuotas?.n || 0));
        if (o.cuotas?.sinInteres && o.cuotas.n >= 12 && !cuotasAntes)
          add("cuotas", `💳 ${p.nombre}: ${o.cuotas.n} cuotas sin interés`, `${o.cuotas.n} × ${money(o.cuotas.monto)} (total ${money(o.cuotas.total)}) en ${o.tienda}.`, o);
      }
    }

    productos.push({
      id: p.id,
      nombre: p.nombre,
      grupo: p.grupo,
      pieza: p.pieza || null,
      busqueda: p.busqueda,
      filtro: { debeTener: p.debeTener || [], excluir: p.excluir || [], minimo: p.minimo || null, maximo: p.maximo || null },
      extra: (p.extra || []).filter((e) => /^https:\/\//.test(e.url)),
      nota: p.nota || null,
      imagen: (ofertas.find((o) => o.imagen) || {}).imagen || (antes.imagen && /^https:\/\//.test(antes.imagen) ? antes.imagen : null) || p.imagen || null,
      ofertas,
      referencia: p.referencia || [],
      mejor: {
        contado: mc ? { precio: mc.contado, tienda: mc.tienda, url: mc.url, fecha: mc.fecha } : null,
        cuotas: mq ? { n: mq.cuotas.n, monto: mq.cuotas.monto, total: mq.cuotas.total, tienda: mq.tienda, url: mq.url, fecha: mq.fecha } : null
      },
      historia,
      enlaces: Object.fromEntries(config.tiendas.filter((t) => SOURCES[t.id]).map((t) => [t.id, SOURCES[t.id].busqueda(p.busqueda)]))
    });
  }

  const conocidas = new Set((prev?.alertas || []).map((a) => a.id));
  const todas = [...alertas.filter((a) => !conocidas.has(a.id)), ...(prev?.alertas || [])]
    .filter((a) => now - new Date(a.fecha) < 30 * 86400000)
    .slice(0, MAX_ALERTAS);

  const tiendas = {};
  for (const t of config.tiendas) {
    const e = estado[t.id] || {};
    const antes = prev?.tiendas?.[t.id] || {};
    tiendas[t.id] = { nombre: t.nombre, ok: !!e.ok, metodo: e.metodo || null, ofertas: e.ofertas || 0, error: e.error || null, aporte: e.aporte || null, ultimaOk: e.ok ? iso : antes.ultimaOk || null };
  }

  return {
    version: 1,
    actualizado: iso,
    inflacionMensual: config.inflacionMensual ?? 2,
    tiendas,
    productos,
    alertas: todas,
    nuevasEstaVez: alertas.filter((a) => !conocidas.has(a.id)).length
  };
}

// ---------- programa principal ----------
async function main() {
  const config = JSON.parse(await readFile(path.join(ROOT, "productos.json"), "utf8"));
  let prev = null;
  try {
    prev = JSON.parse(await readFile(DB_PATH, "utf8"));
  } catch {
    /* primera vez */
  }
  const scraped = process.argv.includes("--sin-red") ? { resultados: {}, estado: {} } : await scrapeAll(config, { pausaMs: PAUSA_MS });
  let aportes = null;
  try {
    aportes = JSON.parse(await readFile(path.join(ROOT, "docs/data/aportes.json"), "utf8"));
  } catch {
    /* todavía no hay aportes de la extensión */
  }
  mergeAportes(scraped, aportes, config);
  const db = buildDb(prev, config, scraped);
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 1));
  console.log(`Listo: ${db.productos.length} productos, ${db.nuevasEstaVez} ofertas nuevas.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
