'use strict';
// ─── Sprites pixel art generados por código ──────────────────────────────────────
// Cada personaje se compone a nivel de píxel: cuerpo (dibujado con rectángulos) +
// cara base + capa de peinado/rasgos. Después se añade un contorno automático y se
// guarda en una hoja de animación (canvas) que se dibuja sin suavizado.

const SPR_W = 32, SPR_H = 44;
const SPR_FOOT = 41;           // fila bajo los pies (punto de anclaje)
const HEAD_X = 4;              // desplazamiento de la capa de cabeza (24×22)

// ─── Colores ──────────────────────────────────────────────────────────────────
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function mulC(c, f) { return c.map(v => Math.max(0, Math.min(255, Math.round(v * f)))); }
function mixC(c, d, t) { return c.map((v, i) => Math.round(v + (d[i] - v) * t)); }
const WHITE = [255, 255, 255], INK = [24, 14, 30];

// ─── Motor de píxeles genérico ────────────────────────────────────────────────
// draw(px) pinta claves de paleta; la paleta traduce claves a colores RGB.
function makePixels(w, h) {
  const grid = new Array(w * h).fill(null);
  const px = (x, y, ww, hh, key) => {
    for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
      const X = x + i, Y = y + j;
      if (X >= 0 && Y >= 0 && X < w && Y < h) grid[Y * w + X] = key;
    }
  };
  // capa: lista de [fila, columna, 'claves'] ('.' = no tocar, '_' = borrar)
  px.layer = (rows, ox, oy) => {
    for (const [r, c, s] of rows) for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '.') continue;
      const X = ox + c + i, Y = oy + r;
      if (X >= 0 && Y >= 0 && X < w && Y < h) grid[Y * w + X] = ch === '_' ? null : ch;
    }
  };
  return { w, h, grid, px };
}
function pixelsToCanvas(P, palette, { outline = true, flash = false } = {}) {
  const { w, h, grid } = P;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  const img = cx.createImageData(w, h), d = img.data;
  const colorAt = i => (grid[i] ? (palette[grid[i]] || [255, 0, 255]) : null);
  for (let i = 0; i < w * h; i++) {
    const c = colorAt(i);
    if (c) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
  }
  if (outline) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (grid[i]) continue;
      const n = (x > 0 && grid[i - 1]) ? i - 1 : (x < w - 1 && grid[i + 1]) ? i + 1
        : (y > 0 && grid[i - w]) ? i - w : (y < h - 1 && grid[i + w]) ? i + w : -1;
      if (n < 0) continue;
      const c = mixC(mulC(colorAt(n), 0.35), INK, 0.55);
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
  }
  if (flash) for (let i = 0; i < w * h; i++) if (d[i * 4 + 3]) { d[i * 4] = 255; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255; }
  cx.putImageData(img, 0, 0);
  return cv;
}

// ─── Capas de cabeza (coordenadas dentro de 24×22) ───────────────────────────
const FACE = [
  [8, 9, 'ssssss'],
  [9, 7, 'ssssssssss'],
  [10, 6, 'ssssssssssss'],
  [11, 6, 'ssssssssssss'],
  [12, 5, 'sssssssssssss'],
  // ojo trasero (col 9) y ojo delantero (cols 14-15)
  [13, 5, 'ssss' + 'e' + 'ssss' + 'eE' + 'ss'],
  [14, 5, 'ssss' + 'e' + 'ssss' + 'ee' + 'ss'],
  [15, 5, 'Ssss' + 'e' + 'ssss' + 'ee' + 'ss'],
  [16, 6, 'Sssssssssss'],
  [17, 7, 'SSsssssms'],
  [18, 9, 'SSSSSS'],
];

const BROW = [[12, 9, 'H'], [12, 13, 'HHH']];
const BROW_BALD = [[12, 9, 'm'], [12, 13, 'mmm']];

const BALD = [
  [5, 10, 'ssss'], [6, 8, 'ssssssss'], [7, 7, 'ssssssssss'], [8, 6, 'ssssssssssss'], [9, 6, 'ssssssssssss'],
  [6, 10, 'oo'], [7, 9, 'oo'], [8, 6, 'S'], [9, 6, 'S'],
];

