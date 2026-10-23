'use strict';
// ─── Escenario pixel art, auras y objetos ────────────────────────────────────────

function poly(ctx, pts, ox, oy) {
  ctx.beginPath();
  ctx.moveTo(ox + pts[0], oy + pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(ox + pts[i], oy + pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}
function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

// ─── Ruido determinista ───────────────────────────────────────────────────────
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) { return vnoise(x, y) * 0.65 + vnoise(x * 2.3 + 17, y * 2.3 - 9) * 0.35; }

// ─── Terreno: un tema por nivel (suelo base, manchas, segunda capa, detalles y decorados) ──
const CHUNK = 256;
// sand = suelo base · dirt = manchas · grass = segunda capa (pasto, agua…) · det = colores de los detalles
// rock/bush = paletas de los decorados · props = cuántos de cada uno y si hay árboles de Namek
const THEMES = {
  saiyan: {   // páramo de arena, tierra y pasto seco
    sand: ['#dcbb84', '#cfac74', '#e8cc98'], dirt: ['#c39a62', '#ab8350', '#d1aa72'], edge: '#9c7646',
    grass: ['#a6b45c', '#8a9c44', '#bfc66f'], gedge: '#7f9040',
    det: { tuftDark: '#7a8c38', tuftLite: '#c9d17a', sandA: '#a98352', sandB: '#c9a46c', dirtA: '#9c7646', dirtB: '#d9b583',
      crack: '#a07a4a', crater: ['#e9cd98', '#b8905a', '#ba915b', '#a37c4a', '#b18853'] },
    rock: { a: '#ecd09c', b: '#d2a466', c: '#b88750', d: '#946538', e: '#7c5330', f: '#f5e2b8' },
    bush: { a: '#9fb352', b: '#7e9440', c: '#5f7631', d: '#c3cf72', e: '#6b4a2c' },
    map: ['#dcbb84', '#b78c56', '#9fb05a'], spires: 0.55, trees: 0, bg: '#1a1020',
  },
  namek: {    // Namek: pasto verde claro, manchas verde agua y lagos turquesa, árboles redondos
    sand: ['#9fd88a', '#8ccb78', '#b2e39c'], dirt: ['#7fc2a0', '#6fb28f', '#92d0b0'], edge: '#4f9a78',
    grass: ['#4fc7c9', '#3fb1b6', '#7adbd8'], gedge: '#2f8f95',
    det: { tuftDark: '#5aa860', tuftLite: '#cdf2b0', sandA: '#6fbf6a', sandB: '#c3eea8', dirtA: '#4f9a78', dirtB: '#b8ecd0',
      crack: '#5fae80', crater: ['#c9f0b0', '#6fae7c', '#7cbd88', '#5c9c6c', '#6aa878'] },
    rock: { a: '#cfe8e0', b: '#9cc8c0', c: '#78a8a4', d: '#5a8686', e: '#456a6c', f: '#e8f6f0' },
    bush: { a: '#6fcf5a', b: '#4fae44', c: '#3a8a36', d: '#b4ec8a', e: '#4a6a3a' },
    map: ['#9fd88a', '#7fc2a0', '#4fc7c9'], spires: 0.35, trees: 2, bg: '#0f2a2a',
  },
  rocky: {    // zona rocosa de la saga de los androides: gris y ocre
    sand: ['#b9b3a4', '#aaa395', '#c8c2b3'], dirt: ['#a08e6c', '#8f7d5c', '#b29f7c'], edge: '#7a6a4e',
    grass: ['#8f9a72', '#7c8760', '#a3ad86'], gedge: '#6a7452',
    det: { tuftDark: '#6c7650', tuftLite: '#bfc6a0', sandA: '#8f897c', sandB: '#d4cfc2', dirtA: '#7a6a4e', dirtB: '#c4b394',
      crack: '#857d70', crater: ['#d6d0c2', '#8f887a', '#9a9384', '#7e776a', '#8a8376'] },
    rock: { a: '#dcd6c8', b: '#b8b1a2', c: '#968f80', d: '#746d60', e: '#5c564b', f: '#efe9dc' },
    bush: { a: '#8f9a66', b: '#717c4e', c: '#56603a', d: '#b9c290', e: '#5a4a36' },
    map: ['#b9b3a4', '#a08e6c', '#8f9a72'], spires: 0.75, trees: 0, bg: '#1a1a20',
  },
  buu: {      // tierra rojiza y seca de la saga de Majin Buu
    sand: ['#d49a7a', '#c78a6a', '#e0ab8c'], dirt: ['#b5765a', '#a2664c', '#c4876a'], edge: '#8a5038',
    grass: ['#c4a466', '#b09254', '#d6b87a'], gedge: '#94783e',
    det: { tuftDark: '#9a7c40', tuftLite: '#e6cc8e', sandA: '#a8704f', sandB: '#ebbba0', dirtA: '#8a5038', dirtB: '#d9a284',
      crack: '#9a5e44', crater: ['#efc2a4', '#a86a4e', '#b07254', '#8e5640', '#9e664a'] },
    rock: { a: '#eec2a6', b: '#d0927a', c: '#b0705a', d: '#8e5242', e: '#723e32', f: '#f8dcc8' },
    bush: { a: '#b8a050', b: '#968040', c: '#74622e', d: '#d8c47a', e: '#5e3e2a' },
    map: ['#d49a7a', '#b5765a', '#c4a466'], spires: 0.6, trees: 0, bg: '#24120f',
  },
};
let THEME = THEMES.saiyan, GROUND = null, ROCK_PAL = null, BUSH_PAL = null, THEME_ID = null;
// Bloques de suelo ya armados del mapa actual (CHUNKS) y sus columnas sólidas (SOLIDS, ver chunkSolids)
let CHUNKS = new Map(), SOLIDS = new Map();
// Los de los otros mapas se guardan aparte: al volver a un mapa ya visto (en el menú) no hay que rearmarlo
const THEME_CACHE = {};
// Imágenes que le faltan cargar a cada mapa (js/maps.js): hasta que lleguen, no se arma nada de antemano
const THEME_PENDING = {};
function themePalettes() {
  const pal = arr => arr.map(hexRgb);
  GROUND = { sand: pal(THEME.sand), dirt: pal(THEME.dirt), edge: hexRgb(THEME.edge), grass: pal(THEME.grass), gedge: hexRgb(THEME.gedge) };
  ROCK_PAL = Object.fromEntries(Object.entries(THEME.rock).map(([k, v]) => [k, hexRgb(v)]));
  BUSH_PAL = Object.fromEntries(Object.entries(THEME.bush).map(([k, v]) => [k, hexRgb(v)]));
}
// Deja solo los n bloques más cercanos a (x, y)
function trimChunks(map, n, x, y) {
  if (map.size <= n) return;
  const d = k => { const [cx, cy] = k.split(',').map(Number); return ((cx + 0.5) * CHUNK - x) ** 2 + ((cy + 0.5) * CHUNK - y) ** 2; };
  const keys = [...map.keys()].sort((a, b) => d(a) - d(b));
  for (const k of keys.slice(n)) map.delete(k);
}
// Cambia el tema del terreno (al empezar un nivel o elegirlo en el menú). play: empieza una partida, así que
// lo guardado de los otros mapas se suelta (es solo para el fondo del menú)
let THEME_AT = 0;   // cuándo cambió el mapa (los primeros instantes los bloques se arman de a poco; ver drawGround)
function setTheme(id, play = false) {
  if (!THEMES[id]) id = 'saiyan';
  if (id !== THEME_ID) {
    if (THEME_ID) {
      trimChunks(CHUNKS, 48, CAM.x, CAM.y);
      THEME_CACHE[THEME_ID] = { CHUNKS, SOLIDS, PROP_TYPES };
    }
    const st = THEME_CACHE[id];
    delete THEME_CACHE[id];
    CHUNKS = st ? st.CHUNKS : new Map(); SOLIDS = st ? st.SOLIDS : new Map(); PROP_TYPES = st ? st.PROP_TYPES : null;
    THEME = THEMES[id]; THEME_ID = id;
    themePalettes();
    THEME_AT = performance.now();
  }
  if (play) for (const k in THEME_CACHE) delete THEME_CACHE[k];
  document.body.style.background = THEME.bg;
}
// Un mapa terminó de cargar sus imágenes: lo que se armó antes queda viejo
function dropThemeCache(id) {
  if (THEME === THEMES[id]) { PROP_TYPES = null; CHUNKS.clear(); SOLIDS.clear(); }
  delete THEME_CACHE[id];
}
// 0 arena · 1 tierra · 2 pasto
function groundType(wx, wy) {
  if (THEME.ground) return THEME.ground(wx, wy);   // mapas con terreno propio (js/maps.js)
  const j = (hash2(wx >> 2, wy >> 2) - 0.5) * 0.012;
  if (fbm(wx / 150 + 77, wy / 150 - 31) + j > 0.64) return 2;
  if (fbm(wx / 95, wy / 95) + j > 0.6) return 1;
  return 0;
}
const TYPE_NAMES = ['sand', 'dirt', 'grass'];
// El armado de un bloque se puede hacer de una (buildChunk) o de a poco, una fila por paso (ver prebuildChunks)
function buildChunk(cx, cy) {
  const g = buildChunkSteps(cx, cy);
  let r;
  do r = g.next(); while (!r.done);
  return r.value;
}
function* buildChunkSteps(cx, cy) {
  const cv = CHUNK_POOL.pop() || document.createElement('canvas');   // uno reciclado, si hay
  cv.width = CHUNK; cv.height = CHUNK;   // (asignar el tamaño también lo deja en blanco)
  const c = cv.getContext('2d');
  const img = c.createImageData(CHUNK, CHUNK), d = img.data;
  // Tipos con un margen alrededor (1 píxel, o THEME.margin) para ver los bordes y los vecinos entre chunks
  const M = THEME.margin || 1, ox = cx * CHUNK, oy = cy * CHUNK, S = CHUNK + 2 * M;
  const raw = new Uint8Array(S * S);
  for (let y = 0; y < S; y++) { for (let x = 0; x < S; x++) raw[y * S + x] = groundType(ox + x - M, oy + y - M); yield; }
  // Vecinos para THEME.pixel: near(dx, dy) = tipo del suelo a (dx, dy) del píxel actual (|dx|, |dy| ≤ M)
  let px = 0, py = 0;
  const near = (dx, dy) => raw[(py + dy + M) * S + px + dx + M];
  const types = new Array(CHUNK * CHUNK);
  for (let y = 0; y < CHUNK; y++) {
    for (let x = 0; x < CHUNK; x++) {
      const k = (y + M) * S + x + M, v = raw[k];
      px = x; py = y;
      const border = v > 0 && (raw[k - 1] < v || raw[k + 1] < v || raw[k - S] < v || raw[k + S] < v);
      const t = border ? (v === 2 ? 'gedge' : 'edge') : TYPE_NAMES[v];
      const wx = ox + x, wy = oy + y;
      types[y * CHUNK + x] = t;
      let col;
      if (THEME.pixel) col = THEME.pixel(wx, wy, v, border, near);   // mapas con terreno propio (js/maps.js)
      else if (t === 'edge' || t === 'gedge') col = GROUND[t];
      else {
        const pal = GROUND[t], h = hash2(wx * 7 + 3, wy * 13 - 5);
        col = h < 0.07 ? pal[1] : h < 0.11 ? pal[2] : pal[0];
        // sombreado suave a gran escala para que no se vea plano
        const n = vnoise(wx / 40, wy / 40);
        if (n < 0.25 && hash2(wx, wy) < 0.5) col = pal[1];
      }
      const i = (y * CHUNK + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    yield;
  }
  c.putImageData(img, 0, 0);

  // Detalles: matas de pasto, piedritas, grietas y cráteres
  const r = rng(cx * 92837111 ^ cy * 689287499);
  if (THEME.deco) { THEME.deco(c, r, ox, oy); return cv; }   // mapas con detalles propios (js/maps.js)
  const typeAt = (x, y) => types[Math.max(0, Math.min(CHUNK - 1, y | 0)) * CHUNK + Math.max(0, Math.min(CHUNK - 1, x | 0))];
  const D = THEME.det;
  for (let n = 0; n < 90; n++) {
    const x = Math.floor(r() * (CHUNK - 8)) + 4, y = Math.floor(r() * (CHUNK - 8)) + 4, t = typeAt(x, y);
    if (t === 'grass') {
      c.fillStyle = D.tuftDark; c.fillRect(x, y, 1, 3); c.fillRect(x + 2, y - 1, 1, 4); c.fillRect(x + 4, y + 1, 1, 2);
      c.fillStyle = D.tuftLite; c.fillRect(x + 2, y - 1, 1, 1);
    } else if (t === 'sand' && r() < 0.5) {
      c.fillStyle = D.sandA; c.fillRect(x, y + 1, 3, 1);
      c.fillStyle = D.sandB; c.fillRect(x, y, 2, 1);
    } else if (t === 'dirt') {
      c.fillStyle = D.dirtA; c.fillRect(x, y, 2, 2);
      c.fillStyle = D.dirtB; c.fillRect(x, y, 1, 1);
    }
  }
  for (let n = 0; n < 3; n++) { // grietas
    let x = r() * CHUNK, y = r() * CHUNK;
    c.fillStyle = D.crack;
    for (let k = 0; k < 14; k++) {
      c.fillRect(Math.floor(x), Math.floor(y), 1, 1);
      x += r() < 0.5 ? 1 : 0; y += r() < 0.6 ? 1 : -1; x += r() < 0.3 ? 1 : 0;
    }
  }
  if (r() < 0.35) { // cráter
    const x = 40 + Math.floor(r() * (CHUNK - 80)), y = 40 + Math.floor(r() * (CHUNK - 80)), rw = 14 + Math.floor(r() * 12);
    for (let yy = -rw; yy <= rw; yy++) for (let xx = -rw; xx <= rw; xx++) {
      const e = (xx * xx) / (rw * rw) + (yy * yy) / (rw * rw * 0.36);
      if (e > 1) continue;
      const K = D.crater;
      c.fillStyle = e > 0.75 ? (yy < 0 ? K[0] : K[1]) : e > 0.5 ? K[2] : (yy < 0 ? K[3] : K[4]);
      c.fillRect(x + xx, y + yy, 1, 1);
    }
  }
  return cv;
}

// ─── Decorados con profundidad (pilares de roca, rocas, arbustos) ────────────
function pixelProp(w, h, draw, palette) {
  const P = makePixels(w, h);
  draw(P.px, w, h);
  return pixelsToCanvas(P, palette);
}
// (ROCK_PAL y BUSH_PAL salen del tema actual: ver setTheme)

function makeSpire(seed) {
  const r = rng(seed), W = 22 + Math.floor(r() * 12), H = 48 + Math.floor(r() * 36);
  const prof = []; // ancho por fila
  for (let y = 0; y < H; y++) {
    const t = y / H;
    let w = W * (t < 0.12 ? 0.9 + t : t < 0.75 ? 0.72 + Math.sin(t * 9 + seed) * 0.05 : 0.72 + (t - 0.75) * 1.2);
    prof.push(Math.round(w));
  }
  const bands = [];
  for (let y = 10; y < H - 4; y += 7 + Math.floor(r() * 6)) bands.push(y);
  const img = pixelProp(W + 4, H + 2, (px) => {
    for (let y = 0; y < H; y++) {
      const w = prof[y], x0 = Math.round((W + 4 - w) / 2);
      const l = Math.round(w * 0.35), m = Math.round(w * 0.4);
      px(x0, y + 1, l, 1, 'b'); px(x0 + l, y + 1, m, 1, 'c'); px(x0 + l + m, y + 1, w - l - m, 1, 'd');
      if (bands.includes(y)) { px(x0, y + 1, w, 1, 'e'); px(x0, y + 2, l, 1, 'a'); }
    }
    // Cima plana iluminada
    const w0 = prof[0], x0 = Math.round((W + 4 - w0) / 2);
    px(x0 + 1, 0, w0 - 2, 1, 'a'); px(x0, 1, w0, 3, 'a'); px(x0 + 2, 1, w0 - 6, 1, 'f'); px(x0, 4, w0, 1, 'c');
    // Algunas manchas y piedras al pie
    for (let k = 0; k < 18; k++) { const y = 6 + Math.floor(r() * (H - 10)); px(Math.round((W + 4 - prof[y]) / 2) + 1 + Math.floor(r() * (prof[y] - 3)), y, 1, 1, r() < 0.5 ? 'd' : 'a'); }
  }, ROCK_PAL);
  return { img, w: W + 4, h: H + 2, foot: H + 1, r: W * 0.36 };
}
function makeBoulder(seed) {
  const r = rng(seed), W = 12 + Math.floor(r() * 10), H = 8 + Math.floor(r() * 5);
  const img = pixelProp(W + 2, H + 2, (px) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const nx = (x - W / 2 + 0.5) / (W / 2), ny = (y - H / 2 + 0.5) / (H / 2);
      if (nx * nx + ny * ny > 1) continue;
      const lit = nx * -0.6 + ny * -0.8;
      px(x + 1, y + 1, 1, 1, lit > 0.35 ? 'a' : lit > -0.1 ? 'b' : lit > -0.5 ? 'c' : 'd');
    }
  }, ROCK_PAL);
  return { img, w: W + 2, h: H + 2, foot: H + 1, r: 0 };
}
function makeBush(seed) {
  const r = rng(seed), W = 12 + Math.floor(r() * 6), H = 9 + Math.floor(r() * 4);
  const img = pixelProp(W + 2, H + 2, (px) => {
    for (let k = 0; k < 7; k++) {
      const cx = 3 + Math.floor(r() * (W - 4)), cy = 3 + Math.floor(r() * (H - 5)), rr = 2 + Math.floor(r() * 2);
      for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
        if (x * x + y * y > rr * rr + 1) continue;
        px(cx + x, cy + y, 1, 1, y < -1 ? 'd' : y < 1 ? 'a' : 'b');
      }
    }
    px(Math.floor(W / 2), H - 2, 2, 3, 'e');
  }, BUSH_PAL);
  return { img, w: W + 2, h: H + 2, foot: H + 1, r: 0 };
}
// Árbol de Namek: tronco fino y copa redonda (los Ajisa)
function makeNamekTree(seed) {
  const r = rng(seed), W = 18 + Math.floor(r() * 8), H = 34 + Math.floor(r() * 14), R = Math.floor(W / 2);
  const img = pixelProp(W + 2, H + 2, (px) => {
    const tx = Math.floor(W / 2);
    for (let y = R * 2 - 2; y < H; y++) px(tx, y, 2, 1, y % 5 === 0 ? 'e' : 'c');   // tronco
    for (let y = 0; y < R * 2; y++) for (let x = 0; x < W; x++) {                     // copa
      const nx = (x - W / 2 + 0.5) / (W / 2), ny = (y - R + 0.5) / R;
      if (nx * nx + ny * ny > 1) continue;
      const lit = nx * -0.6 + ny * -0.8;
      px(x + 1, y + 1, 1, 1, lit > 0.45 ? 'd' : lit > 0 ? 'a' : lit > -0.45 ? 'b' : 'c');
    }
  }, BUSH_PAL);
  return { img, w: W + 2, h: H + 2, foot: H + 1, r: 3 };
}
let PROP_TYPES = null;
function initProps() {
  if (!ROCK_PAL) setTheme('saiyan');
  PROP_TYPES = {
    spire: [101, 202, 303, 404].map(makeSpire),
    boulder: [11, 22, 33, 44].map(makeBoulder),
    bush: [5, 6, 7].map(makeBush),
    tree: [71, 72, 73].map(makeNamekTree),
    ...(THEME.makeProps ? THEME.makeProps() : {}),
  };
}
function chunkProps(cx, cy) {
  const r = rng(cx * 15485863 ^ cy * 32452843 ^ 0x5bd1e995), out = [];
  const add = (type, n) => {
    for (let i = 0; i < n; i++) {
      const x = cx * CHUNK + 16 + r() * (CHUNK - 32), y = cy * CHUNK + 16 + r() * (CHUNK - 32);
      if (Math.hypot(x, y) < 110) continue; // zona de inicio despejada
      if (out.some(o => Math.abs(o.x - x) < 34 && Math.abs(o.y - y) < 26)) continue;   // separados entre sí (2.14.2)
      const v = PROP_TYPES[type], p = v[Math.floor(r() * v.length)];
      out.push({ prop: p, x: Math.round(x), y: Math.round(y), type, solid: type === 'spire' || !!p.solid });
    }
  };
  if (THEME.props) {   // mapas con decorados propios (js/maps.js); landmarks: piezas fijas, como la casa del punto de partida
    THEME.props(r, add, cx, cy);
    const kept = THEME.keepProp ? out.filter(THEME.keepProp) : out;
    return THEME.landmarks ? kept.concat(THEME.landmarks(cx, cy)) : kept;
  }
  add('spire', r() < THEME.spires ? 1 : 0);
  add('boulder', 1 + Math.floor(r() * 3));
  add('bush', Math.floor(r() * 4));
  if (THEME.trees) add('tree', Math.floor(r() * (THEME.trees + 1)));
  return out;
}

