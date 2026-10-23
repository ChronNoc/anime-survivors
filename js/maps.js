'use strict';
// ─── Mapas con terreno propio ────────────────────────────────────────────────
// Los temas de js/draw.js pueden traer, además de sus colores:
//   ground(wx, wy)            → tipo de terreno 0/1/2 (también lo usa el mapa del HUD con map[tipo])
//   pixel(wx, wy, tipo, borde) → color [r, g, b] de cada píxel del suelo
//   deco(ctx, rng, ox, oy)    → detalles dibujados sobre cada bloque de suelo
//   makeProps()               → decorados propios ({ nombre: [prop, ...] }, como makeSpire)
//   props(rng, add)           → qué decorados lleva cada bloque (add(nombre, cantidad))
// Los colores salen de las hojas de los juegos de GBA (assets/sprites/raw).

const rgbPal = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, hexRgb(v)]));

// ─── Otro Mundo: nubes doradas y el Camino de la Serpiente (los usa el Nivel 5) ──
const OW = {
  cloud: ['#f78c00', '#f79400', '#f79c00', '#f7a500', '#f7b500', '#ffce00', '#ffde00'].map(hexRgb),
  path: { base: hexRgb('#bdb5e7'), dark: hexRgb('#ada5de'), line: hexRgb('#948cce'), lite: hexRgb('#d6ceff') },
  rim: ['#211873', '#2108c6', '#3918e7', '#6b9cef'].map(hexRgb),
  SPAN: 760,   // distancia entre caminos (en x)
  SEG: 230,    // largo de cada tramo recto (en y)
  W: 34,       // medio ancho del camino
  RIM: 5,      // ancho del borde azul
};
// Desplazamiento del tramo s del camino k: los tramos se unen con giros en ángulo recto, como en el juego
// (guardado: lo consultan muchos píxeles)
const OW_OFF = new Map();
function owOff(k, s) {
  const key = k * 65536 + s;
  let v = OW_OFF.get(key);
  if (v === undefined) {
    if (OW_OFF.size > 50000) OW_OFF.clear();
    OW_OFF.set(key, v = Math.round((hash2(k * 31 + 7, s * 17 - 3) - 0.5) * 2 * 210 / 10) * 10);
  }
  return v;
}
// Distancia "de caja" al camino más cercano (0 en el centro; W = borde del camino)
function owRoad(wx, wy) {
  const k = Math.round(wx / OW.SPAN), s = Math.floor(wy / OW.SEG);
  let best = 1e9;
  // Solo la columna más cercana: los caminos de las otras quedan a más de 300 píxeles (SPAN 760, corrimiento ±210)
  for (const kk of [k]) {
    const base = kk * OW.SPAN;
    for (const ss of [s - 1, s, s + 1]) {
      const cx = base + owOff(kk, ss), y0 = ss * OW.SEG, y1 = y0 + OW.SEG;
      // tramo vertical
      const dyv = wy < y0 ? y0 - wy : wy > y1 ? wy - y1 : 0;
      best = Math.min(best, Math.max(Math.abs(wx - cx), dyv));
      // giro horizontal que une con el tramo anterior
      const px = base + owOff(kk, ss - 1), a = Math.min(px, cx), b = Math.max(px, cx);
      const dxh = wx < a ? a - wx : wx > b ? wx - b : 0;
      best = Math.min(best, Math.max(dxh, Math.abs(wy - y0)));
    }
  }
  return best;
}
// Nubes como en el juego: bollos redondos que se superponen (el de más abajo tapa al de arriba),
// con la luz de arriba a la izquierda y un borde anaranjado. Grilla de celdas con 2 bollos cada una.
const OW_CELL = 24;
// Los bollos de cada celda se calculan una sola vez (cada píxel de nube mira 9 celdas: era lo más lento del mapa)
const OW_PUFFS = new Map();
function owPuffs(gx, gy) {
  const key = gx * 65536 + gy;
  let got = OW_PUFFS.get(key);
  if (got) return got;
  if (OW_PUFFS.size > 40000) OW_PUFFS.clear();
  OW_PUFFS.set(key, got = owPuffsCalc(gx, gy));
  return got;
}
function owPuffsCalc(gx, gy) {
  const out = [];
  for (let i = 0; i < 2; i++) {
    const h = hash2(gx * 13 + i * 7, gy * 29 - i * 11), h2 = hash2(gx * 5 - i * 3, gy * 7 + i * 19), h3 = hash2(gx + i * 101, gy - i * 37);
    out.push({ x: (gx + h) * OW_CELL, y: (gy + h2) * OW_CELL, r: 13 + h3 * 8 });
  }
  return out;
}
function owCloud(wx, wy) {
  const gx = Math.floor(wx / OW_CELL), gy = Math.floor(wy / OW_CELL), C = OW.cloud;
  let front = null, fy = -1e9, fd = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) for (const p of owPuffs(gx + i, gy + j)) {
    const dx = wx - p.x, dy = wy - p.y, d2 = dx * dx + dy * dy;
    if (d2 < p.r * p.r && p.y > fy) { front = p; fy = p.y; fd = Math.sqrt(d2) / p.r; }
  }
  if (!front) return C[0];
  if (fd > 0.9) return C[0];   // borde del bollo
  const nx = (wx - front.x) / front.r, ny = (wy - front.y) / front.r, lit = -ny * 0.8 - nx * 0.35;
  return lit > 0.55 ? C[6] : lit > 0.3 ? C[5] : lit > 0.02 ? C[4] : lit > -0.25 ? C[3] : lit > -0.5 ? C[2] : C[1];
}
// ─── Nivel 5: el Planeta de Kaio-sama ────────────────────────────────────────
// Se camina por el pasto, como en los otros niveles. Cada tanto se abre un mar de nubes (no se pisa: en la
// serie, el que se cae termina en el Infierno) y el Camino de la Serpiente lo cruza como un puente.
// Ni el jugador ni los enemigos pisan las nubes: se deslizan por el borde.
const KAI = {
  grass: ['#63d610', '#5acb10', '#39b508', '#7bde21', '#8ce718'].map(hexRgb),
  cliff: ['#18a500', '#0e6e00', '#7a4a24', '#5e361a', '#46280f'].map(hexRgb),
  flowers: ['#ffffff', '#ffe14d', '#ff5c5c', '#ff9bd6'],
  ZONE: 0.6,   // umbral del ruido: más alto, menos nubes
};
// ¿Hay mar de nubes en (wx, wy)? Grandes manchas; el centro del mapa (donde se empieza) siempre es pasto
// ─── Punto de partida: el planeta de Kaio-sama ───
// La escena entera de la hoja de GBA (assets/maps/kaio-planet.png, 720×445) es el suelo de un planeta redondo
// (más grande que la hoja, para que ningún árbol quede cortado; el camino de ladrillos sigue hasta el borde).
// Lo rodea un anillo de nubes y se sale por cuatro Caminos de la Serpiente, uno hacia cada lado.
// El jugador arranca en (0, 0), que es el punto (480, 330) de la hoja: pasto libre entre el pozo y los árboles.
const KP = {
  OX: 480, OY: 330,            // punto de la hoja que cae en (0, 0) del mundo
  CX: -120, CY: -108,          // centro del planeta (el centro de la hoja)
  RX: 510, RY: 315,            // radios del planeta: entra la hoja entera (afuera de la hoja, pasto parejo)
  OPEN: 1000,                  // hasta esta distancia del centro, todo lo que no es planeta es nube
  // Salidas (Caminos de la Serpiente): empiezan dentro del planeta y terminan en el mapa abierto
  ROADS: [
    [[0, 150], [0, 500], [-220, 500], [-220, 1160]],          // abajo
    [[-60, -330], [-60, -700], [180, -700], [180, -1260]],    // arriba
    [[-560, -80], [-900, -80], [-900, 120], [-1320, 120]],    // izquierda
    [[320, -60], [700, -60], [700, -260], [1120, -260]],      // derecha
  ],
  EXIT_R: 380,                 // al final de cada salida, siempre hay pasto
  ROAD_X: [108, 196],          // columnas de la hoja con el camino de ladrillos (se repite arriba y abajo)
};
const inPlanet = (wx, wy, m = 0) => ((wx - KP.CX) / (KP.RX + m)) ** 2 + ((wy - KP.CY) / (KP.RY + m)) ** 2 <= 1;
// Distancia "de caja" al camino de salida más cercano
function exitRoad(wx, wy) {
  let best = 1e9;
  for (const R of KP.ROADS) for (let i = 0; i + 1 < R.length; i++) {
    const [ax, ay] = R[i], [bx, by] = R[i + 1];
    const dx = wx < Math.min(ax, bx) ? Math.min(ax, bx) - wx : wx > Math.max(ax, bx) ? wx - Math.max(ax, bx) : 0;
    const dy = wy < Math.min(ay, by) ? Math.min(ay, by) - wy : wy > Math.max(ay, by) ? wy - Math.max(ay, by) : 0;
    best = Math.min(best, Math.max(dx, dy));
  }
  return best;
}
function kaiCloudZone(wx, wy) {
  // Alrededor del anillo del planeta siempre hay una franja de pasto: las manchas de nubes no lo tocan,
  // así los caminos comunes no chocan con él (solo lo cruzan las 4 salidas)
  if ((wx - KP.CX) ** 2 + (wy - KP.CY) ** 2 < (KP.OPEN + 260) ** 2) return false;
  for (const R of KP.ROADS) { const [ex, ey] = R[R.length - 1]; if ((wx - ex) ** 2 + (wy - ey) ** 2 < KP.EXIT_R ** 2) return false; }
  return zoneNoise(wx, wy) > KAI.ZONE;
}
// Ruido de las manchas de nubes: se calcula cada 8 píxeles (guardado) y se interpola en el medio. Las manchas son
// enormes y suaves, así que no se nota, y armar el terreno es varias veces más rápido.
const ZONE_GRID = new Map();
function zoneAt(gx, gy) {
  const key = gx * 65536 + gy;
  let v = ZONE_GRID.get(key);
  if (v === undefined) {
    if (ZONE_GRID.size > 200000) ZONE_GRID.clear();
    ZONE_GRID.set(key, v = fbm(gx * 8 / 560 + 11, gy * 8 / 560 - 7));
  }
  return v;
}
// La última celda consultada queda a mano: los píxeles se recorren en fila y caen 8 seguidos en la misma
const ZL = { gx: NaN, gy: NaN, a: 0, b: 0, c: 0, d: 0 };
function zoneNoise(wx, wy) {
  const fx = wx / 8, fy = wy / 8, gx = Math.floor(fx), gy = Math.floor(fy), tx = fx - gx, ty = fy - gy;
  if (gx !== ZL.gx || gy !== ZL.gy) { ZL.gx = gx; ZL.gy = gy; ZL.a = zoneAt(gx, gy); ZL.b = zoneAt(gx + 1, gy); ZL.c = zoneAt(gx, gy + 1); ZL.d = zoneAt(gx + 1, gy + 1); }
  return (ZL.a * (1 - tx) + ZL.b * tx) * (1 - ty) + (ZL.c * (1 - tx) + ZL.d * tx) * ty;
}
// 0 pasto · 1 nubes (no se pisa) · 2 Camino de la Serpiente (solo sobre las nubes)
// Los puentes pisan un poco la tierra firme (LAND px) en vez de cortarse justo en el borde
const LAND = 26, ROAD_HALF = OW.W + OW.RIM;
function kaiGround(wx, wy) {
  const dc2 = (wx - KP.CX) ** 2 + (wy - KP.CY) ** 2;
  if (dc2 < (KP.OPEN + LAND) ** 2 && !inPlanet(wx, wy, -LAND) && exitRoad(wx, wy) < ROAD_HALF) return 2;   // salidas del planeta
  if (inPlanet(wx, wy)) return 0;
  if (dc2 < KP.OPEN ** 2) return 1;
  // Los caminos van por columnas cada OW.SPAN: lejos de una columna no hace falta calcular la distancia
  const k = Math.round(wx / OW.SPAN), nearRoad = Math.abs(wx - k * OW.SPAN) < 210 + ROAD_HALF + 2;
  if (kaiCloudZone(wx, wy)) return nearRoad && owRoad(wx, wy) < ROAD_HALF ? 2 : 1;
  // Los puentes pisan un poco el pasto antes de entrar en las nubes
  if (nearRoad && owRoad(wx, wy) < ROAD_HALF && (kaiCloudZone(wx, wy - LAND) || kaiCloudZone(wx, wy + LAND)
    || kaiCloudZone(wx - LAND, wy) || kaiCloudZone(wx + LAND, wy))) return 2;
  return 0;
}
// La escena del planeta, para pintar el suelo con sus píxeles
let KAI_SCENE = null;
THEME_PENDING.kaiplanet = 4;   // la hoja del planeta + casa, auto y garaje
{
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    KAI_SCENE = { w: img.width, h: img.height, d: x.getImageData(0, 0, img.width, img.height).data };
    THEME_PENDING.kaiplanet--; dropThemeCache('kaiplanet');
  };
  img.onerror = () => THEME_PENDING.kaiplanet--;
  img.src = 'assets/maps/kaio-planet.png';
}
const SCENE_PX = [0, 0, 0];
// Nube un poco más oscura (sombra de la tierra firme sobre el mar de nubes)
const shade = (c, f) => [Math.round(c[0] * f), Math.round(c[1] * f), Math.round(c[2] * f)];
const OW_SHADE = OW.cloud.map(c => shade(c, 0.8));
function kaiPixel(wx, wy, type, border, near) {
  if (type === 0 && inPlanet(wx, wy)) {   // el planeta: la escena de la hoja de GBA, con el borde más oscuro (se ve redondo)
    const G = KAI.grass;
    if (!inPlanet(wx, wy, -4)) return KAI.cliff[0];
    if (!inPlanet(wx, wy, -11)) return G[2];
    const sx = wx + KP.OX;
    let sy = wy + KP.OY;
    // Arriba y abajo de la hoja, el camino de ladrillos sigue (se repite cada 16 filas, que es su patrón)
    if (KAI_SCENE && (sy < 0 || sy >= KAI_SCENE.h) && sx >= KP.ROAD_X[0] && sx < KP.ROAD_X[1]) sy = 200 + (((sy - 200) % 224) + 224) % 224;
    if (KAI_SCENE && sx >= 0 && sy >= 0 && sx < KAI_SCENE.w && sy < KAI_SCENE.h) {
      const i = (sy * KAI_SCENE.w + sx) * 4, D = KAI_SCENE.d;
      SCENE_PX[0] = D[i]; SCENE_PX[1] = D[i + 1]; SCENE_PX[2] = D[i + 2];
      return SCENE_PX;
    }
    if (KAI_SCENE) {   // fuera de la hoja: un cuadro de pasto de la misma hoja (578, 8, 64×64), repetido en espejo
      const mir = v => { const q = ((v % 128) + 128) % 128; return q < 64 ? q : 127 - q; };
      const i = ((8 + mir(sy)) * KAI_SCENE.w + 578 + mir(sx)) * 4, D = KAI_SCENE.d;
      SCENE_PX[0] = D[i]; SCENE_PX[1] = D[i + 1]; SCENE_PX[2] = D[i + 2];
      return SCENE_PX;
    }
    const h = hash2(wx * 7 + 3, wy * 13 - 5);
    return h < 0.03 ? G[4] : h < 0.06 ? G[2] : G[0];
  }
  if (type === 0) {   // pasto: manchas suaves y puntitos; en la orilla, un borde verde oscuro de 1 a 3 píxeles
    const G = KAI.grass;
    if (near) for (let d = 1; d <= 3; d++) {
      if (near(d, 0) === 1 || near(-d, 0) === 1 || near(0, d) === 1 || near(0, -d) === 1) return d === 1 ? KAI.cliff[1] : d === 2 ? KAI.cliff[0] : G[2];
    }
    const h = hash2(wx * 7 + 3, wy * 13 - 5), n = vnoise(wx / 46, wy / 46);
    // Pasto pisado alrededor de donde un puente llega a tierra (más oscuro y salpicado hacia afuera)
    if (near) for (const [dx, dy, p] of [[0, 3, 0.75], [0, -3, 0.75], [3, 0, 0.75], [-3, 0, 0.75], [0, 7, 0.45], [0, -7, 0.45], [7, 0, 0.45], [-7, 0, 0.45]]) {
      if (near(dx, dy) === 2) { if (h < p) return h < p * 0.35 ? KAI.cliff[2] : G[2]; break; }
    }
    if (h < 0.035) return G[4];
    if (h < 0.07) return G[2];
    return n < 0.3 ? G[1] : n > 0.78 ? G[3] : G[0];
  }
  if (type === 1) {   // nubes; debajo de la tierra firme, su pared de tierra; debajo de un puente, su sombra
    if (near) {
      for (let k = 1; k <= 9; k++) {
        const up = near(0, -k);
        if (up === 2 && k <= 4) return k <= 2 ? OW.rim[0] : shade(OW.cloud[0], 0.55);
        if (up !== 0) continue;
        const C = KAI.cliff;
        return k === 1 ? C[0] : k === 2 ? C[1] : k <= 4 ? C[2] : k <= 7 ? C[3] : C[4];
      }
      // Cerca de la tierra o de un puente, la nube queda en sombra
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [6, 0], [-6, 0], [0, 6], [4, 4], [-4, 4]]) {
        if (near(dx, dy) !== 1) { const c = owCloud(wx, wy); return OW_SHADE[OW.cloud.indexOf(c)] || c; }
      }
    }
    return owCloud(wx, wy);
  }
  // Camino de la Serpiente: escamas lavanda con borde azul festoneado (cerca del planeta, el camino de salida)
  // Cerca del anillo del planeta conviven las salidas y los caminos comunes: vale el más cercano
  const d = (wx - KP.CX) ** 2 + (wy - KP.CY) ** 2 < (KP.OPEN + LAND) ** 2 ? Math.min(exitRoad(wx, wy), owRoad(wx, wy)) : owRoad(wx, wy);
  if (d >= OW.W) {
    const e = d - OW.W, R = OW.rim;
    return e > OW.RIM - 1.5 ? R[0] : e > 2 ? R[(wx + wy) & 4 ? 1 : 2] : e > 0.5 ? R[2] : R[3];
  }
  const u = (wx + wy) & 7, v = (wx - wy) & 7, P = OW.path;
  if (u === 0 || v === 0) return P.line;
  if (u < 3 && v < 3) return P.lite;
  return hash2(wx >> 3, wy >> 3) < 0.5 ? P.base : P.dark;
}
// Florcitas y matas sobre el pasto
function kaiDeco(c, r, ox, oy) {
  for (let n = 0; n < 70; n++) {
    const x = Math.floor(r() * (CHUNK - 6)) + 3, y = Math.floor(r() * (CHUNK - 6)) + 3;
    if (inPlanet(ox + x, oy + y, 8) || kaiGround(ox + x, oy + y) !== 0 || kaiGround(ox + x, oy + y + 10) !== 0) continue;   // el planeta ya trae sus detalles
    if (r() < 0.45) {   // flor: un punto de color con brillo
      c.fillStyle = KAI.flowers[Math.floor(r() * KAI.flowers.length)]; c.fillRect(x, y, 1, 1);
      c.fillStyle = '#39b508'; c.fillRect(x, y + 1, 1, 1);
    } else {            // mata de pasto
      c.fillStyle = '#39b508'; c.fillRect(x, y, 1, 3); c.fillRect(x + 2, y - 1, 1, 4);
      c.fillStyle = '#8ce718'; c.fillRect(x + 2, y - 1, 1, 1);
    }
  }
}

