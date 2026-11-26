// Audio: decodificar, recortar, efectos de voz, efectos de sonido sintetizados
// (sin derechos de autor: se generan acá mismo) y exportar a MP3 / WAV.

export const SR = 44100;
export const MAX_AUDIO = 10; // WhatsApp acepta hasta 10 s de audio en un sticker

let ctx;
export function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

export async function decodeFile(file) {
  const ab = await file.arrayBuffer();
  return await new Promise((resolve, reject) => {
    // Forma con callbacks para Safari viejo
    const p = audioCtx().decodeAudioData(ab, resolve, () => reject(new Error('No se pudo leer el audio de ese archivo')));
    if (p && p.then) p.then(resolve, () => reject(new Error('No se pudo leer el audio de ese archivo')));
  });
}

export const VOICES = {
  normal: { label: 'Normal', rate: 1 },
  ardilla: { label: '🐿️ Ardilla', rate: 1.55 },
  monstruo: { label: '👹 Monstruo', rate: 0.68 },
  robot: { label: '🤖 Robot', rate: 1 },
  eco: { label: '🏔️ Eco', rate: 1 },
  radio: { label: '📻 Radio', rate: 1 },
  lento: { label: '🐢 Cámara lenta', rate: 0.8 },
  rapido: { label: '⚡ Rápido', rate: 1.3 },
};

/** Duración final (s) que tendrá el audio procesado. */
export function outputDuration(len, voice) {
  return Math.min(len / (VOICES[voice]?.rate || 1), MAX_AUDIO);
}

/**
 * Recorta y procesa el audio. Devuelve un AudioBuffer mono a 44.1 kHz.
 * opts: { start, len, volume (1 = 100%), voice, fade, normalize }
 */
export async function processAudio(buffer, opts) {
  const rate = VOICES[opts.voice]?.rate || 1;
  const start = Math.max(0, Math.min(opts.start, buffer.duration - 0.05));
  const len = Math.max(0.1, Math.min(opts.len, buffer.duration - start, MAX_AUDIO * rate));
  const outLen = Math.min(len / rate, MAX_AUDIO);
  const frames = Math.ceil(outLen * SR);
  const oac = new OfflineAudioContext(1, frames, SR);

  const src = oac.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = rate;

  const out = oac.createGain();
  const vol = opts.volume ?? 1;
  if (opts.fade) {
    const f = Math.min(0.08, outLen / 4);
    out.gain.setValueAtTime(0, 0);
    out.gain.linearRampToValueAtTime(vol, f);
    out.gain.setValueAtTime(vol, Math.max(f, outLen - f * 2));
    out.gain.linearRampToValueAtTime(0, outLen);
  } else {
    out.gain.value = vol;
  }
  out.connect(oac.destination);

  if (opts.voice === 'robot') {
    // Modulación en anillo: la voz multiplicada por una onda de 55 Hz
    const ring = oac.createGain();
    ring.gain.value = 0;
    const osc = oac.createOscillator();
    osc.frequency.value = 55;
    const depth = oac.createGain();
    depth.gain.value = 1.4;
    osc.connect(depth).connect(ring.gain);
    osc.start(0);
    src.connect(ring).connect(out);
  } else if (opts.voice === 'eco') {
    const delay = oac.createDelay(1);
    delay.delayTime.value = 0.22;
    const fb = oac.createGain();
    fb.gain.value = 0.42;
    src.connect(out);
    src.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(out);
  } else if (opts.voice === 'radio') {
    const bp = oac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 0.9;
    const sh = oac.createWaveShaper();
    sh.curve = distortionCurve(18);
    src.connect(bp).connect(sh).connect(out);
  } else {
    src.connect(out);
  }

  src.start(0, start, len);
  const rendered = await oac.startRendering();
  if (opts.normalize) normalize(rendered, 0.97);
  return rendered;
}

function distortionCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    c[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return c;
}

export function normalize(buf, target = 0.97) {
  let peak = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  }
  if (peak < 1e-4) return;
  const g = Math.min(target / peak, 8);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= g;
  }
}

// ---------- Exportar ----------

export function encodeMP3(buffer, kbps = 128) {
  if (!window.lamejs) throw new Error('Codificador MP3 no disponible');
  const data = buffer.getChannelData(0);
  const pcm = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const enc = new window.lamejs.Mp3Encoder(1, buffer.sampleRate, kbps);
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152) {
    const out = enc.encodeBuffer(pcm.subarray(i, i + 1152));
    if (out.length) parts.push(new Uint8Array(out));
  }
  const end = enc.flush();
  if (end.length) parts.push(new Uint8Array(end));
  return new Blob(parts, { type: 'audio/mpeg' });
}

