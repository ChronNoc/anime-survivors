'use strict';
// ─── Sprites dibujados a mano (personajes sin sprites de GBA disponibles) ────────
// Se componen por partes (cabeza, torso, brazos y piernas en varias poses) sobre una
// celda de 32×32 con el mismo motor de píxeles que sprites.js, que agrega el contorno.
// El resultado se registra como si fuera una hoja externa (perfil, frente, espaldas).

const CUSTOM_SPRITES = (() => {
  // Pinta un dibujo ASCII ('.' = vacío) en la posición (ox, oy) de la celda
  function stamp(px, art, ox, oy) {
    art.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') px(ox + x, oy + y, 1, 1, row[x]);
    });
  }
  const mirror = art => art.map(r => [...r].reverse().join(''));

  // ─── Saibaiman ──────────────────────────────────────────────────────────────
  // g piel · G sombra · l brillo · v venas · d brazo trasero · r/R/w ojo · m boca
  const SAIBA_PAL = {
    g: '#5fbf3a', G: '#3c8a28', l: '#a6e86e', v: '#2f7424', d: '#2f6e21',
    r: '#ff2a2a', R: '#8a0f0f', w: '#ffffff', m: '#173512',
  };
  const S = {
    headSide: [
      '.....lllll....',
      '...llgggggll..',
      '..lgvgggvgggl.',
      '.lgvggvgggvggg',
      '.ggvgggvggggvg',
      'gggggvgggvgggg',
      'ggvggggvgggrrg',
      'Ggggvgggggrwrg',
      'GGgggvggggRrgg',
      'GGgggggggggggm',
      '.GGgggggggmmm.',
      '..GGGgggggg...',
      '....GGGGGG....',
    ],
    headFront: [
      '.....llll.....',
      '...llggggll...',
      '..lgvggggvgl..',
      '.lgvggvvggvgl.',
      '.ggvggggggvgg.',
      'gggggvggvggggg',
      'ggvggggggggvgg',
      'gggrrggggrrggg',
      'GgRwrggggrwRgG',
      'GGgRggggggRggG',
      '.GGggmmmmggGG.',
      '..GGGggggGGG..',
      '....GGGGGG....',
    ],
    headBack: [
      '.....llll.....',
      '...llggggll...',
      '..lgvggggvgl..',
      '.lgvggvvggvgl.',
      '.ggvgvggvgvgg.',
      'gggvgggvggvggg',
      'ggvggvgggvgvgg',
      'gggvgggvgggvgg',
      'GggvggvggvgggG',
      'GGggvgggvgggGG',
      '.GGggggggggGG.',
      '..GGGggggGGG..',
      '....GGGGGG....',
    ],
    torsoSide: [
      '...GgG...',
      '..gggggg.',
      '.Gglggggg',
      '.Gglggvgg',
      '.Gggggggg',
      '..GgggggG',
      '..GgvgggG',
      '...GgggG.',
    ],
    torsoFront: [
      '...GggG...',
      '.gggggggg.',
      'GgglgglggG',
      'GgggllgggG',
      'GggggvgggG',
      '.GgggggggG',
      '.GgvgggvgG',
      '..GggggggG',
    ],
    torsoBack: [
      '...GggG...',
      '.gggggggg.',
      'GggggvgggG',
      'GggggvgggG',
      'GggggvgggG',
      '.GggggvggG',
      '.GggggvggG',
      '..GggggggG',
    ],
    armBack: ['dd', 'dd', 'dd', 'dd.', '.dd', '.dd'],
    armDown: ['gg.', 'gGg', '.gG', '.gG', '.gG', '.lll'],
    armUp: ['..lll', '..gG.', '.gG..', '.gG..', 'gG...', 'gg...', 'gg...'],
    armForward: ['gggggll', 'GGGGGlll'],
    armFrontDown: ['gg.', 'gGg', '.gG', '.gG', '.gG', 'lll'],
    armFrontUp: ['lll', 'gG.', 'gG.', '.gG', '.gG', '..gg', '..gG', '...gg'],
    armFrontOut: ['ggggll', 'gGGGGl'],
    legsSide: {
      A: ['..GgGgG...', '..gG..gG..', '..gG..gG..', '.gG....gG.', '.gG....gG.', '.gG....gG.', 'gG......gG', 'gG......gG', 'gG......gG', 'lll....lll'],
      B: ['..GgGgG...', '..gG...gG.', '.gG.....gG', '.gG......gG', 'gG.......gG', 'gG........g', 'gG........gG', 'G.........gG', 'G..........g', 'll........lll'],
      C: ['..GgGgG...', '...gGgG...', '...gGgG...', '..gG.gG...', '..gG.gG...', '.gG...gG..', '.gG...gG..', 'gG.....gG.', 'gG.....gG.', 'lll...lll.'],
    },
    legsFront: {
      A: ['..GgGgGg..', '..gG..gG..', '..gG..gG..', '.gG....gG.', '.gG....gG.', '.gG....gG.', '.gG....gG.', 'gG......gG', 'gG......gG', 'll......ll'],
      B: ['..GgGgGg..', '..gG..gG..', '.gG...gG..', '.gG....gG.', 'gG.....gG.', 'gG.....gG.', 'lll....gG.', '........gG', '........gG', '........ll'],
      C: ['..GgGgGg..', '..gG..gG..', '..gG...gG.', '.gG....gG.', '.gG.....gG', '.gG.....gG', '.gG....lll', 'gG........', 'gG........', 'll........'],
    },
  };
  // Poses de los 7 fotogramas: reposo · caminar ×4 · ataque ×2
  const FRAMES = [
    { legs: 'A', bob: 0, arms: 'down' }, { legs: 'B', bob: 0, arms: 'down' }, { legs: 'A', bob: 1, arms: 'down' },
    { legs: 'C', bob: 0, arms: 'down' }, { legs: 'A', bob: 1, arms: 'down' },
    { legs: 'A', bob: 0, arms: 'up' }, { legs: 'B', bob: 0, arms: 'forward' },
  ];
  function saibaFrame(dir, f) {
    const P = makePixels(32, 32), px = P.px, b = f.bob;
    if (dir === 'side') {
      stamp(px, S.armBack, 9, 15 + b);
      stamp(px, S.legsSide[f.legs], 10, 22);
      stamp(px, S.torsoSide, 10, 14 + b);
      stamp(px, S.headSide, 7, 1 + b);
      if (f.arms === 'up') stamp(px, S.armUp, 17, 8 + b);
      else if (f.arms === 'forward') stamp(px, S.armForward, 17, 16 + b);
      else stamp(px, S.armDown, 17, 15 + b);
    } else {
      const legs = S.legsFront[f.legs];
      stamp(px, legs, 11, 22);
      stamp(px, dir === 'down' ? S.torsoFront : S.torsoBack, 11, 14 + b);
      stamp(px, dir === 'down' ? S.headFront : S.headBack, 9, 1 + b);
      if (f.arms === 'up') { stamp(px, S.armFrontUp, 7, 8 + b); stamp(px, mirror(S.armFrontUp), 22, 8 + b); }
      else if (f.arms === 'forward') { stamp(px, S.armFrontOut, 5, 16 + b); stamp(px, mirror(S.armFrontOut), 21, 16 + b); }
      else { stamp(px, mirror(S.armFrontDown), 8, 15 + b); stamp(px, S.armFrontDown, 21, 15 + b); }
    }
    const pal = Object.fromEntries(Object.entries(SAIBA_PAL).map(([k, h]) => [k, hexRgb(h)]));
    return pixelsToCanvas(P, pal);
  }

  // Hoja: filas perfil, frente y espaldas; 7 fotogramas por fila
  function buildSheet(frameFn) {
    const sheet = document.createElement('canvas');
    sheet.width = 32 * FRAMES.length; sheet.height = 32 * 3;
    const cx = sheet.getContext('2d');
    ['side', 'down', 'up'].forEach((dir, r) => FRAMES.forEach((f, i) => cx.drawImage(frameFn(dir, f), i * 32, r * 32)));
    return sheet;
  }
  // ─── Saibaiman a partir del cuerpo de un soldado de Legacy of Goku ──────────
  // Se recolorea el cuerpo en verdes según el brillo de cada píxel (conserva sombras y
  // volumen) y se le pone una cabeza de Saibaiman dibujada a mano en cada dirección.
  const HEAD_PAL = {
    o: '#14290d', L: '#b4f07a', g: '#5fbf3a', G: '#3c8a28', v: '#2a6b1f', R: '#9e0c0c', r: '#ff3030', m: '#10230b',
  };
  const HEADS = {
    side: [
      '....ooooo....',
      '..ooLLLggoo..',
      '.oLLggvggvgo.',
      'oLgvggvgggvgo',
      'oggvgvggvgggo',
      'oGggvgggvRrgo',
      'oGGgggvggrRgo',
      '.oGGgggggggmo',
      '.oGGGgggmmmo.',
      '..ooGGGGGoo..',
      '....ooooo....',
    ],
    down: [
      '....ooooo....',
      '..ooLLLLLoo..',
      '.oLLgvgvgLLo.',
      'oLgvggvggvgLo',
      'oggvgvgvgvggo',
      'oGRrggvggrRGo',
      'oGRrgggggrRGo',
      '.oGggmmmggGo.',
      '.oGGgmmmgGGo.',
      '..ooGGGGGoo..',
      '....ooooo....',
    ],
    up: [
      '....ooooo....',
      '..ooLLLLLoo..',
      '.oLLgvgvgLLo.',
      'oLgvggvggvgLo',
      'oggvgvgvgvggo',
      'oGgvggvggvgGo',
      'oGGgvgvgvgGGo',
      '.oGGgvgvgGGo.',
      '.oGGGgggGGGo.',
      '..ooGGGGGoo..',
      '....ooooo....',
    ],
  };
  const SOLDIER_BODY_VARIANT = 4;   // la variante verde de la hoja de soldados
  const GREEN_RAMP = ['#142b0e', '#2a6b1f', '#3c8a28', '#5fbf3a', '#7fd452', '#a6e86e'].map(hexRgb);
  function buildSaibaFromSoldier(img) {
    const sheet = document.createElement('canvas');
    sheet.width = 32 * 7; sheet.height = 32 * 3;
    const cx = sheet.getContext('2d');
    cx.drawImage(img, 0, SOLDIER_BODY_VARIANT * 3 * 32, 32 * 7, 32 * 3, 0, 0, 32 * 7, 32 * 3);
    const data = cx.getImageData(0, 0, sheet.width, sheet.height), d = data.data, W = sheet.width;
    const headPal = Object.fromEntries(Object.entries(HEAD_PAL).map(([k, h]) => [k, hexRgb(h)]));
    ['side', 'down', 'up'].forEach((dir, r) => {
      for (let f = 0; f < 7; f++) {
        const x0 = f * 32, y0 = r * 32;
        const at = (x, y) => ((y0 + y) * W + x0 + x) * 4;
        // Parte superior del sprite (la cabeza del soldado) y su centro horizontal
        let top = 32;
        for (let y = 0; y < 32 && top === 32; y++) for (let x = 0; x < 32; x++) if (d[at(x, y) + 3]) { top = y; break; }
        let sumX = 0, n = 0;
        for (let y = top; y < top + 7; y++) for (let x = 0; x < 32; x++) if (d[at(x, y) + 3]) { sumX += x; n++; }
        const hx = n ? Math.round(sumX / n) : 16;
        // Cuerpo: recoloreado en verdes por brillo; la cabeza del soldado se borra
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const i = at(x, y);
          if (!d[i + 3]) continue;
          if (y < top + 8) { d[i + 3] = 0; continue; }
          const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
          const c = GREEN_RAMP[lum < 50 ? 0 : lum < 110 ? 1 : lum < 165 ? 2 : lum < 215 ? 3 : lum < 245 ? 4 : 5];
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
        // Cabeza de Saibaiman: el mentón queda sobre el cuello del soldado
        const art = HEADS[dir], ox = hx - 6 + (dir === 'side' ? 1 : 0), oy = top + 9 - art.length + 1;
        art.forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const ch = row[x], X = ox + x, Y = oy + y;
            if (ch === '.' || X < 0 || Y < 0 || X >= 32 || Y >= 32) continue;
            const i = at(X, Y), c = headPal[ch];
            d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
          }
        });
      }
    });
    cx.putImageData(data, 0, 0);
    return sheet;
  }
  function register() {
    // Mientras carga (o si no se puede leer la imagen, p. ej. abriendo el archivo con
    // doble clic), se usa el Saibaiman dibujado por partes
    EXTERNAL.set('saibaman', { img: buildSheet(saibaFrame), ...GBA_ANIMS(0), dirs: DIRS_PLAIN, fps: 11 });
    const img = new Image();
    img.onload = () => {
      try { EXTERNAL.set('saibaman', { img: buildSaibaFromSoldier(img), ...GBA_ANIMS(0), dirs: DIRS_PLAIN, fps: 10 }); }
      catch (e) { /* imagen sin permiso de lectura (file://): se queda el dibujado por partes */ }
    };
    img.src = 'assets/sprites/soldier.png';
  }
  return { register };
})();
