// ─── Ranking global (api/ranking.js + Upstash Redis) ─────────────────────────
// Por nivel (todos los guerreros o uno solo): primero las victorias (menor tiempo), después las
// derrotas (más tiempo aguantado). La pestaña del desafío semanal todavía no tiene contenido.
const RANK_API = '/api/ranking';
const RANK_TOP = 10, RANK_MORE = 100;
let rankLevel = null, rankChar = null, rankView = 'levels', rankReq = 0, rankPending = null;

async function rankGet(level, limit, char) {
  const r = await fetch(`${RANK_API}?level=${encodeURIComponent(level)}&limit=${limit}${char ? '&char=' + encodeURIComponent(char) : ''}`);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function rankPost(entry) {
  const r = await fetch(RANK_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data.error || r.status), { status: r.status, code: data.code });
  return data;
}

// Las marcas anteriores a la 2.9.0 no tienen centésimas: se muestran como .00
const rankTime = e => fmtTimeCs(Number.isFinite(e.cs) ? e.cs : e.secs * 100);
const rankResult = e => e.won ? `<span class="rk-won">${t('Victoria')} · ${rankTime(e)}</span>` : `<span class="rk-lost">${t('Aguantó {time}', { time: rankTime(e) })}</span>`;
// Las marcas anteriores a este dato no lo tienen: se muestran con un guion
// En pantallas medianas solo queda el ícono: el texto va también como ayuda al pasar el mouse
const rankAim = a => a === 'manual' ? `<span title="${t('Manual')}">🎯<span class="rk-aim-txt"> ${t('Manual')}</span></span>` : a === 'auto' ? `<span title="${t('Automático')}">⚙️<span class="rk-aim-txt"> ${t('Automático')}</span></span>` : '–';
// Solo o en grupo (las marcas anteriores a la 2.5.0 no lo guardaban)
const rankMode = e => e.online ? `<span title="Online (${e.players || 2})">🌐<span class="rk-aim-txt"> Online (${e.players || 2})</span></span>` : e.online === false ? `<span title="${t('Solo')}">👤<span class="rk-aim-txt"> ${t('Solo')}</span></span>` : '–';
const rankDate = ms => new Date(ms).toLocaleString(LANG === 'en' ? 'en-US' : 'es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
const isMe = e => !!myRankName() && e.name.toLowerCase() === myRankName().toLowerCase();
const myRankName = () => (SAVE.name || '').trim();

async function buildRanking(level = rankLevel || myLevel(), limit = RANK_TOP, char = rankChar) {
  rankLevel = level; rankChar = char;
  const box = $('rankContent');
  const views = `<div class="rk-views"><button class="rk-view${rankView === 'levels' ? ' active' : ''}" data-view="levels">${t('🏆 Ranking por nivel')}</button>
    <button class="rk-view${rankView === 'weekly' ? ' active' : ''}" data-view="weekly">${t('📅 Desafío semanal')}</button></div>`;
  const beta = `<p class="rk-beta">${t('⚠️ El juego está en una etapa temprana: el ranking puede reiniciarse con futuras versiones.')}</p>`;
  const bindViews = () => { for (const b of box.querySelectorAll('.rk-view')) b.onclick = () => { rankView = b.dataset.view; buildRanking(); }; };
  if (rankView === 'weekly') return buildWeeklyRanking(box, beta + views, bindViews, limit);
  // Dos grupos con su subtítulo: los niveles de siempre y los niveles bonus
  const tabs = `<div class="rk-group"><span class="rk-group-t">${t('Niveles')}</span><div class="rk-tabs">`
    + LEVELS.map(L => `<button class="rk-tab${L.id === level ? ' active' : ''}" data-level="${L.id}">${t('Nivel {n}', { n: L.num })}</button>`).join('')
    + `</div></div><div class="rk-group bonus"><span class="rk-group-t">${t('Niveles bonus')}</span><div class="rk-tabs">`
    + BONUS_RANKS.map(B => `<button class="rk-tab bonus${B.id === level ? ' active' : ''}" data-level="${B.id}">${t(B.label)}</button>`).join('') + '</div></div>';   // nivel bonus (js/bonus.js)
  const chars = [['', t('Todos')], ...Object.keys(CHARACTERS).map(id => [id, CHARACTERS[id].name])]
    .map(([id, name]) => `<button class="rk-char${(char || '') === id ? ' active' : ''}" data-char="${id}">${esc(name)}</button>`).join('');
  box.innerHTML = beta + views + `<div class="rk-groups">${tabs}</div><div class="rk-chars">${chars}</div><div id="rankTable" class="rk-table"><p class="rk-msg">${t('Cargando...')}</p></div>`;
  bindViews();
  for (const b of box.querySelectorAll('.rk-tab')) b.onclick = () => buildRanking(b.dataset.level);
  for (const b of box.querySelectorAll('.rk-char')) b.onclick = () => buildRanking(level, RANK_TOP, b.dataset.char || null);
  const req = ++rankReq;
  let data;
  try { data = await rankGet(level, limit, char); } catch (e) { data = null; }
  if (req !== rankReq) return;   // el jugador cambió de pestaña mientras cargaba
  const table = $('rankTable');
  if (!data) { table.innerHTML = `<p class="rk-msg">${t('No se pudo cargar el ranking. Prueba de nuevo en un rato.')}</p>`; return; }
  if (!data.entries.length) { table.innerHTML = `<p class="rk-msg">${char ? t('Todavía nadie entró en este ranking con {name}. ¡Sé el primero!', { name: esc(CHARACTERS[char].name) }) : t('Todavía nadie entró en este ranking. ¡Sé el primero!')}</p>`; return; }
  table.innerHTML = rankTableHtml(data.entries) +
    (limit < RANK_MORE && data.total > data.entries.length ? `<button id="rankMore" class="btn ghost small">${t('Ver más ({n} en total)', { n: Math.min(data.total, RANK_MORE) })}</button>` : '');
  if ($('rankMore')) $('rankMore').onclick = () => buildRanking(level, RANK_MORE, char);
}
// Tabla del ranking (la misma para los niveles y el desafío semanal)
function rankTableHtml(entries) {
  const medal = p => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : p;
  return `<table><tr><th>#</th><th>${t('Jugador')}</th><th>${t('Guerrero')}</th><th>${t('Resultado')}</th><th>${t('Derrotados')}</th><th>${t('Daño recibido')}</th><th>${t('Modo')}</th><th>${t('Apuntado')}</th><th class="rk-date">${t('Fecha y hora')}</th></tr>${entries.map(e =>
    // data-label: en el celular cada fila es una tarjeta y los números llevan su nombre al lado (ver style.css)
    `<tr class="${isMe(e) ? 'me' : ''}${e.won ? ' won' : ''}"><td class="rk-pos">${medal(e.pos)}</td><td class="rk-who"><b>${esc(e.name)}</b></td>
      <td class="rk-char-c">${esc(CHARACTERS[e.char] ? CHARACTERS[e.char].name : e.char)}</td><td class="rk-result">${rankResult(e)}</td><td class="rk-break"></td>
      <td class="rk-num" data-label="${t('Derrotados')}">${fmtNum(e.kills)}</td><td class="rk-num" data-label="${t('Daño recibido')}">${Number.isFinite(e.taken) ? fmtNum(e.taken) : '–'}</td><td class="rk-aim">${rankMode(e)}</td><td class="rk-aim">${rankAim(e.aim)}</td><td class="rk-date">${rankDate(e.date)}</td></tr>`).join('')}</table>`;
}
// Pestaña del desafío semanal: el de esta semana (o el de la anterior) con su ranking
let rankWeekPrev = false;
async function buildWeeklyRanking(box, top, bindViews, limit) {
  box.innerHTML = top + `<div id="rankTable" class="rk-table"><p class="rk-msg">${t('Cargando...')}</p></div>`;
  bindViews();
  const req = ++rankReq;
  let data;
  try {
    const r = await fetch(`${RANK_API}?weekly=1&limit=${limit}${rankWeekPrev ? '&prev=1' : ''}`);
    if (!r.ok) throw new Error(r.status);
    data = await r.json();
  } catch (e) { data = null; }
  if (req !== rankReq) return;
  if (!data) { $('rankTable').innerHTML = `<p class="rk-msg">${t('No se pudo cargar el ranking. Prueba de nuevo en un rato.')}</p>`; return; }
  const W = { ...data.challenge, endsAt: data.endsAt };
  const head = `<div class="wk-head"><div><b>⭐ ${t(rankWeekPrev ? 'Desafío de la semana pasada' : 'Desafío de esta semana')}</b> · ${esc(weeklyWhere(W))}</div>
    <div class="wk-rules">${weeklyRulesHtml(W)}</div>
    <div class="hint">${rankWeekPrev ? t('Terminó el lunes.') : `<span class="wk-left">${t('Termina en {left}', { left: fmtLeft(data.endsAt - Date.now()) })}</span> · ${t('se reinicia cada lunes')}`}</div>
    <button id="rankWeekToggle" class="btn ghost small">${t(rankWeekPrev ? 'Ver esta semana' : 'Ver la semana pasada')}</button></div>`;
  const body = data.entries.length ? rankTableHtml(data.entries) : `<p class="rk-msg">${t(rankWeekPrev ? 'Nadie jugó el desafío de esa semana.' : 'Todavía nadie jugó el desafío de esta semana. ¡Sé el primero!')}</p>`;
  $('rankTable').innerHTML = head + body +
    (limit < RANK_MORE && data.total > data.entries.length ? `<button id="rankMore" class="btn ghost small">${t('Ver más ({n} en total)', { n: Math.min(data.total, RANK_MORE) })}</button>` : '');
  $('rankWeekToggle').onclick = () => { rankWeekPrev = !rankWeekPrev; buildRanking(); };
  if ($('rankMore')) $('rankMore').onclick = () => buildRanking(rankLevel, RANK_MORE, rankChar);
}

// Al terminar la partida: se envía la marca y se muestra el puesto en el cartel final
function rankSubmit(entry) {
  const el = $('goRank');
  if (TEST_MODE) { el.innerHTML = `<span class="rk-note">${t('Modo prueba: la partida no entra al ranking.')}</span>`; return; }
  if (/^snake_.*_safe$/.test(entry.level)) { el.innerHTML = `<span class="rk-note">${t('Sin caídas al Infierno el Camino de la Serpiente no entra al ranking: actívalas para competir.')}</span>`; return; }
  if (entry.practice) { el.innerHTML = `<span class="rk-note">${t('Partida de práctica: ya usaste los {n} intentos de hoy del desafío. Vuelven a las 00:00 (Argentina).', { n: WEEKLY_TRIES })}</span>`; return; }
  // Se pregunta siempre antes de publicar; el nombre viene cargado y se puede cambiar
  rankPending = entry;
  const L = levelDef(entry.level);
  const bonus = typeof BONUS_RANKS !== 'undefined' && BONUS_RANKS.find(B => B.id === entry.level);   // nivel bonus: su ranking por modo
  const ask = entry.weekly ? t('¿Publicar este resultado en el ranking del desafío semanal?') : bonus ? t('¿Publicar tu tiempo en el ranking {name}?', { name: t(bonus.label) })
    : t('¿Publicar este resultado en el ranking del Nivel {n}?', { n: L.num });
  el.innerHTML = `<div class="rk-ask"><b>${ask}</b>
    <span class="rk-name"><input id="goRankName" maxlength="12" placeholder="${t('Tu nombre')}" autocomplete="off" value="${esc(myRankName())}">
    <button id="goRankSend" class="btn small">${t('Publicar')}</button><button id="goRankSkip" class="btn ghost small">${t('No, gracias')}</button></span></div>`;
  const send = () => {
    const input = $('goRankName'), n = input.value.trim();
    if (!n) { input.focus(); input.classList.add('rk-missing'); return; }
    SAVE.name = n.slice(0, 12); writeSave(); $('nameInput').value = SAVE.name;
    rankSend(rankPending);
  };
  $('goRankSend').onclick = send;
  $('goRankSkip').onclick = () => { rankPending = null; el.innerHTML = `<span class="rk-note">${t('No se publicó en el ranking.')}</span>`; };
  $('goRankName').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); };
}
async function rankSend(entry) {
  const el = $('goRank');
  el.innerHTML = `<span class="rk-note">${t('Enviando al ranking...')}</span>`;
  try {
    const r = await rankPost({ ...entry, name: myRankName(), ver: GAME_VERSION });
    const L = levelDef(entry.level), cn = esc(CHARACTERS[entry.char].name);
    if (r.weekly) {
      el.innerHTML = `<span class="${r.pos ? 'rk-res' : 'rk-note'}">${r.pos ? t('🏅 Desafío semanal: puesto <b>#{pos}</b> de {total}', { pos: r.pos, total: r.total }) : t('Esta vez no alcanzó para entrar al top {top} del desafío', { top: RANK_MORE })}</span>`;
      return;
    }
    const B = typeof BONUS_RANKS !== 'undefined' && BONUS_RANKS.find(x => x.id === entry.level), where = B ? t(B.label) : t('Nivel {n}', { n: L.num });
    const general = r.pos
      ? t('🏅 Ranking {where}: puesto <b>#{pos}</b> de {total}', { where, pos: r.pos, total: r.total })
      : t('Esta vez no alcanzó para entrar al top {top} de {where}', { top: RANK_MORE, where });
    const withChar = r.charPos ? '<br>' + t('Con {name}: puesto <b>#{pos}</b> de {total}', { name: cn, pos: r.charPos, total: r.charTotal }) : '';
    el.innerHTML = `<span class="${r.pos ? 'rk-res' : 'rk-note'}">${general}${withChar}</span>`;
  } catch (e) {
    // Nombre no permitido: se vuelve a pedir, con el aviso arriba
    if (e.code === 'name') {
      rankSubmit(entry);
      el.insertAdjacentHTML('afterbegin', `<span class="rk-note rk-bad">${t('Ese nombre no está permitido en el ranking. Prueba con otro.')}</span>`);
      return;
    }
    el.innerHTML = `<span class="rk-note">${t(e.code === 'week' ? 'El desafío de esa semana ya terminó: la partida no entra al ranking.' : e.status === 429 ? 'Demasiados envíos seguidos; espera un minuto.' : 'No se pudo enviar al ranking.')}</span>`;
  }
}

$('btnRank').onclick = () => { $('menu').classList.add('hidden'); $('rank').classList.remove('hidden'); $('rank').scrollTop = 0; rankWeekPrev = false; rankView = myLevel() === 'weekly' ? 'weekly' : 'levels'; buildRanking(levelDef(myLevel()).id, RANK_TOP, null); };
$('btnRankBack').onclick = () => { $('rank').classList.add('hidden'); $('menu').classList.remove('hidden'); };