export function encodeWAV(buffer) {
  const data = buffer.getChannelData(0);
  const ab = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(ab);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + data.length * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([ab], { type: 'audio/wav' });
}

// ---------- Forma de onda ----------

export function drawWave(canvas, buffer, selStart, selLen, accent) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, w, h);
  if (!buffer) return;
  const d = buffer.getChannelData(0);
  const dur = buffer.duration;
  const x0 = (selStart / dur) * w, x1 = (Math.min(dur, selStart + selLen) / dur) * w;
  g.fillStyle = accent + '33';
  g.fillRect(x0, 0, x1 - x0, h);
  const step = Math.max(1, Math.floor(d.length / w));
  for (let x = 0; x < w; x++) {
    let mn = 1, mx = -1;
    const base = x * step;
    for (let i = 0; i < step; i += 4) {
      const s = d[base + i] || 0;
      if (s < mn) mn = s; if (s > mx) mx = s;
    }
    g.fillStyle = x >= x0 && x <= x1 ? accent : '#8888';
    const y0 = ((1 - mx) / 2) * h, y1 = ((1 - mn) / 2) * h;
    g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
  }
  g.fillStyle = accent;
  g.fillRect(x0, 0, 2 * dpr, h);
  g.fillRect(x1 - 2 * dpr, 0, 2 * dpr, h);
}

// ---------- Efectos de sonido (sintetizados) ----------

function noiseBuffer(c, secs) {
  const b = c.createBuffer(1, Math.ceil(secs * c.sampleRate), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function env(param, t, a, peak, dec, end = 0.0001) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + a);
  param.exponentialRampToValueAtTime(end, t + a + dec);
}

function tone(c, dest, { type = 'sine', f0, f1, t = 0, dur, peak = 0.5, attack = 0.005, curve = 'exp' }) {
  const o = c.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1) curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(f1, t + dur) : o.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = c.createGain(); env(g.gain, t, attack, peak, dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + attack + dur + 0.05);
  return o;
}

function noiseHit(c, dest, { t = 0, dur = 0.1, peak = 0.5, type = 'highpass', freq = 2000, q = 0.7 }) {
  const s = c.createBufferSource(); s.buffer = noiseBuffer(c, dur + 0.1);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); env(g.gain, t, 0.002, peak, dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t); s.stop(t + dur + 0.1);
}

