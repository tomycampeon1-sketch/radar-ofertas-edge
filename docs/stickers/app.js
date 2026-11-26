import { webpEncodeSupported, canvasToBlob, encodeFrameChunks, muxAnimatedWebP } from './webp.js';
import {
  audioCtx, decodeFile, processAudio, encodeMP3, encodeWAV, drawWave,
  EFFECTS, renderEffect, VOICES, outputDuration, MAX_AUDIO,
} from './audio.js';

const S = 512;               // tamaño oficial de sticker de WhatsApp
const MAX_CLIP = 5;          // WhatsApp toma 5 s de un video para el sticker
const FPS = 15;
const $ = id => document.getElementById(id);

// ---------------- Estado ----------------
const st = {
  media: null,      // {type:'image'|'video'|'anim', src, w, h, file, el, frames, total, duration}
  zoom: 1, x: 0, y: 0, rot: 0,
  shape: 'free',
  removeBg: false, tol: 40,
  outline: true, outlineColor: '#ffffff', outlineW: 10,
  textTop: '', textBottom: '', textColor: '#ffffff', textSize: 62,
  clipStart: 0, clipLen: 3,
  audio: null,      // {buffer, name}
  aStart: 0, aLen: 3, vol: 1, voice: 'normal', normalize: true, fade: true,
  bg: '#ffffff',
  results: null,
};

const preview = $('preview');
const pctx = preview.getContext('2d');
let dirty = true;
const markDirty = () => { dirty = true; st.results = null; };

