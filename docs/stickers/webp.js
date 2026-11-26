// Generación de stickers WebP (estáticos y animados) sin dependencias.
// El navegador codifica cada cuadro con canvas.toBlob('image/webp') y acá
// se arma el contenedor WebP animado (RIFF + VP8X + ANIM + ANMF) a mano.

export function webpEncodeSupported() {
  const c = document.createElement('canvas');
  c.width = c.height = 2;
  return c.toDataURL('image/webp').startsWith('data:image/webp');
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo codificar la imagen'))), type, quality);
  });
}

const ascii = s => Uint8Array.from(s, ch => ch.charCodeAt(0));

function concat(parts) {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function u24(arr, off, v) {
  arr[off] = v & 255; arr[off + 1] = (v >> 8) & 255; arr[off + 2] = (v >> 16) & 255;
}

function u32le(v) {
  const a = new Uint8Array(4);
  new DataView(a.buffer).setUint32(0, v, true);
  return a;
}

function chunk(id, data) {
  const pad = data.length & 1;
  const out = new Uint8Array(8 + data.length + pad);
  out.set(ascii(id), 0);
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}

function parseChunks(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (String.fromCharCode(...buf.subarray(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...buf.subarray(8, 12)) !== 'WEBP') {
    throw new Error('El navegador no devolvió un WebP válido');
  }
  const chunks = [];
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = String.fromCharCode(...buf.subarray(off, off + 4));
    const size = dv.getUint32(off + 4, true);
    chunks.push({ id, data: buf.subarray(off + 8, off + 8 + size) });
    off += 8 + size + (size & 1);
  }
  return chunks;
}

/** Codifica un cuadro y devuelve los sub-chunks de imagen (ALPH + VP8 / VP8L). */
export async function encodeFrameChunks(canvas, quality) {
  const blob = await canvasToBlob(canvas, 'image/webp', quality);
  const buf = new Uint8Array(await blob.arrayBuffer());
  return parseChunks(buf).filter(c => c.id === 'ALPH' || c.id === 'VP8 ' || c.id === 'VP8L');
}

/**
 * Arma un WebP animado.
 * frames: [{ chunks, duration(ms) }]
 */
export function muxAnimatedWebP(frames, width, height) {
  const anmf = frames.map(f => {
    const head = new Uint8Array(16);
    u24(head, 0, 0);             // X / 2
    u24(head, 3, 0);             // Y / 2
    u24(head, 6, width - 1);
    u24(head, 9, height - 1);
    u24(head, 12, Math.max(8, Math.round(f.duration)));
    head[15] = 0x02;             // sin mezcla (cada cuadro reemplaza al anterior), sin disposición
    return chunk('ANMF', concat([head, ...f.chunks.map(c => chunk(c.id, c.data))]));
  });
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x10 | 0x02;          // alfa + animación
  u24(vp8x, 4, width - 1);
  u24(vp8x, 7, height - 1);
  const anim = new Uint8Array(6); // fondo transparente, repetir siempre (loop 0)
  const body = concat([ascii('WEBP'), chunk('VP8X', vp8x), chunk('ANIM', anim), ...anmf]);
  return new Blob([concat([ascii('RIFF'), u32le(body.length), body])], { type: 'image/webp' });
}