// Punto de partida: la casa y el auto de Kaio-sama, recortados de la hoja de The Legacy of Goku (assets/maps).
// Son sólidos; el jugador arranca en (0, 0), delante de los dos.
const KAI_IMG = { none: Object.assign(document.createElement('canvas'), { width: 1, height: 1 }) };
for (const [key, src] of [['house', 'assets/maps/kaio-house.png'], ['car', 'assets/maps/kaio-car.png'], ['garage', 'assets/maps/kaio-garage.png']]) {
  const img = new Image();
  img.onload = () => {
    KAI_IMG[key] = img;
    THEME_PENDING.kaiplanet--; dropThemeCache('kaiplanet');   // si el mapa ya estaba armado, que aparezcan
  };
  img.onerror = () => THEME_PENDING.kaiplanet--;
  img.src = src;
}
// x, y: centro de la base en el mundo (= posición en la hoja − (480, 330)); r: radio de choque.
// 'none': sin dibujo (los árboles y el pozo ya están en la escena), solo para chocar con el tronco.
const KAI_SPOTS = [
  { key: 'house', x: -167, y: -130, r: 46 },
  { key: 'garage', x: -23, y: -162, r: 60 },
  { key: 'car', x: -330, y: -180, r: 18 },
  ...[[-432, -264], [-210, -240], [54, -264], [159, -36], [-426, 54], [70, 108], [-62, -45]].map(([x, y]) => ({ key: 'none', x, y, r: 9 })),
];
function kaiLandmarks(cx, cy) {
  const out = [];
  for (const s of KAI_SPOTS) {
    const img = KAI_IMG[s.key];
    if (!img || Math.floor(s.x / CHUNK) !== cx || Math.floor(s.y / CHUNK) !== cy) continue;
    // la escena ya trae sus sombras; los choques sin dibujo ('none') toman el ancho del radio (pushOutOfSolids usa w × 0,42)
    const prop = { img, w: s.key === 'none' ? Math.round(s.r / 0.42) : img.width, h: img.height, foot: img.height - 2, r: s.r, solid: true, shadow: 'rgba(0,0,0,0)' };
    out.push({ prop, x: s.x, y: s.y, type: 'landmark', solid: true });
  }
  return out;
}
// Árbol frondoso como los de la hoja (decorado, se pasa por debajo)
function makeKaiTree(seed) {
  const r = rng(seed), W = 30 + Math.floor(r() * 6), H = 40 + Math.floor(r() * 6);
  const pal = rgbPal({ a: '#c6f08a', b: '#8ce718', c: '#63c610', d: '#3a8f10', e: '#226008', t: '#7a4a24', u: '#5a3418' });
  const img = pixelProp(W, H, (px) => {
    const cx = W / 2, R = W / 2 - 1;
    px(Math.floor(cx) - 2, H - 16, 5, 15, 't'); px(Math.floor(cx) + 1, H - 16, 2, 15, 'u');   // tronco
    px(Math.floor(cx) - 5, H - 3, 11, 2, 'u');   // raíces
    for (let k = 0; k < 9; k++) {   // copa de varios bollos
      const bx = cx + (r() - 0.5) * R * 1.1, by = R * 0.9 + (r() - 0.5) * R * 0.8, br = R * (0.45 + r() * 0.2);
      for (let y = -br; y <= br; y++) for (let x = -br; x <= br; x++) {
        if (x * x + y * y > br * br) continue;
        const lit = (-x * 0.5 - y * 0.85) / br;
        px(Math.round(bx + x), Math.round(by + y), 1, 1, lit > 0.55 ? 'a' : lit > 0.15 ? 'b' : lit > -0.3 ? 'c' : lit > -0.65 ? 'd' : 'e');
      }
    }
  }, pal);
  return { img, w: W, h: H, foot: H - 1, r: 0 };
}

