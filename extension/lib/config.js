// Configuración por defecto: tiendas, productos a seguir y palabras clave.

export const STORES = [
  {
    id: "mercadolibre",
    name: "Mercado Libre",
    pages: ["https://www.mercadolibre.com.ar/ofertas"],
    search: (q) => `https://listado.mercadolibre.com.ar/${encodeURIComponent(q.trim().replace(/\s+/g, "-"))}`
  },
  {
    id: "compragamer",
    name: "Compra Gamer",
    pages: ["https://compragamer.com/"],
    search: (q) => `https://compragamer.com/productos?criterio=${encodeURIComponent(q)}`
  },
  {
    id: "fravega",
    name: "Frávega",
    pages: ["https://www.fravega.com/"],
    search: (q) => `https://www.fravega.com/l/?keyword=${encodeURIComponent(q)}`
  },
  {
    id: "garbarino",
    name: "Garbarino",
    pages: ["https://www.garbarino.com/"],
    search: (q) => `https://www.garbarino.com/shop/sort-by-price-low-to-high?search=${encodeURIComponent(q)}`
  },
  {
    id: "musimundo",
    name: "Musimundo",
    pages: ["https://www.musimundo.com/"],
    search: (q) => `https://www.musimundo.com/search?text=${encodeURIComponent(q)}`
  },
  {
    id: "mexx",
    name: "Mexx",
    pages: ["https://www.mexx.com.ar/"],
    search: (q) => `https://www.mexx.com.ar/buscar/?p=${encodeURIComponent(q)}`
  },
  {
    id: "venex",
    name: "Venex",
    pages: ["https://www.venex.com.ar/"],
    search: (q) => `https://www.venex.com.ar/resultado-busqueda.htm?keywords=${encodeURIComponent(q)}`
  },
  {
    id: "fullh4rd",
    name: "Full H4rd",
    pages: ["https://www.fullh4rd.com.ar/"],
    search: (q) => `https://www.fullh4rd.com.ar/cat/search/${encodeURIComponent(q)}`
  },
  {
    id: "hotsale",
    name: "Hot Sale (sitio oficial)",
    pages: ["https://www.hotsale.com.ar/"],
    search: null
  },
  {
    id: "cybermonday",
    name: "CyberMonday (sitio oficial)",
    pages: ["https://www.cybermonday.com.ar/"],
    search: null
  }
];

// Palabras que indican un evento o una oferta en la portada de una tienda.
export const EVENT_KEYWORDS = [
  { key: "hot sale", label: "Hot Sale", re: /hot\s*-?\s*sale/i },
  { key: "cybermonday", label: "CyberMonday", re: /cyber\s*-?\s*monday/i },
  { key: "black friday", label: "Black Friday", re: /black\s*-?\s*friday/i },
  { key: "cyber week", label: "Cyber Week", re: /cyber\s*week/i },
  { key: "dia del padre", label: "Día del Padre", re: /d[ií]a\s+del\s+padre/i },
  { key: "dia del nino", label: "Día del Niño", re: /d[ií]a\s+del\s+ni[ñn]o/i },
  { key: "navidad", label: "Ofertas de Navidad", re: /ofertas?\s+(de\s+)?navidad|navidad\s+gamer/i },
  { key: "gamer week", label: "Semana Gamer", re: /(semana|week)\s+gamer|gamer\s+(week|days)/i },
  { key: "sin interes", label: "Cuotas sin interés", re: /(?<![\d.])(\d{1,2})\s*cuotas\s+sin\s+inter[eé]s/i },
  { key: "liquidacion", label: "Liquidación", re: /liquidaci[oó]n/i },
  { key: "precios locos", label: "Precios locos / Sale", re: /precios?\s+locos|mega\s*sale|super\s*sale/i }
];

// Lo que se sigue de entrada, pensado para jugar GTA 6.
export const DEFAULT_WATCHLIST = [
  { id: "w1", query: "PlayStation 5 Slim", maxPrice: null, minDiscount: 10, exclude: "joystick control funda juego soporte cable" },
  { id: "w2", query: "Xbox Series S", maxPrice: null, minDiscount: 10, exclude: "joystick control funda juego soporte cable" },
  { id: "w3", query: "Xbox Series X", maxPrice: null, minDiscount: 10, exclude: "joystick control funda juego soporte cable" },
  { id: "w4", query: "placa de video RTX 5060 Ti", maxPrice: null, minDiscount: 10, exclude: "notebook pc completa cooler" },
  { id: "w5", query: "placa de video RX 9060 XT", maxPrice: null, minDiscount: 10, exclude: "notebook pc completa cooler" },
  { id: "w6", query: "Ryzen 5 7600", maxPrice: null, minDiscount: 10, exclude: "notebook pc completa combo" },
  { id: "w7", query: "monitor 27 165hz", maxPrice: null, minDiscount: 15, exclude: "soporte brazo" }
];

export const DEFAULT_SETTINGS = {
  intervalMinutes: 60,
  useSharedDb: true, // leer la base compartida de la página (recomendado)
  dbUrl: "https://tomycampeon1-sketch.github.io/radar-ofertas-edge/data/db.json",
  aportar: false, // leer desde esta compu las tiendas que bloquean a GitHub y subir los precios a la base
  githubToken: "",
  aporteCadaHoras: 3,
  enabledStores: STORES.map((s) => s.id),
  notifyEvents: true,
  notifyStoreBanners: true,
  notifyWatchlist: false, // la base compartida ya sigue los productos; activalo para revisar también Mercado Libre desde tu compu
  onlyNewCondition: true,
  minInstallmentsSinInteres: 6,
  mlAccessToken: "",
  daysBeforeEvent: 3
};