// ---------------- Utilidades ----------------
function toast(msg, ms = 3200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
const fmtS = s => `${s.toFixed(1)} s`;
const fmtKB = b => (b > 1024 * 1024 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

// ---------------- Quitar fondo (relleno desde los bordes) ----------------
function removeBackground(canvas, tol) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = canvas;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  // Color de fondo = el más común en el borde (cuantizado)
  const counts = new Map();
  const sample = i => {
    if (d[i + 3] < 20) return;
    const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
    counts.set(k, (counts.get(k) || 0) + 1);
  };
  for (let x = 0; x < w; x++) { sample(x * 4); sample(((h - 1) * w + x) * 4); }
  for (let y = 0; y < h; y++) { sample(y * w * 4); sample((y * w + w - 1) * 4); }
  if (!counts.size) return;
  let best = 0, bk = 0;
  counts.forEach((v, k) => { if (v > best) { best = v; bk = k; } });
  const br = ((bk >> 8) << 4) + 8, bgc = (((bk >> 4) & 15) << 4) + 8, bb = ((bk & 15) << 4) + 8;
  const t2 = tol * tol * 3, soft2 = (tol * 1.5) ** 2 * 3;
  const dist = p => { const r = d[p] - br, gg = d[p + 1] - bgc, b = d[p + 2] - bb; return r * r + gg * gg + b * b; };
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = i => { if (!seen[i]) { seen[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const i = stack[--sp];
    const p = i * 4;
    const dd = dist(p);
    if (dd > soft2) continue;
    if (dd > t2) { // borde suave
      d[p + 3] = Math.min(d[p + 3], Math.round(255 * (dd - t2) / (soft2 - t2)));
      continue;
    }
    d[p + 3] = 0;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < w * (h - 1)) push(i + w);
  }
  g.putImageData(img, 0, 0);
}

// ---------------- Render del sticker ----------------
const layer = mk(S, S), sil = mk(S, S);
let srcCache = { key: null, src: null, canvas: null };

// Fuente escalada (máx. 768 px) y, si corresponde, sin fondo.
const scratch = mk(1, 1);
function workSource(src, w, h, cacheable) {
  const k = Math.min(1, 768 / Math.max(w, h));
  if (!st.removeBg && k === 1) return { c: src, k: 1 };
  const key = `${st.removeBg}|${st.tol}`;
  if (cacheable && srcCache.src === src && srcCache.key === key) return { c: srcCache.canvas, k };
  const c = cacheable ? mk(1, 1) : scratch;
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  if (st.removeBg) removeBackground(c, st.tol);
  if (cacheable) srcCache = { key, src, canvas: c };
  return { c, k };
}

function margin() { return (st.outline ? st.outlineW : 0) + 10; }

function renderSticker(ctx, src, w, h, { bg = null, cacheable = false } = {}) {
  ctx.clearRect(0, 0, S, S);
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S); }
  if (!src) return;
  const m = margin();
  const inner = S - 2 * m;
  const { c, k } = workSource(src, w, h, cacheable);
  const scale = (Math.min(inner / w, inner / h) * st.zoom) / k;

  const g = layer.getContext('2d');
  g.save();
  g.clearRect(0, 0, S, S);
  if (st.shape !== 'free') {
    g.beginPath();
    if (st.shape === 'circle') g.arc(S / 2, S / 2, inner / 2, 0, Math.PI * 2);
    else if (g.roundRect) g.roundRect(m, m, inner, inner, inner * 0.18);
    else g.rect(m, m, inner, inner);
    g.clip();
  }
  g.translate(S / 2 + st.x, S / 2 + st.y);
  g.rotate((st.rot * Math.PI) / 180);
  g.drawImage(c, (-c.width * scale) / 2, (-c.height * scale) / 2, c.width * scale, c.height * scale);
  g.restore();

  if (st.outline && st.outlineW > 0) {
    const sg = sil.getContext('2d');
    sg.globalCompositeOperation = 'source-over';
    sg.clearRect(0, 0, S, S);
    sg.drawImage(layer, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = st.outlineColor;
    sg.fillRect(0, 0, S, S);
    sg.globalCompositeOperation = 'source-over';
    const r = st.outlineW, steps = 24;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      ctx.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.drawImage(sil, 0, 0);
  }
  ctx.drawImage(layer, 0, 0);
  drawText(ctx);
}

function drawText(ctx) {
  const lines = [[st.textTop, 'top'], [st.textBottom, 'bottom']];
  for (const [txt, pos] of lines) {
    if (!txt.trim()) continue;
    const t = txt.toUpperCase();
    let size = st.textSize;
    const maxW = S - 36;
    const font = sz => `900 ${sz}px Impact, "Arial Black", "Helvetica Neue", sans-serif`;
    ctx.font = font(size);
    while (ctx.measureText(t).width > maxW && size > 16) { size -= 2; ctx.font = font(size); }
    ctx.textAlign = 'center';
    ctx.textBaseline = pos === 'top' ? 'top' : 'bottom';
    const y = pos === 'top' ? 16 : S - 16;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(4, size / 5.5);
    ctx.strokeStyle = '#000';
    ctx.strokeText(t, S / 2, y);
    ctx.fillStyle = st.textColor;
    ctx.fillText(t, S / 2, y);
  }
}

// ---------------- Fuente en el tiempo ----------------
function animFrameAt(t) {
  const m = st.media;
  let tt = ((t % m.total) + m.total) % m.total;
  for (const f of m.frames) { if (tt < f.dur) return f.bmp; tt -= f.dur; }
  return m.frames[m.frames.length - 1].bmp;
}

function hasMotion() { return st.media && st.media.type !== 'image'; }
function clipDuration() { return hasMotion() ? st.clipLen : 0; }

// ---------------- Vista previa ----------------
let loopStart = performance.now();
function frame() {
  const m = st.media;
  if (m) {
    if (m.type === 'image') {
      if (dirty) { renderSticker(pctx, m.src, m.w, m.h, { cacheable: true }); dirty = false; }
    } else if (m.type === 'anim') {
      const t = st.clipStart + (((performance.now() - loopStart) / 1000) % st.clipLen);
      renderSticker(pctx, animFrameAt(t), m.w, m.h);
    } else if (m.type === 'video') {
      const v = m.el;
      if (!v.seeking && (v.currentTime >= st.clipStart + st.clipLen || v.currentTime < st.clipStart - 0.3)) {
        v.currentTime = st.clipStart;
      }
      if (v.paused && !v.seeking) v.play().catch(() => {});
      if (v.readyState >= 2) renderSticker(pctx, v, m.w, m.h);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------------- Cargar imagen / GIF / video ----------------
async function loadMedia(file) {
  if (!file) return;
  stopVideo();
  srcCache = { key: null, src: null, canvas: null };
  st.x = 0; st.y = 0; st.zoom = 1; st.rot = 0;
  ['zoom', 'rot'].forEach(id => { $(id).value = st[id]; });
  try {
    if (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v|3gp|mkv)$/i.test(file.name)) {
      await loadVideo(file);
    } else {
      const anim = await tryAnimated(file);
      if (!anim) {
        const bmp = await loadImage(file);
        st.media = { type: 'image', src: bmp, w: bmp.width, h: bmp.height, file };
      }
    }
  } catch (e) {
    console.error(e);
    toast('No pude abrir ese archivo: ' + e.message);
    return;
  }
  const m = st.media;
  $('emptyHint').hidden = true;
  $('dragHint').hidden = false;
  $('mediaControls').hidden = false;
  $('clipControls').hidden = m.type === 'image';
  $('videoAudioBtn').hidden = m.type !== 'video';
  const kind = { image: 'Imagen', anim: 'Animación', video: 'Video' }[m.type];
  $('mediaInfo').textContent = `${kind} · ${m.w}×${m.h}${m.duration ? ' · ' + fmtS(m.duration) : ''} · ${file.name}`;
  if (m.type !== 'image') {
    const total = m.type === 'video' ? m.duration : m.total;
    st.clipStart = 0;
    st.clipLen = Math.min(MAX_CLIP, Math.max(0.5, total));
    $('clipStart').max = Math.max(0, total - 0.5).toFixed(1);
    $('clipStart').value = 0;
    $('clipLen').max = Math.min(MAX_CLIP, total).toFixed(1);
    $('clipLen').value = st.clipLen;
  }
  loopStart = performance.now();
  syncOutputs();
  markDirty();
  updateButtons();
}

async function loadImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return await createImageBitmap(img);
  }
}

async function tryAnimated(file) {
  const type = file.type || (/\.gif$/i.test(file.name) ? 'image/gif' : '');
  if (!/image\/(gif|webp|png|apng|avif)/.test(type) || !('ImageDecoder' in window)) {
    if (type === 'image/gif') toast('Tu navegador solo muestra el primer cuadro del GIF. Usá Chrome para GIF animados.');
    return false;
  }
  try {
    if (!(await ImageDecoder.isTypeSupported(type))) return false;
    const dec = new ImageDecoder({ data: await file.arrayBuffer(), type });
    await dec.tracks.ready;
    const track = dec.tracks.selectedTrack;
    if (!track || track.frameCount < 2) { dec.close(); return false; }
    const n = Math.min(track.frameCount, 300);
    const frames = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const { image } = await dec.decode({ frameIndex: i });
      const dur = Math.max(0.02, (image.duration || 100000) / 1e6);
      frames.push({ bmp: await createImageBitmap(image), dur });
      total += dur;
      image.close();
    }
    dec.close();
    st.media = { type: 'anim', frames, total, w: frames[0].bmp.width, h: frames[0].bmp.height, file, duration: total };
    return true;
  } catch (e) {
    console.warn('ImageDecoder falló', e);
    return false;
  }
}

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('playsinline', '');
    v.src = URL.createObjectURL(file);
    v.onloadeddata = () => {
      st.media = { type: 'video', el: v, w: v.videoWidth, h: v.videoHeight, duration: v.duration, file };
      resolve();
    };
    v.onerror = () => reject(new Error('formato de video no soportado por el navegador'));
    v.load();
  });
}

