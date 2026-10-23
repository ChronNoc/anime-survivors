'use strict';
// ─── Perfil del jugador (2.22.0) ─────────────────────────────────────────────
// Todo sale de la partida guardada en este navegador (SAVE): partidas, victorias, tiempo, logros, el guerrero
// más usado, la técnica con más daño en total, el jefe que más veces te derrotó y los mejores tiempos por nivel.
// Las partidas por guerrero, la némesis y la técnica favorita se anotan desde la 2.22.0 (ver achEndRun).

function fmtHours(s) {
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}
const topOf = obj => Object.entries(obj || {}).sort((a, b) => b[1] - a[1]);

function buildProfile() {
  const S = SAVE.stats;
  const achDone = ACHIEVEMENTS.filter(a => SAVE.ach[a.id]).length;
  const bosses = Object.values(S.bosses || {}).reduce((a, b) => a + b, 0);
  const runs = topOf(S.charRuns).filter(([id]) => CHARACTERS[id]);
  const fav = runs[0] ? runs[0][0] : (CHARACTERS[SAVE.char] ? SAVE.char : 'goku');
  const tech = topOf(S.techDmg).find(([id]) => ATTACKS[id]);
  const nem = topOf(S.killedBy)[0];
  const winPct = SAVE.runs ? Math.round(SAVE.wins / SAVE.runs * 100) : 0;

  const cell = (v, label) => `<div class="ps-cell"><b>${esc(String(v))}</b><span>${esc(t(label))}</span></div>`;
  const nemName = nem ? (nem[0] === 'horde' ? t('Las oleadas') : (bossDef(nem[0]) || { name: nem[0] }).name) : '';
  const nemTimes = nem ? (nem[1] === 1 ? t('te derrotó 1 vez') : t('te derrotó {n} veces', { n: nem[1] })) : '';

  // Guerreros más usados (hasta 5), con barras por partidas
  const maxRuns = runs.length ? runs[0][1] : 1;
  const bars = runs.slice(0, 5).map(([id, n]) => `<div class="pf-bar"><span>${esc(CHARACTERS[id].name)}</span>
    <div><i style="width:${(n / maxRuns * 100).toFixed(1)}%"></i></div><span>${tn(n, '{n} partida', '{n} partidas')} · ${fmtHours(S.charTime[id] || 0)}</span></div>`).join('');

  // Mejor tiempo por nivel (con cualquier guerrero)
  const bestLv = LEVELS.map(L => {
    let best = 0, who = '';
    for (const id in CHARACTERS) { const v = bestOf(L.id, id); if (v > best) { best = v; who = id; } }
    return best ? `<div class="pf-bar"><span>${t('Nivel {n}', { n: L.num })}</span><div><i style="width:${Math.min(100, best / 600 * 100).toFixed(1)}%"></i></div>
      <span>${fmtTime(best)} · ${esc(CHARACTERS[who].name)}</span></div>` : '';
  }).join('');

  const empty = !SAVE.runs;
  $('profileContent').innerHTML = `
    <div class="pf-head"><canvas id="pfPortrait" width="72" height="66"></canvas>
      <div><div class="pf-name">${esc(SAVE.name || t('Guerrero sin nombre'))}</div>
      <div class="pf-sub">${empty ? t('Juega tu primera partida para empezar tu perfil.') : `${t('Guerrero favorito')}: <b>${esc(CHARACTERS[fav].name)}</b>`}</div></div></div>
    <div class="ps-grid">
      ${cell(fmtInt(SAVE.runs), 'Partidas')}${cell(`${fmtInt(SAVE.wins)} (${winPct}%)`, 'Victorias')}${cell(fmtHours(S.time || 0), 'Tiempo jugado')}
      ${cell(fmtInt(S.kills || 0), 'Enemigos derrotados')}${cell(fmtInt(bosses), 'Jefes derrotados')}${cell(fmtInt(S.evoCount || 0), 'Evoluciones')}
      ${cell(fmtInt(S.zeniEarned || 0), 'Zeni ganado')}${cell(`${achDone} / ${ACHIEVEMENTS.length} (${Math.round(achDone / ACHIEVEMENTS.length * 100)}%)`, 'Logros')}
    </div>
    <div class="pf-cards">
      <div class="pf-card"><canvas id="pfFav" width="44" height="40"></canvas><div><span class="pf-k">${t('Guerrero favorito')}</span>
        <b>${esc(CHARACTERS[fav].name)}</b><small>${runs[0] ? tn(runs[0][1], '{n} partida', '{n} partidas') : t('Sin partidas todavía')}</small></div></div>
      <div class="pf-card"><canvas id="pfTech" width="44" height="40"></canvas><div><span class="pf-k">${t('Técnica favorita')}</span>
        <b>${tech ? esc(ATTACKS[tech[0]].name) : '—'}</b><small>${tech ? t('{n} de daño en total', { n: fmtInt(tech[1]) }) : t('Sin partidas todavía')}</small></div></div>
      <div class="pf-card"><canvas id="pfNem" width="44" height="40"></canvas><div><span class="pf-k">${t('Tu némesis')}</span>
        <b>${nem ? esc(nemName) : '—'}</b><small>${nem ? esc(nemTimes) : t('Todavía nadie te derrotó')}</small></div></div>
    </div>
    ${bars ? `<h3>${t('Guerreros más usados')}</h3><div class="pf-bars">${bars}</div>` : ''}
    ${bestLv ? `<h3>${t('Mejor tiempo por nivel')}</h3><div class="pf-bars">${bestLv}</div>` : ''}
    <p class="pf-note">${t('Las partidas por guerrero, la némesis y la técnica favorita se cuentan desde la versión 2.22.0. Todo se guarda en este navegador.')}</p>
    <h3 id="replaysTitle">${t('🎬 Repeticiones')}</h3><div id="replaysContent"></div>`;
  if (typeof buildReplays === 'function') buildReplays();

  // Retratos e íconos
  const ctxOf = id => { const c = $(id).getContext('2d'); c.imageSmoothingEnabled = false; return c; };
  drawPortraitTo(ctxOf('pfPortrait'), CHARACTERS[fav].look, false, 4, 0, 64);
  drawPortraitTo(ctxOf('pfFav'), CHARACTERS[fav].look, false, 2, 0, 40);
  if (tech) drawAttackIcon(tech[0], 4, 2, 36, ctxOf('pfTech'));
  if (nem && nem[0] !== 'horde' && bossDef(nem[0])) drawPortraitTo(ctxOf('pfNem'), bossDef(nem[0]).look, false, 2, 0, 40);
  else if (nem) drawPortraitTo(ctxOf('pfNem'), ENEMIES.saibaman.look, false, 2, 0, 40);   // la horda: un Saibaman
}

$('btnProfile').onclick = () => { buildProfile(); $('menu').classList.add('hidden'); $('profile').classList.remove('hidden'); $('profile').scrollTop = 0; };
$('btnProfileBack').onclick = () => { $('profile').classList.add('hidden'); $('menu').classList.remove('hidden'); };
