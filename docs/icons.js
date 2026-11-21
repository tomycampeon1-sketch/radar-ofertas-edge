// Ilustraciones propias (sin fotos de las tiendas) para cuando un producto todavía no tiene imagen.
window.RADAR_ICONS = (function () {
  const svg = (body) => `<svg viewBox="0 0 120 90" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  return {
    ps5: svg(`<path d="M46 12c-8 4-12 18-12 33s4 29 12 33l6-3V15z"/><path d="M74 12c8 4 12 18 12 33s-4 29-12 33l-6-3V15z"/><rect x="52" y="15" width="16" height="60" rx="3"/><path d="M57 70h6"/>`),
    xbox: svg(`<rect x="38" y="10" width="44" height="70" rx="5"/><circle cx="60" cy="24" r="7"/><path d="M45 60h30M45 66h30M45 72h30"/><circle cx="60" cy="24" r="2" fill="currentColor"/>`),
    gpu: svg(`<rect x="10" y="22" width="100" height="40" rx="5"/><circle cx="38" cy="42" r="13"/><circle cx="82" cy="42" r="13"/><path d="M38 29v26M25 42h26M82 29v26M69 42h26"/><path d="M18 62v10h44V62"/>`),
    cpu: svg(`<rect x="32" y="17" width="56" height="56" rx="4"/><rect x="44" y="29" width="32" height="32" rx="2"/><path d="M42 9v8M54 9v8M66 9v8M78 9v8M42 73v8M54 73v8M66 73v8M78 73v8M24 27h8M24 39h8M24 51h8M24 63h8M88 27h8M88 39h8M88 51h8M88 63h8"/>`),
    motherboard: svg(`<rect x="22" y="8" width="76" height="74" rx="4"/><rect x="34" y="20" width="24" height="24" rx="2"/><path d="M68 20v24M74 20v24M80 20v24M34 56h52M34 64h52M34 72h30"/>`),
    ram: svg(`<rect x="8" y="30" width="104" height="26" rx="3"/><path d="M20 38h12v10H20zM40 38h12v10H40zM68 38h12v10H68zM88 38h12v10H88z"/><path d="M14 56v6M24 56v6M34 56v6M44 56v6M54 56v6M70 56v6M80 56v6M90 56v6M100 56v6"/>`),
    ssd: svg(`<rect x="10" y="32" width="100" height="26" rx="3"/><rect x="22" y="38" width="22" height="14" rx="1"/><rect x="50" y="38" width="22" height="14" rx="1"/><path d="M98 38v14M110 40h-4"/>`),
    fuente: svg(`<rect x="16" y="18" width="88" height="56" rx="4"/><circle cx="50" cy="46" r="18"/><path d="M50 28v36M32 46h36M38 34l24 24M62 34L38 58"/><path d="M82 34h12M82 44h12M82 54h12"/>`),
    gabinete: svg(`<rect x="34" y="6" width="52" height="78" rx="4"/><circle cx="60" cy="30" r="12"/><circle cx="60" cy="60" r="12"/><path d="M60 18v24M48 30h24M60 48v24M48 60h24"/><path d="M42 12h10"/>`)
  };
})();

window.RADAR_ICON_FOR = function (p) {
  const id = p.id || "";
  if (id.startsWith("ps5")) return "ps5";
  if (id.startsWith("xbox")) return "xbox";
  const map = { procesador: "cpu", "procesador-barato": "cpu", "placa de video": "gpu", motherboard: "motherboard", memoria: "ram", disco: "ssd", fuente: "fuente", gabinete: "gabinete" };
  return map[p.pieza] || "cpu";
};
