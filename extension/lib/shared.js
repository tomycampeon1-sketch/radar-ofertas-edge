// Base de datos compartida: la misma que usa la página del radar.
// GitHub la actualiza cada 6 horas; la extensión la lee y avisa de las ofertas nuevas.

export const PAGE_URL = "https://tomycampeon1-sketch.github.io/radar-ofertas-edge/";
export const DEFAULT_DB_URL = PAGE_URL + "data/db.json";
const RAW_URL = "https://raw.githubusercontent.com/tomycampeon1-sketch/radar-ofertas-edge/main/docs/data/db.json";

export async function fetchSharedDb(url = DEFAULT_DB_URL) {
  const urls = [url || DEFAULT_DB_URL];
  if (!urls.includes(RAW_URL)) urls.push(RAW_URL); // si la página todavía no está publicada
  let lastErr = null;
  for (const u of urls) {
    try {
      const res = await fetch(`${u}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const db = await res.json();
      if (!db || !Array.isArray(db.productos)) throw new Error("formato inesperado");
      return db;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// Devuelve las alertas que la extensión todavía no mostró, y la lista actualizada de vistas.
export function newAlerts(db, seenIds) {
  const seen = new Set(seenIds || []);
  const fresh = (db.alertas || []).filter((a) => !seen.has(a.id));
  const allIds = (db.alertas || []).map((a) => a.id);
  return { fresh, seenIds: [...new Set([...allIds, ...(seenIds || [])])].slice(0, 500) };
}

// Resumen chico para guardar y mostrar en la ventanita
export function summarize(db) {
  return {
    actualizado: db.actualizado,
    tiendasOk: Object.values(db.tiendas || {}).filter((t) => t.ok).length,
    tiendasTotal: Object.keys(db.tiendas || {}).length,
    productos: db.productos.map((p) => {
      // Solo precios de páginas de compra (con link directo)
      const ref = (p.referencia || []).filter((r) => r.contado && /^https:\/\//.test(r.fuente || "")).sort((a, b) => a.contado - b.contado)[0];
      const c = p.mejor && p.mejor.contado;
      return {
        id: p.id,
        nombre: p.nombre,
        grupo: p.grupo,
        imagen: /^https:\/\//.test(p.imagen || "") ? p.imagen : null,
        contado: c ? c.precio : ref ? ref.contado : null,
        tienda: c ? c.tienda : ref ? ref.tienda : null,
        url: c ? c.url : ref ? ref.fuente : null,
        alDia: !!c,
        cuotas: p.mejor && p.mejor.cuotas ? p.mejor.cuotas : null
      };
    })
  };
}
