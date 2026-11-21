// Lectores de páginas: convierten HTML o JSON de cada tienda en una lista de ofertas
// con el mismo formato: { titulo, url, contado, lista, cuotas: {n, monto, total, sinInteres} }.

export const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function toNumber(txt) {
  if (txt == null) return null;
  if (typeof txt === "number") return Number.isFinite(txt) ? txt : null;
  let s = String(txt).replace(/[^\d.,]/g, "");
  if (!s) return null;
  // "1.599.999,00" -> 1599999.00 ; "1599999.00" -> 1599999
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) || []).length === 1) s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function imageOf(v) {
  if (!v) return null;
  if (Array.isArray(v)) return imageOf(v[0]);
  if (typeof v === "object") return imageOf(v.url || v.contentUrl || v.imageUrl || v.src);
  const u = String(v);
  if (u.startsWith("//")) return "https:" + u;
  return /^https:\/\//.test(u) ? u : null;
}

export function decode(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ¿El título corresponde al producto y no a un accesorio?
export function matches(titulo, prod) {
  const t = norm(titulo);
  const groups = prod.debeTener || [];
  if (!groups.every((g) => g.split("|").some((alt) => t.includes(norm(alt))))) return false;
  return !(prod.excluir || []).some((w) => t.includes(norm(w)));
}

export function inRange(precio, prod) {
  if (!precio) return false;
  if (prod.minimo && precio < prod.minimo) return false;
  if (prod.maximo && precio > prod.maximo) return false;
  return true;
}

// ---------- VTEX (muchas tiendas argentinas usan esta plataforma) ----------
export function parseVtex(json, base) {
  if (!Array.isArray(json)) return [];
  const out = [];
  for (const p of json) {
    const item = (p.items || [])[0];
    const seller = item && (item.sellers || []).find((s) => s.sellerDefault) || (item && item.sellers || [])[0];
    const co = seller && seller.commertialOffer;
    if (!co || !co.Price || co.AvailableQuantity === 0) continue;
    let best = null;
    const medios = {}; // n de cuotas sin interés -> tarjetas que lo ofrecen
    for (const ins of co.Installments || []) {
      const n = ins.NumberOfInstallments;
      if (!n || n < 2) continue;
      const total = ins.TotalValuePlusInterestRate || ins.Value * n;
      const sinInteres = ins.InterestRate === 0 || Math.abs(total - co.Price) < 2;
      if (sinInteres && ins.PaymentSystemName) (medios[n] ||= new Set()).add(ins.PaymentSystemName);
      if (!best || (sinInteres && !best.sinInteres) || (sinInteres === best.sinInteres && n > best.n)) {
        best = { n, monto: Math.round(ins.Value), total: Math.round(total), sinInteres };
      }
    }
    if (best && best.sinInteres && medios[best.n]) best.medios = [...medios[best.n]].slice(0, 8);
    out.push({
      titulo: p.productName,
      url: p.link ? (p.link.startsWith("http") ? p.link : base + p.link) : base,
      contado: co.Price,
      lista: co.ListPrice && co.ListPrice > co.Price ? co.ListPrice : null,
      cuotas: best,
      imagen: imageOf(item.images && item.images[0] && item.images[0].imageUrl)
    });
  }
  return out;
}

// ---------- JSON-LD (datos estructurados que muchas tiendas publican para Google) ----------
export function parseJsonLd(html, base) {
  const out = [];
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    const type = [].concat(node["@type"] || []).map(String);
    if (type.includes("Product")) {
      const offers = [].concat(node.offers || []);
      for (const o of offers) {
        const price = toNumber(o.price ?? o.lowPrice);
        const cur = o.priceCurrency || "ARS";
        if (price && cur === "ARS" && !/OutOfStock/i.test(o.availability || "")) {
          let url = node.url || o.url || base;
          if (url && !/^https?:/.test(url)) url = new URL(url, base).href;
          out.push({ titulo: decode(node.name), url, contado: price, lista: null, cuotas: null, imagen: imageOf(node.image) });
          break;
        }
      }
    }
    for (const k of ["@graph", "itemListElement", "item", "mainEntity"]) if (node[k]) visit(node[k]);
  };
  for (const b of blocks) {
    try {
      visit(JSON.parse(b[1].trim()));
    } catch {
      /* bloque inválido: se ignora */
    }
  }
  return out;
}

