import { STORES, EVENT_KEYWORDS, DEFAULT_WATCHLIST, DEFAULT_SETTINGS } from "./lib/config.js";
import { upcomingEvents, formatDate } from "./lib/events.js";
import { searchMercadoLibre, matchesQuery } from "./lib/ml.js";
import { fetchSharedDb, newAlerts, summarize } from "./lib/shared.js";
import { stepAporte, uploadAportes, testToken } from "./lib/aporte.js";

const ALARM = "radar-check";
const MAX_FEED = 80;
const money = (n) => (n == null ? "?" : "$" + Math.round(n).toLocaleString("es-AR"));

// ---------- almacenamiento ----------
async function getState() {
  const s = await chrome.storage.local.get(["settings", "watchlist", "feed", "watchState", "storeState", "eventState", "lastRun", "lastErrors", "sharedSeen"]);
  return {
    settings: { ...DEFAULT_SETTINGS, ...(s.settings || {}) },
    watchlist: s.watchlist || DEFAULT_WATCHLIST,
    feed: s.feed || [],
    watchState: s.watchState || {},
    storeState: s.storeState || {},
    eventState: s.eventState || {},
    lastRun: s.lastRun || null,
    lastErrors: s.lastErrors || [],
    sharedSeen: s.sharedSeen // undefined = nunca se leyó la base
  };
}

async function schedule() {
  const { settings } = await getState();
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.create(ALARM, { periodInMinutes: Math.max(15, Number(settings.intervalMinutes) || 60), delayInMinutes: 1 });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  const s = await chrome.storage.local.get(["settings", "watchlist"]);
  if (!s.settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  if (!s.watchlist) await chrome.storage.local.set({ watchlist: DEFAULT_WATCHLIST });
  await schedule();
  if (reason === "install") {
    notify("bienvenida", "Radar de Ofertas activado", "Cada hora leo la base de ofertas de tu página y reviso las portadas de las tiendas. Te aviso cuando haya algo nuevo.", "https://tomycampeon1-sketch.github.io/radar-ofertas-edge/");
    runChecks({ silentFirstRun: true });
  }
});

chrome.runtime.onStartup.addListener(schedule);

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === ALARM) runChecks();
  if (a.name === ALARM_APORTE) aporteDesdeCero(false).catch(() => {});
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) schedule();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "runNow") {
    runChecks().then((r) => sendResponse(r)).catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg && msg.type === "testToken") {
    testToken(msg.token).then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
    return true;
  }
  if (msg && msg.type === "aporteNow") {
    aporteDesdeCero(true).then((a) => sendResponse(a || { resultado: "Activá el aporte y cargá la clave primero" })).catch((e) => sendResponse({ ultimoError: String(e.message || e) }));
    return true;
  }
  if (msg && msg.type === "markSeen") {
    chrome.storage.local.get("feed").then(({ feed = [] }) => {
      feed.forEach((f) => (f.seen = true));
      chrome.storage.local.set({ feed }).then(updateBadge).then(() => sendResponse({ ok: true }));
    });
    return true;
  }
});

// ---------- notificaciones ----------
const notifUrls = {};

function notify(id, title, message, url) {
  const nid = `${id}-${Date.now()}`;
  if (url) notifUrls[nid] = url;
  chrome.notifications.create(nid, {
    type: "basic",
    iconUrl: "icons/icon128.png",
    title,
    message,
    priority: 2
  });
}

chrome.notifications.onClicked.addListener(async (nid) => {
  let url = notifUrls[nid];
  if (!url) {
    const { feed = [] } = await chrome.storage.local.get("feed");
    url = (feed.find((f) => f.notifId === nid) || {}).url;
  }
  if (url) chrome.tabs.create({ url });
  chrome.notifications.clear(nid);
});

async function updateBadge() {
  const { feed = [] } = await chrome.storage.local.get("feed");
  const unseen = feed.filter((f) => !f.seen).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#e4002b" });
  await chrome.action.setBadgeText({ text: unseen ? String(Math.min(unseen, 99)) : "" });
}

// ---------- chequeos ----------
let running = null;

async function runChecks(opts = {}) {
  if (running) return running;
  running = doRun(opts).finally(() => (running = null));
  return running;
}