THEMES.kaiplanet = {
  // Colores de respaldo (otras partes del juego los leen): el mapa del HUD usa map[tipo]
  sand: ['#63d610'], dirt: ['#f7a500'], edge: '#18a500', grass: ['#bdb5e7'], gedge: '#211873',
  det: {}, rock: { a: '#8ce718', b: '#63d610', c: '#39b508', d: '#18a500', e: '#0e6e00', f: '#ffffff' },
  bush: { a: '#c6f08a', b: '#8ce718', c: '#63c610', d: '#ffffff', e: '#7a4a24' },
  map: ['#63d610', '#f7a500', '#bdb5e7'], spires: 0, trees: 0, bg: '#2a1400',
  margin: 10,   // vecinos a 10 píxeles: la pared de tierra, los bordes y las sombras (ver buildChunk)
  ground: kaiGround,
  pixel: kaiPixel,
  deco: kaiDeco,
  blocked: (x, y) => kaiGround(x, y) === 1,   // las nubes no se pisan
  makeProps: () => ({ ktree: [91, 92, 93].map(makeKaiTree) }),
  landmarks: kaiLandmarks,
  // Nada sobre las nubes ni sobre el camino, y lo sólido lejos del borde (para no tapar el paso)
  keepProp: p => {
    if (inPlanet(p.x, p.y, 60)) return false;   // el planeta ya trae sus árboles
    for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const m = p.solid ? 70 : 18;
      if (kaiGround(p.x + dx * m, p.y + dy * m) !== 0) return false;
    }
    return true;
  },
  props(r, add) { add('ktree', Math.floor(r() * 3)); },
};