const HEADS = {
  goku: [
    [1, 10, 'h'],
    [2, 9, 'hh'], [2, 15, 'h'],
    [3, 4, 'h'], [3, 8, 'hhh'], [3, 14, 'hh'],
    [4, 4, 'hh'], [4, 7, 'hhhhh'], [4, 13, 'hhh'], [4, 19, 'h'],
    [5, 2, 'h'], [5, 4, 'hhhhhhhhhhhhh'], [5, 18, 'hh'],
    [6, 2, 'hhhhhhhhhhhhhhhhhh'],
    [7, 0, 'hhhhhhhhhhhhhhhhhhhh'],
    [8, 1, 'hhhhhhhhhhhhhhhhhhhh'],
    [9, 2, 'hhhhhhhhhhhhhhhhhhhh'],
    [10, 0, 'hhhhhhh'], [10, 8, 'hhhh.hhh.hhhh'],
    [11, 1, 'hhhhh'], [11, 9, 'h'], [11, 14, 'h'], [11, 18, 'hh'],
    [12, 2, 'hhh'], [12, 19, 'h'],
    [13, 3, 'hh'],
    [5, 8, 'll'], [6, 7, 'lll'], [7, 8, 'll'], [4, 14, 'l'],
    [9, 2, 'HHHH'], [10, 0, 'HH'], [11, 1, 'HH'], [8, 16, 'HHH'],
  ],
  gokuSSJ: [
    [0, 9, 'h'], [0, 14, 'h'],
    [1, 5, 'h'], [1, 9, 'hh'], [1, 13, 'hh'],
    [2, 5, 'hh'], [2, 8, 'hhh'], [2, 12, 'hhh'], [2, 18, 'h'],
    [3, 3, 'h'], [3, 5, 'hhhhhhhhhh'], [3, 17, 'hh'],
    [4, 3, 'hhhhhhhhhhhhhhhh'],
    [5, 1, 'h'], [5, 3, 'hhhhhhhhhhhhhhhhh'],
    [6, 1, 'hhhhhhhhhhhhhhhhhhhh'],
    [7, 0, 'hhhhhhhhhhhhhhhhhhhhh'],
    [8, 1, 'hhhhhhhhhhhhhhhhhhh'],
    [9, 2, 'hhhhhhhhhhhhhhhhhhh'],
    [10, 0, 'hhhhhhh'], [10, 8, 'hhhh.hhh..hh'],
    [11, 2, 'hhhh'], [11, 9, 'h'], [11, 14, 'h'],
    [12, 3, 'hh'],
    [2, 9, 'l'], [3, 7, 'lll'], [4, 6, 'llll'], [5, 7, 'll'], [2, 13, 'l'], [3, 14, 'l'],
    [9, 2, 'HHHH'], [10, 0, 'HH'], [8, 15, 'HHHH'], [6, 1, 'H'],
  ],
  vegeta: [
    [0, 10, 'hh'],
    [1, 9, 'hhhh'],
    [2, 8, 'hhhhh'], [2, 15, 'h'],
    [3, 6, 'h'], [3, 8, 'hhhhhh'], [3, 15, 'hh'],
    [4, 6, 'hhhhhhhhhhhh'],
    [5, 5, 'hhhhhhhhhhhhh'],
    [6, 4, 'hhhhhhhhhhhhhh'],
    [7, 4, 'hhhhhhhhhhhhhhh'],
    [8, 4, 'hhhhhhhhhhhhhhh'],
    [9, 4, 'hhhhhhhhhhhhhhh'],
    [10, 4, 'hhhh'], [10, 12, 'hhh'],
    [11, 5, 'hh'], [11, 13, 'h'],
    [12, 5, 'h'],
    [1, 10, 'l'], [2, 10, 'll'], [3, 9, 'lll'], [4, 9, 'll'],
    [8, 4, 'HH'], [9, 4, 'HHH'], [7, 15, 'HH'], [4, 16, 'H'],
    [12, 9, 'H'], [12, 13, 'HHH'],
  ],
  krilin: [...BALD, [9, 10, 'd.d.d'], [10, 11, 'd.d'], ...BROW_BALD],
  piccolo: [
    ...BALD,
    [2, 9, 'tttt'], [3, 7, 'tttttttt'], [4, 6, 'tttttttttt'], [5, 5, 'tttttttttttt'], [6, 5, 'tttttttttttt'],
    [7, 4, 'tttttttttttttt'], [8, 4, 'vvvvvvvvvvvvvv'], [9, 4, 'vvvvvvvvvvvvvv'],
    [3, 13, 'TT'], [4, 14, 'TT'], [5, 15, 'TT'], [6, 15, 'TT'], [7, 15, 'TTT'], [7, 4, 'TT'], [6, 5, 'T'],
    [9, 4, 'VV'], [3, 9, 'EE'],
    [11, 3, 'SS'], [12, 2, 'SSS'], [13, 3, 'SS'], [11, 4, 's'],
    ...BROW_BALD,
  ],
  saibaman: [
    [3, 9, 'ssssss'], [4, 7, 'ssssssssss'], [5, 5, 'ssssssssssssss'], [6, 4, 'ssssssssssssssss'],
    [7, 3, 'ssssssssssssssssss'], [8, 3, 'ssssssssssssssssss'], [9, 3, 'ssssssssssssssssss'],
    [10, 3, 'ssssssssssssssssss'], [11, 4, 'ss'], [11, 17, 's'],
    [5, 8, 'S'], [6, 8, 'S'], [7, 9, 'S'], [4, 12, 'S'], [5, 12, 'S'], [6, 13, 'S'], [7, 13, 'S'], [8, 14, 'S'],
    [6, 5, 'S'], [7, 6, 'S'], [8, 6, 'S'], [9, 3, 'SS'], [10, 3, 'SSS'], [8, 16, 'S'], [9, 17, 'S'],
    [4, 10, 'oo'], [5, 10, 'o'],
    [17, 11, 'mmm'],
  ],
  cell: [
    ...BALD,
    [1, 3, 'h'], [2, 3, 'hh'], [3, 4, 'hhh'], [4, 5, 'hhhh'], [5, 6, 'hhhhh'], [6, 7, 'hhhhhh'], [7, 8, 'hhhhhhh'],
    [8, 9, 'hhhhhh'],
    [2, 16, 'h'], [3, 15, 'hh'], [4, 14, 'hhh'], [5, 13, 'hhhh'], [6, 13, 'hhhh'], [7, 14, 'hhh'],
    [4, 6, 'n'], [6, 9, 'n'], [7, 12, 'n'], [5, 15, 'n'],
    [3, 4, 'l'], [4, 5, 'l'], [3, 15, 'l'],
    [16, 7, 'n'], [17, 8, 'n'],
    ...BROW_BALD,
  ],
  freezer: [
    ...BALD,
    [4, 10, 'vvvv'], [5, 8, 'vvvvvvvv'], [6, 7, 'vvvvvvvvvv'], [7, 6, 'vvvvvvvvvvvv'], [8, 6, 'vvvvvvvvvvvv'],
    [9, 6, 'VV'], [8, 6, 'V'], [7, 6, 'V'],
    [5, 10, 'YY'], [6, 9, 'YY'],
    [17, 12, 'vv'],
  ],
  buu: [
    ...BALD,
    [2, 4, 'ss'], [3, 3, 'ss'], [4, 3, 'ss'], [5, 4, 'sss'], [6, 5, 'sss'], [7, 6, 'ss'],
    [3, 4, 'o'],
    [12, 13, 'mmm'], [12, 9, 'm'],
  ],
};
HEADS.gohan = [...HEADS.goku, [10, 15, 'h'], [11, 15, 'h'], [12, 16, 'h']];
HEADS.gohanSSJ = [...HEADS.gokuSSJ, [10, 15, 'h'], [11, 15, 'h'], [12, 16, 'h'], [13, 16, 'h']];
HEADS.long = HEADS.goku;
HEADS.celljr = HEADS.cell;
HEADS.bald = [...BALD, ...BROW_BALD];

