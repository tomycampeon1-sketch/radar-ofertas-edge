// الجسر (العالم المعزول للإضافة):
// - يحفظ السجل في chrome.storage.local (يبقى بعد إعادة التحميل ويظهر في صفحة السجل)؛
// - يمرر للصفحة أمر فتح اللوحة (زر الإضافة) ويخبر الخلفية.
// إذا أُعيد تحميل الإضافة والصفحة مفتوحة، يفقد هذا السكربت الاتصال بالإضافة
// ("Extension context invalidated")، فيتوقف بهدوء بدل أن يرمي أخطاء.
(() => {
  const MAX_ENTRIES = 5000;
  let queue = [];
  let timer = null;
  let writing = Promise.resolve();
  let dead = false;

  const alive = () => {
    if (dead) return false;
    try { if (chrome.runtime && chrome.runtime.id) return true; } catch (e) { /* السياق انتهى */ }
    dead = true;
    queue = [];
    if (timer) { clearTimeout(timer); timer = null; }
    return false;
  };

  // يستدعي واجهات chrome بأمان: لا يرمي أبداً، ويستدعي done عند الانتهاء أو الفشل.
  function safe(fn, done) {
    if (!alive()) { if (done) done(); return; }
    try { fn(); } catch (e) { dead = true; if (done) done(); }
  }

  function flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    const batch = queue;
    queue = [];
    if (!batch.length || !alive()) return writing;
    writing = writing.then(() => new Promise((resolve) => {
      safe(() => chrome.storage.local.get({ log: [] }, (res) => {
        if (chrome.runtime.lastError || !res) return resolve();
        let log = (res.log || []).concat(batch);
        if (log.length > MAX_ENTRIES) log = log.slice(log.length - MAX_ENTRIES);
        safe(() => chrome.storage.local.set({ log }, () => resolve()), resolve);
      }), resolve);
    }));
    return writing;
  }

  const send = (msg) => safe(() => { const p = chrome.runtime.sendMessage(msg); if (p && p.catch) p.catch(() => {}); });

  window.addEventListener("message", (ev) => {
    if (ev.source !== window) return;
    const d = ev.data;
    if (!d || typeof d !== "object" || !d.__waas) return;
    if (d.__waas === "log" && d.entry) {
      if (!alive()) return;
      queue.push(d.entry);
      if (!timer) timer = setTimeout(flush, 400);
    } else if (d.__waas === "getLog") {
      const reply = (log) => window.postMessage({ __waas: "logResponse", reqId: d.reqId, log }, location.origin);
      flush().then(() => {
        let replied = false;
        const once = (log) => { if (!replied) { replied = true; reply(log); } };
        safe(() => chrome.storage.local.get({ log: [] }, (res) => once((res && res.log) || [])), () => once([]));
      });
    } else if (d.__waas === "uiReady") {
      send({ waas: "pageReady" });
    }
  });

  safe(() => chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.waas === "togglePanel") window.postMessage({ __waas: "togglePanel" }, location.origin);
  }));

  window.addEventListener("pagehide", () => { flush(); });
})();