function stopVideo() {
  if (st.media?.type === 'video') { st.media.el.pause(); URL.revokeObjectURL(st.media.el.src); }
}

// ---------------- Sonido ----------------
async function setAudio(buffer, name, { keepWhole = false } = {}) {
  st.audio = { buffer, name };
  st.aStart = 0;
  st.aLen = Math.min(buffer.duration, MAX_AUDIO);
  if (!keepWhole && hasMotion() && st.media.type === 'video' && name === 'Sonido del video') {
    st.aStart = Math.min(st.clipStart, Math.max(0, buffer.duration - 0.3));
    st.aLen = Math.min(st.clipLen, buffer.duration - st.aStart);
  }
  $('aStart').max = Math.max(0, buffer.duration - 0.3).toFixed(2);
  $('aStart').value = st.aStart;
  $('aLen').max = Math.min(MAX_AUDIO, buffer.duration).toFixed(2);
  $('aLen').value = st.aLen;
  $('audioControls').hidden = false;
  $('audioInfo').textContent = `${name} · ${fmtS(buffer.duration)}${buffer.duration > MAX_AUDIO ? ' (elegí el pedazo de hasta 10 s)' : ''}`;
  $('soundBadge').hidden = false;
  syncOutputs();
  redrawWave();
  st.results = null;
  updateButtons();
}

function redrawWave() {
  drawWave($('wave'), st.audio?.buffer, st.aStart, st.aLen, getComputedStyle(document.documentElement).getPropertyValue('--accent-strong').trim() || '#25d366');
}

async function processed() {
  if (!st.audio) return null;
  return processAudio(st.audio.buffer, {
    start: st.aStart, len: st.aLen, volume: st.vol, voice: st.voice, fade: st.fade, normalize: st.normalize,
  });
}

let playing = null;
function stopPlayback() {
  if (playing) { try { playing.stop(); } catch {} playing = null; }
}
async function playBuffer(buf) {
  stopPlayback();
  const ac = audioCtx();
  await ac.resume();
  const s = ac.createBufferSource();
  s.buffer = buf;
  s.connect(ac.destination);
  s.start();
  playing = s;
  s.onended = () => { if (playing === s) playing = null; };
}

// Grabación
let recorder = null, recTimer = null;
async function toggleRecord() {
  const btn = $('recBtn');
  if (recorder) { recorder.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
    recorder.onstop = async () => {
      clearInterval(recTimer);
      stream.getTracks().forEach(t => t.stop());
      btn.classList.remove('rec');
      btn.textContent = '🎙️ Grabar de nuevo';
      recorder = null;
      try {
        const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
        const buf = await decodeFile(blob);
        await setAudio(buf, 'Tu grabación');
        // Saltar el silencio del principio
        trimLeadingSilence();
        clearFx();
      } catch (e) { toast('No se pudo usar la grabación: ' + e.message); }
    };
    recorder.start();
    const t0 = Date.now();
    btn.classList.add('rec');
    btn.textContent = '⏹ Detener (0 s)';
    recTimer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      btn.textContent = `⏹ Detener (${s} s)`;
      if (s >= 15) recorder?.stop();
    }, 250);
  } catch (e) {
    toast('Necesito permiso para usar el micrófono.');
  }
}