const SCOUTER = [[12, 13, 'jjjj'], [13, 16, 'jJ'], [14, 16, 'jJ'], [15, 17, 'J'], [12, 17, 'J']];
const MUSTACHE = [[16, 10, 'hhhhhh'], [17, 10, 'h'], [17, 15, 'h']];
const MAJIN_M = [[8, 10, 'r...r'], [9, 10, 'rr.rr'], [10, 10, 'r.r.r']];

// ─── Animación ────────────────────────────────────────────────────────────────
// 0-1 quieto · 2-5 caminar · 6 lanzar técnica
const FRAMES = [
  { bob: 0, legB: 0, legF: 0, arm: 0 },
  { bob: 1, legB: 0, legF: 0, arm: 0 },
  { bob: 0, legB: -2, legF: 2, arm: -1, liftB: 1 },
  { bob: 1, legB: 0, legF: 0, arm: 0 },
  { bob: 0, legB: 2, legF: -2, arm: 1, liftF: 1 },
  { bob: 1, legB: 0, legF: 0, arm: 0 },
  { bob: 0, legB: -1, legF: 2, arm: 0, cast: true },
];
const ANIMS = { idle: [0, 1], walk: [2, 3, 4, 5], cast: [6] };

function buildPalette(L, ssj, hairOverride) {
  const P = {};
  const skin = hexRgb(L.skin);
  P.s = skin; P.S = mulC(skin, 0.8); P.m = mulC(skin, 0.55); P.o = mixC(skin, WHITE, 0.45);
  let hair = hexRgb(ssj && (hairOverride || L.ssjHair) ? (hairOverride || L.ssjHair) : (L.hair || '#22202e'));
  if (hair[0] + hair[1] + hair[2] < 120) { P.h = [36, 33, 50]; P.H = [18, 15, 26]; P.l = [82, 78, 112]; }
  else { P.h = hair; P.H = mulC(hair, 0.75); P.l = mixC(hair, WHITE, 0.5); }
  P.e = hexRgb(ssj ? '#138a80' : (L.eye || '#16121e')); P.E = WHITE;
  const set = (k, hex, f = 0.72) => { if (hex) { P[k] = hexRgb(hex); P[k.toUpperCase()] = mulC(P[k], f); } };
  set('g', L.top); set('q', L.pants || L.top); set('z', L.sleeve || L.skin, 0.8);
  set('u', L.shirt); set('b', L.belt); set('k', L.boots || '#3a3040'); set('w', L.wrist);
  set('a', L.plate); set('p', L.pad); set('c', L.cape, 0.8); set('i', L.wings, 0.7);
  set('v', L.dome || '#5b2a86');
  P.Y = mixC(P.v, WHITE, 0.4);
  P.t = [246, 246, 246]; P.T = [196, 196, 214];
  P.r = [214, 48, 58]; P.j = [70, 235, 120]; P.J = [30, 120, 60];
  P.d = [150, 90, 60]; P.n = [26, 52, 30]; P.y = hexRgb(L.gem || '#8a3fbf');
  return P;
}