// ─── Niveles 1 a 4: mapas armados con piezas de las hojas de GBA (assets/maps) ──
// Cada nivel: una textura de suelo (cuadro de 64×64 repetido en espejo) con manchas de una segunda textura,
// decorados recortados (sólidos en la base), calcomanías en el suelo (cráteres) y una escena fija en el
// punto de partida. Las imágenes cargan al abrir el juego; cuando terminan, el mapa se vuelve a armar.
const SHEET_IMG = {};
// Las texturas son 'bolsas' de cuadros de 16×16 de puro suelo, 8 por fila (ver tilebag en las herramientas):
// cada cuadro de 16×16 del mundo usa uno de ellos al azar, como arman el piso los juegos de GBA.
const sheetData = img => {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, img.width, img.height).data;
  let n = 0;   // cuadros usados (los últimos de la última fila pueden estar vacíos)
  for (let k = 0; k < (img.width / 16) * (img.height / 16); k++) if (d[(((k >> 3) * 16) * img.width + (k & 7) * 16) * 4 + 3]) n = k + 1;
  return { w: img.width, h: img.height, d, n };
};
// Calcomanías que vienen como un rectángulo lleno (el cráter de Buu): se recortan en óvalo con entrantes y
// salientes de ruido, para que no se vea el corte recto contra el suelo
function raggedEdges(img) {
  const W = img.width, H = img.height, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  try {
    const data = x.getImageData(0, 0, W, H), d = data.data;
    let solid = 0;
    for (let i = 0; i < W; i++) solid += (d[i * 4 + 3] > 0) + (d[((H - 1) * W + i) * 4 + 3] > 0);
    if (solid < W * 1.8) return img;   // ya tiene su forma recortada
    for (let y = 0; y < H; y++) for (let px = 0; px < W; px++) {
      // elipse con el borde mordido por ruido (la arena de alrededor no se ve como un marco sobre la tierra)
      const r = Math.hypot((px - W / 2) / (W / 2), (y - H / 2) / (H / 2));
      if (r < 0.8) continue;
      const lim = 0.86 + 0.12 * vnoise(px / 17 + 5.3, y / 17 - 2.1);
      if (r > lim || (r > lim - 0.02 && (px + y) & 1)) d[(y * W + px) * 4 + 3] = 0;   // con un píxel de tramado en el borde
    }
    x.putImageData(data, 0, 0);
    return c;
  } catch (err) { return img; }
}
function loadSheetPieces(themeId, names) {
  names = names.filter(n => !n.includes('~'));   // las variantes se arman de su pieza (ver DERIVED)
  let left = names.length;
  THEME_PENDING[themeId] = (THEME_PENDING[themeId] || 0) + left;
  for (const n of names) {
    const img = new Image();
    img.onload = () => {
      SHEET_IMG[n] = /-(grass|ground|sand|dirt)$/.test(n) ? img : raggedEdges(img);   // texturas: tal cual
      if (/-(grass|ground|sand)$/.test(n)) SHEET_IMG[n + ':data'] = sheetData(img);
      THEME_PENDING[themeId]--;
      if (--left === 0) dropThemeCache(themeId);
    };
    img.onerror = () => { THEME_PENDING[themeId]--; if (--left === 0) dropThemeCache(themeId); };
    img.src = `assets/maps/${n}.png`;
  }
}
// Píxel de una textura: el cuadro de 16×16 del mundo elige al azar (fijo) uno de la bolsa. La cuadrícula está
// torcida con ruido (hasta ±6 px): las uniones entre cuadros son líneas onduladas, no una grilla recta
const SHEET_PX = [0, 0, 0];
function tilePx(name, wx, wy, fallback) {
  const T = SHEET_IMG[name + ':data'];
  if (!T || !T.n) return fallback;
  const gx = Math.floor((wx + (vnoise(wx / 11 + 3.1, wy / 11) - 0.5) * 12) / 16), gy = Math.floor((wy + (vnoise(wx / 11, wy / 11 - 7.3) - 0.5) * 12) / 16);
  const k = Math.floor(hash2(gx * 1.31 + 17, gy * 1.73 - 5) * T.n);
  const i = (((k >> 3) * 16 + (wy & 15)) * T.w + (k & 7) * 16 + (wx & 15)) * 4;
  SHEET_PX[0] = T.d[i]; SHEET_PX[1] = T.d[i + 1]; SHEET_PX[2] = T.d[i + 2];
  return SHEET_PX;
}
// Variantes armadas a partir de una pieza ('pieza~variante'): el árbol Ajisa de Namek viene de un solo recorte,
// así que se estira el palo (más bajo o más alto) y se agrupan de a dos o tres
function stretchPole(img, top, f) {
  const h = top + Math.round((img.height - top) * f), c = document.createElement('canvas');
  c.width = img.width; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.drawImage(img, 0, 0, img.width, top, 0, 0, img.width, top);
  x.drawImage(img, 0, top, img.width, img.height - top, 0, top, img.width, h - top);
  return c;
}
function groupPieces(list) {   // list: [[dx, dy, canvas]] (dy: corrimiento hacia abajo de la base)
  const W = Math.max(...list.map(([dx, , c]) => dx + c.width)), base = Math.max(...list.map(([, dy, c]) => c.height - dy));
  const H = base + Math.max(...list.map(([, dy]) => dy)), c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  for (const [dx, dy, img] of [...list].sort((a, b) => a[1] - b[1])) x.drawImage(img, dx, H - (H - base - dy) - img.height);
  return c;
}
// Copia espejada (para que no se vean todas iguales)
function mirrorPiece(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.translate(img.width, 0); x.scale(-1, 1); x.drawImage(img, 0, 0);
  return c;
}
const DERIVED = {
  'cell-mesa4~flip': mirrorPiece,
  'namek-ajisa~short': i => stretchPole(i, 22, 0.6),
  'namek-ajisa~tall': i => stretchPole(i, 22, 1.25),
  'namek-ajisa~pair': i => groupPieces([[0, 0, i], [15, 8, stretchPole(i, 22, 0.7)]]),
  'namek-ajisa~trio': i => groupPieces([[0, 5, stretchPole(i, 22, 0.8)], [13, 0, stretchPole(i, 22, 1.1)], [27, 10, stretchPole(i, 22, 0.6)]]),
};
function pieceImg(name) {
  if (!SHEET_IMG[name] && DERIVED[name] && SHEET_IMG[name.split('~')[0]]) SHEET_IMG[name] = DERIVED[name](SHEET_IMG[name.split('~')[0]]);
  return SHEET_IMG[name];
}
// Decorado a partir de una pieza recortada: los pies al centro de la base; r = radio de choque (0 = se atraviesa)
const pieceProp = (name, r) => {
  const img = pieceImg(name);
  return img && { img, w: img.width, h: img.height, foot: img.height - 2, r, cr: r, solid: r > 0, shadow: 'rgba(0,0,0,0)' };
};
// Calcomanías del suelo (cráteres) repartidas por celdas, siempre lejos del punto de partida
function sheetDecals(cfg, ox, oy) {
  const out = [];
  if (!cfg.decal) return out;
  const { cell, chance, names } = cfg.decal;
  for (let gy = Math.floor((oy - 300) / cell); gy <= Math.floor((oy + CHUNK + 300) / cell); gy++)
    for (let gx = Math.floor((ox - 300) / cell); gx <= Math.floor((ox + CHUNK + 300) / cell); gx++) {
      if (hash2(gx * 41 + 9, gy * 67 - 13) > chance) continue;
      const x = (gx + 0.2 + hash2(gx * 3, gy * 5) * 0.6) * cell, y = (gy + 0.2 + hash2(gx * 7, gy * 11) * 0.6) * cell;
      if (Math.hypot(x, y) < 520) continue;
      out.push({ name: names[Math.floor(hash2(gx * 13, gy * 17) * names.length)], x, y });
    }
  return out;
}
// Arma el tema de un nivel. cfg:
//   base, alt: texturas (alt aparece en manchas grandes, con un borde de un píxel del color edge)
//   altZone: umbral del ruido para las manchas · decal: { cell, chance, names } · spawn: piezas fijas del inicio
//   props: [{ names, r, max, onAlt }] (max por bloque; onAlt: solo sobre la segunda textura)
function sheetTheme(id, cfg) {
  const T = THEMES[id], names = new Set([cfg.base, cfg.alt, ...(cfg.decal ? cfg.decal.names : []),
    ...cfg.spawn.map(s => s.name), ...cfg.props.flatMap(p => p.names)].filter(Boolean));
  loadSheetPieces(id, [...names]);
  const altAt = (wx, wy) => !!cfg.alt && fbm(wx / 420 + 31, wy / 420 - 17) > cfg.altZone;
  const fb = hexRgb(T.map[0]), fb2 = hexRgb(T.map[1]), edge = hexRgb(cfg.edge || T.edge);
  Object.assign(T, {
    outline: !!cfg.outline,
    ground: (wx, wy) => altAt(wx, wy) ? 1 : 0,
    pixel: (wx, wy, type, border) => type === 1 ? (border ? edge : tilePx(cfg.alt, wx, wy, fb2)) : tilePx(cfg.base, wx, wy, fb),
    deco(c, r, ox, oy) {   // calcomanías: las del inicio y las repartidas, recortadas por el borde del bloque
      const list = cfg.spawn.filter(s => s.decal).concat(sheetDecals(cfg, ox, oy));
      for (const d of list) {
        const img = SHEET_IMG[d.name];
        if (img) c.drawImage(img, Math.round(d.x - img.width / 2 - ox), Math.round(d.y - img.height / 2 - oy));
      }
    },
    makeProps: () => Object.fromEntries(cfg.props.map((p, i) => [`sp${i}`, p.names.map(n => pieceProp(n, p.r)).filter(Boolean)])),
    // cluster: se juntan en bosquecitos (ruido grande) y dejan claros abiertos
    props(r, add, cx, cy) {
      const dens = Math.max(0, Math.min(2.6, (fbm(cx / 5 + 7, cy / 5 - 3) - 0.38) * 6));
      cfg.props.forEach((p, i) => {
        if (!PROP_TYPES[`sp${i}`] || !PROP_TYPES[`sp${i}`].length) return;
        if (p.chance !== undefined && r() > p.chance) return;   // chance: solo en algunos bloques (las casas son pocas)
        add(`sp${i}`, Math.floor(r() * (p.max + 1) * (p.cluster ? dens : 1)));
      });
    },
    // Nada encima de la escena del inicio ni de las calcomanías; los árboles de onAlt, solo en su textura
    keepProp: p => {
      if (Math.hypot(p.x, p.y) < 190) return false;
      for (const s of cfg.spawn) {   // tampoco encima de las piezas del inicio (el ring, el claro, la nave)
        const img = SHEET_IMG[s.name];
        if (!img) continue;
        const cy = s.decal ? s.y : s.y - img.height / 2;
        if (Math.abs(p.x - s.x) < img.width / 2 + 50 && Math.abs(p.y - cy) < img.height / 2 + 60) return false;
      }
      const k = +p.type.slice(2), P = cfg.props[k];
      if (P && P.onAlt && !altAt(p.x, p.y)) return false;
      if (P && P.onBase && [[0, 0], [-80, 0], [80, 0], [0, -60], [0, 40]].some(([dx, dy]) => altAt(p.x + dx, p.y + dy))) return false;
      for (const d of sheetDecals(cfg, Math.floor(p.x / CHUNK) * CHUNK, Math.floor(p.y / CHUNK) * CHUNK)) {
        const img = SHEET_IMG[d.name];
        if (img && Math.abs(p.x - d.x) < img.width / 2 + 20 && Math.abs(p.y - d.y) < img.height / 2 + 30) return false;
      }
      return true;
    },
    landmarks(cx, cy) {   // piezas fijas del inicio que van encima (sólidas) y choques sin dibujo
      const out = [];
      for (const s of cfg.spawn) {
        if (s.decal && !s.colliders) continue;
        if (!s.decal) {
          const prop = pieceProp(s.name, s.r);
          if (prop && Math.floor(s.x / CHUNK) === cx && Math.floor(s.y / CHUNK) === cy) out.push({ prop, x: s.x, y: s.y, type: 'landmark', solid: prop.solid });
        }
        for (const [x, y, r, ry] of s.colliders || []) {   // ry (opcional): alto del choque; si no, el de siempre (7)
          if (Math.floor(x / CHUNK) !== cx || Math.floor(y / CHUNK) !== cy) continue;
          out.push({ prop: { img: KAI_IMG.none, w: Math.round(r / 0.42), h: 1, foot: 0, r, cry: ry, solid: true, shadow: 'rgba(0,0,0,0)' }, x, y, type: 'landmark', solid: true });
        }
      }
      // Choques de las calcomanías repartidas (la nave dentro de cada cráter)
      if (cfg.decal && cfg.decal.colliders) for (const d of sheetDecals(cfg, cx * CHUNK, cy * CHUNK)) {
        for (const [dx, dy, r] of cfg.decal.colliders) {
          const x = d.x + dx, y = d.y + dy;
          if (Math.floor(x / CHUNK) !== cx || Math.floor(y / CHUNK) !== cy) continue;
          out.push({ prop: { img: KAI_IMG.none, w: Math.round(r / 0.42), h: 1, foot: 0, r, solid: true, shadow: 'rgba(0,0,0,0)' }, x, y, type: 'landmark', solid: true });
        }
      }
      return out;
    },
  });
  T.map = cfg.map || T.map;
}

