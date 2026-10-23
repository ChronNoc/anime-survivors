'use strict';
// ─── Desafío semanal (2.12.0) ────────────────────────────────────────────────────
// El servidor dice cuál es el desafío de esta semana (api/ranking.js?weekly=1): un nivel, a veces un guerrero
// fijo y unas reglas (WEEKLY_RULES en data.js). Se juega desde la ventana de Jugar o en una sala online
// ("weekly" como nivel), tiene su propio ranking y cambia cada lunes a las 00:00 de Argentina.
async function loadWeekly() {
  try {
    const r = await fetch('/api/ranking?weekly=1&limit=1', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    WEEKLY = { week: d.week, endsAt: d.endsAt, level: d.challenge.level, char: d.challenge.char || null, rules: d.challenge.rules || [] };
  } catch (e) { WEEKLY = null; }   // sin conexión o sin ranking: no hay tarjeta del desafío
  return WEEKLY;
}
// "3 d 4 h" / "5 h 20 min" / "12 min"
function fmtLeft(ms) {
  const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mm = m % 60;
  return d ? t('{d} d {h} h', { d, h }) : h ? t('{h} h {m} min', { h, m: mm }) : t('{m} min', { m: mm });
}
const weeklyRules = W => W.rules.filter(r => WEEKLY_RULES[r]);
// Resumen de una línea: "Nivel 3 · solo Krilin"
function weeklyWhere(W) {
  const L = LEVELS.find(l => l.id === W.level) || LEVELS[0];
  return t('Nivel {n}', { n: L.num }) + (W.char && CHARACTERS[W.char] ? ' · ' + t('solo {name}', { name: CHARACTERS[W.char].name }) : '');
}
const weeklyRulesHtml = W => weeklyRules(W).map(r => `<span class="wk-rule" data-tip="${esc(WEEKLY_RULES[r].name + '\n' + WEEKLY_RULES[r].desc)}">${WEEKLY_RULES[r].icon} ${esc(WEEKLY_RULES[r].name)}</span>`).join('');

// Tarjeta del desafío en la ventana de Jugar (arriba de los niveles, ocupa toda la fila)
function weeklyCard(selected) {
  const W = WEEKLY, card = document.createElement('button');
  card.className = 'level-card weekly' + (selected ? ' selected' : '');
  card.innerHTML = `${levelPic(W.level)}<span class="wk-info"><b>⭐ ${t('Desafío semanal')}</b><small>${esc(weeklyWhere(W))}</small>
    <span class="wk-rules">${weeklyRulesHtml(W)}</span>
    <span class="wk-tries">${weeklyTriesText()}</span>
    <span class="lv-state"><span class="wk-left">${t('Termina en {left}', { left: fmtLeft(W.endsAt - Date.now()) })}</span> · ${t('Zeni ×{n}', { n: String(WEEKLY_ZENI).replace('.', LANG === 'en' ? '.' : ',') })} · ${t('ranking propio')}</span></span>`;
  card.onclick = () => { SFX.unlock(); SAVE.level = 'weekly'; writeSave(); buildMenu(); Net.levelChanged(); };
  return card;
}
// Intentos de hoy (2.19.0) y que todos juegan parejos
function weeklyTriesText() {
  const left = weeklyTriesLeft();
  return (left ? t('🎯 Intentos con ranking hoy: {n} de {max}', { n: left, max: WEEKLY_TRIES }) : t('🎯 Ya usaste los {max} intentos de hoy: puedes seguir como práctica', { max: WEEKLY_TRIES }))
    + ' · ' + t('todos con las mejoras al máximo');
}
// Aviso en la ventana de Jugar cuando el desafío tiene un guerrero fijo
function weeklyCharNote() {
  const el = $('setupCharNote');
  if (!el) return;
  const W = myLevel() === 'weekly' ? WEEKLY : null;
  el.textContent = W && W.char && CHARACTERS[W.char] ? t('Este desafío se juega solo con {name}.', { name: CHARACTERS[W.char].name }) : '';
  el.classList.toggle('hidden', !el.textContent);
}

// Al abrir el juego y cada 10 minutos (por si cambió la semana con el juego abierto)
async function refreshWeekly() {
  const before = WEEKLY && WEEKLY.week;
  await loadWeekly();
  if (!G && (WEEKLY && WEEKLY.week) !== before) buildMenu();
}
refreshWeekly();
setInterval(refreshWeekly, 10 * 60 * 1000);
// La cuenta regresiva de la tarjeta se actualiza sola
setInterval(() => {
  if (!WEEKLY) return;
  for (const el of document.querySelectorAll('.wk-left')) el.textContent = t('Termina en {left}', { left: fmtLeft(WEEKLY.endsAt - Date.now()) });
  if (Date.now() >= WEEKLY.endsAt) refreshWeekly();
}, 30000);