// ---------- __NEXT_DATA__ (sitios hechos con Next.js, por ejemplo Frávega) ----------
export function parseNextData(html, base) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return [];
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  const priceOf = (o) => {
    for (const k of ["salePrice", "price", "bestPrice", "sellingPrice", "finalPrice", "amount"]) {
      const v = o[k];
      if (typeof v === "number" && v > 1000) return v;
      if (v && typeof v === "object") {
        const inner = priceOf(v);
        if (inner) return inner;
      }
      if (typeof v === "string" && /^\d[\d.,]*$/.test(v)) {
        const n = toNumber(v);
        if (n > 1000) return n;
      }
    }
    return null;
  };
  const walk = (o, depth) => {
    if (!o || typeof o !== "object" || depth > 14) return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
    const title = o.title || o.name || o.productName;
    const price = typeof title === "string" && title.length > 8 ? priceOf(o) : null;
    if (price) {
      const slug = o.slug || o.url || o.link || o.href;
      let url = typeof slug === "string" ? slug : base;
      if (!/^https?:/.test(url)) url = new URL(url.startsWith("/") ? url : "/" + url, base).href;
      const key = title + price;
      if (!seen.has(key)) {
        seen.add(key);
        const lista = typeof o.listPrice === "number" && o.listPrice > price ? o.listPrice : null;
        out.push({ titulo: decode(title), url, contado: price, lista, cuotas: null, imagen: imageOf(o.image || o.images || o.imageUrl || o.thumbnail) });
      }
    }
    for (const v of Object.values(o)) walk(v, depth + 1);
  };
  walk(data, 0);
  return out;
}

// ---------- Mercado Libre: listado público ----------
export function parseMercadoLibre(html) {
  const chunks = html.split(/<li[^>]+class="[^"]*ui-search-layout__item/).slice(1);
  const items = [];
  for (const chunk of chunks) {
    const link = chunk.match(/<a[^>]+href="(https:\/\/[^"]*mercadolibre\.com\.ar[^"]*)"[^>]*>/);
    const titleMatch =
      chunk.match(/class="[^"]*poly-component__title[^"]*"[^>]*>([\s\S]*?)<\/(a|h2|h3)>/) ||
      chunk.match(/class="[^"]*ui-search-item__title[^"]*"[^>]*>([\s\S]*?)<\/(a|h2|h3)>/);
    if (!link || !titleMatch) continue;
    const prevBlock = chunk.match(/andes-money-amount--previous[\s\S]*?andes-money-amount__fraction[^>]*>([\d.]+)</);
    const allPrices = [...chunk.matchAll(/andes-money-amount__fraction[^>]*>([\d.]+)</g)].map((m) => toNumber(m[1]));
    const lista = prevBlock ? toNumber(prevBlock[1]) : null;
    const contado = lista ? allPrices.find((p) => p !== lista) ?? allPrices[0] : allPrices[0];
    if (!contado) continue;
    const text = decode(chunk);
    items.push({
      titulo: decode(titleMatch[1]),
      url: link[1].split("#")[0],
      contado,
      lista: lista && lista > contado ? lista : null,
      cuotas: cuotasFromText(text, contado),
      imagen: imageOf((chunk.match(/<img[^>]+(?:data-src|src)="(https:[^"]+)"/) || [])[1]),
      tiendaOficial: /tienda oficial|vendido por/i.test(text)
    });
  }
  return items;
}

