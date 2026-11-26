// Panel UI (Shadow DOM), opened from the extension button. Arabic or English, chosen by src/lang.js.
// Three tabs: video with its own sound, image + sound, GIF or video + another sound.
// No innerHTML (WhatsApp Web uses Trusted Types): every element and icon is built with createElement.
(() => {
  const WAAS = (window.WAAS = window.WAAS || {});
  const log = (lvl, ev, data) => WAAS.log(lvl, ev, data);
  const FRAME = 1 / 30;
  const MIN_LEN = 0.3;
  const DEFAULT_LEN = 10;

  // ------------------------------------------------------------ texts
  const STR = {
    ar: {
      dir: "rtl", title: "ملصقات بصوت", close: "إغلاق", sec: "ث", min: "د",
      tabVideo: "فيديو", tabImage: "صورة", tabGif: "GIF",
      stepVideo: "اختر الفيديو", stepImage: "اختر الصورة", stepSound: "اختر الصوت", stepAnim: "اختر الحركة", stepFinal: "اصنع وأرسل",
      pickVideo: "اختر فيديو", pickVideoHint: "أو اسحبه وأفلته هنا",
      pickImage: "اختر صورة", pickImageHint: "أو اسحبها وأفلتها هنا",
      pickSound: "اختر ملف الصوت", pickSoundHint: "MP3، M4A، WAV… أو فيديو",
      pickGif: "اختر GIF أو فيديو", pickGifHint: "صوت الفيديو لن يُستخدم",
      change: "تغيير", reading: "جارِ القراءة…", silent: " · يبدو بلا صوت",
      play: "تشغيل", stop: "إيقاف", from: "من", to: "إلى", startTitle: "البداية", endTitle: "النهاية",
      videoHint: "اسحب الطرفين لتحديد الجزء. الأفضل 10 ثوانٍ أو أقل.",
      animNote: "صورة متحركة: سنستخدم أول إطار فقط. لتتحرك استخدم تبويب GIF.",
      staticImage: "هذه صورة ثابتة. استخدم تبويب «صورة».",
      shape: "شكل الملصق", fit: "كامل مع حواف شفافة", crop: "قص لملء المربع",
      quality: "الجودة", qualityHint: "تُختار تلقائياً. لاختيارها بنفسك اعرض الخيارات واختر مربعاً (الأرقام بالكيلوبايت).",
      showOptions: "اعرض الخيارات", staleGrid: "تغيّر شيء: سنختار الجودة تلقائياً.", recommended: "★ = المقترح",
      notAvailable: "غير متاح", overLimit: "أكبر من 1MB", lowerQuality: " بجودة أقل",
      chosen: (side, fps, size) => `المختار: ${side} بكسل · ${fps} إطار/ث · ≈ ${size}`, noneFits: "لا يوجد خيار مناسب: اختر جزءاً أقصر.",
      syncLabel: "تأخير الصورة (ملّي ثانية، اتركه 0)", stillLabel: "إرسال كصورة ثابتة (تجريبي)",
      packPh: "مثلاً: ملصقاتي", authorPh: "اسمك", pack: "اسم الحزمة", author: "المؤلف", whenSending: "عند الإرسال", more: "خيارات إضافية",
      create: "اصنع الملصق", created: "تم صنع الملصق", recreate: "اصنع الملصق من جديد", cancel: "إلغاء",
      previewAlt: "معاينة الملصق", previewTitle: "اضغط للتشغيل مع الصوت",
      destOpen: "إرسال للمحادثة المفتوحة", destOpenFwd: "المحادثة المفتوحة ثم إعادة التوجيه", destSelf: "حفظ في محادثتي ثم إعادة التوجيه",
      send: "إرسال", download: "تحميل الملفات", staleResult: "غيّرت شيئاً بعد الصنع. اصنع الملصق من جديد.",
      ready: "الملصق جاهز", sent: "تم الإرسال", sentFwd: "تم. اختر المحادثات من نافذة إعادة التوجيه.",
      fitIndep: "كل واحد بمدته", fitRepeat: "كرّر الحركة حتى ينتهي الصوت", fitFreeze: "ثبّت آخر إطار حتى ينتهي الصوت",
      diffLen: "المدة مختلفة:", playTogether: "جرّب معاً",
      lenSame: (a) => `المدة: ${a}`, lenDiff: (v, a) => `الحركة ${v} · الصوت ${a}`,
      log: "السجل", save: "حفظ", saveTitle: "حفظ السجل لإرساله عند وجود مشكلة",
      error: "حدث خطأ: ", aborted: "تم الإلغاء",
    },
    en: {
      dir: "ltr", title: "Audio Stickers", close: "Close", sec: "s", min: "min",
      tabVideo: "Video", tabImage: "Image", tabGif: "GIF",
      stepVideo: "Choose a video", stepImage: "Choose an image", stepSound: "Choose a sound", stepAnim: "Choose an animation", stepFinal: "Create and send",
      pickVideo: "Choose a video", pickVideoHint: "or drag and drop it here",
      pickImage: "Choose an image", pickImageHint: "or drag and drop it here",
      pickSound: "Choose a sound file", pickSoundHint: "MP3, M4A, WAV… or a video",
      pickGif: "Choose a GIF or video", pickGifHint: "The video's own sound is not used",
      change: "Change", reading: "Reading…", silent: " · seems silent",
      play: "Play", stop: "Stop", from: "From", to: "to", startTitle: "Start", endTitle: "End",
      videoHint: "Drag the two ends to choose the part. 10 seconds or less works best.",
      animNote: "Animated image: only the first frame is used here. Use the GIF tab to keep it moving.",
      staticImage: "This is a still image. Use the Image tab.",
      shape: "Sticker shape", fit: "Whole, transparent edges", crop: "Crop to fill",
      quality: "Quality", qualityHint: "Picked automatically. To choose it yourself, show the options and pick a cell (sizes in KB).",
      showOptions: "Show options", staleGrid: "Something changed: quality will be picked automatically.", recommended: "★ = recommended",
      notAvailable: "Not available", overLimit: "Over 1MB", lowerQuality: " at lower quality",
      chosen: (side, fps, size) => `Chosen: ${side} px · ${fps} fps · ≈ ${size}`, noneFits: "Nothing fits: choose a shorter part.",
      syncLabel: "Picture delay (ms, leave at 0)", stillLabel: "Send as a still image (experimental)",
      packPh: "e.g. My stickers", authorPh: "Your name", pack: "Pack name", author: "Author", whenSending: "When sending", more: "More options",
      create: "Create sticker", created: "Sticker created", recreate: "Create again", cancel: "Cancel",
      previewAlt: "Sticker preview", previewTitle: "Click to play with sound",
      destOpen: "Send to the open chat", destOpenFwd: "Open chat, then forward", destSelf: "Save to my own chat, then forward",
      send: "Send", download: "Download files", staleResult: "You changed something after creating. Create the sticker again.",
      ready: "Sticker ready", sent: "Sent", sentFwd: "Done. Pick the chats in the forward window.",
      fitIndep: "Each keeps its own length", fitRepeat: "Repeat the animation until the sound ends", fitFreeze: "Hold the last frame until the sound ends",
      diffLen: "Different lengths:", playTogether: "Play together",
      lenSame: (a) => `Length: ${a}`, lenDiff: (v, a) => `Animation ${v} · sound ${a}`,
      log: "Log", save: "Save", saveTitle: "Save the log to send it if something goes wrong",
      error: "Error: ", aborted: "Cancelled",
    },
    es: {
      dir: "ltr", title: "Stickers con Sonido", close: "Cerrar", sec: "s", min: "min",
      tabVideo: "Video", tabImage: "Imagen", tabGif: "GIF",
      stepVideo: "Elegí un video", stepImage: "Elegí una imagen", stepSound: "Elegí un sonido", stepAnim: "Elegí una animación", stepFinal: "Crear y enviar",
      pickVideo: "Elegir video", pickVideoHint: "o arrastralo y soltalo acá",
      pickImage: "Elegir imagen", pickImageHint: "o arrastrala y soltala acá",
      pickSound: "Elegir archivo de sonido", pickSoundHint: "MP3, M4A, WAV… o un video",
      pickGif: "Elegir GIF o video", pickGifHint: "No se usa el sonido propio del video",
      change: "Cambiar", reading: "Leyendo…", silent: " · parece que no tiene sonido",
      play: "Reproducir", stop: "Detener", from: "Desde", to: "hasta", startTitle: "Inicio", endTitle: "Final",
      videoHint: "Arrastrá los dos extremos para elegir la parte. Lo mejor es 10 segundos o menos.",
      animNote: "Imagen animada: acá se usa solo el primer cuadro. Para que se mueva, usá la pestaña GIF.",
      staticImage: "Es una imagen fija. Usá la pestaña Imagen.",
      shape: "Forma del sticker", fit: "Completa, con bordes transparentes", crop: "Recortar para llenar",
      quality: "Calidad", qualityHint: "Se elige sola. Para elegirla vos, mostrá las opciones y tocá una celda (tamaños en KB).",
      showOptions: "Mostrar opciones", staleGrid: "Cambió algo: la calidad se va a elegir sola.", recommended: "★ = recomendada",
      notAvailable: "No disponible", overLimit: "Más de 1 MB", lowerQuality: " con menos calidad",
      chosen: (side, fps, size) => `Elegida: ${side} px · ${fps} cps · ≈ ${size}`, noneFits: "No entra en 1 MB: elegí una parte más corta.",
      syncLabel: "Retraso de la imagen (ms, dejalo en 0)", stillLabel: "Enviar como imagen fija (experimental)",
      packPh: "ej.: Mis stickers", authorPh: "Tu nombre", pack: "Nombre del paquete", author: "Autor", whenSending: "Al enviar", more: "Más opciones",
      create: "Crear sticker", created: "Sticker creado", recreate: "Crear de nuevo", cancel: "Cancelar",
      previewAlt: "Vista previa del sticker", previewTitle: "Tocá para reproducir con sonido",
      destOpen: "Enviar al chat abierto", destOpenFwd: "Chat abierto y después reenviar", destSelf: "Guardar en mi propio chat y después reenviar",
      send: "Enviar", download: "Descargar archivos", staleResult: "Cambiaste algo después de crearlo. Creá el sticker de nuevo.",
      ready: "Sticker listo", sent: "Enviado", sentFwd: "Listo. Elegí los chats en la ventana de reenviar.",
      fitIndep: "Cada uno con su duración", fitRepeat: "Repetir la animación hasta que termine el sonido", fitFreeze: "Dejar quieto el último cuadro hasta que termine el sonido",
      diffLen: "Duraciones distintas:", playTogether: "Probar juntos",
      lenSame: (a) => `Duración: ${a}`, lenDiff: (v, a) => `Animación ${v} · sonido ${a}`,
      log: "Registro", save: "Guardar", saveTitle: "Guardar el registro para mandarlo si algo falla",
      error: "Error: ", aborted: "Cancelado",
    },
  };
  // Language: the one the user picked last, otherwise the browser's language.
  const LANG_KEY = "waas-lang";
  const pickLang = () => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(LANG_KEY)); } catch (e) { /* no storage */ }
    if (STR[saved]) return saved;
    const nav = navigator.language || "";
    return /^ar\b/i.test(nav) ? "ar" : /^en\b/i.test(nav) ? "en" : "es";
  };
  let LANG = pickLang();
  let L = STR[LANG];

  // Engine messages (written in Spanish) -> [Arabic, English, Spanish].
  const TR = [
    [/^Leyendo cuadros del GIF (\d+)\/(\d+)/, "قراءة الـGIF… $1 من $2", "Reading GIF… $1 of $2", "Leyendo el GIF… $1 de $2"],
    [/^Leyendo cuadros (\d+)\/(\d+)/, "قراءة الفيديو… $1 من $2", "Reading video… $1 of $2", "Leyendo el video… $1 de $2"],
    [/^Codificando \((\d+) px, (\d+) fps, calidad (\d+)\) (\d+)\/(\d+)/, "صنع الملصق… $4 من $5", "Making sticker… $4 of $5", "Creando el sticker… $4 de $5"],
    [/^Leyendo la imagen/, "قراءة الصورة…", "Reading image…", "Leyendo la imagen…"],
    [/^Calculando opciones/, "اختيار أفضل جودة…", "Picking the best quality…", "Eligiendo la mejor calidad…"],
    [/^Opciones listas/, "جاهز", "Ready", "Listo"],
    [/^Extrayendo audio|^Codificando audio/, "تجهيز الصوت…", "Preparing sound…", "Preparando el sonido…"],
    [/^Listo$/, "جاهز", "Ready", "Listo"],
    [/^Buscando chat/, "البحث عن المحادثة…", "Finding the chat…", "Buscando el chat…"],
    [/^Subiendo audio/, "رفع الصوت…", "Uploading sound…", "Subiendo el sonido…"],
    [/^Enviando sticker/, "إرسال الملصق…", "Sending sticker…", "Enviando el sticker…"],
    [/^Esperando confirmación/, "انتظار واتساب…", "Waiting for WhatsApp…", "Esperando a WhatsApp…"],
    [/^Abriendo Reenviar/, "فتح إعادة التوجيه…", "Opening forward…", "Abriendo Reenviar…"],
    [/Abre primero un chat/, "افتح محادثة في واتساب أولاً.", "Open a chat in WhatsApp first.", "Abrí primero un chat en WhatsApp."],
    [/No se encontró tu chat propio/, "لم نجد محادثتك الشخصية.", "Couldn't find your own chat.", "No encontré tu chat propio."],
    [/No cabe en 1 MB|Ninguna combinación cabe/, "الملصق كبير جداً. اختر جزءاً أقصر.", "The sticker is too big. Choose a shorter part.", "El sticker es muy grande. Elegí una parte más corta."],
    [/el audio no cabe|El audio pesa/, "الصوت طويل جداً. اختر جزءاً أقصر.", "The sound is too long. Choose a shorter part.", "El sonido es muy largo. Elegí una parte más corta."],
    [/El navegador no pudo leer el video/, "لم نستطع قراءة الفيديو. جرّب ملف MP4.", "Couldn't read the video. Try an MP4 file.", "No pude leer el video. Probá con un MP4."],
    [/no tiene imagen/, "هذا الملف بلا صورة.", "This file has no picture.", "Ese archivo no tiene imagen."],
    [/No se pudo leer el audio/, "لم نستطع قراءة الصوت.", "Couldn't read the sound.", "No pude leer el sonido."],
    [/El audio dura/, "بداية الصوت بعد نهاية الملف.", "The sound starts after the file ends.", "El sonido empieza después de que termina el archivo."],
    [/no pudo leer la imagen|no puede leer imágenes/, "لم نستطع قراءة الصورة. جرّب PNG أو JPG.", "Couldn't read the image. Try PNG or JPG.", "No pude leer la imagen. Probá con PNG o JPG."],
    [/ImageDecoder|WebCodecs|generar WebP|codificar Opus|requestVideoFrameCallback/, "متصفحك لا يدعم هذا. حدّث Chrome أو Edge.", "Your browser can't do this. Update Chrome or Edge.", "Tu navegador no puede hacer esto. Actualizá Chrome o Edge."],
    [/Tiempo agotado|se detuvo|no entregó cuadros/, "انتهت المهلة. حاول مرة أخرى.", "Timed out. Try again.", "Se agotó el tiempo. Probá de nuevo."],
    [/duración del audio cambió|Primero calcula/, "تغيّر شيء. اضغط «اصنع الملصق» مرة أخرى.", "Something changed. Press Create sticker again.", "Cambió algo. Tocá «Crear sticker» de nuevo."],
    [/WhatsApp no (pudo|considera)|estado de error/, "واتساب رفض الإرسال. حاول بعد قليل.", "WhatsApp refused to send. Try again shortly.", "WhatsApp no aceptó el envío. Probá en un rato."],
    [/propio número|Módulo .* no disponible|cargando el módulo/, "أعد تحميل صفحة واتساب ثم حاول.", "Reload the WhatsApp page and try again.", "Recargá la página de WhatsApp y probá de nuevo."],
  ];
  const tr = (msg) => {
    const own = LANG === "ar" ? /[؀-ۿ]/ : LANG === "es" ? /[áéíóúñ¿¡]|\b(el|la|los|las|de|del|no|un|una)\b/i : null; // los mensajes del motor ya están en español
    const s = String(msg || "");
    for (const row of TR) {
      const m = s.match(row[0]);
      if (m) return row[LANG === "ar" ? 1 : LANG === "es" ? 3 : 2].replace(/\$(\d)/g, (_, i) => m[+i] || "");
    }
    if (s.startsWith("@")) return s.slice(1); // our own already-translated text
    return own && own.test(s) ? s : L.error + s;
  };
  const trErr = (e) => (e && e.name === "AbortError" ? L.aborted : tr(e && e.message));

  // ------------------------------------------------------------ SVG icons
  const ICONS = {
    // Same idea as icons/icon.svg: a tilted sticker with a waveform on it.
    logo: [["rect", { x: 3, y: 3, width: 18, height: 18, rx: 5.5, transform: "rotate(-9 12 12)", fill: "currentColor", stroke: "none" }],
      ["path", { d: "M8 11v2.6M10.7 8.8v6.9M13.4 10v4.4M16 11.3v1.9", transform: "rotate(-9 12 12)", stroke: "#00a884", "stroke-width": 2.3 }]],
    x: [["path", { d: "M18 6 6 18M6 6l12 12" }]],
    video: [["rect", { x: 2, y: 5, width: 15, height: 14, rx: 3 }], ["path", { d: "m17 10 5-3v10l-5-3" }]],
    image: [["rect", { x: 3, y: 3, width: 18, height: 18, rx: 3 }], ["circle", { cx: 9, cy: 9, r: 2 }], ["path", { d: "m21 15-5-5L5 21" }]],
    gif: [["rect", { x: 2, y: 5, width: 20, height: 14, rx: 3 }], ["path", { d: "M10 10H8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h2v-2H9M13 10v4M16 14v-4h2.5M16 12h2" }]],
    music: [["path", { d: "M9 18V5l12-2v13" }], ["circle", { cx: 6, cy: 18, r: 3 }], ["circle", { cx: 18, cy: 16, r: 3 }]],
    upload: [["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" }]],
    play: [["path", { d: "M7 4v16l13-8z", fill: "currentColor" }]],
    stop: [["rect", { x: 6, y: 6, width: 12, height: 12, rx: 2, fill: "currentColor" }]],
    sparkle: [["path", { d: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" }]],
    send: [["path", { d: "M22 2 11 13M22 2l-7 20-4-9-9-4z" }]],
    download: [["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" }]],
    check: [["path", { d: "M20 6 9 17l-5-5" }]],
    refresh: [["path", { d: "M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5" }]],
    sliders: [["path", { d: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4" }]],
    alert: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 8v4M12 16h.01" }]],
    file: [["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8" }]],
    chevron: [["path", { d: "m15 18-6-6 6-6" }]],
  };
  const SVGNS = "http://www.w3.org/2000/svg";
  function icon(name, size = 18) {
    const svg = document.createElementNS(SVGNS, "svg");
    for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: size, height: size, fill: "none", stroke: "currentColor",
      "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "ic" })) svg.setAttribute(k, v);
    for (const [tag, attrs] of ICONS[name]) {
      const el = document.createElementNS(SVGNS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      svg.append(el);
    }
    return svg;
  }

  const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: "Segoe UI", "Noto Sans Arabic", Tahoma, system-ui, sans-serif; }
  .ic { flex: none; display: block; }
  .overlay { position: fixed; inset: 0; z-index: 2147483001; background: rgba(11,20,26,.55); display: flex; align-items: center; justify-content: center; animation: fade .15s ease; }
  @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
  .panel { --bg:#ffffff; --fg:#111b21; --muted:#667781; --card:#f4f6f7; --line:#e1e5e8; --accent:#00a884; --accent-fg:#fff;
           --soft:rgba(0,168,132,.1); --ok:#25d366; --ok-bg:rgba(37,211,102,.18); --warn:#c98a00; --warn-bg:rgba(240,180,0,.2); --no:#8696a0; --err:#e0464e;
           text-align: start; width: min(480px, 96vw); max-height: 94vh; overflow: hidden auto; background: var(--bg); color: var(--fg);
           border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.35); font-size: 14px; line-height: 1.5; scrollbar-width: thin; }
  .panel.dark { --bg:#111b21; --fg:#e9edef; --muted:#8696a0; --card:#1b262d; --line:#2a3942; --soft:rgba(0,168,132,.16); --ok-bg:rgba(37,211,102,.22); --warn-bg:rgba(240,180,0,.22); }
  header { position: sticky; top: 0; z-index: 3; background: var(--bg); padding: 16px 18px 12px; display: flex; align-items: center; gap: 10px; }
  .logo { width: 38px; height: 38px; border-radius: 12px; background: var(--accent); color: #fff; display: grid; place-items: center; flex: none; }
  header h2 { margin: 0; font-size: 17px; font-weight: 800; }
  .close { margin-inline-start: auto; width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--card); color: var(--muted); display: grid; place-items: center; }
  .close:hover { color: var(--fg); }
  .langsw { margin-inline-start: auto; display: inline-flex; background: var(--card); border-radius: 17px; padding: 3px; gap: 2px; }
  .langsw button { border: none; background: transparent; color: var(--muted); height: 28px; min-width: 40px; padding: 0 10px; border-radius: 14px; font-size: 12.5px; font-weight: 700; }
  .langsw button.on { background: var(--bg); color: var(--accent); box-shadow: 0 1px 3px rgba(0,0,0,.1); cursor: default; }
  .langsw button:not(.on):hover { color: var(--fg); }
  .langsw + .close { margin-inline-start: 0; }
  .body { padding: 0 18px 6px; }
  .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; background: var(--card); padding: 4px; border-radius: 14px; }
  .tabs button { border: none; background: none; color: var(--muted); padding: 8px 4px; border-radius: 10px; font-size: 13px; font-weight: 700;
                 display: flex; align-items: center; justify-content: center; gap: 6px; }
  .tabs button.on { background: var(--bg); color: var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  section { padding: 14px 0 4px; transition: opacity .2s; }
  section + section { border-top: 1px solid var(--line); margin-top: 10px; }
  section.off { opacity: .35; pointer-events: none; }
  h3 { margin: 0 0 10px; font-size: 14px; display: flex; align-items: center; gap: 8px; }
  h3 .n { display: inline-flex; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--accent-fg); align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
  .muted { color: var(--muted); font-size: 12.5px; }
  .note { color: var(--warn); font-size: 12.5px; margin-top: 6px; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin: 8px 0; }
  button { font: inherit; cursor: pointer; }
  button:disabled { opacity: .45; cursor: default; }
  .act { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 9px 18px; border-radius: 12px; border: none; background: var(--accent); color: var(--accent-fg); font-weight: 700; }
  .act:not(:disabled):hover { filter: brightness(1.07); }
  .big { width: 100%; padding: 12px; font-size: 15px; }
  .sec { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font-size: 12.5px; }
  .sec:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }
  .link { border: none; background: none; color: var(--muted); font-size: 12.5px; padding: 4px; display: inline-flex; align-items: center; gap: 5px; }
  .link:hover { color: var(--accent); }
  input[type=text] { width: 100%; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: inherit; }
  input[type=number] { width: 70px; padding: 5px 6px; border-radius: 8px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: inherit; direction: ltr; text-align: center; }
  input:focus, select:focus { outline: 2px solid var(--soft); border-color: var(--accent); }
  select { padding: 7px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: inherit; max-width: 100%; }
  .field { display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: var(--muted); margin: 10px 0; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  label.chk { display: flex; gap: 8px; align-items: flex-start; margin: 10px 0; }
  .drop { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 22px 12px; border: 1.5px dashed var(--line);
          border-radius: 14px; background: var(--card); cursor: pointer; text-align: center; color: var(--muted); transition: border-color .15s, background .15s; }
  .drop:hover, .drop.over { border-color: var(--accent); background: var(--soft); color: var(--accent); }
  .drop .dt { font-weight: 700; color: var(--fg); }
  .drop.has { flex-direction: row; justify-content: flex-start; padding: 10px 12px; border-style: solid; gap: 10px; text-align: start; color: var(--accent); }
  .drop.has .dt { font-size: 13.5px; word-break: break-all; }
  .drop .chg { margin-inline-start: auto; color: var(--accent); font-weight: 700; font-size: 12.5px; flex: none; }
  .drop.err .muted { color: var(--err); }
  video { display: block; width: 100%; max-height: 220px; background: #000; border-radius: 12px; margin-top: 10px; }
  .thumb { display: block; width: 140px; height: 140px; object-fit: contain; border-radius: 12px; margin: 10px auto 0;
           background: repeating-conic-gradient(#d0d0d0 0 25%, #f2f2f2 0 50%) 50% / 16px 16px; }
  .track { direction: ltr; position: relative; height: 36px; margin: 14px 8px 4px; background: var(--line); border-radius: 8px; cursor: pointer; touch-action: none; user-select: none; }
  .track.audio { height: 48px; }
  .track canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .track .sel { position: absolute; top: 0; bottom: 0; background: rgba(0,168,132,.28); border-top: 2px solid var(--accent); border-bottom: 2px solid var(--accent); pointer-events: none; }
  .track .handle { position: absolute; top: -5px; bottom: -5px; width: 14px; margin-left: -7px; background: var(--accent); border-radius: 5px; cursor: ew-resize; }
  .track .handle::after { content: ""; position: absolute; left: 4px; top: 11px; bottom: 11px; width: 4px; border-left: 1px solid rgba(255,255,255,.85); border-right: 1px solid rgba(255,255,255,.85); }
  .track .ph { position: absolute; top: -7px; bottom: -7px; width: 2px; margin-left: -1px; background: var(--fg); pointer-events: none; }
  .trimrow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin: 8px 0 0; font-size: 12.5px; color: var(--muted); }
  .pill { padding: 3px 10px; border-radius: 10px; background: var(--soft); color: var(--accent); font-weight: 700; font-size: 12.5px; margin-inline-start: auto; }
  .seg { display: inline-flex; background: var(--card); border-radius: 10px; padding: 3px; gap: 3px; }
  .seg button { border: none; padding: 5px 12px; border-radius: 8px; background: transparent; color: var(--muted); font-size: 12.5px; font-weight: 600; }
  .seg button.on { background: var(--bg); color: var(--accent); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .summary { background: var(--card); border-radius: 10px; padding: 8px 12px; margin: 0 0 8px; font-size: 13px; }
  table.grid { direction: ltr; border-collapse: separate; border-spacing: 3px; margin: 8px auto; font-size: 11px; }
  table.grid th { color: var(--muted); font-weight: 600; padding: 2px 3px; text-align: center; }
  table.grid td button { width: 38px; padding: 4px 0; border-radius: 6px; border: 1px solid transparent; font-size: 10.5px; background: transparent; color: var(--no); }
  table.grid td button.ok { background: var(--ok-bg); color: var(--fg); }
  table.grid td button.baja { background: var(--warn-bg); color: var(--fg); }
  table.grid td button.no, table.grid td button.fuera { cursor: default; opacity: .6; }
  table.grid td button.sel { border-color: var(--fg); font-weight: 800; }
  .stale { color: var(--warn); font-size: 12.5px; font-weight: 700; }
  .bar { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; margin-top: 10px; }
  .bar > div { height: 100%; width: 0; background: var(--accent); transition: width .2s; }
  .status { font-size: 13px; margin: 8px 0 0; min-height: 20px; display: flex; align-items: center; justify-content: center; gap: 6px; text-align: center; }
  .status.err { color: var(--err); font-weight: 700; }
  .status.done { color: var(--accent); font-weight: 700; }
  .result { display: flex; gap: 14px; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
  .result .thumb { margin: 0; width: 120px; height: 120px; }
  .result audio { width: 210px; max-width: 100%; height: 36px; }
  .sendrow { display: flex; gap: 8px; margin-top: 12px; }
  .sendrow .act { flex: 1; }
  details { margin-top: 12px; }
  details > summary { cursor: pointer; color: var(--muted); font-size: 13px; font-weight: 600; list-style: none; display: flex; align-items: center; gap: 6px; padding: 4px 0; }
  details > summary::-webkit-details-marker { display: none; }
  details > summary .chev { margin-inline-start: auto; transition: transform .15s; }
  details[open] > summary .chev { transform: rotate(-90deg); }
  .panel[dir=ltr] details > summary .chev { transform: scaleX(-1); }
  .panel[dir=ltr] details[open] > summary .chev { transform: rotate(90deg); }
  details > .in { padding: 2px 0 4px; }
  .sub { font-size: 12.5px; font-weight: 700; margin: 14px 0 4px; }
  footer { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 18px 14px; font-size: 11.5px; color: var(--muted); }
  .logbox { direction: ltr; text-align: left; max-height: 140px; overflow: auto; font: 11px/1.35 ui-monospace, Consolas, monospace; background: var(--card); padding: 6px 8px; border-radius: 8px; white-space: pre-wrap; margin: 0 18px 12px; }
  .logbox .e { color: var(--err); } .logbox .w { color: var(--warn); }
  `;

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (k === "class") el.className = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
        else if (k in el) el[k] = v;
        else el.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) if (c != null) el.append(c.nodeType ? c : document.createTextNode(String(c)));
    return el;
  }
  // Button with icon + text; setLabel swaps both.
  function btn(cls, ic, text, props = {}) {
    const size = cls.includes("big") ? 20 : 16;
    const b = h("button", { class: cls, ...props }, ic ? icon(ic, size) : null, text ? h("span", null, text) : null);
    b.setLabel = (ic2, t2) => { b.textContent = ""; if (ic2) b.append(icon(ic2, size)); b.append(h("span", null, t2)); };
    return b;
  }

  function attachStyles(root) {
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } catch (e) {
      log("warn", "ui:estilos-fallback", e);
      root.append(h("style", { textContent: CSS }));
    }
  }

  function download(blob, name) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  async function saveLog() {
    const stored = await WAAS.getStoredLog();
    const entries = stored && stored.length ? stored : WAAS.entries;
    const content = JSON.stringify({ exported: new Date().toISOString(), version: WAAS.VERSION, ua: navigator.userAgent, entries }, null, 1);
    const blob = new Blob([content], { type: "application/json" });
    const name = "audio-stickers-log-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".json";
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "JSON", accept: { "application/json": [".json"] } }] });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
        log("info", "registro:guardado", { nombre: handle.name, entradas: entries.length });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
        log("warn", "registro:selector-fallo", e);
      }
    }
    download(blob, name);
    log("info", "registro:descargado", { nombre: name, entradas: entries.length });
  }
  WAAS.saveLog = saveLog;

  const fmtT = (t) => (t >= 60 ? Math.floor(t / 60) + ":" + (t % 60).toFixed(1).padStart(4, "0") + " " + L.min : t.toFixed(1) + " " + L.sec);
  const fmtB = (b) => (b >= 1e6 ? (b / 1e6).toFixed(2) + " MB" : Math.round(b / 1000) + " KB");
  const isDark = () => {
    try {
      return document.body.classList.contains("dark") || document.documentElement.classList.contains("dark") ||
        matchMedia("(prefers-color-scheme: dark)").matches;
    } catch (e) { return false; }
  };
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* no storage */ } },
  };
  const baseName = (f) => (f && f.name.replace(/\.[^.]+$/, "")) || "sticker";
  const details = (ic, title, ...body) => h("details", null, h("summary", null, icon(ic, 16), title, h("span", { class: "chev" }, icon("chevron", 16))), h("div", { class: "in" }, ...body));

  let unmount = null;
  function mount() {
    if (document.getElementById("waas-root")) return;
    LANG = pickLang();
    L = STR[LANG];
    const host = h("div", { id: "waas-root" });
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    attachStyles(root);

    const G = { busy: false, forms: [], refreshTabs: () => {} };
    const setBusy = (b) => { G.busy = b; G.forms.forEach((f) => f.refresh()); G.refreshTabs(); };
    const run = async (name, fn) => {
      const ac = new AbortController();
      G.abort = ac;
      setBusy(true);
      try { return await WAAS.run(name, () => fn(ac.signal)); } finally { G.abort = null; setBusy(false); }
    };

    // ============================================================ trim bar
    function makeTrimmer(kind, hint) {
      const isVideo = kind === "video";
      const media = isVideo ? h("video", { playsInline: true, preload: "auto" }) : h("audio", { preload: "auto" });
      const wave = isVideo ? null : h("canvas");
      const selBar = h("div", { class: "sel" });
      const hS = h("div", { class: "handle", title: L.startTitle });
      const hE = h("div", { class: "handle", title: L.endTitle });
      const ph = h("div", { class: "ph" });
      const track = h("div", { class: "track" + (isVideo ? "" : " audio") }, wave, selBar, ph, hS, hE);
      const playBtn = btn("sec", "play", L.play);
      const lenLbl = h("span", { class: "pill" });
      const startNum = h("input", { type: "number", min: 0, step: 0.1, title: L.startTitle });
      const endNum = h("input", { type: "number", min: 0, step: 0.1, title: L.endTitle });
      const t = { start: 0, end: 0, playhead: 0, stopAt: null, dur: 0, offset: 0, url: null, peaks: null, peakMax: 1, muted: false };
      const listeners = new Set();
      const emit = () => listeners.forEach((fn) => fn());
      const el = h("div", null,
        isVideo ? media : null, track,
        h("div", { class: "trimrow" }, playBtn, h("span", null, L.from), startNum, h("span", null, L.to), endNum, lenLbl),
        hint ? h("div", { class: "muted", style: "margin-top:8px" }, hint) : null);

      const layout = () => {
        const d = t.dur || 1;
        const pct = (x) => Math.max(0, Math.min(100, (x / d) * 100)) + "%";
        selBar.style.left = pct(t.start);
        selBar.style.width = Math.max(0, ((t.end - t.start) / d) * 100) + "%";
        hS.style.left = pct(t.start);
        hE.style.left = pct(t.end);
        ph.style.left = pct(t.playhead);
        if (root.activeElement !== startNum) startNum.value = t.start.toFixed(1);
        if (root.activeElement !== endNum) endNum.value = t.end.toFixed(1);
        lenLbl.textContent = fmtT(t.end - t.start);
      };

      const drawWave = () => {
        if (!wave) return;
        const w = track.clientWidth, hh = track.clientHeight;
        if (!w) return;
        const dpr = window.devicePixelRatio || 1;
        wave.width = Math.round(w * dpr); wave.height = Math.round(hh * dpr);
        const ctx = wave.getContext("2d");
        ctx.clearRect(0, 0, wave.width, wave.height);
        if (!t.peaks) return;
        ctx.fillStyle = getComputedStyle(track).getPropertyValue("--muted").trim() || "#667781";
        const n = t.peaks.length, cols = wave.width, mid = wave.height / 2, norm = 1 / (t.peakMax || 1);
        for (let x = 0; x < cols; x++) {
          const a = Math.floor((x / cols) * n), b = Math.max(a + 1, Math.floor(((x + 1) / cols) * n));
          let p = 0;
          for (let i = a; i < b && i < n; i++) if (t.peaks[i] > p) p = t.peaks[i];
          const hgt = Math.max(1, p * norm * (wave.height - 4));
          ctx.fillRect(x, mid - hgt / 2, 1, hgt);
        }
      };
      if (wave && typeof ResizeObserver !== "undefined") new ResizeObserver(drawWave).observe(track);

      let seeking = false, pendingSeek = null;
      const seekTo = (x) => { pendingSeek = x; if (!seeking) doSeek(); };
      const doSeek = () => {
        if (pendingSeek == null) return;
        const x = pendingSeek; pendingSeek = null; seeking = true;
        t.playhead = x;
        media.currentTime = t.offset + x;
        layout();
      };
      media.addEventListener("seeked", () => { seeking = false; if (pendingSeek != null) doSeek(); });

      const changed = () => { layout(); emit(); };
      const setStart = (x) => {
        if (!t.dur) return;
        t.start = Math.max(0, Math.min(x, t.end - MIN_LEN));
        changed(); stop(); seekTo(t.start);
      };
      const setEnd = (x) => {
        if (!t.dur) return;
        t.end = Math.min(t.dur, Math.max(x, t.start + MIN_LEN));
        changed(); stop(); seekTo(Math.max(t.start, t.end - FRAME));
      };

      const tAt = (ev) => {
        const r = track.getBoundingClientRect();
        return Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * t.dur;
      };
      let drag = null;
      track.addEventListener("pointerdown", (ev) => {
        if (!t.dur || G.busy) return;
        drag = ev.target === hS ? "s" : ev.target === hE ? "e" : "p";
        track.setPointerCapture(ev.pointerId);
        stop();
        applyDrag(ev);
      });
      track.addEventListener("pointermove", (ev) => { if (drag) applyDrag(ev); });
      const endDrag = () => { drag = null; };
      track.addEventListener("pointerup", endDrag);
      track.addEventListener("pointercancel", endDrag);
      const applyDrag = (ev) => {
        const x = tAt(ev);
        if (drag === "s") setStart(x);
        else if (drag === "e") setEnd(x);
        else seekTo(x);
      };
      startNum.addEventListener("change", () => setStart(+startNum.value || 0));
      endNum.addEventListener("change", () => setEnd(+endNum.value || 0));

      let raf = 0;
      const tick = () => {
        t.playhead = Math.max(0, media.currentTime - t.offset);
        layout();
        if (t.stopAt != null && media.currentTime >= t.offset + t.stopAt) { stop(); return; }
        if (!media.paused) raf = requestAnimationFrame(tick);
      };
      function stop() {
        cancelAnimationFrame(raf);
        if (!media.paused) media.pause();
        t.stopAt = null;
        playBtn.setLabel("play", L.play);
      }
      const play = (from, to, muted = t.muted) => {
        stop();
        t.stopAt = to;
        media.muted = muted;
        seeking = false; pendingSeek = null;
        media.currentTime = t.offset + from;
        playBtn.setLabel("stop", L.stop);
        return media.play().then(() => { raf = requestAnimationFrame(tick); }).catch((e) => { stop(); log("warn", "ui:reproducir", e); });
      };
      playBtn.addEventListener("click", () => { if (!media.paused) stop(); else play(t.start, t.end); });

      const load = (file, { duration, offset = 0, peaks = null, peakMax = 1 }) => {
        stop();
        if (t.url) URL.revokeObjectURL(t.url);
        t.url = URL.createObjectURL(file);
        Object.assign(t, { dur: duration, offset, start: 0, end: Math.min(duration, DEFAULT_LEN), playhead: 0, peaks, peakMax });
        media.addEventListener("loadeddata", () => seekTo(0), { once: true });
        media.src = t.url;
        changed();
        requestAnimationFrame(drawWave);
      };
      const clear = () => {
        stop();
        if (t.url) URL.revokeObjectURL(t.url);
        t.url = null;
        media.removeAttribute("src");
        Object.assign(t, { dur: 0, start: 0, end: 0, playhead: 0, peaks: null });
        changed();
        drawWave();
      };

      layout();
      return {
        el, media, load, clear, stop, play,
        onChange: (fn) => listeners.add(fn),
        setMuted: (m) => { t.muted = m; media.muted = m; },
        get loaded() { return t.dur > 0; },
        get start() { return t.start; },
        get end() { return t.end; },
        get len() { return t.end - t.start; },
      };
    }

    // ============================================================ shared pieces
    const section = (n, title, ...body) => h("section", { class: "off" }, h("h3", null, h("span", { class: "n" }, String(n)), title), ...body);

    // File picker: click or drag and drop.
    function makePicker(ic, label, accept, hint) {
      const input = h("input", { type: "file", accept, style: "display:none" });
      const icWrap = h("span", null, icon("upload", 26));
      const dt = h("span", { class: "dt", textContent: label });
      const info = h("span", { class: "muted", textContent: hint });
      const chg = h("span", { class: "chg", textContent: L.change, style: "display:none" });
      const textCol = h("span", { style: "display:flex;flex-direction:column;gap:2px;min-width:0" }, dt, info);
      const box = h("div", { class: "drop", role: "button", tabIndex: 0 }, icWrap, textCol, chg, input);
      let handler = null;
      const pick = (f) => { if (f && handler && !G.busy) handler(f); };
      const setIcon = (name, size) => { icWrap.textContent = ""; icWrap.append(icon(name, size)); };
      box.addEventListener("click", (e) => { if (e.target !== input && !G.busy) input.click(); });
      box.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
      box.addEventListener("dragover", (e) => { e.preventDefault(); box.classList.add("over"); });
      box.addEventListener("dragleave", () => box.classList.remove("over"));
      box.addEventListener("drop", (e) => { e.preventDefault(); box.classList.remove("over"); pick(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]); });
      input.addEventListener("change", () => { const f = input.files && input.files[0]; input.value = ""; pick(f); });
      return {
        el: box,
        reading(f) { box.classList.remove("err"); dt.textContent = f.name; info.textContent = L.reading; },
        set(f, d) { box.classList.add("has"); box.classList.remove("err"); setIcon(ic, 22); chg.style.display = ""; dt.textContent = f.name; info.textContent = d; },
        fail(msg) { box.classList.remove("has"); box.classList.add("err"); setIcon("upload", 26); chg.style.display = "none"; dt.textContent = label; info.textContent = msg; },
        onPick: (fn) => { handler = fn; },
      };
    }

    function makeAudioSource(onChange) {
      const picker = makePicker("music", L.pickSound, "audio/*,video/*,.mp3,.m4a,.aac,.ogg,.opus,.wav,.flac,.mp4,.mov,.webm", L.pickSoundHint);
      const trimmer = makeTrimmer("audio");
      const wrap = h("div", { style: "display:none" }, trimmer.el);
      const s = { file: null };
      picker.onPick(async (f) => {
        picker.reading(f);
        await run("audio", async () => {
          try {
            const a = await WAAS.probeAudio(f);
            s.file = f;
            wrap.style.display = "";
            trimmer.load(f, { duration: a.duration, peaks: a.peaks, peakMax: a.peakMax });
            picker.set(f, fmtT(a.duration) + (a.peakMax < 0.001 ? L.silent : ""));
            log("info", "ui:audio-elegido", { nombre: f.name, tipo: f.type, bytes: f.size, duracion: a.duration, canales: a.channels, pico: +a.peakMax.toFixed(4) });
          } catch (e) {
            log("error", "ui:audio-error", e);
            picker.fail(trErr(e));
            s.file = null;
            trimmer.clear();
            wrap.style.display = "none";
          }
        });
        onChange();
      });
      trimmer.onChange(onChange);
      return {
        els: [picker.el, wrap], trimmer,
        get ready() { return !!s.file && trimmer.loaded; },
        get params() { return s.file ? { file: s.file, start: trimmer.start, dur: trimmer.len } : null; },
      };
    }

    // Shape and quality. Quality is automatic; manual control lives in "More options".
    function makeFormat({ getParams, grid = true, sync = true, still = false }) {
      const f = { mode: "ajustar", an: null, anKey: null, sel: null };
      const segAjustar = h("button", { textContent: L.fit, class: "on" });
      const segRecortar = h("button", { textContent: L.crop });
      const calcBtn = btn("sec", "sliders", L.showOptions);
      const calcInfo = h("span", { class: "muted" });
      const staleLbl = h("div", { class: "stale", style: "display:none" }, L.staleGrid);
      const gridHost = h("div");
      const selLbl = h("div", { class: "muted", style: "text-align:center" });
      const syncNum = h("input", { type: "number", min: 0, max: 1000, step: 10, value: store.get("waas-compensacion-ms", 0) });
      syncNum.addEventListener("change", () => { store.set("waas-compensacion-ms", +syncNum.value || 0); api.onUpdate(); });
      const stillChk = h("input", { type: "checkbox", onchange: () => api.onUpdate() });

      const adv = [h("div", { class: "sub" }, L.shape), h("span", { class: "seg" }, segAjustar, segRecortar)];
      if (grid) adv.push(h("div", { class: "sub" }, L.quality), h("div", { class: "muted" }, L.qualityHint),
        h("div", { class: "row" }, calcBtn, calcInfo), staleLbl, gridHost, selLbl);
      if (sync) adv.push(h("div", { class: "row" }, h("span", { class: "muted" }, L.syncLabel), syncNum));
      if (still) adv.push(h("label", { class: "chk" }, stillChk, h("span", { class: "muted" }, L.stillLabel)));

      const fileId = (x) => (x ? x.name + "|" + x.size + "|" + x.lastModified : "");
      const key = () => {
        const p = getParams();
        if (!p) return null;
        const v = p.visual;
        const followsAudio = v.kind === "image" || p.fit !== "independiente";
        return JSON.stringify([v.kind, fileId(v.file), v.start, v.dur, followsAudio ? p.fit : "", followsAudio ? +p.audio.dur.toFixed(3) : "", f.mode]);
      };
      const fresh = () => !!f.an && f.anKey === key();
      const manual = () => grid && fresh() && !!f.sel;
      const fullKey = () => {
        const p = getParams();
        if (!p) return null;
        return JSON.stringify([key(), fileId(p.audio.file), +p.audio.start.toFixed(3), +p.audio.dur.toFixed(3), p.fit, manual() ? f.sel : "auto", api.options()]);
      };
      const reset = () => { if (f.an) WAAS.release(f.an); f.an = null; f.sel = null; gridHost.textContent = ""; selLbl.textContent = ""; calcInfo.textContent = ""; };

      const renderGrid = () => {
        gridHost.textContent = "";
        const an = f.an;
        if (!an) return;
        const Lm = WAAS.limits;
        const thead = h("tr", null, h("th", null, "px/fps"), Lm.FPS_LIST.map((x) => h("th", null, String(x))));
        const rows = Lm.SIDES.map((side) => h("tr", null, h("th", null, String(side)), Lm.FPS_LIST.map((fps) => {
          const c = an.cells.find((x) => x.side === side && x.fps === fps);
          const isAuto = an.auto && an.auto.side === side && an.auto.fps === fps;
          const isSel = f.sel && f.sel.side === side && f.sel.fps === fps;
          const can = !!c && (c.estado === "ok" || c.estado === "baja");
          const label = !c || c.estado === "fuera" ? "·" : c.estado === "no" ? "✕" : (isAuto ? "★" : "") + Math.round(c.est / 1000);
          const title = !c || c.estado === "fuera" ? L.notAvailable : c.estado === "no" ? L.overLimit : `≈ ${fmtB(c.est)}${c.estado === "baja" ? L.lowerQuality : ""}`;
          return h("td", null, h("button", {
            class: (c ? c.estado : "fuera") + (isSel ? " sel" : ""), textContent: label, title, disabled: !can,
            onclick: () => { f.sel = { side, fps }; renderGrid(); api.onUpdate(); },
          }));
        })));
        gridHost.append(h("table", { class: "grid" }, thead, rows));
        const c = f.sel && an.cells.find((x) => x.side === f.sel.side && x.fps === f.sel.fps);
        selLbl.textContent = c ? L.chosen(c.side, c.fps, fmtB(c.est)) : L.noneFits;
      };

      segAjustar.addEventListener("click", () => { f.mode = "ajustar"; api.onUpdate(); });
      segRecortar.addEventListener("click", () => { f.mode = "recortar"; api.onUpdate(); });
      calcBtn.addEventListener("click", async () => {
        const p = getParams();
        if (!p) return;
        reset();
        const k = key();
        api.onUpdate();
        try {
          const an = await run("analizar", (signal) => WAAS.analyze({
            ...p, mode: f.mode, signal,
            onProgress: (txt, frac) => { calcInfo.textContent = tr(txt) + " " + Math.round(frac * 100) + "%"; },
          }));
          f.an = an; f.anKey = k;
          f.sel = an.auto ? { side: an.auto.side, fps: an.auto.fps } : null;
          calcInfo.textContent = L.recommended;
          renderGrid();
        } catch (e) {
          calcInfo.textContent = trErr(e);
        }
        api.onUpdate();
      });

      const api = {
        adv,
        onUpdate: () => {},
        refresh() {
          const has = !!getParams();
          const stale = !!f.an && !fresh();
          staleLbl.style.display = stale ? "" : "none";
          gridHost.style.opacity = stale ? ".35" : "";
          gridHost.style.pointerEvents = stale ? "none" : "";
          calcBtn.disabled = G.busy || !has;
          segAjustar.disabled = segRecortar.disabled = G.busy;
          segAjustar.classList.toggle("on", f.mode === "ajustar");
          segRecortar.classList.toggle("on", f.mode === "recortar");
        },
        get ready() { return !!getParams(); },
        reset,
        fullKey,
        options: () => ({ syncMs: sync ? +syncNum.value || 0 : 0, still: still && stillChk.checked }),
        async prepare(signal, onProgress) {
          const p = getParams();
          if (manual()) return { an: f.an, side: f.sel.side, fps: f.sel.fps, audio: p.audio, temp: false };
          const an = await WAAS.analyze({ ...p, mode: f.mode, signal, onProgress });
          if (!an.auto) { WAAS.release(an); throw new Error("Ninguna combinación cabe en 1 MB"); }
          return { an, side: an.auto.side, fps: an.auto.fps, audio: p.audio, temp: true };
        },
      };
      return api;
    }

    // Last step: create, preview, send.
    function makeCreate({ fmt, getBase }) {
      const META_KEY = "waas-metadatos";
      const packInput = h("input", { type: "text", maxLength: 128, placeholder: L.packPh });
      const authorInput = h("input", { type: "text", maxLength: 128, placeholder: L.authorPh });
      const loadMeta = () => { const m = store.get(META_KEY, {}) || {}; packInput.value = m.paquete || ""; authorInput.value = m.autor || ""; };
      const saveMeta = () => store.set(META_KEY, { paquete: packInput.value, autor: authorInput.value });
      loadMeta();
      packInput.addEventListener("change", saveMeta);
      authorInput.addEventListener("change", saveMeta);
      const createBtn = btn("act big", "sparkle", L.create);
      const cancelBtn = h("button", { class: "link", textContent: L.cancel, style: "display:none;margin:6px auto 0" });
      const barIn = h("div");
      const bar = h("div", { class: "bar", style: "display:none" }, barIn);
      const status = h("div", { class: "status" });
      const resImg = h("img", { class: "thumb", alt: L.previewAlt, title: L.previewTitle, style: "cursor:pointer" });
      const resAudio = h("audio", { controls: true });
      const resInfo = h("div", { class: "muted", style: "text-align:center" });
      const destSel = h("select", null,
        h("option", { value: "abierto-solo", textContent: L.destOpen }),
        h("option", { value: "abierto", textContent: L.destOpenFwd }),
        h("option", { value: "propio", textContent: L.destSelf }));
      destSel.value = store.get("waas-destino", "abierto-solo");
      destSel.addEventListener("change", () => store.set("waas-destino", destSel.value));
      const sendBtn = btn("act", "send", L.send);
      const dlBtn = btn("sec", "download", "", { title: L.download });
      const staleNote = h("div", { class: "stale", style: "display:none;margin-top:8px;text-align:center" }, L.staleResult);
      const resultBox = h("div", { class: "result" }, resImg, h("div", { style: "display:flex;flex-direction:column;align-items:center;gap:6px" }, resAudio, resInfo));
      const result = h("div", { style: "display:none" }, staleNote, resultBox, h("div", { class: "sendrow" }, sendBtn, dlBtn));
      const c = { result: null, key: null, urls: [] };
      const setStatus = (txt, frac, cls) => {
        status.textContent = "";
        if (cls === "done") status.append(icon("check", 16));
        if (cls === "err") status.append(icon("alert", 16));
        if (txt) status.append(h("span", null, txt));
        status.className = "status" + (cls ? " " + cls : "");
        if (frac != null) { barIn.style.width = Math.round(frac * 100) + "%"; bar.style.display = frac > 0 && frac < 1 ? "" : "none"; }
      };
      const progress = (txt, frac) => setStatus(tr(txt), frac);
      const revoke = () => { c.urls.forEach((u) => URL.revokeObjectURL(u)); c.urls = []; };
      const clear = () => { c.result = null; c.key = null; result.style.display = "none"; revoke(); setStatus("", 0); };

      createBtn.addEventListener("click", async () => {
        if (!fmt.ready) return;
        result.style.display = "none";
        try {
          const k = fmt.fullKey();
          const res = await run("crear", async (signal) => {
            const p = await fmt.prepare(signal, (t, f) => progress(t, 0.01 + f * 0.34));
            const base = p.temp ? 0.35 : 0, span = 1 - base;
            try {
              return await WAAS.create(p.an, {
                side: p.side, fps: p.fps, audio: p.audio, ...fmt.options(),
                packName: packInput.value, publisher: authorInput.value,
                onProgress: (t, f) => progress(t, Math.min(0.99, base + f * span)), signal,
              });
            } finally {
              if (p.temp) WAAS.release(p.an);
            }
          });
          c.result = res;
          c.key = k;
          revoke();
          const u1 = URL.createObjectURL(res.webp), u2 = URL.createObjectURL(res.ogg);
          c.urls.push(u1, u2);
          resImg.src = u1; resAudio.src = u2;
          const i = res.info;
          resInfo.textContent = `${fmtT(i.duracionAudio)} · ${fmtB(i.webpBytes)}`;
          result.style.display = "";
          setStatus(L.ready, 1, "done");
        } catch (e) {
          setStatus(trErr(e), 0, e.name === "AbortError" ? "" : "err");
        }
        api.onUpdate();
      });
      cancelBtn.addEventListener("click", () => { if (G.abort) G.abort.abort(); });

      resImg.addEventListener("click", () => {
        if (!c.result) return;
        const u = resImg.src;
        resImg.src = "";
        resImg.src = u;
        resAudio.currentTime = 0;
        resAudio.play().catch((e) => log("warn", "ui:reproducir", e));
      });

      sendBtn.addEventListener("click", async () => {
        if (!c.result) return;
        const dest = destSel.value;
        try {
          await run("enviar", async () => {
            const i = c.result.info;
            if (packInput.value.trim() !== (i.paquete || "") || authorInput.value.trim() !== (i.autor || "")) {
              c.result.webp = await WAAS.retagWebp(c.result.webp, { packName: packInput.value, publisher: authorInput.value, soundSha: i.soundSha256 });
              i.paquete = packInput.value.trim(); i.autor = authorInput.value.trim();
              log("info", "metadatos:actualizados", { paquete: i.paquete, autor: i.autor, webpBytes: c.result.webp.size });
            }
            saveMeta();
            await WAAS.wa.publish(c.result, {
              destino: dest === "propio" ? "propio" : "abierto",
              abrirReenviar: dest !== "abierto-solo",
              onProgress: (t) => progress(t),
            });
          });
          setStatus(dest === "abierto-solo" ? L.sent : L.sentFwd, 1, "done");
          api.onSent();
        } catch (e) {
          setStatus(trErr(e), 0, "err");
        }
      });
      dlBtn.addEventListener("click", () => {
        if (!c.result) return;
        const b = getBase();
        download(c.result.webp, b + ".webp");
        download(c.result.ogg, b + ".ogg");
        log("info", "ui:descarga-archivos", { base: b });
      });

      const api = {
        body: [createBtn, cancelBtn, bar, status, result],
        adv: [
          h("label", { class: "field" }, L.whenSending, destSel),
          h("div", { class: "meta" }, h("label", { class: "field" }, L.pack, packInput), h("label", { class: "field" }, L.author, authorInput)),
        ],
        onSent: () => {},
        onUpdate: () => {},
        clear, loadMeta,
        get hasResult() { return !!c.result; },
        refresh() {
          const stale = !!c.result && c.key !== fmt.fullKey();
          const done = !!c.result && !stale;
          if (done) createBtn.setLabel("check", L.created);
          else if (c.result) createBtn.setLabel("refresh", L.recreate);
          else createBtn.setLabel("sparkle", L.create);
          createBtn.disabled = G.busy || !fmt.ready || done;
          staleNote.style.display = stale ? "" : "none";
          resultBox.style.opacity = stale ? ".45" : "";
          sendBtn.disabled = dlBtn.disabled = G.busy || !c.result;
          cancelBtn.style.display = G.busy && api.isActive() ? "block" : "none";
        },
        isActive: () => true,
      };
      return api;
    }

    function makeForm({ id, title, ic, sources, extras = [], fmt, getBase, stop }) {
      const create = makeCreate({ fmt, getBase });
      let n = 0;
      const secs = sources.map((s) => section(++n, s.title, ...s.body));
      const secFinal = section(++n, L.stepFinal, ...extras, ...create.body, details("sliders", L.more, ...create.adv, ...fmt.adv));
      const el = h("div", { style: "display:none" }, ...secs, secFinal);
      const form = {
        id, title, ic, el, create, stop,
        refresh() {
          sources.forEach((s, i) => secs[i].classList.toggle("off", G.busy));
          secFinal.classList.toggle("off", !sources.every((s) => s.ready()) && !create.hasResult);
          fmt.refresh();
          create.refresh();
        },
        show(on) { el.style.display = on ? "" : "none"; if (on) create.loadMeta(); else stop(); },
      };
      fmt.onUpdate = () => form.refresh();
      create.onUpdate = () => form.refresh();
      create.isActive = () => el.style.display !== "none";
      create.onSent = () => setTimeout(() => close(true), 1200);
      return form;
    }

    // ============================================================ video with its own sound
    function videoForm() {
      const picker = makePicker("video", L.pickVideo, "video/*,.mov,.mp4,.webm,.mkv", L.pickVideoHint);
      const trimmer = makeTrimmer("video", L.videoHint);
      const s = { file: null };
      const changed = () => form.refresh();
      const fmt = makeFormat({
        getParams: () => (s.file && trimmer.loaded ? {
          visual: { kind: "video", file: s.file, start: trimmer.start, dur: trimmer.len },
          audio: { file: s.file, start: trimmer.start, dur: trimmer.len }, fit: "repetir",
        } : null),
      });
      const trimWrap = h("div", { style: "display:none" }, trimmer.el);
      picker.onPick(async (f) => {
        trimmer.stop();
        fmt.reset();
        form.create.clear();
        picker.reading(f);
        await run("video", async () => {
          try {
            const meta = await WAAS.probeVideo(f);
            s.file = f;
            trimWrap.style.display = "";
            trimmer.load(f, meta);
            picker.set(f, fmtT(meta.duration));
            log("info", "ui:video-elegido", { nombre: f.name, tipo: f.type, bytes: f.size, ...meta });
          } catch (e) {
            log("error", "ui:video-error", e);
            picker.fail(trErr(e));
            s.file = null;
            trimmer.clear();
            trimWrap.style.display = "none";
          }
        });
        changed();
      });
      trimmer.onChange(changed);
      const form = makeForm({
        id: "video", title: L.tabVideo, ic: "video",
        sources: [{ title: L.stepVideo, body: [picker.el, trimWrap], ready: () => !!s.file && trimmer.loaded }],
        fmt, getBase: () => baseName(s.file), stop: () => trimmer.stop(),
      });
      return form;
    }

    // ============================================================ image + sound
    function imageForm() {
      const picker = makePicker("image", L.pickImage, "image/*", L.pickImageHint);
      const thumb = h("img", { class: "thumb", alt: "", style: "display:none" });
      const animNote = h("div", { class: "note", style: "display:none" }, L.animNote);
      const s = { file: null, url: null };
      const changed = () => form.refresh();
      const audio = makeAudioSource(changed);
      const fmt = makeFormat({
        grid: false, sync: false, still: true,
        getParams: () => (s.file && audio.ready ? { visual: { kind: "image", file: s.file }, audio: audio.params, fit: "repetir" } : null),
      });
      picker.onPick(async (f) => {
        form.create.clear();
        picker.reading(f);
        await run("imagen", async () => {
          try {
            const meta = await WAAS.probeImage(f);
            s.file = f;
            if (s.url) URL.revokeObjectURL(s.url);
            s.url = URL.createObjectURL(f);
            thumb.src = s.url; thumb.style.display = "";
            animNote.style.display = meta.animated ? "" : "none";
            picker.set(f, `${meta.width}×${meta.height}`);
            log("info", "ui:imagen-elegida", { nombre: f.name, tipo: f.type, bytes: f.size, ...meta });
          } catch (e) {
            log("error", "ui:imagen-error", e);
            picker.fail(trErr(e));
            s.file = null; thumb.style.display = "none"; animNote.style.display = "none";
          }
        });
        changed();
      });
      const form = makeForm({
        id: "imagen", title: L.tabImage, ic: "image",
        sources: [
          { title: L.stepImage, body: [picker.el, thumb, animNote], ready: () => !!s.file },
          { title: L.stepSound, body: audio.els, ready: () => audio.ready },
        ],
        fmt, getBase: () => baseName(s.file), stop: () => audio.trimmer.stop(),
      });
      return form;
    }

    // ============================================================ GIF or video + another sound
    function mixForm() {
      const picker = makePicker("gif", L.pickGif, "video/*,image/gif,image/webp,image/apng,.gif,.mov,.mp4,.webm,.mkv", L.pickGifHint);
      const vTrim = makeTrimmer("video");
      vTrim.setMuted(true);
      const vWrap = h("div", { style: "display:none" }, vTrim.el);
      const gifImg = h("img", { class: "thumb", alt: "GIF", style: "display:none" });
      const s = { file: null, kind: null, gif: null, url: null };
      const changed = () => { updateSummary(); form.refresh(); };
      const audio = makeAudioSource(changed);

      const FIT_KEY = "waas-ajuste-duracion-v2";
      const fitSel = h("select", null,
        h("option", { value: "independiente", textContent: L.fitIndep }),
        h("option", { value: "repetir", textContent: L.fitRepeat }),
        h("option", { value: "congelar", textContent: L.fitFreeze }));
      fitSel.value = store.get(FIT_KEY, "independiente");
      fitSel.addEventListener("change", () => { store.set(FIT_KEY, fitSel.value); changed(); });
      const summaryTxt = h("div");
      const fitRow = h("div", { class: "row", style: "margin-bottom:0" }, h("span", { class: "muted" }, L.diffLen), fitSel);
      const testBtn = btn("sec", "play", L.playTogether);
      const summary = h("div", { class: "summary", style: "display:none" }, summaryTxt, fitRow, h("div", { class: "row", style: "margin-bottom:0" }, testBtn));
      const vDur = () => (s.kind === "gif" ? s.gif.duration : vTrim.len);

      function updateSummary() {
        if (!s.file || !audio.ready) { summary.style.display = "none"; return; }
        summary.style.display = "";
        const v = vDur(), a = audio.params.dur;
        const same = Math.abs(v - a) < 0.05;
        fitRow.style.display = same ? "none" : "";
        summaryTxt.textContent = same ? L.lenSame(fmtT(a)) : L.lenDiff(fmtT(v), fmtT(a));
      }

      testBtn.addEventListener("click", () => {
        if (!s.file || !audio.ready) return;
        const a = audio.params;
        if (s.kind === "gif") { const u = gifImg.src; gifImg.src = ""; gifImg.src = u; }
        else vTrim.play(vTrim.start, vTrim.end, true);
        audio.trimmer.play(a.start, a.start + a.dur, false);
      });

      const fmt = makeFormat({
        getParams: () => {
          if (!s.file || !audio.ready) return null;
          const visual = s.kind === "gif" ? { kind: "gif", file: s.file, start: 0, dur: s.gif.duration } : { kind: "video", file: s.file, start: vTrim.start, dur: vTrim.len };
          return { visual, audio: audio.params, fit: fitSel.value };
        },
      });

      picker.onPick(async (f) => {
        vTrim.stop();
        fmt.reset();
        form.create.clear();
        picker.reading(f);
        await run("animacion", async () => {
          try {
            if (s.url) { URL.revokeObjectURL(s.url); s.url = null; }
            if (WAAS.isAnimationFile(f) || (f.type || "").startsWith("image/")) {
              const g = await WAAS.probeAnimation(f);
              if (!g.animated) throw new Error("@" + L.staticImage);
              s.file = f; s.kind = "gif"; s.gif = g;
              s.url = URL.createObjectURL(f);
              gifImg.src = s.url; gifImg.style.display = ""; vWrap.style.display = "none";
              vTrim.clear();
              picker.set(f, fmtT(g.duration));
              log("info", "ui:gif-elegido", { nombre: f.name, tipo: f.type, bytes: f.size, cuadros: g.frames, duracion: g.duration, ancho: g.width, alto: g.height });
            } else {
              const meta = await WAAS.probeVideo(f);
              s.file = f; s.kind = "video"; s.gif = null;
              vWrap.style.display = ""; gifImg.style.display = "none";
              vTrim.load(f, meta);
              picker.set(f, fmtT(meta.duration));
              log("info", "ui:video-elegido", { nombre: f.name, tipo: f.type, bytes: f.size, sinSuAudio: true, ...meta });
            }
          } catch (e) {
            log("error", "ui:animacion-error", e);
            picker.fail(trErr(e));
            s.file = null; s.kind = null; s.gif = null;
            vTrim.clear(); vWrap.style.display = "none"; gifImg.style.display = "none";
          }
        });
        changed();
      });
      vTrim.onChange(changed);

      const form = makeForm({
        id: "mezcla", title: L.tabGif, ic: "gif",
        sources: [
          { title: L.stepAnim, body: [picker.el, vWrap, gifImg], ready: () => !!s.file },
          { title: L.stepSound, body: audio.els, ready: () => audio.ready },
        ],
        extras: [summary],
        fmt, getBase: () => baseName(s.file),
        stop: () => { vTrim.stop(); audio.trimmer.stop(); },
      });
      return form;
    }

    // ============================================================ panel
    G.forms = [videoForm(), imageForm(), mixForm()];
    const TAB_KEY = "waas-pestana";
    let active = Math.max(0, G.forms.findIndex((f) => f.id === store.get(TAB_KEY, "video")));
    const tabBtns = G.forms.map((f, i) => h("button", { onclick: () => selectTab(i) }, icon(f.ic, 17), f.title));
    function selectTab(i) {
      if (G.busy) return;
      active = i;
      store.set(TAB_KEY, G.forms[i].id);
      G.forms.forEach((f, j) => f.show(j === i));
      G.refreshTabs();
      G.forms[i].refresh();
      log("info", "ui:pestana", { pestana: G.forms[i].id });
    }
    G.refreshTabs = () => tabBtns.forEach((b, i) => { b.classList.toggle("on", i === active); b.disabled = G.busy && i !== active; });

    const logBox = h("div", { class: "logbox", style: "display:none" });
    const logBtn = btn("link", "file", L.log);
    logBtn.addEventListener("click", () => { logBox.style.display = logBox.style.display === "none" ? "" : "none"; logBox.scrollTop = logBox.scrollHeight; });
    const saveLogBtn = h("button", { class: "link", textContent: L.save, title: L.saveTitle, onclick: () => saveLog().catch((e) => log("error", "registro:error", e)) });

    const closeBtn = h("button", { class: "close", title: L.close }, icon("x", 18));
    // Language switch: both options always visible, the current one highlighted.
    const setLang = (to) => {
      if (to === LANG || G.busy) return;
      store.set(LANG_KEY, to);
      log("info", "ui:idioma", { idioma: to });
      unmount();
      mount();
      WAAS.togglePanel();
    };
    const langOpt = (code, label, title) => h("button", { class: code === LANG ? "on" : "", lang: code, title, textContent: label,
      "aria-pressed": String(code === LANG), onclick: () => setLang(code) });
    const langSw = h("div", { class: "langsw", role: "group", "aria-label": LANG === "ar" ? "اللغة" : LANG === "es" ? "Idioma" : "Language" },
      langOpt("es", "ES", "Español"), langOpt("en", "EN", "English"), langOpt("ar", "ع", "العربية"));
    const panel = h("div", { class: "panel", dir: L.dir, lang: LANG },
      h("header", null, h("div", { class: "logo" }, icon("logo", 26)), h("h2", null, L.title), langSw, closeBtn),
      h("div", { class: "body" }, h("nav", { class: "tabs" }, tabBtns), G.forms.map((f) => f.el)),
      h("footer", null, h("span", null, "v" + WAAS.VERSION), h("span", { style: "display:flex;gap:2px" }, logBtn, saveLogBtn)),
      logBox);
    const overlay = h("div", { class: "overlay", style: "display:none" }, panel);
    root.append(overlay);

    const showEntry = (e) => {
      logBox.append(h("div", { class: e.level === "error" ? "e" : e.level === "warn" ? "w" : "" },
        e.ts.slice(11, 19) + " " + e.event + (e.data != null ? " " + JSON.stringify(e.data).slice(0, 260) : "")));
      while (logBox.childNodes.length > 200) logBox.firstChild.remove();
      logBox.scrollTop = logBox.scrollHeight;
    };
    WAAS.entries.slice(-30).forEach(showEntry);
    const offLog = WAAS.onLog(showEntry);

    const open = () => {
      panel.classList.toggle("dark", isDark());
      overlay.style.display = "";
      G.forms[active].show(true);
      log("info", "ui:abrir", null);
    };
    function close(force) {
      if (G.busy && force !== true) return;
      G.forms.forEach((f) => f.stop());
      overlay.style.display = "none";
    }
    const toggle = () => (overlay.style.display === "none" ? open() : close());
    WAAS.togglePanel = toggle;
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    // Removes this panel completely (used when switching language).
    unmount = () => { close(true); if (offLog) offLog(); host.remove(); };

    selectTab(active);
    log("info", "ui:montada", { idioma: LANG });
    window.postMessage({ __waas: "uiReady" }, location.origin);
  }

  // Listen once for the extension button, whatever panel is mounted now.
  window.addEventListener("message", (ev) => {
    if (ev.source === window && ev.data && ev.data.__waas === "togglePanel" && WAAS.togglePanel) WAAS.togglePanel();
  });

  WAAS.mountUI = mount;
})();
