'use strict';
// ─── Cuadro de combinaciones (2.23.0), al estilo de Vampire Survivors ─────────
// Tres filas de casillas: arriba las evoluciones, en el medio tus técnicas y abajo tus mejoras. Una línea une cada
// mejora con la técnica que hace evolucionar, y una flecha sube de la técnica a su evolución:
//   dorado: la combinación está completa (técnica a nivel 5 + la mejora) o ya evolucionó
//   azul: tienes la mejora, falta subir la técnica · rojo punteado: falta la mejora (se muestra como un "fantasma" en
//   tu próxima casilla libre de mejoras; si no hay casilla libre, esa técnica ya no puede evolucionar)
// Se muestra al subir de nivel (a la izquierda de las cartas) y en la pausa. Las casillas tienen el cartel de siempre.
const COMBO = { S: 46, GAP: 14, EVO_Y: 22, TEC_Y: 104, PAS_Y: 186, H: 272 };
const comboX = i => i * (COMBO.S + COMBO.GAP);

function comboIcon(kind, id, dim) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  cv.className = 'cb-ico' + (dim ? ' dim' : '');
  const x = cv.getContext('2d');
  if (kind === 'atk') drawAttackIcon(id, 0, 0, 32, x); else drawPassiveIcon(id, 0, 0, 32, x);
  return cv;
}