// "12 cuotas sin interés de $141.667" / "Mismo precio en 6 cuotas de $1.000"
export function cuotasFromText(text, contado) {
  const m = text.match(/(?<![\d.])(\d{1,2})\s*(?:cuotas|x)\s*(?:sin inter[eé]s\s*)?de\s*\$\s*([\d.]+)(?:,(\d+))?\s*(sin inter[eé]s)?/i);
  if (m) {
    const n = Number(m[1]);
    const monto = toNumber(m[2]);
    const total = n * monto;
    const sinInteres = /sin inter[eé]s/i.test(m[0]) || /mismo precio en \d+ cuotas/i.test(text) || (contado && Math.abs(total - contado) / contado < 0.01);
    return { n, monto, total, sinInteres };
  }
  const mp = text.match(/mismo precio en (\d+) cuotas/i);
  if (mp && contado) {
    const n = Number(mp[1]);
    return { n, monto: Math.round(contado / n), total: contado, sinInteres: true };
  }
  return null;
}

// Página de producto de Mejores Compras (precio de Mercado Libre)
export function parseMejoresCompras(html, url) {
  const ld = parseJsonLd(html, url);
  if (ld.length) {
    const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " "));
    return ld.slice(0, 1).map((o) => ({ ...o, cuotas: cuotasFromText(text, o.contado) }));
  }
  const meta = html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)/i) || html.match(/property=["']product:price:amount["'][^>]*content=["']([\d.,]+)/i);
  const title = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
  const img = (html.match(/property=["']og:image["'][^>]*content=["']([^"']+)/i) || [])[1];
  if (meta && title) return [{ titulo: decode(title), url, contado: toNumber(meta[1]), lista: null, cuotas: null, imagen: imageOf(img) }];
  return [];
}

// ---------- Lectores específicos por tienda (revisados en las páginas reales, nov. 2026) ----------

// Venex: listado armado en el servidor; cada producto trae enhancedClick({"name","price"}).
export function parseVenex(html) {
  const out = [];
  const seen = new Set();
  // El título de cada producto es <h3 class="product-box-title"><a href="…" onclick='enhancedClick({…})'>.
  // El onclick puede venir con comillas simples (HTML del servidor) o dobles con &quot; (HTML re-serializado).
  const re = /<h3[^>]*class="product-box-title[^"]*"[^>]*>\s*<a\s[^>]*?href="([^"]+)"[^>]*?onclick=(['"])\s*enhancedClick\(([\s\S]*?)\)\s*;?\s*\2/g;
  const hits = [...html.matchAll(re)];
  hits.forEach((m, i) => {
    let data;
    try {
      data = JSON.parse(m[3].replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, "&"));
    } catch {
      return;
    }
    const url = m[1].split("?")[0];
    if (seen.has(url)) return;
    seen.add(url);
    const start = i ? hits[i - 1].index + hits[i - 1][0].length : Math.max(0, m.index - 6000);
    const end = i + 1 < hits.length ? hits[i + 1].index : m.index + 6000;
    const antes = html.slice(Math.max(start, m.index - 6000), m.index);
    const despues = html.slice(m.index + m[0].length, end);
    const shown = (despues.match(/class="current-price"[^>]*>\s*\$\s*([\d.,]+)/) || [])[1];
    const contado = toNumber(shown) || toNumber(data.price);
    const bloque = antes.slice(antes.lastIndexOf("product-box-media") - 200) + despues.split(/product-box-overlay/)[0];
    if (!contado || /SIN STOCK|AGOTADO/i.test(bloque)) return;
    const imgs = [...antes.matchAll(/<img[^>]+?(?:data-src|src)="([^"]+)"/g)].map((x) => x[1]).filter((x) => !/^data:|logo|icon/i.test(x));
    const img = imgs[imgs.length - 1];
    const abs = (u) => (u.startsWith("http") ? u : "https://www.venex.com.ar/" + u.replace(/^\//, ""));
    out.push({ titulo: decode(data.name || ""), url: abs(url), contado, lista: null, cuotas: null, imagen: img ? imageOf(abs(img)) : null });
  });
  return out.filter((o) => o.titulo);
}

// Full H4rd: <div class="item product-list"> con <h3> y <div class="price">$contado <span class="price-promo">$lista</span>
export function parseFullH4rd(html) {
  const out = [];
  for (const b of html.split(/class="item product-list"/).slice(1)) {
    const href = (b.match(/<a href="(\/prod\/[^"]+)"/) || [])[1];
    const titulo = (b.match(/<h3>([\s\S]*?)<\/h3>/) || [])[1];
    const priceBlock = (b.match(/<div class="price">([\s\S]*?)<\/div>/) || [])[1];
    if (!href || !titulo || !priceBlock) continue;
    const contado = toNumber((priceBlock.match(/^\s*\$\s*([\d.,]+)/) || [])[1]);
    const lista = toNumber((priceBlock.match(/price-promo[^>]*>\s*\$\s*([\d.,]+)/) || [])[1]);
    if (!contado) continue;
    const img = (b.match(/<img[^>]+src="(\/img\/[^"]+)"/) || [])[1];
    out.push({ titulo: decode(titulo), url: "https://www.fullh4rd.com.ar" + href, contado, lista: lista && lista > contado ? lista : null, cuotas: null, imagen: img ? "https://www.fullh4rd.com.ar" + img : null });
  }
  return out;
}

// Frávega: __NEXT_DATA__ con resultados SkuItem { code, item{title,slug,images}, pricing{salePrice,listPrice}, collections }
export function parseFravega(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return [];
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out = [];
  const seen = new Set();
  const walk = (o, depth) => {
    if (!o || typeof o !== "object" || depth > 20) return;
    if (Array.isArray(o)) return o.forEach((x) => walk(x, depth + 1));
    if (o.__typename === "SkuItem" && o.item && o.pricing && o.pricing.salePrice) {
      const code = o.code;
      if (!seen.has(code)) {
        seen.add(code);
        const price = o.pricing.salePrice;
        const coll = (o.collections || []).map((c) => c && c.name).find((n) => /(\d+)\s*cuotas sin inter/i.test(n || ""));
        const n = coll ? Number(coll.match(/(\d+)/)[1]) : null;
        const img = (o.item.images || o.images || [])[0];
        out.push({
          titulo: o.item.title,
          url: `https://www.fravega.com/p/${o.item.slug}-${code}/`,
          contado: price,
          lista: o.pricing.listPrice && o.pricing.listPrice > price ? o.pricing.listPrice : null,
          cuotas: n ? { n, monto: Math.round(price / n), total: price, sinInteres: true } : null,
          imagen: img ? `https://images.fravega.com/f300/${img}` : null,
          vendedor: o.seller && o.seller.commercialName
        });
      }
      return;
    }
    for (const v of Object.values(o)) walk(v, depth + 1);
  };
  walk(data, 0);
  return out;
}

// Compra Gamer: catálogo público completo en static.compragamer.com/productos.
// precioEspecial = efectivo/transferencia; precioLista = con tarjeta (3 cuotas sin interés sobre ese precio).
export function parseCompraGamer(json) {
  const arr = Array.isArray(json) ? json : [];
  return arr
    .filter((p) => p && p.vendible && p.stock > 0 && p.precioEspecial)
    .map((p) => {
      const slug = String(p.nombre).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const lista = p.precioLista || null;
      return {
        titulo: p.nombre,
        url: `https://compragamer.com/producto/${slug}_${p.id_producto}`,
        contado: p.precioEspecial,
        lista: lista && lista > p.precioEspecial ? lista : null,
        cuotas: lista ? { n: 3, monto: Math.round(lista / 3), total: Math.round(lista), sinInteres: true, medios: ["Tarjetas de crédito (precio de lista)"] } : null,
        imagen: null
      };
    });
}
