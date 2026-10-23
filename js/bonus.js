'use strict';
// ─── Niveles bonus (2.19.0): el Camino de la Serpiente ─────────────────────────────
// Se elige en la ventana de Jugar, en la sección NIVELES BONUS. Dos modos (cada uno con su ranking por tiempo):
//   race:  Carrera. Sin enemigos: corres más rápido, hay nubes Kinton que te impulsan y tu fantasma (tu mejor
//          recorrido) corre a tu lado.
//   fight: Con enemigos. Se juega como siempre (técnicas, subir de nivel) mientras avanzas por el camino; a mitad
//          de camino, el palacio de la Princesa Serpiente: un descanso con Semillas del Ermitaño.
// Caídas (opcional): si te sales del camino caes al Infierno y vuelves al último punto de control. Sin caídas, el
// borde no te deja salir. Solo con las caídas activadas se puede publicar en el ranking (2.19.1): uno por modo
// (snake_race y snake_fight); sin caídas es práctica (el récord y el fantasma se guardan igual, aparte).
// Se gana al llegar a la cola de la serpiente; la primera vez, Kaio-sama le enseña el Kaioken a Goku.
// El camino y su dibujo están en js/maps.js (SNAKE, tema 'snakeway'). Solo se juega en solitario.

const SNAKE_CPS = 10;               // puntos de control: uno cada 100.000 km
const SNAKE_RACE_SPEED = 1.5;       // en la Carrera se corre más rápido
const KINTON_BOOST = 1.5, KINTON_TIME = 2.5;
const SNAKE_FALL_TIME = 0.8;        // lo que dura la caída antes de volver al punto de control
const SNAKE_REST_TIME = 12;         // el descanso en el palacio de la Princesa Serpiente (sin enemigos)
const snakeRankId = (mode, fall) => `snake_${mode}${fall ? '' : '_safe'}`;
const BONUS_RANKS = [{ id: 'snake_race', label: '🐍 Carrera' }, { id: 'snake_fight', label: '🐍 Con enemigos' }];
const snakeCpAt = i => SNAKE.at(SNAKE.total * i / SNAKE_CPS);