function drawBody(px, L, f) {
  const b = f.bob, fat = L.fat ? 2 : 0;
  const arm = L.sleeve ? ['z', 'Z'] : ['s', 'S'];
  // Detrás del cuerpo
  if (L.wings) { px(6, 19 + b, 5, 3, 'i'); px(4, 21 + b, 7, 6, 'i'); px(3, 27 + b, 6, 4, 'I'); px(5, 22 + b, 2, 8, 'I'); }
  if (L.cape) { px(8, 21 + b, 12, 19 - b, 'c'); px(8, 21 + b, 2, 19 - b, 'C'); px(7, 36, 4, 4, 'C'); }
  if (L.tail) { px(7, 33, 5, 2, 'q'); px(5, 30, 3, 4, 'q'); px(4, 26, 2, 5, 'Q'); px(3, 24, 2, 3, 'Q'); }
  if (L.style === 'long') {
    px(7, 12 + b, 7, 10, 'h'); px(6, 22 + b, 7, 10, 'h'); px(6, 32 + b, 6, 3, 'H');
    px(6, 22 + b, 1, 12, 'H'); px(5, 34 + b, 3, 2, 'H'); px(9, 34 + b, 2, 2, 'H');
  }
  // Brazo trasero
  px(9 - fat, 23 + b, 2, 6, arm[1]); px(9 - fat, 29 + b, 2, 1, 'S');
  // Piernas y botas
  const xb = 12 + f.legB, xf = 17 + f.legF;
  px(xb, 31, 3, 6, 'Q');
  px(xb, 37 - (f.liftB || 0), 4, 4, 'K');
  px(xf, 31, 3, 6, 'q'); px(xf, 31, 1, 6, 'Q');
  px(xf, 37 - (f.liftF || 0), 4, 4, 'k'); px(xf, 40 - (f.liftF || 0), 4, 1, 'K');
  // Cuello y torso
  px(14, 19 + b, 4, 3, 'S');
  px(11 - fat, 22 + b, 10 + fat * 2, 9 + (fat ? 1 : 0), 'g');
  px(11 - fat, 22 + b, 2, 9, 'G');
  if (L.shirt) { px(15, 22 + b, 4, 1, 'u'); px(16, 23 + b, 2, 1, 'u'); }
  if (L.armor) {
    px(11, 22 + b, 10, 6, 'a'); px(11, 22 + b, 2, 6, 'A'); px(11, 27 + b, 10, 1, 'A');
    px(9, 21 + b, 4, 3, 'P');
  }
  if (L.spots) { px(14, 24 + b, 1, 1, 'n'); px(18, 26 + b, 1, 1, 'n'); px(15, 28 + b, 1, 1, 'n'); px(19, 23 + b, 1, 1, 'n'); px(12, 27 + b, 1, 1, 'n'); }
  if (L.gem) { px(15, 24 + b, 2, 2, 'y'); }
  if (L.belt) { px(11 - fat, 29 + b + (fat ? 1 : 0), 10 + fat * 2, 2, 'b'); px(11 - fat, 30 + b + (fat ? 1 : 0), 2, 1, 'B'); }
  // Brazo delantero
  if (f.cast) {
    px(19, 24 + b, 6, 3, arm[0]); px(19, 26 + b, 6, 1, arm[1]);
    if (L.wrist) px(23, 24 + b, 2, 3, 'w');
    px(25, 23 + b, 2, 5, 's'); px(25, 27 + b, 2, 1, 'S');
  } else {
    const ax = 20 + fat + f.arm;
    px(ax, 23 + b, 3, 6, arm[0]); px(ax, 23 + b, 1, 6, arm[1]);
    if (L.wrist) px(ax, 27 + b, 3, 2, 'w');
    px(ax, 29 + b, 3, 2, 's'); px(ax, 30 + b, 3, 1, 'S');
  }
  if (L.armor) { px(19, 21 + b, 4, 3, 'p'); px(19, 23 + b, 4, 1, 'P'); }
}