// Nivel 1 · Los Saiyajin llegan a la Tierra: la pradera del cráter de Raditz. Se arranca frente a la nave de Raditz
// (2.18.6: es la única; antes había más naves en cráteres por el mapa).
sheetTheme('saiyan', {
  base: 'saiyan-grass', map: ['#5ac718', '#4fae18', '#8a6a3a'],
  outline: true,   // contorno oscuro en los enemigos: los Saibaiman y las serpientes son verdes como el pasto y los árboles (2.18.5)
  spawn: [{ name: 'saiyan-crater', x: 0, y: -120, decal: true, colliders: [[5, -90, 16]] }],
  props: [
    { names: ['saiyan-tree3', 'saiyan-tree4', 'saiyan-tree5', 'saiyan-tree6'], r: 7, max: 3, cluster: true },
    { names: ['saiyan-pine2', 'saiyan-pine3'], r: 7, max: 2, cluster: true },
    { names: ['saiyan-rock2', 'saiyan-rock3', 'saiyan-rock4', 'saiyan-rock5'], r: 18, max: 1 },
  ],
});
// Nivel 2 · Namek: el suelo turquesa del Nuevo Namek con zonas de pasto, casas namekianas y árboles Ajisa.
// Se arranca junto a la nave de la Corporación Cápsula.
sheetTheme('namek', {
  base: 'namek-ground', alt: 'namek-grass', altZone: 0.57, edge: '#8a4a1a', map: ['#00cece', '#5ac718', '#8a4a1a'],
  outline: true,   // contorno oscuro en los enemigos: los bichos de Namek son azules como los árboles Ajisa y el suelo (2.18.5)
  // la nave es grande y redonda: además de la base, un choque ovalado que cubre todo su cuerpo (2.18.2)
  spawn: [{ name: 'namek-ship', x: 0, y: -70, r: 40, colliders: [[0, -98, 54, 28]] }],
  props: [
    { names: ['namek-house1', 'namek-house2', 'namek-house3', 'namek-house4'], r: 34, max: 2, chance: 0.1 },
    { names: ['namek-ajisa', 'namek-ajisa~short', 'namek-ajisa~tall', 'namek-ajisa~pair', 'namek-ajisa~trio'], r: 5, max: 3, cluster: true },
  ],
});
// Nivel 3 · Los androides y Cell: el pasto de la arena de los Juegos de Cell con manchas de tierra y mesetas de roca.
// Se arranca arriba del ring (las cuatro columnas chocan).
sheetTheme('rocky', {
  base: 'cell-grass', alt: 'cell-sand', altZone: 0.64, edge: '#8a5a2a', map: ['#7b9400', '#c8a060', '#8a5a2a'],
  spawn: [{ name: 'cell-arena', x: 0, y: 0, decal: true, colliders: [[-145, -150, 9], [145, -150, 9], [-145, 155, 9], [145, 155, 9]] }],
  props: [
    // Solo la meseta entera (las otras perdían el pasto de arriba al recortarlas), sobre pasto y lejos de la tierra
    { names: ['cell-mesa4', 'cell-mesa4~flip'], r: 40, max: 2, chance: 0.5, onBase: true },
  ],
});
// Nivel 4 · Babidi, Dabura y Majin Buu: el desierto del Suroeste (arena y tierra agrietada), con cráteres gigantes.
// Se arranca en el claro de la nave de Babidi.
sheetTheme('buu', {
  base: 'buu-sand', alt: 'buu-dirt', altZone: 0.6, edge: '#a86a3a', map: ['#d8a070', '#c08850', '#6a3a1a'],
  outline: true,   // los enemigos llevan contorno oscuro: algunos (los soldados Majin) se confundían con la arena
  decal: { cell: 950, chance: 0.5, names: ['buu-crater'] },
  spawn: [{ name: 'buu-clearing', x: 0, y: -65, decal: true }, { name: 'buu-ship', x: -1, y: -44, r: 30, colliders: [[-1, -80, 42, 34]] }],   // la nave entera choca (2.18.2)
  props: [
    { names: ['saiyan-rock2', 'saiyan-rock3', 'saiyan-rock4', 'saiyan-rock5'], r: 18, max: 2, cluster: true },
  ],
});

