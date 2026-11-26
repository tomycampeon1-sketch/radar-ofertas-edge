// Extension button: opens/closes the panel inside WhatsApp Web.
const WA_URL = "https://web.whatsapp.com/";

async function logToStorage(level, event, data) {
  const entry = { ts: new Date().toISOString(), level, event, run: null, session: "fondo", data };
  const { log = [] } = await chrome.storage.local.get({ log: [] });
  log.push(entry);
  await chrome.storage.local.set({ log: log.slice(-5000) });
}

async function togglePanelIn(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { waas: "togglePanel" });
  } catch (e) {
    // The tab was opened before the extension was installed/reloaded: it has no scripts yet.
    await logToStorage("warn", "fondo:pestana-sin-scripts", { error: String(e && e.message || e) });
    await chrome.tabs.reload(tabId);
    pendingOpen.add(tabId);
  }
}

const pendingOpen = new Set();

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (tab && tab.url && tab.url.startsWith(WA_URL)) return await togglePanelIn(tab.id);
    const [waTab] = await chrome.tabs.query({ url: WA_URL + "*" });
    if (waTab) {
      await chrome.tabs.update(waTab.id, { active: true });
      await chrome.windows.update(waTab.windowId, { focused: true });
      return await togglePanelIn(waTab.id);
    }
    const created = await chrome.tabs.create({ url: WA_URL });
    pendingOpen.add(created.id);
  } catch (e) {
    await logToStorage("error", "fondo:error-boton", { error: String(e && e.stack || e) });
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.waas === "pageReady" && sender.tab && pendingOpen.has(sender.tab.id)) {
    pendingOpen.delete(sender.tab.id);
    chrome.tabs.sendMessage(sender.tab.id, { waas: "togglePanel" }).catch(() => {});
  }
});
