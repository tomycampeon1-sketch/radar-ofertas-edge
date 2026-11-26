// Log page: shows the saved log, lets you download, copy or clear it.
const T = {
  ar: { title: "ملصقات بصوت: السجل", intro: "إذا واجهت مشكلة، حمّل السجل وأرسله لمن يساعدك. أرقام الهواتف تظهر مخفية.",
        loading: "جارِ التحميل…", dl: "تحميل السجل (.json)", copy: "نسخ", copied: "تم النسخ", errors: "الأخطاء فقط", all: "عرض الكل",
        clear: "مسح السجل", confirm: "مسح السجل بالكامل؟", sum: (n, e, w, s) => `${n} سطر · ${e} خطأ · ${w} تحذير · ${s} جلسة` },
  es: { title: "Stickers con Sonido: registro", intro: "Si algo falla, descargá el registro y mandáselo a quien te esté ayudando. Los números de teléfono aparecen ocultos.",
        loading: "Cargando…", dl: "Descargar registro (.json)", copy: "Copiar", copied: "Copiado", errors: "Solo errores", all: "Ver todo",
        clear: "Borrar registro", confirm: "¿Borrar todo el registro?", sum: (n, e, w, s) => `${n} líneas · ${e} errores · ${w} avisos · ${s} sesiones` },
  en: { title: "Audio Stickers: log", intro: "If something goes wrong, download the log and send it to whoever is helping you. Phone numbers are hidden.",
        loading: "Loading…", dl: "Download log (.json)", copy: "Copy", copied: "Copied", errors: "Errors only", all: "Show all",
        clear: "Clear log", confirm: "Clear the whole log?", sum: (n, e, w, s) => `${n} entries · ${e} errors · ${w} warnings · ${s} sessions` },
};
const $ = (id) => document.getElementById(id);
let lang = (() => { try { const v = localStorage.getItem("waas-lang"); if (T[v]) return v; } catch (e) { /* no storage */ } const nav = navigator.language || ""; return /^ar\b/i.test(nav) ? "ar" : /^en\b/i.test(nav) ? "en" : "es"; })();
let S = T[lang];
let onlyErrors = false;
let entries = [];
function applyLang() {
  S = T[lang];
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  $("t").textContent = $("h").textContent = S.title;
  $("intro").textContent = S.intro;
  $("dl").textContent = S.dl; $("copy").textContent = S.copy; $("clear").textContent = S.clear;
  $("errors").textContent = onlyErrors ? S.all : S.errors;
  for (const code of ["es", "en", "ar"]) $("lang-" + code).classList.toggle("on", code === lang);
}
for (const code of ["es", "en", "ar"]) $("lang-" + code).addEventListener("click", () => {
  if (code === lang) return;
  lang = code;
  try { localStorage.setItem("waas-lang", lang); } catch (e) { /* no storage */ }
  applyLang();
  render();
});
applyLang();
$("summary").textContent = S.loading;

function render() {
  const box = $("log");
  box.textContent = "";
  const list = (onlyErrors ? entries.filter((e) => e.level !== "info") : entries).slice(-2000);
  for (const e of list) {
    const div = document.createElement("div");
    div.className = e.level === "error" ? "e" : e.level === "warn" ? "w" : "";
    div.textContent = `${e.ts.replace("T", " ").slice(0, 19)} [${e.level}] ${e.event}${e.data != null ? " " + JSON.stringify(e.data) : ""}`;
    box.append(div);
  }
  box.scrollTop = box.scrollHeight;
  const errs = entries.filter((e) => e.level === "error").length;
  const warns = entries.filter((e) => e.level === "warn").length;
  const sessions = new Set(entries.map((e) => e.session)).size;
  $("summary").textContent = S.sum(entries.length, errs, warns, sessions);
}

function load() {
  chrome.storage.local.get({ log: [] }, (res) => { entries = res.log || []; render(); });
}

$("dl").addEventListener("click", () => {
  const content = JSON.stringify({ exported: new Date().toISOString(), version: chrome.runtime.getManifest().version, ua: navigator.userAgent, entries }, null, 1);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  a.download = "audio-stickers-log-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
  a.click();
});
$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText(JSON.stringify(entries, null, 1));
  $("copy").textContent = S.copied;
  setTimeout(() => ($("copy").textContent = S.copy), 1500);
});
$("errors").addEventListener("click", () => {
  onlyErrors = !onlyErrors;
  $("errors").textContent = onlyErrors ? S.all : S.errors;
  render();
});
$("clear").addEventListener("click", () => {
  if (!confirm(S.confirm)) return;
  chrome.storage.local.set({ log: [] }, load);
});
chrome.storage.onChanged.addListener((changes) => { if (changes.log) { entries = changes.log.newValue || []; render(); } });
load();