// Al pasar el límite se borra el bloque más lejano a la cámara (antes, el más viejo: en pantallas grandes
// se borraban bloques que todavía se veían y se volvían a armar sin parar, con parpadeos y tirones)
const CAM = { x: 0, y: 0 };
// Bloques descartados, para reusar su canvas en el próximo que se arme (2.20.3: en el celular, crear ~4 canvas
// nuevos por segundo y soltar los viejos llenaba la memoria de canvas y la imagen se rompía)
const CHUNK_POOL = [];
function storeChunk(key, ch) {
  CHUNKS.set(key, ch);
  if (CHUNKS.size > 120) {
    let far = null, fd = -1;
    for (const k of CHUNKS.keys()) {
      const [cx, cy] = k.split(',').map(Number), dd = ((cx + 0.5) * CHUNK - CAM.x) ** 2 + ((cy + 0.5) * CHUNK - CAM.y) ** 2;
      if (dd > fd) { fd = dd; far = k; }
    }
    const old = CHUNKS.get(far);
    CHUNKS.delete(far);
    if (old && old !== ch && old.img && old.img.getContext && CHUNK_POOL.length < 8) CHUNK_POOL.push(old.img);
  }
  return ch;
}
function getChunk(cx, cy) {
  const key = cx + ',' + cy;
  let ch = CHUNKS.get(key);
  if (!ch) {
    // Si justo se estaba armando de a poco, se termina ese mismo
    let img;
    if (CHUNK_JOB && CHUNK_JOB.key === key && CHUNK_JOB.theme === THEME) { let r; do r = CHUNK_JOB.gen.next(); while (!r.done); img = r.value; CHUNK_JOB = null; }
    ch = storeChunk(key, { img: img || buildChunk(cx, cy), props: chunkProps(cx, cy) });
  }
  return ch;
}
// Bloques que todavía no se ven (los de alrededor de la pantalla) se arman de a poco, ~4 ms por cuadro,
// así cuando el jugador llega ya están listos y no hay tirones al caminar
let CHUNK_JOB = null;
function prebuildChunks(x0, x1, y0, y1, camX, camY) {
  if (CHUNK_JOB && (CHUNK_JOB.theme !== THEME || CHUNKS.has(CHUNK_JOB.key))) CHUNK_JOB = null;
  if (!CHUNK_JOB) {
    let best = null, bd = 1e18;
    for (let cy = y0 - 2; cy <= y1 + 2; cy++) for (let cx = x0 - 2; cx <= x1 + 2; cx++) {
      if (CHUNKS.has(cx + ',' + cy)) continue;
      const d = ((cx + 0.5) * CHUNK - camX) ** 2 + ((cy + 0.5) * CHUNK - camY) ** 2;
      if (d < bd) { bd = d; best = [cx, cy]; }
    }
    if (!best) return false;
    CHUNK_JOB = { key: best[0] + ',' + best[1], cx: best[0], cy: best[1], gen: buildChunkSteps(best[0], best[1]), theme: THEME };
  }
  const until = performance.now() + 6;
  let r;
  do r = CHUNK_JOB.gen.next(); while (!r.done && performance.now() < until);
  if (r.done) { storeChunk(CHUNK_JOB.key, { img: r.value, props: chunkProps(CHUNK_JOB.cx, CHUNK_JOB.cy) }); CHUNK_JOB = null; }
  return true;
}
// En el menú, con el mapa elegido ya armado, se van armando (de a poco) los otros mapas en la misma vista:
// al elegir otro nivel el fondo aparece entero de una, sin tirones (antes se armaba todo en ese momento)
let WARM_JOB = null, GROUND_IDLE = false;
function prewarmThemes(camX, camY, viewW, viewH) {
  if (!GROUND_IDLE) return;
  const x0 = Math.floor((camX - viewW / 2) / CHUNK), x1 = Math.floor((camX + viewW / 2) / CHUNK) + 1;
  const y0 = Math.floor((camY - viewH / 2 - 90) / CHUNK), y1 = Math.floor((camY + viewH / 2 + 90) / CHUNK);
  if (WARM_JOB && THEME_CACHE[WARM_JOB.id] !== WARM_JOB.st) WARM_JOB = null;   // se descartó mientras tanto
  if (!WARM_JOB) {
    for (const lv of LEVELS) {
      const id = lv.theme;
      if (id === THEME_ID || !THEMES[id] || THEME_PENDING[id] > 0) continue;
      const st = THEME_CACHE[id] || (THEME_CACHE[id] = { CHUNKS: new Map(), SOLIDS: new Map(), PROP_TYPES: null });
      for (let cy = y0; cy <= y1 && !WARM_JOB; cy++) for (let cx = x0; cx <= x1 && !WARM_JOB; cx++) {
        if (!st.CHUNKS.has(cx + ',' + cy)) WARM_JOB = { id, st, cx, cy, key: cx + ',' + cy, gen: null };
      }
      if (WARM_JOB) break;
    }
    if (!WARM_JOB) return;
  }
  // Se arma con el mapa de ese nivel puesto un instante (el armado lee THEME, las paletas y PROP_TYPES)
  const saved = [THEME, GROUND, ROCK_PAL, BUSH_PAL, PROP_TYPES, CHUNKS, SOLIDS], j = WARM_JOB;
  THEME = THEMES[j.id]; themePalettes(); PROP_TYPES = j.st.PROP_TYPES; CHUNKS = j.st.CHUNKS; SOLIDS = j.st.SOLIDS;
  try {
    if (!j.gen) j.gen = buildChunkSteps(j.cx, j.cy);
    const until = performance.now() + 5;
    let r;
    do r = j.gen.next(); while (!r.done && performance.now() < until);
    if (r.done) {
      if (!PROP_TYPES) initProps();
      CHUNKS.set(j.key, { img: r.value, props: chunkProps(j.cx, j.cy) });
      trimChunks(CHUNKS, 60, camX, camY);
      WARM_JOB = null;
    }
    j.st.PROP_TYPES = PROP_TYPES;
  } finally {
    [THEME, GROUND, ROCK_PAL, BUSH_PAL, PROP_TYPES, CHUNKS, SOLIDS] = saved;
  }
}
// Columnas de piedra de cada bloque (sólidas). Se guardan aparte de CHUNKS para que los enemigos
// lejos de la cámara puedan chocarlas sin generar la imagen del suelo.
function chunkSolids(cx, cy) {
  const key = cx + ',' + cy;
  let s = SOLIDS.get(key);
  if (!s) {
    if (!PROP_TYPES) initProps();
    const ch = CHUNKS.get(key);
    s = (ch ? ch.props : chunkProps(cx, cy)).filter(p => p.solid);
    SOLIDS.set(key, s);
    if (SOLIDS.size > 400) SOLIDS.delete(SOLIDS.keys().next().value);
  }
  return s;
}
// Saca de las columnas a un personaje (o.x, o.y) cuyos pies están foot píxeles más abajo y miden
// feet de ancho: la base de la columna es una elipse a ras del suelo
function pushOutOfSolids(o, foot, feet) {
  const cx = Math.floor(o.x / CHUNK), cy = Math.floor((o.y + foot) / CHUNK);
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    for (const p of chunkSolids(cx + ox, cy + oy)) {
      // cr: radio de choque propio de la pieza (troncos, bases); si no tiene, sale del ancho de la imagen
      const rx = (p.prop.cr !== undefined ? p.prop.cr : p.prop.w * 0.42) + feet, ry = (p.prop.cry !== undefined ? p.prop.cry : 7) + feet * 0.5, by = p.y - 2;   // cry: alto propio (naves grandes)
      const nx = (o.x - p.x) / rx, ny = (o.y + foot - by) / ry, d2 = nx * nx + ny * ny;
      if (d2 >= 1) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-3) { o.y = by + ry - foot; continue; }
      o.x = p.x + nx / d * rx; o.y = by + ny / d * ry - foot;
    }
  }
}
// Vista rápida de un bloque que todavía no está armado: el suelo a 1/8 de resolución (32×32 muestras, unas
// 64 veces más barato) y estirado, borroso. Antes era un cuadrado liso, que se veía como un parpadeo.
const QUICK = new Map();
function quickChunk(cx, cy) {
  const key = cx + ',' + cy;
  let cv = QUICK.get(key);
  if (cv && cv.theme === THEME) return cv;
  const N = CHUNK / 8;
  cv = document.createElement('canvas'); cv.width = cv.height = N; cv.theme = THEME;
  const c = cv.getContext('2d'), img = c.createImageData(N, N), d = img.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const wx = cx * CHUNK + x * 8 + 4, wy = cy * CHUNK + y * 8 + 4, v = groundType(wx, wy);
    const col = THEME.pixel ? THEME.pixel(wx, wy, v, false, () => v) : GROUND[TYPE_NAMES[v]][0];
    const i = (y * N + x) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  QUICK.set(key, cv);
  if (QUICK.size > 200) QUICK.delete(QUICK.keys().next().value);
  return cv;
}
function drawQuick(ctx, cx, cy) {
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(quickChunk(cx, cy), cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
  ctx.restore();
}
// Dibuja el suelo visible y devuelve los decorados visibles para ordenarlos por Y
function drawGround(ctx, camX, camY, viewW, viewH) {
  if (!PROP_TYPES) initProps();
  const x0 = Math.floor((camX - viewW / 2) / CHUNK), x1 = Math.floor((camX + viewW / 2) / CHUNK);
  const y0 = Math.floor((camY - viewH / 2 - 90) / CHUNK), y1 = Math.floor((camY + viewH / 2 + 90) / CHUNK);
  const props = [];
  let fresh = 0;
  CAM.x = camX; CAM.y = camY;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    // Recién cambiado el mapa faltan muchos bloques: se arman de a pocos por cuadro y los que faltan se pintan
    // del color del suelo un instante. Jugando, los bloques ya vienen armados de antes (prebuildChunks) y si
    // alguno falta se arma en el momento: un cuadrado liso se veía como un parpadeo.
    if (!CHUNKS.has(cx + ',' + cy) && ++fresh > (THEME.margin > 1 ? 1 : 3) && performance.now() - THEME_AT < 1500) {
      drawQuick(ctx, cx, cy);
      continue;
    }
    const ch = getChunk(cx, cy);
    // El bloque que se mostraba en vista rápida aparece encima con un fundido corto
    if (ch.fade === undefined) ch.fade = QUICK.has(cx + ',' + cy) && QUICK.get(cx + ',' + cy).theme === THEME ? performance.now() : 0;
    const a = ch.fade ? (performance.now() - ch.fade) / 250 : 1;
    if (a < 1) {
      drawQuick(ctx, cx, cy);
      ctx.globalAlpha = Math.max(0, a); ctx.drawImage(ch.img, cx * CHUNK, cy * CHUNK); ctx.globalAlpha = 1;
    } else ctx.drawImage(ch.img, cx * CHUNK, cy * CHUNK);
    for (const p of ch.props) props.push(p);
  }
  // con el cuadro libre, se adelanta el siguiente bloque (y si no hay nada que adelantar, el menú arma otros mapas)
  GROUND_IDLE = !fresh && !prebuildChunks(x0, x1, y0, y1, camX, camY);
  return props;
}
function drawProp(ctx, p) {
  const pr = p.prop;
  if (p.solid) {
    ctx.fillStyle = pr.shadow || 'rgba(70,40,20,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x + 4, p.y, pr.w * 0.62, 5, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.drawImage(pr.img, Math.round(p.x - pr.w / 2), Math.round(p.y - pr.foot));
}

// ─── Aura de ki ───────────────────────────────────────────────────────────────
// Una llama que envuelve al personaje: base redondeada a la altura de los pies y
// lenguas de fuego que suben por encima de la cabeza y se mueven sin parar.
function auraPath(ctx, s, scale, t, phase) {
  const N = 44, cy = -9 * s;                       // centro a la altura del pecho
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2, up = Math.max(0, -Math.sin(a));   // 1 = arriba, 0 = abajo
    let rx = 15 * s * scale, ry = (up > 0 ? 30 : 22) * s * scale;
    // lenguas: más largas y más vivas cuanto más arriba
    const flick = 1 + up * up * (0.28 * Math.sin(a * 7 + t * 13 + phase) + 0.16 * Math.sin(a * 13 - t * 21 + phase * 2))
      + 0.04 * Math.sin(a * 5 + t * 9);
    const px = Math.cos(a) * rx * (1 - up * 0.35) * flick;            // se afina hacia arriba
    const py = Math.sin(a) * ry * flick * (1 + up * 0.25);
    if (i === 0) ctx.moveTo(px, cy + py); else ctx.lineTo(px, cy + py);
  }
  ctx.closePath();
}
function drawAura(ctx, color, x, y, t, s = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const pulse = 1 + Math.sin(t * 18) * 0.04;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28; auraPath(ctx, s, 1.12 * pulse, t, 0); ctx.fill();          // contorno exterior
  ctx.globalAlpha = 0.32; auraPath(ctx, s, 0.9 * pulse, t * 1.3, 2.1); ctx.fill();   // capa media
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.22; auraPath(ctx, s, 0.62, t * 1.6, 4.2); ctx.fill();          // brillo interior
  // Chispas que suben
  ctx.globalAlpha = 0.9;
  for (let i = 0; i < 5; i++) {
    const k = (t * 1.6 + i * 0.37) % 1, sx = Math.sin(i * 12.9898 + Math.floor(t * 1.6 + i * 0.37) * 3.1) * 12 * s;
    ctx.fillStyle = i % 2 ? '#ffffff' : color;
    ctx.fillRect(Math.round(sx), Math.round((10 - k * 46) * s), 1, Math.max(2, Math.round(3 * s)));
  }
  ctx.restore();
}
// Capa delantera muy suave: hace que el personaje se vea dentro del aura
function drawAuraFront(ctx, color, x, y, t, s = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.13;
  auraPath(ctx, s, 1.0 + Math.sin(t * 18) * 0.04, t * 1.1, 1.3);
  ctx.fill();
  ctx.restore();
}

