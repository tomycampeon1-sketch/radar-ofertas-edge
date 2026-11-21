import { STORES, DEFAULT_WATCHLIST, DEFAULT_SETTINGS } from "./lib/config.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const BOOLS = ["useSharedDb", "notifyWatchlist", "notifyStoreBanners", "notifyEvents", "onlyNewCondition"];
const NUMS = ["intervalMinutes", "daysBeforeEvent", "minInstallmentsSinInteres"];

function rowHtml(w) {
  return `<tr data-id="${esc(w.id)}">
    <td><input class="q" value="${esc(w.query)}" placeholder="ej: PlayStation 5 Slim"></td>
    <td><input class="max" type="number" min="0" step="1000" value="${w.maxPrice ?? ""}" placeholder="sin tope"></td>
    <td><input class="disc" type="number" min="0" max="90" value="${w.minDiscount ?? 10}"></td>
    <td><input class="ex" value="${esc(w.exclude || "")}" placeholder="joystick funda"></td>
    <td><button class="del" title="Quitar">✕</button></td></tr>`;
}

async function load() {
  const s = await chrome.storage.local.get(["settings", "watchlist"]);
  const settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  const watchlist = s.watchlist || DEFAULT_WATCHLIST;

  $("watch").innerHTML = watchlist.map(rowHtml).join("");
  $("stores").innerHTML = STORES.map(
    (st) => `<label><input type="checkbox" value="${st.id}" ${settings.enabledStores.includes(st.id) ? "checked" : ""}> ${esc(st.name)}</label>`
  ).join("");
  BOOLS.forEach((k) => ($(k).checked = !!settings[k]));
  NUMS.forEach((k) => ($(k).value = settings[k]));
  $("mlAccessToken").value = settings.mlAccessToken || "";
  $("dbUrl").value = settings.dbUrl || DEFAULT_SETTINGS.dbUrl;
}

function collect() {
  const watchlist = [...document.querySelectorAll("#watch tr")]
    .map((tr) => ({
      id: tr.dataset.id,
      query: tr.querySelector(".q").value.trim(),
      maxPrice: Number(tr.querySelector(".max").value) || null,
      minDiscount: Number(tr.querySelector(".disc").value) || 0,
      exclude: tr.querySelector(".ex").value.trim()
    }))
    .filter((w) => w.query);
  const settings = { ...DEFAULT_SETTINGS };
  BOOLS.forEach((k) => (settings[k] = $(k).checked));
  NUMS.forEach((k) => (settings[k] = Number($(k).value) || DEFAULT_SETTINGS[k]));
  settings.enabledStores = [...document.querySelectorAll("#stores input:checked")].map((i) => i.value);
  settings.mlAccessToken = $("mlAccessToken").value.trim();
  settings.dbUrl = /^https:\/\//.test($("dbUrl").value.trim()) ? $("dbUrl").value.trim() : DEFAULT_SETTINGS.dbUrl;
  return { settings, watchlist };
}

let msgTimer = null;
async function save() {
  await chrome.storage.local.set(collect());
  $("msg").textContent = "✓ Guardado";
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => ($("msg").textContent = ""), 2500);
}

$("watch").addEventListener("click", (e) => {
  if (e.target.classList.contains("del")) e.target.closest("tr").remove();
});
$("add").addEventListener("click", () => {
  $("watch").insertAdjacentHTML("beforeend", rowHtml({ id: "w" + Date.now(), query: "", minDiscount: 10 }));
  $("watch").lastElementChild.querySelector(".q").focus();
});
$("save").addEventListener("click", save);
$("test").addEventListener("click", async () => {
  await save();
  clearTimeout(msgTimer);
  $("msg").textContent = "Revisando…";
  const r = await chrome.runtime.sendMessage({ type: "runNow" });
  $("msg").textContent = r && r.error ? `Error: ${r.error}` : `✓ ${r.found} novedad(es)` + (r.errors.length ? ` · con error: ${r.errors.join(" | ")}` : "");
});

load();