function trimLeadingSilence() {
  const b = st.audio.buffer, d = b.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const th = peak * 0.08;
  let i = 0;
  while (i < d.length && Math.abs(d[i]) < th) i++;
  const start = Math.max(0, i / b.sampleRate - 0.08);
  if (start > 0.15) {
    st.aStart = start;
    st.aLen = Math.min(MAX_AUDIO, b.duration - start);
    $('aStart').value = st.aStart; $('aLen').value = st.aLen;
    syncOutputs(); redrawWave();
  }
}

function clearFx() { document.querySelectorAll('#fxGrid button').forEach(b => b.classList.remove('on')); }

// ---------------- Exportar ----------------
function setProgress(p, text) {
  const el = $('progress');
  el.hidden = p == null;
  if (p == null) return;
  el.firstElementChild.style.width = `${Math.round(p * 100)}%`;
  el.lastElementChild.textContent = text;
}

/** Lista de cuadros de la fuente para exportar (ImageBitmaps / imagen fija). */
async function sourceFrames(fps, onProg) {
  const m = st.media;
  if (m.type === 'image') return [m.src];
  const n = Math.max(1, Math.round(st.clipLen * fps));
  if (m.type === 'anim') {
    return Array.from({ length: n }, (_, i) => animFrameAt(st.clipStart + i / fps));
  }
  // video: buscar cada cuadro
  const v = m.el;
  v.pause();
  const k = Math.min(1, 640 / Math.max(m.w, m.h));
  const out = [];
  for (let i = 0; i < n; i++) {
    await seek(v, Math.min(m.duration - 0.01, st.clipStart + i / fps));
    out.push(await createImageBitmap(v, { resizeWidth: Math.round(m.w * k), resizeHeight: Math.round(m.h * k), resizeQuality: 'medium' }).catch(() => createImageBitmap(v)));
    onProg?.(i / n);
  }
  return out;
}

function seek(v, t) {
  return new Promise(res => {
    const done = () => { v.removeEventListener('seeked', done); res(); };
    v.addEventListener('seeked', done);
    v.currentTime = t;
    setTimeout(done, 1500);
  });
}

/** Dibuja cada cuadro del sticker una sola vez (transparente). */
async function renderAll(frames, onProg) {
  const m = st.media;
  const fw = frames[0].width || m.w, fh = frames[0].height || m.h;
  const out = [];
  for (let i = 0; i < frames.length; i++) {
    const c = mk(S, S);
    renderSticker(c.getContext('2d'), frames[i], fw, fh, { cacheable: m.type === 'image' });
    out.push(c);
    if (i % 5 === 4) { onProg?.(i / frames.length); await new Promise(r => setTimeout(r)); }
  }
  return out;
}

async function makeWebP(drawn, fps, onProg) {
  const canWebP = webpEncodeSupported();
  if (drawn.length === 1) {
    const c = drawn[0];
    if (!canWebP) return { blob: await canvasToBlob(c, 'image/png'), ext: 'png', note: 'Tu navegador no genera WebP; usá Chrome para el formato sticker.' };
    for (const q of [0.92, 0.8, 0.65, 0.5, 0.35, 0.2]) {
      const b = await canvasToBlob(c, 'image/webp', q);
      if (b.size <= 100 * 1024) return { blob: b, ext: 'webp' };
    }
    return { blob: await canvasToBlob(c, 'image/webp', 0.1), ext: 'webp' };
  }
  if (!canWebP) return null;
  // Animado: probar calidad y cuadros por segundo hasta quedar bajo 500 KB.
  // Se estima el tamaño con algunos cuadros para no codificar todo de más.
  const tries = [[0.75, fps], [0.55, fps], [0.45, 12], [0.35, 10], [0.25, 8], [0.15, 6]];
  for (let t = 0; t < tries.length; t++) {
    const [q, f] = tries[t];
    const step = fps / f;
    const idx = [];
    for (let i = 0; i < drawn.length; i += step) idx.push(Math.floor(i));
    if (t < tries.length - 1 && idx.length > 12) {
      const probe = idx.filter((_, k) => k % Math.ceil(idx.length / 6) === 0);
      let bytes = 0;
      for (const i of probe) bytes += (await encodeFrameChunks(drawn[i], q)).reduce((n, c) => n + c.data.length + 8, 0);
      if ((bytes / probe.length) * idx.length > 560 * 1024) continue;
    }
    const parts = [];
    for (let k = 0; k < idx.length; k++) {
      parts.push({ chunks: await encodeFrameChunks(drawn[idx[k]], q), duration: 1000 / f });
      onProg?.(k / idx.length);
    }
    const blob = muxAnimatedWebP(parts, S, S);
    if (blob.size <= 500 * 1024) return { blob, ext: 'webp' };
  }
  return null;
}