function headLayers(L, ssj) {
  let key = L.style;
  if (ssj && (key === 'goku' || key === 'gohan')) key += 'SSJ';
  const layers = [FACE, HEADS[key] || HEADS.bald];
  if (L.scouter) layers.push(SCOUTER);
  if (L.mustache) layers.push(MUSTACHE);
  if (L.majin) layers.push(MAJIN_M);
  return layers;
}

function buildFrame(L, ssj, f, flash, hairOverride) {
  const P = makePixels(SPR_W, SPR_H);
  drawBody(P.px, L, f);
  for (const layer of headLayers(L, ssj)) P.px.layer(layer, HEAD_X, f.bob);
  return pixelsToCanvas(P, buildPalette(L, ssj, hairOverride), { flash });
}

// ─── Caché de hojas ───────────────────────────────────────────────────────────
// ssj: false for base look, or a form key string ('ssj', 'sage', 'baryon', 'gear4'...) identifying a transformed tier.
// hairOverride: optional per-tier hair color (falls back to L.ssjHair when the tier doesn't specify its own).
const SHEETS = new Map();
function getSheet(L, ssj = false, hairOverride = null) {
  const suffix = ssj ? ':' + (typeof ssj === 'string' ? ssj : 'ssj') : '';
  const key = (L.id || L.style) + suffix;
  let sh = SHEETS.get(key);
  if (sh) return sh;
  const make = flash => {
    const cv = document.createElement('canvas');
    cv.width = SPR_W * FRAMES.length; cv.height = SPR_H;
    const cx = cv.getContext('2d');
    FRAMES.forEach((f, i) => cx.drawImage(buildFrame(L, ssj, f, flash, hairOverride), i * SPR_W, 0));
    return cv;
  };
  sh = { normal: make(false), flash: make(true), w: SPR_W, h: SPR_H, foot: SPR_FOOT };
  SHEETS.set(key, sh);
  return sh;
}

