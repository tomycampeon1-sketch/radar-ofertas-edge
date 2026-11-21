// Pruebas con páginas simuladas: node --test scraper/
import test from "node:test";
import assert from "node:assert/strict";
import { parseVtex, parseJsonLd, parseNextData, parseMercadoLibre, matches, toNumber, cuotasFromText } from "../extension/lib/core/parse.js";
import { buildDb, scrapeAll, mergeAportes } from "./run.mjs";

const PS5 = { id: "ps5", nombre: "PS5 Slim Digital", grupo: "consola", busqueda: "PlayStation 5 Slim Digital", debeTener: ["ps5|playstation 5", "digital"], excluir: ["joystick", "juego"], minimo: 800000, maximo: 4000000 };
const CONFIG = { tiendas: [{ id: "garbarino", nombre: "Garbarino" }, { id: "mercadolibre", nombre: "Mercado Libre" }], productos: [PS5] };

test("toNumber entiende formatos argentinos", () => {
  assert.equal(toNumber("$ 1.599.999"), 1599999);
  assert.equal(toNumber("1.599.999,50"), 1599999.5);
  assert.equal(toNumber("1599999.00"), 1599999);
  assert.equal(toNumber(12), 12);
});

test("matches descarta accesorios", () => {
  assert.ok(matches("Consola Sony PlayStation 5 Slim Digital 1TB", PS5));
  assert.ok(!matches("Joystick PS5 DualSense Digital", PS5));
  assert.ok(!matches("Consola PS5 Slim con lectora", PS5));
});

test("parseVtex lee contado y mejor plan sin interés", () => {
  const json = [
    {
      productName: "Consola PlayStation 5 Slim Digital",
      link: "/ps5-slim/p",
      items: [{ sellers: [{ sellerDefault: true, commertialOffer: { Price: 1599999, ListPrice: 1899999, AvailableQuantity: 3, Installments: [
        { NumberOfInstallments: 6, Value: 266666.5, InterestRate: 0, TotalValuePlusInterestRate: 1599999, PaymentSystemName: "Visa" },
        { NumberOfInstallments: 12, Value: 133333.25, InterestRate: 0, TotalValuePlusInterestRate: 1599999, PaymentSystemName: "Visa" },
        { NumberOfInstallments: 18, Value: 120000, InterestRate: 2.1, TotalValuePlusInterestRate: 2160000, PaymentSystemName: "Visa" }
      ] } }] }]
    }
  ];
  const [o] = parseVtex(json, "https://www.garbarino.com");
  assert.equal(o.contado, 1599999);
  assert.equal(o.lista, 1899999);
  assert.equal(o.url, "https://www.garbarino.com/ps5-slim/p");
  assert.deepEqual({ n: o.cuotas.n, sin: o.cuotas.sinInteres }, { n: 12, sin: true });
});

test("parseJsonLd lee productos de un ItemList", () => {
  const html = `<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Product","name":"PS5 Slim Digital","url":"/p/1","offers":{"@type":"Offer","price":"1650000","priceCurrency":"ARS","availability":"InStock"}}}]}</script>`;
  const [o] = parseJsonLd(html, "https://www.venex.com.ar");
  assert.equal(o.contado, 1650000);
  assert.equal(o.url, "https://www.venex.com.ar/p/1");
});