// ─── Esfera del Dragón ────────────────────────────────────────────────────────
// Objetos de los juegos de GBA (assets/items): las esferas (1 a 7 estrellas), la semilla, el Zeni y el escudo de
// energía. Hasta que cargan se dibujan como antes.
const ITEM_IMG = {};
for (const n of ['balls', 'senzu', 'zeni', 'shield']) {
  const img = new Image();
  img.onload = () => { ITEM_IMG[n] = img; };
  img.src = `assets/items/${n}.png`;
}
function drawDragonBall(ctx, x, y, r, stars, glow) {
  ctx.save();
  if (glow) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd34d'; circle(ctx, x, y, r + 3); ctx.globalAlpha = 1; }
  if (ITEM_IMG.balls && r >= 5) {   // la esfera de GBA (15×15); la marquita de los élites (r 4) sigue dibujada
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ITEM_IMG.balls, (Math.min(7, Math.max(1, stars)) - 1) * 15, 0, 15, 15, Math.round(x - 7.5), Math.round(y - 7.5), 15, 15);
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#5a2a00'; circle(ctx, x, y, r + 1);
  ctx.fillStyle = '#e07a00'; circle(ctx, x, y, r);
  ctx.fillStyle = '#ffb81c'; circle(ctx, x - r * 0.15, y - r * 0.15, r * 0.8);
  ctx.fillStyle = '#fff3c4'; ctx.fillRect(Math.round(x - r * 0.55), Math.round(y - r * 0.6), Math.max(1, Math.round(r * 0.35)), Math.max(1, Math.round(r * 0.3)));
  ctx.fillStyle = '#d4151b';
  const n = Math.max(1, stars);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, d = n === 1 ? 0 : r * 0.42;
    drawStar(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (n === 1 ? 0.42 : 0.22));
  }
  ctx.restore();
}
function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}
