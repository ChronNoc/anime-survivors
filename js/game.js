'use strict';
// ─── Bucle principal, entidades, combate, progresión e interfaz ──────────────────
// La simulación la ejecuta quien tiene la autoridad: el jugador en solitario o el
// anfitrión de una sala online. Los clientes reciben instantáneas (ver net.js).

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

// El mundo se dibuja en un búfer de baja resolución (1 unidad = 1 píxel de arte)
// y se amplía sin suavizado: PIX píxeles de pantalla por cada píxel de arte.
const buf = document.createElement('canvas');
const bctx = buf.getContext('2d');
let W = 0, H = 0, DPR = 1, PIX = 2, SCALE = 1, BW = 0, BH = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  PIX = Math.max(1, Math.floor(Math.min(W, H) * DPR / 330));
  SCALE = PIX / DPR;
  BW = Math.max(1, Math.ceil(canvas.width / PIX)); BH = Math.max(1, Math.ceil(canvas.height / PIX));
  buf.width = BW; buf.height = BH;
}
// Convierte coordenadas del mundo a píxeles CSS de pantalla
let camX = 0, camY = 0, splitLayout = null;
const toScreen = (x, y) => [(x - camX + BW / 2) * SCALE, (y - camY + BH / 2) * SCALE];
const FONT = '"Fredoka", "Trebuchet MS", sans-serif';
addEventListener('resize', resize);
resize();

// ─── Modo prueba ─────────────────────────────────────────────────────────────
// Entrando con ?test en el enlace (y la contraseña): todos los personajes desbloqueados, atajos
// de teclado para probar (F1-F5) y nada se guarda, así la partida guardada real queda intacta.
// Se guarda solo el hash SHA-256 de la contraseña; una vez aceptada, vale para esa pestaña.
const TEST_REQUESTED = new URLSearchParams(location.search).has('test');
const TEST_PASS_HASH = '90a324c7b4654080afde1073fb7b8f07b619a41957d12aa33f68a344f54b3154';   // password: dbzadmin
const TEST_SESSION_KEY = 'dbzsurvivor.test';
let TEST_MODE = false;
// Ya no hace falta ?test en el enlace para que se mantenga activo al recargar: alcanza con la sesión
// guardada (entrada con ?test o con el atajo secreto en el menú, ambos llevan a la misma contraseña).
try { TEST_MODE = sessionStorage.getItem(TEST_SESSION_KEY) === TEST_PASS_HASH; } catch (e) { /* sin almacenamiento */ }
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Guardado ────────────────────────────────────────────────────────────────
const SAVE_KEY = 'dbzsurvivor.save.v1';
function loadSave() {
  const def = { best: {}, zeni: 0, runs: 0, wins: 0, name: '', char: 'goku', upgrades: {}, unlocked: {}, vegetaKills: 0, ach: {}, stats: {},
    level: 'saiyan', levelsWon: {},
    // Accessibility/quality options: 0-1 multipliers for particle count, camera shake and flash
    // brightness, plus toggles for damage numbers and the big ability-name callouts.
    fx: { particles: 1, shake: 1, flash: 1, dmgNumbers: true, abilityNames: true } };
  let s;
  try { s = Object.assign(def, JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); } catch (e) { s = def; }
  // Estadísticas acumuladas para los logros (bajas totales, victorias por guerrero, evoluciones vistas)
  s.stats = Object.assign({ kills: 0, winsBy: {}, evos: {}, wishes: {},
    // Logros de leyenda (2.12.0): tiempo jugado (s), Zeni ganado, élites, jefes por id, evoluciones, transformaciones,
    // fusiones, invocaciones de Shenlong, niveles ganados por guerrero ("nivel|guerrero"), victorias online y del desafío
    time: 0, zeniEarned: 0, elites: 0, bosses: {}, evoCount: 0, transforms: 0, fusions: 0, summons: 0,
    lvWins: {}, onlineWins: 0, weeklyWins: 0, weeklyWeeks: {},
    // Perfil (2.22.0): partidas y segundos por guerrero, quién te derrotó (id del jefe, o "horde"), daño total por técnica
    charRuns: {}, charTime: {}, killedBy: {}, techDmg: {} }, s.stats);
  s.fx = Object.assign({ particles: 1, shake: 1, flash: 1, dmgNumbers: true, abilityNames: true }, s.fx);
  // La mejora «Técnica secreta» (1500 Zeni) se reemplazó: se devuelve lo que costó
  if (s.upgrades && s.upgrades.moves) { s.zeni += 1500; delete s.upgrades.moves; s.refundedMoves = true; }
  return s;
}
function writeSave() { if (TEST_MODE) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) { /* sin almacenamiento */ } }
const SAVE = loadSave();
if (SAVE.refundedMoves) { delete SAVE.refundedMoves; writeSave(); }   // guarda la devolución de la Técnica secreta
const myName = () => (SAVE.name || '').trim() || t('Guerrero');
// Con el desafío semanal elegido y un guerrero fijo, ese es el que se juega (el que eligió la persona queda guardado
// para los otros niveles)
const weeklyChar = () => (SAVE.level === 'weekly' && WEEKLY && WEEKLY.char && CHARACTERS[WEEKLY.char] ? WEEKLY.char : null);
// Desafío semanal parejo (2.19.0): todos juegan con las mejoras de la tienda al máximo y con todos los guerreros
// (aunque no los tengan desbloqueados). Cada día hay WEEKLY_TRIES intentos que cuentan para el ranking; después se
// puede seguir jugando como práctica. Los intentos se cuentan en este navegador y vuelven a las 00:00 de Argentina.
const WEEKLY_TRIES = 3;
const weeklyOpen = () => SAVE.level === 'weekly' && !!WEEKLY;
const artDay = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
function weeklyTriesLeft() {
  const w = SAVE.wkTries;
  return w && WEEKLY && w.week === WEEKLY.week && w.day === artDay() ? Math.max(0, WEEKLY_TRIES - w.n) : WEEKLY_TRIES;
}
function useWeeklyTry() {
  const left = weeklyTriesLeft();
  if (!left) return false;
  SAVE.wkTries = { week: WEEKLY.week, day: artDay(), n: WEEKLY_TRIES - left + 1 };
  writeSave();
  return true;
}
const maxPerks = () => cleanPerks(Object.fromEntries(SHOP_UPGRADES.map(u => [u.id, u.max])));
const myChar = () => weeklyChar() || (CHARACTERS[SAVE.char] && (isUnlocked(SAVE.char) || weeklyOpen()) ? SAVE.char : 'goku');
// Tiered transformations: c.forms = [{key,name,aura,ssjHair,transformSprite,transformTime,statMult},...], ordered weakest to strongest.
// Characters without a `forms` array fall back to their legacy single-stage ssjHair/aura/transform/transformSprite fields as a one-form list.
function charForms(c) {
  if (c.forms) return c.forms;
  if (c.transform !== undefined) {
    return [{ key: 'ssj', name: c.transform, aura: c.aura, ssjHair: c.ssjHair, transformSprite: c.transformSprite, transformTime: c.transformTime, statMult: c.transformBonus ? { dmg: c.transformBonus } : null }];
  }
  return [];
}
// Currently active form for a player (null when not transformed or character has no forms).
const activeForm = P => (P.transformed > 0 && P.tier > 0) ? charForms(P.c)[P.tier - 1] : null;
// Aura color to draw/HUD with right now: the active tier's color, else the character's base color.
const formAura = P => { const f = activeForm(P); return f ? f.aura : P.c.aura; };
// Sprite/portrait key to request from drawActor/drawPortraitTo right now (false = base look).
const formKeyFor = P => (P.transformed > 0 && hasTransformLook(P.c)) ? ((activeForm(P) && activeForm(P).key) || 'ssj') : false;
// First-tier sprite key for static previews (menu cards, title-screen hero) that aren't a live transformed player.
const baseFormKey = c => (charForms(c)[0] && charForms(c)[0].key) || 'ssj';
// ¿Se ve distinto al transformarse? (pelo Super Saiyajin, o una hoja propia como Piccolo sin capa) - true if ANY tier changes the sprite.
const hasTransformLook = c => charForms(c).some(f => f.ssjHair || f.transformSprite);
// Niveles: el 1 está abierto; cada uno se abre al ganar el anterior (en el modo prueba, todos)
const isLevelOpen = id => { const L = levelDef(id); return TEST_MODE || L.bonus || L.num === 1 || !!SAVE.levelsWon[LEVELS[L.num - 2].id]; };
const myLevel = () => SAVE.level === 'weekly' ? (WEEKLY ? 'weekly' : 'saiyan') : (isLevelOpen(SAVE.level) ? levelDef(SAVE.level).id : 'saiyan');
// Récord de un guerrero en un nivel (los récords de antes de los niveles cuentan para el Nivel 1)
const bestOf = (lv, ch) => SAVE.best[`${lv}|${ch}`] || (lv === 'saiyan' ? SAVE.best[ch] || 0 : 0);

// ─── Personajes desbloqueables ───────────────────────────────────────────────
const isUnlocked = id => TEST_MODE || !CHARACTERS[id].unlock || !!SAVE.unlocked[id];
// Progreso hacia el desbloqueo, para mostrar en el menú
function unlockProgress(id) {
  const u = CHARACTERS[id].unlock;
  if (u.kind === 'zeni') return `${Math.min(SAVE.zeni, u.cost)} / ${u.cost} Zeni`;
  if (u.kind === 'vegetaKills') return t('{n} / {goal} enemigos', { n: Math.min(SAVE.vegetaKills, u.goal), goal: u.goal });
  if (u.kind === 'quickLoss') return t('{n} / {goal} derrotas en el primer minuto', { n: Math.min(SAVE.quickLosses || 0, u.goal), goal: u.goal });
  const boss = BOSSES.find(b => b.id === u.boss);
  return t('Aún no derrotaste a {name}', { name: boss ? boss.name : u.boss });
}
function unlockChar(id) {
  if (isUnlocked(id)) return false;
  SAVE.unlocked[id] = true;
  writeSave();
  if (G) { (G.newUnlocks = G.newUnlocks || []).push(id); announce('¡Desbloqueaste a {name}!', '#3dff7a', { name: CHARACTERS[id].name }); }
  return true;
}
// Objetivos que se cumplen jugando (los de Zeni se compran desde el menú)
function checkUnlocks() {
  for (const id in CHARACTERS) {
    const u = CHARACTERS[id].unlock;
    if (u && u.kind === 'vegetaKills' && SAVE.vegetaKills >= u.goal) unlockChar(id);
    if (u && u.kind === 'quickLoss' && (SAVE.quickLosses || 0) >= u.goal) unlockChar(id);
  }
}
// Un jefe cayó (en online el anfitrión avisa a los demás, con los segundos que duró en pie):
// desbloquea a quien lo pida y revisa los logros de jefes
function bossDefeated(bossId, secs = 999) {
  for (const id in CHARACTERS) {
    const u = CHARACTERS[id].unlock;
    if (u && u.kind === 'boss' && u.boss === bossId) unlockChar(id);
  }
  if (!G || !G.me) return;
  SAVE.stats.bosses[bossId] = (SAVE.stats.bosses[bossId] || 0) + 1;   // para los logros de leyenda
  if (bossId === 'freezer' && secs < 60) unlockAch('freezer60');
  const M = G.me;
  if (!M.dead && M.hp < M.maxHp * 0.1) unlockAch('lowhp');
}

// ─── Logros ──────────────────────────────────────────────────────────────────
// Se cuentan desde el punto de vista de tu guerrero. Casi todo se detecta en achTick (también
// en online); lo que solo sabe el anfitrión (élites derrotados, semillas) llega con achEvent.
function unlockAch(id) {
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a || SAVE.ach[id]) return;
  SAVE.ach[id] = true;
  SAVE.zeni += a.zeni;
  writeSave();
  if (G) (G.achNew = G.achNew || []).push(id);
  achToast(a);
}
// Avisos de logro: se apilan al costado izquierdo (no tapan la pantalla de victoria o derrota),
// se van solos a los 6 segundos y con un clic se cierran antes
let achSfxAt = 0;
function achToast(a) {
  const box = $('achToasts');
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.title = t('Clic para cerrar');
  el.innerHTML = `<span class="trophy">🏆</span><div><b>${esc(t('¡Logro: {name}!', { name: a.name }))}</b><small>${esc(a.desc)} · +${a.zeni} Zeni</small></div>`;
  const close = () => {
    if (el.classList.contains('out')) return;
    el.classList.remove('in'); el.classList.add('out');
    setTimeout(() => el.remove(), 300);
  };
  el.onclick = close;
  box.appendChild(el);
  while (box.children.length > 5) box.firstElementChild.remove();
  void el.offsetWidth; el.classList.add('in');
  if (performance.now() - achSfxAt > 300) { achSfxAt = performance.now(); SFX.play('ball'); }   // varios juntos: un solo sonido
  setTimeout(close, 6000);
}
// Eventos que solo ve el anfitrión: al propio jugador se aplican directo, al resto se les avisa
function achEvent(P, key) {
  if (!P) return;
  if (P === G.me) localAchEvent(key);
  else emit(['a', P.id, key]);
}
function localAchEvent(key) {
  if (!G || !G.ach) return;
  if (key === 'elite') { SAVE.stats.elites++; if (++G.ach.elite >= 10) unlockAch('elite10'); }
  if (key === 'senzu') G.ach.senzu = true;
  if (key.startsWith('wish:')) {
    SAVE.stats.wishes[key.slice(5)] = true; writeSave();
    const a = ACHIEVEMENTS.find(x => x.id === 'allwishes');
    if (a.progress(SAVE) >= achGoal(a)) unlockAch('allwishes');
  }
}
// Seguimiento por cuadro de tu guerrero (anfitrión, en solitario y en online)
function achTick() {
  const A = G.ach, M = G.me;
  if (!A || !M || G.mode === 'over') return;
  if (M.stats.kills >= 1000) unlockAch('kills1000');
  if (G.lv.infinite && !G.weekly) {   // Nivel 5: cuánto aguantas y hasta qué vuelta de jefes llegas
    if (G.t >= 600) unlockAch('kaio10');
    if (G.t >= 1200) unlockAch('kaio20');
    if (G.t >= 1800) unlockAch('kaio30');
    if (kaioRound() >= 2) unlockAch('kaioSagas');
  }
  // Transformaciones y fusión
  if (M.transformed > 0 && A.prevTrans <= 0) { A.everTrans = true; SAVE.stats.transforms++; if (++A.transforms >= 5) unlockAch('transform5'); }
  A.prevTrans = M.transformed;
  const fused = isFused(M);
  if (fused) { A.everTrans = true; unlockAch('fusion'); }
  if (fused && !A.prevFused) SAVE.stats.fusions++;
  A.prevFused = fused;
  // Evoluciones (y la colección de todas las que viste)
  const evolved = M.attacks.filter(a => ATTACKS[a.id] && ATTACKS[a.id].evolved);
  for (const a of evolved) if (!SAVE.stats.evos[a.id]) { SAVE.stats.evos[a.id] = true; writeSave(); }
  A.evoSeen = A.evoSeen || new Set();
  for (const a of evolved) if (!A.evoSeen.has(a.id)) { A.evoSeen.add(a.id); SAVE.stats.evoCount++; }
  if (evolved.length >= 1) unlockAch('evo1');
  if (evolved.length >= 3) unlockAch('evo3');
  if (Object.keys(SAVE.stats.evos).length >= achGoal(ACHIEVEMENTS.find(a => a.id === 'allevo'))) unlockAch('allevo');
  if (M.attacks.length >= 5 && M.attacks.every(a => ATTACKS[a.id].evolved || a.lvl >= MAX_ATTACK_LEVEL)) unlockAch('arsenal');
  // Intocable: 3 minutos seguidos sin perder vida
  if (M.hp < A.prevHp || M.dead) A.lastHurt = G.t;
  A.prevHp = M.hp;
  if (G.t - A.lastHurt >= 180) unlockAch('untouch');
  // Shenlong: cada ronda de deseos nueva
  if (G.round && G.round.kind === 'wish' && G.round.id !== A.wishRound) {
    A.wishRound = G.round.id;
    SAVE.stats.summons++;
    unlockAch('shenlong');
    if (++A.shenlong >= 3) unlockAch('shenlong3');
  }
}
// Al terminar la partida: victorias, bajas totales y los logros que dependen del resultado
function achEndRun(P, won) {
  const A = G.ach || {};
  unlockAch('first');
  SAVE.stats.kills += P.stats.kills;
  SAVE.stats.time += Math.floor(G.t);
  // Perfil: guerrero, daño por técnica y, si caíste (sin abandonar), quién fue: el jefe más cercano, o la horda
  const S = SAVE.stats;
  S.charRuns[P.charId] = (S.charRuns[P.charId] || 0) + 1;
  S.charTime[P.charId] = (S.charTime[P.charId] || 0) + Math.floor(G.t);
  for (const [aid, v] of Object.entries(P.stats.dmg)) if (ATTACKS[aid]) S.techDmg[aid] = Math.round((S.techDmg[aid] || 0) + v);
  if (!won && !G.quit && !G.lv.bonus) {
    let boss = null, bd = 600 ** 2;
    for (const e of G.enemies) if (e.boss && !e.dead) { const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2; if (d < bd) { bd = d; boss = e; } }
    const k = boss ? boss.id : 'horde';
    S.killedBy[k] = (S.killedBy[k] || 0) + 1;
  }
  if (G.weekly) { SAVE.stats.weeklyWeeks[G.weekly.week] = true; if (won) SAVE.stats.weeklyWins++; }
  else if (won && !G.lv.bonus) SAVE.stats.lvWins[`${G.lv.id}|${P.charId}`] = true;
  if (won && G.net) SAVE.stats.onlineWins++;
  if (won && !G.lv.bonus) {   // llegar al final del nivel bonus no cuenta como ganar un nivel
    SAVE.stats.winsBy[P.charId] = true;
    unlockAch('win');
    if (!A.everTrans) unlockAch('notrans');
    if (!A.senzu) unlockAch('nosenzu');
    if (G.net && G.players.filter(Q => !Q.ally).length >= 3) unlockAch('online3');
    if (G.speed > 1) unlockAch('fast');
  }
  for (const a of ACHIEVEMENTS) if (a.goal && a.progress(SAVE) >= achGoal(a)) unlockAch(a.id);
  writeSave();
}
function buyUnlock(id) {
  const u = CHARACTERS[id].unlock;
  if (!u || u.kind !== 'zeni' || isUnlocked(id) || SAVE.zeni < u.cost) return;
  SAVE.zeni -= u.cost;
  unlockChar(id);
  SFX.play('levelup');
  SAVE.char = id; writeSave();
  buildMenu();
}

// ─── Utilidades ──────────────────────────────────────────────────────────────
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function fmtTime(s) { s = Math.floor(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
// Con centésimas (ranking y pantalla final): 10:40.25
const fmtTimeCs = cs => `${fmtTime(cs / 100)}.${String(Math.floor(cs) % 100).padStart(2, '0')}`;
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

// ─── Entrada ─────────────────────────────────────────────────────────────────
const keys = {};
// Teclas que activan el poder del Ki (transformación)
const P1_KI_KEYS = new Set(['Space', 'ShiftLeft', 'KeyE', 'KeyK']);
const P2_KI_KEYS = new Set(['ControlRight']);
const KI_KEYS = new Set([...P1_KI_KEYS, ...P2_KI_KEYS]);
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (e.code === 'Escape' && !$('report').classList.contains('hidden')) { $('report').classList.add('hidden'); return; }   // ventana de reporte
  keys[e.code] = true;
  SFX.unlock();
  if (e.code === 'KeyN' && !e.repeat) toggleMusic();
  if (e.code === 'KeyB' && !e.repeat) toggleSfx();
  if (e.code === 'KeyM' && !e.repeat && G) toggleMap();
  if (!G) { if (e.code === 'Escape') closeMenuSection(); return; }
  if (TEST_MODE && e.code === 'Escape' && testPowersOpen()) { toggleTestPowers(false); return; }   // panel de Poderes
  if (TEST_MODE && testKey(e)) return;
  if (KI_KEYS.has(e.code)) {
    if (!e.repeat) {
      const target = G.localCoop && P2_KI_KEYS.has(e.code) ? G.players[1] : G.me;
      requestTransform(target);
    }
    e.preventDefault();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  // Elegir carta o deseo con los números: los de arriba del teclado o los del teclado numérico (1 a 4: Shenlong ofrece 4)
  const num = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
  if (G.round && num && !e.repeat) {
    const btn = $('choices').children[+num[1] - 1];
    if (btn) { btn.click(); e.preventDefault(); }
  }
  if (G.round && e.code === 'KeyR' && !e.repeat) rerollChoices();   // volver a sortear las cartas
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (G && !G.net && G.mode === 'play') togglePause(); });

const joy = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
canvas.addEventListener('contextmenu', e => { if (G) e.preventDefault(); });
canvas.addEventListener('pointerdown', e => {
  SFX.unlock();
  if (e.pointerType === 'mouse') return; // el clic no hace nada: el Ki va con el teclado, el mando o el botón táctil
  Object.assign(joy, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY });
});
addEventListener('pointermove', e => {
  if (joy.active && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; }
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.t = performance.now(); }
});
// Posición del mouse (para apuntar el Big Bang Kamehameha)
const mouse = { x: 0, y: 0, t: 0 };
const toWorld = (sx, sy) => {
  if (splitLayout) {
    const v = splitLayout.views.find(q => sx >= q.x && sx <= q.x + q.w && sy >= q.y && sy <= q.y + q.h) || splitLayout.views[0];
    return [(sx - v.x) / v.w * v.worldW - v.worldW / 2 + v.player.x,
      (sy - v.y) / v.h * v.worldH - v.worldH / 2 + v.player.y];
  }
  return [sx / SCALE - BW / 2 + camX, sy / SCALE - BH / 2 + camY];
};
const endJoy = e => { if (e.pointerId === joy.id) { joy.active = false; joy.id = null; } };
addEventListener('pointerup', endJoy);
addEventListener('pointercancel', endJoy);

// Mando: stick izquierdo o cruceta para moverse; stick derecho para apuntar (apuntado manual);
// A/B/X/Y o gatillos para el Ki; Start para pausar
const pad = { x: 0, y: 0, prev: [], aim: 0, aimT: 0 };
function pollGamepad() {
  pad.x = 0; pad.y = 0;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
  if (!gp) return;
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
  if (Math.hypot(x, y) < 0.2) { x = 0; y = 0; }
  if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
  const d = Math.hypot(x, y);
  if (d > 1) { x /= d; y /= d; }
  pad.x = x; pad.y = y;
  // Stick derecho: hacia dónde apuntan las técnicas (si se suelta, se mantiene un momento la última dirección)
  const ax = gp.axes[2] || 0, ay = gp.axes[3] || 0;
  if (Math.hypot(ax, ay) > 0.35) { pad.aim = Math.atan2(ay, ax); pad.aimT = performance.now(); }
  const pressed = i => b(i) && !pad.prev[i];
  if (G && [0, 1, 2, 3, 6, 7].some(pressed)) { SFX.unlock(); requestTransform(); }
  if (G && pressed(9)) togglePause();
  pad.prev = gp.buttons.map(btn => btn.pressed);
}

function inputVec(P = G && G.me) {
  const second = !!(G && G.localCoop && P && P.id === 1);
  if (!second && (pad.x || pad.y)) return { x: pad.x, y: pad.y };
  if (!second && joy.active) {
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.hypot(dx, dy);
    if (d > 8) { const m = Math.min(1, d / 50); return { x: dx / d * m, y: dy / d * m }; }
  }
  let x = 0, y = 0;
  if (G && G.localCoop) {
    if (second) {
      if (keys.ArrowUp) y--;
      if (keys.ArrowDown) y++;
      if (keys.ArrowLeft) x--;
      if (keys.ArrowRight) x++;
    } else {
      if (keys.KeyW) y--;
      if (keys.KeyS) y++;
      if (keys.KeyA) x--;
      if (keys.KeyD) x++;
    }
  } else {
    if (keys.KeyW || keys.ArrowUp) y--;
    if (keys.KeyS || keys.ArrowDown) y++;
    if (keys.KeyA || keys.ArrowLeft) x--;
    if (keys.KeyD || keys.ArrowRight) x++;
  }
  const d = Math.hypot(x, y);
  return d ? { x: x / d, y: y / d } : { x: 0, y: 0 };
}

// ─── Estado de la partida ────────────────────────────────────────────────────
let G = null;
const isAuthority = () => !G.net || G.net.role === 'host';
const START_OFFSETS = [[0, 0], [40, 0], [-40, 0], [0, 40]];

// Mejoras de la tienda: niveles validados (pueden llegar por la red)
function cleanPerks(src) {
  const out = {};
  for (const u of SHOP_UPGRADES) out[u.id] = Math.max(0, Math.min(u.max, Math.floor(+(src && src[u.id]) || 0)));
  return out;
}
const myPerks = () => cleanPerks(SAVE.upgrades);
// Valor total de una mejora para un jugador (niveles × efecto por nivel)
function perk(P, id) {
  const u = SHOP_UPGRADES.find(x => x.id === id);
  return ((P.perks && P.perks[id]) || 0) * u.per;
}

function makePlayer(id, name, charId, perks) {
  const c = CHARACTERS[charId] || CHARACTERS.goku;
  const P = {
    id, name, charId, c, x: 0, y: 0, r: 11, hp: c.hp, maxHp: c.hp, facing: 1, dirX: 1, dirY: 0,
    inv: 0, moving: false, castT: 0, ki: 0, dir: 'side', transformed: 0, dead: false, gone: false, revive: 0, orbitAng: 0,
    attacks: [{ id: c.start, lvl: 1, cd: 0.5 }],
    passives: Object.fromEntries(Object.keys(PASSIVES).map(k => [k, 0])),
    bonusZeni: 0, perks: cleanPerks(perks),
    stats: { dmg: {}, kills: 0, taken: 0 },   // daño por técnica, enemigos derrotados, daño recibido
    // Run-scoped Brotato-style shop stats (reset every game, stack count per stat - see WAVE_SHOP_ITEMS
    // in js/data.js and SHOP_STAT_KEYS below, which must list these same keys in this same order).
    shop: { dmg: 0, spd: 0, hp: 0, money: 0, luck: 0, cdr: 0, magnet: 0 },
  };
  P.maxHp += perk(P, 'hp');
  P.hp = P.maxHp;
  P.senzuLeft = perk(P, 'senzu');    // Semilla de reserva: revive una vez por partida
  P.rerolls = perk(P, 'reroll');     // Visión de Kaio-sama: sorteos de cartas por partida
  return P;
}

// roster: [{ id, name, charId, perks }]; net: null (solo/local) o { role: 'host' | 'client' }
function newGame(roster, net = null, myId = 0, speed = 1, level = 'saiyan', localCoop = false) {
  // Desafío semanal: sus reglas cambian el guerrero, la velocidad, la vida, los jefes... (ver rule())
  const weekly = level === 'weekly' && WEEKLY ? { ...WEEKLY, rules: [...WEEKLY.rules] } : null;
  if (weekly && weekly.char) roster = roster.map(r => ({ ...r, charId: weekly.char }));
  if (weekly) roster = roster.map(r => ({ ...r, perks: maxPerks() }));   // todos parejos: la tienda al máximo
  if (weekly && weekly.rules.includes('fast')) speed = FAST_SPEED;
  G = {
    t: 0, mode: 'play', net, localCoop, menuOpen: false, speed: speed > 1 ? FAST_SPEED : 1,
    players: roster.map((r, i) => {
      const p = makePlayer(r.id, r.name, r.charId, r.perks);
      [p.x, p.y] = START_OFFSETS[i % START_OFFSETS.length];
      return p;
    }),
    enemies: [], projs: [], beams: [], ebeams: [], zones: [], blind: 0, decoys: [], helpers: [], novas: [], shots: [], hazards: [], lanes: [], pickups: [], fx: [], texts: [],
    level: 1, xp: 0, xpNext: 6, pendingLevels: 0, pendingWishes: 0, round: null, roundSeq: 0,
    kills: 0, dragonBalls: 0, ballsNeeded: 7, spawnAcc: 0, nextElite: 45, nextSwarm: 75, bossIdx: 0, nid: 1,
    banner: null, shake: 0, victoryAt: 0, out: [], emitted: {}, lv: levelDef(level), weekly,
    // Brotato-style run economy: money drops from kills, spent in a shop that opens once a wave's
    // kill target is reached (separate from the existing XP/technique-pick system, which is untouched).
    wave: 1, waveKills: 0, waveTarget: waveTarget(1, roster.length), waveShop: null, money: 0,
    // Shared co-op ultimate meter: fills from damage dealt by either living, non-ally player; only
    // relevant with 2+ such players (see TEAM_ULT_MAX / teamUltActive() / triggerTeamUltimate()).
    teamUlt: 0,
  };
  G.bosses = bossSchedule(G.lv, weekly);
  G.practice = !!weekly && !useWeeklyTry();   // sin intentos hoy: partida de práctica (no entra al ranking)
  G.ballsNeeded = baseBalls();
  if (rule('glass')) for (const P of G.players) { P.maxHp = Math.max(1, Math.round(P.maxHp / 2)); P.hp = P.maxHp; }
  G.me = G.players.find(p => p.id === myId) || G.players[0];
  setTheme(G.lv.theme, true);   // mapa del nivel
  for (const k in mapCaches) delete mapCaches[k];
  // Seguimiento de logros de esta partida (desde el punto de vista de tu guerrero)
  G.ach = { elite: 0, transforms: 0, shenlong: 0, wishRound: 0, senzu: false, everTrans: false, prevTrans: 0, prevHp: G.me.hp, lastHurt: 0 };
  shownRound = '';
  document.body.classList.add('playing');
  document.body.classList.remove('snake-run');   // (la pone snakeInit: sin mapa en el Camino de la Serpiente)
  for (const id of ['menu', 'setup', 'gameover', 'levelup', 'waveShop', 'pause', 'lobby', 'shop', 'credits', 'help', 'techs', 'achs', 'profile', 'rank', 'news']) $(id).classList.add('hidden');
  shownWaveShop = '';
  if (typeof Replays !== 'undefined') Replays.start();   // graba los últimos segundos (js/replays.js)
  $('btnQuit').textContent = t(net ? 'Salir de la sala' : 'Abandonar');
  $('btnResume').textContent = t(net ? 'Volver al juego' : 'Continuar');
  announce(G.players.length > 1 ? '¡Los guerreros Z entran en combate!' : '¡{name} entra en combate!', undefined, { name: G.me.c.name });
  if (G.practice) announce('Práctica: ya usaste los intentos de hoy, esta partida no entra al ranking', '#8fd8ff');
  if (G.lv.bonus) snakeInit();   // nivel bonus: el Camino de la Serpiente (js/bonus.js)
}
function startSolo() {
  // Si el desafío terminó mientras estabas en el menú, se vuelve a cargar antes de jugar
  if (myLevel() === 'weekly' && WEEKLY && Date.now() >= WEEKLY.endsAt) { loadWeekly().then(() => { buildMenu(); }); return; }
  newGame([{ id: 0, name: myName(), charId: myChar(), perks: myPerks() }], null, 0, SAVE.speed2 ? FAST_SPEED : 1, myLevel());
}
function startLocalCoop() {
  if (myLevel() === 'weekly' && WEEKLY && Date.now() >= WEEKLY.endsAt) { loadWeekly().then(() => { buildMenu(); }); return; }
  const available = Object.keys(CHARACTERS).filter(id => isUnlocked(id) || weeklyOpen());
  const fallback = available.find(id => id !== myChar()) || myChar();
  const char2 = available.includes(SAVE.coopChar2) ? SAVE.coopChar2 : fallback;
  newGame([
    { id: 0, name: myName() || 'Jugador 1', charId: myChar(), perks: myPerks() },
    { id: 1, name: 'Jugador 2', charId: char2, perks: myPerks() },
  ], null, 0, SAVE.speed2 ? FAST_SPEED : 1, myLevel(), true);
}

// "hidden": el compañero absorbido por la fusión (no se dibuja ni recibe daño)
const alivePlayers = () => G.players.filter(p => !p.dead && !p.gone && !p.hidden);
function nearestPlayer(x, y) {
  let best = null, bd = Infinity;
  for (const p of G.players) {
    if (p.dead || p.gone || p.hidden) continue;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
// Dificultad extra por jugador en las partidas cooperativas
const coop = () => 1 + 0.6 * (G.players.filter(p => !p.gone && !p.ally).length - 1);
// Dirección del sprite según un vector: de frente, de espaldas o de perfil
const DIR_CODES = ['side', 'down', 'up'];
function dirFromVec(x, y) {
  if (Math.abs(y) > Math.abs(x) * 1.3) return y > 0 ? 'down' : 'up';
  return 'side';
}
// ¿Este jugador es el cuerpo de Gogeta ahora mismo? ¿Forma parte de Gogeta (cuerpo o compañero absorbido)?
const isFusedBody = P => !!(G.fusion && G.fusion.phase === 'fused' && G.fusion.driverId === P.id);
const isFused = P => !!(G.fusion && G.fusion.phase === 'fused' && G.fusion.ids.includes(P.id));
// Gogeta muy por encima del Super Saiyajin (×1.5 de daño y -20% de recarga): daño ×2.5, recarga -35%,
// velocidad ×1.35 y la mitad del daño recibido. Usa las técnicas y la vida de los dos.
const FUSION_POWER = { dmg: 2.5, cd: 0.65, speed: 1.35, def: 0.5 };

// ─── Estadísticas derivadas (por jugador) ────────────────────────────────────
function dmgMult(P) {
  if (!P) return 1;
  let m = (rule('glass') ? 2 : 1) * (1 + 0.12 * P.passives.power) * (1 + (P.c.dmgBonus || 0)) * (1 + perk(P, 'atk')) * (1 + (P.wishDmg || 0)) * (1 + 0.04 * P.shop.dmg);
  if (P.halo) m *= 1 + ZENKAI;
  if (P.swapBody > 0) m *= SWAP_DMG;   // en el cuerpo de Ginyu
  if (P.kaioken > 0) m *= 1 + (P.kaiokenBoost || 0);   // Kaioken   // Zenkai: volvió de la Semilla de reserva más fuerte (la aureola ya viaja por la red)
  if (P.transformed > 0 && !P.c.buddy) { const af = activeForm(P); m *= (1.5 + (P.c.transformBonus || 0) + ((af && af.statMult && af.statMult.dmg) || 0)) * (1 + (P.transBoost || 0)); }   // + Ki concentrado (Mr. Satán no: pelea Buu)
  if (isFused(P)) m *= FUSION_POWER.dmg; // poder de Gogeta
  if (P.passives.fury) m *= 1 + furyBonus(P);   // Furia: más daño con poca vida
  return m;
}
const furyBonus = P => 0.05 * (P.passives.fury || 0) * Math.max(0, 1 - P.hp / P.maxHp);
function cdMult(P) {
  let m = Math.max(0.4, 1 - 0.08 * P.passives.focus - (P.c.cdBonus || 0) - perk(P, 'cd') - 0.03 * P.shop.cdr);
  if (P.transformed > 0) m *= 0.8;
  if (isFused(P)) m *= FUSION_POWER.cd;
  return m;
}
function playerSpeed(P) {
  const boost = isFusedBody(P) ? FUSION_POWER.speed : P.transformed > 0 ? 1.2 : 1;
  const flee = P.c.flee && P.hp < P.maxHp * 0.3 ? 1.4 : 1;   // Mr. Satán: "retirada estratégica"
  const godspeed = P.dodgeBurstT > 0 ? 1.6 : 1;   // Killua: ráfaga de velocidad tras esquivar
  const snake = G && G.snake ? (G.snake.mode === 'race' ? SNAKE_RACE_SPEED : 1) * (P.boost > 0 ? KINTON_BOOST : 1) : 1;   // Carrera y nube Kinton
  return P.c.speed * (1 + 0.08 * P.passives.speed + perk(P, 'spd') + 0.03 * P.shop.spd) * boost * snake * flee * godspeed * (P.kaioken > 0 ? 1 + (P.kaiokenBoost || 0) * 0.5 : 1);
}
function magnetRange(P) { return (55 + 28 * P.passives.sense) * (1 + perk(P, 'magnet') + 0.1 * P.shop.magnet); }
const moneyBonus = P => 1 + 0.08 * (P.shop.money || 0);

// ─── Efectos (el anfitrión también los reenvía a los clientes) ───────────────
function emit(ev) { if (G.net && G.net.role === 'host') G.out.push(ev); }
function sfx(name, gap = 0.04) {
  SFX.play(name, gap);
  const now = G.t, last = G.emitted[name];
  if (last !== undefined && now - last < Math.max(gap, 0.08)) return;
  G.emitted[name] = now;
  emit(['s', name, gap]);
}
// text: plantilla en español (se traduce al dibujarla, ver t()); params: sus datos
function announce(text, color = '#ffd93b', params = null) { G.banner = { text, color, t: 2.6, params }; }
function addText(x, y, text, color = '#fff', big = false, params = null) {
  localText(x, y, text, color, big, params);
  emit(['t', Math.round(x), Math.round(y), text, color, big === 2 ? 2 : big ? 1 : 0, params]);
}
function localText(x, y, text, color, big, params = null) {
  if (G.texts.length > 90) G.texts.shift();
  G.texts.push({ x: x + rand(-4, 4), y, text, color, big, params, t: 0.7 });
}
// ─── Efectos de técnicas: assets/sprites/sfx.png (tools/build-sfx.ps1, de Legacy of Goku II) ───
// Cada fila es una animación de cuadros de 32x32; la fila SFX_BEAM_ROW guarda los tramos de los rayos
const SFX_IMG = new Image();
SFX_IMG.src = 'assets/sprites/sfx.png';
const SFX_ANIMS = {
  impact:    { row: 0, count: 6, dur: 0.3 },              // destello al golpear
  explosion: { row: 1, count: 3, dur: 0.5 },              // explosión de fuego
  shock:     { row: 2, count: 3, dur: 0.4, flat: true },  // onda expansiva amarilla
  wring:     { row: 3, count: 3, dur: 0.45, flat: true }, // anillo blanco
  sphere:    { row: 4, count: 4 },                        // esfera de energía (Genkidama, Big Bang)
};
const SFX_BEAM_ROW = 5;
const sfxReady = () => SFX_IMG.complete && SFX_IMG.naturalWidth > 0;
function localAnim(name, x, y, s = 1) {
  const A = SFX_ANIMS[name];
  if (!A || G.fx.length > 450) return;
  G.fx.push({ type: 'anim', name, x, y, s, t: A.dur, dur: A.dur });
}
// En online el anfitrión avisa a los demás para que vean el mismo efecto
function playAnim(name, x, y, s = 1) {
  localAnim(name, x, y, s);
  emit(['x', name, Math.round(x), Math.round(y), Math.round(s * 100) / 100]);
}
function drawAnimFx(c, f) {
  const A = SFX_ANIMS[f.name];
  const fr = Math.min(A.count - 1, Math.floor((1 - f.t / f.dur) * A.count));
  const w = 32 * f.s, h = w * (A.flat ? 0.8 : 1);   // los anillos se aplastan como el resto del suelo
  c.globalAlpha = A.flat ? Math.min(1, f.t / f.dur * 2) : 1;
  c.drawImage(SFX_IMG, fr * 32, A.row * 32, 32, 32, Math.round(f.x - w / 2), Math.round(f.y - h / 2), Math.round(w), Math.round(h));
  c.globalAlpha = 1;
}
// Tramo violeta (Galick Ho): la hoja no lo trae, se arma con el azul cambiando rojo por verde
let PURPLE_BEAM = null;
function purpleBeam() {
  if (PURPLE_BEAM) return PURPLE_BEAM;
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 8;
  const c = cv.getContext('2d');
  c.drawImage(SFX_IMG, 0, SFX_BEAM_ROW * 32 + 12, 32, 8, 0, 0, 32, 8);
  const img = c.getImageData(0, 0, 32, 8), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const r = d[i]; d[i] = d[i + 1]; d[i + 1] = r; }
  c.putImageData(img, 0, 0);
  return PURPLE_BEAM = cv;
}
// Familia de color de una técnica: 0 azul, 1 dorado, 2 fuego, 3 violeta
function beamKind(color) {
  const n = parseInt(String(color).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return b > r + 20 ? (r > g + 40 ? 3 : 0) : r > 200 && g < 150 ? 2 : 1;
}
// Tramo de rayo según el color de la técnica → [imagen, x, y]
function beamTile(color) {
  const k = beamKind(color);
  return k === 3 ? [purpleBeam(), 0, 0] : [SFX_IMG, k * 32, SFX_BEAM_ROW * 32 + 12];
}
function burst(x, y, color, n = 8, speed = 3, size = 3) {
  localBurst(x, y, color, n, speed, size);
  emit(['b', Math.round(x), Math.round(y), color, n, speed, size]);
}
function localBurst(x, y, color, n, speed, size) {
  // Particle density is a purely local display preference - it must never change what gets sent
  // to other players (burst() still emits the original n), only how many of them THIS screen draws.
  n = Math.round(n * SAVE.fx.particles);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(0.4, 1) * speed;
    G.fx.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(0.3, 0.6), color, size });
  }
  if (G.fx.length > 500) G.fx.splice(0, G.fx.length - 500);
}
function ring(x, y, r, dur, color) {
  G.fx.push({ type: 'ring', x, y, r, t: dur, dur, color });
  emit(['r', Math.round(x), Math.round(y), Math.round(r), dur, color]);
}

// ─── Transformación ──────────────────────────────────────────────────────────
// El botón de Ki transforma, pide la fusión o (fusionado) lanza el Big Bang Kamehameha.
function requestTransform(P = G && G.me) {
  if (!G || !P || G.mode !== 'play') return;
  const ang = aimAngle(P);
  if (isAuthority()) handleKi(P, ang);
  else Net.send({ t: 'tr', a: Math.round(ang * 1000) / 1000 });
}
// Apuntado manual de las técnicas (opción del menú): con el stick derecho del mando; en PC hacia el mouse;
// en el celular (o si no se usa ninguno hace rato), hacia donde te moviste por última vez. null = automático
const padAiming = () => performance.now() - pad.aimT < 1500 && pad.aimT > mouse.t;
function manualAim() {
  if (!SAVE.aim || !G || !G.me) return null;
  const V = viewer();
  if (padAiming()) return pad.aim;
  if (!isTouch() && performance.now() - mouse.t < 30000) {
    const [wx, wy] = toWorld(mouse.x, mouse.y);
    return Math.atan2(wy - (V.y - 4), wx - V.x);
  }
  return Math.atan2(G.me.dirY, G.me.dirX);
}
// Dirección de apuntado: el mouse si se movió hace poco; si no, el enemigo más cercano
function aimAngle(P = G.me) {
  const V = P === G.me ? viewer() : P;
  if (P === G.me && padAiming()) return pad.aim;   // stick derecho del mando
  if (P === G.me && performance.now() - mouse.t < 4000) {
    const [wx, wy] = toWorld(mouse.x, mouse.y);
    return Math.atan2(wy - (V.y - 4), wx - V.x);
  }
  const e = nearestEnemy(V, 600);
  return e ? Math.atan2(e.y - V.y, e.x - V.x) : (V.facing < 0 ? Math.PI : 0);
}
function handleKi(P, ang) {
  if (!P || P.dead || P.gone || G.mode !== 'play' || rule('notrans')) return;
  const F = G.fusion;
  if (F && F.ids.includes(P.id)) { // fusionado: lanza el Big Bang quien controla las técnicas
    if (F.phase === 'fused' && (P.id === F.gunnerId || !G.net)) bigBang(F, ang);
    return;
  }
  const partner = fusionPartner(P);
  if (partner && !F) {
    if (partner.fuseReq && G.t - partner.fuseReq < FUSION_WINDOW) { startFusion(P, partner); return; }
    if (!P.fuseReq || G.t - P.fuseReq >= FUSION_WINDOW) {
      P.fuseReq = G.t;
      announce('¡{name} quiere hacer la fusión! {partner}: pulsa Ki', '#ffe14d', { name: P.name, partner: partner.name });
      sfx('ball');
    }
    return;
  }
  doTransform(P);
}

// ─── Fusión (Goku + Vegeta = Gogeta) ─────────────────────────────────────────
const FUSION_WINDOW = 3;      // segundos para que el compañero responda
const FUSION_TIME = 30, FUSION_TIME_WISH = 40, DANCE_TIME = 1.4, BIGBANG_CD = 4;
const FUSION_PAIR = { goku: 'vegeta', vegeta: 'goku' };
const BIGBANG_LOOK = { color: '#8fe3ff', core: '#ffffff' };
const GOGETA = {
  name: 'Gogeta', aura: '#ffe14d',
  look: { id: 'gogeta', style: 'goku', hair: '#16161c', ssjHair: '#ffd93b', skin: '#f7c9a0', top: '#1c1c2e', shirt: '#f2f2f2',
    pants: '#f2f2f2', belt: '#2546c9', boots: '#e8e8e8', wrist: '#ff7b1c' },
};
const canFuse = P => !!P && !P.dead && !P.gone && !P.hidden && FUSION_PAIR[P.charId] && P.ki >= 100 && P.transformed <= 0;
function fusionPartner(P) {
  if (!canFuse(P)) return null;
  return G.players.find(Q => Q !== P && canFuse(Q) && Q.charId === FUSION_PAIR[P.charId] && Math.hypot(Q.x - P.x, Q.y - P.y) < 80) || null;
}
// driverId: quién mueve a Gogeta (al azar en online; en el deseo, siempre el jugador)
function startFusion(a, b, dur = FUSION_TIME, driverId = null) {
  const driver = driverId !== null ? G.players.find(p => p.id === driverId) : (Math.random() < 0.5 ? a : b);
  const gunner = driver === a ? b : a;
  G.fusion = {
    ids: [a.id, b.id], driverId: driver.id, gunnerId: gunner.id, phase: 'dance', t: DANCE_TIME, dur, bbCd: 0,
    mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2,
    saved: { [a.id]: a.maxHp, [b.id]: b.maxHp },
  };
  for (const P of [a, b]) { P.fuseReq = 0; P.ki = 0; P.kiHold = 0; P.transformed = 0; P.inv = 99; }
  announce('¡Fu... sión... HA!', '#ffe14d');
  sfx('power');
}
function updateFusion(dt) {
  const F = G.fusion;
  if (!F) return;
  const [a, b] = F.ids.map(id => G.players.find(p => p.id === id));
  const driver = G.players.find(p => p.id === F.driverId), gunner = G.players.find(p => p.id === F.gunnerId);
  if (!a || !b || a.gone || b.gone) { endFusion(); return; }
  F.t -= dt;
  if (F.phase === 'dance') {
    // Se acercan al punto medio haciendo la danza
    for (const P of [a, b]) {
      P.x += (F.mx + (P === a ? -10 : 10) * Math.max(0, F.t / DANCE_TIME) - P.x) * Math.min(1, dt * 6);
      P.y += (F.my - P.y) * Math.min(1, dt * 6);
      P.facing = P.x < F.mx ? 1 : -1; P.dir = 'side';
      P.inv = 99;
    }
    if (Math.random() < 0.6) G.fx.push({ type: 'spark', x: F.mx + rand(-14, 14), y: F.my + rand(-20, 10), vx: 0, vy: -rand(1, 3), t: 0.5, color: '#ffffff', size: 3 });
    if (F.t <= 0) { // ¡Gogeta!
      F.phase = 'fused'; F.t = F.dur;
      driver.x = F.mx; driver.y = F.my; driver.tx = undefined;
      driver.maxHp = a.maxHp + b.maxHp; driver.hp = a.hp + b.hp;
      gunner.hidden = true;
      driver.inv = 1.5; gunner.inv = 0;
      G.shake = Math.max(G.shake, 0.9);
      burst(F.mx, F.my, '#ffffff', 50, 7, 4);
      ring(F.mx, F.my, 120, 0.6, '#ffe14d');
      G.novas.push({ x: F.mx, y: F.my, r: 0, maxR: 200, dmg: 60, hit: new Set(), color: '#ffe14d', kb: 22, owner: driver, aid: 'ki' });
      announce('¡GOGETA!', '#ffe14d');
      sfx('boom');
    }
    return;
  }
  // Fusionados: el compañero viaja dentro de Gogeta
  F.bbCd -= dt;
  gunner.x = driver.x; gunner.y = driver.y; gunner.facing = driver.facing; gunner.moving = driver.moving; gunner.dir = driver.dir;
  if (Math.random() < 0.5) G.fx.push({ type: 'spark', x: driver.x + rand(-10, 10), y: driver.y + rand(-5, 12), vx: 0, vy: -rand(1, 2.5), t: 0.4, color: '#ffe14d', size: 2 });
  if (driver.dead || F.t <= 0) endFusion();
}
function endFusion() {
  const F = G.fusion;
  if (!F) return;
  G.fusion = null;
  const driver = G.players.find(p => p.id === F.driverId), gunner = G.players.find(p => p.id === F.gunnerId);
  if (!driver || !gunner) return;
  const ratio = driver.dead ? 0 : Math.max(0, Math.min(1, driver.hp / driver.maxHp));
  for (const P of [driver, gunner]) {
    P.maxHp = F.saved[P.id];
    P.hp = Math.max(ratio ? 1 : 0, Math.round(P.maxHp * ratio));
    P.hidden = false;
    P.inv = 1.5;
    if (!ratio) { P.dead = true; P.hp = 0; }
  }
  if (F.phase === 'fused') { gunner.x = driver.x + 22; gunner.y = driver.y; }
  if (gunner.ally) gunner.gone = true;   // el aliado del deseo se retira
  burst(driver.x, driver.y, '#ffffff', 20, 4, 3);
  if (ratio) announce('La fusión ha terminado', '#cccccc');
}
// Big Bang Kamehameha: lo lanza quien controla las técnicas, desde Gogeta
function bigBang(F, ang) {
  if (F.bbCd > 0) return;
  const driver = G.players.find(p => p.id === F.driverId);
  if (!driver || !isFinite(ang)) return;
  F.bbCd = BIGBANG_CD;
  const shooter = G.players.find(p => p.id === F.gunnerId);
  G.beams.push({ ang, len: 520, width: 60, dmg: 45 + G.level * 4, t: 1.2, dur: 1.2, tick: 0, ...BIGBANG_LOOK, aid: 'bigbang',
    owner: driver, credit: G.net ? shooter : driver });
  driver.castT = 1.2;
  if (Math.abs(Math.cos(ang)) > 0.2) driver.facing = Math.sign(Math.cos(ang));
  if (!driver.moving) driver.dir = dirFromVec(Math.cos(ang), Math.sin(ang));
  G.shake = Math.max(G.shake, 0.4);
  sfx('beam', 0.1);
  announce('¡Big Bang Kamehameha!', '#8fe3ff');
}
// Cámara: si estás dentro de Gogeta, sigues a Gogeta
function viewer() {
  const M = G.me;
  if (M && M.hidden && G.fusion) return G.players.find(p => p.id === G.fusion.driverId) || M;
  if (G.localCoop) {
    // A downed teammate must not anchor the shared camera: once they're dead, the living
    // player(s) get full, unconstrained camera movement again (only revive-eligible, moving
    // players count toward the average).
    const alive = G.players.filter(p => !p.gone && !p.hidden && !p.dead);
    const local = alive.length ? alive : G.players.filter(p => !p.gone && !p.hidden);
    if (local.length > 1) return { ...M, x: local.reduce((n, p) => n + p.x, 0) / local.length, y: local.reduce((n, p) => n + p.y, 0) / local.length };
    if (local.length === 1) return local[0];
  }
  return M;
}
// Ki concentrado (2.13.0): con el Ki lleno y sin transformarte, se va concentrando. A los 20 segundos la
// próxima transformación dura un 50% más y pega un 25% más (a mitad de camino, la mitad de eso).
const KI_FOCUS_TIME = 20, KI_FOCUS_DUR = 0.5, KI_FOCUS_DMG = 0.25;
const kiFocus = P => Math.min(1, (P.kiHold || 0) / KI_FOCUS_TIME);
function doTransform(P, secs = 20, force = false) {
  if (!P || P.dead || P.gone) return;
  if (!force && (P.ki < 100 || P.transformed > 0)) return;
  const focus = force ? 0 : kiFocus(P);
  P.ki = 0; P.kiHold = 0;
  if (P.c.buddy) {   // Mr. Satán no se transforma: llama a su amigo Majin Buu, que pelea por él
    P.transformed = BUDDY_TIME * (1 + KI_FOCUS_DUR * focus);
    G.helpers.push({ x: P.x + 34, y: P.y, t: P.transformed, owner: P, cd: 0.5, facing: -1, punch: 0 });
    announce(G.players.length > 1 ? '¡{name}: ¡Amigo Buu!' : '¡Amigo Buu! ¡Ayúdame!', '#ff9bd6', { name: P.name });
    burst(P.x + 34, P.y, '#ff9bd6', 30, 5, 3); sfx('power');
    return;
  }
  // Tiered characters climb one form per activation (capped at their strongest); the tier is kept across
  // de-transforms so a long survival run naturally escalates Sage Mode -> Nine-Tails -> Baryon, etc.
  const forms = charForms(P.c);
  P.tier = forms.length ? Math.min((P.tier || 0) + 1, forms.length) : 0;
  const form = forms[P.tier - 1] || null;
  const auraColor = form ? form.aura : P.c.aura;
  const formName = form ? form.name : P.c.transform;
  P.transformed = secs * (1 + ((form && form.transformTime) ?? P.c.transformTime ?? 0)) * (1 + KI_FOCUS_DUR * focus);   // Trunks: dura un 50% más
  P.transBoost = KI_FOCUS_DMG * focus;
  P.transformLock = 0.25;   // brief "powering up" lock: can't move/attack right as the form lands, for weight
  G.shake = Math.max(G.shake, focus >= 1 ? 0.8 : 0.5);
  sfx('power');
  if (focus >= 1) announce(G.players.length > 1 ? '¡{name}: {form} concentrado!' : '¡{form} concentrado!', auraColor, { name: P.name, form: formName });
  else announce(G.players.length > 1 ? '¡{name}: {form}!' : '¡{form}!', auraColor, { name: P.name, form: formName });
  burst(P.x, P.y, auraColor, 40, 6, 4);
  // 2.13.0: la onda pega menos (era 40 de daño y 160 de radio); despeja alrededor, no limpia la pantalla
  // y no les hace nada a los jefes: la transformación es para la horda
  G.novas.push({ x: P.x, y: P.y, r: 0, maxR: 130, dmg: 22, hit: new Set(), color: auraColor, kb: 18, owner: P, aid: 'ki', noBoss: true });
}
// Hold a transformation long enough without it running out and it climbs to the next tier on its own -
// no need to detransform and re-charge Ki. Extends the remaining time a bit as a reward for surviving that long.
const TIER_HOLD_TIME = 12;
const BASS_DROP_EVERY = 8;   // Taira: cada 8s suelta un "bajón" que aturde a su alrededor
function autoEscalateForm(P) {
  if (!P || P.dead || P.gone || P.c.buddy || P.transformed <= 0) return;
  const forms = charForms(P.c);
  if (!forms.length || (P.tier || 0) >= forms.length) return;   // ya está en la forma más fuerte
  P.tier++;
  const form = forms[P.tier - 1];
  P.transformed += 6;   // un empujón extra por haber aguantado tanto
  G.shake = Math.max(G.shake, 0.6);
  sfx('power');
  announce(G.players.length > 1 ? '¡{name}: {form}!' : '¡{form}!', form.aura, { name: P.name, form: form.name });
  burst(P.x, P.y, form.aura, 44, 7, 4.5);
  G.novas.push({ x: P.x, y: P.y, r: 0, maxR: 140, dmg: 26, hit: new Set(), color: form.aura, kb: 20, owner: P, aid: 'ki', noBoss: true });
}

// ─── Aparición de enemigos ───────────────────────────────────────────────────
// Cada nivel multiplica la vida y el daño de sus enemigos (G.lv.hp, G.lv.dmg)
const lateRamp = k => G.lv.infinite ? 1 + Math.max(0, G.t - 900) / k : 1;
function hpScale() { return (1 + G.t / 110) * coop() * G.lv.hp * lateRamp(240); }
// Vida de un jefe al aparecer. En el Nivel 5, después del minuto 15 también se acelera (más suave que la horda: x2 hacia
// el minuto 35, x2,75 al 50), para que los jefes sigan siendo jefes. Con un bot inmortal, cada jefe tardaba 12-17 s en
// caer en toda la partida; así va de ~19 s al principio a ~36 s entre los minutos 30 y 40, sin que se apilen (2.23.4)
const BOSS_LATE = 1200;
const bossHp = b => b.hp * coop() * (rule('bossHp') ? 2 : 1) * lateRamp(BOSS_LATE);
// Tope de los élites: nunca más del 75% de la vida de un jefe de ese momento. Antes los élites de los enemigos
// más resistentes superaban a los jefes, y en el Nivel 5 cualquier élite los alcanzaba (2.23.4). La referencia:
//   niveles normales: el último jefe que apareció (o el primero, si todavía no salió ninguno)
//   Nivel 5: el jefe promedio de la vuelta actual (cada vuelta empieza con jefes débiles, como Raditz)
const ELITE_CAP = 0.75;   // (0,75: siempre por debajo del jefe, sin achicar de más a los élites de los primeros minutos)
function eliteCap() {
  let ref;
  if (G.lv.infinite) {
    const r = kaioRound() - 1, hps = G.lv.bosses.filter(b => b.round === r).map(b => b.hp).sort((x, y) => x - y);
    ref = hps.length ? { hp: hps[Math.floor(hps.length / 2)] } : null;
  } else ref = levelBoss(G.bossIdx - 1) || levelBoss(G.bossIdx);
  return ref ? bossHp(ref) * ELITE_CAP : Infinity;
}
function dmgScale() { return (1 + G.t / 320) * G.lv.dmg * lateRamp(420); }
// Vuelta de jefes del Nivel 5 en la que va la partida (la del último jefe que ya apareció)
function kaioRound() {
  let r = 0;
  for (const b of G.lv.bosses) { if (b.at > G.t) break; r = b.round; }
  return r + 1;
}
// Jefe número i del nivel: la ficha del jefe con el minuto, la vida y si es el final según el nivel
// ¿La partida es del desafío semanal y tiene esta regla?
const rule = r => !!(G && G.weekly && G.weekly.rules.includes(r));
const baseBalls = () => rule('balls4') ? 4 : 7;
// Jefes del nivel con sus minutos; con «Jefes en pareja» cada jefe llega junto con el siguiente (el final, solo)
function bossSchedule(lv, weekly) {
  const list = lv.bosses.map(b => ({ ...b }));
  if (weekly && weekly.rules.includes('bossPairs')) {
    const normal = list.filter(b => !b.final);
    for (let i = 0; i + 1 < normal.length; i += 2) normal[i + 1].at = normal[i].at;
    list.sort((a, b) => a.at - b.at);
  }
  return list;
}
function levelBoss(i) {
  const e = (G.bosses || G.lv.bosses)[i];
  return e ? { ...bossDef(e.id), at: e.at, hp: e.hp, final: !!e.final, saga: e.saga, round: e.round, sagaStart: !!e.sagaStart } : null;
}

function spawnPos(extra = 40, around = null) {
  if (G && G.snake) return snakeSpawnPos();   // Camino de la Serpiente: sobre el camino, adelante o atrás
  const P = around || pick(alivePlayers()) || G.players[0], R = Math.hypot(BW, BH) / 2 + extra;
  let x, y;
  for (let i = 0; i < 12; i++) {   // en el Planeta de Kaio-sama, nunca sobre las nubes
    const a = Math.random() * Math.PI * 2;
    x = P.x + Math.cos(a) * R; y = P.y + Math.sin(a) * R;
    if (!footBlocked(x, y)) return { x, y };
  }
  [x, y] = walkableSpot(x, y);   // todo el anillo cae en nubes (el planeta del inicio): el borde más cercano
  return { x, y };
}
// ¿Los pies de un enemigo en (x, y) pisan terreno prohibido? (THEME.blocked: las nubes del Planeta de Kaio-sama)
const footBlocked = (x, y, s = 1) => !!THEME.blocked && THEME.blocked(x, y + 10 * s);
// Si un movimiento lo metió en las nubes, se desliza por el borde o vuelve a donde estaba.
// (Si ya estaba adentro, lo deja salir: nunca queda trabado.)
// Devuelve true si lo tuvo que frenar.
function keepOnGround(e, ox, oy) {
  if (!THEME.blocked || !footBlocked(e.x, e.y, e.scale) || footBlocked(ox, oy, e.scale)) return false;
  if (!footBlocked(e.x, oy, e.scale)) e.y = oy;
  else if (!footBlocked(ox, e.y, e.scale)) e.x = ox;
  else { e.x = ox; e.y = oy; }
  return true;
}
function pickEnemyType() {
  const avail = G.lv.spawns.filter(s => G.t >= s.from && !(G.t >= s.to));
  let total = avail.reduce((a, s) => a + s.weight, 0), r = Math.random() * total;
  for (const s of avail) { if ((r -= s.weight) <= 0) return s.id; }
  return avail[0].id;
}
function spawnEnemy(id, opts = {}) {
  let pos = opts.pos || spawnPos();
  if (opts.pos && footBlocked(pos.x, pos.y)) { const [x, y] = walkableSpot(pos.x, pos.y); pos = { x, y }; }   // la horda en círculo: nunca sobre las nubes
  const def = ENEMIES[id];
  // Élite (2.13.0: un poco más fuerte): 12 veces la vida (era 10), +30% de daño y +10% de velocidad
  const elite = !!opts.elite, hp = Math.min(def.hp * hpScale() * (elite ? 12 : 1) * (rule('horde') ? 0.6 : 1), elite ? eliteCap() : Infinity);
  G.enemies.push({
    nid: G.nid++, def, id, x: pos.x, y: pos.y, hp, maxHp: hp, r: def.r * (elite ? 1.4 : 1), speed: def.speed * rand(0.9, 1.1) * (rule('speedy') ? 1.5 : 1) * (elite ? 1.1 : 1),
    dmg: def.dmg * (elite ? 1.3 : 1), xp: def.xp * (elite ? 8 : 1), scale: def.scale * (elite ? 1.4 : 1), elite,
    cd: rand(1.5, 3.5), flash: 0, facing: 1, orbHit: 0, phase: Math.random() * 10,
    shooter: !!def.shooter && Math.random() < (def.shootChance ?? SHOOTER_CHANCE),   // solo algunos disparan
  });
}
// quiet: sin cartel (lo pone spawnBosses, uno solo para todo el grupo)
function spawnBoss(b, quiet = false) {
  const pos = spawnPos(10), hp = bossHp(b);
  G.enemies.push({
    nid: G.nid++, def: b, id: b.id, boss: true, spawnT: G.t, final: !!b.final, x: pos.x, y: pos.y, hp, maxHp: hp, r: b.r,
    speed: b.speed, dmg: b.dmg, xp: 60, scale: b.scale, cd: 2.5, pi: 0, dash: 0, flash: 0, facing: 1, orbHit: 0,
    phase: 0,
  });
  G.shake = 0.6;
  sfx('boss');
  if (!quiet) announce('¡{name} ha llegado!', '#ff5c5c', { name: b.name });
}
function updateSpawning(dt) {
  if (G.testNoSpawn) {   // modo prueba: sin enemigos comunes, élites ni hordas (los jefes, sí)
    G.spawnAcc = 0; G.nextElite = Math.max(G.nextElite, G.t + 1); G.nextSwarm = Math.max(G.nextSwarm, G.t + 1);
  }
  const rate = (0.9 + G.t / 18) * (1 + 0.35 * (G.players.filter(p => !p.gone && !p.ally).length - 1)) * (rule('horde') ? 2 : 1);
  G.spawnAcc += rate * dt;
  while (G.spawnAcc >= 1) {
    G.spawnAcc--;
    if (G.enemies.length < 320) spawnEnemy(pickEnemyType());
  }
  if (G.t >= G.nextElite) {
    G.nextElite += 45;
    spawnEnemy(pickEnemyType(), { elite: true });
    announce('¡Un enemigo de élite lleva una Esfera del Dragón!', '#ffb81c');
  }
  if (G.t >= G.nextSwarm) { // un círculo de enemigos del nivel que se cierra sobre un jugador
    G.nextSwarm += 75;
    const P = pick(alivePlayers()), n = 18 + Math.floor(G.t / 30);
    if (P) {
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2, R = Math.hypot(BW, BH) / 2 + 20;
        spawnEnemy(G.lv.swarm, { pos: { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R } });
      }
      announce(G.lv.swarmTextEs || G.lv.swarmText, '#7dff6a');   // en español: cada jugador lo traduce
    }
  }
  // Los jefes que tocan en el mismo momento salen juntos y con un solo aviso
  const group = [];
  for (let b = levelBoss(G.bossIdx); b && G.t >= b.at; b = levelBoss(G.bossIdx)) { G.bossIdx++; group.push(b); }
  if (group.length) spawnBosses(group);
}
function spawnBosses(group) {
  for (const b of group) spawnBoss(b, true);
  // Nivel 5: al empezar cada saga, el aviso es de la saga (y de la vuelta, desde la segunda)
  if (group[0].sagaStart) {
    const saga = KAIO_SAGAS[group[0].saga], round = group[0].round + 1;
    return round > 1 ? announce('¡Vuelta {n}: vuelve la saga {saga}!', '#ff5c5c', { n: round, saga })
      : announce('¡Vuelve la saga {saga}!', '#ff5c5c', { saga });
  }
  if (group.length === 1) return announce('¡{name} ha llegado!', '#ff5c5c', { name: group[0].name });
  // Los nombres van sueltos para que cada jugador los vea en su idioma (a, b, c → "{a}, {b} y {c}")
  const params = { n: group.length }, keys = group.map((b, i) => { params['b' + i] = b.name; return `{b${i}}`; });
  announce(`¡{n} jefes a la vez: ${keys.slice(0, -1).join(', ')} y ${keys[keys.length - 1]}!`, '#ff5c5c', params);
}

// ─── Daño ────────────────────────────────────────────────────────────────────
// aid: técnica que causó el daño (para las estadísticas de la pantalla de pausa)
const DMG_STEP = 15;   // el daño se anota en tramos de 15 s (gráfico del final)
function damageEnemy(e, amount, src, kb, owner, aid) {
  if (e.dead) return;
  if (e.shield > 0) { if (Math.random() < 0.15) burst(e.x, e.y - 8, '#7fe6ff', 3, 2, 2); return; }   // Barrera del Androide 17
  const crit = Math.random() < 0.08 + 0.04 * ((owner && owner.passives && owner.passives.crit) || 0);   // Golpe certero
  const boss = (e.boss && owner ? 1 + (owner.c.bossBonus || 0) : 1)   // Trunks del Futuro: más daño a los jefes
    * ((e.boss || e.elite) && owner && owner.passives ? 1 + 0.1 * (owner.passives.tracker || 0) : 1);   // Rastreador
  const d = Math.max(1, Math.round(amount * dmgMult(owner) * boss * (crit ? 2 : 1)));
  if (owner && aid) {
    const got = Math.min(d, Math.max(0, e.hp));
    owner.stats.dmg[aid] = (owner.stats.dmg[aid] || 0) + got;
    const line = owner.stats.dmgLine || (owner.stats.dmgLine = []), b = Math.floor(G.t / DMG_STEP);   // para el gráfico del final
    line[b] = (line[b] || 0) + got;
  }
  e.hp -= d;
  e.flash = 0.08;
  if (teamUltActive()) G.teamUlt = Math.min(TEAM_ULT_MAX, G.teamUlt + d * 0.06);
  // Tagged {dmg:true} so each viewer can hide damage numbers locally (SAVE.fx.dmgNumbers, in drawTexts)
  // without changing what gets sent over the network - everyone still agrees on the real damage done.
  addText(e.x, e.y - e.r * 1.6, crit ? d + '!' : d, crit ? '#ffdd33' : '#ffffff', crit ? 2 : false, { dmg: true });
  if (crit || Math.random() < (e.boss ? 0.3 : 0.12)) playAnim('impact', e.x + rand(-4, 4), e.y - e.r * 0.8, crit ? 1 : 0.7);
  sfx('hit', 0.05);
  if (src) {
    const dx = e.x - src.x, dy = e.y - src.y, l = Math.hypot(dx, dy) || 1, k = e.boss ? kb * 0.08 : kb;
    const ox = e.x, oy = e.y;
    e.x += dx / l * k; e.y += dy / l * k;
    keepOnGround(e, ox, oy);   // el empujón no los tira a las nubes
  }
  if (e.hp <= 0) killEnemy(e, owner);
}
// Brotato-style wave length: a wave ends once enough enemies are killed, not purely by a timer.
// Scaled gently by roster size so two players (who kill faster) don't clear a wave trivially fast.
const waveTarget = (wave, players) => Math.round((9 + wave * 4) * (1 + 0.4 * (Math.max(1, players) - 1)));
function killEnemy(e, owner) {
  e.dead = true;
  G.kills++;
  G.waveKills++;
  // Cíborg: al morir suelta un anillo de disparos (cuidado con matarlo pegado)
  if (e.def.deathRing && !e.vanish) for (let i = 0; i < e.def.deathRing; i++) enemyShot(e, i / e.def.deathRing * Math.PI * 2, 2.4, 6, 0);
  if (owner) { owner.stats.kills++; if (e.elite) achEvent(owner, 'elite'); }
  if (owner && owner.transformed <= 0) owner.ki = Math.min(100, owner.ki + (e.boss ? 50 : e.elite ? 15 : 1) * (1 + (owner.c.kiBonus || 0)) * (1 + 0.15 * (owner.passives.kictl || 0)));
  if (owner && owner.passives.absorb && !owner.dead && Math.random() < 0.03 * owner.passives.absorb) healPlayer(owner, 1 + Math.floor(owner.maxHp * 0.005));   // Absorción
  if (owner && owner.c.shadowExtract && !owner.dead && !e.boss && Math.random() < 0.12) {   // Jinwoo: "Arise" - extrae un soldado de sombra de lo que cae
    const [ex, ey] = walkableSpot(e.x, e.y);
    G.decoys.push({ x: ex, y: ey, t: 6, dur: 6, taunt: 150, dmg: 16, explode: 36, owner, aid: 'shadowarmy',
      facing: 1, color: '#684cff', shadowArmy: true });
    burst(ex, ey, '#684cff', 12, 3, 2);
  }
  const luck = (1 + luckPct(owner && owner.passives.luck) / 100) * (1 + 0.05 * ((owner && owner.shop.luck) || 0));   // Suerte de Mr. Satán + ítem de suerte de la tienda
  burst(e.x, e.y, e.boss ? '#ffd93b' : '#ffffff', e.boss ? 40 : 6, e.boss ? 6 : 2.5);
  if (e.boss) { playAnim('explosion', e.x, e.y - 10, 3); playAnim('wring', e.x, e.y, 3.5); }
  else if (e.elite || e.xp >= 8) playAnim('explosion', e.x, e.y - 6, e.elite ? 2 : 1.4);
  const [sx, sy] = walkableSpot(e.x, e.y);
  // Experiencia: orbes pequeños o grandes según el valor
  let xp = e.xp;
  while (xp > 0) {
    const v = xp >= 10 ? 10 : xp >= 3 ? 3 : 1;
    xp -= v;
    G.pickups.push({ kind: 'xp', v, x: sx + rand(-8, 8) * (e.boss ? 3 : 1), y: sy + rand(-8, 8) * (e.boss ? 3 : 1), pulled: false, sp: 0 });
  }
  // Run money (Brotato-style shop currency): every kill drops a small coin, bosses/elites drop more.
  const moneyV = Math.max(1, Math.round((e.boss ? 40 : e.elite ? 6 : 1 + Math.random()) * (owner ? moneyBonus(owner) : 1)));
  G.pickups.push({ kind: 'money', v: moneyV, x: sx + rand(-10, 10), y: sy + rand(-10, 10), pulled: false, sp: 0 });
  // Local mod: common enemies use the configurable rate, elites are generous,
  // and every boss leaves a healing bean. Luck still improves non-boss drops.
  const senzuChance = e.boss ? 1 : e.elite ? Math.max(0.35, SENZU_DROP * 3) : SENZU_DROP;
  if (!rule('nosenzu') && Math.random() < Math.min(1, senzuChance * (e.boss ? 1 : luck))) {
    // The higher drop rate means beans can pile up if nobody's low on HP; despawn (born+SENZU_LIFE)
    // and a soft on-ground cap keep the floor from filling up without ever lowering the drop rate itself.
    const onGround = G.pickups.filter(p => p.kind === 'senzu');
    if (onGround.length >= SENZU_CAP) { let oldest = onGround[0]; for (const p of onGround) if ((p.born || 0) < (oldest.born || 0)) oldest = p; oldest.dead = true; }
    G.pickups.push({ kind: 'senzu', x: sx, y: sy, pulled: false, sp: 0, born: G.t });
  }
  // Cápsula de Bulma: rara (más probable en los de élite) y nunca dos en el suelo a la vez
  if (Math.random() < (e.elite ? 0.35 : CAPSULE_DROP * luck) && !G.pickups.some(p => p.kind === 'capsule')) G.pickups.push({ kind: 'capsule', x: sx, y: sy, pulled: false, sp: 0 });
  if (e.elite || (e.boss && !e.final)) G.pickups.push({ kind: 'ball', x: sx, y: sy, pulled: false, sp: 0 });
  // Ultimate Orb: very rare, only from elites/bosses, never two on the ground, and only if someone could use it.
  if ((e.elite || e.boss) && !G.pickups.some(p => p.kind === 'ultimate') && G.players.some(P => !P.dead && !P.gone && ultimateIdFor(P) && !hasUltimate(P))
    && Math.random() < (e.boss ? ULTIMATE_DROP * 4 : ULTIMATE_DROP))
    G.pickups.push({ kind: 'ultimate', x: sx, y: sy, pulled: false, sp: 0 });
  if (e.boss) {
    for (const Q of G.players) {   // Mr. Satán cerca: "¡Lo vencí yo!" (y cobra)
      if (!Q.c.credit || Q.dead || Q.gone || Math.hypot(Q.x - e.x, Q.y - e.y) > 400) continue;
      Q.bonusZeni += 150;
      addText(Q.x, Q.y - 34, '¡Lo vencí yo!', '#ffd93b', true);
    }
    G.shake = 0.8;
    G.hitStop = 0.14; G.slowmo = 0.7; G.flashT = 0.45;   // el golpe final se siente (ver step y drawOverlays)
    sfx('boom');
    announce('¡{name} ha sido derrotado!', undefined, { name: e.def.name });
    const secs = Math.round(G.t - (e.spawnT || 0));   // cuánto duró en pie (logro de Freezer)
    emit(['k', e.id, secs]);
    bossDefeated(e.id, secs);
    if (e.final) G.victoryAt = G.t;   // la partida termina en este mismo cuadro
  }
}
function hurtPlayer(P, amount, kind) {
  if (G.testGod) return;   // modo prueba: inmortal
  if (P.koT > 0) return;   // cayendo con la Semilla de reserva
  if (P.inv > 0 || P.immortal > 0 || P.dead || P.hidden || G.mode !== 'play') return;
  if (P.c.cloneSave && !P.cloneUsed) {   // Naruto: un clon de sombra se lleva el primer golpe de la partida
    P.cloneUsed = true; P.inv = Math.max(P.inv, 0.3);
    addText(P.x, P.y - 26, '¡Era un clon!', '#e8f4ff', true);
    burst(P.x, P.y, '#e8f4ff', 20, 4, 3); sfx('power', 0.2);
    return;
  }
  if (P.c.dodge && Math.random() < P.c.dodge) {   // Mr. Satán: el golpe "falla solo"
    P.inv = Math.max(P.inv, 0.2);
    if (P.c.dodgeBurst) { P.dodgeBurstT = 1.2; if (Math.random() < 0.35) addText(P.x, P.y - 26, '¡Godspeed!', '#8ff2ff', true); }
    else if (P.c.flee && Math.random() < 0.35) addText(P.x, P.y - 26, kind === 'beam' ? '¡Son trucos de luces!' : '¡JA, JA, JA!', '#ffd93b', true);
    return;
  }
  if (P.passives.instinct && Math.random() < 0.03 * P.passives.instinct) {   // Instinto de combate: lo esquiva
    P.inv = Math.max(P.inv, 0.2);
    addText(P.x, P.y - 26, '¡Esquivado!', '#e8f2ff');
    return;
  }
  const tough = isFusedBody(P) ? FUSION_POWER.def : 1;   // Gogeta recibe la mitad del daño
  const d = Math.max(1, Math.round(amount * tough * dmgScale() * (1 - perk(P, 'def')) - P.passives.armor));
  P.hp -= d;
  P.stats.taken += d;
  P.inv = 0.5;
  if (P === G.me) G.shake = Math.max(G.shake, 0.2);
  addText(P.x, P.y - 22, d, '#ff4d4d', true);
  sfx('hurt', 0.15);
}
function healPlayer(P, v) { P.hp = Math.min(P.maxHp, P.hp + v); }
// Mejoras que actúan solas con el tiempo (2.21.0)
//   Meditación: quieto más de medio segundo, cura 0,6 por nivel cada segundo y carga 1 de Ki por nivel cada segundo
//   Aura de combate: cada medio segundo, los enemigos pegados reciben 4 de daño por nivel (con el daño del guerrero)
function passiveTicks(P, dt) {
  if (P.dead || P.gone) return;
  if (P.dodgeBurstT > 0) P.dodgeBurstT -= dt;
  if (P.c.destructionAura && (P.destrAuraT = (P.destrAuraT || 0) - dt) <= 0) {   // Beerus: energía de destrucción constante
    P.destrAuraT = 0.5;
    for (const e of G.enemies) {
      if (e.dead || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > (e.r + P.r + 26) ** 2) continue;
      damageEnemy(e, 6, P, 2, P, 'destruction');
      burst(e.x, e.y - 4, '#b06cff', 3, 2, 2);
    }
  }
  if (P.c.bassDrop && !P.dead && (P.bassDropT = (P.bassDropT || BASS_DROP_EVERY) - dt) <= 0) {   // Taira: cada tanto, un "bajón" que aturde
    P.bassDropT = BASS_DROP_EVERY;
    for (const e of G.enemies) {
      if (e.dead || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > 110 * 110) continue;
      e.stun = Math.max(e.stun || 0, 0.6);
    }
    ring(P.x, P.y, 110, 0.4, '#ff7a3d');
    sfx('bass', 0.3);
  }
  const med = P.passives.meditate || 0;
  P.stillT = P.moving ? 0 : (P.stillT || 0) + dt;
  if (med && P.stillT > 0.5) {
    healPlayer(P, 0.6 * med * dt);
    if (P.transformed <= 0 && !P.c.noKi) P.ki = Math.min(100, P.ki + med * dt);
    if (Math.random() < dt * 3) G.fx.push({ type: 'spark', x: P.x + rand(-10, 10), y: P.y + 6, vx: 0, vy: -0.6, t: 0.6, color: '#c8a2ff', size: 2 });   // destellos que suben
  }
  const aura = P.passives.aura || 0;
  if (aura && (P.auraT = (P.auraT || 0) - dt) <= 0) {
    P.auraT = 0.5;
    for (const e of G.enemies) {
      if (e.dead || (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > (e.r + P.r + 10) ** 2) continue;
      damageEnemy(e, 4 * aura, P, 3, P, 'aura');
      burst(e.x, e.y - 4, '#ff7a3d', 3, 2, 2);
    }
  }
}

// ─── Técnicas de los jugadores ───────────────────────────────────────────────
function nearestEnemy(P, maxD = 480) {
  let best = null, bd = maxD * maxD;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const d = (e.x - P.x) ** 2 + (e.y - P.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
// Estadísticas de una técnica de un jugador: las de su nivel, con Técnica amplia (más tamaño y área) y
// Multiplicación (+1 proyectil a nivel 1 y otro a nivel 4, en las técnicas que disparan varios)
// Multiplicación (un solo nivel): +1 proyectil, solo en las técnicas que ya disparan varios (las de una sola
// esfera grande, como la Genkidama, no se multiplican)
const multiExtra = l => (l > 0 ? 1 : 0);
// Suerte de Mr. Satán (2.18.5; antes +25% por nivel, era demasiado): cuánto más de semillas, cápsulas y Zeni al
// terminar, en %, según el nivel (hasta +8% a nivel 5)
const LUCK_PCT = [0, 2, 3, 5, 6, 8];
const luckPct = l => LUCK_PCT[Math.max(0, Math.min(LUCK_PCT.length - 1, l || 0))];
function attackStats(P, id, lvl) {
  const s = { ...ATTACKS[id].stats(lvl) }, area = 1 + 0.08 * (P.passives.area || 0), ml = P.passives.multi || 0;
  for (const k of ['radius', 'width', 'explode', 'taunt', 'ringR']) if (s[k]) s[k] *= area;
  if (s.r) s.r = Math.round(s.r * area);
  if (ml && s.count >= 2 && ATTACKS[id].type !== 'decoy') s.count += multiExtra(ml);
  if (s.dur && P.passives.sustain) s.dur *= 1 + 0.1 * P.passives.sustain;   // Técnica sostenida
  return s;
}
function fireAttacks(P, dt) {
  const cdm = cdMult(P);
  for (const a of P.attacks) {
    const def = ATTACKS[a.id];
    if (def.type === 'orbit') continue;
    a.cd -= dt;
    if (a.cd > 0) continue;
    const s = attackStats(P, a.id, a.lvl);
    // Las ondas (Ráfaga de Puños, Onda Explosiva) esperan a tener a alguien dentro de su alcance
    const tgt = nearestEnemy(P, def.kick || def.type === 'rush' ? 230 : def.type === 'beam' ? s.len + 40 : def.type === 'nova' ? s.radius + 30 : def.type === 'rain' ? 380 : def.type === 'decoy' || def.type === 'buff' ? 260 : 480);
    if (!tgt) { a.cd = 0.2; continue; }
    a.cd = s.cd * cdm;
    if (P.c.sfxVoice) sfx(P.c.sfxVoice, 0.12);   // some characters layer a signature sound on every cast (e.g. Taira's bass)
    // Crossover techniques announce themselves periodically so their personal
    // moves stay readable even when the screen is crowded with enemies.
    if (def.crossover && G.t >= (P.crossoverLabelT || 0)) {
      addText(P.x, P.y - 36, def.name, def.color, true, { ability: true });
      P.crossoverLabelT = G.t + 2.4;
    }
    // Apuntado manual (opción del menú): rayos y proyectiles van hacia donde apunta el jugador;
    // el Makosen y las ondas siguen centrados en el enemigo / el jugador
    const manual = P.aim != null && !def.ring && (def.type === 'beam' || def.type === 'projectile');
    const ang = manual ? P.aim : Math.atan2(tgt.y - P.y, tgt.x - P.x);
    if (Math.abs(Math.cos(ang)) > 0.2 && !P.moving) P.facing = Math.sign(Math.cos(ang));
    if (!P.moving) P.dir = dirFromVec(Math.cos(ang), Math.sin(ang));   // quieto: mira hacia donde dispara
    if (def.type === 'projectile' && def.ring) {
      // Makosen: las esferas aparecen en círculo alrededor del enemigo y se cierran sobre él
      for (let i = 0; i < s.count; i++) {
        const an = i / s.count * Math.PI * 2, x = tgt.x + Math.cos(an) * s.ringR, y = tgt.y + Math.sin(an) * s.ringR;
        G.projs.push({
          x, y, vx: -Math.cos(an) * s.speed, vy: -Math.sin(an) * s.speed, r: s.r, dmg: s.dmg, aid: a.id, pierce: s.pierce,
          life: s.ringR * 1.6 / (s.speed * 60), hit: new Set(), color: def.color, core: def.core, kind: def.kind,
          explode: 0, spin: 0, knock: s.knock || 3, owner: P,
        });
      }
      sfx('shot');
      P.castT = Math.max(P.castT || 0, 0.25);
    } else if (def.type === 'projectile') {
      // Granada: cae donde está el enemigo (o, apuntando a mano, un poco más allá en esa dirección)
      const lx = manual ? P.x + Math.cos(ang) * 220 : tgt.x, ly = manual ? P.y + Math.sin(ang) * 220 : tgt.y;
      for (let i = 0; i < s.count; i++) {
        const an = ang + (i - (s.count - 1) / 2) * s.spread;
        const land = def.grenade ? { x: lx + (i - (s.count - 1) / 2) * 60 * Math.cos(ang + Math.PI / 2), y: ly + (i - (s.count - 1) / 2) * 60 * Math.sin(ang + Math.PI / 2) } : null;
        const lan = land ? Math.atan2(land.y - P.y, land.x - P.x) : an;
        G.projs.push({
          x: P.x, y: P.y - 4, vx: Math.cos(lan) * s.speed, vy: Math.sin(lan) * s.speed, r: s.r, dmg: s.dmg, aid: a.id,
          pierce: s.pierce || 0, life: land ? 9 : s.life, hit: new Set(), color: def.color, core: def.core, kind: def.kind,
          explode: s.explode || 0, spin: 0, knock: s.knock || 3, owner: P,
          bounce: s.bounce || 0, speed: s.speed, home: s.home || 0, land, fuse: s.fuse,
        });
      }
      sfx('shot');
      P.castT = Math.max(P.castT || 0, 0.2);
    } else if (def.type === 'beam') {
      for (const an of def.both ? [ang, ang + Math.PI] : [ang]) {   // Super Masenko: hacia adelante y hacia atrás
        G.beams.push({ ang: an, len: s.len, width: s.width, dmg: s.dmg, t: s.dur, dur: s.dur, tick: 0, color: def.color, core: def.core, aid: a.id, owner: P });
      }
      sfx('beam', 0.3);
      P.castT = Math.max(P.castT || 0, s.dur);
    } else if (def.type === 'buff') {
      // Kaioken: por unos segundos más daño y velocidad, a cambio de un poco de vida (nunca te deja en 0)
      P.kaioken = s.dur; P.kaiokenBoost = s.boost;
      P.hp = Math.max(1, P.hp - Math.round(P.maxHp * s.cost / 100));
      addText(P.x, P.y - 34, def.evolved ? '¡Kaioken x20!' : '¡Kaioken!', '#ff3d3d', true);
      burst(P.x, P.y, '#ff3d3d', 18, 4, 3);
      sfx('power', 0.3);
    } else if (def.type === 'rain') {
      // Lluvia de Ki: una esfera cae del cielo sobre cada uno de varios enemigos al azar cerca tuyo
      const near = shuffle(G.enemies.filter(e => !e.dead && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 < 380 * 380)).slice(0, s.count);
      for (const e of near) {
        const x = e.x + rand(-6, 6);
        G.projs.push({ x, y: e.y - 230, vx: 0, vy: 9, fallY: e.y, r: s.r, dmg: s.dmg, aid: a.id, pierce: 0, life: 3, hit: new Set(),
          color: def.color, kind: def.kind, explode: s.explode, spin: 0, owner: P });
      }
      sfx('shot');
      P.castT = Math.max(P.castT || 0, 0.25);
    } else if (def.type === 'decoy') {
      // Zanzoken: imágenes residuales que atraen a los enemigos y al final estallan
      for (let i = 0; i < s.count; i++) {
        // (la Bomba de regalo, si es una sola, va un poco adelante)
        const an = i / s.count * Math.PI * 2, off = s.count > 1 ? 70 : 0, front = def.gift && s.count === 1 ? 50 * (P.facing || 1) : 0;
        const [x, y] = walkableSpot(P.x + front + Math.cos(an) * off, P.y + Math.sin(an) * off * 0.7);
        G.decoys.push({ x, y, t: s.dur, dur: s.dur, taunt: s.taunt, dmg: s.dmg, explode: s.explode, owner: P, aid: a.id,
          facing: P.facing, color: def.color, gift: !!def.gift, shadowClone: !!def.shadowClone, shadowArmy: !!def.shadowArmy });
        burst(x, y, def.shadowArmy ? '#6d52ff' : '#c8e0ff', def.shadowArmy ? 18 : 10, def.shadowArmy ? 4 : 3, 2);
      }
      sfx('power', 0.3);
    } else if (def.megaton) {   // Megaton Punch: 1 de daño... salvo el golpe legendario
      P.punchT = 0.25;
      if (Math.random() < s.legend) megatonLegend(P, s.boss);
      else {
        damageEnemy(tgt, s.dmg, P, 6, P, a.id);
        if (Math.random() < 0.35) addText(P.x, P.y - 34, '¡MEGATON PUNCH!', '#ffd93b', true);
      }
      sfx('hit', 0.2);
    } else if (def.type === 'rush') {
      // A real melee rush (Jinwoo's Dagger Rush, Asta's Demon-Slayer Rush, etc.): the fighter physically
      // closes the distance and cuts through anyone in the way, instead of throwing a weapon. Damage is
      // a short line of novas along the dash path (small radius, quick growth) - that reuses the nova
      // system's existing host-authoritative sync instead of needing new netcode for a moving hitbox.
      const dist = Math.hypot(tgt.x - P.x, tgt.y - P.y) || 1;
      const steps = Math.max(2, Math.round(s.count));
      const dashDur = Math.min(0.45, Math.max(0.12, dist / (s.speed * 32)));
      for (let i = 1; i <= steps; i++) {
        const q = i / steps;
        G.novas.push({ x: P.x + (tgt.x - P.x) * q, y: P.y + (tgt.y - P.y) * q, r: 0, maxR: s.r, dmg: s.dmg,
          hit: new Set(), color: def.color, kb: s.knock || 8, owner: P, aid: a.id });
      }
      if (P === G.me) {
        P.dashT = dashDur; P.dashVX = (tgt.x - P.x) / dashDur; P.dashVY = (tgt.y - P.y) / dashDur;
        P.dashColor = def.color; P.inv = Math.max(P.inv, dashDur + 0.1);
      }
      P.punchT = 0.3;
      addText(P.x, P.y - 34, def.name, def.color, true, { ability: true });
      sfx('hit', 0.25);
    } else if (def.kick) {   // Dynamite Kick: patada voladora... o se cae de cara
      if (Math.random() < s.trip) {
        P.tripT = 1.1;
        addText(P.x, P.y - 30, '¡Ay!', '#ff9b9b', true);
        sfx('hurt', 0.2);
      } else {
        if (P === G.me) { const d = Math.hypot(tgt.x - P.x, tgt.y - P.y) || 1; P.dashT = 0.18; P.dashVX = (tgt.x - P.x) / 0.18; P.dashVY = (tgt.y - P.y) / 0.18; }
        P.punchT = 0.3;
        G.novas.push({ x: tgt.x, y: tgt.y, r: 0, maxR: s.radius, dmg: s.dmg, hit: new Set(), color: def.color, kb: 20, owner: P, aid: a.id });
        addText(P.x, P.y - 34, '¡Dynamite Kick!', '#ff9b3d', true);
        sfx('boom', 0.3);
      }
    } else if (def.type === 'nova') {
      G.novas.push({ x: P.x, y: P.y, r: 0, maxR: s.radius, dmg: s.dmg, hit: new Set(), color: def.color, kb: 14, owner: P, aid: a.id, stun: s.stun || 0, kind: def.kind });
      if (s.heal) healPlayer(P, s.heal);   // Explosión de Ki
      if (def.punch) P.punchT = 0.25;   // Ráfaga de Puños: el personaje tira un puñetazo
      if (s.radius >= 120 && !s.stun) { burst(P.x, P.y, def.color, 24, 6, 4); playAnim('wring', P.x, P.y, s.radius / 14); G.shake = Math.max(G.shake, 0.25); }   // las ondas grandes se sienten
      sfx('boom', 0.3);
    }
  }
}
function updateProjectiles(k, dt) {
  for (const p of G.projs) {
    if (p.land) {   // Granada de Ki: vuela hasta su lugar (sin chocar con nadie), espera y estalla
      if (!p.arrived) {
        const dx = p.land.x - p.x, dy = p.land.y - p.y, dd = Math.hypot(dx, dy);
        if (dd <= p.speed * k) { p.x = p.land.x; p.y = p.land.y; p.vx = p.vy = 0; p.arrived = true; }
        else { p.x += dx / dd * p.speed * k; p.y += dy / dd * p.speed * k; }
      } else if ((p.fuse -= dt) <= 0) { p.dead = true; explode(p.x, p.y, p.explode, p.dmg, p.color, p.owner, p.aid); }
      p.spin += dt * 20;
      continue;
    }
    if (p.home) {   // Sokidan: gira de a poco hacia el enemigo más cercano que todavía no golpeó
      let best = null, bd = 320 * 320;
      for (const e of G.enemies) { if (e.dead || p.hit.has(e)) continue; const dd = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (dd < bd) { bd = dd; best = e; } }
      if (best) {
        const sp = Math.hypot(p.vx, p.vy), a = Math.atan2(p.vy, p.vx);
        let da = Math.atan2(best.y - p.y, best.x - p.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da));
        const na = a + Math.max(-p.home * dt, Math.min(p.home * dt, da));
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      }
    }
    p.x += p.vx * k; p.y += p.vy * k; p.life -= dt; p.spin += dt * 20;
    if (p.fallY !== undefined) {   // Lluvia de Ki: cae sin chocar hasta llegar al suelo, y ahí estalla
      if (p.y >= p.fallY) { p.dead = true; explode(p.x, p.y, p.explode, p.dmg, p.color, p.owner, p.aid); }
      continue;
    }
    if (p.life <= 0) { p.dead = true; if (p.explode) explode(p.x, p.y, p.explode, p.dmg, p.color, p.owner, p.aid); continue; }
    for (const e of G.enemies) {
      if (e.dead || p.hit.has(e)) continue;
      const rr = e.r + p.r;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
      if (p.explode) { explode(p.x, p.y, p.explode, p.dmg, p.color, p.owner, p.aid); p.dead = true; break; }
      damageEnemy(e, p.dmg, p, p.knock || 3, p.owner, p.aid);
      p.hit.add(e);
      if (--p.pierce < 0) { p.dead = true; break; }
      if (p.bounce > 0) { bounceProjectile(p); break; }   // Kienzan Múltiple: salta al siguiente enemigo
    }
  }
  G.projs = G.projs.filter(p => !p.dead);
}
function bounceProjectile(p) {
  let best = null, bd = 260 * 260;
  for (const e of G.enemies) {
    if (e.dead || p.hit.has(e)) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  if (!best) return;
  const an = Math.atan2(best.y - p.y, best.x - p.x);
  p.vx = Math.cos(an) * p.speed; p.vy = Math.sin(an) * p.speed;
  p.life = Math.max(p.life, 0.9);
  p.bounce--;
}
function explode(x, y, radius, dmg, color, owner, aid) {
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - x, e.y - y) < radius + e.r) damageEnemy(e, dmg, { x, y }, 12, owner, aid);
  }
  ring(x, y, radius, 0.4, color);
  burst(x, y, color, 24, 5, 4);
  playAnim('explosion', x, y, Math.min(2.6, Math.max(1.2, radius / 26)));
  playAnim('shock', x, y, Math.min(5, radius / 16));
  G.shake = Math.max(G.shake, 0.25);
  sfx('boom', 0.1);
}
// El golpe legendario del Megaton Punch: todos los enemigos comunes de la pantalla caen, y los jefes lo sienten
function megatonLegend(P, bossPct = 0.15) {
  const ki = P.ki;   // (las bajas del golpe legendario no cargan el Ki: Buu se hace esperar)
  for (const e of G.enemies) {
    if (e.dead || Math.hypot(e.x - P.x, e.y - P.y) > 520) continue;
    if (e.boss) damageEnemy(e, e.maxHp * bossPct / Math.max(1, dmgMult(P)), P, 20, P, 'megaton');   // (parte de la vida máxima del jefe)
    else killEnemy(e, P);
  }
  P.ki = ki;
  announce('¡¿VIERON ESO?!', '#ffd93b');
  addText(P.x, P.y - 40, '¡MEGATON PUNCH!', '#ffd93b', true);
  G.shake = Math.max(G.shake, 1);
  ring(P.x, P.y, 300, 0.6, '#ffd93b'); burst(P.x, P.y, '#ffd93b', 40, 8, 4);
  sfx('boom');
}
// ¡Amigo Buu!: Majin Buu pelea por Mr. Satán mientras dura su "transformación"
const BUDDY_TIME = 15;
function updateHelpers(dt, k) {
  for (const h of G.helpers) {
    h.t -= dt; h.punch = Math.max(0, h.punch - dt);
    if (h.t <= 0) { h.dead = true; poof(h.x, h.y); continue; }
    let best = null, bd = 450 * 450;
    for (const e of G.enemies) { if (e.dead) continue; const d = (e.x - h.x) ** 2 + (e.y - h.y) ** 2; if (d < bd) { bd = d; best = e; } }
    const tx = best ? best.x : h.owner.x + 34, ty = best ? best.y : h.owner.y, d = Math.hypot(tx - h.x, ty - h.y);
    if (d > (best ? best.r + 16 : 40)) { const sp = 3.6 * k; h.x += (tx - h.x) / d * Math.min(sp, d); h.y += (ty - h.y) / d * Math.min(sp, d); }
    if (Math.abs(tx - h.x) > 2) h.facing = tx > h.x ? 1 : -1;
    if (best && d < best.r + 22 && (h.cd -= dt) <= 0) {
      h.cd = 0.4; h.punch = 0.2;
      for (const e of G.enemies) if (!e.dead && Math.hypot(e.x - h.x, e.y - h.y) < 60) damageEnemy(e, 90 + G.level * 12, h, 18, h.owner, 'ki');
      burst(best.x, best.y, '#ff9bd6', 6, 3, 2);
    }
    if ((h.slam = (h.slam ?? 2) - dt) <= 0) {   // cada tanto, un pisotón que barre todo alrededor
      h.slam = 2.5; h.punch = 0.3;
      G.novas.push({ x: h.x, y: h.y, r: 0, maxR: 150, dmg: 160 + G.level * 20, hit: new Set(), color: '#ff9bd6', kb: 30, owner: h.owner, aid: 'ki' });
      G.shake = Math.max(G.shake, 0.3); sfx('boom', 0.3);
    }
  }
  G.helpers = G.helpers.filter(h => !h.dead);
}
function updateDecoys(dt) {
  for (const d of G.decoys) {
    if ((d.t -= dt) > 0) continue;
    d.dead = true;
    explode(d.x, d.y, d.explode, d.dmg, d.color, d.owner, d.aid);
  }
  G.decoys = G.decoys.filter(d => !d.dead);
}
// La imagen residual más cercana que atrae a este enemigo (los jefes no caen en el engaño)
function nearDecoy(e) {
  let best = null, bd = Infinity;
  for (const d of G.decoys) { const dd = (d.x - e.x) ** 2 + (d.y - e.y) ** 2; if (dd < d.taunt * d.taunt && dd < bd) { bd = dd; best = d; } }
  return best;
}
function updateBeams(dt) {
  for (const b of G.beams) {
    b.t -= dt; b.tick -= dt;
    if (b.t <= 0) { b.dead = true; continue; }
    if (b.tick <= 0) {
      b.tick = 0.1;
      const P = b.owner, ax = P.x, ay = P.y - 4, bx = ax + Math.cos(b.ang) * b.len, by = ay + Math.sin(b.ang) * b.len;
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (segDist(e.x, e.y, ax, ay, bx, by) < b.width / 2 + e.r) damageEnemy(e, b.dmg, P, 1.5, b.credit || P, b.aid);
      }
    }
  }
  G.beams = G.beams.filter(b => !b.dead);
}
// Esferas que giran alrededor del jugador (Esferas de Ki o su evolución, el Escudo de Ki)
function orbitPositions(P) {
  const a = P.attacks.find(x => ATTACKS[x.id] && ATTACKS[x.id].type === 'orbit');
  if (!a || P.dead || P.gone) return [];
  const def = ATTACKS[a.id], s = attackStats(P, a.id, a.lvl), out = [];
  for (let i = 0; i < s.count; i++) {
    const an = P.orbitAng * s.spin + i / s.count * Math.PI * 2;
    out.push({ x: P.x + Math.cos(an) * s.radius, y: P.y + Math.sin(an) * s.radius, r: s.r, dmg: s.dmg, aid: a.id, shield: !!def.shield });
  }
  return out;
}
function updateOrbit(P, dt) {
  P.orbitAng += dt;
  if (P.koT > 0) return;   // tirado en el piso (Semilla de reserva): las esferas no golpean
  const orbs = orbitPositions(P);
  if (!orbs.length) return;
  for (const e of G.enemies) {
    if (e.dead || G.t < e.orbHit) continue;
    for (const o of orbs) {
      const rr = o.r + e.r;
      if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 < rr * rr) { damageEnemy(e, o.dmg, o, 6, P, o.aid); e.orbHit = G.t + 0.45; break; }
    }
  }
}
// Las ondas crecen en 0,3 s (solo hacen daño mientras crecen) y después quedan un momento
// desvaneciéndose (hold), para que se vean
const NOVA_HOLD = 0.35;
function updateNovas(dt) {
  for (const n of G.novas) {
    if (n.hold !== undefined) { n.hold -= dt; if (n.hold <= 0) n.dead = true; continue; }
    n.r = Math.min(n.maxR, n.r + (n.maxR / 0.3) * dt);
    for (const e of G.enemies) {
      if (e.dead || n.hit.has(e) || (n.noBoss && e.boss)) continue;
      if (Math.hypot(e.x - n.x, e.y - n.y) < n.r + e.r) {
        n.hit.add(e); damageEnemy(e, n.dmg, n, n.stun ? 0 : n.kb, n.owner, n.aid);
        if (n.stun) e.stun = Math.max(e.stun || 0, n.stun * (e.boss ? 0.35 : 1));   // Taiyoken: los jefes, menos
      }
    }
    if (n.r >= n.maxR) n.hold = NOVA_HOLD;
  }
  G.novas = G.novas.filter(n => !n.dead);
}
// Onda expansiva: disco de energía, anillo grueso con borde blanco, anillo que lo sigue y,
// en las grandes (Onda Explosiva, Explosión de Ki), rayos en el borde y un destello al salir
function drawNova(c, n, t) {
  const p = Math.min(1, n.r / n.maxR), big = n.maxR >= 120;
  const fade = n.hold !== undefined ? Math.max(0, n.hold / NOVA_HOLD) : 1;
  const ell = (r, fill) => { c.beginPath(); c.ellipse(n.x, n.y, Math.max(0, r), Math.max(0, r * 0.8), 0, 0, Math.PI * 2); fill ? c.fill() : c.stroke(); };
  if (n.kind === 'electrodischarge') {
    // Electrodynamic Discharge: a radial burst of jagged white-cyan lightning, not a flat colored ring
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.22 * fade; c.fillStyle = '#5cf2ff'; ell(n.r * 0.7, true);
    c.globalAlpha = Math.max(0, (0.5 - p)) * fade; c.fillStyle = '#eafffe'; circle(c, n.x, n.y, Math.max(0, 16 * (1 - p * 1.6)));
    const bolts = 9;
    for (let i = 0; i < bolts; i++) {
      const a = i / bolts * Math.PI * 2 + (i % 2 ? 0.18 : -0.18) + t * 0.6, len = n.r * (0.78 + 0.22 * Math.sin(t * 9 + i * 2));
      c.globalAlpha = (0.85 - i % 3 * 0.08) * fade; c.strokeStyle = i % 2 ? '#ffffff' : '#8ff2ff'; c.lineWidth = i % 3 === 0 ? 2.5 : 1.5;
      let x = n.x, y = n.y; const steps = 4;
      c.beginPath(); c.moveTo(x, y);
      for (let s = 1; s <= steps; s++) {
        const dist = len * s / steps, jag = (s < steps ? (Math.sin(t * 13 + i * 3 + s) * 5) : 0);
        x = n.x + Math.cos(a) * dist + Math.cos(a + Math.PI / 2) * jag * (s / steps);
        y = n.y + Math.sin(a) * dist * 0.82 + Math.sin(a + Math.PI / 2) * jag * (s / steps) * 0.82;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore(); c.globalAlpha = 1;
    return;
  }
  if (n.kind === 'rulersauthority') {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = '#301b68'; c.globalAlpha = 0.24 * fade; ell(n.r, true);
    for (let i = 0; i < 3; i++) {
      const rr = n.r * (0.4 + i * 0.24) + Math.sin(t * 7 + i) * 3;
      c.strokeStyle = i === 1 ? '#d8c6ff' : '#7654ff'; c.lineWidth = 2 + (2 - i); c.globalAlpha = (0.85 - i * 0.18) * fade;
      c.setLineDash([8 + i * 3, 7]); c.lineDashOffset = (i % 2 ? 1 : -1) * t * 34; ell(rr);
    }
    c.setLineDash([]); c.strokeStyle = '#9a79ff'; c.lineWidth = 2; c.globalAlpha = 0.9 * fade;
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + t * 0.8, ox = Math.cos(a) * n.r, oy = Math.sin(a) * n.r * 0.8;
      const ix = Math.cos(a) * n.r * 0.72, iy = Math.sin(a) * n.r * 0.58;
      c.beginPath(); c.moveTo(n.x + ox, n.y + oy); c.lineTo(n.x + ix, n.y + iy); c.stroke();
    }
    c.globalAlpha = Math.max(0, (0.35 - p) / 0.35) * fade; c.fillStyle = '#f4ecff'; circle(c, n.x, n.y - 7, 24 * (1 - p));
    c.restore(); c.globalAlpha = 1;
    return;
  }
  if (n.color === ATTACKS.taiyoken.color) {   // Taiyoken (2.18.7): solo un anillo fino y un destello chico, para no tapar el mapa
    c.strokeStyle = '#ffffff'; c.globalAlpha = 0.45 * fade; c.lineWidth = 2; ell(n.r);
    c.globalAlpha = 0.2 * fade; c.lineWidth = 1; ell(n.r * 0.85);
    if (n.hold === undefined && p < 0.3) { c.globalAlpha = (1 - p / 0.3) * 0.6; c.fillStyle = '#ffffff'; circle(c, n.x, n.y - 8, 10 * (1 - p)); }
    c.globalAlpha = 1;
    return;
  }
  c.fillStyle = n.color;
  c.globalAlpha = (big ? 0.24 : 0.14) * fade; ell(n.r, true);
  c.fillStyle = '#ffffff';
  c.globalAlpha = (big ? 0.14 : 0.08) * fade; ell(n.r * 0.6, true);
  c.strokeStyle = n.color;
  c.globalAlpha = 0.5 * fade; c.lineWidth = big ? 4 : 2; ell(n.r * 0.75);
  c.globalAlpha = fade; c.lineWidth = (big ? 10 : 5) * (0.5 + 0.5 * fade); ell(n.r);
  c.strokeStyle = '#ffffff'; c.lineWidth = big ? 3 : 2; ell(n.r);
  if (big) {   // rayos de energía que giran en el borde
    c.globalAlpha = 0.8 * fade; c.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + t * 1.5, ca = Math.cos(a), sa = Math.sin(a) * 0.8;
      c.beginPath(); c.moveTo(n.x + ca * n.r * 0.88, n.y + sa * n.r * 0.88); c.lineTo(n.x + ca * n.r * 1.14, n.y + sa * n.r * 1.14); c.stroke();
    }
  }
  if (n.hold === undefined && p < 0.35) {   // destello al salir
    c.globalAlpha = (1 - p / 0.35) * 0.9; c.fillStyle = '#ffffff';
    circle(c, n.x, n.y, (big ? 26 : 14) * (1 - p));
  }
  c.globalAlpha = 1;
}

// ─── Enemigos ────────────────────────────────────────────────────────────────
const SHOT_COLORS = ['#ff6a3d', '#ff3d7a', '#ffa53d', '#b8b8b0', '#ff2a2a', '#c8d4e0'];   // 3: piedra (Dabura) · 4: Crusher Ball · 5: puño de 16
const SHOOTER_CHANCE = 0.5;   // proporción de soldados que disparan (el resto ataca cuerpo a cuerpo)
// Tope de disparos de enemigos comunes en pantalla (los de los jefes no cuentan ni se frenan): en el Nivel 4
// los abanicos, ráfagas y anillos llegaban a apilar más de 300 disparos (2.10.1)
const ENEMY_SHOT_CAP = 40;
function enemyShot(e, ang, speed = 3.5, r = 5, color = 0) {
  if (!e.boss) { let n = 0; for (const s of G.shots) if (!s.boss) n++; if (n >= ENEMY_SHOT_CAP) return; }
  G.shots.push({ boss: !!e.boss, x: e.x, y: e.y - 6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, dmg: e.dmg * 0.8, life: 4, color: SHOT_COLORS[color], ci: color });
}
// The local mod config can raise healing-bean drops without another core edit.
// It is clamped to 0..1; the original game's 0.8% remains the fallback.
const configuredSenzuDrop = Number(window.DBZ_MOD_CONFIG && window.DBZ_MOD_CONFIG.senzuDropRate);
const SENZU_DROP = Number.isFinite(configuredSenzuDrop) ? Math.max(0, Math.min(1, configuredSenzuDrop)) : 0.008;
// At the higher drop rate, uncollected beans need somewhere to go: a soft on-ground cap (oldest one
// disappears to make room for a new drop) plus a despawn timer if nobody needed one for a while.
// Configurable the same way as the drop rate itself - raising it never silently lowers senzuDropRate.
const configuredSenzuCap = Number(window.DBZ_MOD_CONFIG && window.DBZ_MOD_CONFIG.senzuOnGroundCap);
const SENZU_CAP = Number.isFinite(configuredSenzuCap) && configuredSenzuCap > 0 ? Math.floor(configuredSenzuCap) : 14;
const SENZU_LIFE = 55;   // seconds an uncollected bean sits on the ground before it despawns
const CAPSULE_DROP = 0.012;
const ULTIMATE_DROP = 0.006;   // Ultimate Orb: rare per-run pickup, never a permanent unlock
// The one ATTACKS entry (if any) flagged ultimate:true that this character's users list includes.
const ultimateIdFor = P => Object.keys(ATTACKS).find(id => ATTACKS[id].ultimate && ATTACKS[id].users && ATTACKS[id].users.includes(P.charId));
const hasUltimate = P => { const id = ultimateIdFor(P); return !id || P.attacks.some(a => a.id === id); };
// Embestida de los jefes: aviso, duración y velocidad (px por cuadro a 60 fps)
const DASH_WINDUP = 0.75, DASH_TIME = 0.55, DASH_SPEED = 7;
// Técnicas propias de cada jefe (2.16.0), además de los ataques comunes (anillo, abanico, pisotón, embestida).
// Siempre con aviso: franja marcada en el suelo, círculos donde algo va a salir, el jefe cargando con su aura.
//   every: cada cuántos segundos · first: la primera vez, a los cuántos segundos de llegar · color: aura al cargar
const BOSS_SPECIAL = {
  // Nivel 1
  raditz:   { every: 9,  first: 5, color: '#ff6ad5', fn: doubleSunday },
  nappa:    { every: 11, first: 6, color: '#ffb35c', fn: plantSaibamen },
  vegetas:  { every: 10, first: 6, color: '#b04dff', fn: galickHo },
  // Nivel 2
  recoome:  { every: 9,  first: 5, color: '#ffd23d', fn: eraserGun },
  burter:   { every: 8,  first: 4, color: '#6ab8ff', fn: machAttack },
  jeice:    { every: 8,  first: 4, color: '#ff4d4d', fn: crusherBall },
  ginyu:    { every: 11, first: 6, color: '#c86aff', fn: bodyChange },
  freezer:  { every: 8,  first: 5, color: '#ff4df0', fn: freezerSpecial },
  // Nivel 3
  a19:      { every: 9,  first: 5, color: '#6aff8a', fn: absorbEnergy },
  gero:     { every: 9,  first: 5, color: '#6aff8a', fn: absorbEnergy },
  a16:      { every: 8,  first: 5, color: '#c8d4e0', fn: rocketPunch },
  a17:      { every: 12, first: 6, color: '#7fe6ff', fn: barrier },
  a18:      { every: 8,  first: 5, color: '#ffe066', fn: energyStream },
  cellimp:  { every: 8,  first: 5, color: '#6aff8a', fn: tailDrain },
  cellsemi: { every: 9,  first: 5, color: '#4dc3ff', fn: kamehameha },
  cell:     { every: 9,  first: 5, color: '#ffffff', fn: cellSpecial },
  // Nivel 4
  puipui:   { every: 10, first: 5, color: '#a05aff', fn: zoonGravity },
  dabura:   { every: 8,  first: 5, color: '#b8b8b0', fn: stoneSpit },
  fatbuu:   { every: 9,  first: 5, color: '#ff8ad8', fn: candyBeam },
  buu:      { every: 6,  first: 4, color: '#ff8ad8', fn: kidBuuChaos },
};
// Cargar una técnica sin rayos: se planta con su aura y al terminar hace fire(e)
function bossCharge(e, windup, name, color, fire) {
  e.cast = { t: windup, o: { beams: [], fire } };
  addText(e.x, e.y - 40 * e.scale, name, color, true);
  sfx('power', 0.2);
}
// Disparo que persigue al jugador más cercano (home: cuánto puede girar por segundo)
function homingShot(e, ang, speed, r, ci, dmg, home, life, extra = {}) {
  G.shots.push({ boss: true, x: e.x, y: e.y - 6, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, dmg, life, color: SHOT_COLORS[ci], ci, home, ...extra });
}
// ── Nivel 2 ──
// Recoome · Recoome Eraser Gun: un rayo grueso por la boca
function eraserGun(e, P, ang) {
  bossBeams(e, { windup: 1.3, dur: 0.7, color: '#ffd23d', core: '#fffbe0', dmg: e.dmg * 2.2, name: '¡Recoome Eraser Gun!', beams: [{ ang, len: 520, w: 46 }] });
}
// Burter · el más rápido del universo: tres embestidas seguidas, cada una apuntando de nuevo
function machAttack(e, P, ang) {
  addText(e.x, e.y - 40 * e.scale, '¡Space Mach Attack!', '#6ab8ff', true);
  e.dashChain = 2;
  startLunge(e, Math.cos(ang), Math.sin(ang), DASH_WINDUP * 0.7, DASH_TIME * 0.8, DASH_SPEED * 1.15, e.r * 2.2);
}
// Jeice · Crusher Ball: una bola roja grande y lenta que te persigue
function crusherBall(e) {
  bossCharge(e, 0.6, '¡Crusher Ball!', '#ff4d4d', () => {
    const P = nearestPlayer(e.x, e.y);
    homingShot(e, Math.atan2(P.y - e.y, P.x - e.x), 2.6, 13, 4, e.dmg * 1.8, 2.2, 5);
  });
}
// Capitán Ginyu · Cambio de cuerpo: un rayo fino; si te toca, cambian de lugar
function bodyChange(e, P, ang) {
  bossBeams(e, { windup: 1.0, dur: 0.3, color: '#c86aff', core: '#f4e6ff', dmg: e.dmg * 0.6, name: '¡Cambio de cuerpo!', swap: e.nid, beams: [{ ang, len: 480, w: 16 }] });
}
// Freezer · Death Ball (una bola enorme y lenta que cae donde estabas) y Rayo mortal (fino y rápido), alternados
function freezerSpecial(e, P, ang) {
  if ((e.spN = (e.spN || 0) + 1) % 2) {
    G.hazards.push({ x: P.x, y: P.y, r: 105, t: 2.2, dur: 2.2, dmg: e.dmg * 2.4, ball: { x: e.x, y: e.y - 30 * e.scale, r: 26 } });
    addText(e.x, e.y - 40 * e.scale, '¡Death Ball!', '#ff4d4d', true);
    sfx('power', 0.2);
  } else {
    bossBeams(e, { windup: 0.7, dur: 0.25, color: '#ff4df0', core: '#ffe6fb', dmg: e.dmg * 1.6, name: '¡Rayo mortal!', beams: [{ ang, len: 560, w: 12 }] });
  }
}
// ── Nivel 3 ──
// Androide 19 y Dr. Gero · Absorción de energía: marca un círculo a su alrededor; si te agarra, se cura con tu vida
function absorbEnergy(e) {
  G.hazards.push({ x: e.x, y: e.y, r: 95, t: 0.9, dur: 0.9, dmg: e.dmg * 1.1, drain: e.nid });
  bossCharge(e, 0.9, '¡Absorción de energía!', '#6aff8a', () => {});
}
// Androide 16 · Hell's Flash: dispara los dos puños como misiles que te siguen un poco
function rocketPunch(e) {
  bossCharge(e, 0.5, '¡Puños cohete!', '#c8d4e0', () => {
    const P = nearestPlayer(e.x, e.y), a = Math.atan2(P.y - e.y, P.x - e.x);
    homingShot(e, a - 0.5, 4.2, 8, 5, e.dmg * 1.4, 1.6, 3.5);
    homingShot(e, a + 0.5, 4.2, 8, 5, e.dmg * 1.4, 1.6, 3.5);
  });
}
// Androide 17 · Barrera: una burbuja que lo protege de todo el daño unos segundos y te empuja si la tocas
function barrier(e) {
  e.shield = 3.5;
  addText(e.x, e.y - 40 * e.scale, '¡Barrera!', '#7fe6ff', true);
  sfx('power', 0.2);
}
// Androide 18 · Ráfaga de energía: muchos disparos rápidos seguidos
function energyStream(e) {
  bossCharge(e, 0.5, '¡Ráfaga de energía!', '#ffe066', () => { e.stream = { n: 12, t: 0 }; });
}
// Cell Imperfecto · Cola absorbente: una embestida que, si te pega, lo cura
function tailDrain(e, P, ang) {
  addText(e.x, e.y - 40 * e.scale, '¡Cola absorbente!', '#6aff8a', true);
  e.drainDash = true;
  startLunge(e, Math.cos(ang), Math.sin(ang), DASH_WINDUP, DASH_TIME, DASH_SPEED, e.r * 2.4);
}
// Cell Semi-Perfecto · Kamehameha
function kamehameha(e, P, ang) {
  bossBeams(e, { windup: 1.4, dur: 0.8, color: '#4dc3ff', core: '#e6f8ff', dmg: e.dmg * 2.4, name: '¡Kamehameha!', beams: [{ ang, len: 600, w: 50 }] });
}
// Cell · Taiyoken (la pantalla se pone blanca un momento) y Cell Jr., alternados
function cellSpecial(e) {
  if ((e.spN = (e.spN || 0) + 1) % 2) {
    bossCharge(e, 1.0, '¡Taiyoken!', '#ffffff', () => { blind(1.6); G.shake = Math.max(G.shake, 0.3); });
  } else {
    if (G.enemies.filter(q => q.id === 'celljr').length > 15) return;
    const pts = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2, [x, y] = walkableSpot(e.x + Math.cos(a) * rand(45, 80), e.y + Math.sin(a) * rand(30, 60));
      pts.push([x, y]);
      G.hazards.push({ x, y, r: 16, t: 0.9, dur: 0.9, dmg: 0 });
    }
    e.sprout = { t: 0.9, pts, id: 'celljr' };
    addText(e.x, e.y - 40 * e.scale, '¡Cell Jr.!', '#7dff6a', true);
    sfx('power', 0.2);
  }
}
// ── Nivel 4 ──
// Puipui · Gravedad del planeta Zoon: zonas donde te mueves mucho más lento
function zoonGravity(e, P) {
  if (G.zones.length > 4) return;
  for (const [dx, dy] of [[0, 0], [rand(-160, -90), rand(-60, 60)], [rand(90, 160), rand(-60, 60)]]) {
    const [x, y] = walkableSpot(P.x + dx, P.y + dy);
    G.zones.push({ x, y, r: 80, t: 6.5, dur: 6.5 });
  }
  addText(e.x, e.y - 40 * e.scale, '¡Gravedad de Zoon!', '#a05aff', true);
  sfx('power', 0.2);
}
// Dabura · Escupitajo de piedra: si te toca, te petrifica un momento
function stoneSpit(e) {
  bossCharge(e, 0.45, '¡Escupitajo de piedra!', '#b8b8b0', () => {
    const P = nearestPlayer(e.x, e.y), a = Math.atan2(P.y - e.y, P.x - e.x);
    for (const da of [-0.2, 0, 0.2]) homingShot(e, a + da, 4.2, 7, 3, e.dmg * 0.8, 0, 3, { stone: true });
  });
}
// Majin Buu · Rayo de caramelo: si te toca, te vuelve caramelo (lento) unos segundos; y se cura un poco
function candyBeam(e, P, ang) {
  if (e.hp < e.maxHp * 0.6) { const h = e.maxHp * 0.05; e.hp = Math.min(e.maxHp, e.hp + h); burst(e.x, e.y, '#ff8ad8', 14, 3, 3); }
  bossBeams(e, { windup: 0.9, dur: 0.35, color: '#ff8ad8', core: '#ffe6f6', dmg: e.dmg * 0.8, name: '¡Rayo de caramelo!', candy: true, beams: [{ ang, len: 480, w: 22 }] });
}
// Kid Buu · caos: se teletransporta seguido y al aparecer suelta un anillo de bolas de energía
function kidBuuChaos(e, P) {
  if (e.tp) return;
  bossTeleport(e, P);
  e.tp.ring = true;
}
// Ceguera del Taiyoken (el anfitrión la reenvía a los demás)
function blind(secs) {
  G.blind = Math.max(G.blind || 0, secs);
  emit(['f', secs]);
}
function drawBlind() {
  if (!(G.blind > 0)) return;
  ctx.save(); ctx.globalAlpha = Math.min(0.95, G.blind / 1.6 * 1.1) * SAVE.fx.flash; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H); ctx.restore();
}
// Velocidad del jugador según los efectos de los jefes: petrificado, caramelo, gravedad
function statusSpeed(P) {
  if (P.stone > 0 || P.fallT > 0 || P.tripT > 0 || P.koT > 0) return 0;   // petrificado, cayendo al Infierno o tirado en el piso
  let m = (P.candy > 0 ? 0.5 : 1) * (P.swapBody > 0 ? SWAP_SPEED : 1);
  for (const z of G.zones || []) if (z.t < z.dur - 0.6 && (P.x - z.x) ** 2 + ((P.y - z.y) / 0.75) ** 2 < z.r * z.r) { m *= 0.45; break; }
  return m;
}
// Raditz · Double Sunday: dos rayos que salen abiertos en V y se cierran barriendo hasta juntarse donde estabas
// (quedarse quieto en el medio no sirve: hay que salir de la V)
function doubleSunday(e, P, ang) {
  const open = 0.5, dur = 0.9;
  bossBeams(e, { windup: 1.0, dur, color: '#ff6ad5', core: '#ffe6fa', dmg: e.dmg * 1.6, name: '¡Double Sunday!',
    beams: [{ ang: ang - open, len: 430, w: 24, spin: open / dur }, { ang: ang + open, len: 430, w: 24, spin: -open / dur }],
    marks: [{ ang, len: 430, w: 24 }] });   // franja también donde se juntan
}
// Vegeta · Galick Ho: carga más tiempo y dispara un rayo enorme
function galickHo(e, P, ang) {
  bossBeams(e, { windup: 1.6, dur: 0.8, color: '#b04dff', core: '#f1dcff', dmg: e.dmg * 2.6, name: '¡Galick Ho!',
    beams: [{ ang, len: 620, w: 56 }] });
}
// Nappa · siembra Saibaiman: tres círculos en el suelo alrededor y de cada uno sale un Saibaiman
function plantSaibamen(e) {
  if (G.enemies.filter(q => q.id === 'saibaman').length > 40) return;
  const pts = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2, [x, y] = walkableSpot(e.x + Math.cos(a) * rand(45, 80), e.y + Math.sin(a) * rand(30, 60));
    pts.push([x, y]);
    G.hazards.push({ x, y, r: 16, t: 0.9, dur: 0.9, dmg: 0 });   // la marca donde va a salir (no daña)
  }
  e.sprout = { t: 0.9, pts };
  addText(e.x, e.y - 40 * e.scale, '¡Saibaiman!', '#7dff6a', true);
  sfx('power', 0.2);
}
// El jefe se planta, carga con su aura mientras se marcan las franjas, y al final salen los rayos
function bossBeams(e, o) {
  e.cast = { t: o.windup, o };
  for (const b of [...o.beams, ...(o.marks || [])]) G.lanes.push({ x: e.x, y: e.y, dx: Math.cos(b.ang), dy: Math.sin(b.ang), len: b.len, w: b.w, t: o.windup, dur: o.windup });
  addText(e.x, e.y - 40 * e.scale, o.name, o.color, true);
  sfx('power', 0.2);
}
function tickBossCast(e, dt) {
  if (e.shield > 0) e.shield -= dt;
  if (e.stream && (e.stream.t -= dt) <= 0) {   // ráfaga de 18: un disparo cada 0,09 s hacia el jugador
    const P = nearestPlayer(e.x, e.y);
    enemyShot(e, Math.atan2(P.y - e.y, P.x - e.x) + rand(-0.08, 0.08), 5.2, 5, 2);
    e.stream.t = 0.09;
    if (--e.stream.n <= 0) e.stream = null;
  }
  if (e.sprout && (e.sprout.t -= dt) <= 0) {
    for (const [x, y] of e.sprout.pts) {
      spawnEnemy(e.sprout.id || 'saibaman', { pos: { x, y } });
      burst(x, y, '#7dff6a', 10, 3, 2);
    }
    e.sprout = null;
  }
  if (!e.cast || (e.cast.t -= dt) > 0) return;
  const o = e.cast.o;
  e.cast = null;
  if (o.fire) { o.fire(e); return; }
  for (const b of o.beams) G.ebeams.push({ x: e.x, y: e.y - 4, ang: b.ang, spin: b.spin || 0, len: b.len, width: b.w, t: o.dur, dur: o.dur, color: o.color, core: o.core, dmg: o.dmg, hit: new Set(),
    swap: o.swap, candy: o.candy });
  G.shake = Math.max(G.shake, 0.5);
  sfx('beam', 0.1);
}
// Cambio de cuerpo de Ginyu: 5 s más lento (-30%) y más débil (-40% de daño); los primeros 4 s, controles al revés
const SWAP_BODY_TIME = 5, SWAP_INVERT_TIME = 4, SWAP_SPEED = 0.7, SWAP_DMG = 0.6;
// Mueve a un jugador a otro lugar (si es el invitado, su juego mueve su personaje: se le avisa)
function warpPlayer(P, x, y) {
  P.x = x; P.y = y; P.tx = undefined;
  emit(['w', P.id, Math.round(x), Math.round(y)]);
}
// Rayos de los jefes: dañan una vez a cada jugador que tocan
function updateEbeams(dt) {
  for (const b of G.ebeams) {
    b.t -= dt;
    if (b.t <= 0) { b.dead = true; continue; }
    b.ang += b.spin * dt;   // los que barren (Double Sunday)
    const bx = b.x + Math.cos(b.ang) * b.len, by = b.y + Math.sin(b.ang) * b.len;
    for (const P of alivePlayers()) {
      if (b.hit.has(P) || segDist(P.x, P.y, b.x, b.y, bx, by) >= b.width / 2 + P.r) continue;
      b.hit.add(P); hurtPlayer(P, b.dmg, 'beam');
      if (b.candy && !P.c.statusImmune) { P.candy = 3; addText(P.x, P.y - 30, '¡Caramelo!', '#ff8ad8', true); }
      else if (b.candy) addText(P.x, P.y - 30, '¡Anti-Magia!', '#e8e8ff', true);
      if (b.swap !== undefined && !P.c.statusImmune) {   // Ginyu: cambian de lugar
        const g = G.enemies.find(q => q.nid === b.swap && !q.dead);
        if (g) {
          const px = P.x, py = P.y;
          warpPlayer(P, g.x, g.y); g.x = px; g.y = py;
          burst(P.x, P.y, '#c86aff', 16, 4, 3); burst(g.x, g.y, '#c86aff', 16, 4, 3);
          addText(P.x, P.y - 30, '¡Cambio de cuerpo!', '#c86aff', true);
          // Como Goku en el cuerpo de Ginyu: más lento y más débil, y al principio no sabe manejarlo
          P.swapBody = SWAP_BODY_TIME; P.invert = SWAP_INVERT_TIME;
          G.shake = Math.max(G.shake, 0.5);
        }
      }
    }
  }
  G.ebeams = G.ebeams.filter(b => !b.dead);
}
const BOSS_ENRAGE_TIME = 75, BOSS_ENRAGE_SPEED = 1.5, BOSS_ENRAGE_DMG = 1.35;
function bossAI(e, target, k, dt, dx, dy, d) {
  if (!e.enraged && G.t - (e.spawnT || 0) > BOSS_ENRAGE_TIME) {   // drags on too long: the boss stops holding back
    e.enraged = true; e.dmg *= BOSS_ENRAGE_DMG;
    announce('¡{name} se enfurece!', '#ff2d2d', { name: e.def.name });
    G.shake = Math.max(G.shake, 0.7); sfx('power');
  }
  const enrageDt = dt * (e.enraged ? BOSS_ENRAGE_SPEED : 1);
  tickBossCast(e, dt);
  if (e.cast) return;   // cargando su técnica: no hace otra cosa
  const sp = BOSS_SPECIAL[e.id];
  if (sp && !e.tp) {
    e.spCd = (e.spCd ?? sp.first) - enrageDt;
    if (e.spCd <= 0 && d < 520) {
      e.spCd = sp.every;
      e.cd = Math.max(e.cd, 1.2);   // un respiro antes del próximo ataque común
      sp.fn(e, target, Math.atan2(dy, dx));
      if (e.cast) return;
    }
  }
  e.cd -= enrageDt;
  if (e.cd <= 0) {
    const pat = e.def.patterns[e.pi++ % e.def.patterns.length];
    e.cd = e.def.every;
    const ang = Math.atan2(dy, dx);
    if (pat === 'ring') {
      const n = 12 + G.bossIdx * 2;
      for (let i = 0; i < n; i++) enemyShot(e, i / n * Math.PI * 2 + e.pi, 2.8, 7, 1);
    } else if (pat === 'aimed') {
      for (let i = -2; i <= 2; i++) enemyShot(e, ang + i * 0.16, 4.5, 6, 2);
    } else if (pat === 'slam') {
      G.hazards.push({ x: target.x, y: target.y, r: 70, t: 1.1, dur: 1.1, dmg: e.dmg * 1.3 });
    } else if (pat === 'dash') {
      startLunge(e, dx / d, dy / d, DASH_WINDUP, DASH_TIME, DASH_SPEED, e.r * 2.4);
    }
  }
}
// Antes de embestir se planta y marca en el suelo el recorrido, para dar tiempo a esquivarlo
function startLunge(e, ux, uy, windup, time, speed, width) {
  e.windup = windup; e.dashX = ux; e.dashY = uy; e.dashTime = time; e.dashSpeed = speed;
  G.lanes.push({ x: e.x, y: e.y + 10 * e.scale, dx: ux, dy: uy, len: speed * 60 * time, w: width, t: windup, dur: windup });
}
function updateLunge(e, k, dt) {
  if (e.windup > 0) {
    e.windup -= dt;
    if (e.windup <= 0) e.dash = e.dashTime;
  }
  if (e.dash > 0) {
    e.dash -= dt;
    e.x += e.dashX * e.dashSpeed * k; e.y += e.dashY * e.dashSpeed * k;
    if (e.dash <= 0) {
      e.drainDash = false;
      if (e.dashChain > 0) {   // Burter: la siguiente, apuntando de nuevo
        e.dashChain--;
        const P = nearestPlayer(e.x, e.y), dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1;
        startLunge(e, dx / d, dy / d, 0.35, DASH_TIME * 0.8, DASH_SPEED * 1.15, e.r * 2.2);
      }
    }
    if (Math.random() < (e.boss ? 0.5 : 0.15)) G.fx.push({ type: 'spark', x: e.x, y: e.y, vx: 0, vy: 0, t: 0.3, color: '#ffffff', size: e.boss ? 4 : 3 });
  }
}
// Mecánicas de los enemigos comunes (desde el Nivel 2), según su ficha en ENEMIES:
//   spread: disparo en abanico de n · burst: ráfaga de n tiros · lunge: embestida con aviso
//   stomp: pisotón (círculo marcado en el suelo) · ring: anillo de n disparos cada tanto
//   (deathRing, el anillo al morir, está en killEnemy)
const LUNGE = { windup: 0.6, time: 0.35, speed: 6, range: 200, every: [4, 7] };
function enemyTricks(e, P, dt, dx, dy, d) {
  const def = e.def, ang = Math.atan2(dy, dx);
  // Ráfaga en curso: los tiros siguientes salen cada 0,15 s
  if (e.burstLeft > 0 && (e.burstT -= dt) <= 0) { e.burstLeft--; e.burstT = 0.15; enemyShot(e, ang, 4); }
  if (def.lunge && !(e.windup > 0) && !(e.dash > 0)) {
    e.lungeCd = (e.lungeCd ?? rand(...LUNGE.every)) - dt;
    if (e.lungeCd <= 0 && d < LUNGE.range && d > 40) {
      e.lungeCd = rand(...LUNGE.every);
      startLunge(e, dx / d, dy / d, LUNGE.windup, LUNGE.time, LUNGE.speed, e.r * 2);
    }
  }
  if (def.stomp) {
    e.stompCd = (e.stompCd ?? rand(3, 6)) - dt;
    if (e.stompCd <= 0 && d < 240) {
      e.stompCd = rand(5, 8);
      G.hazards.push({ x: P.x, y: P.y, r: def.stomp, t: 1.0, dur: 1.0, dmg: e.dmg * 1.2 });
    }
  }
  if (def.ring) {
    e.ringCd = (e.ringCd ?? rand(2, 5)) - dt;
    if (e.ringCd <= 0 && d < 320) {
      e.ringCd = rand(7, 10);
      for (let i = 0; i < def.ring; i++) enemyShot(e, i / def.ring * Math.PI * 2 + Math.random(), 2.6, 6, 1);
    }
  }
}
// Disparo de los enemigos que disparan: uno solo, en abanico (spread) o en ráfaga (burst)
function enemyFire(e, ang) {
  const def = e.def;
  if (def.spread) for (let i = 0; i < def.spread; i++) enemyShot(e, ang + (i - (def.spread - 1) / 2) * 0.22);
  else enemyShot(e, ang);
  if (def.burst) { e.burstLeft = def.burst - 1; e.burstT = 0.15; }
}
function updateEnemies(k, dt) {
  const farR = Math.hypot(BW, BH), alive = alivePlayers();
  if (!alive.length) return;
  G.pathBudget = 2;   // caminos por los puentes que se pueden buscar en este cuadro
  for (const e of G.enemies) {
    if (e.dead) continue;
    const ox = e.x, oy = e.y;
    const P = nearestPlayer(e.x, e.y);
    const dc = !e.boss && G.decoys.length ? nearDecoy(e) : null, T = dc || P;   // Zanzoken: van hacia la imagen residual
    if (!T) continue;   // no alive, non-hidden target to chase this frame (e.g. everyone just fused/hid at once)
    const dx = T.x - e.x, dy = T.y - e.y, d = Math.hypot(dx, dy) || 1;
    let sp = e.speed;
    const stunned = e.stun > 0;   // Taiyoken: paralizado, no se mueve ni ataca
    if (stunned) e.stun -= dt;
    if (e.shooter && d < 230 && !stunned) {
      sp *= 0.15;
      e.cd -= dt;
      if (e.cd <= 0) { e.cd = rand(3, 4.5); enemyFire(e, Math.atan2(dy, dx)); }
    }
    if (!stunned) {
      if (e.boss) bossAI(e, P, k, dt, dx, dy, d);
      else enemyTricks(e, P, dt, dx, dy, d);
    }
    updateLunge(e, k, dt);
    if (e.windup > 0 || e.cast || stunned) sp = 0;   // quieto mientras avisa la embestida o carga su técnica
    if (e.tp) {   // jefe teletransportándose: se queda quieto y reaparece en la marca
      sp = 0; e.tp.t -= dt;
      if (e.tp.t <= 0) {
        const ringOut = e.tp.ring;
        e.x = e.tp.x; e.y = e.tp.y; e.tp = null; burst(e.x, e.y, '#ffffff', 18, 5, 3); ring(e.x, e.y, 60, 0.4, '#ffffff');
        if (ringOut) for (let i = 0; i < 14; i++) enemyShot(e, i / 14 * Math.PI * 2, 3.2, 7, 1);   // Kid Buu
      }
    }
    // Rumbo: el jugador, el próximo punto del camino por los puentes, o lejos del jugador si se rindió
    let mx = dx, my = dy;
    // Cada cuarto de segundo: ¿te ve (sin nubes en línea recta)? Entonces deja el camino o la huida y va directo.
    // Y si te moviste lejos del final de su camino, lo descarta (si se vuelve a trabar, busca uno nuevo)
    if ((e.path || e.flee) && (e.losT = (e.losT || 0) - dt) <= 0) {
      e.losT = 0.25;
      if (d < 420 && clearLine(e.x, e.y, P.x, P.y, e.scale)) { e.path = null; e.flee = false; }
      else if (e.path) { const end = e.path[e.path.length - 1]; if (!end || Math.hypot(end[0] - P.x, end[1] - P.y) > 150) e.path = null; }
      if (e.flee && (e.fleeT = (e.fleeT || 0) + 0.25) > 4) { e.flee = false; e.fleeT = 0; }   // se rinde solo un rato
    }
    if (e.flee) { mx = -dx; my = -dy; }
    else if (e.path) {
      let w = e.path[e.pi];
      while (w && Math.hypot(w[0] - e.x, w[1] - e.y) < 18) w = e.path[++e.pi];
      e.pathAge += dt;
      if (!w || e.pathAge > 6) e.path = null; else { mx = w[0] - e.x; my = w[1] - e.y; }
    }
    const md = Math.hypot(mx, my) || 1;
    e.x += mx / md * sp * k; e.y += my / md * sp * k;
    pushOutOfSolids(e, 12 * e.scale, e.r * 0.5);
    enemyTerrain(e, ox, oy, dt, sp * k, P);
    e.facing = dx >= 0 ? 1 : -1;
    if (e.flash > 0) e.flash -= dt;
    // Bombardero: al tocar a un guerrero explota y daña a todos los que estén cerca
    if (e.def.kamikaze && alive.some(Q => (Q.x - e.x) ** 2 + (Q.y - e.y) ** 2 < (e.r + Q.r + 4) ** 2)) {
      for (const Q of alive) if ((Q.x - e.x) ** 2 + (Q.y - e.y) ** 2 < 46 ** 2) hurtPlayer(Q, e.dmg);
      burst(e.x, e.y, '#ffa53d', 18, 4, 3);
      playAnim('explosion', e.x, e.y - 6, 1.6);
      sfx('boom', 0.2);
      e.dead = true;
      continue;
    }
    // Guardián escudado: el escudo (ya usado por el jefe Androide 17, ver damageEnemy) sube y baja en
    // ciclos - inmune mientras está arriba, para que golpearlo a destiempo se sienta como un error del
    // jugador y no una pared de vida sin más.
    if (e.def.shieldCycle && !e.boss) {
      e.shieldT = (e.shieldT ?? e.def.shieldCycle.up) - dt;
      if (e.shieldT <= 0) {
        e.shield = e.shield > 0 ? 0 : 1;   // alterna: de escudo arriba a abajo y viceversa
        e.shieldT = e.shield > 0 ? e.def.shieldCycle.up : e.def.shieldCycle.down;
      }
    }
    // Invocador: cada tanto saca un par de secuaces débiles cerca suyo, mientras siga vivo
    if (e.def.summons && !e.boss) {
      e.summonCd = (e.summonCd ?? rand(e.def.summons.every * 0.5, e.def.summons.every)) - dt;
      if (e.summonCd <= 0 && G.enemies.length < 220) {
        e.summonCd = e.def.summons.every;
        for (let i = 0; i < e.def.summons.count; i++) {
          const a = Math.random() * Math.PI * 2;
          spawnEnemy(e.def.summons.type, { pos: { x: e.x + Math.cos(a) * 22, y: e.y + Math.sin(a) * 22 } });
        }
        burst(e.x, e.y, '#b878ff', 10, 3, 2);
      }
    }
    // Apoyo: cura a los enemigos comunes (no jefes) que tenga cerca, cada tanto
    if (e.def.supportHeal && !e.boss) {
      e.supportCd = (e.supportCd ?? e.def.supportHeal.every) - dt;
      if (e.supportCd <= 0) {
        e.supportCd = e.def.supportHeal.every;
        let healed = false;
        for (const o of G.enemies) {
          if (o === e || o.dead || o.boss || (o.x - e.x) ** 2 + (o.y - e.y) ** 2 > e.def.supportHeal.radius ** 2) continue;
          if (o.hp < o.maxHp) { o.hp = Math.min(o.maxHp, o.hp + o.maxHp * e.def.supportHeal.pct); healed = true; }
        }
        if (healed) ring(e.x, e.y, e.def.supportHeal.radius, 0.4, '#6cff7a');
      }
    }
    if (!stunned) for (const Q of alive) if ((Q.x - e.x) ** 2 + (Q.y - e.y) ** 2 < (e.r + Q.r) ** 2) {
      const before = Q.hp;
      hurtPlayer(Q, e.dmg);
      if (e.drainDash && Q.hp < before) {   // Cell Imperfecto: la cola le devuelve vida
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04); e.drainDash = false;
        burst(e.x, e.y, '#6aff8a', 14, 3, 3); addText(e.x, e.y - 40 * e.scale, '¡Absorbido!', '#6aff8a');
      }
    }
    // Los enemigos que quedan muy atrás reaparecen delante
    if (!e.boss && d > farR) { const p = spawnPos(); e.x = p.x; e.y = p.y; e.flee = false; e.path = null; e.air = null; }
  }
  separate();
  G.enemies = G.enemies.filter(e => !e.dead);
}
function separate() {
  const cell = 32, grid = new Map();
  for (const e of G.enemies) {
    const key = Math.floor(e.x / cell) * 100003 + Math.floor(e.y / cell);
    let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(e);
  }
  for (const e of G.enemies) {
    const cx = Math.floor(e.x / cell), cy = Math.floor(e.y / cell);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const b = grid.get((cx + ox) * 100003 + cy + oy);
      if (!b) continue;
      for (const o of b) {
        if (o === e) continue;
        const dx = e.x - o.x, dy = e.y - o.y, min = (e.r + o.r) * 0.8, d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (min - d) * 0.25;
        if (!e.boss) { const ox = e.x, oy = e.y; e.x += dx / d * push; e.y += dy / d * push; keepOnGround(e, ox, oy); }
      }
    }
  }
}
function updateShots(k, dt) {
  const alive = alivePlayers();
  const shields = alive.flatMap(P => orbitPositions(P).filter(o => o.shield));   // Escudo de Ki
  for (const s of G.shots) {
    if (s.home && alive.length) {   // persigue al jugador más cercano, girando de a poco
      const P = nearestPlayer(s.x, s.y), sp = Math.hypot(s.vx, s.vy), a = Math.atan2(s.vy, s.vx);
      let da = Math.atan2(P.y - s.y, P.x - s.x) - a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      const na = a + Math.max(-s.home * dt, Math.min(s.home * dt, da));
      s.vx = Math.cos(na) * sp; s.vy = Math.sin(na) * sp;
    }
    s.x += s.vx * k; s.y += s.vy * k; s.life -= dt;
    if (s.life <= 0) { s.dead = true; continue; }
    if (shields.some(o => (s.x - o.x) ** 2 + (s.y - o.y) ** 2 < (o.r + s.r + 2) ** 2)) {
      s.dead = true; burst(s.x, s.y, '#7dffb0', 5, 2); continue;
    }
    for (const P of alive) {
      if (Math.hypot(s.x - P.x, s.y - P.y) < s.r + P.r - 2) {
        const was = P.inv > 0 || P.immortal > 0;
        hurtPlayer(P, s.dmg); s.dead = true;
        if (s.stone && !was && !P.c.statusImmune) { P.stone = 1.2; addText(P.x, P.y - 30, '¡Petrificado!', '#d8d8d0', true); }   // Dabura
        else if (s.stone && !was) addText(P.x, P.y - 30, '¡Anti-Magia!', '#e8e8ff', true);
        break;
      }
    }
  }
  G.shots = G.shots.filter(s => !s.dead);
  for (const h of G.hazards) {
    h.t -= dt;
    if (h.t <= 0) {
      h.dead = true;
      if (!h.dmg) continue;   // solo una marca (de dónde sale algo): no daña
      let caught = false;
      for (const P of alive) if (Math.hypot(P.x - h.x, P.y - h.y) < h.r) { const b = P.hp; hurtPlayer(P, h.dmg); if (P.hp < b) caught = true; }
      if (h.drain !== undefined && caught) {   // Androide 19 / Dr. Gero: se cura con la energía absorbida
        const g = G.enemies.find(q => q.nid === h.drain && !q.dead);
        if (g) { g.hp = Math.min(g.maxHp, g.hp + g.maxHp * 0.06); burst(g.x, g.y, '#6aff8a', 18, 3, 3); addText(g.x, g.y - 40 * g.scale, '¡Absorbido!', '#6aff8a'); }
      }
      ring(h.x, h.y, h.r, 0.35, '#ff5c3d');
      burst(h.x, h.y, '#ffb35c', 16, 4, 4);
      sfx('boom', 0.1);
    }
  }
  G.hazards = G.hazards.filter(h => !h.dead);
  tickLanes(dt);
}
// Las marcas de embestida siguen visibles (apagándose) mientras el jefe cruza
function tickLanes(dt) {
  for (const l of G.lanes) l.t -= dt;
  G.lanes = G.lanes.filter(l => l.t > -DASH_TIME);
}

// ─── Objetos y experiencia ───────────────────────────────────────────────────
function updatePickups(k) {
  if (!alivePlayers().length) return;
  for (const p of G.pickups) {
    if (p.kind === 'senzu' && !p.pulled && p.born !== undefined && G.t - p.born > SENZU_LIFE) { p.dead = true; continue; }   // se echó a perder sin que nadie la agarrara
    // Las gemas atraídas por la Cápsula de Bulma van hacia quien la recogió, acelerando de a poco
    const owner = p.to !== undefined && G.players.find(o => o.id === p.to && !o.dead && !o.gone && !o.hidden);
    const P = owner || nearestPlayer(p.x, p.y);
    const dx = P.x - p.x, dy = P.y - p.y, d = Math.hypot(dx, dy) || 1;
    if (!p.pulled && d < (p.kind === 'xp' || p.kind === 'money' ? magnetRange(P) : 40)) p.pulled = true;
    if (p.pulled) {   // nunca avanzan más de lo que les falta, para no pasarse de largo
      p.sp = Math.min(owner ? 16 : 14, p.sp + (owner ? 0.18 : 0.5) * k);
      const step = Math.min(p.sp * k, d);
      p.x += dx / d * step; p.y += dy / d * step;
    }
    if (d < P.r + 6) { p.dead = true; collect(p, P); }
  }
  G.pickups = G.pickups.filter(p => !p.dead);
  // Si hay demasiados orbes, se juntan los que están fuera de pantalla con otros del mismo
  // lugar (por celdas de 80 px): la experiencia se conserva y lo que se ve no desaparece
  if (G.pickups.length > 400) {
    const players = alivePlayers();
    const hw = Math.max(BW, 700) / 2 + 60, hh = Math.max(BH, 500) / 2 + 60;   // margen por pantallas más grandes
    const offscreen = p => (p.kind === 'xp' || p.kind === 'money') && !p.pulled && players.every(P => Math.abs(P.x - p.x) > hw || Math.abs(P.y - p.y) > hh);
    const cells = new Map();
    G.pickups = G.pickups.filter(p => {
      if (!offscreen(p)) return true;
      const key = `${Math.floor(p.x / 80)},${Math.floor(p.y / 80)}`, host = cells.get(key);
      if (!host) { cells.set(key, p); return true; }
      host.v += p.v;
      return false;
    });
  }
}
function collect(p, P) {
  if (p.kind === 'xp') { gainXp(p.v * (1 + (P.c.xpBonus || 0) + perk(P, 'xp'))); sfx('pickup', 0.03); }
  else if (p.kind === 'money') { G.money += Math.round(p.v * moneyBonus(P)); sfx('pickup', 0.03); }
  else if (p.kind === 'senzu') {
    const bag = P.passives.senzubag || 0;   // Bolsa de Semillas: cura más y sube la salud máxima
    if (bag) { P.maxHp += 2 * bag; }
    achEvent(P, 'senzu'); healPlayer(P, P.maxHp * (0.5 + 0.1 * bag)); addText(P.x, P.y - 26, 'Semilla del Ermitaño', '#6cff7a', true); sfx('levelup'); }
  else if (p.kind === 'ultimate') {
    const id = ultimateIdFor(P);
    if (id && !P.attacks.some(a => a.id === id)) {
      if (P.attacks.length >= MAX_ATTACKS) {
        const weakest = P.attacks.reduce((a, b) => (a.lvl <= b.lvl ? a : b));
        P.attacks = P.attacks.filter(a => a !== weakest);
      }
      P.attacks.push({ id, lvl: 1, cd: 0.3 });
      addText(P.x, P.y - 26, ATTACKS[id].name, '#ffe14d', true);
      if (P === G.me) announce(`¡{name} aprendida!`.replace('{name}', ATTACKS[id].name), '#ffe14d');
      ring(P.x, P.y, 170, 0.5, '#ffe14d'); burst(P.x, P.y, '#ffe14d', 36, 6, 4); G.shake = Math.max(G.shake, 0.6); sfx('levelup');
    } else { healPlayer(P, P.maxHp * 0.3); addText(P.x, P.y - 26, '+30% HP', '#6cff7a', true); sfx('levelup'); }
  }
  else if (p.kind === 'capsule') {
    // Cápsula de Bulma: todas las gemas de experiencia del mapa vuelan hacia quien la recogió
    for (const g of G.pickups) if (g.kind === 'xp' && !g.dead) { g.pulled = true; g.to = P.id; g.sp = Math.max(g.sp, 0.5); }
    poof(p.x, p.y);
    addText(P.x, P.y - 26, '¡Cápsula de Bulma!', '#8fd8ff', true);
    if (P === G.me) announce('¡Toda la experiencia viene hacia ti!', '#8fd8ff');
    ring(P.x, P.y, 160, 0.5, '#8fd8ff');
    sfx('power');
  }
  else if (p.kind === 'ball') {
    G.dragonBalls++;
    sfx('ball');
    if (G.dragonBalls >= ballsNeeded()) { G.dragonBalls = 0; G.ballsNeeded = baseBalls(); G.pendingWishes++; summonShenlong(); }
    else announce('Esfera del Dragón {n}/{max}', '#ffb81c', { n: G.dragonBalls, max: ballsNeeded() });
  }
}
// Atajos del modo prueba (solo en solitario o como anfitrión, que es quien maneja la partida)
const TEST_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F8', 'F9', 'F10'];
// Interruptores del modo prueba (también son botones en el cartel, para el celular):
//   god: no recibes daño · fast: el tiempo pasa 5 veces más rápido · noSpawn: no aparecen enemigos comunes
//   (los jefes siguen saliendo a su hora; también con F3)
const TEST_TOGGLES = { god: 'testGod', fast: 'testFast', noSpawn: 'testNoSpawn' };
function testToggle(kind) {
  if (!TEST_MODE || !G || !isAuthority()) return;
  const key = TEST_TOGGLES[kind], on = G[key] = !G[key], P = G.me;
  if (kind === 'noSpawn' && on) for (const e of G.enemies) if (!e.boss) e.dead = true;   // se van los que había
  const text = { god: on ? 'Prueba: inmortal' : 'Prueba: sin inmortalidad', fast: on ? 'Prueba: tiempo x5' : 'Prueba: tiempo normal',
    noSpawn: on ? 'Prueba: sin enemigos' : 'Prueba: vuelven los enemigos' }[kind];
  addText(P.x, P.y - 30, text, '#ffd93b', true);
  syncTestButtons();
}
function syncTestButtons() {
  for (const kind of Object.keys(TEST_TOGGLES)) {
    const b = document.querySelector(`[data-test="${kind}"]`);
    if (b) b.classList.toggle('on', !!(G && G[TEST_TOGGLES[kind]]));
  }
}
function testKey(e) {
  if (!TEST_KEYS.includes(e.code)) return false;
  e.preventDefault();   // F1 ayuda, F3 buscar, F5 recargar: no deben hacer lo del navegador
  if (e.code === 'F6' && !e.repeat) { toggleTestPowers(); return true; }
  if (e.repeat || !isAuthority() || G.mode !== 'play') return true;
  const P = G.me;
  if (e.code === 'F1') { gainXp(G.xpNext - G.xp); addText(P.x, P.y - 30, 'Prueba: +1 nivel', '#3dff7a', true); }
  if (e.code === 'F2') { P.ki = 100; addText(P.x, P.y - 30, 'Prueba: Ki al máximo', '#ffd93b', true); }
  if (e.code === 'F3') {
    const b = levelBoss(G.bossIdx);
    if (b) { G.bossIdx++; spawnBoss(b); addText(P.x, P.y - 30, 'Prueba: {name}', '#ff5c5c', true, { name: b.name }); }
    else addText(P.x, P.y - 30, 'Ya aparecieron todos los jefes', '#ffffff', true);
  }
  if (e.code === 'F4') collect({ kind: 'ball' }, P);
  if (e.code === 'F8') testToggle('god');
  if (e.code === 'F9') testToggle('fast');
  if (e.code === 'F10') testToggle('noSpawn');
  if (e.code === 'F5') {
    for (const a of P.attacks) if (!ATTACKS[a.id].evolved) a.lvl = MAX_ATTACK_LEVEL;
    addText(P.x, P.y - 30, 'Prueba: técnicas a nivel 5', '#8fe3ff', true);
  }
  return true;
}
function gainXp(v) {
  v *= 1 + 0.08 * Math.max(0, ...G.players.map(P => P.passives.gravity || 0));   // Entrenamiento en gravedad
  G.xp += v;
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.xpNext = Math.floor(G.xpNext * 1.16 + 5);
    G.pendingLevels++;
  }
  maybeStartRound();
}

// ─── Rondas de elección (subida de nivel y deseos) ───────────────────────────
// La partida se detiene hasta que todos los jugadores conectados eligen.
// ─── Aparición de Shenlong: la partida se detiene unos segundos con la escena y después aparecen los deseos ───
const SUMMON_TIME = 2.4;
const ballsNeeded = () => (G && G.ballsNeeded) || 7;
function summonShenlong() {
  G.mode = 'summon'; G.summonT = SUMMON_TIME; G.shake = 0; G.banner = null;   // sin carteles encima del pedido
  sfx('boss'); sfx('power');
}
// El anfitrión (o el juego en solitario) decide cuándo termina; en online los demás solo la dibujan con su reloj
function tickSummon(dt) {
  if (!G) return;
  if (G.mode !== 'summon') { G.summonT = undefined; return; }
  G.summonT = (G.summonT ?? SUMMON_TIME) - dt;
  // (si quedó una elección abierta, por subir de nivel justo al juntar la séptima esfera, se vuelve a ella pausado)
  if (isAuthority() && G.summonT <= 0) { G.mode = G.round ? 'choice' : 'play'; G.summonT = undefined; maybeStartRound(); }
}
function drawSummon() {
  if (G.mode !== 'summon') return;
  const p = Math.min(1, 1 - (G.summonT ?? SUMMON_TIME) / SUMMON_TIME), now = performance.now() / 1000;
  const V = viewer(), px = (V.x - camX + BW / 2) * SCALE, py = (V.y - camY + BH / 2) * SCALE;
  const fade = Math.min(1, p * 3);
  // El cielo se oscurece como una viñeta: más suave alrededor del guerrero
  const sky = ctx.createRadialGradient(px, py, 40, px, py, Math.hypot(W, H) * 0.7);
  sky.addColorStop(0, `rgba(10, 40, 18, ${0.25 * fade})`); sky.addColorStop(1, `rgba(2, 10, 6, ${0.72 * fade})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';   // las luces se suman: bordes suaves y brillantes
  // Resplandor redondo en la base
  const base = ctx.createRadialGradient(px, py, 4, px, py, 70 + 30 * p);
  base.addColorStop(0, `rgba(200, 255, 190, ${0.55 * fade})`); base.addColorStop(1, 'rgba(60, 200, 90, 0)');
  ctx.fillStyle = base; ctx.beginPath(); ctx.arc(px, py, 70 + 30 * p, 0, Math.PI * 2); ctx.fill();
  // Haz de luz con los bordes difuminados (se va afinando hacia arriba)
  const rise = Math.min(1, p * 1.5), top = py - (py + 60) * rise, bw = 26 + 36 * p;
  const beam = ctx.createLinearGradient(px - bw, 0, px + bw, 0);
  beam.addColorStop(0, 'rgba(90, 255, 120, 0)'); beam.addColorStop(0.5, `rgba(170, 255, 170, ${0.45 * fade})`); beam.addColorStop(1, 'rgba(90, 255, 120, 0)');
  ctx.fillStyle = beam;
  ctx.beginPath(); ctx.moveTo(px - bw, py); ctx.quadraticCurveTo(px - bw * 0.4, (py + top) / 2, px, top);
  ctx.quadraticCurveTo(px + bw * 0.4, (py + top) / 2, px + bw, py); ctx.closePath(); ctx.fill();
  // Cinta de luz serpenteante que sube (el cuerpo de Shenlong): círculos suaves sobre una onda
  const len = 46;
  for (let i = 0; i < len; i++) {
    const f = i / len, y = py - f * (py + 40) * rise;
    if (y < -20) break;
    const x = px + Math.sin(f * 9 - now * 4) * (18 + 40 * f) * Math.min(1, p * 2);
    const r = 13 * (1 - f * 0.6);
    const dot = ctx.createRadialGradient(x, y, 0, x, y, r);
    dot.addColorStop(0, `rgba(220, 255, 210, ${0.5 * fade * (1 - f * 0.5)})`); dot.addColorStop(1, 'rgba(80, 230, 110, 0)');
    ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Chispas que suben
  for (let i = 0; i < 24; i++) {
    const ph = (now * 0.6 + i / 24) % 1, sx = px + Math.sin(i * 7.1 + now) * (40 + 30 * Math.sin(i)), sy = py - ph * 260;
    ctx.fillStyle = `rgba(200, 255, 200, ${(1 - ph) * 0.8 * fade})`;
    ctx.beginPath(); ctx.arc(sx, sy, 1.5 + (i % 3) * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Las siete esferas girando alrededor
  for (let i = 0; i < 7; i++) {
    const a = now * 2.5 + i / 7 * Math.PI * 2, r = 70 - 25 * p;
    drawDragonBall(ctx, px + Math.cos(a) * r, py - 10 + Math.sin(a) * r * 0.45, 7, i + 1, false);
  }
  // El pedido
  if (p > 0.3) {
    ctx.globalAlpha = Math.min(1, (p - 0.3) * 3);
    hudText(t('¡Sal, Shenlong! ¡Concede mis deseos!'), W / 2, H * 0.24, W < 640 ? 18 : 28, '#7dff8a', 'center');
    ctx.globalAlpha = 1;
  }
}
function maybeStartRound() {
  if (G.round || G.mode === 'over' || G.mode === 'summon' || G.victoryAt) return;   // tras el jefe final no hay más elecciones
  const kind = G.pendingWishes > 0 ? 'wish' : G.pendingLevels > 0 ? 'level' : null;
  if (!kind) return;
  G.round = {
    id: ++G.roundSeq, kind, level: G.level - G.pendingLevels + 1,
    waiting: new Set(G.players.filter(p => !p.gone && !p.ally).map(p => p.id)),
  };
  if (kind === 'wish') {
    G.round.offers = {};
    for (const id of G.round.waiting) G.round.offers[id] = wishOffer(G.players.find(p => p.id === id));
  }
  G.mode = 'choice';
  sfx(kind === 'wish' ? 'power' : 'levelup');
}
function applyPick(pid, roundId, choice) {
  const r = G.round;
  if (!r || r.id !== roundId || !r.waiting.has(pid)) return;
  const P = G.players.find(p => p.id === pid);
  if (P) { if (r.kind === 'level') applyOption(P, choice); else applyWish(P, choice); }
  r.waiting.delete(pid);
  if (!r.waiting.size) finishRound();
}
function finishRound() {
  const r = G.round;
  G.round = null;
  if (r.kind === 'level') G.pendingLevels = Math.max(0, G.pendingLevels - 1);
  else G.pendingWishes = Math.max(0, G.pendingWishes - 1);
  if (r.kind === 'level') {   // el poder nuevo se nota: anillo dorado y un temblor chico
    G.shake = Math.max(G.shake, 0.25);
    for (const P of G.players) if (!P.dead && !P.gone) { ring(P.x, P.y, 70, 0.5, '#ffd93b'); burst(P.x, P.y - 8, '#ffe27a', 12, 3, 2); }
  }
  if (r.kind === 'level') for (const P of G.players) {   // Mr. Satán posa, y los enemigos cercanos se quedan mirándolo
    if (!P.c.pose || P.dead || P.gone) continue;
    P.poseT = 1.2;
    for (const e of G.enemies) if (!e.boss && Math.hypot(e.x - P.x, e.y - P.y) < 150) e.stun = Math.max(e.stun || 0, 1);
    addText(P.x, P.y - 34, '¡JA, JA, JA!', '#ffd93b', true);
  }
  G.mode = 'play';
  maybeStartRound();
}
// ¿Esta técnica ya puede evolucionar? (nivel máximo + la mejora de la partida que pide, al menos nivel 1)
function canEvolve(P, a) {
  const evo = EVOLUTION_OF[a.id];
  return !!evo && a.lvl >= MAX_ATTACK_LEVEL && P.passives[ATTACKS[evo].needs] > 0 && canLearn(P.charId, evo);
}
function buildOptions(P) {
  const opts = [];
  for (const a of P.attacks) if (a.lvl < MAX_ATTACK_LEVEL) opts.push({ kind: 'up', id: a.id });
  if (P.attacks.length < MAX_ATTACKS) {
    for (const id in ATTACKS) {
      if (ATTACKS[id].evolved || !canLearn(P.charId, id)) continue;
      if (ATTACKS[id].ultimate) continue;   // las técnicas definitivas solo se obtienen con la Esfera definitiva (objeto raro)
      if (ATTACKS[id].reward && !(SAVE.rewards || {})[ATTACKS[id].reward]) continue;   // premios (el Kaioken: Camino de la Serpiente)
      if (!P.attacks.some(a => a.id === id || a.id === EVOLUTION_OF[id])) opts.push({ kind: 'new', id });
    }
  }
  // Mejoras: subir las que ya tienes, o sumar una nueva si queda casilla libre (mismo tope que las técnicas)
  const ownedPassives = Object.keys(PASSIVES).filter(id => P.passives[id] > 0).length;
  for (const id in PASSIVES) {
    if (P.passives[id] >= passiveMax(id) || (P.c.noPassives || []).includes(id)) continue;
    if (P.passives[id] > 0 || ownedPassives < MAX_PASSIVES) opts.push({ kind: 'passive', id });
  }
  // Las evoluciones disponibles siempre aparecen (primero); el resto se completa al azar
  const evolves = P.attacks.filter(a => canEvolve(P, a)).map(a => ({ kind: 'evolve', id: a.id }));
  const chosen = [...evolves, ...shuffle(opts)].slice(0, 3);
  if (!chosen.length) chosen.push({ kind: 'heal' }, { kind: 'zeni' });
  return chosen;
}
// Estadísticas de las técnicas que se muestran en las cartas: [nombre, unidad, decimales]
const STAT_INFO = {
  dmg: [t('Daño'), '', 0], cd: [t('Recarga'), ' s', 1], count: [t('Cantidad'), '', 0], len: [t('Alcance'), '', 0],
  width: [t('Ancho'), '', 0], dur: [t('Duración'), ' s', 2], r: [t('Tamaño'), '', 0], pierce: [t('Atraviesa'), '', 0],
  life: [t('Duración'), ' s', 1], radius: [t('Radio'), '', 0], spin: [t('Velocidad de giro'), '', 1], explode: [t('Radio de explosión'), '', 0],
  bounce: [t('Rebotes'), '', 0], heal: [t('Curación'), '', 0], stun: [t('Parálisis'), ' s', 1], taunt: [t('Atracción'), '', 0],
  boost: [t('Poder extra'), '', 0], cost: [t('Costo de vida'), '%', 0],
  legend: [t('Golpe legendario'), '', 1], trip: [t('Probabilidad de tropezar'), '', 0], boss: [t('Daño a los jefes (legendario)'), '', 0],
};
function fmtStat(k, v) {
  if (k === 'boost') return `+${Math.round(v * 100)}%`;   // Kaioken
  if (k === 'legend') return `${+(v * 100).toFixed(1)}%`;   // Mr. Satán
  if (k === 'trip') return `${Math.round(v * 100)}%`;
  if (k === 'boss') return `${Math.round(v * 100)}% ${t('de su vida')}`;
  if (k === 'pierce') return v >= 99 ? t('a todos') : v ? tn(v, '{n} enemigo', '{n} enemigos') : t('no');
  const [, unit, dec] = STAT_INFO[k];
  return (dec ? String(+v.toFixed(dec)) : String(Math.round(v))) + unit;
}
// Qué cambia al subir una técnica de nivel (o sus valores iniciales si es nueva)
function attackStatLines(id, lvl) {
  const def = ATTACKS[id];
  if (!lvl) {
    const s = def.stats(1);
    return ['dmg', 'cd', 'count'].filter(k => s[k] !== undefined && !(k === 'count' && s[k] < 2))
      .map(k => `${STAT_INFO[k][0]}: ${fmtStat(k, s[k])}`);
  }
  return statDiff(def.stats(lvl), def.stats(lvl + 1));
}
function statDiff(a, b) {
  return Object.keys(STAT_INFO).filter(k => (a[k] !== undefined || b[k] !== undefined) && fmtStat(k, a[k] || 0) !== fmtStat(k, b[k] || 0))
    .map(k => `${STAT_INFO[k][0]}: ${fmtStat(k, a[k] || 0)} → ${fmtStat(k, b[k] || 0)}`);
}
// Pista de evolución para las cartas: qué falta para evolucionar una técnica o para qué sirve una mejora
// ★ COMBO: la carta sirve para evolucionar algo que ya tienes (la mejora que le falta a tu técnica, o subir una
// técnica cuya mejora ya tienes). Aviso: tomar esta mejora llena tu última casilla y alguna técnica ya no podría evolucionar.
function cardCombo(P, o) {
  if (o.kind === 'passive' && !P.passives[o.id]) {
    const a = P.attacks.find(x => EVOLUTION_OF[x.id] && ATTACKS[EVOLUTION_OF[x.id]].needs === o.id && canLearn(P.charId, EVOLUTION_OF[x.id]));
    if (a) return { combo: t('Combina con tu {name}: con esta mejora puede evolucionar', { name: ATTACKS[a.id].name }) };
    const used = Object.keys(PASSIVES).filter(k => P.passives[k] > 0).length;
    if (used === MAX_PASSIVES - 1) {   // última casilla: ¿deja afuera la mejora que alguna técnica necesita?
      const stuck = P.attacks.find(x => { const e = EVOLUTION_OF[x.id]; return e && canLearn(P.charId, e) && !P.passives[ATTACKS[e].needs]; });
      if (stuck) return { warn: t('Es tu última casilla de mejoras: tu {name} ya no podría evolucionar (necesita {need})', { name: ATTACKS[stuck.id].name, need: PASSIVES[ATTACKS[EVOLUTION_OF[stuck.id]].needs].name }) };
    }
  }
  if (o.kind === 'up' || o.kind === 'new') {
    const e = EVOLUTION_OF[o.id];
    if (e && canLearn(P.charId, e) && P.passives[ATTACKS[e].needs] > 0) return { combo: t('Ya tienes {need}: a nivel {max} evoluciona en {evo}', { need: PASSIVES[ATTACKS[e].needs].name, max: MAX_ATTACK_LEVEL, evo: ATTACKS[e].name }) };
  }
  return {};
}
function evolveHint(P, o) {
  if (o.kind === 'up' || o.kind === 'new') {
    const evo = EVOLUTION_OF[o.id];
    return evo ? t('★ Evoluciona en {evo} con {need} (técnica a nivel {max})', { evo: ATTACKS[evo].name, need: PASSIVES[ATTACKS[evo].needs].name, max: MAX_ATTACK_LEVEL }) : '';
  }
  if (o.kind === 'passive' && !P.passives[o.id]) {
    const a = P.attacks.find(x => EVOLUTION_OF[x.id] && ATTACKS[EVOLUTION_OF[x.id]].needs === o.id);
    return a ? t('★ Necesaria para evolucionar tu {name}', { name: ATTACKS[a.id].name }) : '';
  }
  return '';
}
function passiveStatLines(P, id) {
  const l = P.passives[id], n = l + 1;
  switch (id) {
    case 'power': return [`${t('Daño')}: +${12 * l}% → +${12 * n}%`];
    case 'speed': return [`${t('Velocidad')}: +${8 * l}% → +${8 * n}%`];
    case 'vital': return [`${t('Salud máxima')}: ${P.maxHp} → ${P.maxHp + 20}`];
    case 'focus': return [`${t('Recarga')}: -${8 * l}% → -${8 * n}%`];
    case 'sense': { const m = 1 + perk(P, 'magnet'); return [`${t('Radio de atracción')}: ${Math.round((55 + 28 * l) * m)} → ${Math.round((55 + 28 * n) * m)}`]; }
    case 'armor': return [`${t('Daño recibido por golpe')}: ${l ? -l : 0} → -${n}`];
    case 'crit': return [`${t('Probabilidad de crítico')}: ${8 + 4 * l}% → ${8 + 4 * n}%`];
    case 'kictl': return [`${t('Carga del Ki')}: +${15 * l}% → +${15 * n}%`];
    case 'absorb': return [`${t('Probabilidad de curarte al derrotar')}: ${3 * l}% → ${3 * n}%`];
    case 'area': return [`${t('Tamaño y área')}: +${8 * l}% → +${8 * n}%`];
    case 'multi': return [`${t('Proyectiles extra')}: +${multiExtra(l)} → +${multiExtra(n)}`];
    case 'luck': return [`${t('Semillas y cápsulas')}: +${luckPct(l)}% → +${luckPct(n)}%`, `${t('Zeni al terminar')}: +${luckPct(l)}% → +${luckPct(n)}%`];
    case 'gravity': return [`${t('Experiencia')}: +${8 * l}% → +${8 * n}%`];
    case 'instinct': return [`${t('Probabilidad de esquivar')}: ${3 * l}% → ${3 * n}%`];
    case 'regen': return [`${t('Regeneración')}: ${(0.25 * l).toFixed(2)}/s → ${(0.25 * n).toFixed(2)}/s`];
    case 'aura': return [`${t('Daño por toque')}: ${4 * l} → ${4 * n} ${t('cada 0,5 s')}`];
    case 'tracker': return [`${t('Daño a jefes y élite')}: +${10 * l}% → +${10 * n}%`];
    case 'sustain': return [`${t('Duración')}: +${10 * l}% → +${10 * n}%`];
    case 'meditate': return [`${t('Curación quieto')}: ${(0.6 * l).toFixed(1)}/s → ${(0.6 * n).toFixed(1)}/s`, `${t('Ki quieto')}: +${l}/s → +${n}/s`];
    case 'fury': return [`${t('Daño extra con poca salud')}: +${5 * l}% → +${5 * n}%`];
    case 'senzubag': return [`${t('Curación de las semillas')}: ${50 + 10 * l}% → ${50 + 10 * n}%`, `${t('Salud máxima por semilla')}: +${2 * l} → +${2 * n}`];
  }
  return [];
}
function optionCard(P, o) {
  if (o.kind === 'evolve') {
    const base = ATTACKS[o.id], evo = ATTACKS[EVOLUTION_OF[o.id]];
    return { color: evo.color, name: evo.name, tag: t('★ ¡EVOLUCIÓN! ({name})', { name: base.name }), desc: evo.desc,
      stats: statDiff(base.stats(MAX_ATTACK_LEVEL), evo.stats()), evolve: true, icon: ['atk', EVOLUTION_OF[o.id]] };
  }
  if (o.kind === 'up' || o.kind === 'new') {
    const def = ATTACKS[o.id], a = P.attacks.find(x => x.id === o.id);
    const cb = cardCombo(P, o);
    return { color: def.color, name: def.name, tag: a ? t('Nivel {a} → {b}', { a: a.lvl, b: a.lvl + 1 }) : t('¡Nueva técnica!'), desc: def.desc,
      stats: attackStatLines(o.id, a ? a.lvl : 0), hint: cb.combo ? '' : evolveHint(P, o), combo: cb.combo, icon: ['atk', o.id] };
  }
  if (o.kind === 'passive') {
    const def = PASSIVES[o.id], l = P.passives[o.id];
    const cb = cardCombo(P, o);
    return { color: def.color, name: def.name, tag: t('Nivel {a} → {b}', { a: l, b: l + 1 }), desc: def.desc, stats: passiveStatLines(P, o.id),
      hint: cb.combo || cb.warn ? '' : evolveHint(P, o), combo: cb.combo, warn: cb.warn, icon: ['pas', o.id] };
  }
  if (o.kind === 'heal') return { color: '#6cff7a', name: t('Semilla del Ermitaño'), tag: t('Curación'), desc: t('Recuperas toda tu salud.') };
  return { color: '#ffe27a', name: t('Bolsa de Zeni'), tag: '+50 Zeni', desc: t('Dinero para el futuro.') };
}
// Valida la opción (puede venir de la red) y la aplica al jugador
function applyOption(P, o) {
  if (!o) return;
  if (o.kind === 'up') {
    const a = P.attacks.find(x => x.id === o.id);
    if (a && a.lvl < MAX_ATTACK_LEVEL) a.lvl++;
  } else if (o.kind === 'evolve') {
    const a = P.attacks.find(x => x.id === o.id);
    if (a && canEvolve(P, a)) {
      const evo = ATTACKS[EVOLUTION_OF[a.id]];
      a.id = EVOLUTION_OF[a.id]; a.lvl = MAX_ATTACK_LEVEL; a.cd = 0.3;
      addText(P.x, P.y - 34, '¡{name}!', evo.color, true, { name: evo.name });
      if (P === G.me) announce('¡{name} evolucionó a {evo}!', '#ffd93b', { name: ATTACKS[o.id].name, evo: evo.name });
      sfx('power');
    }
  } else if (o.kind === 'new') {
    if (ATTACKS[o.id] && canLearn(P.charId, o.id) && P.attacks.length < MAX_ATTACKS && !P.attacks.some(a => a.id === o.id)) P.attacks.push({ id: o.id, lvl: 1, cd: 0.3 });
  } else if (o.kind === 'passive') {
    const slotFree = P.passives[o.id] > 0 || Object.keys(PASSIVES).filter(id => P.passives[id] > 0).length < MAX_PASSIVES;
    if (PASSIVES[o.id] && P.passives[o.id] < passiveMax(o.id) && slotFree) {
      P.passives[o.id]++;
      if (o.id === 'vital') { P.maxHp += 20; healPlayer(P, 20); }
    }
  } else if (o.kind === 'heal') healPlayer(P, P.maxHp);
  else if (o.kind === 'zeni') P.bonusZeni += 50;
}
// En solitario, Goku y Vegeta pueden pedir la fusión con el otro Saiyajin
const FUSION_WISH = { id: 'fusion', name: t('Fusión'), desc: t('Llega tu rival Saiyajin y os fusionáis en Gogeta durante 40 segundos.') };
// Los deseos que ve un jugador: 3 al azar de la lista y el cuarto fijo (Fusión si puede fusionarse, si no Ki infinito)
const canWishFusion = P => !G.net && !G.localCoop && !!FUSION_PAIR[P.charId] && !G.fusion && !rule('notrans');
// Volver del Otro Mundo: lo ofrece siempre (en lugar de uno de los 3 al azar) si ya usaste la Semilla de reserva
// (hasta OTHERWORLD_MAX veces por partida: P.owUses cuenta cuántas)
const OTHERWORLD_MAX = 3;
const canWishOtherworld = P => !!P && P.halo && !(P.senzuLeft > 0) && perk(P, 'senzu') > 0 && (P.owUses || 0) < OTHERWORLD_MAX;
// Despertar el poder oculto (2.24.0): la técnica de mayor nivel que tiene evolución y todavía no puede evolucionar
// sola (le falta el nivel máximo o la mejora que pide) evoluciona al instante. Sale en la mitad de las apariciones
const AWAKEN_CHANCE = 0.5;
function awakenTarget(P) {
  if (!P) return null;
  const list = P.attacks.filter(a => EVOLUTION_OF[a.id] && canLearn(P.charId, EVOLUTION_OF[a.id]) && !canEvolve(P, a));
  return list.sort((a, b) => b.lvl - a.lvl)[0] || null;
}
function wishOffer(P) {
  const pool = shuffle(WISH_POOL.map(w => w.id)), back = canWishOtherworld(P) ? ['otherworld'] : [];
  if (awakenTarget(P) && Math.random() < AWAKEN_CHANCE) back.push('awaken');
  if (rule('notrans')) return [...back, ...pool.slice(0, WISH_OFFER + 1 - back.length)];   // sin transformación: el cuarto también sale de la lista
  return [...back, ...pool.slice(0, WISH_OFFER - back.length), P && canWishFusion(P) ? 'fusion' : 'ki'];
}
const wishById = id => id === 'fusion' ? FUSION_WISH : WISHES.find(w => w.id === id);
function wishList(P) {
  const ids = (G.round && G.round.offers && G.round.offers[P.id]) || [];
  return ids.map(wishById).filter(Boolean);
}
const ZENKAI = 0.2;   // Semilla de reserva: +20% de daño y de vida máxima al revivir
const WISH_STRONG = 0.25, WISH_IMMORTAL = 10, WISH_RICHES = 300, WISH_CHAMBER = 3, WISH_KI_TIME = 60, ATTRACT_BALLS = 5;
function applyWish(P, i) {
  const w = wishList(P)[i];
  if (!w) return;
  if (!w.extra && w.id !== 'fusion') achEvent(P, 'wish:' + w.id);   // logro «Todos los deseos»
  if (w.id === 'heal') { P.maxHp += 50; healPlayer(P, P.maxHp); }
  if (w.id === 'strong') P.wishDmg = (P.wishDmg || 0) + WISH_STRONG;
  if (w.id === 'chamber') {   // los niveles son del grupo: se suman a las elecciones pendientes
    for (let n = 0; n < WISH_CHAMBER; n++) { G.level++; G.xpNext = Math.floor(G.xpNext * 1.16 + 5); G.pendingLevels++; }
  }
  if (w.id === 'immortal') { P.immortal = WISH_IMMORTAL; ring(P.x, P.y, 90, 0.6, '#ffe27a'); }
  if (w.id === 'vanish') {   // los jefes se quedan; el Cíborg no suelta su anillo
    for (const e of G.enemies) if (!e.boss && !e.dead) { e.vanish = true; killEnemy(e, P); }
    G.shake = Math.max(G.shake, 0.5);
    sfx('boom');
  }
  if (w.id === 'riches') { P.bonusZeni += WISH_RICHES; P.wishZeni = (P.wishZeni || 0) + WISH_RICHES; }
  if (w.id === 'attract') G.ballsNeeded = Math.min(ATTRACT_BALLS, baseBalls());
  if (w.id === 'ki') { P.ki = 100; P.transformed = 0; doTransform(P, WISH_KI_TIME, true); }
  if (w.id === 'awaken') {
    const a = awakenTarget(P);
    if (a) {
      const from = a.id, evo = ATTACKS[EVOLUTION_OF[from]];
      a.id = EVOLUTION_OF[from]; a.lvl = MAX_ATTACK_LEVEL; a.cd = 0.3;
      burst(P.x, P.y - 10, evo.color, 24, 4, 3); ring(P.x, P.y, 90, 0.6, '#ffd93b');
      addText(P.x, P.y - 34, '¡{name}!', evo.color, true, { name: evo.name });
      if (P === G.me) announce('¡{name} evolucionó a {evo}!', '#ffd93b', { name: ATTACKS[from].name, evo: evo.name });
      sfx('power');
    }
  }
  if (w.id === 'otherworld') {   // de vuelta del Otro Mundo: la semilla otra vez, sin la aureola (ni el +20% de daño)
    P.senzuLeft = 1; P.halo = false; P.owUses = (P.owUses || 0) + 1;
    burst(P.x, P.y - 10, '#ffe14d', 24, 4, 3); ring(P.x, P.y, 80, 0.6, '#6cff7a');
    addText(P.x, P.y - 34, '¡De vuelta del Otro Mundo!', '#ffe14d', true);
  }
  if (w.id === 'fusion' && !G.fusion) {
    // 2.15.1: cada aliado con su propio id y sin los que ya se retiraron. Antes todos eran el 99: en la segunda
    // fusión se encontraba al aliado viejo (retirado), la fusión se cortaba al instante y el nuevo quedaba quieto
    G.players = G.players.filter(Q => !(Q.ally && Q.gone));
    G.allyN = (G.allyN || 0) + 1;
    const ally = makePlayer(98 + G.allyN, CHARACTERS[FUSION_PAIR[P.charId]].name, FUSION_PAIR[P.charId], {});
    ally.ally = true;
    // El aliado llega a tu altura: su técnica propia a tu mejor nivel, tus mejoras y tu vida máxima,
    // así Gogeta mezcla las técnicas y el poder de los dos
    ally.attacks[0].lvl = Math.max(...P.attacks.map(a => a.lvl));
    ally.passives = { ...P.passives };
    ally.maxHp = ally.hp = P.maxHp;
    ally.x = P.x + 34; ally.y = P.y;
    G.players.push(ally);
    burst(ally.x, ally.y, ally.c.aura, 20, 5, 3);
    startFusion(P, ally, FUSION_TIME_WISH, P.id);
  }
}

// Interfaz de la ronda: cada jugador ve sus propias opciones
let shownRound = '';
const choicePlayer = () => G && G.localCoop && G.round
  ? (G.players.find(P => G.round.waiting.has(P.id)) || G.me)
  : G.me;
function syncChoiceUI() {
  const r = G.round;
  if (!r) { if (shownRound) { $('levelup').classList.add('hidden'); shownRound = ''; } return; }
  const P = choicePlayer(), shownKey = `${r.id}:${P.id}`;
  if (shownRound === shownKey) return;
  shownRound = shownKey;
  if (!r.waiting.has(P.id)) { showWaiting(); return; }
  if (r.kind === 'level') showLevelChoices(r, P);
  else {
    const title = G.localCoop ? `${P.name}: ${t('¡Shenlong ha aparecido! Pide un deseo')}` : t('¡Shenlong ha aparecido! Pide un deseo');
    showChoices(title,
      wishList(P).map(w => {
        const card = { color: w.id === 'fusion' || w.extra ? '#ffe14d' : '#3dff7a', name: w.name, tag: t('Deseo'), desc: w.desc };
        if (w.id === 'awaken') {   // qué técnica evoluciona y en qué
          const a = awakenTarget(P);
          if (a) card.desc = t('{name} evoluciona al instante a {evo}, aunque no tenga el nivel máximo ni la mejora que pide.', { name: ATTACKS[a.id].name, evo: ATTACKS[EVOLUTION_OF[a.id]].name });
        }
        if (w.id === 'otherworld') {   // cuántas veces ya te revivió Shenlong en esta partida (hasta 3)
          const n = P.owUses || 0;
          card.tag = t('Deseo · {n}/{max}', { n, max: OTHERWORLD_MAX });
          if (n === OTHERWORLD_MAX - 1) card.warn = t('Es la última vez que Shenlong podrá revivirte');
        }
        return card;
      }), i => pickChoice(r.id, i));
  }
}
// Cartas de subida de nivel, con el botón de volver a sortear si te quedan sorteos (Visión de Kaio-sama)
function showLevelChoices(r, P = choicePlayer()) {
  const opts = buildOptions(P);
  const title = t('¡Nivel {n}! Tu poder aumenta', { n: r.level });
  showChoices(G.localCoop ? `${P.name}: ${title}` : title, opts.map(o => optionCard(P, o)), i => pickChoice(r.id, opts[i]));
  if (typeof renderCombos === 'function') renderCombos($('comboLvl'));   // cuadro de combinaciones (js/combos.js)
  buildHudTips();   // pasando el mouse por tus técnicas y mejoras (arriba a la izquierda) se ve qué hacen
  if (P.rerolls > 0) {
    const b = document.createElement('button');
    b.id = 'rerollBtn'; b.className = 'btn ghost reroll-btn';
    b.textContent = t('🎲 Sortear de nuevo ({n}) · R', { n: P.rerolls });
    b.onclick = () => rerollChoices();
    $('levelup').appendChild(b);
  }
}
function rerollChoices() {
  const r = G && G.round;
  const P = choicePlayer();
  if (!r || r.kind !== 'level' || !(P.rerolls > 0) || $('levelup').classList.contains('hidden') || !$('rerollBtn')) return;
  P.rerolls--;
  SFX.play('pickup');
  showLevelChoices(r, P);
}
function pickChoice(roundId, choice) {
  clearHudTips(); hideTip();
  const P = choicePlayer();
  if (G.net) showWaiting(); else $('levelup').classList.add('hidden');
  if (isAuthority()) applyPick(P.id, roundId, choice);
  else Net.send({ t: 'pick', r: roundId, c: choice });
  if (G && G.localCoop) syncChoiceUI();
}
function showWaiting() {
  $('levelupTitle').textContent = t('Esperando a los demás guerreros...');
  $('choices').innerHTML = '';
  $('levelup').classList.remove('hidden');
}
function showChoices(title, cards, onPick) {
  const rb = $('rerollBtn'); if (rb) rb.remove();
  $('comboLvl').innerHTML = '';   // (solo al subir de nivel: ver showLevelChoices)
  $('levelupTitle').textContent = title;
  const box = $('choices');
  box.innerHTML = '';
  cards.forEach((c, i) => {
    const el = document.createElement('button');
    el.className = c.evolve ? 'choice evolve' : c.combo ? 'choice combo' : 'choice';
    el.innerHTML = (c.combo ? `<div class="combo-ribbon">${t('★ COMBO')}</div>` : '')
      + `<div class="head">${c.icon ? '<canvas class="icon icon-cv" width="40" height="40"></canvas>' : `<div class="icon" style="background:radial-gradient(circle at 35% 35%,#fff,${c.color} 45%,${c.color}88);color:${c.color}"></div>`}
      <div><div class="name"></div><div class="tag"></div></div></div><div class="desc"></div>`;
    if (c.icon) {   // el mismo ícono que en el HUD
      const cv = el.querySelector('canvas'), x = cv.getContext('2d');
      if (c.icon[0] === 'atk') drawAttackIcon(c.icon[1], 4, 4, 32, x); else drawPassiveIcon(c.icon[1], 4, 4, 32, x);
    }
    el.querySelector('.name').textContent = `${i + 1}. ${c.name}`;
    el.querySelector('.tag').textContent = c.tag;
    el.querySelector('.desc').textContent = c.desc;
    if (c.stats && c.stats.length) {
      const ul = document.createElement('ul');
      ul.className = 'stats';
      for (const line of c.stats) { const li = document.createElement('li'); li.textContent = line; ul.appendChild(li); }
      el.appendChild(ul);
    }
    for (const [k, cls] of [['combo', 'combo-hint'], ['warn', 'warn-hint'], ['hint', 'evo-hint']]) {
      if (!c[k]) continue;
      const hint = document.createElement('div');
      hint.className = cls;
      hint.textContent = (k === 'combo' ? '★ ' : k === 'warn' ? '⚠ ' : '') + c[k];
      el.appendChild(hint);
    }
    el.onclick = () => onPick(i);
    box.appendChild(el);
  });
  $('levelup').classList.remove('hidden');
}

// ─── Pausa y fin de partida ──────────────────────────────────────────────────
function togglePause() {
  if (!G || G.mode === 'over') return;
  hideTip(); clearHudTips();
  if (G.net) { // online la partida no se detiene: solo se muestra el menú
    G.menuOpen = !G.menuOpen;
    $('pause').classList.toggle('hidden', !G.menuOpen);
    if (G.menuOpen) { renderPause(); syncPauseOptions(); }
    return;
  }
  if (G.mode === 'play') { G.mode = 'pause'; $('pause').classList.remove('hidden'); renderPause(); syncPauseOptions(); resetRestartBtn(); }
  else if (G.mode === 'pause') { G.mode = 'play'; $('pause').classList.add('hidden'); }
}

// Opciones de la pausa: se cargan al abrirla (no en cada refresco online, para no pisar el deslizador)
function syncPauseOptions() {
  const vm = Math.round(AudioVolume.music * 100), vs = Math.round(AudioVolume.sfx * 100);
  $('volMusic').value = vm; $('volMusicVal').textContent = `${vm}%`;
  $('volSfx').value = vs; $('volSfxVal').textContent = `${vs}%`;
  const fp = Math.round(SAVE.fx.particles * 100), fsh = Math.round(SAVE.fx.shake * 100), ff = Math.round(SAVE.fx.flash * 100);
  $('fxParticles').value = fp; $('fxParticlesVal').textContent = `${fp}%`;
  $('fxShake').value = fsh; $('fxShakeVal').textContent = `${fsh}%`;
  $('fxFlash').value = ff; $('fxFlashVal').textContent = `${ff}%`;
  $('fxDmgNumbers').checked = SAVE.fx.dmgNumbers;
  $('fxAbilityNames').checked = SAVE.fx.abilityNames;
}
$('volMusic').oninput = e => {
  const v = +e.target.value; $('volMusicVal').textContent = `${v}%`;
  Music.setVolume(v / 100);
  if (v > 0 && !Music.enabled) toggleMusic();   // subir el volumen vuelve a activar la música
};
$('volSfx').oninput = e => {
  const v = +e.target.value; $('volSfxVal').textContent = `${v}%`;
  SFX.setVolume(v / 100);
  if (v > 0 && !SFX.enabled) toggleSfx();
};
// Accesibilidad: puramente visual y local a este jugador (ver localBurst, drawVignette, drawBlind, drawTexts) -
// nunca cambia lo que la partida realmente hace ni lo que ven los demás jugadores.
$('fxParticles').oninput = e => { const v = +e.target.value; $('fxParticlesVal').textContent = `${v}%`; SAVE.fx.particles = v / 100; writeSave(); };
$('fxShake').oninput = e => { const v = +e.target.value; $('fxShakeVal').textContent = `${v}%`; SAVE.fx.shake = v / 100; writeSave(); };
$('fxFlash').oninput = e => { const v = +e.target.value; $('fxFlashVal').textContent = `${v}%`; SAVE.fx.flash = v / 100; writeSave(); };
$('fxDmgNumbers').onchange = e => { SAVE.fx.dmgNumbers = e.target.checked; writeSave(); };
$('fxAbilityNames').onchange = e => { SAVE.fx.abilityNames = e.target.checked; writeSave(); };

// ─── Pantalla de pausa: estadísticas y mapa ─────────────────────────────────
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const fmtNum = n => Math.round(n).toLocaleString(LANG === 'en' ? 'en-US' : 'es-AR');
function techName(aid, P) {
  if (aid === 'ki') return t('Estallido ({form})', { form: P.c.transform });
  if (aid === 'bigbang') return 'Big Bang Kamehameha';
  if (PASSIVES[aid]) return PASSIVES[aid].name;   // Aura de combate
  return ATTACKS[aid] ? ATTACKS[aid].name : aid;
}
// ─── Descripciones al pasar el mouse (pausa) ───────────────────────────────────
// La primera línea es el título; el resto, qué hace y cuánto rinde ahora
function attackTip(P, id) {
  if (id === 'ki') return t('Estallido de {form}', { form: P.c.transform }) + '\n' + t('La onda de energía que liberas al transformarte.');
  if (id === 'bigbang') return 'Big Bang Kamehameha\n' + t('El rayo de Gogeta: lo lanza quien controla las técnicas, hacia donde apunta, cada {n} segundos.', { n: BIGBANG_CD });
  const d = ATTACKS[id];
  if (!d) return id;
  const a = P.attacks.find(x => x.id === id);
  const head = d.name + (d.evolved ? ' · ' + t('Evolucionada ★') : a ? ' · ' + t('Nivel {a}/{max}', { a: a.lvl, max: MAX_ATTACK_LEVEL }) : '');
  const s = d.stats(a ? a.lvl : MAX_ATTACK_LEVEL);
  const stats = Object.keys(STAT_INFO).filter(k => s[k] !== undefined).map(k => `${STAT_INFO[k][0]}: ${fmtStat(k, s[k])}`).join(' · ');
  const lines = [head, d.desc, stats];
  const evo = EVOLUTION_OF[id];
  if (evo && canLearn(P.charId, evo)) {
    const e = ATTACKS[evo], has = P.passives[e.needs] > 0;
    lines.push(t(has ? '★ Evoluciona en {evo} con {need} (ya la tienes) y la técnica a nivel {max}.' : '★ Evoluciona en {evo} con {need} (te falta) y la técnica a nivel {max}.',
      { evo: e.name, need: PASSIVES[e.needs].name, max: MAX_ATTACK_LEVEL }));
  } else if (d.evolved) lines.push(t('Evolución de {name}.', { name: ATTACKS[d.from].name }));
  return lines.join('\n');
}
function passiveTip(P, id) {
  const d = PASSIVES[id], l = P.passives[id];
  const now = {
    power: t('+{n}% de daño', { n: 12 * l }), speed: t('+{n}% de velocidad', { n: 8 * l }), vital: t('+{n} de salud máxima', { n: 20 * l }),
    focus: t('-{n}% de recarga', { n: 8 * l }), sense: `${t('Radio de atracción')}: ${Math.round(magnetRange(P))}`, armor: t('-{n} de daño por golpe recibido', { n: l }),
    crit: t('{n}% de probabilidad de crítico', { n: 8 + 4 * l }), kictl: t('El Ki se carga un {n}% más rápido', { n: 15 * l }),
    absorb: t('{n}% de probabilidad de curarte al derrotar', { n: 3 * l }), area: t('+{n}% de tamaño y área', { n: 8 * l }),
    multi: t('+{n} proyectil en las técnicas que disparan varios', { n: multiExtra(l) }),
    luck: t('+{a}% de semillas y cápsulas, +{b}% de Zeni', { a: luckPct(l), b: luckPct(l) }),
    gravity: t('+{n}% de experiencia', { n: 8 * l }), instinct: t('{n}% de probabilidad de esquivar', { n: 3 * l }),
    regen: t('Recuperas {n} de salud por segundo', { n: (0.25 * l).toFixed(2) }), aura: t('{n} de daño cada medio segundo a los enemigos pegados', { n: 4 * l }),
    tracker: t('+{n}% de daño a jefes y élite', { n: 10 * l }), sustain: t('+{n}% de duración', { n: 10 * l }),
    meditate: t('Quieto: {a} de salud y {b} de Ki por segundo', { a: (0.6 * l).toFixed(1), b: l }),
    fury: t('Ahora +{n}% de daño (hasta +{max}%)', { n: Math.round(furyBonus(P) * 100), max: 5 * l }),
    senzubag: t('Las semillas curan el {a}% y suben {b} de salud máxima', { a: 50 + 10 * l, b: 2 * l }),
  }[id];
  const lines = [`${d.name} · ${t('Nivel {a}/{max}', { a: l, max: passiveMax(id) })}`, d.desc, `${t('Ahora')}: ${now}`];
  const evolves = P.attacks.filter(a => EVOLUTION_OF[a.id] && ATTACKS[EVOLUTION_OF[a.id]].needs === id && canLearn(P.charId, EVOLUTION_OF[a.id]));
  for (const a of evolves) lines.push(t('★ Sirve para evolucionar tu {name} en {evo}.', { name: ATTACKS[a.id].name, evo: ATTACKS[EVOLUTION_OF[a.id]].name }));
  return lines.join('\n');
}
function perkTip(u, lvl) {
  return `${u.name} · ${t('Nivel {a}/{max}', { a: lvl, max: u.max })}\n${t('Mejora permanente de la Tienda de Zeni.')}\n${u.fmt(u.per * lvl)}`;
}
// Cartel flotante: aparece al pasar el mouse (o al tocar, en el celular) sobre algo con data-tip
const tipEl = document.createElement('div');
tipEl.className = 'tip hidden';
document.body.appendChild(tipEl);
function showTip(el, x, y) {
  const [title, ...rest] = el.dataset.tip.split('\n');
  tipEl.innerHTML = `<b>${esc(title)}</b>${rest.map(l => `<div>${esc(l)}</div>`).join('')}`;
  tipEl.classList.remove('hidden');
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x + 14))}px`;
  tipEl.style.top = `${Math.max(8, Math.min(innerHeight - r.height - 8, y + 16))}px`;
}
const hideTip = () => tipEl.classList.add('hidden');
document.addEventListener('mousemove', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el) showTip(el, e.clientX, e.clientY); else hideTip();
});
document.addEventListener('click', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (el && isTouch()) showTip(el, e.clientX, e.clientY); else if (!el) hideTip();
});
// Pestaña de la columna derecha de la pausa: el mapa o el cuadro de mejoras (se recuerda la última)
let pauseTab = 'map';
try { pauseTab = localStorage.getItem('dbz-pause-tab') === 'combos' ? 'combos' : 'map'; } catch (e) { /* sin almacenamiento */ }
function setPauseTab(tab) {
  if (tab) { pauseTab = tab; try { localStorage.setItem('dbz-pause-tab', tab); } catch (e) { /* sin almacenamiento */ } }
  const tb = G && G.snake ? 'combos' : pauseTab;   // en el Camino de la Serpiente no hay mapa
  document.querySelector('.pause-map').classList.toggle('tab-combos', tb === 'combos');
  $('tabMap').classList.toggle('on', tb === 'map'); $('tabCombos').classList.toggle('on', tb === 'combos');
  if (tb === 'combos' && typeof renderCombos === 'function') renderCombos($('pauseCombos'));
}
for (const b of document.querySelectorAll('.pause-tabs .btn')) b.onclick = () => { setPauseTab(b.dataset.tab); b.blur(); };
function renderPause() {
  const P = G.me, st = P.stats, online = !!G.net;
  setPauseTab();
  $('pauseTitle').textContent = t(online ? 'Menú' : 'Pausa');
  $('pauseNote').textContent = online ? t('La partida sigue mientras miras esta pantalla') : '';
  const dmgTotal = Object.values(st.dmg).reduce((a, b) => a + b, 0);
  const rows = Object.entries(st.dmg).sort((a, b) => b[1] - a[1]);
  // Técnicas que tienes pero aún no hicieron daño también aparecen
  for (const a of P.attacks) if (!st.dmg[a.id]) rows.push([a.id, 0]);
  // Nivel y progreso hacia la evolución (nivel máximo + la mejora que pide)
  const lvlOf = id => {
    const a = P.attacks.find(x => x.id === id);
    if (!a) return '';
    if (ATTACKS[id].evolved) return t('★ Evolucionada');
    const evo = ATTACKS[EVOLUTION_OF[id]];
    if (!evo || !canLearn(P.charId, EVOLUTION_OF[id])) return t('Nv {n}', { n: a.lvl });
    return `${t('Nv {n}', { n: a.lvl })}/${MAX_ATTACK_LEVEL} · ${esc(PASSIVES[evo.needs].name)} ${P.passives[evo.needs] ? '✓' : '✗'} → ${esc(evo.name)}`;
  };
  const techHtml = rows.map(([id, v]) => {
    const color = id === 'ki' ? P.c.aura : id === 'bigbang' ? BIGBANG_LOOK.color : (ATTACKS[id] ? ATTACKS[id].color : '#fff');
    const pct = dmgTotal ? v / dmgTotal * 100 : 0, tip = esc(attackTip(P, id));
    return `<span class="dot" style="background:${color}"></span><span data-tip="${tip}">${esc(techName(id, P))} <small>${lvlOf(id)}</small></span>
      <span class="val">${fmtNum(v)} · ${pct.toFixed(0)}%</span><div class="bar"><i style="width:${pct}%;background:${color}"></i></div>`;
  }).join('');
  const passives = Object.entries(P.passives).filter(([, l]) => l > 0)
    .map(([id, l]) => `<span data-tip="${esc(passiveTip(P, id))}">${esc(PASSIVES[id].name)} ${l}</span>`).join('');
  const perks = SHOP_UPGRADES.filter(u => P.perks[u.id])
    .map(u => `<span data-tip="${esc(perkTip(u, P.perks[u.id]))}">${esc(u.name)} ${P.perks[u.id]}</span>`).join('');
  const dps = G.t > 0 ? dmgTotal / G.t : 0;
  // Atributos actuales (con mejoras de la partida, de la tienda, ventaja del personaje y transformación)
  const pctTxt = (v, sign = '+') => `${Math.round(v * 100) ? sign : ''}${Math.round(v * 100)}%`;
  const regen = (P.c.regen || 0) + perk(P, 'regen'), def = perk(P, 'def'), armor = P.passives.armor;
  const attrs = [
    [`${fmtNum(Math.ceil(P.hp))} / ${fmtNum(P.maxHp)}`, 'Salud'],
    [pctTxt(dmgMult(P) - 1), 'Daño de técnicas'],
    [pctTxt(1 - cdMult(P), '-'), 'Tiempo de recarga'],
    [pctTxt(playerSpeed(P) / P.c.speed - 1), 'Velocidad'],
    [armor || def ? [armor ? t('-{n}/golpe', { n: armor }) : '', def ? `-${Math.round(def * 100)}%` : ''].filter(Boolean).join(' · ') : '—', 'Daño recibido'],
    [regen ? `${regen.toFixed(1)}/s` : '—', 'Regeneración'],
    [pctTxt((P.c.xpBonus || 0) + perk(P, 'xp')), 'Experiencia'],
    [fmtNum(magnetRange(P)), 'Radio de atracción'],
    [`${Math.round(P.ki)}%`, 'Ki'],
  ].map(([v, label]) => `<div class="ps-cell"><b>${esc(v)}</b><span>${esc(t(label))}</span></div>`).join('');
  const boosted = P.transformed > 0 ? ` <small>${esc(t('({form} activo)', { form: (activeForm(P) && activeForm(P).name) || P.c.transform }))}</small>` : isFusedBody(P) || (G.fusion && G.fusion.phase === 'fused' && G.fusion.ids.includes(P.id)) ? ` <small>${t('(fusionado)')}</small>` : '';
  $('pauseStats').innerHTML = `
    <div class="ps-head"><canvas id="psPortrait" width="48" height="44"></canvas>
      <div><div class="ps-name">${esc(online ? P.name : P.c.name)}</div><div class="hint">${esc(P.c.name)} · ${t('Nivel {n}', { n: G.level })} · ${fmtTime(G.t)}</div></div></div>
    <div class="ps-grid">
      <div class="ps-cell"><b>${fmtNum(st.kills)}</b><span>${t('Derrotados')}${online ? ' ' + t('(grupo: {n})', { n: fmtNum(G.kills) }) : ''}</span></div>
      <div class="ps-cell"><b>${fmtNum(dmgTotal)}</b><span>${t('Daño total')} · ${fmtNum(dps)}/s</span></div>
      <div class="ps-cell"><b>${fmtNum(st.taken)}</b><span>${t('Daño recibido')}</span></div>
    </div>
    <div><h3>${t('Atributos')}${boosted}</h3><div class="ps-grid">${attrs}</div></div>
    <div><h3>${t('Técnicas')}</h3><div class="ps-tech">${techHtml || `<span></span><span>${t('Aún sin daño')}</span>`}</div></div>
    ${passives ? `<div><h3>${t('Mejoras de la partida')}</h3><div class="ps-chips">${passives}</div></div>` : ''}
    ${perks ? `<div><h3>${t('Mejoras de la tienda')}</h3><div class="ps-chips">${perks}</div></div>` : ''}`;
  const pc = $('psPortrait').getContext('2d');
  drawPortraitTo(pc, P.c.look, formKeyFor(P), 0, 0, 48);
  renderMap();
  buildHudTips();
}

// Mapa de la zona: terreno alrededor del jugador con marcadores
const MAP_SPAN = 2400;
// (los colores del mapa salen del tema del nivel: THEME.map)
const mapCaches = {};
function renderMap() {
  const c = $('mapCanvas').getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  drawAreaMap(c, 300, 0, 0);
}
// Dibuja el mapa de la zona (MAP_PX × MAP_PX píxeles) con la esquina en (ox, oy)
function drawAreaMap(c, MAP_PX, ox, oy) {
  const M = G.me, k = MAP_PX / MAP_SPAN;
  c.save();
  c.translate(ox, oy);
  c.beginPath(); c.rect(0, 0, MAP_PX, MAP_PX); c.clip();
  // Terreno: se precalcula con un margen alrededor (PAD) más grande que lo que el jugador
  // puede alejarse antes del recálculo (REDRAW), así nunca quedan franjas vacías en los bordes
  const REDRAW = 160, PAD = Math.ceil(REDRAW * k) + 4, SIZE = MAP_PX + PAD * 2;
  let mapCache = mapCaches[MAP_PX];
  if (!mapCache || Math.max(Math.abs(M.x - mapCache.cx), Math.abs(M.y - mapCache.cy)) > REDRAW) {
    const off = document.createElement('canvas'); off.width = off.height = SIZE;
    const oc = off.getContext('2d'), img = oc.createImageData(SIZE, SIZE), d = img.data;
    const cx = Math.round(M.x), cy = Math.round(M.y), cols = THEME.map.map(hexRgb);
    // El terreno cambia suave: se muestrea cada 2×2 píxeles (4 veces más rápido); en los mapas pesados
    // (el planeta de Kaio-sama, THEME.margin) cada 4×4, para que rearmar el mapa no dé un tirón
    const st = THEME.margin > 1 ? 4 : 2;
    for (let y = 0; y < SIZE; y += st) for (let x = 0; x < SIZE; x += st) {
      const col = cols[groundType(Math.round(cx + (x + st / 2 - SIZE / 2) / k), Math.round(cy + (y + st / 2 - SIZE / 2) / k))];
      for (let yy = y; yy < Math.min(SIZE, y + st); yy++) for (let xx = x; xx < Math.min(SIZE, x + st); xx++) {
        const i = (yy * SIZE + xx) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    oc.putImageData(img, 0, 0);
    if (!PROP_TYPES) initProps();
    oc.fillStyle = '#7c5330';
    const half = (SIZE / 2) / k;
    for (let gy = Math.floor((cy - half) / CHUNK); gy <= Math.floor((cy + half) / CHUNK); gy++) {
      for (let gx = Math.floor((cx - half) / CHUNK); gx <= Math.floor((cx + half) / CHUNK); gx++) {
        for (const p of chunkProps(gx, gy)) {
          if (!p.solid) continue;
          oc.fillRect(Math.round((p.x - cx) * k + SIZE / 2) - 2, Math.round((p.y - cy) * k + SIZE / 2) - 2, 4, 4);
        }
      }
    }
    mapCache = mapCaches[MAP_PX] = { cx, cy, img: off };
  }
  c.imageSmoothingEnabled = false;
  c.drawImage(mapCache.img, Math.round((mapCache.cx - M.x) * k) - PAD, Math.round((mapCache.cy - M.y) * k) - PAD);
  const toMap = (x, y) => [(x - M.x) * k + MAP_PX / 2, (y - M.y) * k + MAP_PX / 2];
  const inMap = ([x, y]) => x >= -4 && y >= -4 && x <= MAP_PX + 4 && y <= MAP_PX + 4;
  // El terreno un poco más oscuro, para que resalten los marcadores
  c.fillStyle = 'rgba(10,15,46,0.28)'; c.fillRect(0, 0, MAP_PX, MAP_PX);
  const now = performance.now() / 1000, pulse = 0.5 + 0.5 * Math.sin(now * 6);
  // Zona visible en pantalla
  c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1;
  c.strokeRect(Math.round(MAP_PX / 2 - BW * k / 2) + 0.5, Math.round(MAP_PX / 2 - BH * k / 2) + 0.5, Math.round(BW * k), Math.round(BH * k));
  // Enemigos comunes: puntos rojos con borde oscuro (se ven sobre cualquier terreno)
  c.fillStyle = '#0a0f2e';
  for (const e of G.enemies) {
    if (e.boss || e.elite) continue;
    const q = toMap(e.x, e.y);
    if (inMap(q)) c.fillRect(Math.round(q[0]) - 2, Math.round(q[1]) - 2, 5, 5);
  }
  c.fillStyle = '#ff4d4d';
  for (const e of G.enemies) {
    if (e.boss || e.elite) continue;
    const q = toMap(e.x, e.y);
    if (inMap(q)) c.fillRect(Math.round(q[0]) - 1, Math.round(q[1]) - 1, 3, 3);
  }
  // Élites: llevan una esfera, así que se marcan con una esfera y un anillo dorado que late
  for (const e of G.enemies) {
    if (!e.elite || e.boss) continue;
    const q = toMap(e.x, e.y);
    if (!inMap(q)) continue;
    c.strokeStyle = '#ffcc33'; c.lineWidth = 1.5; c.globalAlpha = 0.5 + 0.5 * pulse;
    c.beginPath(); c.arc(q[0], q[1], 7 + pulse * 2, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
    drawDragonBall(c, q[0], q[1], 4, 1, false);
  }
  // Objetos (2.18.1: encima de los enemigos, que antes los tapaban), con un anillo claro que late.
  // Si se pisan, manda la cápsula, después la esfera y después la semilla (se dibujan en ese orden, al revés)
  const PICK_ORDER = { senzu: 0, ball: 1, capsule: 2 };
  for (const p of G.pickups.filter(p => p.kind !== 'xp').sort((a, b) => (PICK_ORDER[a.kind] ?? 0) - (PICK_ORDER[b.kind] ?? 0))) {
    const q = toMap(p.x, p.y);
    if (p.kind === 'ball') {
      // Esfera del Dragón como en el favicon; si queda fuera del mapa, se marca en el borde
      const r = Math.max(5, Math.round(MAP_PX / 36)), m = r + 2, out = !inMap(q);
      const bx = Math.min(MAP_PX - m, Math.max(m, q[0])), by = Math.min(MAP_PX - m, Math.max(m, q[1]));
      if (!out) { c.strokeStyle = '#fff6b0'; c.lineWidth = 1.5; c.globalAlpha = 0.4 + 0.5 * pulse; c.beginPath(); c.arc(bx, by, r + 3 + pulse * 2, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = out ? 0.65 : 1;
      drawDragonBall(c, bx, by, r, 4, !out);
      c.globalAlpha = 1;
      continue;
    }
    if (!inMap(q)) continue;
    const [x, y] = [Math.round(q[0]), Math.round(q[1])];
    c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.globalAlpha = 0.35 + 0.5 * pulse;
    c.beginPath(); c.arc(x, y, 8 + pulse * 2, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    if (p.kind === 'capsule') {   // Cápsula Hoi-Poi: el mismo dibujo del mapa (puntas redondeadas, franja azul, botón)
      CAPSULE_ART.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          if (row[i] === '.') continue;
          c.fillStyle = CAPSULE_PAL[row[i]];
          c.fillRect(x - 9 + i, y - 4 + j, 1, 1);
        }
      });
    } else if (p.kind === 'ultimate') {   // Esfera definitiva: punto dorado con núcleo violeta
      c.fillStyle = '#ffe14d'; circle(c, x, y, 5);
      c.fillStyle = '#b06cff'; circle(c, x, y, 2.5);
    } else {                      // Semilla: poroto verde con borde claro (sobre el pasto no se veía)
      c.fillStyle = '#fffad6'; c.beginPath(); c.ellipse(x, y, 7, 5.5, -0.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0a0f2e'; c.beginPath(); c.ellipse(x, y, 5.5, 4, -0.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6cff7a'; c.beginPath(); c.ellipse(x, y, 4.2, 2.8, -0.4, 0, Math.PI * 2); c.fill();
    }
  }
  // Jefes: círculo rojo grande con borde blanco; si está lejos, en el borde del mapa
  for (const e of G.enemies) {
    if (!e.boss) continue;
    let [x, y] = toMap(e.x, e.y);
    x = Math.max(8, Math.min(MAP_PX - 8, x)); y = Math.max(8, Math.min(MAP_PX - 8, y));
    c.fillStyle = '#0a0f2e'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, 6.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff3d5c'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#0a0f2e'; c.fillRect(Math.round(x) - 1, Math.round(y) - 3, 2, 4); c.fillRect(Math.round(x) - 1, Math.round(y) + 2, 2, 1);   // «!»
  }
  // Jugadores
  G.players.forEach((P, i) => {
    if (P.gone) return;
    const [x, y] = toMap(P.x, P.y), me = P === M;
    c.fillStyle = '#0a0f2e'; c.beginPath(); c.arc(x, y, me ? 6 : 5, 0, Math.PI * 2); c.fill();
    c.fillStyle = P.dead ? '#888' : me ? '#ffe27a' : PLAYER_COLORS[i % 4] === '#ffe27a' ? '#7fd8ff' : PLAYER_COLORS[i % 4];
    c.beginPath(); c.arc(x, y, me ? 4 : 3, 0, Math.PI * 2); c.fill();
  });
  c.restore();
}
// Mapa en partida (tecla M): panel en la esquina superior derecha
function toggleMap() {
  SAVE.showMap = !SAVE.showMap;
  writeSave();
}
// Posiciones del HUD superior según el ancho de pantalla. Los botones HTML (mapa,
// música y pausa) ocupan la esquina superior derecha: de W-144 a W-12.
const isTouch = () => matchMedia('(pointer: coarse)').matches;
const BOSS_BAR_GAP = 30;
function hudLayout() {
  // Varios jefes a la vez (Burter y Jeice, los Androides): una barra debajo de la otra
  const narrow = W < 520, bosses = G.enemies.filter(e => e.boss).length, boss = bosses > 0, extra = Math.max(0, bosses - 1) * BOSS_BAR_GAP;
  if (narrow) return { narrow, statsX: W - 146, statsY: 60, bossY: 118, mapY: boss ? 146 + extra : 106 };
  const killsFit = W / 2 + 54 < W - 302;   // a la izquierda de los 4 botones (mapa, sonido, música, pausa)
  const killsX = killsFit ? W - 302 : W / 2 - 50, killsY = killsFit ? 14 : 56;
  const bossY = killsFit ? 72 : 116;
  const bossBarReach = W / 2 + Math.min(420, W - 40) / 2;
  return { narrow, killsX, killsY, bossY, mapY: boss && bossBarReach > W - 296 ? bossY + 32 + extra : 62 };
}
function drawHudMap() {
  if (!SAVE.showMap || !G.me || G.snake) return;   // en el Camino de la Serpiente no hay mapa: no se ve el recorrido
  const px = Math.round(Math.min(220, Math.max(120, Math.min(W, H) * 0.24)));
  const x = W - px - 18, y = hudLayout().mapY;
  ctx.save();
  ctx.globalAlpha = 0.92;
  panel(x - 6, y - 6, px + 12, px + 12);
  ctx.globalAlpha = 0.85;
  drawAreaMap(ctx, px, x, y);
  ctx.restore();
  if (!isTouch()) hudText(t('M: ocultar mapa'), x + px / 2, y + px + 20, 11, 'rgba(255,255,255,0.7)', 'center');
}
// Mientras la pausa está abierta se refresca cada medio segundo (online la partida sigue)
let pauseRefresh = 0;
function tickPause(dt) {
  if (!G || !G.net || $('pause').classList.contains('hidden')) return;
  pauseRefresh -= dt;
  if (pauseRefresh <= 0) { pauseRefresh = 0.5; renderPause(); }
}
// Frase de la pantalla final: al azar, sin repetir las últimas 8 de cada grupo; las del guerrero que jugaste, x3
function showQuote(won, charId) {
  const kind = won ? 'win' : 'lose', list = QUOTES[kind];
  const recent = (SAVE.recentQuotes = SAVE.recentQuotes || {})[kind] || [];
  let pool = list.map((q, i) => i).filter(i => !recent.includes(i));
  if (!pool.length) pool = list.map((q, i) => i);
  const weight = i => list[i].who === charId ? 3 : 1;
  let r = Math.random() * pool.reduce((a, i) => a + weight(i), 0), idx = pool[0];
  for (const i of pool) if ((r -= weight(i)) <= 0) { idx = i; break; }
  SAVE.recentQuotes[kind] = [idx, ...recent].slice(0, 8);
  writeSave();
  const q = list[idx], who = q.who && (CHARACTERS[q.who] || bossDef(q.who));
  const name = who ? who.name : t(q.name);
  $('goQuote').innerHTML = `${who ? '<canvas width="40" height="40"></canvas>' : `<span class="q-ico">${q.icon}</span>`}
    <blockquote>«${esc(t(q.text))}»<cite>— ${esc(name)}</cite></blockquote>`;
  if (who) drawPortraitTo($('goQuote').querySelector('canvas').getContext('2d'), who.look, false, 0, 0, 40);
}
function endRun(won) {
  if (!G || G.mode === 'over') return;
  if (G.net && G.net.role === 'host') Net.gameOver(won);
  G.mode = 'over';
  G.round = null;
  document.body.classList.remove('playing');
  for (const id of ['btnTransform', 'levelup', 'pause']) $(id).classList.add('hidden');
  clearHudTips(); hideTip();
  const P = G.me;
  // El Zeni se multiplica según el nivel; el récord es por guerrero y por nivel
  const coins = perk(G.weekly ? { perks: myPerks() } : P, 'coins');   // en el desafío, tu mejora de Zeni real (no la prestada)
  const zeni = Math.floor((Math.floor(G.kills / 8 + G.t / 6) + (won ? 500 : 0) + (P.bonusZeni || 0)) * (1 + coins) * G.lv.zeni * (G.weekly && !G.practice ? WEEKLY_ZENI : 1)
    * (1 + luckPct(P.passives.luck) / 100) * (1 + (P.c.zeniBonus || 0)));   // Suerte de Mr. Satán (la mejora) y Mr. Satán (el guerrero)
  // Nivel bonus: el récord es el menor tiempo para llegar (por modo); en los demás, el mayor tiempo aguantado
  const recKey = G.lv.rankId || G.lv.id, prev = bestOf(recKey, P.charId);
  const record = G.lv.bonus ? won && (!prev || G.t < prev) : !G.weekly && G.t > prev;   // el desafío no cuenta para los récords del nivel
  if (record) SAVE.best[`${recKey}|${P.charId}`] = G.lv.bonus ? Math.round(G.t * 100) / 100 : Math.floor(G.t);
  // La mejor partida completa (para comparar en la pantalla final): se guarda junto con el récord de tiempo
  const runKey = `${recKey}|${P.charId}`, prevRun = (SAVE.bestRun || {})[runKey] || null;
  const thisRun = { t: Math.round(G.t * 100) / 100, level: G.level, kills: P.stats.kills, dmg: Math.round(Object.values(P.stats.dmg).reduce((a, b) => a + b, 0)), won };
  if (!G.weekly && (record || !prevRun)) (SAVE.bestRun = SAVE.bestRun || {})[runKey] = thisRun;
  let reward = '';
  if (G.lv.bonus && won) {
    unlockAch('snakeway');
    if (!(SAVE.rewards = SAVE.rewards || {}).kaioken) { SAVE.rewards.kaioken = true; reward = t('¡Kaio-sama le enseñó el Kaioken a Goku! Ya puede aprenderlo en sus partidas.'); }
    // La Carrera guarda el recorrido del mejor tiempo: es el fantasma de la próxima
    if (record && G.snake && G.snake.mode === 'race') (SAVE.snakeGhost = SAVE.snakeGhost || {})[recKey] = { char: P.charId, trail: G.snake.trail };
  }
  if (G.weekly && won) unlockAch('weekly');
  SAVE.zeni += zeni; SAVE.stats.zeniEarned += zeni; SAVE.runs++; if (won) SAVE.wins++;
  const nextLevel = LEVELS[G.lv.num];   // el que se abre al ganar este
  const opened = won && !G.weekly && nextLevel && !isLevelOpen(nextLevel.id);
  if (won && !G.weekly) SAVE.levelsWon[G.lv.id] = true;   // ganar el desafío no abre niveles
  if (P.charId === 'vegeta') SAVE.vegetaKills += P.stats.kills;   // objetivo para desbloquear a Trunks
  if (!won && !G.quit && G.t < 60) SAVE.quickLosses = (SAVE.quickLosses || 0) + 1;   // para desbloquear a Mr. Satán (abandonar no cuenta)
  if (won && P.charId === 'hercule' && !G.lv.bonus) unlockAch('satanwin');
  achEndRun(P, won);   // logros que dependen del resultado (y suma las bajas totales)
  writeSave();
  checkUnlocks();
  $('goTitle').textContent = won ? (G.lv.bonus ? t('¡Llegaste al planeta de Kaio-sama!') : G.weekly ? t('¡Desafío semanal superado!') : t('¡Nivel {n} superado!', { n: G.lv.num })) : G.players.length > 1 ? t('Los guerreros Z han caído...') : t('{name} ha caído...', { name: P.c.name });
  $('goBadge').textContent = t(won ? '¡VICTORIA!' : 'DERROTA');
  showQuote(won, P.charId);
  $('gameover').classList.toggle('won', won);
  $('gameover').classList.toggle('lost', !won);
  $('goStats').innerHTML =
    `<span class="go-level">${G.lv.bonus ? `🐍 ${t('El Camino de la Serpiente')} · ${t(G.snake && G.snake.mode === 'fight' ? '⚔️ Con enemigos' : '🏃 Carrera')}${G.snake && !G.snake.fall ? ' · ' + t('sin caídas') : ''}`
      : G.weekly ? t('⭐ Desafío semanal · Nivel {n}', { n: G.lv.num }) : t('Nivel {n}', { n: G.lv.num })}</span><br>` +
    (reward ? `<span class="go-unlock">${esc(reward)}</span><br>` : '') +
    t('Tiempo: <b>{time}</b>', { time: fmtTimeCs(Math.floor(G.t * 100)) }) + (record ? ' · ' + t('¡Nuevo récord!') : '') + '<br>' +
    t('Nivel alcanzado: <b>{lvl}</b> · Enemigos derrotados: <b>{kills}</b>', { lvl: G.level, kills: G.kills }) + '<br>' +
    '<i class="coin"></i>' + t('Zeni ganado: <b>{n}</b>', { n: zeni }) +
    (opened ? `<br><span class="go-unlock">${t('¡Se abrió el <b>Nivel {n}</b>!', { n: nextLevel.num })}</span>` : '') +
    (G.newUnlocks || []).map(id => `<br><span class="go-unlock">${t('¡Nuevo guerrero desbloqueado: <b>{name}</b>!', { name: esc(CHARACTERS[id].name) })}</span>`).join('') +
    (G.achNew || []).map(id => { const a = ACHIEVEMENTS.find(x => x.id === id); return `<br><span class="go-ach">${t('🏆 Logro: <b>{name}</b> (+{zeni} Zeni)', { name: esc(a.name), zeni: a.zeni })}</span>`; }).join('') +
    '<span id="goReplay"></span>';
  $('goDetail').innerHTML = endStatsHtml(P, G.weekly ? undefined : prevRun, record);
  // Repetición: los últimos segundos quedan guardados en este navegador (Perfil → Repeticiones)
  if (typeof Replays !== 'undefined') Replays.capture({ char: P.charId, level: G.lv.id, won, time: Math.floor(G.t) }).then(ok => {
    if (ok && $('goReplay')) $('goReplay').innerHTML = `<br><span class="go-replay">${t('🎬 Se guardó la repetición de los últimos segundos (Perfil → Repeticiones)')}</span>`;
  });   // (el desafío no se compara)
  // Estadísticas anónimas para el backoffice (cada jugador manda la suya; en el modo prueba no se manda)
  if (typeof Telemetry !== 'undefined') Telemetry.run({ level: (G.lv.rankId || G.lv.id).replace('_safe', ''), char: P.charId, won, secs: Math.floor(G.t), online: !!G.net,
    players: G.players.filter(Q => !Q.ally).length, aim: SAVE.aim ? 'manual' : 'auto', fast: G.speed > 1 });
  rankSubmit({ level: G.lv.rankId || G.lv.id, weekly: G.weekly ? G.weekly.week : undefined, practice: !!G.practice, char: P.charId, won, secs: Math.floor(G.t), cs: Math.floor(G.t * 100), kills: P.stats.kills, taken: Math.round(P.stats.taken), aim: SAVE.aim ? 'manual' : 'auto',
    online: !!G.net, players: G.players.filter(Q => !Q.ally).length });
  $('btnRetry').textContent = t(G.net ? 'Volver a la sala' : 'Reintentar');
  $('gameover').classList.remove('hidden');
}
// Estadísticas del final: daño por técnica (con la técnica MVP), totales y, en online, el grupo
// Gráfico de barras del daño en el tiempo: tramos de 15 s, o de a 1 minuto si la partida fue larga
function dmgChartHtml(P) {
  const raw = P.stats.dmgLine || [], n = Math.ceil(G.t / DMG_STEP);
  if (n < 2) return '';
  const per = G.t > 240 ? 60 / DMG_STEP : 1, bars = [];   // cuántos tramos van en cada barra
  for (let i = 0; i < n; i += per) { let s = 0; for (let j = i; j < Math.min(n, i + per); j++) s += raw[j] || 0; bars.push(s); }
  const max = Math.max(1, ...bars), W = 100 / bars.length;
  const step = per > 1 ? 60 : DMG_STEP, best = bars.indexOf(max);
  const cols = bars.map((v, i) => `<i style="left:${i * W}%;width:${W}%;height:${Math.max(2, v / max * 100)}%"${i === best ? ' class="top"' : ''} title="${fmtTime(i * step)}–${fmtTime(Math.min(G.t, (i + 1) * step))}: ${fmtNum(v)}"></i>`).join('');
  return `<h3>${t(per > 1 ? 'Daño por minuto' : 'Daño cada 15 segundos')}</h3>
    <div class="dmg-chart">${cols}</div><div class="dmg-axis"><span>0:00</span><span>${fmtTime(Math.floor(G.t))}</span></div>`;
}
// Comparación con la mejor partida anterior con este guerrero en este nivel
function bestRunHtml(P, prev, record) {
  if (!prev) return `<p class="go-best">${t('Es tu primera partida con {name} en este nivel: ya quedó como tu mejor marca.', { name: esc(P.c.name) })}</p>`;
  const now = { t: G.t, level: G.level, kills: P.stats.kills, dmg: Object.values(P.stats.dmg).reduce((a, b) => a + b, 0) };
  const lowerBetter = G.lv.bonus;   // en el Camino de la Serpiente gana el menor tiempo
  const cell = (label, a, b, fmt, lower) => {
    const up = lower ? a < b : a > b, same = Math.round(a) === Math.round(b);
    return `<div class="ps-cell"><b>${fmt(a)}</b><span>${t(label)}</span><small class="${same ? '' : up ? 'better' : 'worse'}">${same ? '=' : up ? '▲' : '▼'} ${t('mejor')}: ${fmt(b)}</small></div>`;
  };
  return `<h3>${record ? t('¡Nueva mejor partida con {name}!', { name: esc(P.c.name) }) : t('Contra tu mejor partida con {name}', { name: esc(P.c.name) })}</h3>
    <div class="ps-grid go-compare">${cell('Tiempo', now.t, prev.t, v => fmtTime(Math.floor(v)), lowerBetter)}${cell('Nivel alcanzado', now.level, prev.level, v => v)}
      ${cell('Derrotados', now.kills, prev.kills, fmtNum)}${cell('Daño total', now.dmg, prev.dmg, fmtNum)}</div>`;
}
function endStatsHtml(P, prevRun, record) {
  const dmgOf = Q => Object.values(Q.stats.dmg).reduce((a, b) => a + b, 0);
  const total = dmgOf(P), rows = Object.entries(P.stats.dmg).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const colorOf = id => id === 'ki' ? P.c.aura : id === 'bigbang' ? BIGBANG_LOOK.color : (ATTACKS[id] || PASSIVES[id] || { color: '#fff' }).color;
  const techs = rows.map(([id, v], i) => {
    const pct = total ? v / total * 100 : 0;
    return `<span class="dot" style="background:${colorOf(id)}"></span><span>${esc(techName(id, P))}${i === 0 ? ' <small class="mvp">★ MVP</small>' : ''}</span>
      <span class="val">${fmtNum(v)} · ${pct.toFixed(0)}%</span><div class="bar"><i style="width:${pct}%;background:${colorOf(id)}"></i></div>`;
  }).join('');
  const dps = G.t > 0 ? total / G.t : 0;
  let html = `<div class="ps-grid">
      <div class="ps-cell"><b>${fmtNum(total)}</b><span>${t('Daño total')}</span></div>
      <div class="ps-cell"><b>${fmtNum(dps)}</b><span>${t('Daño por segundo')}</span></div>
      <div class="ps-cell"><b>${fmtNum(P.stats.taken)}</b><span>${t('Daño recibido')}</span></div>
    </div>
    <h3>${t('Daño por técnica')}</h3><div class="ps-tech">${techs || `<span></span><span>${t('Sin daño')}</span>`}</div>`;
  if (prevRun !== undefined && !G.net) html += dmgChartHtml(P) + bestRunHtml(P, prevRun, record);   // (la pausa no lo muestra)
  // Online: comparación entre los jugadores
  const team = G.players.filter(Q => !Q.ally);
  if (team.length > 1) {
    const best = Math.max(...team.map(dmgOf));
    html += `<h3>${t('El grupo')}</h3><table class="go-team"><tr><th>${t('Jugador')}</th><th>${t('Derrotados')}</th><th>${t('Daño')}</th><th>${t('Recibido')}</th></tr>${team
      .sort((a, b) => dmgOf(b) - dmgOf(a)).map(Q => `<tr${Q === P ? ' class="me"' : ''}><td>${esc(Q.name)} <small>${esc(Q.c.name)}</small>${dmgOf(Q) === best && best > 0 ? ' ★' : ''}</td>
        <td>${fmtNum(Q.stats.kills)}</td><td>${fmtNum(dmgOf(Q))}</td><td>${fmtNum(Q.stats.taken)}</td></tr>`).join('')}</table>`;
  }
  return html;
}
function toMenu() {
  G = null;
  if (typeof Replays !== 'undefined') Replays.stop();
  document.body.classList.remove('playing');
  for (const id of ['gameover', 'levelup', 'pause', 'lobby', 'setup', 'shop', 'credits', 'help', 'techs', 'achs', 'profile', 'rank', 'news']) $(id).classList.add('hidden');
  clearHudTips(); hideTip();
  $('btnTransform').classList.add('hidden');
  rollMenuDuel();   // otro duelo en la portada
  buildMenu();
  $('menu').classList.remove('hidden');
}

// ─── Actualización (autoridad) ───────────────────────────────────────────────
// ¿Los pies de un personaje en (x, y) pisan terreno prohibido? (THEME.blocked, ver js/maps.js)
const blockedAt = (x, y) => !!THEME.blocked && (THEME.blocked(x - 5, y + 12) || THEME.blocked(x + 5, y + 12) || THEME.blocked(x, y + 8));
// El punto pisable más cercano (para lo que sueltan los enemigos que mueren sobre las nubes)
// Cómo cruza cada enemigo el terreno que no se pisa (las nubes del Planeta de Kaio-sama, 2.15.1):
//   fly: aves, pasan por encima siempre · hover: guerreros que en la serie vuelan, levitan para cruzar ·
//   jump: los Saibaiman cruzan a los saltos · ground: animales y humanos, buscan el camino por los puentes ·
//   boss: los jefes usan la Teletransportación (con una marca de aviso donde van a aparecer)
const ENEMY_MOVE = { nbird: 'fly', hawk: 'fly', saibaman: 'jump', soldier: 'hover', esoldier: 'hover', celljr: 'hover', eggbot: 'hover',
  cyborg: 'hover', msoldier: 'hover', majin: 'hover', destroyer: 'hover' };
const moveKind = e => e.boss ? 'boss' : ENEMY_MOVE[e.id] || 'ground';
function enemyTerrain(e, ox, oy, dt, step, P) {
  if (!THEME.blocked) return;
  const mv = moveKind(e);
  if (mv === 'fly') { e.air = footBlocked(e.x, e.y, e.scale) ? 'fly' : null; return; }   // nada las frena
  if (e.leap) {   // Saibaiman en pleno salto: va en arco hasta la otra orilla
    const L = e.leap, p = Math.min(1, (L.t += dt) / L.dur);
    e.x = L.x0 + (L.x1 - L.x0) * p; e.y = L.y0 + (L.y1 - L.y0) * p;
    if (p >= 1) { e.leap = null; e.air = null; e.stuck = 0; burst(e.x, e.y + 10 * e.scale, '#e8e0c8', 8, 3, 2); }
    return;
  }
  if (e.air) {   // cruzando por el aire: aterriza en tierra firme (los Saibaiman, al terminar un salto)
    e.airT += dt;
    if (e.airT > 0.4 && !footBlocked(e.x, e.y, e.scale)) { e.air = null; e.stuck = 0; }
    return;
  }
  if (keepOnGround(e, ox, oy) && Math.hypot(e.x - ox, e.y - oy) < step * 0.35) e.stuck = (e.stuck || 0) + dt;
  else if (e.stuck) e.stuck = Math.max(0, e.stuck - dt);
  if (!(e.stuck > 0.5)) return;
  if (mv === 'hover') {   // despega
    e.air = mv; e.airT = 0; e.stuck = 0; e.path = null;
    burst(e.x, e.y + 10 * e.scale, '#ffffff', 8, 3, 2);
    return;
  }
  if (mv === 'jump') {   // salta de una hasta la otra orilla (si no hay orilla a la vista, busca el puente como los animales)
    const L = leapTarget(e, P);
    if (L) {
      e.leap = { x0: e.x, y0: e.y, x1: L.x, y1: L.y, t: 0, dur: Math.max(0.45, L.d / 260), h: Math.min(80, 18 + L.d * 0.14) };
      e.air = 'jump'; e.airT = 0; e.stuck = 0; e.path = null;
      burst(e.x, e.y + 10 * e.scale, '#e8e0c8', 8, 3, 2);
      return;
    }
  }
  if (mv === 'boss') { if (e.stuck > 1 && !e.tp) bossTeleport(e, P); return; }
  // Por tierra: busca el camino (por los puentes); si no hay, se rinde y se va (reaparece más tarde de tu lado)
  if (e.flee || !(G.pathBudget > 0)) return;
  G.pathBudget--;
  e.stuck = 0;
  const path = findPath(e.x, e.y, P.x, P.y, e.scale);
  if (path && path.length) { e.path = path; e.pi = 0; e.pathAge = 0; } else { e.path = null; e.flee = true; }   // (un camino vacío cuenta como «no hay»)
}
// ¿Se puede ir en línea recta de (x0, y0) a (x1, y1) sin pisar nubes?
function clearLine(x0, y0, x1, y1, s = 1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 12);
  for (let i = 1; i < n; i++) if (footBlocked(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, s)) return false;
  return true;
}
// Dónde cae el salto de un Saibaiman: la primera tierra firme después de las nubes, yendo hacia el jugador
function leapTarget(e, P) {
  const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  let cloud = false;
  for (let s = 8; s <= 520; s += 8) {
    const x = e.x + ux * s, y = e.y + uy * s;
    if (footBlocked(x, y, e.scale)) cloud = true;
    else if (cloud && !footBlocked(x + ux * 12, y + uy * 12, e.scale)) return { x: x + ux * 12, y: y + uy * 12, d: s + 12 };
  }
  return null;
}
function bossTeleport(e, P) {
  const a = Math.random() * Math.PI * 2;
  const [x, y] = walkableSpot(P.x + Math.cos(a) * 70, P.y + Math.sin(a) * 70);
  e.tp = { t: 0.8, x, y }; e.stuck = 0;
  G.hazards.push({ x, y, r: 50, t: 0.8, dur: 0.8, dmg: e.dmg * 0.8 });   // la marca roja: aparece golpeando
  burst(e.x, e.y, '#ffffff', 16, 4, 3);
  addText(e.x, e.y - 34 * e.scale, '¡Teletransportación!', '#ffffff', true);
  sfx('power', 0.2);
}
// Camino por tierra firme de (sx, sy) a (gx, gy): A* en una grilla de 24 px alrededor de los dos puntos.
// Devuelve una lista de puntos [x, y] o null si no hay camino (o es demasiado largo para buscarlo).
const PATH_CELL = 24;
function findPath(sx, sy, gx, gy, s = 1) {
  [gx, gy] = walkableSpot(gx, gy);   // el jugador justo en el borde: la tierra firme más cercana
  const C = PATH_CELL, M = 1200;
  const x0 = Math.floor((Math.min(sx, gx) - M) / C), y0 = Math.floor((Math.min(sy, gy) - M) / C);
  const W = Math.floor((Math.max(sx, gx) + M) / C) - x0 + 1, H = Math.floor((Math.max(sy, gy) + M) / C) - y0 + 1;
  if (W * H > 90000) return null;
  const N = W * H, cellOf = (x, y) => (Math.floor(y / C) - y0) * W + (Math.floor(x / C) - x0);
  const start = cellOf(sx, sy), goal = cellOf(gx, gy), gxC = goal % W, gyC = (goal / W) | 0;
  const blk = new Int8Array(N);   // 0: sin mirar · 1: libre · 2: nube
  const free = i => {
    if (i === goal || i === start) return true;
    if (!blk[i]) blk[i] = footBlocked((x0 + i % W + 0.5) * C, (y0 + ((i / W) | 0) + 0.5) * C, s) ? 2 : 1;
    return blk[i] === 1;
  };
  const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const heap = [], push = (f, i) => {   // montículo de [f, celda]
    heap.push([f, i]);
    for (let j = heap.length - 1; j > 0;) { const p = (j - 1) >> 1; if (heap[p][0] <= heap[j][0]) break; [heap[p], heap[j]] = [heap[j], heap[p]]; j = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      for (let j = 0; ;) { const l = 2 * j + 1, r = l + 1; let m = j;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === j) break; [heap[m], heap[j]] = [heap[j], heap[m]]; j = m; }
    }
    return top;
  };
  const hh = i => { const ax = Math.abs(i % W - gxC), ay = Math.abs(((i / W) | 0) - gyC); return Math.max(ax, ay) + 0.414 * Math.min(ax, ay); };
  gs[start] = 0; push(hh(start), start);
  let steps = 0;
  while (heap.length && steps++ < 60000) {
    const [, i] = pop();
    if (done[i]) continue;
    done[i] = 1;
    if (i === goal) {
      const out = [];
      for (let c = i; c !== start && c >= 0; c = from[c]) out.push([(x0 + c % W + 0.5) * C, (y0 + ((c / W) | 0) + 0.5) * C]);
      out.reverse();
      return out;
    }
    const cx = i % W, cy = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (done[n] || !free(n)) continue;
      if (dx && dy && (!free(cy * W + nx) || !free(ny * W + cx))) continue;   // sin cortar esquinas de nube
      const g = gs[i] + (dx && dy ? 1.414 : 1);
      if (g < gs[n]) { gs[n] = g; from[n] = i; push(g + hh(n), n); }
    }
  }
  return null;
}
function walkableSpot(x, y) {
  if (!THEME.blocked || !THEME.blocked(x, y)) return [x, y];
  for (let r = 16; r <= 640; r += 16) for (let a = 0; a < 16; a++) {
    const px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r;
    if (!THEME.blocked(px, py)) return [px, py];
  }
  return [x, y];
}
function moveControlledPlayer(P, dt) {
  const k = dt * 60;
  if (!P || P.dead || P.gone || G.mode !== 'play' || fusionLocked(P)) { if (P) P.moving = false; return; }
  if (P.transformLock > 0) { P.moving = false; return; }   // brief "powering up" lock right as a transform lands
  if (P.dashT > 0) {   // Dynamite Kick: vuela hacia el enemigo
    P.dashT -= dt;
    const ox = P.x, oy = P.y;
    P.x += P.dashVX * dt; P.y += P.dashVY * dt;
    if (!(G.snake && G.snake.fall) && blockedAt(P.x, P.y)) { P.x = ox; P.y = oy; P.dashT = 0; }
    pushOutOfSolids(P, 12, 6);
    return;
  }
  const v0 = inputVec(P), sp = playerSpeed(P) * statusSpeed(P);
  const v = P.invert > 0 ? { x: -v0.x, y: -v0.y } : v0;   // Ginyu: controles al revés
  P.moving = !!(v.x || v.y) && sp > 0;
  if (P.moving) {
    const ox = P.x, oy = P.y;
    const edge = !(G.snake && G.snake.fall);   // con las caídas del Camino de la Serpiente, el borde no frena
    P.x += v.x * sp * k; if (edge && blockedAt(P.x, P.y)) P.x = ox;   // eje por eje: se desliza por el borde
    P.y += v.y * sp * k; if (edge && blockedAt(P.x, P.y)) P.y = oy;
    pushOutOfSolids(P, 12, 6);
    P.dirX = v.x; P.dirY = v.y;
    if (Math.abs(v.x) > 0.1) P.facing = Math.sign(v.x);
    P.dir = dirFromVec(v.x, v.y);
  }
}
function moveLocal(dt) {
  if (G.localCoop) {
    for (const P of G.players.slice(0, 2)) moveControlledPlayer(P, dt);
  } else moveControlledPlayer(G.me, dt);
}
function updateDowned(dt) {
  for (const P of G.players) {
    if (!P.dead || P.gone) continue;
    const helper = G.players.find(o => o !== P && !o.dead && !o.gone && Math.hypot(o.x - P.x, o.y - P.y) < 32);
    if (helper) {
      P.revive += dt;
      if (P.revive >= 2.5) {
        P.dead = false; P.hp = Math.round(P.maxHp * 0.4); P.inv = 2; P.revive = 0;
        announce('¡{helper} ha reanimado a {name}!', '#6cff7a', { helper: helper.name, name: P.name });
        sfx('levelup');
        burst(P.x, P.y, '#6cff7a', 20, 4, 3);
      }
    } else P.revive = Math.max(0, P.revive - dt);
  }
}
function tickFx(dt, k) {
  for (const f of G.fx) { f.t -= dt; if (f.vx !== undefined) { f.x += f.vx * k; f.y += f.vy * k; f.vx *= 0.92; f.vy *= 0.92; } }
  G.fx = G.fx.filter(f => f.t > 0);
  for (const t of G.texts) { t.t -= dt; t.y -= 0.6 * k; }
  G.texts = G.texts.filter(t => t.t > 0);
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  if (G.shake > 0) G.shake -= dt;
  const P = G.me, F = G.fusion;
  const canBigBang = F && F.phase === 'fused' && F.ids.includes(P.id) && (P.id === F.gunnerId || !G.net) && F.bbCd <= 0;
  const canKi = !P.dead && P.ki >= 100 && P.transformed <= 0 && !(F && F.ids.includes(P.id)) && !rule('notrans');
  $('btnTransform').classList.toggle('hidden', !(G.mode === 'play' && (canKi || canBigBang)));
}
// Durante la danza los dos quedan quietos; el compañero absorbido no se mueve solo
const fusionLocked = P => !!(G.fusion && G.fusion.ids.includes(P.id) && (G.fusion.phase === 'dance' || P.hidden));
// Semilla de reserva (2.23.0): en vez de revivir en el acto, el guerrero sale despedido, queda tirado en el piso, se come
// la semilla y se levanta. Mientras tanto no recibe daño, no se mueve ni ataca. Al levantarse, reserveRevive.
const KO_TIME = 1.8, KO_HIT = 0.3, KO_UP = 0.45;   // duración total, del golpe y de levantarse (s)
const koAnim = P => P.koT > KO_TIME - KO_HIT ? 'kohit' : P.koT > KO_UP ? 'kolie' : 'koup';
function koUpdate(P, dt) {
  if (!(P.koT > 0)) return;
  P.koT -= dt;
  if (P.koT <= KO_UP && !P.koSenzu) {   // se come la semilla y empieza a levantarse
    P.koSenzu = true;
    addText(P.x, P.y - 30, '¡Semilla de reserva!', '#6cff7a', true);
    burst(P.x, P.y - 6, '#6cff7a', 14, 2, 2);
  }
  if (P.koT <= 0) { P.koT = 0; P.koSenzu = false; reserveRevive(P); }
}
function reserveRevive(P) {
  P.halo = true;   // ya "murió" una vez: aureola por el resto de la partida, como en el Otro Mundo
  // Zenkai (2.15.1): los Saiyajin vuelven más fuertes de estar al borde de la muerte. +20% de vida máxima ya;
  // el +20% de daño sale de P.halo en dmgMult
  P.maxHp = Math.round(P.maxHp * (1 + ZENKAI));
  P.hp = Math.round(P.maxHp * 0.5); P.inv = 3;   // 3 s sin recibir daño
  // Explosión de Ki: daña a todo lo de alrededor (también a los jefes) y borra los disparos enemigos cercanos
  G.novas.push({ x: P.x, y: P.y, r: 0, maxR: 170, dmg: 30 + G.level * 3, hit: new Set(), color: '#ffe14d', kb: 22, owner: P, aid: 'ki' });
  for (const s of G.shots) if (Math.hypot(s.x - P.x, s.y - P.y) < 220) s.dead = true;
  G.shake = Math.max(G.shake, 0.6);
  for (const e of G.enemies) {   // y la onda aparta a los enemigos de alrededor (a los jefes, poco)
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy) || 1;
    if (d > 130) continue;
    const ox = e.x, oy = e.y, push = (130 - d) * (e.boss ? 0.25 : 0.9) + (e.boss ? 0 : 30);
    e.x += dx / d * push; e.y += dy / d * push;
    keepOnGround(e, ox, oy);
  }
  burst(P.x, P.y, '#6cff7a', 30, 5, 3);
  ring(P.x, P.y, 90, 0.5, '#6cff7a');
  ring(P.x, P.y, 170, 0.6, '#ffe14d');
  if (P === G.me) announce('¡Zenkai! Vuelves más fuerte: +20% de daño y de vida', '#ffe14d');
  sfx('boom');
}
function update(dt) {
  const k = dt * 60;
  G.t += dt;
  moveLocal(dt);
  if (G.me) G.me.aim = manualAim();   // los jugadores remotos mandan su apuntado con la posición
  if (G.localCoop && G.players[1]) G.players[1].aim = null;   // el jugador 2 apunta automáticamente al enemigo más cercano
  for (const P of G.players) {
    if (P.gone) continue;
    if (P !== G.me && P.tx !== undefined && !P.dead && !fusionLocked(P)) { // jugadores remotos: suavizar su posición
      const a = Math.min(1, dt * 15);
      P.x += (P.tx - P.x) * a; P.y += (P.ty - P.y) * a;
    }
    // Pidió la fusión y el compañero no respondió a tiempo: se transforma normal
    if (P.fuseReq && G.t - P.fuseReq >= FUSION_WINDOW && !G.fusion) { P.fuseReq = 0; doTransform(P); }
    if (!P.dead && P.ki >= 100 && P.transformed <= 0 && !rule('notrans')) P.kiHold = Math.min(KI_FOCUS_TIME, (P.kiHold || 0) + dt);
    if (P.transformLock > 0) P.transformLock -= dt;
    if (P.transformed > 0) {
      P.transformed -= dt;
      P.formHoldT = (P.formHoldT || 0) + dt;   // staying transformed long enough auto-climbs to the next tier
      if (P.formHoldT >= TIER_HOLD_TIME) { P.formHoldT = 0; autoEscalateForm(P); }
      if (P.transformed <= 0) { P.transformed = 0; P.formHoldT = 0; if (P === G.me) announce('La transformación ha terminado', '#cccccc'); }
      else if (Math.random() < 0.4) G.fx.push({ type: 'spark', x: P.x + rand(-10, 10), y: P.y + rand(-5, 12), vx: 0, vy: -rand(1, 2.5), t: 0.4, color: formAura(P), size: 2 });
    } else P.formHoldT = 0;
    if (P.inv > 0) P.inv -= dt;
    if (P.stone > 0) P.stone -= dt;   // petrificado (Dabura)
    if (P.candy > 0) P.candy -= dt;   // caramelo (Majin Buu)
    if (P.swapBody > 0) P.swapBody -= dt;   // cuerpo cambiado (Ginyu)
    if (P.invert > 0) P.invert -= dt;
    if (P.kaioken > 0) P.kaioken -= dt;
    if (P.tripT > 0) P.tripT -= dt;   // Mr. Satán tirado en el piso
    koUpdate(P, dt);   // Semilla de reserva: la caída
    if (P.poseT > 0) P.poseT -= dt;
    if (P.c.flee && !P.dead) {   // con poca vida sale corriendo (una vez por cada vez que baja)
      if (P.hp < P.maxHp * 0.3 && !P.fleeing) { P.fleeing = true; addText(P.x, P.y - 30, '¡Me duele el estómago!', '#ffd93b', true); }
      else if (P.hp > P.maxHp * 0.4) P.fleeing = false;
    }
    if (P.immortal > 0) P.immortal -= dt;
    if (P.castT > 0) P.castT -= dt;
    if (P.punchT > 0) P.punchT -= dt;
    const regen = (P.c.regen || 0) + perk(P, 'regen') + 0.25 * (P.passives.regen || 0);   // + Regeneración namekiana
    if (!P.dead && regen) healPlayer(P, regen * dt);
    passiveTicks(P, dt);
  }
  updateDowned(dt);
  updateFusion(dt);
  updateSpawning(dt);
  // También dispara el compañero absorbido: Gogeta usa las técnicas de los dos
  for (const P of G.players) if (!P.dead && !P.gone && !(P.koT > 0)) fireAttacks(P, dt);   // (tirado en el piso no ataca)
  updateProjectiles(k, dt);
  updateBeams(dt);
  updateEbeams(dt);
  updateDecoys(dt);
  updateHelpers(dt, k);
  for (const z of G.zones) z.t -= dt;
  G.zones = G.zones.filter(z => z.t > 0);
  if (G.blind > 0) G.blind -= dt;
  for (const P of G.players) updateOrbit(P, dt);
  updateNovas(dt);
  updateEnemies(k, dt);
  updateShots(k, dt);
  updatePickups(k);
  if (G.snake) snakeUpdate(dt);

  for (const P of G.players) {
    if (P.dead || P.gone || P.hp > 0) continue;
    if (P.koT > 0) { P.hp = 1; continue; }   // ya está en el piso (Semilla de reserva): se levanta enseguida
    if (P.senzuLeft > 0 && !isFusedBody(P)) {   // Semilla de reserva: cae, queda tirado un momento y se levanta
      P.senzuLeft--;
      P.hp = 1; P.koT = KO_TIME;   // al terminar la caída revive (koUpdate → reserveRevive)
      P.punchT = P.castT = P.tripT = P.poseT = 0;
      burst(P.x, P.y, '#ff4d4d', 16, 3, 3);
      G.shake = Math.max(G.shake, 0.3);
      sfx('hurt');
      continue;
    }
    P.hp = 0; P.dead = true; P.transformed = 0; P.revive = 0;
    burst(P.x, P.y, '#ff4d4d', 24, 4, 3);
    if (isFusedBody(P)) announce('¡Gogeta ha caído!', '#ff5c5c');
    else if (G.players.length > 1) announce('¡{name} ha caído! Acércate para reanimarlo', '#ff5c5c', { name: P.name });
  }
  tickFx(dt, k);

  if (!alivePlayers().length) endRun(false);
  else if (G.victoryAt && G.t >= G.victoryAt) endRun(true);
  else { updateWaveProgress(); if (G.teamUlt >= TEAM_ULT_MAX) triggerTeamUltimate(); }
}
// Shared co-op ultimate: only meaningful with 2+ living, non-ally players (solo play never fills it).
const TEAM_ULT_MAX = 100;
const teamUltActive = () => G.players.filter(p => !p.dead && !p.gone && !p.ally).length >= 2;
function triggerTeamUltimate() {
  G.teamUlt = 0;
  const team = G.players.filter(p => !p.dead && !p.gone && !p.ally);
  if (team.length < 2) return;
  const mx = team.reduce((s, p) => s + p.x, 0) / team.length, my = team.reduce((s, p) => s + p.y, 0) / team.length;
  const names = team.map(p => p.name).join(' + ');
  announce(t('¡Ataque combinado de {names}!', { names }), '#ffe14d');
  G.shake = Math.max(G.shake, 1);
  sfx('boom'); sfx('power');
  for (const P of team) {
    burst(P.x, P.y, formAura(P) || P.c.aura, 26, 7, 4);
    G.novas.push({ x: P.x, y: P.y, r: 0, maxR: 150, dmg: 70 + G.level * 6, hit: new Set(), color: P.c.aura, kb: 22, owner: P, aid: 'ki', stun: 0.4 });
  }
  // A third, bigger shared burst at the team's midpoint so it reads as one combined attack, not two separate ones
  G.novas.push({ x: mx, y: my, r: 0, maxR: 190, dmg: 90 + G.level * 8, hit: new Set(), color: '#ffe14d', kb: 10, owner: team[0], aid: 'ki', stun: 0.6 });
  burst(mx, my, '#ffffff', 40, 8, 5);
  playAnim('explosion', mx, my, 3.5);
}
// Brotato-style wave break: once the wave's kill target is reached, pause play (same G.mode='play'
// gate the level-up 'choice' screen uses) and open a shop where the kill-money can be spent.
function updateWaveProgress() {
  if (G.waveShop || G.waveKills < G.waveTarget || G.round || G.victoryAt) return;
  G.waveShop = { waiting: new Set(G.players.filter(p => !p.gone && !p.ally).map(p => p.id)), offers: {} };
  for (const id of G.waveShop.waiting) G.waveShop.offers[id] = rollWaveShopOffers();
  G.mode = 'shop';
  announce('¡Oleada {n} superada!', '#ffd93b', { n: G.wave });
  sfx('levelup');
}
// Each player sees a small rotating selection (not the whole table at once) so the shop stays
// readable - rerolls aren't needed since the whole table is cheap enough to see again next wave.
function rollWaveShopOffers() { return shuffle(WAVE_SHOP_ITEMS.map(it => it.id)).slice(0, 5); }
function buyWaveItem(pid, itemId) {
  const shop = G.waveShop;
  if (!shop || !shop.waiting.has(pid)) return;
  const P = G.players.find(p => p.id === pid);
  const item = WAVE_SHOP_ITEMS.find(it => it.id === itemId);
  if (!P || !item) return;
  const lvl = P.shop[item.stat] || 0;
  if (lvl >= item.max) return;
  const cost = waveShopCost(item, lvl);
  if (G.money < cost) return;
  G.money -= cost;
  P.shop[item.stat] = lvl + 1;
  if (item.apply) item.apply(P);
  addText(P.x, P.y - 30, item.name, item.color, true);
  sfx('pickup', 0.2);
  if (P === G.me) syncWaveShopUI();
}
function readyWaveShop(pid) {
  const shop = G.waveShop;
  if (!shop || !shop.waiting.has(pid)) return;
  shop.waiting.delete(pid);
  if (!shop.waiting.size) finishWaveShop();
  else if (G.me && G.me.id === pid) syncWaveShopUI();
}
function finishWaveShop() {
  G.waveShop = null;
  G.wave++;
  G.waveKills = 0;
  G.waveTarget = waveTarget(G.wave, G.players.filter(p => !p.gone && !p.ally).length);
  G.mode = 'play';
  announce('¡Oleada {n}!', '#8fd8ff', { n: G.wave });
}
const waveShopCost = (item, lvl) => Math.round(item.cost * Math.pow(1.22, lvl));
// Local co-op shares one screen: players buy one at a time, same turn-order pattern as choicePlayer().
const waveShopPlayer = () => G && G.localCoop && G.waveShop
  ? (G.players.find(P => G.waveShop.waiting.has(P.id)) || G.me)
  : G.me;
function requestBuyWaveItem(itemId) {
  const P = waveShopPlayer();
  if (isAuthority()) buyWaveItem(P.id, itemId);
  else Net.send({ t: 'waveBuy', item: itemId });
  if (G.localCoop || !G.net) syncWaveShopUI(true);
}
function requestReadyWaveShop() {
  const P = waveShopPlayer();
  if (G.net) showWaveShopWaiting();
  if (isAuthority()) readyWaveShop(P.id);
  else Net.send({ t: 'waveReady' });
  if (G.localCoop && !G.net) syncWaveShopUI(true);
}
let shownWaveShop = '';
function syncWaveShopUI(force) {
  if (!G.waveShop) { if (shownWaveShop) { $('waveShop').classList.add('hidden'); shownWaveShop = ''; } return; }
  const P = waveShopPlayer();
  // Rebuild only when something a player would actually see has changed (whose turn it is, the shared
  // money total, or that player's own purchase levels) - not every frame, which would thrash the DOM
  // and make every button a moving target.
  const key = `${P.id}:${G.money}:${Object.values(P.shop).join(',')}`;
  if (!force && shownWaveShop === key) return;
  shownWaveShop = key;
  if (!G.waveShop.waiting.has(P.id)) { showWaveShopWaiting(); return; }
  renderWaveShop(P);
  $('waveShop').classList.remove('hidden');
}
function showWaveShopWaiting() {
  $('waveShopList').innerHTML = '';
  $('waveShopTitle').textContent = t('Esperando a los demás guerreros...');
  $('waveShopMoney').textContent = G.money;
  $('waveShopGo').classList.add('hidden');
  $('waveShop').classList.remove('hidden');
}
function renderWaveShop(P) {
  $('waveShopTitle').textContent = G.localCoop ? `${P.name}: ${t('Tienda de la oleada')}` : t('Tienda de la oleada');
  $('waveShopMoney').textContent = G.money;
  $('waveShopGo').classList.remove('hidden');
  $('waveShopGo').textContent = t('Siguiente oleada ▶');
  const offers = (G.waveShop.offers[P.id] || []).map(id => WAVE_SHOP_ITEMS.find(it => it.id === id)).filter(Boolean);
  const list = $('waveShopList');
  list.innerHTML = '';
  for (const item of offers) {
    const lvl = P.shop[item.stat] || 0, maxed = lvl >= item.max, cost = maxed ? 0 : waveShopCost(item, lvl);
    const el = document.createElement('div');
    el.className = 'shop-item' + (maxed ? ' maxed' : '');
    el.innerHTML = `<div class="shop-icon"></div><div class="shop-body"><div class="shop-name"></div>
      <div class="shop-desc"></div><div class="shop-pips"></div><button class="btn shop-buy"></button></div>`;
    const icon = el.querySelector('.shop-icon'); icon.textContent = item.icon; icon.style.background = item.color;
    el.querySelector('.shop-name').textContent = t(item.name);
    el.querySelector('.shop-desc').textContent = t(item.desc);
    const pips = el.querySelector('.shop-pips');
    for (let i = 0; i < item.max; i++) { const p = document.createElement('i'); if (i < lvl) p.className = 'on'; pips.appendChild(p); }
    const btn = el.querySelector('.shop-buy');
    btn.textContent = maxed ? t('Completo') : t('Comprar · {n}', { n: cost });
    btn.disabled = maxed || G.money < cost;
    btn.onclick = () => requestBuyWaveItem(item.id);
    list.appendChild(el);
  }
}

// ─── Render del mundo (búfer pixel art) ──────────────────────────────────────
function beginWorld(cx, cy, shx = 0, shy = 0) {
  camX = Math.round(cx); camY = Math.round(cy);
  bctx.setTransform(1, 0, 0, 1, Math.round(BW / 2 - camX + shx), Math.round(BH / 2 - camY + shy));
  bctx.imageSmoothingEnabled = false;
}
function presentWorld() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, BW * PIX, BH * PIX);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function localSplitPair() {
  if (!G.localCoop || G.players.length < 2) { G.splitView = false; return null; }
  const pair = G.players.slice(0, 2);
  if (pair.some(P => !P || P.dead || P.gone || P.hidden)) { G.splitView = false; return null; }
  const dx = Math.abs(pair[0].x - pair[1].x), dy = Math.abs(pair[0].y - pair[1].y);
  // Separate and rejoin thresholds provide hysteresis so the divider never chatters.
  const separate = dx > BW * 0.42 || dy > BH * 0.55;
  const rejoined = dx < BW * 0.32 && dy < BH * 0.42;
  G.splitView = G.splitView ? !rejoined : separate;
  return G.splitView ? pair : null;
}
function makeSplitLayout(pair) {
  const vertical = W >= H;
  if (vertical) return { vertical, views: [
    { player: pair[0], x: 0, y: 0, w: W / 2, h: H, worldW: BW / 2, worldH: BH },
    { player: pair[1], x: W / 2, y: 0, w: W / 2, h: H, worldW: BW / 2, worldH: BH },
  ] };
  return { vertical, views: [
    { player: pair[0], x: 0, y: 0, w: W, h: H / 2, worldW: BW, worldH: BH / 2 },
    { player: pair[1], x: 0, y: H / 2, w: W, h: H / 2, worldW: BW, worldH: BH / 2 },
  ] };
}
function presentWorldSlice(view) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (splitLayout.vertical) {
    const sw = Math.ceil(BW / 2), sx = Math.floor((BW - sw) / 2);
    ctx.drawImage(buf, sx, 0, sw, BH, Math.round(view.x * DPR), 0, Math.ceil(view.w * DPR), canvas.height);
  } else {
    const sh = Math.ceil(BH / 2), sy = Math.floor((BH - sh) / 2);
    ctx.drawImage(buf, 0, sy, BW, sh, 0, Math.round(view.y * DPR), canvas.width, Math.ceil(view.h * DPR));
  }
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
function splitScreenPoint(x, y, view) {
  return [view.x + (x - view.player.x + view.worldW / 2) * view.w / view.worldW,
    view.y + (y - view.player.y + view.worldH / 2) * view.h / view.worldH];
}
function drawSplitDivider() {
  if (!splitLayout) return;
  ctx.save();
  const g = splitLayout.vertical ? ctx.createLinearGradient(W / 2 - 5, 0, W / 2 + 5, 0) : ctx.createLinearGradient(0, H / 2 - 5, 0, H / 2 + 5);
  g.addColorStop(0, 'rgba(45,220,255,0)'); g.addColorStop(0.5, 'rgba(225,250,255,.95)'); g.addColorStop(1, 'rgba(166,78,255,0)');
  ctx.fillStyle = 'rgba(5,9,28,.86)';
  if (splitLayout.vertical) ctx.fillRect(W / 2 - 2, 0, 4, H); else ctx.fillRect(0, H / 2 - 2, W, 4);
  ctx.fillStyle = g;
  if (splitLayout.vertical) ctx.fillRect(W / 2 - 5, 0, 10, H); else ctx.fillRect(0, H / 2 - 5, W, 10);
  splitLayout.views.forEach((v, i) => {
    const x = v.x + v.w / 2, y = v.y + 24;
    hudText(`P${i + 1} · ${v.player.c.name || v.player.name}`, x, y, 13, PLAYER_COLORS[i], 'center');
  });
  ctx.restore();
}
const GEM_COLORS = { 1: ['#2a6fd6', '#6fd0ff', '#e8fbff'], 3: ['#1f9a4a', '#6cff8f', '#eaffef'], 10: ['#a02aa8', '#ff6cf0', '#ffe8fd'],
  30: ['#a8241f', '#ff5c4d', '#ffe8e6'] };   // gema roja y más grande: orbes juntados
function drawGem(c, x, y, v) {
  if (v >= 30) {
    c.save(); c.translate(Math.round(x), Math.round(y)); c.scale(2, 2);
    drawGemShape(c, 0, 0, GEM_COLORS[30]);
    c.restore();
    return;
  }
  drawGemShape(c, Math.round(x), Math.round(y), GEM_COLORS[v >= 10 ? 10 : v >= 3 ? 3 : 1]);
}
function drawGemShape(c, x, y, [d, m, l]) {
  c.fillStyle = d; c.fillRect(x - 1, y - 4, 3, 9); c.fillRect(x - 2, y - 3, 5, 7); c.fillRect(x - 3, y - 1, 7, 3);
  c.fillStyle = m; c.fillRect(x - 1, y - 3, 3, 7); c.fillRect(x - 2, y - 1, 5, 3);
  c.fillStyle = l; c.fillRect(x - 1, y - 2, 1, 2);
}
// Moneda de la tienda de oleada: un disco dorado chico, más grande para los botines de élites/jefes
function drawCoin(c, x, y, v) {
  const r = v >= 20 ? 5 : v >= 5 ? 4 : 3;
  x = Math.round(x); y = Math.round(y);
  c.fillStyle = '#9a6a0a'; circle(c, x, y + 1, r);
  c.fillStyle = '#ffd93b'; circle(c, x, y, r);
  c.fillStyle = '#ffe98a'; circle(c, x - r * 0.3, y - r * 0.3, r * 0.45);
}
// Semilla del Ermitaño: un poroto en pixel art (con su ranura y brillo) que flota, rodeado de un
// aura clara que late y chispitas que suben, para que se distinga sobre el pasto
const SENZU_ART = [
  '...oooooo...',
  '..ommmmmmoo.',
  '.ommlhmmmmdo',
  'ommllmmmmmdo',
  'ommmmmmmmddo',
  '.odmmsssmddo',
  '..oddddddoo.',
  '...oooooo...',
];
const SENZU_PAL = { o: '#10300a', d: '#2e6e1e', m: '#5fbf3a', l: '#9fe870', h: '#f0ffe0', s: '#245218' };
// La semilla con un borde claro de un píxel alrededor (se arma una vez)
let SENZU_LINED = null;
function senzuLined() {
  if (SENZU_LINED) return SENZU_LINED;
  const im = ITEM_IMG.senzu, W = im.width + 2, H = im.height + 2, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.drawImage(im, 1, 1);
  const d = x.getImageData(0, 0, W, H).data, on = (i, j) => i >= 0 && j >= 0 && i < W && j < H && d[(j * W + i) * 4 + 3] > 0;
  x.fillStyle = '#fffad6';
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) x.fillRect(i, j, 1, 1);
  }
  return SENZU_LINED = cv;
}
function drawSenzu(c, x, y, t = 0) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 4);
  y = Math.round(y + Math.sin(t * 3) * 2); x = Math.round(x);
  // Haz de luz cortito que sube (2.18.1): se ve de lejos aunque el pasto sea del mismo verde
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, y - 34, 0, y);
  g.addColorStop(0, 'rgba(255,250,200,0)'); g.addColorStop(1, `rgba(255,250,200,${0.3 + 0.2 * pulse})`);
  c.fillStyle = g; c.fillRect(x - 4, y - 34, 8, 34);
  c.restore();
  // Aura: blanca y amarilla que late (2.15.1; verde se perdía sobre el pasto)
  c.globalAlpha = 0.22 + 0.14 * pulse; c.fillStyle = '#fff3a0'; circle(c, x, y, 13 + pulse * 3);
  c.globalAlpha = 0.35 + 0.15 * pulse; c.fillStyle = '#fffbe0'; circle(c, x, y, 8);
  // Chispitas que suben
  for (let i = 0; i < 4; i++) {
    const ph = (t * 0.9 + i / 4) % 1;
    c.globalAlpha = 1 - ph; c.fillStyle = i % 2 ? '#ffffff' : '#ffe680';
    c.fillRect(Math.round(x + Math.sin(i * 2.3 + t * 2) * 8), Math.round(y - 5 - ph * 16), 1, 1);
  }
  c.globalAlpha = 1;
  // El poroto: el de Buu's Fury (10×10); hasta que carga, el dibujado de 12×8
  if (ITEM_IMG.senzu) { c.imageSmoothingEnabled = false; c.drawImage(senzuLined(), x - 6, y - 6); return; }
  SENZU_ART.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      c.fillStyle = SENZU_PAL[ch];
      c.fillRect(x - 6 + i, y - 4 + j, 1, 1);
    }
  });
}
// Segunda vida del HUD (Semilla de reserva): la semilla dentro de un corazón, para no confundirla con la que cura
const LIFE_HEART = [
  '..ooooo...ooooo..',
  '.orrrrro.orrrrro.',
  'orrwwrrrorrrrrrro',
  'orrwrrrrrrrrrrrro',
  'orrrrrrrrrrrrrrro',
  'orrrrrrrrrrrrrrro',
  'orrrrrrrrrrrrrrro',
  '.orrrrrrrrrrrrro.',
  '..orrrrrrrrrrro..',
  '...orrrrrrrrro...',
  '....orrrrrrro....',
  '.....orrrrro.....',
  '......orrro......',
  '.......oro.......',
  '........o........',
];
const LIFE_HEART_PAL = { o: '#2a0610', r: '#ff3d5c', w: '#ffc4cf' };
function hudReserveSenzu(x, y, ready) {
  const s = 1.4;
  const px = (art, pal, ox, oy) => art.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      ctx.fillStyle = pal[row[i]];
      ctx.fillRect(Math.round(x + (i + ox) * s), Math.round(y + (j + oy) * s), Math.ceil(s), Math.ceil(s));
    }
  });
  ctx.globalAlpha = ready ? 1 : 0.35;
  px(LIFE_HEART, LIFE_HEART_PAL, -8.5, -7.5);
  if (ITEM_IMG.senzu) { ctx.imageSmoothingEnabled = false; ctx.drawImage(ITEM_IMG.senzu, Math.round(x - 5 * s), Math.round(y - 5 * s), Math.round(10 * s), Math.round(10 * s)); }
  else px(SENZU_ART, SENZU_PAL, -6, -5);
  ctx.globalAlpha = 1;
  if (!ready) { ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 11, y + 9); ctx.lineTo(x + 11, y - 9); ctx.stroke(); }
}
// Cápsula de Bulma: al recogerla, toda la experiencia del mapa vuela hacia ti
// (2.15.1) una cápsula Hoi-Poi en pixel art, con el mismo estilo que los objetos de GBA: cilindro blanco
// sombreado, franja azul con el número, tapa gris y el botón amarillo en la punta
const CAPSULE_ART = [
  '...oooooooooooo...',
  '..ohhhhhhhhhkccco.',
  '.ohhwwwwwwwwkcccyo',
  '.ohwwwrrwrwwkcccyo',
  '.owwwwrrwrwwkcccyo',
  '.owwwwrrwrwwkcccYo',
  '.osswwwwwwwwkdddso',
  '..ossssssssskdddo.',
  '...oooooooooooo...',
];
const CAPSULE_PAL = { o: '#141428', h: '#ffffff', w: '#e9ecf4', s: '#a3a9c0', c: '#c9cfdf', d: '#8a90a8', k: '#4a4f66', r: '#2f7fe0', y: '#ffd93b', Y: '#b07a10' };   // r: la franja (azul, como la cápsula de Bulma)
function drawCapsule(c, x, y, t = 0) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 6);
  y = Math.round(y + Math.sin(t * 3 + 1) * 2); x = Math.round(x);
  c.save();
  c.globalAlpha = 0.25 + 0.2 * pulse; c.fillStyle = '#8fd8ff'; circle(c, x, y, 13 + pulse * 3);
  c.restore();
  CAPSULE_ART.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '.') continue;
      c.fillStyle = CAPSULE_PAL[row[i]];
      c.fillRect(x - 9 + i, y - 4 + j, 1, 1);
    }
  });
}
// Esfera definitiva: orbe procedural (sin arte externo) que late y gira - lo bastante raro
// como para que valga la pena hacerlo notar.
function drawUltimateOrb(c, x, y, t = 0) {
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  y = Math.round(y + Math.sin(t * 3 + 2) * 2); x = Math.round(x);
  c.save();
  c.globalAlpha = 0.3 + 0.25 * pulse; c.fillStyle = '#ffe14d'; circle(c, x, y, 14 + pulse * 4);
  c.globalAlpha = 1;
  c.fillStyle = '#b06cff'; circle(c, x, y, 8);
  c.fillStyle = '#ffe14d'; circle(c, x, y, 5);
  c.fillStyle = '#ffffff'; circle(c, x - 2, y - 2, 2);
  c.strokeStyle = '#fff6c0'; c.lineWidth = 1; c.globalAlpha = 0.6 + 0.3 * pulse;
  for (let i = 0; i < 4; i++) {
    const a = t * 2.2 + i * Math.PI / 2, rr = 11 + pulse * 2;
    c.beginPath(); c.moveTo(x + Math.cos(a) * (rr - 3), y + Math.sin(a) * (rr - 3)); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); c.stroke();
  }
  c.restore();
}
// "¡POOF!" al abrir la cápsula: bolitas de humo blanco con borde que se inflan y se desvanecen
const POOF_PUFFS = [[0, 0, 5], [-6, -2, 4], [6, -1, 4], [-3, -6, 4], [4, -6, 3], [-7, 4, 3], [7, 4, 3]];
function drawPoof(c, f) {
  const p = 1 - f.t / f.dur, k = 0.4 + p * 1.2;
  c.globalAlpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
  for (const pass of [0, 1]) for (const [dx, dy, r] of POOF_PUFFS) {
    c.fillStyle = pass ? (dy < -3 ? '#ffffff' : '#e3e6ee') : '#5a5f78';   // primero los bordes, después el relleno
    circle(c, Math.round(f.x + dx * k), Math.round(f.y + dy * k), Math.round(r * k + (pass ? 0 : 1)));
  }
  c.globalAlpha = 1;
}
function poof(x, y) {
  G.fx.push({ type: 'poof', x, y, t: 0.5, dur: 0.5 });
  emit(['p', Math.round(x), Math.round(y)]);
}

// Un rayo desde (ax, ay) en la dirección b.ang: crece al salir y se afina al apagarse
// (los de los jugadores salen de sus manos; los de los jefes, desde donde los dispararon)
// Zona de gravedad (Puipui): se marca y a los 0,6 s empieza a pesar
// Caja de regalo de Mr. Satán: roja con moño dorado; al final tiembla y titila
function drawGift(c, x, y, left) {
  const sh = left < 0.6 ? Math.round(Math.sin(G.t * 60) * 1.5) : 0, X = Math.round(x) + sh, Y = Math.round(y);
  if (left < 0.6 && Math.floor(left * 14) % 2) return;
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(X - 9, Y + 5, 18, 3);
  c.fillStyle = '#5a0a1a'; c.fillRect(X - 9, Y - 12, 18, 17);
  c.fillStyle = '#e23b3b'; c.fillRect(X - 8, Y - 11, 16, 15);
  c.fillStyle = '#ff7a7a'; c.fillRect(X - 8, Y - 11, 16, 3);
  c.fillStyle = '#ffd93b'; c.fillRect(X - 1, Y - 11, 3, 15); c.fillRect(X - 8, Y - 6, 16, 3);
  c.fillRect(X - 5, Y - 16, 4, 4); c.fillRect(X + 2, Y - 16, 4, 4);
}
function drawShadowSoldier(c, d, t) {
  const bob = Math.sin(t * 5 + d.x * 0.03) * 1.5, x = Math.round(d.x), y = Math.round(d.y + bob);
  c.save(); c.translate(x, y); c.globalCompositeOperation = 'lighter';
  c.globalAlpha = 0.22 + 0.06 * Math.sin(t * 9); c.fillStyle = '#7552ff';
  c.beginPath(); c.ellipse(0, -7, 15, 25, 0, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 5; i++) {
    const ph = (t * 1.4 + i * 0.21) % 1, sx = Math.sin(i * 4.3 + t) * 11;
    c.globalAlpha = (1 - ph) * 0.65; c.fillStyle = i % 2 ? '#4ecfff' : '#8b62ff';
    c.beginPath(); c.moveTo(sx - 2, -2 - ph * 25); c.lineTo(sx, -10 - ph * 28); c.lineTo(sx + 2, -2 - ph * 25); c.closePath(); c.fill();
  }
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.fillStyle = '#0a0b17'; c.strokeStyle = '#5a49c7'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-7, -22); c.lineTo(0, -28); c.lineTo(7, -22); c.lineTo(6, -13); c.lineTo(-6, -13); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#64ddff'; c.fillRect(-4, -21, 3, 2); c.fillRect(2, -21, 3, 2);
  c.fillStyle = '#111329'; c.beginPath(); c.moveTo(-8, -13); c.lineTo(8, -13); c.lineTo(11, 6); c.lineTo(4, 13); c.lineTo(0, 5); c.lineTo(-4, 13); c.lineTo(-11, 6); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#684cff'; c.fillRect(-7, -10, 14, 2); c.fillRect(-1, -13, 2, 17);
  c.strokeStyle = '#93eaff'; c.lineWidth = 2; c.beginPath(); c.moveTo(7, -7); c.lineTo(17, 9); c.stroke();
  c.strokeStyle = '#1a1630'; c.lineWidth = 4; c.beginPath(); c.moveTo(8, -6); c.lineTo(18, 10); c.stroke();
  c.restore();
}
function drawZone(c, z, t) {
  const on = z.t < z.dur - 0.6, a = Math.min(1, (z.dur - z.t) / 0.6) * Math.min(1, z.t / 0.5);
  c.save();
  c.globalAlpha = (on ? 0.42 : 0.18) * a; c.fillStyle = '#6a22ff';
  c.beginPath(); c.ellipse(z.x, z.y, z.r, z.r * 0.75, 0, 0, Math.PI * 2); c.fill();
  c.globalAlpha = 0.9 * a; c.strokeStyle = '#d8b8ff'; c.lineWidth = 2; c.stroke();
  if (on) {   // flechitas que bajan: algo te aplasta
    c.fillStyle = '#e8d8ff';
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * Math.PI * 2, ph = (t * 1.5 + i / 6) % 1, x = z.x + Math.cos(ang) * z.r * 0.55, y = z.y + Math.sin(ang) * z.r * 0.4 - 12 + ph * 16;
      c.globalAlpha = 0.8 * a * (1 - ph);
      c.fillRect(Math.round(x) - 2, Math.round(y), 5, 1); c.fillRect(Math.round(x) - 1, Math.round(y) + 1, 3, 1); c.fillRect(Math.round(x), Math.round(y) + 2, 1, 1);
    }
  }
  c.restore();
}
function drawBeamBody(c, ax, ay, b, t) {
  const grow = Math.min(1, (b.dur - b.t) / 0.08), fade = Math.min(1, b.t / 0.15);
  const len = b.len * grow, w = Math.max(2, b.width * fade);
  const wob = Math.sin(t * 60) * 1.5;
  c.save(); c.translate(Math.round(ax), Math.round(ay)); c.rotate(b.ang);
  c.globalAlpha = 0.35; c.fillStyle = b.color; c.fillRect(0, -(w * 0.8 + wob), len, (w * 0.8 + wob) * 2);
  c.globalAlpha = 1;
  if (sfxReady()) {   // el cuerpo del rayo se arma repitiendo el tramo del sprite (32x8) a lo ancho del rayo
    const th = w * 1.1, tw = 32 * th / 8, [img, sx, sy] = beamTile(b.color);
    for (let x = 0; x < len; x += tw) {
      const seg = Math.min(tw, len - x);
      c.drawImage(img, sx, sy, Math.max(1, 32 * seg / tw), 8, Math.round(x), Math.round(-th / 2), Math.ceil(seg), Math.round(th));
    }
    c.fillStyle = b.core;
  } else {
    c.fillRect(0, -w / 2, len, w);
    c.fillStyle = b.core; c.fillRect(0, -w * 0.22, len, w * 0.44);
  }
  circle(c, 0, 0, w * 0.75); circle(c, len, 0, w * 0.85);
  c.fillStyle = b.color; c.globalAlpha = 0.5; circle(c, len, 0, w * 1.25);
  c.restore();
}
// ─── Ataques de los compañeros (online, 2.24.0) ───
// Con 4 jugadores, en un celular, los ataques de todos juntos tapan la pantalla. Los tuyos se ven como siempre; los
// de los compañeros se dibujan en una capa aparte que se pega con ALLY_ALPHA (así se atenúa todo el dibujo junto, sin
// tocar cada función de dibujo). En el invitado, el dueño llega en la instantánea (ownerId).
const ALLY_ALPHA = 0.4;
let allyLayer = null;
const hasAllies = () => !!(G.me && G.players.length > 1 && G.players.some(P => P !== G.me && !P.gone));
function isAlly(o) {
  const id = o.owner ? o.owner.id : o.ownerId;
  if (id === undefined || id === null || id < 0 || id === G.me.id) return false;
  return !(G.fusion && G.fusion.ids.includes(id) && G.fusion.ids.includes(G.me.id));   // en la fusión, lo de la fusión es tuyo
}
function allyPass(c, list, draw) {
  let L = null;
  for (const o of list) {
    if (!isAlly(o)) continue;
    if (!L) {
      const cv = c.canvas;
      if (!allyLayer) allyLayer = document.createElement('canvas');
      if (allyLayer.width !== cv.width || allyLayer.height !== cv.height) { allyLayer.width = cv.width; allyLayer.height = cv.height; }
      L = allyLayer.getContext('2d');
      L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, cv.width, cv.height);
      L.setTransform(c.getTransform()); L.imageSmoothingEnabled = false; L.globalAlpha = 1;
    }
    draw(L, o);
  }
  if (!L) return;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = ALLY_ALPHA; c.drawImage(allyLayer, 0, 0); c.restore();
}
function renderWorldView(V) {
  const t = G.t, c = bctx;
  const sh = G.shake > 0 && G.mode === 'play' ? G.shake * 7 * SAVE.fx.shake : 0;   // en la pausa o eligiendo mejora no tiembla
  beginWorld(V.x, V.y, Math.round(rand(-sh, sh)), Math.round(rand(-sh, sh)));
  const props = drawGround(c, camX, camY, BW, BH);
  if (G.snake) snakeDrawWorld(c, t);   // Camino de la Serpiente: puntos de control, nubes Kinton, fantasma

  // Zonas de impacto telegrafiadas
  for (const z of G.zones || []) drawZone(c, z, t);
  for (const h of G.hazards) {
    const p = Math.max(0, 1 - h.t / h.dur), mark = h.dmg === 0 || h.mark;   // marca sin daño: verde
    if (h.ball) {   // Death Ball: la bola baja desde Freezer hasta la marca
      const bx = h.ball.x + (h.x - h.ball.x) * p, by = h.ball.y + (h.y - h.ball.y) * p, br = h.ball.r * (0.6 + 0.4 * p);
      c.save(); c.globalAlpha = 0.35; c.fillStyle = '#ff9a4d'; circle(c, bx, by, br * 1.35); c.globalAlpha = 1;
      c.fillStyle = '#ff5a1f'; circle(c, bx, by, br); c.fillStyle = '#ffd08a'; circle(c, bx - br * 0.25, by - br * 0.25, br * 0.5); c.restore();
    }
    c.fillStyle = mark ? `rgba(60,200,60,${0.2 + p * 0.3})` : `rgba(230,40,30,${0.15 + p * 0.25})`;
    c.beginPath(); c.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = mark ? '#3dff6a' : '#ff3d2a'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(h.x, h.y, h.r * p, h.r * p * 0.75, 0, 0, Math.PI * 2); c.stroke();
  }
  // Recorrido de las embestidas: franja que se va llenando hasta que el jefe sale disparado
  for (const l of G.lanes) {
    const p = Math.min(1, Math.max(0, 1 - l.t / l.dur)), fade = l.t > 0 ? 1 : Math.max(0, 1 + l.t / DASH_TIME);
    c.save(); c.translate(l.x, l.y); c.rotate(Math.atan2(l.dy, l.dx)); c.globalAlpha = fade;
    c.fillStyle = 'rgba(230,40,30,0.18)'; c.fillRect(0, -l.w / 2, l.len, l.w);
    c.fillStyle = `rgba(255,70,40,${0.2 + p * 0.25})`; c.fillRect(0, -l.w / 2, l.len * p, l.w);
    c.strokeStyle = '#ff3d2a'; c.lineWidth = 2; c.strokeRect(0, -l.w / 2, l.len, l.w);
    c.fillStyle = '#ff3d2a';   // punta de flecha al final
    c.beginPath(); c.moveTo(l.len + 12, 0); c.lineTo(l.len - 4, -l.w / 2 - 4); c.lineTo(l.len - 4, l.w / 2 + 4); c.closePath(); c.fill();
    c.restore();
  }
  // Objetos del suelo
  for (const p of G.pickups) {
    if (p.kind === 'xp') drawGem(c, p.x, p.y + Math.sin(t * 5 + p.x), p.v);
    else if (p.kind === 'money') drawCoin(c, p.x, p.y + Math.sin(t * 5 + p.x), p.v);
    // (las semillas, las cápsulas y las Esferas del Dragón se dibujan más abajo, encima de los decorados y los personajes)
  }
  // Ondas expansivas (a ras de suelo). Online, las de los compañeros más transparentes (allyPass)
  const allies = hasAllies();
  for (const n of G.novas) if (!allies || !isAlly(n)) drawNova(c, n, t);
  if (allies) allyPass(c, G.novas, (L, n) => drawNova(L, n, t));

  // Decorados y personajes ordenados por profundidad
  const vw = BW / 2 + 60, vh = BH / 2 + 90, list = [];
  for (const p of props) if (Math.abs(p.x - camX) < vw && Math.abs(p.y - camY) < vh + 60) list.push({ y: p.y, p });
  for (const e of G.enemies) if (Math.abs(e.x - camX) < vw && Math.abs(e.y - camY) < vh) list.push({ y: e.y + 12 * e.scale, e });
  for (const P of G.players) if (!P.gone) list.push({ y: P.y + 12, pl: P });
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.p) drawProp(c, it.p);
    else if (it.pl) drawPlayer(c, it.pl);
    else drawEnemy(c, it.e, t);
  }
  // Semillas y cápsulas (2.18.1) y Esferas del Dragón tiradas: por encima de todo (se ven aunque caigan detrás
  // de un árbol o en medio de una horda); las esferas, además, con un haz de luz que sube.
  // Si se pisan, manda la cápsula, después la esfera y después la semilla (como en el minimapa)
  for (const p of G.pickups) if (p.kind === 'senzu') drawSenzu(c, p.x, p.y, t);
  for (const p of G.pickups) if (p.kind === 'ultimate') drawUltimateOrb(c, p.x, p.y, t);
  for (const p of G.pickups) {
    if (p.kind !== 'ball') continue;
    const by = p.y + Math.round(Math.sin(t * 4) * 2), pulse = 0.5 + 0.5 * Math.sin(t * 5 + p.x);
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(0, by - 70, 0, by);
    g.addColorStop(0, 'rgba(255,170,40,0)'); g.addColorStop(1, `rgba(255,190,70,${0.35 + 0.25 * pulse})`);
    c.fillStyle = g; c.fillRect(p.x - 5, by - 70, 10, 70);
    c.fillStyle = `rgba(255,240,180,${0.25 + 0.2 * pulse})`; c.fillRect(p.x - 1, by - 60, 2, 60);
    c.restore();
    drawDragonBall(c, p.x, by, 6, G.dragonBalls + 1, true);
  }
  for (const p of G.pickups) if (p.kind === 'capsule') drawCapsule(c, p.x, p.y, t);

  // Esferas orbitales
  const drawOrbits = (c, P) => {
    for (const o of orbitPositions(P)) {
      if (o.shield) { c.globalAlpha = 0.25 + 0.15 * Math.sin(t * 8); c.fillStyle = '#bff6ff'; circle(c, o.x, o.y, o.r + 6); }   // Escudo de Ki
      c.globalAlpha = 0.4; c.fillStyle = '#7dffb0'; circle(c, o.x, o.y, o.r + 3); c.globalAlpha = 1;
      c.fillStyle = '#2fbf6a'; circle(c, o.x, o.y, o.r);
      c.fillStyle = '#b8ffd6'; circle(c, o.x - 1, o.y - 1, o.r * 0.6);
      c.fillStyle = '#ffffff'; c.fillRect(Math.round(o.x - 3), Math.round(o.y - 3), 2, 2);
    }
  };
  for (const P of G.players) if (!allies || !isAlly({ owner: P })) drawOrbits(c, P);
  if (allies) allyPass(c, G.players.map(P => ({ owner: P })), (L, o) => drawOrbits(L, o.owner));
  // Proyectiles de los jugadores
  const drawProj = (c, p) => {
    // Elastic/chakra techniques stay visibly connected to the fighter. This is
    // a full limb from the shoulder to the fist, not a detached projectile tail.
    const drawExtendedLimb = (fill, width, glow = null) => {
      const o = p.owner;
      if (!o || o.gone) return;
      const a = Math.atan2(p.y - (o.y - 5), p.x - o.x), sx = o.x + Math.cos(a) * 8, sy = o.y - 6 + Math.sin(a) * 5;
      const dx = p.x - sx, dy = p.y - sy, d = Math.hypot(dx, dy);
      if (d < 8) return;
      const nx = -dy / d, ny = dx / d, bend = Math.sin(p.spin * 0.16 + p.x * 0.025) * Math.min(6, d * 0.035);
      const mx = sx + dx * 0.5 + nx * bend, my = sy + dy * 0.5 + ny * bend;
      c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
      if (glow) {
        c.globalAlpha = 0.28; c.strokeStyle = glow; c.lineWidth = width + 9;
        c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, p.x, p.y); c.stroke(); c.globalAlpha = 1;
      }
      c.strokeStyle = '#3a2020'; c.lineWidth = width + 2.5;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, p.x, p.y); c.stroke();
      c.strokeStyle = fill; c.lineWidth = width;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, p.x, p.y); c.stroke();
      c.globalAlpha = 0.42; c.strokeStyle = '#fff0de'; c.lineWidth = Math.max(1, width * 0.18);
      c.beginPath(); c.moveTo(sx + nx * width * 0.18, sy + ny * width * 0.18); c.quadraticCurveTo(mx + nx * width * 0.18, my + ny * width * 0.18, p.x + nx * width * 0.18, p.y + ny * width * 0.18); c.stroke();
      // Joint bands make the stretched arm read as one continuous, flexible limb.
      c.globalAlpha = 0.3; c.strokeStyle = '#8b4b3f'; c.lineWidth = 1;
      for (let q = 0.2; q < 0.9; q += 0.2) {
        const ix = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * mx + q * q * p.x;
        const iy = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * my + q * q * p.y;
        c.beginPath(); c.moveTo(ix - nx * width * 0.42, iy - ny * width * 0.42); c.lineTo(ix + nx * width * 0.42, iy + ny * width * 0.42); c.stroke();
      }
      c.restore();
    };
    if (p.kind === 'rasengan') {
      const r = p.r, pulse = 1 + Math.sin(p.spin * 1.7) * 0.07;
      if (p.owner) {
        const g = c.createLinearGradient(p.owner.x, p.owner.y - 5, p.x, p.y);
        g.addColorStop(0, 'rgba(70,190,255,0)'); g.addColorStop(1, 'rgba(160,245,255,.55)');
        c.save(); c.strokeStyle = g; c.lineWidth = 3; c.setLineDash([3, 6]); c.lineDashOffset = -p.spin;
        c.beginPath(); c.moveTo(p.owner.x, p.owner.y - 5); c.lineTo(p.x, p.y); c.stroke(); c.restore();
      }
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(p.spin * 0.12);
      c.globalAlpha = 0.22; c.fillStyle = '#7fe8ff'; circle(c, 0, 0, r * 1.75 * pulse);
      c.globalAlpha = 1; c.fillStyle = '#37bfe9'; circle(c, 0, 0, r * pulse);
      c.strokeStyle = '#eaffff'; c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(0, 0, r * 0.82, r * (0.25 + i * 0.12), i * 1.05, 0, Math.PI * 2); c.stroke(); }
      c.fillStyle = '#ffffff'; circle(c, -r * 0.2, -r * 0.25, r * 0.3);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const a = p.spin * 0.22 + i * Math.PI / 3, rr = r * (1.15 + (i % 2) * 0.28); c.globalAlpha = 0.75; c.fillStyle = i % 2 ? '#bdf8ff' : '#49d5ff'; circle(c, Math.cos(a) * rr, Math.sin(a) * rr, 1.4); }
      c.restore();
    } else if (p.kind === 'rasenshuriken') {
      const r = p.r;
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(p.spin * 0.17);
      c.globalAlpha = 0.25; c.fillStyle = '#bdf8ff'; circle(c, 0, 0, r * 1.65);
      c.globalAlpha = 1; c.fillStyle = '#eaffff';
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.38 : r * 1.45; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill();
      c.fillStyle = '#46cfee'; circle(c, 0, 0, r * 0.58); c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.stroke();
      c.globalAlpha = 0.5; c.setLineDash([3, 5]); c.lineDashOffset = -p.spin * 0.6;
      for (let i = 0; i < 2; i++) { c.beginPath(); c.ellipse(0, 0, r * (1.55 + i * .28), r * (.55 + i * .14), i * Math.PI / 2, 0, Math.PI * 2); c.stroke(); }
      c.restore();
    } else if (p.kind === 'rubberfist' || p.kind === 'chakraarm') {
      const a = Math.atan2(p.vy, p.vx), r = p.r, chakra = p.kind === 'chakraarm';
      drawExtendedLimb(chakra ? '#ffad2f' : '#efb184', Math.max(4.5, r * (chakra ? 0.72 : 0.62)), chakra ? '#ffbd3f' : null);
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a);
      c.fillStyle = chakra ? '#ffb12f' : '#efb184'; c.strokeStyle = '#3a2020'; c.lineWidth = 1;
      c.fillRect(-r * 0.45, -r * 0.52, r * 1.05, r * 1.04); c.strokeRect(-r * 0.45, -r * 0.52, r * 1.05, r * 1.04);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(r * 0.55, (-0.38 + i * 0.38) * r, r * 0.28, 0, Math.PI * 2); c.fill(); c.stroke(); }
      if (chakra) { c.globalAlpha = 0.3; c.fillStyle = '#ffe480'; circle(c, 0, 0, r * 1.5); }
      c.restore();
    } else if (p.kind === 'redhawk') {
      const a = Math.atan2(p.vy, p.vx), r = p.r;
      drawExtendedLimb('#32252a', Math.max(6, r * 0.68), '#ff5427');
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a);
      c.globalAlpha = 0.75; c.fillStyle = '#ff4b21';
      c.beginPath(); c.moveTo(-r * 2.2, 0); c.lineTo(-r * 0.5, -r); c.lineTo(r * 0.75, -r * 0.55); c.lineTo(r, 0); c.lineTo(r * 0.75, r * 0.55); c.lineTo(-r * 0.5, r); c.closePath(); c.fill();
      c.globalAlpha = 1; c.fillStyle = '#2d2024'; circle(c, r * 0.15, 0, r * 0.72); c.fillStyle = '#ffb23f'; circle(c, -r * 0.25, 0, r * 0.42); c.restore();
    } else if (p.kind === 'elephantfist') {
      const a = Math.atan2(p.vy, p.vx), r = p.r;
      drawExtendedLimb('#29232e', Math.max(9, r * 0.78), '#d77d65');
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a);
      c.globalAlpha = 0.25; c.fillStyle = '#d77d65'; circle(c, 0, 0, r * 1.35); c.globalAlpha = 1;
      c.fillStyle = '#29232e'; c.strokeStyle = '#130f16'; c.lineWidth = 2;
      c.fillRect(-r * 0.65, -r * 0.58, r * 1.05, r * 1.16); c.strokeRect(-r * 0.65, -r * 0.58, r * 1.05, r * 1.16);
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(r * 0.42, (-0.46 + i * 0.31) * r, r * 0.26, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.strokeStyle = '#d77d65'; c.lineWidth = 1; for (let i = -1; i <= 1; i++) c.strokeRect(-r * 0.35, i * r * 0.25 - 1, r * 0.55, 2);
      c.restore();
    } else if (p.kind === 'shadowdagger') {
      const a = Math.atan2(p.vy, p.vx), r = p.r;
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a);
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const tail = 8 + i * 7, wave = Math.sin(p.spin * 0.28 + i * 1.7) * (2 + i);
        c.globalAlpha = 0.36 - i * 0.055; c.strokeStyle = i % 2 ? '#704cff' : '#3bd7ff'; c.lineWidth = Math.max(1, 5 - i);
        c.beginPath(); c.moveTo(-r * 0.4, 0); c.quadraticCurveTo(-tail * 0.55, wave, -tail, wave * 0.35); c.stroke();
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.fillStyle = '#0a0d18'; c.strokeStyle = '#65ddff'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(r * 1.45, 0); c.lineTo(-r * 0.5, -r * 0.38); c.lineTo(-r * 0.15, 0); c.lineTo(-r * 0.5, r * 0.38); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#b8f5ff'; c.fillRect(-r * 0.8, -1, r * 0.6, 2); c.fillStyle = '#7654ff'; c.fillRect(-r * 0.95, -3, 2, 6);
      c.restore();
    } else if (p.kind === 'shadowexchange') {
      const a = Math.atan2(p.vy, p.vx), r = p.r, pulse = 0.5 + 0.5 * Math.sin(p.spin * 0.3);
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a); c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.2; c.fillStyle = '#2b174d'; c.beginPath(); c.ellipse(-r * 1.3, 0, r * 2.3, r * 1.05, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 0.85; c.strokeStyle = '#b878ff'; c.lineWidth = 3 + pulse * 2;
      c.beginPath(); c.moveTo(-r * 2.2, r * 0.7); c.quadraticCurveTo(-r * 0.2, -r * 1.35, r * 1.65, -r * 0.35); c.stroke();
      c.strokeStyle = '#eaddff'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-r * 1.8, r * 0.4); c.quadraticCurveTo(0, -r, r * 1.45, -r * 0.25); c.stroke();
      c.globalAlpha = 0.55; c.fillStyle = '#6542d9';
      for (let i = 0; i < 6; i++) { const x = -r * (0.4 + i * 0.38), y = Math.sin(p.spin * 0.2 + i) * r * 0.55; circle(c, x, y, 2 + (i % 2)); }
      c.restore();
    } else if (p.kind === 'lightningneedle') {
      // Jagged Nen-charged needle: a sharp javelin of crackling electricity, not a round ki ball.
      // Opaque fill with a dark outline (not pure 'lighter') so it reads crisply against bright grass too.
      const a = Math.atan2(p.vy, p.vx), r = p.r;
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25; c.strokeStyle = '#8ff2ff'; c.lineWidth = r * 1.5;
      c.beginPath(); c.moveTo(r * 2.4, 0); c.lineTo(-r * 2.2, 0); c.stroke();
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.fillStyle = '#eafffe'; c.strokeStyle = '#163a44'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(r * 2.6, 0); c.lineTo(r * 0.3, -r * 0.55); c.lineTo(-r * 1.6, -r * 0.3);
      c.lineTo(-r * 1.1, 0); c.lineTo(-r * 1.9, r * 0.32); c.lineTo(r * 0.3, r * 0.55); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#5cd8f2'; c.beginPath(); c.moveTo(r * 1.6, 0); c.lineTo(-r * 0.2, -r * 0.22); c.lineTo(-r * 0.9, 0); c.lineTo(-r * 0.2, r * 0.22); c.closePath(); c.fill();
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.85; c.strokeStyle = '#ffffff'; c.lineWidth = 1;
      for (let i = 0; i < 2; i++) { const j = Math.sin(p.spin * 0.5 + i * 3) * r * 0.5; c.beginPath(); c.moveTo(-r * (1.2 + i), j); c.lineTo(-r * (1.9 + i), -j); c.stroke(); }
      c.restore();
    } else if (p.kind === 'thunderyoyo') {
      // Weighted yo-yo on a Nen thread: spinning disc with a taut string back to the thrower
      const r = p.r, spin = p.spin * 0.3;
      if (p.owner) {
        c.save(); c.globalAlpha = 0.55; c.strokeStyle = '#bdeeff'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(p.owner.x, p.owner.y - 8); c.lineTo(p.x, p.y); c.stroke(); c.restore();
      }
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(spin);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.28; c.fillStyle = '#4fd2ff'; circle(c, 0, 0, r * 1.6);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
      c.fillStyle = '#1c4a63'; c.strokeStyle = '#0a2430'; c.lineWidth = 1; circle(c, 0, 0, r); c.stroke();
      c.fillStyle = '#4fd2ff'; circle(c, 0, 0, r * 0.72);
      c.strokeStyle = '#8ff2ff'; c.lineWidth = 1.5; c.setLineDash([3, 4]); c.lineDashOffset = -p.spin * 0.8;
      circle(c, 0, 0, r * 0.95, false); c.setLineDash([]);
      c.fillStyle = '#eafffe'; circle(c, 0, 0, r * 0.3);
      c.restore();
    } else if (p.kind === 'antimagicslash') {
      // Asta's anti-magic slash: a jagged black-edged crescent that looks like it's tearing/erasing
      // through the air rather than a clean cut, with a bright core and a thin red crack along the edge.
      const a = Math.atan2(p.vy, p.vx), r = p.r;
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a);
      c.fillStyle = '#0a0a0c'; c.beginPath();
      c.moveTo(r * 1.6, 0);
      for (let i = 0; i <= 6; i++) { const ang = -0.95 + i / 6 * 1.9, jag = i % 2 ? r * 0.18 : 0; c.lineTo(Math.cos(ang) * (r * 1.1 + jag), Math.sin(ang) * (r * 1.1 + jag)); }
      c.lineTo(-r * 0.3, 0); c.closePath(); c.fill();
      c.strokeStyle = '#c21e3a'; c.lineWidth = 1; c.globalAlpha = 0.85; c.stroke(); c.globalAlpha = 1;
      c.fillStyle = p.color; c.beginPath();
      c.moveTo(r * 1.5, 0);
      for (let i = 0; i <= 6; i++) { const ang = -0.75 + i / 6 * 1.5; c.lineTo(Math.cos(ang) * r * 0.8, Math.sin(ang) * r * 0.8); }
      c.closePath(); c.fill();
      c.strokeStyle = p.core || '#ffffff'; c.lineWidth = 1.4; c.globalAlpha = 0.9;
      c.beginPath(); c.moveTo(r * 1.3, 0); c.quadraticCurveTo(r * 0.2, -r * 0.45, -r * 0.1, 0); c.stroke();
      c.restore(); c.globalAlpha = 1;
    } else if (p.kind === 'blackdivider') {
      // A grounded, slow-drifting X-shaped mana-nullifying shockwave: thick black cross with a
      // crackling violet rim (Asta's established purple-black anti-magic palette, not generic red/orange).
      const r = p.r, spin = p.spin * 0.08;
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(spin);
      c.globalAlpha = 0.22; c.fillStyle = p.core; circle(c, 0, 0, r * 1.6); c.globalAlpha = 1;
      for (const rot of [0.55, -0.55]) {
        c.save(); c.rotate(rot);
        c.fillStyle = '#0a0612'; c.fillRect(-r * 1.3, -r * 0.22, r * 2.6, r * 0.44);
        c.strokeStyle = p.core; c.lineWidth = 1.2; c.globalAlpha = 0.8;
        c.strokeRect(-r * 1.3, -r * 0.22, r * 2.6, r * 0.44); c.globalAlpha = 1;
        c.restore();
      }
      c.fillStyle = p.color; circle(c, 0, 0, r * 0.4);
      c.strokeStyle = '#eaddff'; c.lineWidth = 1; c.globalAlpha = 0.7; circle(c, 0, 0, r * 0.4, false); c.globalAlpha = 1;
      c.restore();
    } else if (p.kind === 'soundwave') {
      // Taira's sound-wave slash: a crescent made of concentric ripples, not a flat colored beam.
      const a = Math.atan2(p.vy, p.vx), r = p.r;
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(a); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const rr = r * (0.7 + i * 0.35);
        c.globalAlpha = 0.75 - i * 0.2; c.strokeStyle = i === 0 ? (p.core || '#ffe0b3') : p.color; c.lineWidth = 2.2 - i * 0.4;
        c.beginPath(); c.arc(0, 0, rr, -0.85, 0.85); c.stroke();
      }
      c.restore(); c.globalAlpha = 1;
    } else if (p.kind === 'disc') {
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(Math.round(p.spin * 2) / 2);
      c.fillStyle = 'rgba(255,216,74,0.45)'; c.beginPath(); c.ellipse(0, 0, p.r + 3, (p.r + 3) * 0.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ffe066'; c.beginPath(); c.ellipse(0, 0, p.r, p.r * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fffbe0'; c.fillRect(-p.r + 2, -1, p.r * 2 - 4, 1);
      c.restore();
    } else if (p.kind === 'spiral') {
      c.save(); c.translate(Math.round(p.x), Math.round(p.y)); c.rotate(Math.atan2(p.vy, p.vx));
      c.fillStyle = '#fff6c0'; c.fillRect(-28, -1, 32, 3);
      c.fillStyle = '#ffb81c';
      for (let x = -28; x <= 2; x += 2) c.fillRect(x, Math.round(Math.sin(x * 0.5 + p.spin) * 4) - 1, 2, 2);
      c.restore();
    } else if (p.kind === 'big' && beamKind(p.color) === 0 && sfxReady()) {
      // Genkidama, Big Bang y Final Impact: esfera de energía que palpita
      const sz = Math.round(p.r * 2.7 * (1 + 0.06 * Math.sin(p.spin)));
      c.globalAlpha = 0.3; c.fillStyle = p.color; circle(c, p.x, p.y, p.r * 1.7); c.globalAlpha = 1;
      c.drawImage(SFX_IMG, 3 * 32, SFX_ANIMS.sphere.row * 32, 32, 32, Math.round(p.x - sz / 2), Math.round(p.y - sz / 2), sz, sz);
    } else {
      const r = p.r;
      c.globalAlpha = 0.35; c.fillStyle = p.color; circle(c, p.x, p.y, r * 1.9); c.globalAlpha = 1;
      c.fillStyle = p.color; circle(c, p.x, p.y, r);
      c.fillStyle = '#ffffff'; circle(c, p.x - r * 0.2, p.y - r * 0.2, r * 0.55);
    }
  };
  for (const p of G.projs) if (!allies || !isAlly(p)) drawProj(c, p);
  if (allies) allyPass(c, G.projs, drawProj);
  // Rayos (salen de las manos de su dueño) y los de los jefes (desde donde los dispararon)
  const drawBeam = (c, b) => { const P = b.owner; if (P && b.t > 0) drawBeamBody(c, P.x + Math.cos(b.ang) * 12, P.y - 3 + Math.sin(b.ang) * 10, b, t); };
  for (const b of G.beams) if (!allies || !isAlly(b)) drawBeam(c, b);
  if (allies) allyPass(c, G.beams, drawBeam);
  for (const b of G.ebeams || []) if (b.t > 0) drawBeamBody(c, b.x + Math.cos(b.ang) * 14, b.y + Math.sin(b.ang) * 10, b, t);
  // Disparos enemigos
  for (const s of G.shots) {
    c.fillStyle = '#5a0a1a'; circle(c, s.x, s.y, s.r + 1);
    c.fillStyle = s.color; circle(c, s.x, s.y, s.r);
    c.fillStyle = '#fff2e0'; circle(c, s.x - 1, s.y - 1, s.r * 0.45);
  }
  // Partículas
  for (const f of G.fx) {
    if (f.type === 'anim') { if (sfxReady()) drawAnimFx(c, f); continue; }
    if (f.type === 'poof') { drawPoof(c, f); continue; }
    if (f.type === 'ring') {
      c.globalAlpha = Math.max(0, f.t / f.dur); c.strokeStyle = f.color; c.lineWidth = 3;
      const rr = f.r * (1.2 - f.t / f.dur * 0.4);
      c.beginPath(); c.ellipse(f.x, f.y, rr, rr * 0.8, 0, 0, Math.PI * 2); c.stroke();
    } else {
      c.globalAlpha = Math.min(1, f.t * 3); c.fillStyle = f.color;
      const s = Math.max(1, Math.round(f.size * 0.7));
      c.fillRect(Math.round(f.x), Math.round(f.y), s, s);
    }
  }
  c.globalAlpha = 1;
  // ¡Amigo Buu!: Majin Buu peleando por Mr. Satán
  const BUU_LOOK = BOSSES.find(b => b.id === 'fatbuu').look;
  for (const h of G.helpers || []) {
    if (h.t < 1 && Math.floor(h.t * 12) % 2) continue;   // titila antes de irse
    drawActor(c, BUU_LOOK, h.x, h.y, { facing: h.facing, anim: h.punch > 0 ? 'cast' : 'walk', t: G.t * 0.8 });
  }
  // Zanzoken: las imágenes residuales (translúcidas, titilan al final) · Bomba de regalo: la caja
  for (const d of G.decoys || []) {
    if (d.gift) { drawGift(c, d.x, d.y, d.t); continue; }
    if (d.shadowArmy) { drawShadowSoldier(c, d, G.t); continue; }
    const P = d.owner && G.players.includes(d.owner) ? d.owner : G.players.find(p => p.id === d.ownerId);
    if (!P) continue;
    if (d.shadowClone) {
      // Godspeed: Execution - a burst of speed-line streaks trailing behind, not a plain afterimage
      c.save(); c.globalCompositeOperation = 'lighter';
      const back = -(d.facing || 1);
      for (let i = 0; i < 6; i++) {
        const ly = d.y - 14 + i * 5, len = 20 + (i % 3) * 10, alpha = (0.5 - i * 0.06) * (d.t < 0.6 ? 1 : 0.6);
        c.globalAlpha = Math.max(0, alpha); c.strokeStyle = i % 2 ? '#eafffe' : '#8ff2ff'; c.lineWidth = i % 3 === 0 ? 2 : 1;
        c.beginPath(); c.moveTo(d.x, ly); c.lineTo(d.x + back * len, ly); c.stroke();
      }
      c.restore(); c.globalAlpha = 1;
    }
    c.globalAlpha = d.t < 0.6 ? (Math.floor(d.t * 16) % 2 ? 0.28 : 0.75) : (d.shadowClone ? 0.86 : 0.5);
    drawActor(c, P.c.look, d.x, d.y, { facing: d.facing || 1, anim: d.shadowClone ? 'cast' : 'idle', t: G.t * 1.4, noShadow: true, ssj: formKeyFor(P) });
    c.globalAlpha = d.shadowClone ? 0.42 : 0.25; c.strokeStyle = d.shadowClone ? '#eef8ff' : '#c8e0ff'; c.lineWidth = d.shadowClone ? 2 : 1;
    c.beginPath(); c.ellipse(d.x, d.y + 8, d.taunt * 0.25, d.taunt * 0.18, 0, 0, Math.PI * 2); c.stroke();
    c.globalAlpha = 1;
  }
  // Los jugadores se vuelven a dibujar encima de rayos y proyectiles
  for (const P of G.players) if (!P.gone) drawPlayer(c, P, true);
}
function render() {
  const M = G.me, pair = localSplitPair();
  splitLayout = pair ? makeSplitLayout(pair) : null;
  if (splitLayout) {
    for (const view of splitLayout.views) { renderWorldView(view.player); presentWorldSlice(view); }
    camX = Math.round((pair[0].x + pair[1].x) / 2); camY = Math.round((pair[0].y + pair[1].y) / 2);
  } else {
    renderWorldView(viewer());
    presentWorld();
  }
  drawBlind();   // Taiyoken de Cell: la pantalla blanca (el HUD sigue a la vista)
  drawVignette(M.transformed > 0 ? M.c.aura : null);
  drawSplitDivider();
  drawNames();
  drawTeammateIndicators();
  drawTexts();
  drawHUD();
  drawSummon();
  drawAimReticle();
  if (typeof Replays !== 'undefined') Replays.frame();   // copia para la repetición (si está grabando)
}
// Apuntado manual: el cursor del sistema se esconde (ver style.css) y se dibuja una mira grande,
// con borde oscuro y una línea tenue desde el guerrero, para no perderla entre tantos efectos
function drawAimReticle() {
  const viaPad = SAVE.aim && G.mode === 'play' && padAiming();
  if (!viaPad && (!SAVE.aim || isTouch() || G.mode !== 'play' || performance.now() - mouse.t > 30000)) return;
  const V = viewer();
  const px = (V.x - camX + BW / 2) * SCALE, py = (V.y - 4 - camY + BH / 2) * SCALE;
  const mx = viaPad ? px + Math.cos(pad.aim) * 80 * SCALE : mouse.x, my = viaPad ? py + Math.sin(pad.aim) * 80 * SCALE : mouse.y;
  const pulse = 1 + 0.08 * Math.sin(performance.now() / 120), r = 12 * pulse;
  ctx.save();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(mx, my); ctx.stroke();
  ctx.setLineDash([]); ctx.lineCap = 'round';
  const shape = () => {
    ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.moveTo(mx + dx * (r - 5), my + dy * (r - 5)); ctx.lineTo(mx + dx * (r + 7), my + dy * (r + 7)); }
    ctx.stroke();
  };
  ctx.lineWidth = 6; ctx.strokeStyle = '#0a0f2e'; shape();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#ff4dd8'; shape();
  ctx.fillStyle = '#0a0f2e'; circle(ctx, mx, my, 3.5);
  ctx.fillStyle = '#ffffff'; circle(ctx, mx, my, 2);
  ctx.restore();
}
function drawEnemy(c, e, t) {
  if (e.elite) {
    // Anillo dorado en el piso que late: se distingue de una mirada entre la multitud
    const p = 0.5 + 0.5 * Math.sin(t * 5 + e.phase), rx = 17 * e.scale + p * 3;
    c.save(); c.globalAlpha = 0.55 + 0.35 * p; c.strokeStyle = '#ffcc33'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(e.x, e.y + 11 * e.scale, rx, rx * 0.4, 0, 0, Math.PI * 2); c.stroke(); c.restore();
    drawAura(c, '#ffcc33', e.x, e.y, t + e.phase, e.scale);
  }
  // Mira hacia el jugador que persigue (de frente, de espaldas o de perfil si la hoja lo tiene)
  const target = nearestPlayer(e.x, e.y);
  const dir = target ? dirFromVec(target.x - e.x, target.y - e.y) : 'side';
  const alt = enemyAlt(e, t), ey = e.y - alt;
  if (alt > 0.5) drawAirborne(c, e, alt, t);
  const casting = e.cast || e.castF, spec = BOSS_SPECIAL[e.id];
  if (casting && spec) drawAura(c, spec.color, e.x, ey, t + e.phase, e.scale * 1.25);
  const shielded = e.shield > 0 || e.shieldF;   // Barrera del Androide 17: la burbuja de energía
  if (shielded && ITEM_IMG.shield) {
    const sz = Math.round(56 * e.scale);
    c.save(); c.imageSmoothingEnabled = false; c.globalAlpha = 0.5 + 0.1 * Math.sin(t * 9);
    c.drawImage(ITEM_IMG.shield, 6 * 32, 0, 32, 32, Math.round(e.x - sz / 2), Math.round(ey - 6 * e.scale - sz / 2), sz, sz); c.restore();
  }
  const tp = e.tp || e.tpF;   // teletransportándose: se desvanece titilando
  if (tp) c.globalAlpha = Math.floor(t * 16) % 2 ? 0.15 : 0.45;
  drawActor(c, e.def.look, e.x, ey, { facing: e.facing, dir, variant: e.nid, anim: 'walk', t: t + e.phase, scale: e.scale, flash: e.flash > 0, outline: !!THEME.outline, noShadow: alt > 0.5 });
  c.globalAlpha = 1;
  if (casting && spec) {   // la bola de energía en las manos, latiendo
    const r = 5 + Math.sin(t * 25) * 1.5;
    c.save(); c.globalAlpha = 0.85; c.fillStyle = spec.color; circle(c, e.x + e.facing * 10 * e.scale, ey - 4 * e.scale, r + 3);
    c.fillStyle = '#ffffff'; circle(c, e.x + e.facing * 10 * e.scale, ey - 4 * e.scale, r * 0.55); c.restore();
  }
  if (e.stun > 0 || e.stunF) {   // paralizado (Taiyoken): estrellitas que giran sobre la cabeza
    c.fillStyle = '#ffe14d';
    for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; c.fillRect(Math.round(e.x + Math.cos(a) * 9 * e.scale) - 1, Math.round(ey - 30 * e.scale + Math.sin(a) * 3) - 1, 3, 3); }
  }
  if (e.elite) drawDragonBall(c, e.x, ey - 34 * e.scale, 4, 1, false);
  if (e.boss && G.lv.infinite) drawHalo(c, e.x, ey - 30 * e.scale - 6 + Math.sin(t * 3 + e.phase) * 1.5);
  if (e.windup > 0) {   // "¡!" sobre el que está por embestir (más chico en los enemigos comunes)
    const y = Math.round(ey - 30 * e.scale - 6 + Math.sin(t * 20) * 2);
    c.font = `700 ${e.boss ? 16 : 11}px ${FONT}`; c.textAlign = 'center'; c.lineJoin = 'round';
    c.lineWidth = 3; c.strokeStyle = '#0a0f2e'; c.strokeText('¡!', e.x, y);
    c.fillStyle = '#ff3d2a'; c.fillText('¡!', e.x, y);
  }
  if (e.elite) {   // élite: barra de vida dorada, más grande y siempre a la vista
    const w = 30, x = Math.round(e.x - w / 2), y = Math.round(ey + 15 * e.scale);
    c.fillStyle = '#ffcc33'; c.fillRect(x - 2, y - 2, w + 4, 7);
    c.fillStyle = '#1a0a10'; c.fillRect(x - 1, y - 1, w + 2, 5);
    c.fillStyle = '#ff4d4d'; c.fillRect(x, y, Math.round(w * Math.max(0, e.hp) / e.maxHp), 3);
  } else if (!e.boss && e.hp < e.maxHp) {
    const w = 16, x = Math.round(e.x - w / 2), y = Math.round(ey + 15 * e.scale);
    c.fillStyle = '#1a0a10'; c.fillRect(x - 1, y - 1, w + 2, 4);
    c.fillStyle = '#ff4d4d'; c.fillRect(x, y, Math.round(w * Math.max(0, e.hp) / e.maxHp), 2);
  }
}
// Altura del enemigo en el aire (sale de e.air en el anfitrión y de e.airF en el invitado): los que vuelan flotan
// subiendo y bajando un poco, los Saibaiman van a los saltos
function enemyAlt(e, t) {
  const air = e.air || e.airF, mv = moveKind(e);
  e.airDT = air ? (e.airDT || 0) + Math.max(0, Math.min(0.1, t - (e.lastDraw ?? t))) : 0;
  e.lastDraw = t;
  // Saibaiman: un arco (en el invitado, que no sabe cuánto dura el salto, uno parecido)
  const jumpP = e.leap ? Math.min(1, e.leap.t / e.leap.dur) : Math.min(1, e.airDT / 0.8), jumpH = e.leap ? e.leap.h : 45;
  const want = !air ? 0 : mv === 'jump' ? Math.sin(Math.PI * jumpP) * jumpH : 20 + Math.sin(e.airDT * 6 + e.phase) * 2.5;
  e.altS = air && mv === 'jump' ? want : (e.altS || 0) + (want - (e.altS || 0)) * 0.2;
  return Math.round(e.altS);
}
// En el aire: la sombra se queda en el suelo (más chica cuanto más alto); los guerreros que vuelan, con aura de Ki y estela
function drawAirborne(c, e, alt, t) {
  const s = e.scale, gy = e.y + 12 * s, k = Math.max(0.45, 1 - alt / 40);
  c.save();
  c.fillStyle = 'rgba(10,5,20,0.45)';
  c.beginPath(); c.ellipse(e.x, gy, 12 * s * k, 4 * s * k, 0, 0, Math.PI * 2); c.fill();
  if (moveKind(e) === 'hover') {   // las aves vuelan solas; los Saibaiman saltan: sin aura
    for (let i = 0; i < 3; i++) {   // rayitas de viento que caen entre los pies y la sombra
      const ph = (t * 2.5 + i / 3 + e.phase) % 1;
      c.globalAlpha = 0.85 * (1 - ph); c.fillStyle = '#3f6fc0';
      c.fillRect(Math.round(e.x - 6 * s + i * 6 * s), Math.round(gy - alt + 4 + ph * alt * 0.8), 2, 5);
    }
    c.restore();
    drawAura(c, '#9fdcff', e.x, e.y - alt, t + e.phase, 0.85 * s);   // aura de Ki celeste: está volando
    return;
  }
  c.restore();
}
// overlay: segunda pasada por encima de las técnicas, para que no tapen al personaje
function drawPlayer(c, P, overlay = false) {
  if (P.hidden) return;                      // absorbido por la fusión
  if (P.fallT > 0) {   // cayendo al Infierno (Camino de la Serpiente): se achica y se oscurece
    if (overlay) return;
    const f = Math.max(0, P.fallT / SNAKE_FALL_TIME);
    c.save(); c.globalAlpha = f; c.filter = `brightness(${0.35 + 0.65 * f})`;
    drawActor(c, P.c.look, P.x, P.y + (1 - f) * 18, { facing: P.facing, anim: 'idle', t: 0, scale: 0.3 + 0.7 * f, noShadow: true });
    c.restore();
    return;
  }
  const fused = isFusedBody(P);
  const ch = fused ? Object.assign({}, P.c, GOGETA, { ssjHair: null, transformSprite: false }) : P.c;   // el sprite de Gogeta ya es SSJ
  const tr = P.transformed > 0 || fused;
  const auraNow = fused ? ch.aura : formAura(P);
  // Visual form decay: the aura starts flickering in the last 2s of a transformation, as a readability cue.
  const auraDecaying = tr && !fused && P.transformed > 0 && P.transformed < 2;
  const auraVisible = !auraDecaying || Math.floor(G.t * 8) % 2;
  if (overlay && P.dead) return;
  if (P.dead) { // caído: translúcido, con el progreso de reanimación
    c.globalAlpha = 0.45;
    drawActor(c, ch.look, P.x, P.y, { facing: P.facing, anim: 'idle', t: 0 });
    c.globalAlpha = 1;
    if (P.revive > 0) {
      c.strokeStyle = '#6cff7a'; c.lineWidth = 3;
      c.beginPath(); c.arc(P.x, P.y - 4, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, P.revive / 2.5)); c.stroke();
    }
    return;
  }
  if (tr && !overlay && !ch.buddy && auraVisible) drawAura(c, auraNow, P.x, P.y, G.t, 1.15);   // (Mr. Satán no se transforma)
  if (P.kaioken > 0 && !overlay) drawAura(c, '#ff3d3d', P.x, P.y, G.t + 1, 1.25);   // Kaioken: aura roja
  if (P.immortal > 0 && !overlay) {   // Inmortalidad: anillo dorado que late (parpadea el último segundo)
    if (P.immortal > 1 || Math.floor(G.t * 10) % 2) {
      c.globalAlpha = 0.35 + 0.2 * Math.sin(G.t * 8); c.strokeStyle = '#ffe27a'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(P.x, P.y + 2, 20, 26, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    }
  }
  // Petrificado (Dabura): gris · caramelo (Majin Buu): rosado
  const tint = P.stone > 0 ? 'grayscale(1) brightness(1.1)' : P.candy > 0 ? 'sepia(1) saturate(3) hue-rotate(290deg) brightness(1.15)'
    : P.swapBody > 0 ? 'sepia(1) saturate(3) hue-rotate(220deg)' : null;   // violeta: en el cuerpo de Ginyu
  if (tint) c.filter = tint;
  // Mr. Satán: tirado en el piso (Dynamite Kick fallida) o posando (al subir de nivel o mientras pelea Buu)
  const special = P.koT > 0 ? koAnim(P) : P.tripT > 0 ? 'trip' : (P.poseT > 0 || (ch.buddy && P.transformed > 0 && !P.moving)) ? 'pose' : null;
  // Melee rush / flying kick: a speed-line trail behind the dash so it reads as a deliberate charge,
  // not just the sprite sliding. Color matches the move that triggered it (plain white for the kick).
  if (!overlay && P.dashT > 0 && (P.dashVX || P.dashVY)) {
    const a = Math.atan2(P.dashVY, P.dashVX), col = P.dashColor || '#ffffff';
    c.save(); c.translate(Math.round(P.x), Math.round(P.y)); c.rotate(a); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const off = -16 - i * 7, w = 7 - i;
      c.globalAlpha = 0.5 - i * 0.08; c.strokeStyle = i % 2 ? '#ffffff' : col; c.lineWidth = Math.max(1, w * 0.5);
      c.beginPath(); c.moveTo(off, -3 - i); c.lineTo(off - 14, -3 - i); c.moveTo(off, 3 + i); c.lineTo(off - 14, 3 + i); c.stroke();
    }
    c.restore(); c.globalAlpha = 1;
  }
  if (!(P.inv > 0 && !P.bubble && Math.floor(P.inv * 20) % 2)) {   // con el escudo puesto no parpadea
    drawActor(c, ch.look, P.x, P.y, {
      facing: P.facing, dir: special === 'pose' ? 'down' : special ? 'side' : P.dir, t: G.t + P.id * 0.37,
      ssj: (P.koT > 0) ? false : fused ? (hasTransformLook(ch) ? 'ssj' : false) : formKeyFor(P),
      ssjHair: fused ? null : (activeForm(P) && activeForm(P).ssjHair),
      anim: special || (P.punchT > 0 ? 'punch' : P.castT > 0 ? 'cast' : !P.moving ? 'idle' : ch.flee && P.hp < P.maxHp * 0.3 ? 'flee' : 'walk'),   // Mr. Satán huye asustado
      noShadow: overlay,
    });
  }
  c.filter = 'none';
  if (tr && overlay && auraVisible) drawAuraFront(c, auraNow, P.x, P.y, G.t, 1.15);
  if (P.halo && overlay) drawHalo(c, P.x, P.y - 34 + Math.sin(G.t * 3 + P.id) * 1.5);
  if (overlay) drawShield(c, P);
  const x = Math.round(P.x - 12), y = Math.round(P.y + 16);
  c.fillStyle = '#1a0a10'; c.fillRect(x - 1, y - 1, 26, 5);
  c.fillStyle = '#5a1a1a'; c.fillRect(x, y, 24, 3);
  c.fillStyle = P.hp / P.maxHp > 0.3 ? '#4dff6a' : '#ff4d4d'; c.fillRect(x, y, Math.round(24 * Math.max(0, P.hp) / P.maxHp), 3);
}
// Escudo de energía (Buu's Fury) mientras dura una inmunidad larga: la Semilla de reserva (3 s) o al revivir en
// cooperativo (2 s). Los golpes dan 0,5 s y las fusiones 99, así que esos no lo muestran. Sale de P.inv, que ya
// viaja por la red: el invitado también lo ve.
function drawShield(c, P) {
  if (!(P.inv > 0) || P.inv > 50) { P.bubble = 0; return; }
  if (!P.bubble) { if (P.inv <= 1.6) return; P.bubble = P.inv; }   // cuánto dura esta inmunidad
  const im = ITEM_IMG.shield;
  if (!im) return;
  const f = Math.min(6, Math.floor((P.bubble - P.inv) / 0.05));   // se infla en un tercio de segundo
  const end = P.inv < 0.6 ? (Math.floor(P.inv * 12) % 2 ? 0.35 : 1) : 1;   // titila al terminar
  c.save();
  c.imageSmoothingEnabled = false;
  c.globalAlpha = (0.52 + 0.08 * Math.sin(G.t * 9)) * end;
  c.drawImage(im, f * 32, 0, 32, 32, Math.round(P.x - 24), Math.round(P.y - 30), 48, 48);
  c.restore();
}
// Aureola del Otro Mundo (se ganó usando la Semilla de reserva): anillo amarillo en pixel art, como en los juegos de GBA
// (más claro arriba, anaranjado abajo, con borde oscuro de un píxel)
const HALO_ART = [
  '....hhhhhhh....',
  '..hhy.....yhh..',
  '.yy.........yy.',
  '..oyy.....yyo..',
  '....ooooooo....',
];
const HALO_PAL = { h: '#fff6a0', y: '#ffd426', o: '#e08a10' };
// Píxeles ya calculados (grilla de 17×7): el anillo y su borde oscuro solo por fuera, así el centro queda hueco
const HALO_PX = (() => {
  const ring = new Map();
  HALO_ART.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') ring.set(`${i + 1},${j + 1}`, HALO_PAL[row[i]]); });
  const px = [];
  for (let j = 0; j < 7; j++) for (let i = 0; i < 17; i++) {
    if (ring.has(`${i},${j}`)) continue;
    const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ring.has(`${i + dx},${j + dy}`));
    const inside = ((i - 8) / 6.5) ** 2 + ((j - 3) / 1.6) ** 2 < 1;
    if (touches && !inside) px.push([i, j, '#4a2a00']);
  }
  for (const [k, col] of ring) { const [i, j] = k.split(',').map(Number); px.push([i, j, col]); }
  return px;
})();
function drawHalo(c, x, y) {
  const ox = Math.round(x) - 8, oy = Math.round(y) - 3;
  for (const [i, j, col] of HALO_PX) { c.fillStyle = col; c.fillRect(ox + i, oy + j, 1, 1); }
}
const PLAYER_COLORS = ['#ffe27a', '#7fd8ff', '#ff9bd6', '#9dff8a'];
function drawNames() {
  const F = G.fusion;
  if (splitLayout) {
    for (const view of splitLayout.views) {
      ctx.save(); ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip();
      G.players.forEach((P, i) => {
        if (P.gone || P.hidden) return;
        const [x, y] = splitScreenPoint(P.x, P.y - (P.halo ? 47 : 40), view);
        if (x < view.x - 30 || x > view.x + view.w + 30 || y < view.y - 30 || y > view.y + view.h + 30) return;
        const fused = isFusedBody(P);
        let name = P.netDisconnected ? t('{name} (reconectando...)', { name: P.name }) : P.dead ? t('{name} (caído)', { name: P.name }) : P.name;
        if (fused) name = `Gogeta (${F.ids.map(id => G.players.find(p => p.id === id)).filter(p => p && !p.ally).map(p => p.name).join(' + ')})`;
        hudText(name, x, y, 11, fused ? '#ffe14d' : PLAYER_COLORS[i % 4], 'center');
        const secs = fused ? F.t : P.transformed;
        if (!P.dead && secs > 0) hudText(`${Math.ceil(secs)}s`, x, y - 13, 11, fused ? '#ffe14d' : formAura(P), 'center');
      });
      ctx.restore();
    }
    return;
  }
  G.players.forEach((P, i) => {
    if (P.gone || P.hidden) return;
    const [x, y] = toScreen(P.x, P.y - (P.halo ? 47 : 40)), fused = isFusedBody(P);   // con aureola, el nombre va más arriba
    // Nombre (solo si hay más de un jugador real) y cuenta regresiva del poder activo
    if (G.players.filter(p => !p.ally).length > 1) {
      let name = P.netDisconnected ? t('{name} (reconectando...)', { name: P.name }) : P.dead ? t('{name} (caído)', { name: P.name }) : P.name;
      if (fused) name = `Gogeta (${F.ids.map(id => G.players.find(p => p.id === id)).filter(p => p && !p.ally).map(p => p.name).join(' + ')})`;
      hudText(name, x, y, 12, fused ? '#ffe14d' : PLAYER_COLORS[i % 4], 'center');
    }
    const secs = fused ? F.t : P.transformed;
    if (!P.dead && secs > 0) hudText(`${Math.ceil(secs)}s`, x, y - (G.players.length > 1 ? 14 : 0), 12, fused ? '#ffe14d' : formAura(P), 'center');
  });
}
function drawVignette(tint) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,10,20,0.45)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (tint) { ctx.globalAlpha = 0.06; ctx.fillStyle = tint; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  const M = G.me, hp = M.hp / M.maxHp;
  if (!M.dead && hp < 0.3) { ctx.globalAlpha = (0.3 - hp) * (0.8 + Math.sin(G.t * 8) * 0.3); ctx.fillStyle = '#c00018'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (M.dead) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#1a0a20'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (G.flashT > 0) { ctx.globalAlpha = Math.min(0.55, G.flashT) * SAVE.fx.flash; ctx.fillStyle = '#fff6d8'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }   // jefe derrotado
}
function drawTexts() {
  ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  for (const tx of G.texts) {
    if (tx.params && tx.params.dmg && !SAVE.fx.dmgNumbers) continue;   // per-viewer toggle, see damageEnemy()
    if (tx.params && tx.params.ability && !SAVE.fx.abilityNames) continue;   // per-viewer toggle, see fireAttacks()
    const pop = tx.big === 2 ? 1 + Math.max(0, tx.t - 0.55) * 4 : 1;   // los críticos aparecen grandes y se acomodan
    ctx.font = `700 ${Math.round((tx.big === 2 ? 22 : tx.big ? 20 : 14) * pop)}px ${FONT}`;
    ctx.globalAlpha = Math.min(1, tx.t * 3);
    const s = t(tx.text, tx.params);
    const drawAt = (x, y) => {
      ctx.lineWidth = 4; ctx.strokeStyle = '#1a0c14'; ctx.strokeText(s, x, y);
      ctx.fillStyle = tx.color; ctx.fillText(s, x, y);
    };
    if (splitLayout) {
      for (const view of splitLayout.views) {
        const [x, y] = splitScreenPoint(tx.x, tx.y, view);
        if (x < view.x || x > view.x + view.w || y < view.y || y > view.y + view.h) continue;
        ctx.save(); ctx.beginPath(); ctx.rect(view.x, view.y, view.w, view.h); ctx.clip(); drawAt(x, y); ctx.restore();
      }
    } else {
      const [x, y] = toScreen(tx.x, tx.y); drawAt(x, y);
    }
  }
  ctx.globalAlpha = 1;
}

// ─── Interfaz (HUD) ──────────────────────────────────────────────────────────
function panel(x, y, w, h) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#0a0f2e'; ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2c4499'); g.addColorStop(1, '#18245e');
  ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = '#9bb8ff'; ctx.lineWidth = 2; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
}
function pbar(x, y, w, h, frac, color, light) {
  ctx.fillStyle = '#0a0f2e'; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = '#2a1830'; ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * Math.max(0, Math.min(1, frac)));
  ctx.fillStyle = color; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = light || 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y, fw, Math.max(1, Math.round(h / 3)));
}
function hudText(text, x, y, size = 14, color = '#ffffff', align = 'left') {
  ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = 3; ctx.strokeStyle = '#0a0f2e'; ctx.strokeText(text, x, y);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}
// Retrato (cabeza) de un personaje en cualquier contexto 2D
// ssj: false for base look, or a form key string ('ssj', 'sage', 'baryon', 'gear4'...) for a transformed tier.
function drawPortraitTo(cx, L, ssj, x, y, size) {
  cx.imageSmoothingEnabled = false;
  const suffix = ssj ? ':' + (typeof ssj === 'string' ? ssj : 'ssj') : '';
  const ext = EXTERNAL.get(L.id + suffix) || EXTERNAL.get(L.id);
  if (ext) { // cabeza: parte superior central del fotograma de reposo
    const a = ext.anims.idle, fw = ext.frameW;
    const sw = Math.round(fw * 0.6), sh = Math.round(ext.frameH * 0.55);
    cx.drawImage(ext.img, a.col * fw + Math.round(fw * 0.2), a.row * ext.frameH, sw, sh, x, y, size, size * sh / sw);
    return;
  }
  const sh = getSheet(L, ssj);
  cx.drawImage(sh.normal, HEAD_X, 0, 24, 22, x, y, size, size * 22 / 24);
}
function drawAttackIcon(id, x, y, s, c = ctx) {   // c: en qué lienzo (el HUD o los íconos del menú)
  const d = ATTACKS[id], cx = x + s / 2, cy = y + s / 2;
  c.fillStyle = d.color;
  if (d.kind === 'rasengan') {
    c.globalAlpha = 0.3; circle(c, cx, cy, s * 0.38); c.globalAlpha = 1;
    c.strokeStyle = '#eaffff'; c.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(cx, cy, s * 0.26, s * (0.08 + i * 0.04), i, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#fff'; circle(c, cx - s * 0.06, cy - s * 0.07, s * 0.07);
  } else if (d.kind === 'rasenshuriken') {
    c.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? s * 0.12 : s * 0.42; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    c.closePath(); c.fill(); c.fillStyle = '#fff'; circle(c, cx, cy, s * 0.1);
  } else if (['rubberfist', 'chakraarm', 'redhawk', 'elephantfist'].includes(d.kind)) {
    const dark = d.kind === 'elephantfist', fire = d.kind === 'redhawk', chakra = d.kind === 'chakraarm';
    c.strokeStyle = chakra ? '#ff9f2d' : '#efb184'; c.lineWidth = Math.max(2, s * 0.13); c.beginPath(); c.moveTo(x + s * 0.12, cy); c.lineTo(cx, cy); c.stroke();
    if (fire) { c.fillStyle = '#ff5b32'; circle(c, cx + s * 0.08, cy, s * 0.31); }
    c.fillStyle = dark || fire ? '#29232e' : (chakra ? '#ffb12f' : '#efb184');
    c.fillRect(cx - s * 0.05, cy - s * 0.22, s * 0.3, s * 0.44);
    for (let i = 0; i < 3; i++) circle(c, cx + s * 0.27, cy + (-0.14 + i * 0.14) * s, s * 0.1);
  } else if (d.type === 'beam') {
    c.fillRect(x + 4, cy - 4, s - 8, 8); c.fillStyle = '#fff'; c.fillRect(x + 4, cy - 1, s - 8, 2); circle(c, x + 7, cy, 5);
  } else if (d.type === 'orbit') {
    for (let i = 0; i < 3; i++) { const a = i * 2.09; circle(c, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 4); }
  } else if (d.type === 'buff') {   // Kaioken: aura roja alrededor de una silueta
    const u = s / 24;
    c.globalAlpha = 0.45; circle(c, cx, cy, 10 * u); c.globalAlpha = 1;
    c.fillStyle = '#fff'; circle(c, cx, cy - 4 * u, 3 * u); c.fillRect(cx - 3 * u, cy - u, 6 * u, 8 * u);
  } else if (d.type === 'rain') {   // Lluvia de Ki: gotas que caen
    const u = s / 24;
    for (const [ox, oy] of [[-6, -6], [2, -2], [-2, 5], [6, 3]]) { c.fillRect(cx + (ox - 1) * u, cy + (oy - 5) * u, 2 * u, 4 * u); circle(c, cx + ox * u, cy + oy * u, 3 * u); }
  } else if (d.type === 'decoy') {   // Zanzoken: dos siluetas, una transparente
    const u = s / 24;
    c.globalAlpha = 0.45; circle(c, cx + 4 * u, cy - 5 * u, 4 * u); c.fillRect(cx, cy - u, 8 * u, 9 * u);
    c.globalAlpha = 1; circle(c, cx - 4 * u, cy - 5 * u, 4 * u); c.fillRect(cx - 8 * u, cy - u, 8 * u, 9 * u);
  } else if (d.grenade) {   // Granada de Ki: esfera con mecha
    circle(c, cx, cy + 2, s * 0.28); c.fillStyle = '#fff'; c.fillRect(cx - 1, cy - s * 0.4, 2, 5); c.fillStyle = '#ffd93b'; circle(c, cx, cy - s * 0.42, 2);
  } else if (d.type === 'nova' && (ATTACKS.taiyoken === d || ATTACKS.taiyokenx === d)) {   // Taiyoken: destello con rayos
    c.fillStyle = '#fff'; circle(c, cx, cy, s * 0.18);
    c.strokeStyle = d.color; c.lineWidth = 2;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; c.beginPath(); c.moveTo(cx + Math.cos(a) * s * 0.24, cy + Math.sin(a) * s * 0.24); c.lineTo(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42); c.stroke(); }
  } else if (d.type === 'nova') {
    c.strokeStyle = d.color; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, s * 0.32, 0, Math.PI * 2); c.stroke();
    c.fillStyle = '#fff'; circle(c, cx, cy, 3);
  } else if (d.kind === 'disc') {
    c.beginPath(); c.ellipse(cx, cy, s * 0.38, s * 0.14, -0.4, 0, Math.PI * 2); c.fill();
  } else if (d.kind === 'spiral') {
    c.fillStyle = '#fff6c0'; c.fillRect(x + 4, cy - 1, s - 8, 3); c.fillStyle = d.color;
    for (let i = 4; i < s - 4; i += 3) c.fillRect(x + i, cy + Math.sin(i) * 4 - 1, 2, 2);
  } else {
    const r = d.kind === 'big' ? s * 0.34 : s * 0.24;
    circle(c, cx, cy, r); c.fillStyle = '#fff'; circle(c, cx - r * 0.25, cy - r * 0.25, r * 0.45);
  }
}
// Íconos de las mejoras de la partida (para la fila del HUD)
function drawPassiveIcon(id, x, y, s, c = ctx) {
  const d = PASSIVES[id], cx = x + s / 2, cy = y + s / 2, u = s / 16;
  c.fillStyle = d.color; c.strokeStyle = d.color; c.lineWidth = Math.max(1.5, u * 1.6);
  if (id === 'power') {          // puño de poder: flecha hacia arriba
    poly(c, [0, -6 * u, 6 * u, 1 * u, 2.5 * u, 1 * u, 2.5 * u, 6 * u, -2.5 * u, 6 * u, -2.5 * u, 1 * u, -6 * u, 1 * u], cx, cy);
  } else if (id === 'speed') {   // velocidad: doble chevrón
    for (const o of [-3, 3]) { c.beginPath(); c.moveTo(cx + (o - 3) * u, cy - 5 * u); c.lineTo(cx + (o + 2) * u, cy); c.lineTo(cx + (o - 3) * u, cy + 5 * u); c.stroke(); }
  } else if (id === 'vital') {   // vitalidad: corazón
    circle(c, cx - 2.6 * u, cy - 2 * u, 3.2 * u); circle(c, cx + 2.6 * u, cy - 2 * u, 3.2 * u);
    poly(c, [-5.6 * u, -0.8 * u, 5.6 * u, -0.8 * u, 0, 6 * u], cx, cy);
  } else if (id === 'focus') {   // concentración: reloj
    c.beginPath(); c.arc(cx, cy, 5.5 * u, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(cx, cy - 3.5 * u); c.lineTo(cx, cy); c.lineTo(cx + 3 * u, cy + 1.5 * u); c.stroke();
  } else if (id === 'sense') {   // percepción del ki: ojo
    c.beginPath(); c.ellipse(cx, cy, 6.5 * u, 3.8 * u, 0, 0, Math.PI * 2); c.stroke();
    circle(c, cx, cy, 2.2 * u);
  } else if (id === 'crit') {   // golpe certero: mira
    c.beginPath(); c.arc(cx, cy, 5 * u, 0, Math.PI * 2); c.stroke();
    c.fillRect(cx - 0.8 * u, cy - 7.5 * u, 1.6 * u, 4 * u); c.fillRect(cx - 0.8 * u, cy + 3.5 * u, 1.6 * u, 4 * u);
    c.fillRect(cx - 7.5 * u, cy - 0.8 * u, 4 * u, 1.6 * u); c.fillRect(cx + 3.5 * u, cy - 0.8 * u, 4 * u, 1.6 * u);
  } else if (id === 'kictl') {   // control del Ki: rayo
    poly(c, [1.5 * u, -7 * u, -4 * u, 1 * u, -0.5 * u, 1 * u, -1.5 * u, 7 * u, 4 * u, -1 * u, 0.5 * u, -1 * u], cx, cy);
  } else if (id === 'absorb') {   // absorción: gota con una cruz
    circle(c, cx, cy + 1.5 * u, 4.5 * u); poly(c, [-3.8 * u, 0, 3.8 * u, 0, 0, -7 * u], cx, cy);
    c.fillStyle = '#ffffff'; c.fillRect(cx - 0.8 * u, cy - 1 * u, 1.6 * u, 5 * u); c.fillRect(cx - 2.5 * u, cy + 0.7 * u, 5 * u, 1.6 * u);
  } else if (id === 'area') {   // técnica amplia: dos anillos
    c.beginPath(); c.arc(cx, cy, 3 * u, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(cx, cy, 6.5 * u, 0, Math.PI * 2); c.stroke();
  } else if (id === 'multi') {   // multiplicación: tres esferas
    circle(c, cx - 4 * u, cy + 2.5 * u, 2.6 * u); circle(c, cx + 4 * u, cy + 2.5 * u, 2.6 * u); circle(c, cx, cy - 3.5 * u, 2.6 * u);
  } else if (id === 'luck') {   // suerte: moneda
    circle(c, cx, cy, 6 * u); c.fillStyle = '#5a3a10'; c.font = `700 ${Math.round(9 * u)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Z', cx, cy + 0.5 * u); c.textBaseline = 'alphabetic';
  } else if (id === 'gravity') {   // entrenamiento en gravedad: pesa
    c.fillRect(cx - 6 * u, cy - 1 * u, 12 * u, 2 * u);
    c.fillRect(cx - 7 * u, cy - 4 * u, 3 * u, 8 * u); c.fillRect(cx + 4 * u, cy - 4 * u, 3 * u, 8 * u);
  } else if (id === 'instinct') {   // instinto: tres líneas de movimiento
    for (const o of [-4, 0, 4]) { c.beginPath(); c.moveTo(cx - 6 * u + Math.abs(o) * 0.5 * u, cy + o * u); c.lineTo(cx + 6 * u, cy + o * u); c.stroke(); }
    circle(c, cx + 5 * u, cy, 1.8 * u);
  } else if (id === 'regen') {   // regeneración: cruz
    c.fillRect(cx - 1.8 * u, cy - 6 * u, 3.6 * u, 12 * u); c.fillRect(cx - 6 * u, cy - 1.8 * u, 12 * u, 3.6 * u);
  } else if (id === 'aura') {   // aura de combate: estrella de púas
    const pts = [];
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = (i % 2 ? 3 : 7) * u; pts.push(Math.cos(a) * r, Math.sin(a) * r); }
    poly(c, pts, cx, cy);
  } else if (id === 'tracker') {   // rastreador: el visor del scouter
    poly(c, [-6 * u, -4 * u, 6 * u, -4 * u, 6 * u, 3 * u, -6 * u, 3 * u], cx, cy);
    c.fillStyle = 'rgba(255,255,255,0.6)'; c.fillRect(cx - 4 * u, cy - 2 * u, 5 * u, 3 * u);
    c.fillStyle = PASSIVES.tracker.color; c.fillRect(cx + 4 * u, cy + 3 * u, 2 * u, 4 * u);
  } else if (id === 'sustain') {   // técnica sostenida: reloj de arena
    poly(c, [-5 * u, -6 * u, 5 * u, -6 * u, 0, 0], cx, cy); poly(c, [-5 * u, 6 * u, 5 * u, 6 * u, 0, 0], cx, cy);
  } else if (id === 'meditate') {   // meditación: cabeza sobre las piernas cruzadas
    circle(c, cx, cy - 3.5 * u, 2.6 * u); c.beginPath(); c.ellipse(cx, cy + 3.5 * u, 6.5 * u, 2.6 * u, 0, 0, Math.PI * 2); c.fill();
  } else if (id === 'fury') {   // furia: llama
    poly(c, [0, -7 * u, 4.5 * u, -1 * u, 5 * u, 3 * u, 2 * u, 6.5 * u, -2 * u, 6.5 * u, -5 * u, 3 * u, -3.5 * u, -1.5 * u, -1.5 * u, 1 * u], cx, cy);
  } else if (id === 'senzubag') {   // bolsa de semillas: una semilla
    c.beginPath(); c.ellipse(cx, cy, 4 * u, 6 * u, 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(cx - 1.5 * u, cy - 3 * u, 1.6 * u, 3 * u);
  } else if (id === 'armor') {   // armadura: escudo
    poly(c, [-5.5 * u, -5.5 * u, 5.5 * u, -5.5 * u, 5.5 * u, 0, 0, 6.5 * u, -5.5 * u, 0], cx, cy);
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.fillRect(cx - 1 * u, cy - 4 * u, 2 * u, 7 * u);
  }
}
// Una casilla del HUD (técnica o mejora) con su nivel en rayitas
function hudSlot(x, y, s, lvl, max, gold) {
  panel(x, y, s, s);
  if (gold) { ctx.strokeStyle = '#ffd93b'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, s - 2, s - 2); }
  const pw = (s - 8) / max;
  for (let k = 0; k < max; k++) {
    ctx.fillStyle = k < lvl ? (gold ? '#fff2a8' : '#ffd93b') : 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + 4 + k * pw, y + s - 5, Math.max(1, pw - 1), 2);
  }
}
// Nivel en texto chico sobre las rayitas; va después del ícono para que no lo tape
// (las técnicas evolucionadas ya llevan la estrella)
function hudSlotLevel(x, y, s, lvl, max) {
  if (lvl > 0) hudText(t('Nv.{n}', { n: lvl }), x + 3, y + s - 7, 9, lvl >= max ? '#ffd93b' : '#ffffff');
}
// Técnicas (fila 1) y mejoras de la partida (fila 2), al estilo Vampire Survivors.
// Devuelve hasta dónde llegan, para ubicar debajo los paneles de los compañeros.
const hudSlots = [];
// Con la pausa abierta, zonas invisibles sobre las casillas del HUD (que quedan debajo de la
// pantalla de pausa) para ver qué es cada técnica o mejora al pasar el mouse o tocarla
const hudTips = document.createElement('div');
hudTips.className = 'hud-tips';
document.body.appendChild(hudTips);
function buildHudTips() {
  hudTips.innerHTML = '';
  if (!G || !G.me) return;
  for (const sl of hudSlots) {
    const el = document.createElement('div');
    el.className = 'hud-tip';
    Object.assign(el.style, { left: `${sl.x}px`, top: `${sl.y}px`, width: `${sl.w || sl.s}px`, height: `${sl.s}px` });
    el.dataset.tip = sl.kind === 'attack' ? attackTip(G.me, sl.id) : sl.kind === 'effect' ? sl.tip : passiveTip(G.me, sl.id);
    hudTips.appendChild(el);
  }
}
const clearHudTips = () => { hudTips.innerHTML = ''; };
// Efectos activos de los deseos de Shenlong: chips con ícono y valor (en la pausa, al pasar el mouse, su descripción)
function drawWishEffects(P, x, y) {
  const fx = [];
  if (P.swapBody > 0) fx.push(['🔄', `${Math.ceil(P.swapBody)}s`, `${t('Cuerpo cambiado')}\n${t('Estás en el cuerpo de Ginyu: te mueves más lento y tus técnicas hacen 40% menos de daño. Los primeros segundos, los controles van al revés.')}`, '#c86aff']);
  if (P.immortal > 0) fx.push(['✨', `${Math.ceil(P.immortal)}s`, `${t('Inmortalidad')}\n${t('No recibes daño durante {n} s más.', { n: Math.ceil(P.immortal) })}`, '#ffe27a']);
  if (P.halo) fx.push(['🔥', `+${Math.round(ZENKAI * 100)}%`, `${t('Zenkai')}\n${t('Volviste de la Semilla de reserva más fuerte: +{n}% de daño y de vida máxima.', { n: Math.round(ZENKAI * 100) })}`, '#ffe14d']);
  if (P.wishDmg > 0) fx.push(['💪', `+${Math.round(P.wishDmg * 100)}%`, `${t('El más fuerte del universo')}\n${t('+{n}% de daño a todas tus técnicas.', { n: Math.round(P.wishDmg * 100) })}`, '#ff8a6a']);
  if (P.wishZeni > 0) fx.push(['💰', `+${P.wishZeni}`, `${t('Riquezas')}\n${t('+{n} Zeni al terminar la partida.', { n: P.wishZeni })}`, '#ffe27a']);
  if (ballsNeeded() < 7) fx.push(['🐉', `${ballsNeeded()}`, `${t('Atraer las esferas')}\n${t('Shenlong aparece con {n} Esferas del Dragón.', { n: ballsNeeded() })}`, '#7dff8a']);
  for (const [icon, val, tip, color] of fx) {
    ctx.font = `700 11px ${FONT}`;
    const w = Math.ceil(ctx.measureText(val).width) + 24, h = 16, top = y - h / 2;
    ctx.fillStyle = 'rgba(10,15,46,0.7)'; ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, top + 0.5, w - 1, h - 1);
    ctx.font = `11px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, x + 3, y + 1);
    ctx.textBaseline = 'alphabetic';
    hudText(val, x + 19, y + 4, 11, color);
    hudSlots.push({ x, y: top, s: h, w, kind: 'effect', tip });
    x += w + 4;
  }
}
function drawLoadout(P, top, compact) {
  const s = compact ? 26 : 30, gap = 3;
  // Mejoras que piden las técnicas que tienes (para marcar las combinaciones de evolución)
  const wanted = {};
  for (const a of P.attacks) {
    const evo = EVOLUTION_OF[a.id];
    if (evo && canLearn(P.charId, evo)) wanted[ATTACKS[evo].needs] = true;
  }
  hudSlots.length = 0;   // posiciones de las casillas, para mostrar su descripción en la pausa
  P.attacks.forEach((a, i) => {
    const x = 8 + i * (s + gap), d = ATTACKS[a.id];
    hudSlots.push({ x, y: top, s, kind: 'attack', id: a.id });
    hudSlot(x, top, s, d.evolved ? MAX_ATTACK_LEVEL : a.lvl, MAX_ATTACK_LEVEL, !!d.evolved);
    drawAttackIcon(a.id, x + 3, top + 1, s - 6);
    if (!d.evolved) hudSlotLevel(x, top, s, a.lvl, MAX_ATTACK_LEVEL);
    if (d.evolved) hudText('★', x + s - 6, top + 10, 10, '#ffd93b', 'center');
    const evo = EVOLUTION_OF[a.id];
    if (evo && canLearn(P.charId, evo)) {   // esquina con el color de la mejora que pide para evolucionar
      ctx.fillStyle = PASSIVES[ATTACKS[evo].needs].color; ctx.fillRect(x + s - 6, top + 2, 4, 4);
    }
  });
  for (let i = P.attacks.length; i < MAX_ATTACKS; i++) emptySlot(8 + i * (s + gap), top, s);   // casillas libres
  const owned = Object.keys(PASSIVES).filter(id => P.passives[id] > 0);
  const y2 = top + s + gap + 1;
  owned.forEach((id, i) => {
    const x = 8 + i * (s + gap);
    hudSlots.push({ x, y: y2, s, kind: 'passive', id });
    hudSlot(x, y2, s, P.passives[id], passiveMax(id), false);
    drawPassiveIcon(id, x + 3, y2 + 1, s - 6);
    hudSlotLevel(x, y2, s, P.passives[id], passiveMax(id));
    if (wanted[id]) hudText('★', x + s - 6, y2 + 10, 10, '#ffd93b', 'center');   // sirve para evolucionar una técnica tuya
  });
  for (let i = owned.length; i < MAX_PASSIVES; i++) emptySlot(8 + i * (s + gap), y2, s);
  return y2 + s;
}
// Casilla libre: marco tenue para ver cuánto lugar queda
function emptySlot(x, y, s) {
  ctx.fillStyle = 'rgba(10,15,46,0.35)'; ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(155,184,255,0.3)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}
// Off-screen teammate indicators: for any other real player (local co-op or online) who isn't
// currently visible on your screen/view, show a direction arrow at the edge with distance and a
// health-condition color (green/yellow/red), or a "down" label if they need reviving. Works the
// same in shared-camera and split-screen modes.
function drawTeammateIndicators() {
  const real = G.players.filter(p => !p.ally && !p.gone);
  if (real.length < 2) return;
  const drawFor = (me, view) => {
    for (const P of real) {
      if (P === me || P.hidden) continue;
      const rectX = view ? view.x : 0, rectY = view ? view.y : 0, rectW = view ? view.w : W, rectH = view ? view.h : H;
      const [sx, sy] = view ? splitScreenPoint(P.x, P.y, view) : toScreen(P.x, P.y);
      const margin = 30;
      if (sx > rectX - margin && sx < rectX + rectW + margin && sy > rectY - margin && sy < rectY + rectH + margin) continue;   // on screen already
      const cx = rectX + rectW / 2, cy = rectY + rectH / 2;
      const a = Math.atan2(sy - cy, sx - cx), r = Math.min(rectW, rectH) / 2 - 34;
      const ax = cx + Math.cos(a) * r, ay = cy + Math.sin(a) * r;
      const down = !!P.dead, hpPct = P.maxHp ? Math.max(0, P.hp) / P.maxHp : 1;
      const color = down ? '#9aa0c0' : hpPct < 0.3 ? '#ff4d4d' : hpPct < 0.65 ? '#ffd93b' : '#6cff7a';
      ctx.save(); ctx.beginPath(); ctx.rect(rectX, rectY, rectW, rectH); ctx.clip();
      ctx.translate(Math.round(ax), Math.round(ay)); ctx.rotate(a);
      ctx.globalAlpha = down ? 0.55 + 0.25 * Math.sin(G.t * 6) : 1;   // downed teammate's arrow pulses: come revive them
      ctx.fillStyle = '#0a0f2e'; poly(ctx, [13, 0, -9, -10, -9, 10], 0, 0);
      ctx.fillStyle = color; poly(ctx, [10, 0, -6, -7, -6, 7], 0, 0);
      ctx.globalAlpha = 1; ctx.rotate(-a); ctx.translate(-Math.round(ax), -Math.round(ay));
      const dist = Math.hypot(P.x - me.x, P.y - me.y);
      hudText(down ? t('Caído') : `${Math.round(dist / METERS)}m`, ax, ay + (Math.sin(a) > 0 ? -12 : 20), 10, color, 'center');
      ctx.restore();
    }
  };
  if (splitLayout) for (const view of splitLayout.views) drawFor(view.player, view);
  else drawFor(G.me, null);
}
// Small, always-on connection indicator during an online match: real round-trip ping (color-coded),
// direct vs. relayed path, how many peers are connected, and a reconnecting state when applicable.
function drawNetBadge() {
  const reconnecting = Net.reconnecting;
  const x = W - 10, y = 78;
  const ping = Net.ping, path = Net.path, peers = Net.peerCount;
  const pingColor = ping < 0 ? '#999' : ping < 120 ? '#6cff7a' : ping < 260 ? '#ffd93b' : '#ff6a6a';
  ctx.save();
  if (reconnecting) {
    const pulse = 0.6 + 0.4 * Math.sin(G.t * 8);
    ctx.globalAlpha = pulse;
    hudText(t('Reconectando...'), x, y, 13, '#ff9b3d', 'right');
  } else {
    const pingTxt = ping < 0 ? '...' : `${ping}ms`;
    const pathTxt = path === 'relay' ? t('(por intermediario)') : path === 'direct' ? t('(directo)') : '';
    hudText(`🌐 ${pingTxt} ${pathTxt}`.trim(), x, y, 11, pingColor, 'right');
    if (G.net.role === 'host') hudText(t('{n} conectados', { n: peers }), x, y + 13, 10, '#8fb0ff', 'right');
  }
  ctx.restore();
}
function edgeArrow(dx, dy, color) {
  const a = Math.atan2(dy, dx), r = Math.min(W, H) / 2 - 40;
  ctx.save(); ctx.translate(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); ctx.rotate(a);
  ctx.fillStyle = '#0a0f2e'; poly(ctx, [15, 0, -10, -11, -10, 11], 0, 0);
  ctx.fillStyle = color; poly(ctx, [11, 0, -7, -8, -7, 8], 0, 0); ctx.restore();
}
// Flecha hacia una Esfera del Dragón: en el borde de la pantalla, con la esfera y los metros que faltan
const METERS = 10;   // píxeles del mundo por metro
function ballArrow(dx, dy) {
  const a = Math.atan2(dy, dx), cs = Math.cos(a), sn = Math.sin(a), m = 54;
  const mv = sn > 0 ? 96 : 64;   // abajo deja lugar para la barra de Ki
  const k = Math.min((W / 2 - m) / Math.max(0.001, Math.abs(cs)), (H / 2 - mv) / Math.max(0.001, Math.abs(sn)));
  const x = W / 2 + cs * k, y = H / 2 + sn * k, pulse = 1 + 0.12 * Math.sin(performance.now() / 140);
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.rotate(a); ctx.scale(pulse, pulse);
  ctx.fillStyle = '#0a0f2e'; poly(ctx, [20, 0, -12, -14, -6, 0, -12, 14], 0, 0);
  ctx.fillStyle = '#ffa53d'; poly(ctx, [15, 0, -8, -10, -3, 0, -8, 10], 0, 0);
  ctx.restore();
  // La esfera y la distancia, del lado de adentro de la flecha
  const ix = -cs * 26, iy = -sn * 26;
  drawDragonBall(ctx, ix, iy, 7, 4, true);
  hudText(`${Math.round(Math.hypot(dx, dy) / METERS)} m`, ix, iy + 22, 13, '#ffd27a', 'center');
  ctx.restore();
}
// Jefes fuera de la pantalla: una flecha roja en el borde que apunta hacia él, con su retrato y la distancia
function drawBossPointers() {
  const V = viewer(), M = 50, TOP = 110, BOTTOM = 125;   // (abajo: la barra de Ki)   // TOP: debajo de los paneles de arriba (personaje, tiempo, barra del jefe)
  for (const e of G.enemies) {
    if (!e.boss || e.dead) continue;
    const sx = (e.x - camX + BW / 2) * PIX / DPR, sy = (e.y - camY + BH / 2) * PIX / DPR;
    if (sx > -10 && sx < W + 10 && sy > -10 && sy < H + 10) continue;   // se ve: no hace falta
    // Rectángulo donde puede ir el indicador, y el punto de su borde en la dirección del jefe
    const x0 = M, x1 = W - M, y0 = Math.min(TOP, H / 2 - 20), y1 = H - BOTTOM;
    const cx = W / 2, cy = (y0 + y1) / 2, dx = sx - cx, dy = sy - cy;
    const k = Math.min((x1 - cx) / Math.abs(dx || 1e-6), (y1 - cy) / Math.abs(dy || 1e-6));
    const x = cx + dx * k;
    let y = cy + dy * k;
    // Con el minimapa a la vista (arriba a la derecha), el indicador va debajo de él
    if (SAVE.showMap) {
      const px = Math.round(Math.min(220, Math.max(120, Math.min(W, H) * 0.24))), mx = W - px - 18, my = hudLayout().mapY;
      if (x > mx - 30 && y < my + px + 50) y = Math.min(y1, my + px + 50);
    }
    const an = Math.atan2(dy, dx), pulse = 0.75 + 0.25 * Math.sin(G.t * 6);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(20,6,12,0.8)'; ctx.beginPath(); ctx.arc(0, 0, 19, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ff4d5e'; ctx.lineWidth = 3; ctx.stroke();
    ctx.rotate(an);   // la punta, afuera del círculo
    ctx.fillStyle = `rgba(255,77,94,${pulse})`;
    ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(22, -11); ctx.lineTo(22, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (e.def.look) drawPortraitTo(ctx, e.def.look, false, x - 13, y - 13, 26);
    const dist = Math.round(Math.hypot(e.x - V.x, e.y - V.y) / 10);   // en "metros"
    hudText(`${dist} m`, x, y + 33, 12, '#ffb0b8', 'center');
  }
}
function drawHUD() {
  if (G.snake) snakeDrawHud();   // los kilómetros del Camino de la Serpiente
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (!G.snake) drawBossPointers();   // debajo de los paneles del HUD
  // Online: hace un rato que no llega nada del anfitrión
  if (G.net && G.net.role === 'client' && Net.lag > 2000) hudText(t('Conexión lenta con el anfitrión...'), W / 2, Math.min(150, H * 0.3), 15, '#ffb0a0', 'center');
  if (G.net) drawNetBadge();
  const P = G.me, compact = W < 640;
  // Barra de experiencia superior
  pbar(2, 2, W - 4, 6, G.xp / G.xpNext, '#3da5ff', '#b8e4ff');

  // Panel del personaje
  const pw = compact ? 170 : 220;
  panel(8, 14, pw, 58);
  const inGogeta = G.fusion && G.fusion.phase === 'fused' && G.fusion.ids.includes(P.id);
  if (inGogeta) drawPortraitTo(ctx, GOGETA.look, false, 14, 18, 48);
  else drawPortraitTo(ctx, P.c.look, formKeyFor(P), 14, 18, 48);
  hudText(inGogeta ? 'Gogeta' : G.players.length > 1 ? P.name : P.c.name, 66, 34, 15, '#ffe27a');
  hudText(t('Nv {n}', { n: G.level }), pw - 2, 34, 13, '#ffffff', 'right');
  // Con la Semilla de reserva comprada, la barra se acorta y al lado va el poroto: verde si está, apagado y tachado si ya se usó
  const reserve = perk(P, 'senzu') > 0, barW = pw - (reserve ? 98 : 78);
  pbar(66, 44, barW, 9, P.hp / P.maxHp, P.hp / P.maxHp > 0.3 ? '#4dff6a' : '#ff4d4d');
  hudText(P.dead ? t('Caído') : `${Math.ceil(P.hp)}/${P.maxHp}`, 66 + barW / 2, 66, 11, '#ffffff', 'center');
  if (reserve) hudReserveSenzu(66 + barW + 13, 48, P.senzuLeft > 0);
  // Esferas del Dragón (5 casilleros después del deseo Atraer las esferas)
  for (let i = 0; i < ballsNeeded(); i++) {
    const x = 18 + i * 18, y = 84;
    if (i < G.dragonBalls) drawDragonBall(ctx, x, y, 6, i + 1, false);
    else {
      ctx.fillStyle = 'rgba(10,15,46,0.55)'; circle(ctx, x, y, 6);
      ctx.strokeStyle = 'rgba(255,184,28,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Técnicas y mejoras de la partida
  const loadoutEnd = drawLoadout(P, 96, compact);
  // Efectos de los deseos, a la derecha de las esferas (después de drawLoadout: agrega sus ayudas a hudSlots)
  drawWishEffects(P, 18 + ballsNeeded() * 18 + 2, 84);
  // Compañeros
  let ty = loadoutEnd + 6;
  G.players.forEach((Q, i) => {
    if (Q === P || Q.gone || Q.ally) return;
    const qFused = G.fusion && G.fusion.phase === 'fused' && G.fusion.ids.includes(Q.id);
    panel(8, ty, 190, 46);
    const qAf = Q.transformed > 0 ? activeForm(Q) : null;
    const qFormKey = qAf ? qAf.key : (Q.transformed > 0 && hasTransformLook(Q.c));
    if (qFused) drawPortraitTo(ctx, GOGETA.look, false, 12, ty + 7, 32);
    else drawPortraitTo(ctx, Q.c.look, qFormKey, 12, ty + 7, 32);
    hudText(qFused ? `${Q.name} (Gogeta)` : `${Q.name} · ${Q.c.name}`, 50, ty + 14, 11, PLAYER_COLORS[i % 4]);
    const qSecs = qFused ? G.fusion.t : Q.transformed;
    if (!Q.dead && qSecs > 0) hudText(`${Math.ceil(qSecs)}s`, 194, ty + 14, 11, qFused ? '#ffe14d' : formAura(Q), 'right');
    pbar(50, ty + 20, 140, 6, Q.dead ? 0 : Q.hp / Q.maxHp, Q.dead ? '#777' : '#4dff6a');
    const qKi = qFused ? Math.max(0, Math.min(1, G.fusion.t / G.fusion.dur)) : Q.transformed > 0 ? Math.max(0, Math.min(1, Q.transformed / (Q.trMax || Q.transformed))) : Q.ki / 100;
    pbar(50, ty + 32, 140, 5, qKi, qFused || Q.transformed > 0 ? formAura(Q) : '#ff9b3d');
    const qKiLabel = Q.dead ? t('Caído') : Q.transformed > 0 ? ((qAf && qAf.name) || Q.c.transform)
      : G.localCoop && Q.id === 1 ? `RCTRL · KI ${Math.floor(Q.ki)}%` : `KI ${Math.floor(Q.ki)}%`;
    hudText(qKiLabel, 120, ty + 44, 9, '#ffffff', 'center');
    ty += 50;
    if (Q.hidden) return;
    const dx = Q.x - P.x, dy = Q.y - P.y;
    if (Math.abs(dx) > BW / 2 || Math.abs(dy) > BH / 2) edgeArrow(dx, dy, PLAYER_COLORS[i % 4]);
  });
  // Tiempo y bajas
  const L = hudLayout();
  if (L.narrow) { // celular en vertical: un solo panel bajo los botones
    panel(L.statsX, L.statsY, 138, 36);
    hudText(fmtTime(G.t), L.statsX + 38, L.statsY + 24, 17, '#ffffff', 'center');
    hudText(`☠ ${G.kills}`, L.statsX + 102, L.statsY + 24, 14, '#ffffff', 'center');
    if (G.speed > 1) hudText(`x${FAST_SPEED}`, L.statsX + 69, L.statsY + 50, 13, '#ffd93b', 'center');
  } else {
    panel(W / 2 - 50, 14, 100, 38);
    hudText(fmtTime(G.t), W / 2, 41, 20, '#ffffff', 'center');
    if (G.lv.infinite) hudText(t('Vuelta {n}', { n: kaioRound() }), W / 2 - 58, 38, 13, '#ffb0bc', 'right');   // a la izquierda del reloj
    if (G.speed > 1) hudText(`x${FAST_SPEED}`, W / 2 + 58, 30, 14, '#ffd93b', 'left');
    // Bajas: a la izquierda de los botones (mapa, música y pausa), o bajo el reloj si no hay espacio
    panel(L.killsX, L.killsY, 100, 38);
    hudText(`☠ ${G.kills}`, L.killsX + 50, L.killsY + 25, 15, '#ffffff', 'center');
  }

  // Barra de Ki: carga, transformación (con segundos restantes) o fusión
  // En pantallas táctiles la barra deja sitio al botón ¡KI! de la derecha
  const touchUi = isTouch() && W < 900;
  const kw = touchUi ? Math.min(360, W - 120) : Math.min(360, W - 40), kx = touchUi ? 12 : (W - kw) / 2;
  const kh = 14, ky = H - 26 - kh;   // 2.14.1: barra más gruesa y con su propio marco (a algunos jugadores les costaba verla)
  // Medidor de ataque combinado (co-op, 2+ jugadores vivos): propia barra fina arriba de la de Ki
  // (claramente por encima del panel de la barra de Ki -que se dibuja después y taparía cualquier
  // cosa que se superponga con su marco- para que no quede pintada por encima)
  if (teamUltActive()) {
    const tuh = 8, tuy = ky - 25 - tuh - 10, ready = G.teamUlt >= TEAM_ULT_MAX;
    panel(kx - 10, tuy - 4, kw + 20, tuh + 8);
    pbar(kx, tuy, kw, tuh, G.teamUlt / TEAM_ULT_MAX, ready ? (Math.floor(G.t * 6) % 2 ? '#ffe14d' : '#fff27a') : '#9a6cff');
    hudText(ready ? t('¡ATAQUE COMBINADO LISTO!') : t('Ataque combinado · {n}%', { n: Math.floor(G.teamUlt) }), kx + kw / 2, tuy + tuh + 1, 10, '#ffffff', 'center');
  }
  const kiVerb = t(isTouch() ? 'Toca ¡KI!' : 'Espacio');
  const F = G.fusion, blink = Math.floor(G.t * 6) % 2;
  let frac, color, label, labelColor = '#ffffff', focusBar = -1;   // -1: no se está concentrando
  if (P.transformed <= 0) P.trMax = 0;
  if (F && F.ids.includes(P.id)) {
    if (F.phase === 'dance') { frac = 1; color = '#ffffff'; label = t('¡Fu... sión... HA!'); labelColor = '#ffe14d'; }
    else {
      frac = F.t / F.dur; color = '#ffe14d'; labelColor = '#ffe14d';
      const ready = F.bbCd <= 0 ? t('listo') : `${Math.ceil(F.bbCd)}s`;
      const role = !G.net ? `${kiVerb}: Big Bang Kamehameha (${ready})`
        : P.id === F.gunnerId ? `${t('Controlas las técnicas')} · ${kiVerb}: Big Bang (${ready})` : t('Tú mueves a Gogeta');
      label = `Gogeta · ${Math.ceil(F.t)}s · ${role}`;
    }
  } else if (P.transformed > 0) {
    P.trMax = Math.max(P.trMax || 0, P.transformed);   // duración total (varía según el personaje y el deseo)
    frac = Math.min(1, P.transformed / P.trMax); color = formAura(P);
    label = `${(activeForm(P) && activeForm(P).name) || P.c.transform} · ${Math.ceil(P.transformed)}s`;
  } else if (P.ki >= 100 && !rule('notrans')) {
    frac = 1; color = blink ? '#ffd93b' : '#fff27a'; labelColor = '#ffe27a';
    const partner = fusionPartner(P), focus = kiFocus(P);
    focusBar = focus;
    if (focus >= 1) { color = blink ? '#7fe6ff' : '#e8fbff'; labelColor = '#9ff0ff'; }   // concentrado: todo celeste
    const upcomingForms = charForms(P.c);
    const nextForm = upcomingForms[Math.min(P.tier || 0, upcomingForms.length - 1)];
    const nextName = (nextForm && nextForm.name) || P.c.transform;
    label = partner ? t('¡FUSIÓN DISPONIBLE! Pulsa Ki junto a {name}', { name: partner.name })
      : focus >= 1 ? `${t('¡KI CONCENTRADO!')} ${kiVerb}: ${nextName} ${t('(+50% de duración, +25% de daño)')}`
      : `${t('¡KI AL MÁXIMO!')} ${kiVerb}: ${nextName} · ${t('Concentrando {n}%', { n: Math.floor(focus * 100) })}`;
  } else { frac = P.ki / 100; color = '#ff9b3d'; label = `KI · ${Math.floor(P.ki)}%`; labelColor = '#ffd27a'; }
  panel(kx - 10, ky - 25, kw + 20, kh + 33);   // marco como el resto del HUD
  // Llena, transformado o fusionado: la barra brilla
  if (frac >= 1 || (P.transformed > 0) || (F && F.ids && F.ids.includes(P.id))) {
    ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 10 + 6 * Math.sin(G.t * 6);
    ctx.fillStyle = color; ctx.fillRect(kx - 2, ky - 2, kw + 4, kh + 4); ctx.restore();
  }
  pbar(kx, ky, kw, kh, frac, color);
  if (focusBar >= 0 && focusBar < 1) {   // Ki concentrándose: el Ki azul llena la barra amarilla, de alto completo
    const fw = Math.round((kw - 4) * focusBar), g = ctx.createLinearGradient(0, ky + 2, 0, ky + kh - 2);
    g.addColorStop(0, '#c4f4ff'); g.addColorStop(0.5, '#55c8ff'); g.addColorStop(1, '#1f7ce0');
    ctx.fillStyle = g; ctx.fillRect(kx + 2, ky + 2, fw, kh - 4);
    ctx.fillStyle = 'rgba(40,20,0,0.45)';   // marcas cada 25%
    for (let k = 1; k < 4; k++) ctx.fillRect(kx + 2 + Math.round((kw - 4) * k / 4), ky + 2, 1, kh - 4);
    if (fw > 0) {   // el frente que avanza, blanco y brillante
      ctx.save(); ctx.shadowColor = '#bff4ff'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(kx + 2 + fw - 2, ky, 2, kh);
      ctx.restore();
    }
  }
  // El texto se achica hasta entrar en el marco (con el Ki lleno es largo: «¡KI AL MÁXIMO! Espacio: … · Concentrando 45%»)
  let ks = touchUi ? 13 : 14;
  for (; ks > 9; ks--) { ctx.font = `700 ${ks}px ${FONT}`; if (ctx.measureText(label).width <= kw + 12) break; }
  hudText(label, kx + kw / 2, ky - 7, ks, labelColor, 'center');

  // Jefe
  // Jefes (uno o varios a la vez)
  G.enemies.filter(e => e.boss).forEach((boss, i) => {
    const bw = Math.min(420, W - 40), bx = (W - bw) / 2, by = L.bossY + i * BOSS_BAR_GAP;
    const enraged = boss.enraged && Math.floor(G.t * 4) % 2;
    hudText(boss.enraged ? `${boss.def.name} · ${t('¡FURIOSO!')}` : boss.def.name, W / 2, by, 15, enraged ? '#fff27a' : '#ff8a9a', 'center');
    pbar(bx, by + 6, bw, 10, boss.hp / boss.maxHp, enraged ? '#ffb020' : '#ff3d5c', '#ffb0bc');
    const dx = boss.x - P.x, dy = boss.y - P.y;
    if (Math.abs(dx) > BW / 2 || Math.abs(dy) > BH / 2) edgeArrow(dx, dy, '#ff3d5c');
  });
  drawHudMap();
  // Radar del Dragón: flecha en el borde hacia cada esfera tirada fuera de pantalla, con la distancia
  // (va después del mapa para que no la tape)
  for (const p of G.pickups) {
    if (p.kind !== 'ball') continue;
    const dx = p.x - P.x, dy = p.y - P.y;
    if (Math.abs(dx) > BW / 2 || Math.abs(dy) > BH / 2) ballArrow(dx, dy);
  }
  // Anuncio
  if (G.banner) {
    ctx.globalAlpha = Math.min(1, G.banner.t * 2);
    hudText(t(G.banner.text, G.banner.params), W / 2, H * 0.26, compact ? 18 : 26, G.banner.color, 'center');
    ctx.globalAlpha = 1;
  }
  if (P.dead && G.players.length > 1) hudText(t('Has caído: un compañero puede reanimarte si se queda a tu lado'), W / 2, H * 0.36, 15, '#ffb0bc', 'center');
  // Joystick táctil
  if (joy.active) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 50, 0, Math.PI * 2); ctx.stroke();
    const dx = joy.x - joy.ox, dy = joy.y - joy.oy, d = Math.min(50, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; circle(ctx, joy.ox + Math.cos(a) * d, joy.oy + Math.sin(a) * d, 20);
  }
}

// ─── Menú ────────────────────────────────────────────────────────────────────
// Selector de nivel: una tarjeta por nivel (abierto, ganado o bloqueado), con los colores de su mapa,
// y al final una tarjeta del Nivel 5 que todavía no existe ("Próximamente")
function buildLevels() {
  const list = $('levelList'), sel = myLevel();
  list.innerHTML = '';
  // Desafío semanal arriba de todo (js/weekly.js), si se pudo cargar
  if (WEEKLY && typeof weeklyCard === 'function') list.appendChild(weeklyCard(sel === 'weekly'));
  if (typeof weeklyCharNote === 'function') weeklyCharNote();
  for (const L of LEVELS) {
    const open = isLevelOpen(L.id), won = !!SAVE.levelsWon[L.id], card = document.createElement('button');
    card.className = 'level-card' + (L.id === sel ? ' selected' : '') + (open ? '' : ' locked');
    const fb = L.bosses.find(b => b.final);
    const state = !open ? t('🔒 Gana el Nivel {n} para abrirlo', { n: L.num - 1 }) : L.infinite ? t('♾ Infinito · gana quien más aguanta')
      : won ? t('✓ Ganado') : t('Jefe final: {name}', { name: bossDef(fb.id).name });
    card.innerHTML = `${levelPic(L.id)}<b>${t('Nivel {n}', { n: L.num })}</b><small>${esc(L.desc)}</small>
      <span class="lv-state">${esc(state)}</span>`;
    card.onclick = () => {
      if (!open) return;
      SFX.unlock();
      SAVE.level = L.id; writeSave();
      buildMenu();
      Net.levelChanged();
    };
    list.appendChild(card);
  }
  if (typeof bonusSection === 'function') list.appendChild(bonusSection(sel));   // NIVELES BONUS (js/bonus.js)
  if (!G && THEME !== THEMES[levelDef(sel).theme]) setTheme(levelDef(sel).theme);   // el fondo del menú usa el mapa del nivel
}
// Foto del nivel para las tarjetas de la ventana de Jugar (assets/levels/<id>.png, recortes de los mapas de los juegos de GBA)
const levelPic = id => `<span class="lv-pic" style="background-image:url('assets/levels/${id}.png')"></span>`;
function buildMenu() {
  $('zeniTotal').textContent = SAVE.zeni;
  updateCharDetail();
  $('nameInput').value = SAVE.name || '';
  buildLevels();
  const list = $('charList'), fixed = weeklyChar();
  list.innerHTML = '';
  for (const id in CHARACTERS) {
    const c = CHARACTERS[id];
    const card = document.createElement('div');
    card.className = 'char-card' + (id === activeSetupChar() ? ' selected' : '') + (fixed && id !== fixed ? ' wk-off' : '');
    const cv = document.createElement('canvas');
    cv.width = 96; cv.height = 132;
    card.appendChild(cv);
    const info = document.createElement('div');
    info.innerHTML = `<h3></h3><div class="title"></div><div class="info">${t('Técnica')}: <b></b><br>${t('Transformación')}: <b></b><br><span class="perk"></span></div><div class="best"></div>`;
    info.querySelector('h3').textContent = c.name;
    info.querySelector('.title').textContent = c.title;
    const bs = info.querySelectorAll('.info b');
    bs[0].textContent = ATTACKS[c.start].name;
    bs[1].textContent = c.transform;
    info.querySelector('.perk').textContent = c.perk;
    const best = bestOf(myLevel(), id);   // récord en el nivel elegido
    info.querySelector('.best').textContent = best ? t('Récord: {time}', { time: fmtTime(best) }) : t('Sin récord');
    card.appendChild(info);
    if (fixed && id !== fixed) {   // desafío semanal con guerrero fijo: los demás, grises y sin elegir
      card.title = t('Este desafío se juega solo con {name}.', { name: CHARACTERS[fixed].name });
      list.appendChild(card);
      card._cv = cv; card._c = c; card._id = id;
      continue;
    }
    if (!isUnlocked(id) && id !== fixed && !weeklyOpen()) {   // (en el desafío se prestan todos)
      // Bloqueado: silueta, cómo se consigue y el progreso (o el botón de compra con Zeni)
      card.classList.add('locked');
      const lock = document.createElement('div');
      lock.className = 'lock-info';
      lock.innerHTML = `<b>🔒 ${esc(c.unlock.text)}</b><span>${esc(unlockProgress(id))}</span>`;
      if (c.unlock.kind === 'zeni') {
        const buy = document.createElement('button');
        buy.className = 'btn small shop-btn';
        buy.textContent = t('Desbloquear ({n} Zeni)', { n: c.unlock.cost });
        buy.disabled = SAVE.zeni < c.unlock.cost;
        buy.onclick = ev => { ev.stopPropagation(); buyUnlock(id); };
        lock.appendChild(buy);
      }
      card.appendChild(lock);
      list.appendChild(card);
      card._cv = cv; card._c = c; card._id = id;
      continue;
    }
    card.onclick = () => { SFX.unlock(); selectChar(id); };
    card.ondblclick = () => localCoopSetup ? startLocalCoop() : startSolo();
    list.appendChild(card);
    card._cv = cv; card._c = c; card._id = id;
  }
}
// En co-op, la rejilla de guerreros se comparte entre los dos jugadores: esta "casilla activa"
// (0 = Jugador 1, 1 = Jugador 2) decide a cuál de los dos afecta un clic sobre una tarjeta.
let setupCoopSlot = 0;
const activeSetupChar = () => (localCoopSetup && setupCoopSlot === 1) ? (CHARACTERS[SAVE.coopChar2] ? SAVE.coopChar2 : myChar()) : myChar();
function selectChar(id) {
  if (weeklyChar() && id !== weeklyChar()) return;   // desafío semanal con guerrero fijo
  if (localCoopSetup && setupCoopSlot === 1) { SAVE.coopChar2 = id; writeSave(); }
  else { SAVE.char = id; writeSave(); Net.changeChar(id); }
  for (const card of $('charList').children) card.classList.toggle('selected', card._id === id);
  updateCharDetail();
}
// Resumen del personaje elegido (solo visible en pantallas chicas, donde las tarjetas son compactas)
function updateCharDetail() {
  const c = CHARACTERS[activeSetupChar()];
  $('charDetail').textContent = `${c.name}: ${ATTACKS[c.start].name} · ${c.transform} · ${c.perk}`;
  const mini = $('setupCharMini'); if (mini) mini.textContent = CHARACTERS[myChar()].name;
}
function renderMenuPortraits(t) {
  for (const card of $('charList').children) {
    const cx = card._cv.getContext('2d'), c = card._c;
    const active = !card.classList.contains('locked') && (card.matches(':hover') || card._id === activeSetupChar());
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, 96, 132);
    cx.imageSmoothingEnabled = false;
    cx.save(); cx.scale(2.5, 2.5); // 38×53 unidades: deja sitio a las llamas del aura
    if (active && !c.buddy) drawAura(cx, c.aura, 19, 38, t, 0.85);   // (Mr. Satán sin aura)
    drawActor(cx, c.look, 19, 37, { anim: active ? 'walk' : 'idle', t, ssj: active && hasTransformLook(c) ? baseFormKey(c) : false });
    if (active && !c.buddy) drawAuraFront(cx, c.aura, 19, 38, t, 0.85);
    cx.restore();
  }
}
// Duelo de la portada: un guerrero (de los que tienes) contra un jefe, al azar y distintos a los de la vez anterior.
// Se sortea al abrir el juego y cada vez que se vuelve al menú principal.
let MENU_DUEL = null;
function rollMenuDuel() {
  const heroes = Object.keys(CHARACTERS).filter(id => isUnlocked(id)), bosses = BOSSES.filter(b => b.look).map(b => b.id);
  const prev = MENU_DUEL;
  let hero, boss;
  for (let i = 0; i < 30; i++) {
    hero = pick(heroes); boss = pick(bosses);
    if (hero === 'vegeta' && boss === 'vegetas') continue;   // Vegeta contra Vegeta, no
    if (!prev || (hero !== prev.hero && boss !== prev.boss)) break;
  }
  MENU_DUEL = { hero, boss };
}
// Escena del menú principal: un guerrero (transformado, con su aura) frente a un jefe, sorteados (rollMenuDuel)
function renderMenuHero(t) {
  const cv = $('menuHero');
  if (!cv || !cv.offsetParent) return;   // menú oculto
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, S = 3.1;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, W, H);
  c.imageSmoothingEnabled = false;
  if (!MENU_DUEL) rollMenuDuel();
  const ch = CHARACTERS[MENU_DUEL.hero] || CHARACTERS.goku, boss = bossDef(MENU_DUEL.boss) || bossDef('raditz');
  // Brillo de fondo y piso
  const g = c.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, H * 0.75);   // se apaga antes de los bordes
  g.addColorStop(0, 'rgba(255, 225, 120, 0.35)'); g.addColorStop(1, 'rgba(255, 225, 120, 0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(10, 15, 46, 0.45)'; c.beginPath(); c.ellipse(W / 2, H - 12, W * 0.42, 5, 0, 0, Math.PI * 2); c.fill();
  const feet = H - 14, bob = Math.sin(t * 3) * 2;
  // Guerrero a la izquierda, transformado y con el aura
  c.save(); c.translate(150, 0); c.scale(S, S);
  const hx = 0, hy = (feet + bob) / S - 12;
  if (!ch.buddy) drawAura(c, ch.aura, hx, hy + 1, t, 0.85);   // Mr. Satán no tiene aura: posa
  drawActor(c, ch.look, hx, hy, { facing: 1, dir: ch.buddy ? 'down' : 'side', anim: ch.buddy ? 'pose' : 'idle', t, ssj: hasTransformLook(ch) ? baseFormKey(ch) : false, noShadow: true });
  if (!ch.buddy) drawAuraFront(c, ch.aura, hx, hy + 1, t, 0.85);
  c.restore();
  // El jefe a la derecha, mirándolo
  const bs = S * 0.75 * boss.scale;
  c.save(); c.translate(W - 150, 0); c.scale(bs / boss.scale, bs / boss.scale);
  drawActor(c, boss.look, 0, (feet - Math.sin(t * 3 + 1) * 2) / (bs / boss.scale) - 12 * boss.scale, { facing: -1, dir: 'side', anim: 'idle', t, scale: boss.scale, noShadow: true });
  c.restore();
  // VS en el medio
  const pulse = 1 + 0.06 * Math.sin(t * 5);
  c.save(); c.translate(W / 2, H * 0.58); c.scale(pulse, pulse);
  c.font = `700 44px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  c.lineWidth = 10; c.strokeStyle = '#0a0f2e'; c.strokeText('VS', 0, 0);
  c.fillStyle = '#ff5c3d'; c.fillText('VS', 0, 0);
  c.restore();
}
// Fondo del menú: el páramo con un desfile de enemigos
const PARADE = [];
function renderMenuBackground(t) {
  beginWorld(t * 18, Math.sin(t * 0.2) * 40);
  const props = drawGround(bctx, camX, camY, BW, BH);
  prewarmThemes(camX, camY, BW, BH);   // los otros mapas, listos para cuando se elija otro nivel
  if (!PARADE.length) {
    const ids = Object.keys(ENEMIES);
    for (let i = 0; i < 14; i++) {
      PARADE.push({ look: ENEMIES[ids[i % ids.length]].look, off: Math.random() * 600, y: rand(-0.4, 0.4), sp: rand(28, 40), ph: Math.random() * 5 });
    }
  }
  const list = [];
  for (const p of props) list.push({ y: p.y, p });
  if (spritesReady) for (const a of PARADE) {   // el desfile de fondo, solo con los sprites de GBA ya cargados
    const span = BW + 120, x = camX - BW / 2 - 60 + ((a.off + t * a.sp) % span), y = camY + a.y * BH;
    list.push({ y: y + 12, a, x, ay: y });
  }
  list.sort((a, b) => a.y - b.y);
  for (const it of list) {
    if (it.p) drawProp(bctx, it.p);
    else drawActor(bctx, it.a.look, it.x, it.ay, { anim: 'walk', t: t + it.a.ph, facing: 1 });
  }
  presentWorld();
}

// ─── Tienda de Zeni ──────────────────────────────────────────────────────────
function renderShop() {
  const lv = myPerks();
  $('shopZeni').textContent = SAVE.zeni;
  const list = $('shopList');
  list.innerHTML = '';
  for (const u of SHOP_UPGRADES) {
    const l = lv[u.id], maxed = l >= u.max, cost = maxed ? 0 : shopCost(u, l);
    const item = document.createElement('div');
    item.className = 'shop-item' + (maxed ? ' maxed' : '');
    item.innerHTML = `<div class="shop-icon"></div><div class="shop-body"><div class="shop-name"></div>
      <div class="shop-desc"></div><div class="shop-pips"></div><button class="btn shop-buy"></button></div>`;
    const icon = item.querySelector('.shop-icon');
    icon.textContent = u.icon; icon.style.background = u.color;
    item.querySelector('.shop-name').textContent = u.name;
    const now = u.fmt(l * u.per), next = u.fmt((l + 1) * u.per);
    item.querySelector('.shop-desc').textContent = maxed ? `${now} ${t('(máximo)')}` : l ? `${t('Ahora')}: ${now} → ${next}` : next;
    const pips = item.querySelector('.shop-pips');
    for (let i = 0; i < u.max; i++) { const p = document.createElement('i'); if (i < l) p.className = 'on'; pips.appendChild(p); }
    const btn = item.querySelector('.shop-buy');
    btn.textContent = maxed ? t('Completo') : t('Comprar · {n} Z', { n: cost });
    btn.disabled = maxed || SAVE.zeni < cost;
    btn.onclick = () => buyUpgrade(u.id);
    list.appendChild(item);
  }
  const refund = shopSpent(), reset = $('btnShopReset');
  reset.disabled = refund === 0;
  reset.classList.remove('confirm');
  reset.textContent = refund ? t('Reiniciar mejoras (+{n} Z)', { n: refund }) : t('Reiniciar mejoras');
}
// Zeni total invertido en las mejoras compradas (lo que se devuelve al reiniciar)
function shopSpent() {
  const lv = myPerks();
  let total = 0;
  for (const u of SHOP_UPGRADES) for (let l = 0; l < lv[u.id]; l++) total += shopCost(u, l);
  return total;
}
function resetUpgrades() {
  const btn = $('btnShopReset'), refund = shopSpent();
  if (!refund) return;
  if (!btn.classList.contains('confirm')) { // primer clic: pedir confirmación
    btn.classList.add('confirm');
    btn.textContent = t('¿Seguro? Recuperas {n} Z', { n: refund });
    return;
  }
  SAVE.zeni += refund;
  SAVE.upgrades = {};
  writeSave();
  SFX.unlock(); SFX.play('ball');
  renderShop();
}
function buyUpgrade(id) {
  const u = SHOP_UPGRADES.find(x => x.id === id), lv = myPerks(), l = lv[id];
  if (!u || l >= u.max) return;
  const cost = shopCost(u, l);
  if (SAVE.zeni < cost) return;
  SAVE.zeni -= cost;
  SAVE.upgrades = Object.assign({}, lv, { [id]: l + 1 });
  for (const a of ACHIEVEMENTS) if (a.goal && a.progress(SAVE) >= achGoal(a)) unlockAch(a.id);   // p. ej. «Entrenamiento completo»
  writeSave();
  SFX.unlock(); SFX.play('levelup');
  renderShop();
}
$('btnShop').onclick = () => { SFX.unlock(); renderShop(); $('menu').classList.add('hidden'); $('shop').classList.remove('hidden'); };
$('btnShopReset').onclick = resetUpgrades;
$('btnMap').onclick = e => { toggleMap(); e.currentTarget.blur(); };
// Pantalla completa (útil en celulares para ocultar las barras del navegador)
if (document.fullscreenEnabled) {
  $('btnFullscreen').classList.remove('hidden');
  $('btnFullscreen').onclick = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  document.addEventListener('fullscreenchange', () => {
    $('btnFullscreen').textContent = t(document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa');
  });
}

// ─── Modo prueba: panel de Poderes (F6) ──────────────────────────────────────
// Cualquier técnica (también las de otros guerreros y las evoluciones) y cualquier mejora, con los mismos topes de
// casillas que en la partida. En solitario la partida queda en pausa mientras está abierto.
const testPowersOpen = () => !$('testPowers').classList.contains('hidden');
function toggleTestPowers(force) {
  if (!TEST_MODE || !G || !isAuthority()) return;
  const open = force !== undefined ? force : !testPowersOpen();
  if (open) {
    if (G.mode !== 'play' && !G.net) return;
    if (!G.net) G.mode = 'testpowers';
    $('testPowers').classList.remove('hidden');
    renderTestPowers();
  } else {
    $('testPowers').classList.add('hidden');
    if (G.mode === 'testpowers') G.mode = 'play';
  }
}
function testPowerChange(kind, id, delta) {
  const P = G.me;
  if (kind === 'atk') {
    const def = ATTACKS[id], a = P.attacks.find(x => x.id === id);
    const base = def.evolved && def.from, owned = base && P.attacks.find(x => x.id === base);
    if (delta > 0) {
      if (a) { if (a.lvl < MAX_ATTACK_LEVEL && !def.evolved) a.lvl++; }
      else if (owned) { owned.id = id; owned.lvl = MAX_ATTACK_LEVEL; owned.cd = 0.3; }   // la evolución reemplaza a su técnica
      else if (P.attacks.length < MAX_ATTACKS) P.attacks.push({ id, lvl: def.evolved ? MAX_ATTACK_LEVEL : 1, cd: 0.3 });
    } else if (a) {
      if (!def.evolved && a.lvl > 1) a.lvl--;
      else P.attacks.splice(P.attacks.indexOf(a), 1);
    }
  } else {
    const lv = P.passives[id] || 0;
    const used = Object.keys(PASSIVES).filter(k => P.passives[k] > 0).length;
    if (delta > 0 && lv < passiveMax(id) && (lv > 0 || used < MAX_PASSIVES)) {
      P.passives[id] = lv + 1;
      if (id === 'vital') { P.maxHp += 20; healPlayer(P, 20); }
    } else if (delta < 0 && lv > 0) {
      P.passives[id] = lv - 1;
      if (id === 'vital') { P.maxHp -= 20; P.hp = Math.min(P.hp, P.maxHp); }
    }
  }
  renderTestPowers();
}
// Botones de una sola acción (a diferencia de las filas +/- de técnicas/mejoras de abajo)
function adminAction(kind, id) {
  const P = G.me;
  if (kind === 'heal') { P.hp = P.maxHp; addText(P.x, P.y - 30, t('Admin: HP al máximo'), '#6cff7a', true); }
  else if (kind === 'ki') { P.ki = 100; addText(P.x, P.y - 30, t('Admin: Ki al máximo'), '#ffd93b', true); }
  else if (kind === 'zeni') { SAVE.zeni += 1000; addText(P.x, P.y - 30, '+1000 Zeni', '#ffd93b', true); }
  else if (kind === 'clear') { for (const e of G.enemies) if (!e.boss) e.dead = true; addText(P.x, P.y - 30, t('Admin: enemigos comunes eliminados'), '#ff8ad8', true); }
  else if (kind === 'maxtier') {
    const forms = charForms(P.c);
    if (forms.length) { P.tier = Math.max(0, forms.length - 1); doTransform(P, 9999, true); addText(P.x, P.y - 30, t('Admin: forma máxima'), '#ffe14d', true); }
    else addText(P.x, P.y - 30, t('Este guerrero no tiene formas'), '#aaa', true);
  } else if (kind === 'untransform') { P.transformed = 0; P.tier = 0; }
  else if (kind === 'unlockall') { for (const cid in CHARACTERS) SAVE.unlocked[cid] = true; addText(P.x, P.y - 30, t('Admin: todos los guerreros desbloqueados'), '#8fe3ff', true); }
  else if (kind === 'boss') { const b = BOSSES.find(x => x.id === id); if (b) spawnBoss(b); }
  else if (kind === 'enemy') { if (ENEMIES[id]) spawnEnemy(id, { pos: { x: P.x + rand(-70, 70), y: P.y + rand(-70, 70) } }); }
  renderTestPowers();
}
function renderTestPowers() {
  const P = G.me, ch = P.c;
  const bossOpts = BOSSES.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
  const enemyOpts = Object.keys(ENEMIES).map(id => `<option value="${id}">${esc(ENEMIES[id].name)}</option>`).join('');
  // Habilidad propia del guerrero (Shadow Clone de Naruto, Arise de Jinwoo, Godspeed de Killua, etc.):
  // es un rasgo fijo del personaje, no algo que se active o desactive, así que solo se muestra, sin botón.
  // ch.perk ya está en el idioma correcto (como ch.name): viene traducido por EN_DATA al cargar.
  const abilityHtml = ch.perk ? `<div class="tp-group"><h3>${t('Habilidad propia')}</h3><div class="tp-list">
    <div class="tp-row on" style="grid-column:1/-1"><span class="tp-name" style="white-space:normal">${esc(ch.perk)}</span></div>
  </div></div>` : '';
  const adminHtml = `<div class="tp-group tp-admin"><h3>Admin <small>${t('acciones de una vez')}</small></h3><div class="tp-list">
    <div class="tp-row"><button data-admin="heal" class="btn small">${t('HP al máximo')}</button><button data-admin="ki" class="btn small">${t('Ki al máximo')}</button></div>
    <div class="tp-row"><button data-admin="zeni" class="btn small">+1000 Zeni</button><button data-admin="unlockall" class="btn small">${t('Desbloquear guerreros')}</button></div>
    <div class="tp-row"><button data-admin="maxtier" class="btn small">${t('Forma máxima')}</button><button data-admin="untransform" class="btn small">${t('Deshacer transformación')}</button></div>
    <div class="tp-row"><button data-admin="clear" class="btn small">${t('Limpiar enemigos')}</button></div>
    <div class="tp-row"><select id="adminBossPick">${bossOpts}</select><button data-admin="boss" id="adminBossGo" class="btn small">${t('Invocar jefe')}</button></div>
    <div class="tp-row"><select id="adminEnemyPick">${enemyOpts}</select><button data-admin="enemy" id="adminEnemyGo" class="btn small">${t('Invocar enemigo')}</button></div>
  </div></div>` + abilityHtml;
  const atkRow = id => {
    const def = ATTACKS[id], a = P.attacks.find(x => x.id === id);
    const full = P.attacks.length >= MAX_ATTACKS && !(def.evolved && P.attacks.some(x => x.id === def.from));
    const lvl = a ? (def.evolved ? 'evo' : t('Nv {n}', { n: a.lvl })) : '';
    const canUp = a ? !def.evolved && a.lvl < MAX_ATTACK_LEVEL : !full;
    return `<div class="tp-row${a ? ' on' : ''}"><span class="tp-dot" style="background:${def.color}"></span>
      <span class="tp-name" title="${esc(def.name + (def.desc ? ': ' + def.desc : ''))}">${esc(def.name)}</span><span class="tp-lvl">${lvl}</span>
      <button data-tp="atk" data-id="${id}" data-d="-1"${a ? '' : ' disabled'}>−</button><button data-tp="atk" data-id="${id}" data-d="1"${canUp ? '' : ' disabled'}>+</button></div>`;
  };
  const usedP = Object.keys(PASSIVES).filter(k => P.passives[k] > 0).length;
  const pasRow = id => {
    const lv = P.passives[id] || 0, canUp = lv < passiveMax(id) && (lv > 0 || usedP < MAX_PASSIVES);
    return `<div class="tp-row${lv ? ' on' : ''}"><span class="tp-dot" style="background:${PASSIVES[id].color}"></span>
      <span class="tp-name" title="${esc(PASSIVES[id].desc)}">${esc(PASSIVES[id].name)}</span><span class="tp-lvl">${lv ? t('Nv {n}', { n: lv }) : ''}</span>
      <button data-tp="pas" data-id="${id}" data-d="-1"${lv ? '' : ' disabled'}>−</button><button data-tp="pas" data-id="${id}" data-d="1"${canUp ? '' : ' disabled'}>+</button></div>`;
  };
  const ids = Object.keys(ATTACKS), base = ids.filter(id => !ATTACKS[id].evolved);
  const group = (title, list, row, note = '') => list.length ? `<div class="tp-group"><h3>${title}${note ? ` <small>${note}</small>` : ''}</h3><div class="tp-list">${list.map(row).join('')}</div></div>` : '';
  $('tpContent').innerHTML = adminHtml
    + group(t('Técnicas de {name}', { name: ch.name }), base.filter(id => ATTACKS[id].users && ATTACKS[id].users.includes(P.charId)), atkRow, t('{n} / {max} casillas', { n: P.attacks.length, max: MAX_ATTACKS }))
    + group(t('Técnicas comunes'), base.filter(id => !ATTACKS[id].users), atkRow)
    + group(t('Evoluciones'), ids.filter(id => ATTACKS[id].evolved), atkRow, t('reemplazan a su técnica si la tienes'))
    + group(t('Mejoras'), Object.keys(PASSIVES), pasRow, t('{n} / {max} casillas', { n: usedP, max: MAX_PASSIVES }))
    + group(t('Técnicas de otros guerreros'), base.filter(id => ATTACKS[id].users && !ATTACKS[id].users.includes(P.charId)), atkRow);
  for (const b of $('tpContent').querySelectorAll('button[data-tp]')) b.onclick = () => testPowerChange(b.dataset.tp, b.dataset.id, +b.dataset.d);
  for (const b of $('tpContent').querySelectorAll('button[data-admin]')) b.onclick = () => {
    const kind = b.dataset.admin;
    const id = kind === 'boss' ? $('adminBossPick').value : kind === 'enemy' ? $('adminEnemyPick').value : undefined;
    adminAction(kind, id);
  };
}

// ─── Versión, autoría y créditos ─────────────────────────────────────────────
for (const el of document.querySelectorAll('.version')) el.textContent = t('Versión {v}', { v: GAME_VERSION });
function showTestBadge() {   // cartel del modo prueba (en el celular no hay teclas F)
  $('testBadge').classList.remove('hidden');
  // +1000 Zeni para probar la tienda y los desbloqueos (no se guarda: el modo prueba no escribe la partida)
  $('btnTestZeni').onclick = () => {
    SAVE.zeni += 1000;
    $('zeniTotal').textContent = SAVE.zeni;
    if (!$('shop').classList.contains('hidden')) renderShop();
    buildMenu();
    SFX.unlock(); SFX.play('pickup');
  };
  // Interruptores (en la partida): inmortal, tiempo x5, sin enemigos
  for (const b of document.querySelectorAll('[data-test]')) b.onclick = () => { testToggle(b.dataset.test); b.blur(); };
  $('btnTestPowers').onclick = e => { toggleTestPowers(); e.currentTarget.blur(); };   // panel de Poderes (F6)
  $('tpClose').onclick = () => toggleTestPowers(false);
  const keysInfo = document.querySelector('.test-keys');
  if (isTouch() && keysInfo) keysInfo.remove();
}
// Pide la contraseña del modo prueba y, si es correcta, lo activa. Se llama al entrar con ?test
// en el enlace, o en secreto tocando/haciendo clic varias veces seguidas sobre el número de versión.
function openTestLogin() {
  if (TEST_MODE) return;
  const box = $('testLogin');
  box.classList.remove('hidden');
  $('testPass').value = ''; $('testError').textContent = '';
  $('testPass').focus();
  const tryPass = async () => {
    let ok = false;
    try { ok = (await sha256($('testPass').value)) === TEST_PASS_HASH; } catch (e) { ok = false; }   // sin crypto (http): no se puede activar
    if (!ok) { $('testError').textContent = t('Contraseña incorrecta.'); $('testPass').select(); return; }
    TEST_MODE = true;
    try { sessionStorage.setItem(TEST_SESSION_KEY, TEST_PASS_HASH); } catch (e) { /* sin almacenamiento */ }
    box.classList.add('hidden');
    showTestBadge();
    buildMenu();
  };
  $('btnTestOk').onclick = tryPass;
  $('testPass').onkeydown = e => { if (e.key === 'Enter') tryPass(); };
  $('btnTestCancel').onclick = () => { box.classList.add('hidden'); history.replaceState(null, '', location.pathname); };
}
if (TEST_MODE) showTestBadge();
else if (TEST_REQUESTED) openTestLogin();   // ?test en el enlace: se sigue admitiendo, por si alguien ya lo usaba así
// Atajo secreto: tocar/hacer clic 7 veces seguidas (en menos de 2 s entre toques) sobre el número de
// versión, en el menú principal, pide la contraseña - no hace falta tocar el enlace con ?test.
(() => {
  let count = 0, last = 0;
  for (const el of document.querySelectorAll('.version')) {
    el.style.cursor = 'default';   // no delata que ahí hay algo (sin subrayado de enlace ni nada)
    el.addEventListener('click', () => {
      const now = performance.now();
      count = now - last < 2000 ? count + 1 : 1;
      last = now;
      if (count >= 7) { count = 0; openTestLogin(); }
    });
  }
})();
// Bandera argentina en SVG (Windows no dibuja los emojis de banderas: mostraría "AR")
const FLAG_AR = `<svg class="flag" viewBox="0 0 30 20" role="img" aria-label="Argentina">
  <rect width="30" height="20" fill="#74acdf"/><rect y="6.67" width="30" height="6.67" fill="#fff"/>
  <circle cx="15" cy="10" r="2.3" fill="#f6b40e" stroke="#85340a" stroke-width="0.4"/></svg>`;
for (const a of document.querySelectorAll('.author-link')) {
  a.href = AUTHOR.url;
  a.textContent = AUTHOR.name;
  if (!a.closest('#credits')) a.insertAdjacentHTML('afterend', ' ' + FLAG_AR);   // la bandera, solo en el menú
}
// Secciones del menú: además del botón de abajo, uno arriba a la izquierda ("Volver (ESC)") y la tecla Escape
const MENU_SECTIONS = { setup: 'btnSetupBack', help: 'btnHelpBack', techs: 'btnTechsBack', achs: 'btnAchsBack', profile: 'btnProfileBack', rank: 'btnRankBack',
  news: 'btnNewsBack', credits: 'btnCreditsBack', shop: 'btnShopBack' };
for (const [id, back] of Object.entries(MENU_SECTIONS)) {
  const b = document.createElement('button');
  b.className = 'btn ghost small back-top';
  b.textContent = t('← Volver (ESC)');
  b.onclick = () => $(back).click();
  $(id).querySelector('.box').prepend(b);
}
function closeMenuSection() {
  const open = Object.keys(MENU_SECTIONS).find(id => !$(id).classList.contains('hidden'));
  if (open) $(MENU_SECTIONS[open]).click();
}
$('btnCredits').onclick = () => { $('menu').classList.add('hidden'); $('credits').classList.remove('hidden'); };
$('btnCreditsBack').onclick = () => { $('credits').classList.add('hidden'); $('menu').classList.remove('hidden'); };
$('btnShopBack').onclick = () => { $('shop').classList.add('hidden'); buildMenu(); $('menu').classList.remove('hidden'); };
$('waveShopGo').onclick = () => requestReadyWaveShop();

$('nameInput').addEventListener('input', e => { SAVE.name = e.target.value.slice(0, 12); writeSave(); });
// "Jugar" abre la ventana de la partida: nivel, guerrero, apuntado y velocidad (en online se eligen en la sala)
let localCoopSetup = false;
// En co-op, el Jugador 2 elige su guerrero en la misma rejilla que el Jugador 1 (pestaña "Jugador 2"),
// no en un <select> aparte - así los dos tienen el mismo selector visual completo.
function ensureCoopChar2() {
  const fixed = weeklyChar();
  const available = Object.keys(CHARACTERS).filter(id => fixed ? id === fixed : (isUnlocked(id) || weeklyOpen()));
  const fallback = available.find(id => id !== myChar()) || available[0] || myChar();
  if (!available.includes(SAVE.coopChar2)) { SAVE.coopChar2 = fallback; writeSave(); }
}
function setSetupTab(slot) {
  setupCoopSlot = slot;
  $('tabP1').classList.toggle('active', slot === 0);
  $('tabP2').classList.toggle('active', slot === 1);
  buildMenu();
}
$('tabP1').onclick = () => setSetupTab(0);
$('tabP2').onclick = () => setSetupTab(1);
function openSetup(coop = false) {
  SFX.unlock();
  localCoopSetup = !!coop;
  setupCoopSlot = 0;
  $('coopTabs').classList.toggle('hidden', !localCoopSetup);
  $('coopKeysHint').classList.toggle('hidden', !localCoopSetup);
  $('tabP1').classList.add('active'); $('tabP2').classList.remove('active');
  $('btnSetupGo').textContent = t(localCoopSetup ? 'Jugar co-op' : 'Jugar');
  if (localCoopSetup) ensureCoopChar2();
  buildMenu();
  $('menu').classList.add('hidden'); $('setup').classList.remove('hidden'); $('setup').scrollTop = 0;
}
$('btnSolo').onclick = () => openSetup(false);
$('btnCoop').onclick = () => openSetup(true);
$('btnSetupGo').onclick = () => { $('setup').classList.add('hidden'); SFX.unlock(); if (localCoopSetup) startLocalCoop(); else startSolo(); };
$('btnSetupBack').onclick = () => { $('setup').classList.add('hidden'); $('menu').classList.remove('hidden'); };
// Accesos rápidos desde la pantalla de preparación (misma pantalla que abren desde el menú principal)
$('btnSetupTechs').onclick = () => { $('setup').classList.add('hidden'); $('btnTechs').click(); };
$('btnSetupShop').onclick = () => { $('setup').classList.add('hidden'); $('btnShop').click(); };
$('btnSetupAchs').onclick = () => { $('setup').classList.add('hidden'); $('btnAchs').click(); };
$('btnSetupRank').onclick = () => { $('setup').classList.add('hidden'); $('btnRank').click(); };
// Apuntado manual de las técnicas (en PC el cursor pasa a ser una mira): es de cada jugador
function setAim(on) {
  SAVE.aim = !!on; writeSave();
  document.body.classList.toggle('aim-on', SAVE.aim);
  $('aimManual').classList.toggle('active', SAVE.aim); $('aimAuto').classList.toggle('active', !SAVE.aim);
  $('lobbyAim').checked = SAVE.aim;
}
setAim(SAVE.aim);
$('aimAuto').onclick = () => setAim(false);
$('aimManual').onclick = () => setAim(true);
$('lobbyAim').onchange = e => setAim(e.target.checked);
// Velocidad rápida (x1.5): se elige antes de jugar (en online la decide el anfitrión en la sala)
$('optSpeed').checked = !!SAVE.speed2;
$('optSpeed').onchange = e => { SAVE.speed2 = e.target.checked; writeSave(); $('lobbySpeed').checked = SAVE.speed2; };
$('lobbyLevel').onchange = e => { SAVE.level = e.target.value; writeSave(); buildLevels(); Net.levelChanged(); };
$('lobbySpeed').onchange = e => { SAVE.speed2 = e.target.checked; writeSave(); $('optSpeed').checked = SAVE.speed2; Net.speedChanged(); };
$('btnResume').onclick = () => togglePause();
// Reiniciar: el primer clic pide confirmación; la partida actual se descarta (no da Zeni ni cuenta para nada)
function resetRestartBtn() {
  const b = $('btnRestart');
  b.classList.toggle('hidden', !!(G && G.net));
  b.classList.remove('confirm');
  b.textContent = t('Reiniciar');
}
$('btnRestart').onclick = () => {
  if (!G || G.net) return;
  const b = $('btnRestart');
  if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = t('¿Seguro? Se pierde esta partida'); return; }
  SFX.unlock(); if (G.localCoop) startLocalCoop(); else startSolo();
};
$('btnQuit').onclick = () => {
  if (!G) return;
  if (G.net) { Net.leave(); return; }
  G.mode = 'play'; $('pause').classList.add('hidden'); G.quit = true; endRun(false);   // abandonada (no cuenta para Mr. Satán)
};
$('btnRetry').onclick = () => { if (G && G.net) Net.backToLobby(); else if (G && G.localCoop) startLocalCoop(); else startSolo(); };
$('btnMenu').onclick = () => { if (G && G.net) Net.leave(); else toMenu(); };
$('btnTransform').onclick = () => requestTransform();
$('btnPause').onclick = () => togglePause();
$('btnMusic').onclick = e => { toggleMusic(); e.currentTarget.blur(); };
$('btnMusic').classList.toggle('off', !Music.enabled);
$('btnSfx').onclick = e => { toggleSfx(); e.currentTarget.blur(); };
$('btnSfx').classList.toggle('off', !SFX.enabled);

// ─── Bucle ───────────────────────────────────────────────────────────────────
let last = performance.now(), lastRaf = performance.now();
// Tema musical según la situación: menú, batalla o jefe
const LEVEL_MUSIC = { namek: 'namek', cell: 'cell', buu: 'buu', kaio: 'kaio', snake: 'snake' };   // cada escenario, su tema (2.22.0)
function musicFor() {
  if (!G || G.mode === 'over') return 'menu';
  if (G.enemies.some(e => e.boss)) return 'boss';
  return LEVEL_MUSIC[G.lv && G.lv.id] || 'battle';
}
// Los botones fijos de sonido se corren a la izquierda de la barra de desplazamiento de la
// pantalla que esté abierta (menú, tienda, técnicas...), que si no queda tapada
let scrollGap = -1;
function updateScrollGap() {
  const open = [...document.querySelectorAll('.screen')].filter(el => !el.classList.contains('hidden')).pop();
  const gap = open ? Math.max(0, open.offsetWidth - open.clientWidth) : 0;
  if (gap !== scrollGap) { scrollGap = gap; document.documentElement.style.setProperty('--sb', gap + 'px'); }
}
new MutationObserver(updateScrollGap).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
addEventListener('resize', updateScrollGap);
function toggleMusic() {
  SFX.unlock();
  const on = Music.toggle();
  $('btnMusic').classList.toggle('off', !on);
  $('btnMusic').title = t(on ? 'Silenciar música (N)' : 'Activar música (N)');
}
function toggleSfx() {
  SFX.unlock();
  const on = SFX.toggle();
  $('btnSfx').classList.toggle('off', !on);
  $('btnSfx').title = t(on ? 'Silenciar efectos de sonido (B)' : 'Activar efectos de sonido (B)');
}
function step(now, draw) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pollGamepad();
  Music.want(musicFor());
  if (G) {
    if (G.net && G.net.role === 'client') Net.clientUpdate(dt * G.speed);
    else {
      // Velocidad rápida: el tiempo se reparte en pasos de como mucho 1 fotograma, para que los
      // proyectiles rápidos no atraviesen a los enemigos sin tocarlos (x1.5 = 2 pasos de 0,75)
      const speed = G.speed * (G.testFast ? 5 : 1), steps = Math.ceil(speed);   // modo prueba: tiempo x5
      // Al caer un jefe: un instante congelado y después medio segundo en cámara lenta
      const slow = G.hitStop > 0 ? 0 : G.slowmo > 0 ? 0.35 : 1;
      if (G.hitStop > 0) G.hitStop -= dt; else if (G.slowmo > 0) G.slowmo -= dt;
      if (slow) for (let i = 0; i < steps && G && G.mode === 'play'; i++) update(dt * speed * slow / steps);
    }
    tickSummon(dt);
    if (G && G.net && G.net.role === 'host') Net.hostTick(dt);
    if (G) { syncChoiceUI(); syncWaveShopUI(); tickPause(dt); achTick(); if (G.flashT > 0) G.flashT -= dt; }
    if (G && draw) render();
  } else if (draw) {
    renderMenuBackground(now / 1000);
    if (spritesReady) {   // hasta que carguen los sprites de GBA, sin personajes (no se ven los dibujos viejos)
      renderMenuPortraits(now / 1000);
      renderMenuHero(now / 1000);
    }
  }
}
function frame(now) {
  requestAnimationFrame(frame); // primero: un error en un fotograma no debe detener el bucle
  lastRaf = performance.now();
  step(lastRaf, canvas.width > 0 && canvas.height > 0); // ventana sin tamaño: simular sin dibujar
}
// Si la pestaña queda en segundo plano el navegador pausa requestAnimationFrame.
// En una partida online eso congelaría a todos, así que un Web Worker (que no se
// pausa) mantiene la simulación y la red funcionando, sin dibujar.
function startBackgroundTicker() {
  const tick = () => {
    const now = performance.now();
    if (G && G.net && now - lastRaf > 250) step(now, false);
  };
  try {
    const src = 'setInterval(() => postMessage(0), 33);';
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = tick;
  } catch (e) {
    setInterval(tick, 33); // sin workers: el navegador lo ralentiza en segundo plano, pero algo avanza
  }
}
addEventListener('DOMContentLoaded', () => {
  loadExternalSprites();
  CUSTOM_SPRITES.register();
  buildMenu();
  Net.init();
  startBackgroundTicker();
  requestAnimationFrame(frame);
});