// ─── Sprites externos opcionales (ver SPRITE_OVERRIDES en data.js) ───────────
const EXTERNAL = new Map();
// spritesReady: ya cargaron todas las hojas (o fallaron). Hasta entonces el menú no dibuja a los personajes,
// así no se ven un instante los dibujos viejos antes que los sprites de GBA. Por las dudas, a los 4 s se da por listo.
let spritesReady = false;
function markSpritesReady() {
  if (spritesReady) return;
  spritesReady = true;
  document.body.classList.add('sprites-ready');
}
function loadExternalSprites() {
  if (typeof SPRITE_OVERRIDES === 'undefined') { markSpritesReady(); return; }
  let pending = 0;
  const done = () => { if (--pending <= 0) markSpritesReady(); };
  for (const id in SPRITE_OVERRIDES) {
    const o = SPRITE_OVERRIDES[id], img = new Image();
    pending++;
    img.onload = () => { EXTERNAL.set(id, Object.assign({ img }, o)); done(); };
    img.onerror = () => { console.warn(`No se pudo cargar el sprite de ${id}: ${o.src}`); done(); };
    img.src = o.src;
  }
  if (!pending) markSpritesReady();
  setTimeout(markSpritesReady, 4000);
}

/**
 * Dibuja un actor con los pies en (x, y + 12·escala).
 * o: { facing, dir: 'side'|'down'|'up', anim: 'idle'|'walk'|'cast', t, scale, ssj, flash }
 */