// Nubes Kinton de la Carrera: una cada ~1600 px de camino, lejos de las puntas y de la plaza
function kintonSpots() {
  const out = [];
  for (let s = 900; s < SNAKE.total - 700; s += 1600) {
    const [x, y] = SNAKE.at(s + (hash2(s, 7) - 0.5) * 400);
    if (Math.hypot(x - SNAKE.plaza[0], y - SNAKE.plaza[1]) < SNAKE.PLAZA_R + 60) continue;
    out.push({ x, y, used: false, phase: hash2(s, 3) * 6 });
  }
  return out;
}
function snakeInit() {
  const mode = SAVE.snakeMode === 'fight' ? 'fight' : 'race', fall = SAVE.snakeFall !== false, rankId = snakeRankId(mode, fall);
  G.lv = { ...G.lv, rankId };
  G.snake = { mode, fall, rankId, prog: 0, best: 0, cp: 0, trail: [], trailT: 0, falling: 0, falls: 0,
    rest: false, restT: 0, kintons: mode === 'race' ? kintonSpots() : [], ghost: (SAVE.snakeGhost || {})[rankId] || null };
  for (const P of G.players) { P.x = 0; P.y = -40; }
  document.body.classList.add('snake-run');   // sin mapa (ni en el HUD ni en la pausa): no se ve el recorrido
  if (mode === 'race') { G.spawnAcc = -1e12; G.nextElite = G.nextSwarm = 1e12; }   // sin enemigos
  announce(mode === 'race' ? '¡A correr! Un millón de kilómetros hasta el planeta de Kaio-sama' : '¡Al planeta de Kaio-sama! Cuidado con lo que te persigue', '#8fd8ff');
}
// Los enemigos aparecen sobre el camino, adelante o atrás tuyo (los que vuelan cruzan las nubes)
function snakeSpawnPos() {
  const S = G.snake, ahead = Math.random() < 0.7, s = S.best + (ahead ? 1 : -1) * rand(380, 720);
  const [x, y] = SNAKE.at(s);
  return { x: x + rand(-8, 8), y: y + rand(-8, 8) };
}
function snakeUpdate(dt) {
  const S = G.snake, P = G.me;
  if (!S || !P || P.dead || G.victoryAt) return;
  if (P.boost > 0) P.boost -= dt;
  // Cayendo al Infierno: al terminar, de vuelta en el último punto de control
  if (S.falling > 0) {
    P.fallT = S.falling -= dt;
    if (S.falling <= 0) {
      P.fallT = 0;
      const [x, y] = snakeCpAt(S.cp);
      P.x = x; P.y = y - 10; P.inv = Math.max(P.inv, 1.5);
      if (S.mode === 'fight') P.hp = Math.max(1, P.hp - Math.round(P.maxHp * 0.12));
      announce('De vuelta en el punto de control', '#8fd8ff');
    }
    return;
  }
  // ¿Se salió del camino? (con las caídas activadas): los dos pies sobre las nubes
  if (S.fall && THEME.blocked(P.x - 4, P.y + 10) && THEME.blocked(P.x + 4, P.y + 10)) {
    S.falling = P.fallT = SNAKE_FALL_TIME; S.falls++;
    addText(P.x, P.y - 30, '¡Caíste al Infierno!', '#ff5c3d', true);
    sfx('hurt', 0.2);
    return;
  }
  S.prog = snakeProgress(P.x, P.y);
  if (S.prog > S.best && S.prog - S.best < 400) S.best = S.prog;   // (un salto grande sería un error de cálculo)
  while (S.cp < SNAKE_CPS - 1 && S.best >= SNAKE.total * (S.cp + 1) / SNAKE_CPS) {
    S.cp++;
    announce('¡Punto de control!', '#8fd8ff');   // sin decir cuánto falta
    sfx('pickup');
  }
  if ((S.trailT -= dt) <= 0) { S.trailT = 0.1; S.trail.push([Math.round(P.x), Math.round(P.y)]); }
  for (const k of S.kintons) {
    if (k.used || Math.hypot(P.x - k.x, P.y - k.y) > 26) continue;
    k.used = true; P.boost = KINTON_TIME;
    addText(P.x, P.y - 30, '¡Nube Kinton!', '#ffe14d', true);
    burst(k.x, k.y, '#ffe14d', 14, 3, 3); sfx('power', 0.2);
  }
  // El palacio de la Princesa Serpiente: un descanso (se van los enemigos de alrededor y hay semillas)
  if (S.mode === 'fight' && !S.rest && Math.hypot(P.x - SNAKE.plaza[0], (P.y - SNAKE.plaza[1]) * 1.25) < SNAKE.PLAZA_R) {
    S.rest = true; S.restT = SNAKE_REST_TIME;
    for (const e of G.enemies) if (!e.boss && Math.hypot(e.x - P.x, e.y - P.y) < 520) { e.dead = true; poof(e.x, e.y); }
    for (const [dx, dy] of [[-40, 10], [0, -30], [40, 10]]) G.pickups.push({ kind: 'senzu', x: SNAKE.plaza[0] + dx, y: SNAKE.plaza[1] + dy, pulled: false, sp: 0 });
    announce('Palacio de la Princesa Serpiente: ¡a descansar y comer algo!', '#ff9bd6');
  }
  if (S.restT > 0) {
    S.restT -= dt;
    G.spawnAcc = Math.min(G.spawnAcc, 0); G.nextElite = Math.max(G.nextElite, G.t + 1); G.nextSwarm = Math.max(G.nextSwarm, G.t + 1);
    if (S.restT <= 0) announce('¡Se terminó el descanso! A seguir', '#ffffff');
  }
  // La llegada: la cola de la serpiente
  if (Math.hypot(P.x - SNAKE.end[0], P.y - SNAKE.end[1]) < 45) {
    G.victoryAt = G.t;
    announce('¡Llegaste al planeta de Kaio-sama!', '#ffe14d');
  }
}
// En el mundo: las nubes Kinton, el cartel del palacio y el fantasma
function snakeDrawWorld(c, time) {
  const S = G.snake;
  if (!S) return;
  // (los puntos de control no se ven en el camino: se avisan al pasarlos)
  for (const k of S.kintons) {   // nube Kinton: dorada, flotando
    if (k.used) continue;
    const y = k.y + Math.sin(time * 3 + k.phase) * 2;
    c.save(); c.globalAlpha = 0.35; c.fillStyle = '#fff3a0'; circle(c, k.x, y, 18); c.globalAlpha = 1;
    c.fillStyle = '#b07a10'; for (const [dx, r] of [[-8, 6], [0, 8], [8, 6]]) circle(c, k.x + dx, y + 1, r + 1);
    c.fillStyle = '#ffd93b'; for (const [dx, r] of [[-8, 6], [0, 8], [8, 6]]) circle(c, k.x + dx, y, r);
    c.fillStyle = '#fff6c0'; circle(c, k.x - 3, y - 3, 3);
    c.restore();
  }
  if (S.mode === 'fight') {   // cartel del palacio
    const [px, py] = SNAKE.plaza;
    c.font = `700 11px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round'; c.lineWidth = 3;
    c.strokeStyle = '#0a0f2e'; c.strokeText(t('Palacio de la Princesa Serpiente'), px, py - SNAKE.PLAZA_R * 0.8 - 6);
    c.fillStyle = '#ff9bd6'; c.fillText(t('Palacio de la Princesa Serpiente'), px, py - SNAKE.PLAZA_R * 0.8 - 6);
  }
  const g = S.ghost;   // el fantasma: tu mejor recorrido, translúcido
  if (g && g.trail && g.trail.length) {
    const f = G.t / 0.1, i = Math.min(g.trail.length - 1, Math.floor(f)), j = Math.min(g.trail.length - 1, i + 1), u = f - i;
    const x = g.trail[i][0] + (g.trail[j][0] - g.trail[i][0]) * u, y = g.trail[i][1] + (g.trail[j][1] - g.trail[i][1]) * u;
    const ch = CHARACTERS[g.char] || CHARACTERS.goku;
    c.save(); c.globalAlpha = 0.35;
    drawActor(c, ch.look, x, y, { facing: g.trail[j][0] >= g.trail[i][0] ? 1 : -1, anim: 'walk', t: G.t, noShadow: true });
    c.restore();
  }
}
// En el HUD: solo las caídas (no se muestra cuánto camino falta: la gracia es no saberlo)
function snakeDrawHud() {
  const S = G.snake;
  if (!S || !S.falls) return;
  hudText(t('Caídas: {n}', { n: S.falls }), W / 2, 70, 13, '#ffb0a0', 'center');
}

// ─── Sección NIVELES BONUS en la ventana de Jugar ───
function bonusSection(sel) {
  const frag = document.createDocumentFragment(), head = document.createElement('div');
  head.className = 'bonus-head';
  head.textContent = t('NIVELES BONUS');
  frag.appendChild(head);
  const L = BONUS_LEVELS[0], mode = SAVE.snakeMode === 'fight' ? 'fight' : 'race', fall = SAVE.snakeFall !== false;
  const best = bestOf(snakeRankId(mode, fall), myChar()), card = document.createElement('button');
  card.className = 'level-card weekly bonus' + (sel === L.id ? ' selected' : '');
  card.innerHTML = `${levelPic(L.id)}<span class="wk-info"><b>🐍 ${t('El Camino de la Serpiente')}</b><small>${esc(t(L.desc))}</small>
    <span class="bn-opts">
      <span class="bn-group"><span data-mode="race" class="bn-opt${mode === 'race' ? ' on' : ''}">${t('🏃 Carrera')}</span><span data-mode="fight" class="bn-opt${mode === 'fight' ? ' on' : ''}">${t('⚔️ Con enemigos')}</span></span>
      <span data-fall="1" class="bn-opt${fall ? ' on' : ''}">${fall ? t('🔥 Caídas al Infierno: sí') : t('🛡️ Caídas al Infierno: no')}</span>
    </span>
    <span class="lv-state">${fall ? '' : '<b class="bn-warn">' + t('Sin caídas no hay ranking') + '</b> · '}${mode === 'race' ? t('Sin enemigos, con nubes Kinton y tu fantasma') : t('Con enemigos y un descanso a mitad de camino')} · ${best ? t('Tu mejor tiempo: {time}', { time: fmtTimeCs(Math.round(best * 100)) }) : t('Sin tiempo todavía')}${(SAVE.rewards || {}).kaioken ? '' : ' · ' + t('Premio: el Kaioken para Goku')}</span></span>`;
  card.onclick = ev => {
    SFX.unlock();
    const m = ev.target.closest('[data-mode]'), f = ev.target.closest('[data-fall]');
    if (m) SAVE.snakeMode = m.dataset.mode;
    if (f) SAVE.snakeFall = !fall;
    SAVE.level = L.id; writeSave(); buildMenu();
  };
  frag.appendChild(card);
  // Próximamente (2.23.1): el Torneo Mundial de Artes Marciales. Solo la tarjeta, todavía no se puede jugar
  // (la imagen es el estadio de Papaya Island, de Buu's Fury: assets/levels/tournament.png)
  const soon = document.createElement('div');
  soon.className = 'level-card weekly bonus soon';
  soon.innerHTML = `${levelPic('tournament')}<span class="wk-info"><b>🥋 ${t('Torneo Mundial de Artes Marciales')}</b>
    <small>${t('Combates uno contra uno en el ring del Torneo. Si te caes del ring, pierdes.')}</small>
    <span class="lv-state"><b class="soon-tag">${t('PRÓXIMAMENTE')}</b></span></span>`;
  frag.appendChild(soon);
  return frag;
}