function pickVideoMime() {
  // H.264 + AAC es lo más compatible con WhatsApp; después H.264 + Opus; WebM como último recurso
  const opts = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1,mp4a',
    'video/mp4;codecs=avc1.42E01E,opus', 'video/mp4;codecs=avc1,opus', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
  return opts.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
}

/** Graba en tiempo real el sticker animado + el audio en un video 512×512. */
async function makeVideo(stickers, fps, audioBuf, onProg) {
  if (!window.MediaRecorder || !preview.captureStream) return null;
  const mime = pickVideoMime();
  const dur = hasMotion() ? Math.min(st.clipLen, MAX_CLIP) : Math.min(Math.max(audioBuf ? audioBuf.duration : 3, 1), MAX_CLIP);
  const c = mk(S, S), g = c.getContext('2d');
  // Cuadros con el fondo ya puesto (así la grabación no se traba)
  const drawn = stickers.map(sc => {
    const fc = mk(S, S), fg = fc.getContext('2d');
    fg.fillStyle = st.bg; fg.fillRect(0, 0, S, S); fg.drawImage(sc, 0, 0);
    return fc;
  });
  g.drawImage(drawn[0], 0, 0);

  const ac = audioCtx();
  await ac.resume();
  const dest = ac.createMediaStreamDestination();
  const vStream = c.captureStream(fps);
  const tracks = [...vStream.getVideoTracks()];
  if (audioBuf) tracks.push(...dest.stream.getAudioTracks());
  const rec = new MediaRecorder(new MediaStream(tracks), {
    ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000,
  });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(r => (rec.onstop = r));

  let src = null;
  if (audioBuf) { src = ac.createBufferSource(); src.buffer = audioBuf; src.connect(dest); }
  rec.start(250);
  // El reloj es el del sistema: el de audio puede ir a otra velocidad en algunos equipos
  src?.start();
  const t0 = performance.now();
  let tick = 0;
  await new Promise(resolve => {
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (t >= dur) return resolve();
      const idx = t < 0 ? 0 : Math.floor(t * fps) % drawn.length;
      g.drawImage(drawn[idx], 0, 0);
      // forzar un cuadro nuevo aunque la imagen sea fija
      g.fillStyle = (tick++ & 1) ? 'rgba(0,0,0,0.004)' : 'rgba(255,255,255,0.004)';
      g.fillRect(0, 0, 1, 1);
      onProg?.(Math.max(0, t / dur));
      requestAnimationFrame(loop);
    };
    loop();
  });
  src?.stop();
  rec.stop();
  await stopped;
  const type = (mime || chunks[0]?.type || 'video/webm').split(';')[0];
  return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm', dur };
}