function comboPanel(P) {
  const { S, EVO_Y, TEC_Y, PAS_Y, H } = COMBO, W = comboX(5) - COMBO.GAP;
  const owned = Object.keys(PASSIVES).filter(k => P.passives[k] > 0);   // en el mismo orden que el HUD
  const slots = owned.slice(), ghosts = new Set();
  // Qué evoluciona cada técnica y en qué estado está
  const rows = P.attacks.slice(0, MAX_ATTACKS).map((a, i) => {
    const def = ATTACKS[a.id];
    const evoId = def.evolved ? a.id : (EVOLUTION_OF[a.id] && canLearn(P.charId, EVOLUTION_OF[a.id]) ? EVOLUTION_OF[a.id] : null);
    if (!evoId) return { a, i, evoId: null };
    const need = ATTACKS[evoId].needs;
    let state;
    if (def.evolved) state = 'done';
    else if (P.passives[need] > 0) state = a.lvl >= MAX_ATTACK_LEVEL ? 'ready' : 'level';
    else if (slots.includes(need) || slots.length < MAX_PASSIVES) { state = 'miss'; if (!slots.includes(need)) { slots.push(need); ghosts.add(need); } }
    else state = 'blocked';   // no queda casilla de mejoras: esta técnica ya no puede evolucionar
    return { a, i, evoId, need, state, pj: slots.indexOf(need) };
  });

  const root = document.createElement('div');
  root.className = 'combo-panel';
  root.innerHTML = `<div class="cb-title">${t('COMBINACIONES')}</div>`;
  const box = document.createElement('div');
  box.className = 'cb-box';
  box.style.width = W + 'px'; box.style.height = H + 'px';
  root.appendChild(box);

  // Líneas (debajo de las casillas)
  const col = { done: '#ffd93b', ready: '#ffd93b', level: '#5cc8ff', miss: '#ff6b6b', blocked: '#ff6b6b' };
  let svg = `<svg width="${W}" height="${H}" aria-hidden="true"><defs><marker id="cbArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
    <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="2"/></marker></defs>`;
  for (const r of rows) {
    if (!r.evoId) continue;
    const c = col[r.state], dash = r.state === 'miss' || r.state === 'blocked' ? ' stroke-dasharray="4 4"' : '', w = r.state === 'ready' || r.state === 'done' ? 2.5 : 2;
    const tx = comboX(r.i) + S / 2;
    // técnica → evolución
    svg += `<line x1="${tx}" y1="${TEC_Y}" x2="${tx}" y2="${EVO_Y + S + 4}" stroke="${r.state === 'ready' || r.state === 'done' ? '#ffd93b' : '#6b7bc8'}" stroke-width="${w}"${r.state === 'ready' || r.state === 'done' ? '' : ' stroke-dasharray="4 4"'} marker-end="url(#cbArrow)"/>`;
    // mejora → técnica (con un codo a una altura distinta por técnica, para que no se pisen)
    if (r.pj >= 0) {
      const px = comboX(r.pj) + S / 2, my = PAS_Y - 8 - r.i * 5;
      svg += `<path d="M${px} ${PAS_Y} L${px} ${my} L${tx} ${my} L${tx} ${TEC_Y + S}" fill="none" stroke="${c}" stroke-width="${w}"${dash}/>`;
    }
  }
  box.insertAdjacentHTML('beforeend', svg + '</svg>');

  const slot = (x, y, cls, tip) => {
    const el = document.createElement('div');
    el.className = 'cb-slot ' + cls;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    if (tip) el.dataset.tip = tip;
    box.appendChild(el);
    return el;
  };
  const tag = (el, text, cls) => el.insertAdjacentHTML('beforeend', `<span class="cb-tag ${cls}">${esc(text)}</span>`);

  for (let i = 0; i < MAX_ATTACKS; i++) {
    const r = rows[i];
    // Técnica
    if (!r) { slot(comboX(i), TEC_Y, 'empty', t('Casilla libre de técnica')); slot(comboX(i), EVO_Y, 'empty evo'); continue; }
    const te = slot(comboX(i), TEC_Y, ATTACKS[r.a.id].evolved ? 'gold' : '', attackTip(P, r.a.id));
    te.appendChild(comboIcon('atk', r.a.id));
    te.insertAdjacentHTML('beforeend', `<span class="cb-lv">${ATTACKS[r.a.id].evolved ? '★' : t('Nv {n}', { n: r.a.lvl })}</span>`);
    // Evolución
    if (!r.evoId) { slot(comboX(i), EVO_Y, 'empty evo', t('Esta técnica no tiene evolución')); continue; }
    const evo = ATTACKS[r.evoId], needName = PASSIVES[r.need].name;
    const status = {
      done: t('¡Ya evolucionó!'), ready: t('¡Lista! Elige la carta dorada para evolucionarla'),
      level: t('Tienes {need}: falta subir {name} a nivel {max}', { need: needName, name: ATTACKS[r.a.id].name, max: MAX_ATTACK_LEVEL }),
      miss: t('Falta la mejora {need}', { need: needName }),
      blocked: t('Falta {need} y no te quedan casillas de mejoras: ya no puede evolucionar', { need: needName }),
    }[r.state];
    const ev = slot(comboX(i), EVO_Y, 'evo ' + r.state, `${evo.name}\n${evo.desc}\n${t('Se logra con')}: ${ATTACKS[evo.from].name} (${t('nivel {n}', { n: MAX_ATTACK_LEVEL })}) + ${needName}\n${status}`);
    ev.appendChild(comboIcon('atk', r.evoId, r.state !== 'ready' && r.state !== 'done'));
    if (r.state === 'ready' || r.state === 'done') ev.insertAdjacentHTML('beforeend', '<span class="cb-star">★</span>');
    tag(ev, r.state === 'done' ? t('Evolucionada') : r.state === 'ready' ? t('¡Lista!') : r.state === 'level' ? t('Nv {a}/{b}', { a: r.a.lvl, b: MAX_ATTACK_LEVEL })
      : r.state === 'blocked' ? t('Sin casilla') : t('Falta {need}', { need: needName }), r.state);
  }
  // Mejoras (las que tienes y, punteadas, las que faltan)
  for (let j = 0; j < MAX_PASSIVES; j++) {
    const id = slots[j];
    if (!id) { slot(comboX(j), PAS_Y, 'empty', t('Casilla libre de mejora')); continue; }
    if (ghosts.has(id)) {
      const users = rows.filter(r => r.need === id && r.state === 'miss').map(r => ATTACKS[r.a.id].name).join(', ');
      const g = slot(comboX(j), PAS_Y, 'ghost', `${PASSIVES[id].name}\n${PASSIVES[id].desc}\n${t('No la tienes: la necesita tu {name}', { name: users })}`);
      g.appendChild(comboIcon('pas', id, true));
      continue;
    }
    // Mejora que no evoluciona nada de lo que tienes: debajo, las técnicas que podrías aprender y evolucionarían con ella
    const linked = rows.some(r => r.need === id), could = linked ? [] : Object.keys(ATTACKS).filter(k => {
      const e = EVOLUTION_OF[k];
      return !ATTACKS[k].evolved && e && ATTACKS[e].needs === id && canLearn(P.charId, k) && canLearn(P.charId, e) && !P.attacks.some(a => a.id === k)
        && !(ATTACKS[k].reward && !(SAVE.rewards || {})[ATTACKS[k].reward]);
    });
    const extra = linked ? '' : could.length ? `
★ ${t('Evoluciona con')}: ${could.map(k => ATTACKS[k].name).join(', ')} (${t('todavía no las tienes')})` : `
${t('No evoluciona ninguna técnica de este guerrero')}`;
    const pe = slot(comboX(j), PAS_Y, linked ? '' : 'nolink', passiveTip(P, id) + extra);
    pe.appendChild(comboIcon('pas', id));
    pe.insertAdjacentHTML('beforeend', `<span class="cb-lv">${t('Nv {n}', { n: P.passives[id] })}</span>`);
    if (could.length) {   // hasta 3 iconitos
      const mini = document.createElement('div');
      mini.className = 'cb-could';
      for (const k of could.slice(0, 3)) { const c = comboIcon('atk', k); c.className = 'cb-mini'; mini.appendChild(c); }
      pe.appendChild(mini);
    }
  }
  return root;
}
// Lo dibuja en un contenedor (vacío si no hay partida)
function renderCombos(el) {
  if (!el) return;
  el.innerHTML = '';
  if (G && G.me) el.appendChild(comboPanel(G.me));
}
