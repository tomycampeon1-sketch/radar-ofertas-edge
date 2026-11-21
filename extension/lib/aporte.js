// "La extensión aporta precios": lee desde este Edge las tiendas que bloquean a GitHub
// y sube lo que encuentra a docs/data/aportes.json del repo. En la próxima actualización
// GitHub suma esos precios a la base compartida.
import { scrapeStore } from "./core/scrape.js";

export const REPO = "tomycampeon1-sketch/radar-ofertas-edge";
const FILE = "docs/data/aportes.json";
const API = `https://api.github.com/repos/${REPO}`;

// Tiendas que conviene leer desde acá: las que GitHub no pudo leer en la última revisión.
export function pendingStores(db) {
  return Object.entries(db.tiendas || {})
    .filter(([, t]) => !t.ok || t.metodo === "desde tu compu")
    .map(([id, t]) => ({ id, nombre: t.nombre }));
}

function productosDe(db) {
  return (db.productos || [])
    .filter((p) => p.busqueda && p.filtro)
    .map((p) => ({ id: p.id, busqueda: p.busqueda, ...p.filtro }));
}

// Avanza el ciclo de lectura sin pasarse del tiempo disponible. Devuelve el estado actualizado
// y si el ciclo terminó (listo para subir).
export async function stepAporte(db, state, { budgetMs = 150000, pausaMs = 800, fetchImpl = fetch } = {}) {
  const st = { cursor: 0, tiendas: {}, ...(state || {}) };
  const tiendas = st.cola && st.cola.length ? st.cola : pendingStores(db);
  st.cola = tiendas;
  const productos = productosDe(db);
  const start = Date.now();
  while (st.cursor < tiendas.length && Date.now() - start < budgetMs) {
    const t = tiendas[st.cursor];
    const r = await scrapeStore(t, productos, { pausaMs, usarExtra: false, fetchImpl });
    const porProducto = {};
    for (const [pid, ofertas] of Object.entries(r.porProducto)) porProducto[pid] = [...ofertas].sort((a, b) => a.contado - b.contado).slice(0, 3);
    st.tiendas[t.id] = { fecha: new Date().toISOString(), ok: r.estado.ok, error: r.estado.error, metodo: r.estado.metodo, productos: porProducto };
    st.cursor++;
  }
  const terminado = st.cursor >= tiendas.length;
  return { state: st, terminado };
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function headers(token) {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
}

export async function testToken(token) {
  if (!token) return { ok: false, error: "Falta la clave" };
  const res = await fetch(API, { headers: headers(token) });
  if (res.status === 401) return { ok: false, error: "La clave no es válida o venció" };
  if (res.status === 404) return { ok: false, error: `La clave no tiene acceso al repo ${REPO}` };
  if (!res.ok) return { ok: false, error: `GitHub respondió ${res.status}` };
  const repo = await res.json();
  if (!repo.permissions || repo.permissions.push !== true) return { ok: false, error: "La clave no puede escribir en el repo (revisá Contents: Read and write)" };
  return { ok: true };
}

// Sube aportes.json con lo leído en las últimas 24 horas.
export async function uploadAportes(token, state) {
  const limite = Date.now() - 24 * 3600000;
  const tiendas = Object.fromEntries(Object.entries(state.tiendas || {}).filter(([, t]) => t.fecha && Date.parse(t.fecha) > limite));
  const conDatos = Object.values(tiendas).filter((t) => Object.keys(t.productos || {}).length).length;
  if (!conDatos) return { subido: false, motivo: "Ninguna tienda devolvió precios" };
  const body = JSON.stringify({ actualizado: new Date().toISOString(), origen: "extension-edge", tiendas }, null, 1);

  const get = await fetch(`${API}/contents/${FILE}?ref=main`, { headers: headers(token) });
  let sha;
  if (get.ok) sha = (await get.json()).sha;
  else if (get.status !== 404) throw new Error(`GitHub (leer): HTTP ${get.status}`);

  const put = await fetch(`${API}/contents/${FILE}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message: `Aporte de precios desde Edge (${conDatos} tienda/s)`, content: toBase64(body), branch: "main", ...(sha ? { sha } : {}) })
  });
  if (!put.ok) throw new Error(`GitHub (guardar): HTTP ${put.status}`);
  return { subido: true, tiendas: conDatos };
}