async function create() {
  if (!st.media) return;
  const btn = $('createBtn');
  btn.disabled = true;
  stopPlayback();
  $('results').innerHTML = '';
  $('comboWrap').hidden = true;
  const res = [];
  try {
    setProgress(0.02, 'Preparando…');
    const audioBuf = await processed();
    const frames = await sourceFrames(FPS, p => setProgress(0.02 + p * 0.25, 'Leyendo el video…'));

    // 1) Audio
    let audioFile = null;
    if (audioBuf) {
      setProgress(0.3, 'Creando el audio…');
      let blob, ext = 'mp3';
      try { blob = encodeMP3(audioBuf); } catch { blob = encodeWAV(audioBuf); ext = 'wav'; }
      audioFile = new File([blob], `sonido-sticker-${stamp()}.${ext}`, { type: blob.type });
    }

    // 2) Sticker WebP
    const drawn = await renderAll(frames, p => setProgress(0.3 + p * 0.1, 'Dibujando el sticker…'));
    const wp = await makeWebP(drawn, FPS, p => setProgress(0.4 + p * 0.1, 'Creando el sticker…'));
    let webpFile = null;
    if (wp) webpFile = new File([wp.blob], `sticker-${stamp()}.${wp.ext}`, { type: wp.blob.type });

    // 3) PNG transparente (para sticker con sonido desde imagen)
    let pngFile = null;
    if (st.media.type === 'image') {
      const b = await canvasToBlob(drawn[0], 'image/png');
      pngFile = new File([b], `sticker-${stamp()}.png`, { type: 'image/png' });
    }

    // 4) Video con sonido
    setProgress(0.5, 'Grabando el video con sonido (no cierres la pantalla)…');
    const vid = await makeVideo(drawn, FPS, audioBuf, p => setProgress(0.5 + p * 0.48, 'Grabando el video con sonido (no cierres la pantalla)…'));
    let videoFile = null;
    if (vid) videoFile = new File([vid.blob], `sticker-sonido-${stamp()}.${vid.ext}`, { type: vid.blob.type });

    // Tarjetas
    const motion = hasMotion();
    if (videoFile) res.push({ file: videoFile, star: motion, icon: '🎬',
      title: motion ? 'Video con sonido (para sticker con sonido)' : 'Video con sonido',
      desc: `512×512 · ${fmtS(vid.dur)} · ${fmtKB(videoFile.size)}${vid.ext === 'webm' ? ' · WebM: para MP4 usá Chrome en Android o Safari' : ''}${audioBuf && audioBuf.duration > MAX_CLIP + 0.05 ? ' · el video lleva 5 s de sonido; para los 10 s usá el MP3' : ''}` });
    if (pngFile) res.push({ file: pngFile, star: true, icon: '🖼️', title: 'Imagen transparente (para sticker con sonido)', desc: `512×512 PNG · ${fmtKB(pngFile.size)} · en WhatsApp le agregás el MP3 (hasta 10 s)` });
    if (audioFile) res.push({ file: audioFile, star: true, icon: '🔊', title: `Audio ${audioFile.name.endsWith('.mp3') ? 'MP3' : 'WAV'} (para "Importar" en WhatsApp)`, desc: `${fmtS(audioBuf.duration)} · ${fmtKB(audioFile.size)}` });
    if (webpFile) res.push({ file: webpFile, icon: '🟩', title: `Sticker ${wp.ext.toUpperCase()}${motion ? ' animado' : ''} (sin sonido)`, desc: `512×512 · ${fmtKB(webpFile.size)} · listo para enviar como sticker${wp.note ? ' · ' + wp.note : ''}` });
    else if (motion) res.push({ icon: '⚠️', title: 'Sticker WebP animado', desc: 'Tu navegador no puede generar WebP animado (usá Chrome). El video con sonido sí sirve.' });

    st.results = { audioFile, webpFile, pngFile, videoFile };
    showResults(res);
    $('comboWrap').hidden = !(audioFile && (webpFile || pngFile));
    setProgress(1, '¡Listo! 🎉');
    setTimeout(() => setProgress(null), 2500);
    if (!audioBuf) toast('Ojo: no elegiste sonido, el sticker va a quedar mudo.');
    $('results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) {
    console.error(e);
    setProgress(null);
    toast('Algo falló al crear: ' + e.message, 5000);
  } finally {
    btn.disabled = false;
    if (st.media?.type === 'video') st.media.el.play().catch(() => {});
  }
}

function showResults(items) {
  const wrap = $('results');
  wrap.innerHTML = '';
  for (const it of items) {
    const el = document.createElement('div');
    el.className = 'result' + (it.star ? ' star' : '');
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (it.file?.type.startsWith('image/')) {
      const img = document.createElement('img'); img.src = URL.createObjectURL(it.file); img.alt = ''; thumb.appendChild(img);
    } else if (it.file?.type.startsWith('video/')) {
      const v = document.createElement('video'); v.src = URL.createObjectURL(it.file); v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true;
      thumb.appendChild(v);
    } else thumb.textContent = it.icon;
    const body = document.createElement('div');
    body.innerHTML = `<h3></h3><p></p><div class="acts"></div>`;
    body.querySelector('h3').textContent = it.title;
    body.querySelector('p').textContent = it.desc;
    const acts = body.querySelector('.acts');
    if (it.file) {
      if (it.file.type.startsWith('audio/') || it.file.type.startsWith('video/')) {
        const pb = document.createElement('button');
        pb.textContent = '▶';
        pb.title = 'Reproducir';
        let media;
        pb.onclick = () => {
          if (media && !media.paused) { media.pause(); pb.textContent = '▶'; return; }
          media = media || (it.file.type.startsWith('video/') ? thumb.querySelector('video') : new Audio(URL.createObjectURL(it.file)));
          media.muted = false; media.currentTime = 0; media.play(); pb.textContent = '⏸';
          media.onended = () => (pb.textContent = '▶');
        };
        acts.appendChild(pb);
      }
      if (canShare([it.file])) {
        const sb = document.createElement('button');
        sb.className = 'primary'; sb.textContent = '📤 Compartir';
        sb.onclick = () => share([it.file]);
        acts.appendChild(sb);
      }
      const a = document.createElement('a');
      a.className = 'btn'; a.textContent = '⬇ Descargar';
      a.href = URL.createObjectURL(it.file); a.download = it.file.name;
      acts.appendChild(a);
    }
    el.append(thumb, body);
    wrap.appendChild(el);
  }
}

function canShare(files) {
  try { return !!navigator.canShare && navigator.canShare({ files }); } catch { return false; }
}
async function share(files) {
  try {
    await navigator.share({ files });
  } catch (e) {
    if (e.name !== 'AbortError') toast('No se pudo compartir: usá Descargar.');
  }
}

// ---------------- Controles ----------------
function syncOutputs() {
  $('zoomOut').textContent = `${Math.round(st.zoom * 100)}%`;
  $('rotOut').textContent = `${st.rot}°`;
  $('tolOut').textContent = st.tol;
  $('clipStartOut').textContent = fmtS(st.clipStart);
  $('clipLenOut').textContent = fmtS(st.clipLen);
  $('aStartOut').textContent = fmtS(st.aStart);
  const outD = outputDuration(st.aLen, st.voice);
  $('aLenOut').textContent = fmtS(st.aLen) + (Math.abs(outD - st.aLen) > 0.05 ? ` → ${fmtS(outD)}` : '');
  $('volOut').textContent = `${Math.round(st.vol * 100)}%`;
}

function updateButtons() {
  $('createBtn').disabled = !st.media;
  $('playBtn').disabled = !st.media && !st.audio;
  $('createBtn').textContent = st.audio ? '✨ Crear sticker con sonido' : '✨ Crear sticker (falta el sonido)';
}

function bindRange(id, key, { parse = parseFloat, after } = {}) {
  $(id).addEventListener('input', e => {
    st[key] = parse(e.target.value);
    syncOutputs();
    after?.();
  });
}

bindRange('zoom', 'zoom', { after: markDirty });
bindRange('rot', 'rot', { parse: v => parseInt(v, 10), after: markDirty });
bindRange('tol', 'tol', { parse: v => parseInt(v, 10), after: () => { srcCache.key = null; markDirty(); } });
bindRange('outlineW', 'outlineW', { parse: v => parseInt(v, 10), after: markDirty });
bindRange('textSize', 'textSize', { parse: v => parseInt(v, 10), after: markDirty });
bindRange('clipStart', 'clipStart', { after: () => {
  const total = st.media.type === 'video' ? st.media.duration : st.media.total;
  if (st.clipStart + st.clipLen > total) { st.clipLen = Math.max(0.5, total - st.clipStart); $('clipLen').value = st.clipLen; syncOutputs(); }
  if (st.media.type === 'video') st.media.el.currentTime = st.clipStart;
  loopStart = performance.now(); markDirty();
} });
bindRange('clipLen', 'clipLen', { after: () => { loopStart = performance.now(); markDirty(); } });
bindRange('aStart', 'aStart', { after: () => {
  const max = st.audio.buffer.duration - st.aStart;
  if (st.aLen > max) { st.aLen = Math.max(0.3, max); $('aLen').value = st.aLen; syncOutputs(); }
  redrawWave(); st.results = null;
} });
bindRange('aLen', 'aLen', { after: () => { redrawWave(); st.results = null; } });
bindRange('vol', 'vol', { after: () => (st.results = null) });

$('removeBg').addEventListener('change', e => { st.removeBg = e.target.checked; $('tolWrap').hidden = !st.removeBg; srcCache.key = null; markDirty(); });
$('outline').addEventListener('change', e => { st.outline = e.target.checked; $('outlineWrap').hidden = !st.outline; markDirty(); });
$('outlineColor').addEventListener('input', e => { st.outlineColor = e.target.value; markDirty(); });
$('textColor').addEventListener('input', e => { st.textColor = e.target.value; markDirty(); });
$('textTop').addEventListener('input', e => { st.textTop = e.target.value; markDirty(); });
$('textBottom').addEventListener('input', e => { st.textBottom = e.target.value; markDirty(); });
$('normalize').addEventListener('change', e => { st.normalize = e.target.checked; st.results = null; });
$('fade').addEventListener('change', e => { st.fade = e.target.checked; st.results = null; });

function segment(id, onPick) {
  $(id).addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    $(id).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    onPick(b.dataset.v);
  });
}
segment('shapeSeg', v => { st.shape = v; markDirty(); });
segment('bgSeg', v => {
  $('bgColor').hidden = v !== 'custom';
  st.bg = v === 'custom' ? $('bgColor').value : v;
  st.results = null;
});
$('bgColor').addEventListener('input', e => { st.bg = e.target.value; });