test("parseNextData encuentra productos con precio", () => {
  const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { items: [{ title: "Consola PS5 Slim Digital 1TB", slug: "/p/ps5", salePrice: 1700000, listPrice: 1900000 }] } } })}</script>`;
  const [o] = parseNextData(html, "https://www.fravega.com");
  assert.equal(o.contado, 1700000);
  assert.equal(o.lista, 1900000);
  assert.equal(o.url, "https://www.fravega.com/p/ps5");
});

test("parseMercadoLibre lee precio, precio anterior y cuotas", () => {
  const html = `<ol><li class="ui-search-layout__item"><a href="https://www.mercadolibre.com.ar/ps5/p/MLA1">x</a>
    <h3 class="poly-component__title">Sony PlayStation 5 Slim Digital 1TB</h3>
    <s class="andes-money-amount--previous"><span class="andes-money-amount__fraction">1.899.999</span></s>
    <span class="andes-money-amount__fraction">1.599.999</span>
    <span>Mismo precio en 12 cuotas de $133.333</span></li></ol>`;
  const [o] = parseMercadoLibre(html);
  assert.equal(o.contado, 1599999);
  assert.equal(o.lista, 1899999);
  assert.equal(o.cuotas.n, 12);
  assert.ok(o.cuotas.sinInteres);
});

test("cuotasFromText detecta recargo", () => {
  const c = cuotasFromText("6 cuotas sin interés de $316.667", 1599999);
  assert.equal(c.n, 6);
  assert.equal(c.total, 1900002);
  assert.ok(c.sinInteres);
});

test("buildDb arma mejores precios, historial y alertas de baja", () => {
  const t0 = new Date("2026-11-20T00:00:00Z");
  const r1 = { resultados: { ps5: { garbarino: [{ titulo: "PS5 Slim Digital", url: "u1", contado: 1700000, lista: null, cuotas: null }] } }, estado: { garbarino: { ok: true, ofertas: 1 } } };
  const db1 = buildDb(null, CONFIG, r1, t0);
  assert.equal(db1.productos[0].mejor.contado.precio, 1700000);
  assert.equal(db1.alertas.length, 0);

  const t1 = new Date("2026-11-20T06:00:00Z");
  const r2 = { resultados: { ps5: { garbarino: [{ titulo: "PS5 Slim Digital", url: "u1", contado: 1500000, lista: 1800000, cuotas: { n: 12, monto: 125000, total: 1500000, sinInteres: true } }] } }, estado: { garbarino: { ok: true, ofertas: 1 } } };
  const db2 = buildDb(db1, CONFIG, r2, t1);
  const tipos = db2.alertas.map((a) => a.tipo).sort();
  assert.deepEqual(tipos, ["baja", "cuotas", "descuento"]);
  assert.equal(db2.productos[0].historia.length, 2);
  assert.equal(db2.productos[0].mejor.cuotas.n, 12);

  // misma lectura de nuevo: no repite alertas
  const db3 = buildDb(db2, CONFIG, r2, new Date("2026-11-20T12:00:00Z"));
  assert.equal(db3.nuevasEstaVez, 0);
  assert.equal(db3.alertas.length, 3);

  // la tienda falla: se conserva la última oferta marcada como vieja
  const db4 = buildDb(db3, CONFIG, { resultados: {}, estado: {} }, new Date("2026-11-21T00:00:00Z"));
  assert.ok(db4.productos[0].ofertas[0].viejo);
  assert.equal(db4.tiendas.garbarino.ok, false);
  assert.ok(db4.tiendas.garbarino.ultimaOk);
});

test("scrapeAll deja de insistir con una tienda que bloquea", async () => {
  let llamadas = 0;
  const fake = async () => {
    llamadas++;
    return { ok: false, status: 403, text: async () => "" };
  };
  const cfg = { tiendas: [{ id: "venex", nombre: "Venex" }], productos: [PS5, { ...PS5, id: "b" }, { ...PS5, id: "c" }, { ...PS5, id: "d" }, { ...PS5, id: "e" }] };
  const { estado } = await scrapeAll(cfg, { fetchImpl: fake, log: () => {}, pausaMs: 0 });
  assert.equal(estado.venex.ok, false);
  assert.equal(llamadas, 3);
});

test("mergeAportes suma precios de la extensión solo donde GitHub no tiene", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const scraped = { resultados: { ps5: { mercadolibre: [{ titulo: "PS5 Slim Digital", url: "https://ml", contado: 1500000 }] } }, estado: { mercadolibre: { ok: true, ofertas: 1 } } };
  const aportes = { tiendas: {
    garbarino: { fecha: "2026-11-21T10:00:00Z", productos: { ps5: [
      { titulo: "Consola PlayStation 5 Slim Digital", url: "https://www.garbarino.com/p", contado: 1650000, cuotas: { n: 12, monto: 137500, total: 1650000, sinInteres: true } },
      { titulo: "Joystick PS5 Digital", url: "https://www.garbarino.com/j", contado: 900000 }
    ] } },
    mercadolibre: { fecha: "2026-11-21T10:00:00Z", productos: { ps5: [{ titulo: "PS5 Slim Digital", url: "https://ml2", contado: 1 }] } },
    venex: { fecha: "2026-11-19T10:00:00Z", productos: { ps5: [{ titulo: "PS5 Slim Digital", url: "https://v", contado: 1600000 }] } }
  } };
  mergeAportes(scraped, aportes, CONFIG, now);
  assert.equal(scraped.resultados.ps5.garbarino.length, 1);
  assert.equal(scraped.resultados.ps5.garbarino[0].via, "tu compu");
  assert.equal(scraped.resultados.ps5.mercadolibre[0].url, "https://ml");
  assert.ok(!scraped.resultados.ps5.venex);
  assert.equal(scraped.estado.garbarino.metodo, "desde tu compu");
  const db = buildDb(null, CONFIG, scraped, now);
  const g = db.productos[0].ofertas.find((o) => o.tiendaId === "garbarino");
  assert.equal(g.fecha, "2026-11-21T10:00:00Z");
  assert.deepEqual(db.productos[0].filtro.debeTener, PS5.debeTener);
});

test("extensión: stepAporte lee tiendas pendientes y uploadAportes sube el archivo", async () => {
  const { stepAporte, uploadAportes, pendingStores } = await import("../extension/lib/aporte.js");
  const db = {
    tiendas: { mercadolibre: { nombre: "Mercado Libre", ok: true, metodo: "extra" }, garbarino: { nombre: "Garbarino", ok: false } },
    productos: [{ id: "ps5", busqueda: "PS5 Slim Digital", filtro: { debeTener: PS5.debeTener, excluir: PS5.excluir, minimo: PS5.minimo, maximo: PS5.maximo } }]
  };
  assert.deepEqual(pendingStores(db).map((t) => t.id), ["mercadolibre", "garbarino"]);
  const vtexJson = JSON.stringify([{ productName: "Consola PlayStation 5 Slim Digital", link: "/p", items: [{ sellers: [{ sellerDefault: true, commertialOffer: { Price: 1650000, ListPrice: 1650000, AvailableQuantity: 1, Installments: [] } }] }] }]);
  const fakeFetch = async (url) => ({ ok: true, status: 200, text: async () => (url.includes("/api/catalog_system/") ? vtexJson : "") });
  const { state, terminado } = await stepAporte(db, null, { pausaMs: 0, fetchImpl: fakeFetch });
  assert.ok(terminado);
  assert.equal(state.tiendas.garbarino.productos.ps5[0].contado, 1650000);

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || "GET", body: opts.body });
    if (!opts.method) return { ok: true, status: 200, json: async () => ({ sha: "abc" }) };
    return { ok: true, status: 200, json: async () => ({}) };
  };
  try {
    const r = await uploadAportes("tok", state);
    assert.ok(r.subido);
    const put = JSON.parse(calls[1].body);
    assert.equal(put.sha, "abc");
    const contenido = JSON.parse(Buffer.from(put.content, "base64").toString("utf8"));
    assert.equal(contenido.tiendas.garbarino.productos.ps5[0].contado, 1650000);
    // y GitHub lo suma a la base
    const cfg = { tiendas: [{ id: "garbarino", nombre: "Garbarino" }], productos: [PS5] };
    const merged = mergeAportes({ resultados: {}, estado: {} }, contenido, cfg);
    assert.equal(merged.resultados.ps5.garbarino[0].contado, 1650000);
  } finally {
    globalThis.fetch = realFetch;
  }
});