// Destello al recibir un golpe: copia de la hoja con el brillo ×3 (lo mismo que hacía ctx.filter = 'brightness(3)'),
// armada una sola vez por hoja. El filtro del navegador costaba ~5 veces más por enemigo al dibujar (2.10.0)
// (las hojas armadas en código, js/custom-sprites.js, son canvas: no tienen naturalWidth. Antes salían de tamaño 0,
// fallaban y se volvían a armar en cada cuadro: en el celular se llenaba la memoria de canvas y se rompía la imagen)
const sheetSize = img => [img.naturalWidth || img.width, img.naturalHeight || img.height];
function flashSheet(ext) {
  if (ext.flashImg) return ext.flashImg;
  const [W, H] = sheetSize(ext.img), cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.drawImage(ext.img, 0, 0);
  try {
    const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = Math.min(255, d[i] * 3); d[i + 1] = Math.min(255, d[i + 1] * 3); d[i + 2] = Math.min(255, d[i + 2] * 3); }
    c.putImageData(im, 0, 0);
  } catch (e) { return ext.flashImg = ext.img; }   // sin acceso a los píxeles: sin destello (y no se reintenta)
  return ext.flashImg = cv;
}
// Contorno oscuro de un píxel alrededor de cada figura, armado una sola vez por hoja: en los mapas donde los
// enemigos se confunden con el suelo (THEME.outline, el desierto del Nivel 4) se dibuja debajo del sprite
function outlineSheet(ext) {
  if (ext.outlineImg !== undefined) return ext.outlineImg;
  const [W, H] = sheetSize(ext.img), cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.drawImage(ext.img, 0, 0);
  try {
    const src = c.getImageData(0, 0, W, H).data, out = c.createImageData(W, H), d = out.data;
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && src[(y * W + x) * 4 + 3] > 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // un píxel de grosor y algo transparente (con dos quedaba muy grueso)
      if (on(x, y) || !(on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1))) continue;
      const i = (y * W + x) * 4;
      d[i] = 20; d[i + 1] = 10; d[i + 2] = 24; d[i + 3] = 190;
    }
    c.clearRect(0, 0, W, H); c.putImageData(out, 0, 0);
  } catch (e) { return ext.outlineImg = null; }   // sin acceso a los píxeles: sin contorno (y no se reintenta)
  return ext.outlineImg = cv;
}
function drawActor(ctx, L, x, y, o = {}) {
  const s = o.scale || 1, anim = o.anim || 'idle';
  const ssjSuffix = o.ssj ? ':' + (typeof o.ssj === 'string' ? o.ssj : 'ssj') : '';
  const ext = EXTERNAL.get(L.id + ssjSuffix) || (!o.ssj && EXTERNAL.get(L.id));
  // De frente o de espaldas (si la hoja lo tiene) no se refleja: solo el perfil mira a un lado
  const vertical = !!(ext && ext.dirs && (o.dir === 'down' || o.dir === 'up'));
  // flip: hojas cuyo perfil mira a la izquierda (el resto mira a la derecha)
  const f = vertical ? 1 : (o.facing || 1) * (ext && ext.flip ? -1 : 1);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + 12 * s));
  if (!o.noShadow) {
    ctx.fillStyle = 'rgba(40,20,10,0.28)';
    ctx.fillRect(Math.round(-7 * s), -1, Math.round(14 * s), 2);
    ctx.fillRect(Math.round(-9 * s), 0, Math.round(18 * s), 1);
  }
  ctx.scale(f, 1);
  if (ext) {
    const seq = ext.anims[anim] || (anim === 'punch' && ext.anims.cast) || ext.anims.idle;   // sin puñetazo: la pose de ataque
    const run = anim === 'walk' && ext.run && !vertical;   // hojas sin carrera: la caminata se "acelera"
    const fps = run ? ext.run.fps : (ext.fps || 8);
    const fr = Math.floor((o.t || 0) * fps) % seq.count;
    const es = s * (ext.scale || 1), fw = ext.frameW * es, fh = ext.frameH * es;
    const img = o.flash ? flashSheet(ext) : ext.img, line = o.outline ? outlineSheet(ext) : null;
    // Hojas con variantes (p. ej. los soldados): cada variante ocupa variantRows filas
    const vOff = ext.variants ? ((o.variant || 0) % ext.variants) * ext.variantRows : 0;
    const row = (ext.dirs ? ext.dirs[vertical ? o.dir : 'side'] : seq.row) + vOff;
    const sx = (seq.col + fr) * ext.frameW, sy = row * ext.frameH;
    const dx = Math.round(-fw / 2), dy = Math.round(-ext.footY * es) - (run && fr % 2 ? Math.round(es) : 0);
    if (run) {
      // Torso inclinado hacia delante: la parte superior se dibuja adelantada unos píxeles
      const cut = Math.round(ext.frameH * ext.run.waist);
      for (const im of line ? [line, img] : [img]) {
        ctx.drawImage(im, sx, sy, ext.frameW, cut, dx + Math.round(ext.run.lean * es), dy, Math.round(fw), Math.round(cut * es));
        ctx.drawImage(im, sx, sy + cut, ext.frameW, ext.frameH - cut, dx, dy + Math.round(cut * es), Math.round(fw), Math.round(fh - cut * es));
      }
    } else {
      if (line) ctx.drawImage(line, sx, sy, ext.frameW, ext.frameH, dx, dy, Math.round(fw), Math.round(fh));
      ctx.drawImage(img, sx, sy, ext.frameW, ext.frameH, dx, dy, Math.round(fw), Math.round(fh));
    }
  } else {
    const sh = getSheet(L, o.ssj || false, o.ssjHair);
    const seq = ANIMS[anim];
    const fps = anim === 'walk' ? 9 : 2.5;
    const fr = seq[Math.floor((o.t || 0) * fps) % seq.length];
    const w = Math.round(SPR_W * s), h = Math.round(SPR_H * s);
    ctx.drawImage(o.flash ? sh.flash : sh.normal, fr * SPR_W, 0, SPR_W, SPR_H,
      Math.round(-SPR_W / 2 * s), Math.round(-SPR_FOOT * s), w, h);
  }
  ctx.restore();
}