$('mediaInput').addEventListener('change', e => { loadMedia(e.target.files[0]); e.target.value = ''; });
$('cameraInput').addEventListener('change', e => { loadMedia(e.target.files[0]); e.target.value = ''; });
$('audioInput').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { await setAudio(await decodeFile(f), f.name); clearFx(); }
  catch (err) { toast(err.message); }
});
$('videoAudioBtn').addEventListener('click', async () => {
  try { await setAudio(await decodeFile(st.media.file), 'Sonido del video'); clearFx(); }
  catch { toast('Ese video no tiene sonido o el navegador no lo puede leer.'); }
});
$('recBtn').addEventListener('click', toggleRecord);

const voiceChips = $('voiceChips');
for (const [k, v] of Object.entries(VOICES)) {
  const b = document.createElement('button');
  b.textContent = v.label; b.dataset.v = k;
  if (k === 'normal') b.classList.add('on');
  b.onclick = async () => {
    voiceChips.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    st.voice = k; syncOutputs(); st.results = null;
    if (st.audio) playBuffer(await processed());
  };
  voiceChips.appendChild(b);
}

const fxGrid = $('fxGrid');
for (const [k, v] of Object.entries(EFFECTS)) {
  const b = document.createElement('button');
  b.textContent = v.label;
  b.onclick = async () => {
    clearFx(); b.classList.add('on');
    const buf = await renderEffect(k);
    await setAudio(buf, v.label.replace(/^\S+\s/, 'Efecto: '));
    playBuffer(await processed());
  };
  fxGrid.appendChild(b);
}