export const EFFECTS = {
  boing: { label: '🪀 Boing', dur: 1.1, make(c, o) {
    const osc = c.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(320, 0); osc.frequency.exponentialRampToValueAtTime(90, 1.0);
    const lfo = c.createOscillator(); lfo.frequency.value = 14;
    const depth = c.createGain(); depth.gain.setValueAtTime(70, 0); depth.gain.exponentialRampToValueAtTime(2, 1.0);
    lfo.connect(depth).connect(osc.frequency);
    const g = c.createGain(); env(g.gain, 0, 0.01, 0.8, 1.0);
    osc.connect(g).connect(o); osc.start(0); lfo.start(0);
  } },
  laser: { label: '🔫 Láser', dur: 0.8, make(c, o) {
    for (let i = 0; i < 3; i++) tone(c, o, { type: 'square', f0: 1900, f1: 110, t: i * 0.24, dur: 0.2, peak: 0.25 });
  } },
  aplausos: { label: '👏 Aplausos', dur: 2.8, make(c, o) {
    for (let i = 0; i < 70; i++) {
      const t = Math.random() * 2.3;
      noiseHit(c, o, { t, dur: 0.03 + Math.random() * 0.03, peak: 0.15 + Math.random() * 0.25, type: 'bandpass', freq: 1200 + Math.random() * 1800, q: 1.2 });
    }
  } },
  redoble: { label: '🥁 Redoble', dur: 3.4, make(c, o) {
    for (let t = 0, i = 0; t < 1.8; t += 0.045, i++) {
      noiseHit(c, o, { t, dur: 0.05, peak: 0.08 + (t / 1.8) * 0.35, type: 'bandpass', freq: 2500, q: 0.8 });
    }
    noiseHit(c, o, { t: 1.85, dur: 1.5, peak: 0.6, type: 'highpass', freq: 4500 });
    tone(c, o, { f0: 110, f1: 45, t: 1.85, dur: 0.4, peak: 0.8 });
  } },
  badumtss: { label: '🥁 Ba-dum-tss', dur: 1.6, make(c, o) {
    tone(c, o, { f0: 230, f1: 130, t: 0, dur: 0.18, peak: 0.8 });
    noiseHit(c, o, { t: 0, dur: 0.12, peak: 0.25, type: 'bandpass', freq: 1800 });
    tone(c, o, { f0: 150, f1: 80, t: 0.2, dur: 0.22, peak: 0.85 });
    noiseHit(c, o, { t: 0.45, dur: 1.0, peak: 0.55, type: 'highpass', freq: 6000 });
    tone(c, o, { f0: 160, f1: 50, t: 0.45, dur: 0.3, peak: 0.6 });
  } },
  bocina: { label: '📯 Bocina', dur: 1.9, make(c, o) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800;
    const sh = c.createWaveShaper(); sh.curve = distortionCurve(30);
    lp.connect(sh).connect(o);
    [[0, 0.22], [0.3, 0.22], [0.6, 1.1]].forEach(([t, d]) => {
      [466, 470, 932].forEach(f => {
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f;
        const g = c.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02);
        g.gain.setValueAtTime(0.18, t + d - 0.03); g.gain.linearRampToValueAtTime(0, t + d);
        osc.connect(g).connect(lp); osc.start(t); osc.stop(t + d + 0.02);
      });
    });
  } },
  sirena: { label: '🚨 Sirena', dur: 2.6, make(c, o) {
    const osc = c.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 900;
    const lfo = c.createOscillator(); lfo.frequency.value = 1.6;
    const d = c.createGain(); d.gain.value = 320;
    lfo.connect(d).connect(osc.frequency);
    const g = c.createGain(); g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.5, 0.05);
    g.gain.setValueAtTime(0.5, 2.4); g.gain.linearRampToValueAtTime(0, 2.6);
    osc.connect(g).connect(o); osc.start(0); lfo.start(0);
  } },
  pedo: { label: '💨 Pedo', dur: 1.3, make(c, o) {
    const osc = c.createOscillator(); osc.type = 'sawtooth';
    const n = 64, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = 95 - i * 0.6 + (Math.random() - 0.5) * 40;
    osc.frequency.setValueCurveAtTime(curve, 0, 1.1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, 0); g.gain.exponentialRampToValueAtTime(0.9, 0.04);
    g.gain.setValueAtTime(0.9, 0.7); g.gain.exponentialRampToValueAtTime(0.0001, 1.15);
    const flutter = c.createOscillator(); flutter.frequency.value = 22;
    const fd = c.createGain(); fd.gain.value = 0.35;
    flutter.connect(fd).connect(g.gain);
    osc.connect(lp).connect(g).connect(o); osc.start(0); flutter.start(0); osc.stop(1.2);
    noiseHit(c, o, { t: 0, dur: 1.0, peak: 0.08, type: 'lowpass', freq: 600 });
  } },
  error: { label: '❌ Error', dur: 0.8, make(c, o) {
    tone(c, o, { type: 'square', f0: 420, t: 0, dur: 0.25, peak: 0.25 });
    tone(c, o, { type: 'square', f0: 300, t: 0.3, dur: 0.4, peak: 0.25 });
  } },
  ding: { label: '🔔 Ding', dur: 2.0, make(c, o) {
    [[880, 0.5], [1760, 0.2], [2430, 0.15], [4750, 0.08]].forEach(([f, p]) => tone(c, o, { f0: f, t: 0, dur: 1.9, peak: p }));
  } },
  grillos: { label: '🦗 Silencio incómodo', dur: 3.2, make(c, o) {
    for (let k = 0; k < 3; k++) {
      for (let j = 0; j < 3; j++) {
        const t = k * 1.05 + j * 0.09;
        tone(c, o, { f0: 4600, t, dur: 0.05, peak: 0.18, attack: 0.004 });
      }
    }
  } },
  tada: { label: '🎉 Ta-da', dur: 2.0, make(c, o) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(o);
    [[0, 0.12], [0.18, 1.6]].forEach(([t, d]) => {
      [523.25, 659.25, 783.99, 1046.5].forEach(f => {
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = f;
        const g = c.createGain(); env(g.gain, t, 0.02, 0.12, d);
        osc.connect(g).connect(lp); osc.start(t); osc.stop(t + d + 0.1);
      });
    });
  } },
  suspenso: { label: '😱 Suspenso', dur: 2.6, make(c, o) {
    [[0, 0.5], [0.55, 0.5], [1.1, 1.4]].forEach(([t, d], i) => {
      const f = [196, 185, 155.56][i];
      [f, f * 2, f * 1.5].forEach(ff => {
        const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = ff;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
        const g = c.createGain(); env(g.gain, t, 0.02, 0.15, d);
        osc.connect(lp).connect(g).connect(o); osc.start(t); osc.stop(t + d + 0.1);
      });
    });
  } },
};

export async function renderEffect(name) {
  const fx = EFFECTS[name];
  const oac = new OfflineAudioContext(1, Math.ceil(fx.dur * SR), SR);
  const master = oac.createGain();
  master.gain.value = 0.9;
  master.connect(oac.destination);
  fx.make(oac, master);
  const buf = await oac.startRendering();
  normalize(buf, 0.9);
  return buf;
}