async function doRun({ silentFirstRun = false } = {}) {
  const st = await getState();
  const newEntries = [];
  const errors = [];

  if (st.settings.notifyEvents) newEntries.push(...checkCalendar(st));

  let shared = null;
  let sharedDb = null;
  if (st.settings.useSharedDb) {
    try {
      const db = await fetchSharedDb(st.settings.dbUrl);
      sharedDb = db;
      const firstTime = st.sharedSeen === undefined;
      const { fresh, seenIds } = newAlerts(db, st.sharedSeen);
      st.sharedSeen = seenIds;
      shared = summarize(db);
      // La primera vez no se avisan las ofertas viejas: solo las que aparezcan de ahora en adelante
      if (!firstTime) {
        for (const a of fresh.slice(0, 5)) {
          const prod = db.productos.find((x) => x.id === a.productoId) || {};
          newEntries.push({ kind: "base", store: a.tienda, title: a.titulo, message: a.mensaje, url: a.url, price: a.precio, thumbnail: /^https:\/\//.test(prod.imagen || "") ? prod.imagen : null });
        }
      }
    } catch (e) {
      errors.push(`Base compartida: ${e.message}`);
    }
  }

  if (st.settings.notifyStoreBanners) {
    const stores = STORES.filter((s) => st.settings.enabledStores.includes(s.id));
    for (const store of stores) {
      try {
        newEntries.push(...(await checkStore(store, st)));
      } catch (e) {
        errors.push(`${store.name}: ${e.message}`);
      }
    }
  }

  if (st.settings.notifyWatchlist) {
    for (const w of st.watchlist) {
      try {
        newEntries.push(...(await checkWatch(w, st)));
      } catch (e) {
        errors.push(`"${w.query}": ${e.message}`);
      }
    }
  }

  // Guardar y notificar
  const now = Date.now();
  for (const e of newEntries) {
    e.time = now;
    e.seen = false;
    if (!silentFirstRun || e.kind === "evento") {
      e.notifId = `${e.kind}-${now}-${Math.random().toString(36).slice(2, 7)}`;
      chrome.notifications.create(e.notifId, {
        type: "basic",
        iconUrl: "icons/icon128.png",
        title: e.title,
        message: e.message,
        priority: 2
      });
      if (e.url) notifUrls[e.notifId] = e.url;
    }
  }
  const feed = [...newEntries, ...st.feed].slice(0, MAX_FEED);
  await chrome.storage.local.set({
    feed,
    watchState: st.watchState,
    storeState: st.storeState,
    eventState: st.eventState,
    lastRun: now,
    lastErrors: errors,
    ...(st.sharedSeen ? { sharedSeen: st.sharedSeen } : {}),
    ...(shared ? { shared } : {})
  });
  await updateBadge();
  // Después de los avisos: leer tiendas bloqueadas para GitHub y aportar precios a la base
  if (sharedDb) await maybeAporte(sharedDb, st.settings);
  return { found: newEntries.length, errors };
}

// ---------- aporte de precios a la base compartida ----------
const ALARM_APORTE = "aporte-sigue";

async function maybeAporte(db, settings, force = false) {
  if (!settings.aportar || !settings.githubToken || !db) return null;
  const { aporte = {} } = await chrome.storage.local.get("aporte");
  const enCurso = !!(aporte.state && aporte.state.cola && aporte.state.cursor < aporte.state.cola.length);
  const cada = (Number(settings.aporteCadaHoras) || 3) * 3600000;
  if (!force && !enCurso && aporte.ultimoCiclo && Date.now() - aporte.ultimoCiclo < cada) return null;
  const state = enCurso && !force ? aporte.state : { cursor: 0, cola: null, tiendas: (aporte.state || {}).tiendas || {} };
  try {
    const r = await stepAporte(db, state);
    aporte.state = r.state;
    aporte.ultimoError = null;
    if (r.terminado) {
      aporte.ultimoCiclo = Date.now();
      const up = await uploadAportes(settings.githubToken, r.state);
      if (up.subido) aporte.ultimaSubida = Date.now();
      aporte.resultado = up.subido ? `Subí precios de ${up.tiendas} tienda(s)` : up.motivo;
    } else {
      await chrome.alarms.create(ALARM_APORTE, { delayInMinutes: 1 }); // seguir con las tiendas que faltan
    }
  } catch (e) {
    aporte.ultimoError = e.message;
  }
  await chrome.storage.local.set({ aporte });
  return aporte;
}

async function aporteDesdeCero(force) {
  const { settings: saved } = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...(saved || {}) };
  const db = await fetchSharedDb(settings.dbUrl);
  return maybeAporte(db, settings, force);
}

function checkCalendar(st) {
  const out = [];
  const days = Number(st.settings.daysBeforeEvent) || 3;
  for (const ev of upcomingEvents(new Date(), 8)) {
    const flag = st.eventState[ev.id] || {};
    if (ev.active && !flag.started) {
      flag.started = flag.soon = true;
      out.push({ kind: "evento", title: `🔥 Empezó: ${ev.name}`, message: `Fecha estimada: ${formatDate(ev.start)} al ${formatDate(ev.end)}. Revisá las tiendas.`, url: ev.url });
    } else if (!ev.active && ev.daysUntil <= days && ev.daysUntil >= 0 && !flag.soon) {
      flag.soon = true;
      out.push({ kind: "evento", title: `📅 Se viene ${ev.name}`, message: `Empieza en ${ev.daysUntil} día(s), alrededor del ${formatDate(ev.start)} (fecha estimada).`, url: ev.url });
    }
    st.eventState[ev.id] = flag;
  }
  return out;
}

async function checkStore(store, st) {
  const out = [];
  const prev = st.storeState[store.id] || { keywords: [], cuotas: 0 };
  const found = new Set();
  let maxCuotas = 0;

  for (const url of store.pages) {
    const res = await fetch(url, { headers: { Accept: "text/html", "Accept-Language": "es-AR,es;q=0.9" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Mirar el texto visible y también los alt/title de los banners
    const text = (html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ") +
      " " + [...html.matchAll(/(?:alt|title)="([^"]{3,200})"/gi)].map((m) => m[1]).join(" "))
      .replace(/<[^>]+>/g, " ");
    for (const kw of EVENT_KEYWORDS) {
      const m = text.match(kw.re);
      if (m) {
        found.add(kw.key);
        if (kw.key === "sin interes") {
          for (const mm of text.matchAll(new RegExp(kw.re, "gi"))) maxCuotas = Math.max(maxCuotas, Number(mm[1]) || 0);
        }
      }
    }
  }

  const appeared = [...found].filter((k) => !prev.keywords.includes(k) && k !== "sin interes");
  if (appeared.length) {
    const labels = appeared.map((k) => EVENT_KEYWORDS.find((x) => x.key === k).label);
    out.push({ kind: "tienda", store: store.name, title: `🛒 ${store.name}: ${labels.join(", ")}`, message: `Apareció en la portada de ${store.name}. Puede haber un evento de ofertas activo.`, url: store.pages[0] });
  }
  const minCuotas = Number(st.settings.minInstallmentsSinInteres) || 6;
  if (maxCuotas >= minCuotas && maxCuotas > (prev.cuotas || 0)) {
    out.push({ kind: "cuotas", store: store.name, title: `💳 ${store.name}: ${maxCuotas} cuotas sin interés`, message: `${store.name} está mostrando hasta ${maxCuotas} cuotas sin interés.`, url: store.pages[0] });
  }
  st.storeState[store.id] = { keywords: [...found], cuotas: maxCuotas, checked: Date.now() };
  return out;
}

async function checkWatch(w, st) {
  const out = [];
  const { items, source } = await searchMercadoLibre(w.query, { token: st.settings.mlAccessToken, onlyNew: st.settings.onlyNewCondition });
  const relevant = items.filter((i) => matchesQuery(i.title, w.query, w.exclude));
  const ws = st.watchState[w.id] || { best: null, notified: {} };
  const minCuotas = Number(st.settings.minInstallmentsSinInteres) || 6;

  const sorted = relevant.sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  ws.source = source;
  ws.count = relevant.length;
  ws.checked = Date.now();
  ws.cheapest = cheapest ? { title: cheapest.title, price: cheapest.price, url: cheapest.url } : null;

  for (const it of sorted.slice(0, 15)) {
    const discount = it.originalPrice ? Math.round((1 - it.price / it.originalPrice) * 100) : 0;
    const reasons = [];
    if (w.maxPrice && it.price <= w.maxPrice) reasons.push(`por debajo de tu tope de ${money(w.maxPrice)}`);
    if (discount >= (Number(w.minDiscount) || 999)) reasons.push(`${discount}% OFF (antes ${money(it.originalPrice)})`);
    if (it.installments && it.installments.sinInteres && it.installments.quantity >= minCuotas) reasons.push(`${it.installments.quantity} cuotas sin interés`);
    if (ws.best && it.price < ws.best * 0.95) reasons.push(`bajó de ${money(ws.best)}`);
    if (!reasons.length) continue;

    const key = `${it.id}`;
    const last = ws.notified[key];
    if (last && last <= it.price) continue; // ya avisado a este precio o menor
    ws.notified[key] = it.price;
    out.push({
      kind: "producto",
      store: it.store,
      query: w.query,
      title: `💰 ${w.query}: ${money(it.price)}`,
      message: `${it.title.slice(0, 80)}. ${reasons.join(" · ")}`,
      url: it.url,
      price: it.price,
      thumbnail: it.thumbnail
    });
  }

  if (cheapest && (ws.best == null || cheapest.price < ws.best)) ws.best = cheapest.price;
  // Limitar memoria
  const keys = Object.keys(ws.notified);
  if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete ws.notified[k]);
  st.watchState[w.id] = ws;
  return out.slice(0, 3); // máximo 3 avisos por producto por chequeo
}