$('listenBtn').addEventListener('click', async () => { if (st.audio) playBuffer(await processed()); });
async function playAll() {
  loopStart = performance.now();
  if (st.media?.type === 'video') st.media.el.currentTime = st.clipStart;
  if (st.audio) playBuffer(await processed());
  else toast('Todavía no elegiste un sonido (paso 2).');
}
$('playBtn').addEventListener('click', playAll);
$('soundBadge').addEventListener('click', playAll);
$('createBtn').addEventListener('click', create);
$('comboBtn').addEventListener('click', () => {
  const r = st.results;
  if (!r) return;
  const files = [r.webpFile || r.pngFile, r.audioFile].filter(Boolean);
  if (canShare(files)) share(files);
  else toast('Tu navegador no permite compartir varios archivos: descargalos y mandalos desde WhatsApp.');
});

// Arrastrar para mover, rueda / pellizco para zoom
(() => {
  const wrap = $('canvasWrap');
  const pts = new Map();
  let last = null, pinch = null;
  const ratio = () => S / wrap.clientWidth;
  wrap.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    wrap.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: st.zoom };
    }
  });
  wrap.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !st.media) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      st.zoom = Math.min(4, Math.max(0.3, pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d));
      $('zoom').value = st.zoom;
    } else if (pts.size === 1) {
      st.x += (e.clientX - last.x) * ratio();
      st.y += (e.clientY - last.y) * ratio();
      last = { x: e.clientX, y: e.clientY };
    }
    syncOutputs(); markDirty();
  });
  const up = e => { pts.delete(e.pointerId); pinch = null; const p = [...pts.values()][0]; if (p) last = { ...p }; };
  wrap.addEventListener('pointerup', up);
  wrap.addEventListener('pointercancel', up);
  wrap.addEventListener('wheel', e => {
    if (!st.media) return;
    e.preventDefault();
    st.zoom = Math.min(4, Math.max(0.3, st.zoom * (e.deltaY < 0 ? 1.06 : 0.94)));
    $('zoom').value = st.zoom; syncOutputs(); markDirty();
  }, { passive: false });
})();

// Onda: tocar para mover el inicio
$('wave').addEventListener('pointerdown', e => {
  if (!st.audio) return;
  const r = e.currentTarget.getBoundingClientRect();
  const t = ((e.clientX - r.left) / r.width) * st.audio.buffer.duration;
  st.aStart = Math.max(0, Math.min(t, st.audio.buffer.duration - 0.3));
  st.aLen = Math.min(st.aLen, st.audio.buffer.duration - st.aStart);
  $('aStart').value = st.aStart; $('aLen').value = st.aLen;
  syncOutputs(); redrawWave(); st.results = null;
});
window.addEventListener('resize', redrawWave);

// ---------------- PWA: instalar, offline y "compartir con" ----------------
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false; });
$('installBtn').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); installEvt = null; $('installBtn').hidden = true; });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

(async () => {
  const p = new URLSearchParams(location.search);
  if (!p.has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);
  const cache = await caches.open('share-inbox');
  for (const req of await cache.keys()) {
    const resp = await cache.match(req);
    const blob = await resp.blob();
    const name = decodeURIComponent(resp.headers.get('x-name') || 'archivo');
    const file = new File([blob], name, { type: blob.type });
    if (file.type.startsWith('audio/')) {
      try { await setAudio(await decodeFile(file), name); } catch (e) { toast(e.message); }
    } else await loadMedia(file);
    await cache.delete(req);
  }
})();

syncOutputs();
updateButtons();

// Para pruebas automáticas
window.__stickerApp = { st, loadMedia, setAudio, create, renderEffect };