// ─── Nivel bonus: el Camino de la Serpiente (2.19.0) ───────────────────────────────
// Un solo camino largo, siempre el mismo (semilla fija: el ranking y el fantasma comparan lo mismo), que sube en
// zigzag sobre las nubes desde la cabeza de la serpiente (0, 0) hasta su cola, donde flota el planeta de Kaio-sama.
// Los tramos son verticales (siempre hacia arriba) y horizontales, unidos en ángulo recto como en la hoja de GBA;
// como cada tramo horizontal queda más arriba que el anterior, el camino nunca se cruza consigo mismo.
// A mitad de camino, la plaza del palacio de la Princesa Serpiente (un descanso).
const SNAKE = (() => {
  const r = rng(20261016), pts = [[0, 0]];
  const W = 22, RIM = 5, TARGET = 36000, MAXX = 520;   // medio ancho (con el borde, ~54 px como en la hoja)
  let x = 0, y = 0, len = 0;
  const step = (nx, ny) => { len += Math.abs(nx - x) + Math.abs(ny - y); x = nx; y = ny; pts.push([x, y]); };
  step(0, -260);   // el primer tramo sale derecho de la boca de la serpiente
  while (len < TARGET) {
    let h = Math.round((120 + r() * 300) / 10) * 10 * (r() < 0.5 ? -1 : 1);
    if (Math.abs(x + h) > MAXX) h = -h;
    step(x + h, y);
    step(x, y - Math.round((130 + r() * 190) / 10) * 10);
  }
  step(x, y - 120);   // el último tramo entra derecho en la cola
  // Largo acumulado hasta el principio de cada tramo (para saber cuánto camino se recorrió)
  const segs = [];
  let acc = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.abs(bx - ax) + Math.abs(by - ay);
    segs.push({ ax, ay, bx, by, l, s0: acc }); acc += l;
  }
  // Índice por filas de 256 px: cada píxel solo mira los tramos de su fila
  const rows = new Map(), M = W + RIM + 40;
  segs.forEach((s, i) => {
    for (let ry = Math.floor((Math.min(s.ay, s.by) - M) / 256); ry <= Math.floor((Math.max(s.ay, s.by) + M) / 256); ry++) {
      if (!rows.has(ry)) rows.set(ry, []);
      rows.get(ry).push(i);
    }
  });
  // Punto del camino a s px del principio
  const at = s => {
    s = Math.max(0, Math.min(acc, s));
    for (const g of segs) if (s <= g.s0 + g.l) { const f = g.l ? (s - g.s0) / g.l : 0; return [g.ax + (g.bx - g.ax) * f, g.ay + (g.by - g.ay) * f]; }
    return pts[pts.length - 1];
  };
  const plaza = at(acc * 0.5);
  return { pts, segs, rows, total: acc, W, RIM, at, plaza, PLAZA_R: 95, end: pts[pts.length - 1] };
})();
// Distancia "de caja" al camino (0 en el centro; W = borde de las baldosas), con la plaza del palacio
function snakeDist(wx, wy) {
  let best = 1e9;
  for (const i of SNAKE.rows.get(Math.floor(wy / 256)) || []) {
    const g = SNAKE.segs[i];
    const dx = wx < Math.min(g.ax, g.bx) ? Math.min(g.ax, g.bx) - wx : wx > Math.max(g.ax, g.bx) ? wx - Math.max(g.ax, g.bx) : 0;
    const dy = wy < Math.min(g.ay, g.by) ? Math.min(g.ay, g.by) - wy : wy > Math.max(g.ay, g.by) ? wy - Math.max(g.ay, g.by) : 0;
    const d = Math.max(dx, dy);
    if (d < best) best = d;
  }
  const [px, py] = SNAKE.plaza, dp = Math.hypot(wx - px, (wy - py) * 1.25) - (SNAKE.PLAZA_R - SNAKE.W);
  return Math.min(best, dp);
}
// Cuánto camino se recorrió hasta el punto más cercano a (wx, wy)
function snakeProgress(wx, wy) {
  let best = 1e9, s = 0;
  for (const ry of [Math.floor(wy / 256) - 1, Math.floor(wy / 256), Math.floor(wy / 256) + 1]) for (const i of SNAKE.rows.get(ry) || []) {
    const g = SNAKE.segs[i];
    const cx = Math.max(Math.min(g.ax, g.bx), Math.min(Math.max(g.ax, g.bx), wx)), cy = Math.max(Math.min(g.ay, g.by), Math.min(Math.max(g.ay, g.by), wy));
    const d = (wx - cx) ** 2 + (wy - cy) ** 2;
    if (d < best) { best = d; s = g.s0 + Math.abs(cx - g.ax) + Math.abs(cy - g.ay); }
  }
  return s;
}
// 1 nubes (no se pisa: el que se cae, al Infierno) · 2 el camino
const snakeGround = (wx, wy) => snakeDist(wx, wy) < SNAKE.W + SNAKE.RIM ? 2 : 1;
function snakePixel(wx, wy, type, border, near) {
  if (type === 1) {   // nubes; debajo del camino, su sombra
    if (near) {
      for (let k = 1; k <= 4; k++) if (near(0, -k) === 2) return k <= 2 ? OW.rim[0] : shade(OW.cloud[0], 0.55);
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [6, 0], [-6, 0], [0, 6]]) {
        if (near(dx, dy) === 2) { const c = owCloud(wx, wy); return OW_SHADE[OW.cloud.indexOf(c)] || c; }
      }
    }
    return owCloud(wx, wy);
  }
  const d = snakeDist(wx, wy);
  if (d >= SNAKE.W) {   // borde azul festoneado
    const e = d - SNAKE.W, R = OW.rim;
    return e > SNAKE.RIM - 1.5 ? R[0] : e > 2 ? R[(wx + wy) & 4 ? 1 : 2] : e > 0.5 ? R[2] : R[3];
  }
  const u = (wx + wy) & 7, v = (wx - wy) & 7, P = OW.path;
  if (u === 0 || v === 0) return P.line;
  if (u < 3 && v < 3) return P.lite;
  return hash2(wx >> 3, wy >> 3) < 0.5 ? P.base : P.dark;
}
// La cabeza de la serpiente al principio, la cola al final y el planeta de Kaio-sama flotando arriba
// (recortes de la hoja de The Legacy of Goku: assets/maps/snake-*.png)
const SNAKE_IMG = {};
THEME_PENDING.snakeway = 3;
for (const n of ['head', 'tail', 'planet']) {
  const img = new Image();
  img.onload = () => { SNAKE_IMG[n] = img; THEME_PENDING.snakeway--; dropThemeCache('snakeway'); };
  img.onerror = () => THEME_PENDING.snakeway--;
  img.src = `assets/maps/snake-${n}.png`;
}
// Dónde va cada imagen (esquina de arriba a la izquierda): el tramo de camino de la cabeza (columnas 58-110) y el
// de la cola (52-105) caen justo sobre el camino del mapa
const snakeDecals = () => {
  const [ex, ey] = SNAKE.end;
  return [['head', -84, 0], ['tail', ex - 79, ey - 89], ['planet', ex - 275, ey - 150]];   // el planeta, a la izquierda de la cola (se ve al llegar)
};
function snakeDeco(c, r, ox, oy) {
  for (const [n, x, y] of snakeDecals()) {
    const img = SNAKE_IMG[n];
    if (!img || x > ox + CHUNK || y > oy + CHUNK || x + img.width < ox || y + img.height < oy) continue;
    c.drawImage(img, x - ox, y - oy);
  }
}
THEMES.snakeway = {
  sand: ['#f7a500'], dirt: ['#f7a500'], edge: '#211873', grass: ['#bdb5e7'], gedge: '#211873',
  det: {}, rock: { a: '#f7c500', b: '#f7a500', c: '#f78c00', d: '#d06a00', e: '#a04a00', f: '#ffffff' },
  bush: { a: '#ffe14d', b: '#f7b500', c: '#f79400', d: '#ffffff', e: '#a04a00' },
  map: ['#f7a500', '#f7a500', '#bdb5e7'], spires: 0, trees: 0, bg: '#2a1400',
  margin: 6,
  ground: snakeGround,
  pixel: snakePixel,
  deco: snakeDeco,
  blocked: (x, y) => snakeGround(x, y) === 1,   // las nubes no se pisan (salvo con las caídas activadas: ver bonus.js)
  makeProps: () => ({}),
  keepProp: () => false,
  props() {},
};
