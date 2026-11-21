// Cómo se busca en cada tienda. Cada tienda prueba sus métodos en orden y usa el primero que da resultados.
import { parseVtex, parseJsonLd, parseNextData, parseMercadoLibre, parseMejoresCompras, parseVenex, parseFullH4rd, parseFravega, parseCompraGamer } from "./parse.js";

const slug = (q) => q.trim().toLowerCase().replace(/\s+/g, "-");
const enc = encodeURIComponent;

// Métodos reutilizables
const vtex = (base) => ({
  nombre: "vtex",
  url: (q) => `${base}/api/catalog_system/pub/products/search/?ft=${enc(q)}&_from=0&_to=19`,
  accept: "application/json",
  parse: (body) => {
    try {
      return parseVtex(JSON.parse(body), base);
    } catch {
      return [];
    }
  }
});

const html = (urlFn, base) => ({
  nombre: "html",
  url: urlFn,
  accept: "text/html",
  parse: (body) => {
    const ld = parseJsonLd(body, base);
    return ld.length ? ld : parseNextData(body, base);
  }
});

export const SOURCES = {
  mercadolibre: {
    busqueda: (q) => `https://listado.mercadolibre.com.ar/${enc(slug(q))}`,
    metodos: [
      {
        nombre: "listado",
        url: (q) => `https://listado.mercadolibre.com.ar/${enc(slug(q))}_ITEM*CONDITION_2230284_NoIndex_True`,
        accept: "text/html",
        parse: (body) => parseMercadoLibre(body)
      }
    ],
    // Si el listado está bloqueado, se leen las páginas de Mejores Compras cargadas en productos.json ("extra")
    extra: { accept: "text/html", parse: (body, url) => parseMejoresCompras(body, url) }
  },
  fravega: {
    busqueda: (q) => `https://www.fravega.com/l/?keyword=${enc(q)}`,
    metodos: [
      { nombre: "fravega", url: (q) => `https://www.fravega.com/l/?keyword=${enc(q)}`, accept: "text/html", parse: (body) => parseFravega(body) },
      html((q) => `https://www.fravega.com/l/?keyword=${enc(q)}`, "https://www.fravega.com")
    ]
  },
  garbarino: {
    busqueda: (q) => `https://www.garbarino.com/shop/sort-by-price-low-to-high?search=${enc(q)}`,
    metodos: [vtex("https://www.garbarino.com"), html((q) => `https://www.garbarino.com/shop/sort-by-price-low-to-high?search=${enc(q)}`, "https://www.garbarino.com")]
  },
  musimundo: {
    busqueda: (q) => `https://www.musimundo.com/search?text=${enc(q)}`,
    metodos: [vtex("https://www.musimundo.com"), html((q) => `https://www.musimundo.com/search?text=${enc(q)}`, "https://www.musimundo.com")]
  },
  megatone: {
    busqueda: (q) => `https://www.megatone.net/search/${enc(q)}`,
    metodos: [vtex("https://www.megatone.net"), html((q) => `https://www.megatone.net/search/${enc(q)}`, "https://www.megatone.net")]
  },
  cetrohogar: {
    busqueda: (q) => `https://www.cetrohogar.com.ar/${enc(q)}?_q=${enc(q)}&map=ft`,
    metodos: [vtex("https://www.cetrohogar.com.ar"), html((q) => `https://www.cetrohogar.com.ar/${enc(q)}?_q=${enc(q)}&map=ft`, "https://www.cetrohogar.com.ar")]
  },
  compragamer: {
    busqueda: (q) => `https://compragamer.com/productos?criterio=${enc(q)}`,
    // El sitio es 100% JavaScript, pero publica su catálogo completo en un JSON (se baja una vez por revisión)
    metodos: [{ nombre: "catalogo", url: () => "https://static.compragamer.com/productos", accept: "application/json", cache: true, parse: (body) => { try { return parseCompraGamer(JSON.parse(body)); } catch { return []; } } }]
  },
  venex: {
    busqueda: (q) => `https://www.venex.com.ar/resultado-busqueda.htm?keywords=${enc(q)}`,
    metodos: [{ nombre: "venex", url: (q) => `https://www.venex.com.ar/resultado-busqueda.htm?keywords=${enc(q)}`, accept: "text/html", parse: (body) => parseVenex(body) }]
  },
  fullh4rd: {
    busqueda: (q) => `https://www.fullh4rd.com.ar/cat/search/${enc(q)}`,
    metodos: [{ nombre: "fullh4rd", url: (q) => `https://www.fullh4rd.com.ar/cat/search/${enc(q)}`, accept: "text/html", parse: (body) => parseFullH4rd(body) }]
  },
  mexx: {
    busqueda: (q) => `https://www.mexx.com.ar/buscar/?p=${enc(q)}`,
    metodos: [html((q) => `https://www.mexx.com.ar/buscar/?p=${enc(q)}`, "https://www.mexx.com.ar")]
  }
};
