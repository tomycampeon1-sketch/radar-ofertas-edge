// Búsqueda en Mercado Libre Argentina.
// 1) Primero usa la API pública oficial (api.mercadolibre.com). Si cargaste un token
//    de acceso en Opciones, se manda en el encabezado Authorization.
// 2) Si la API responde 401/403 (Mercado Libre empezó a pedir token para buscar),
//    lee la página pública de resultados (listado.mercadolibre.com.ar), igual que
//    la vería cualquier navegador, una vez por producto y por chequeo.

const API = "https://api.mercadolibre.com/sites/MLA/search";

export async function searchMercadoLibre(query, { token = "", onlyNew = true } = {}) {
  try {
    return { source: "api", items: await searchApi(query, { token, onlyNew }) };
  } catch (err) {
    if (err.status === 401 || err.status === 403 || err.status === 429) {
      return { source: "web", items: await searchWeb(query) };
    }
    throw err;
  }
}

async function searchApi(query, { token, onlyNew }) {
  const params = new URLSearchParams({ q: query, limit: "40" });
  if (onlyNew) params.set("condition", "new");
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}?${params}`, { headers });
  if (!res.ok) {
    const e = new Error(`API de Mercado Libre: HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const data = await res.json();
  return (data.results || [])
    .filter((r) => r.currency_id === "ARS")
    .map((r) => ({
      id: r.id,
      title: r.title,
      price: r.price,
      originalPrice: r.original_price || null,
      url: r.permalink,
      thumbnail: r.thumbnail,
      freeShipping: !!(r.shipping && r.shipping.free_shipping),
      installments: r.installments
        ? { quantity: r.installments.quantity, amount: r.installments.amount, sinInteres: r.installments.rate === 0 }
        : null,
      store: "Mercado Libre"
    }));
}

function toNumber(txt) {
  if (!txt) return null;
  const n = Number(String(txt).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function decode(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseListingHtml(html) {
  const chunks = html.split(/<li[^>]+class="[^"]*ui-search-layout__item/).slice(1);
  const items = [];
  for (const chunk of chunks) {
    const link = chunk.match(/<a[^>]+href="(https:\/\/[^"]*mercadolibre\.com\.ar[^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    const titleMatch =
      chunk.match(/class="[^"]*poly-component__title[^"]*"[^>]*>([\s\S]*?)<\/(a|h2|h3)>/) ||
      chunk.match(/class="[^"]*ui-search-item__title[^"]*"[^>]*>([\s\S]*?)<\/(a|h2|h3)>/);
    if (!link || !titleMatch) continue;

    const prevBlock = chunk.match(/andes-money-amount--previous[\s\S]*?andes-money-amount__fraction[^>]*>([\d.]+)</);
    const allPrices = [...chunk.matchAll(/andes-money-amount__fraction[^>]*>([\d.]+)</g)].map((m) => toNumber(m[1]));
    const originalPrice = prevBlock ? toNumber(prevBlock[1]) : null;
    const price = originalPrice ? allPrices.find((p) => p !== originalPrice) ?? allPrices[0] : allPrices[0];
    if (!price) continue;

    const text = decode(chunk);
    const cuotas = text.match(/(?<![\d.])(\d{1,2})\s*cuotas\s+de\s*\$\s*([\d.]+)(,\d+)?\s*(sin inter[eé]s)?/i);
    const idMatch = link[1].match(/MLA-?(\d+)/i);
    items.push({
      id: idMatch ? `MLA${idMatch[1]}` : link[1].split("?")[0],
      title: decode(titleMatch[1]),
      price,
      originalPrice: originalPrice && originalPrice > price ? originalPrice : null,
      url: link[1].split("#")[0],
      thumbnail: (chunk.match(/<img[^>]+(?:data-src|src)="(https:[^"]+)"/) || [])[1] || null,
      freeShipping: /env[ií]o gratis|llega gratis/i.test(text),
      installments: cuotas
        ? { quantity: Number(cuotas[1]), amount: toNumber(cuotas[2]), sinInteres: !!cuotas[4] || /mismo precio en \d+ cuotas/i.test(text) }
        : /mismo precio en (\d+) cuotas/i.test(text)
          ? { quantity: Number(text.match(/mismo precio en (\d+) cuotas/i)[1]), amount: null, sinInteres: true }
          : null,
      store: "Mercado Libre"
    });
  }
  return items;
}

async function searchWeb(query) {
  const slug = query.trim().toLowerCase().replace(/\s+/g, "-");
  const res = await fetch(`https://listado.mercadolibre.com.ar/${encodeURIComponent(slug)}_ITEM*CONDITION_2230284`, {
    headers: { Accept: "text/html", "Accept-Language": "es-AR,es;q=0.9" }
  });
  if (!res.ok) throw new Error(`Mercado Libre (web): HTTP ${res.status}`);
  return parseListingHtml(await res.text());
}

// ¿El título corresponde al producto buscado y no a un accesorio?
export function matchesQuery(title, query, exclude = "") {
  const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const t = norm(title);
  const stop = new Set(["de", "la", "el", "para", "con", "placa", "video", "monitor", "y"]);
  const words = norm(query).split(/\s+/).filter((w) => w && !stop.has(w));
  if (!words.every((w) => t.includes(w))) return false;
  const bad = norm(exclude).split(/\s+/).filter(Boolean);
  return !bad.some((w) => t.includes(w));
}
