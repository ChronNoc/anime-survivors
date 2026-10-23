'use strict';
// ─── Pantalla "Cómo jugar" ───────────────────────────────────────────────────────
// Se arma con los datos del juego (personajes, técnicas, mejoras, jefes, tienda), así
// que se mantiene al día si se cambian los valores en data.js. Los textos pasan por t() (js/i18n.js).

// Mecánicas especiales de cada enemigo (los campos de ENEMIES), para la ayuda
const enemyTraits = e => [
  e.spread && t('; dispara en abanico'), e.burst && t('; dispara en ráfagas'), e.lunge && t('; embiste (avisa con una franja roja)'),
  e.stomp && t('; da pisotones (marca un círculo en el suelo)'), e.ring && t('; lanza anillos de disparos'),
  e.deathRing && t('; al morir suelta un anillo de disparos'), e.kamikaze && t('; explota al tocarte'),
].filter(Boolean).join('');
const TECH_TYPES = () => ({ projectile: t('Proyectil'), beam: t('Rayo'), orbit: t('Órbita'), nova: t('Onda'), rain: t('Lluvia'), decoy: t('Señuelo'), buff: t('Potenciador') });
const fmtInt = n => n.toLocaleString(LANG === 'en' ? 'en-US' : 'es-AR');
const pctDrop = p => (p * 100).toLocaleString(LANG === 'en' ? 'en-US' : 'es-AR', { maximumFractionDigits: 1 }) + '%';

function buildHelp() {
  const pct = v => `${Math.round(v * 100)}%`;
  const dot = color => `<span class="dot" style="background:${color}"></span>`;
  const section = (title, html, open = false) => `<details${open ? ' open' : ''}><summary>${t(title)}</summary>${html}</details>`;
  const typeName = TECH_TYPES();

  // Niveles: cada uno con sus jefes (minuto) y sus enemigos
  const levels = LEVELS.map(L => `<li><b>${t('Nivel {n}', { n: L.num })}</b>: ${L.infinite
    ? t('modo infinito en el planeta de Kaio-sama (se sale por el Camino de la Serpiente). Cada 45 segundos vuelve un jefe de las 4 sagas, en orden; después de la primera vuelta salen de a dos y desde la tercera de a tres, cada vez más fuertes. No hay jefe final: gana el ranking quien más aguanta.')
    : L.bosses.map(b => `${fmtTime(b.at)} ${esc(bossDef(b.id).name)}${b.final ? ' ' + t('(final)') : ''}`).join(' · ')}.
    ${t('Enemigos')}: ${[...new Set(L.spawns.map(s => ENEMIES[s.id].name))].map(esc).join(', ')}.</li>`).join('');
  const chars = Object.values(CHARACTERS).map(c => `<tr><td><b>${esc(c.name)}</b></td><td>${esc(ATTACKS[c.start].name)}</td>
    <td>${esc(c.transform)}</td><td>${esc(c.perk)}</td><td>${c.hp}</td><td>${c.unlock ? esc(c.unlock.kind === 'zeni' ? `${c.unlock.text} (${c.unlock.cost} Zeni)` : c.unlock.text) : t('Disponible')}</td></tr>`).join('');
  const evolutions = Object.values(ATTACKS).filter(a => a.evolved).map(a => `<tr><td>${dot(ATTACKS[a.from].color)}${esc(ATTACKS[a.from].name)}</td>
    <td>${esc(PASSIVES[a.needs].name)}</td><td>${dot(a.color)}<b>${esc(a.name)}</b></td><td>${esc(a.desc)}</td></tr>`).join('');
  const techs = Object.values(ATTACKS).filter(a => !a.evolved).map(a => {
    const s1 = a.stats(1), s5 = a.stats(MAX_ATTACK_LEVEL);
    const cd = s1.cd !== undefined ? `${s1.cd.toFixed(1)} s → ${s5.cd.toFixed(1)} s` : t('continua');
    return `<tr><td>${dot(a.color)}<b>${esc(a.name)}</b></td><td>${typeName[a.type]}</td><td>${s1.dmg} → ${s5.dmg}</td><td>${cd}</td><td>${esc(a.desc)}</td><td>${a.users ? a.users.map(u => esc(CHARACTERS[u].name)).join(', ') : t('Todos menos Mr. Satán')}</td></tr>`;
  }).join('');
  const passives = Object.values(PASSIVES).map(p => `<li>${dot(p.color)}<b>${esc(p.name)}</b>: ${esc(p.desc)} ${p.max ? '' : t('(hasta nivel {n})', { n: MAX_PASSIVE_LEVEL })}</li>`).join('');
  const shop = SHOP_UPGRADES.map(u => `<li><b>${esc(u.name)}</b>: ${t(u.max > 1 ? '{effect} por nivel, hasta {max} niveles (desde {cost} Zeni)' : '{effect} por nivel, hasta {max} nivel (desde {cost} Zeni)',
    { effect: esc(u.fmt(u.per)), max: u.max, cost: shopCost(u, 0) })}</li>`).join('');
  const wishes = WISH_POOL.map(w => `<li><b>${esc(w.name)}</b>: ${esc(w.desc)}</li>`).join('');
  const kiWish = WISHES.find(w => w.extra);
  const extraWishes = `<li><b>${esc(FUSION_WISH.name)}</b>: ${esc(FUSION_WISH.desc)} <i>${t('(solo en solitario, con Goku o Vegeta)')}</i></li><li><b>${esc(kiWish.name)}</b>: ${esc(kiWish.desc)} <i>${t('(si tu guerrero no puede fusionarse)')}</i></li>`
    + (() => { const w = WISHES.find(x => x.id === 'otherworld'); return `<li><b>${esc(w.name)}</b>: ${esc(w.desc)} <i>${t('(siempre aparece si ya usaste la Semilla de reserva)')}</i></li>`; })()
    + (() => { const w = WISHES.find(x => x.id === 'awaken'); return `<li><b>${esc(w.name)}</b>: ${esc(w.desc)} <i>${t('(a veces, si tienes una técnica que todavía no puede evolucionar)')}</i></li>`; })();
  const enemies = Object.values(ENEMIES).map(e =>
    `<li><b>${esc(e.name)}</b>: ${t('{n} de vida base', { n: e.hp })}${e.shooter ? t('; el {pct} dispara a distancia', { pct: pct(e.shootChance ?? SHOOTER_CHANCE) }) : ''}${enemyTraits(e)}</li>`).join('');

  $('helpContent').innerHTML = [
    section('Objetivo', t('<p>Elige un nivel, sobrevive a las oleadas durante {min} minutos y derrota al jefe final. Tus técnicas se lanzan solas contra el enemigo más cercano: tú te mueves, esquivas y recoges la experiencia.</p>', { min: RUN_LENGTH / 60 }) +
      t('<p>Ganar un nivel abre el siguiente. Cada nivel tiene su propio mapa y es más difícil que el anterior, pero da más Zeni.</p>') + `<ul>${levels}</ul>`, true),

    section('Controles', t(`<table><tr><th></th><th>Teclado y mouse</th><th>Mando</th><th>Celular</th></tr>
      <tr><td>Moverse</td><td><kbd>WASD</kbd> / flechas</td><td>Palanca izquierda o cruceta</td><td>Arrastrar el dedo</td></tr>
      <tr><td>Poder del Ki</td><td><kbd>Espacio</kbd>, <kbd>Shift</kbd>, <kbd>E</kbd></td><td>A / B / X / Y o gatillos</td><td>Botón ¡KI!</td></tr>
      <tr><td>Apuntar técnicas<br><small>(opción «Apuntar manualmente»)</small></td><td>Mouse</td><td>Palanca derecha</td><td>Hacia donde te mueves</td></tr>
      <tr><td>Mapa</td><td><kbd>M</kbd></td><td>—</td><td>Botón ▦</td></tr>
      <tr><td>Música</td><td><kbd>N</kbd></td><td>—</td><td>Botón ♪</td></tr>
      <tr><td>Efectos de sonido</td><td><kbd>B</kbd></td><td>—</td><td>Botón del parlante</td></tr>
      <tr><td>Pausa</td><td><kbd>P</kbd> / <kbd>Esc</kbd></td><td>Start</td><td>Botón II</td></tr>
      <tr><td>Elegir mejora o deseo</td><td><kbd>1</kbd> a <kbd>4</kbd> (arriba o en el teclado numérico) o clic · <kbd>R</kbd> volver a sortear</td><td>—</td><td>Tocar la tarjeta</td></tr></table>`)),

    section('La pantalla de juego', t(`<ul>
      <li><b>Panel del personaje</b>: retrato, nivel y vida. Debajo, las Esferas del Dragón que lleva el grupo.</li>
      <li><b>Barra azul superior</b>: experiencia hasta el siguiente nivel (en online es del grupo).</li>
      <li><b>Reloj y ☠</b>: tiempo de partida y enemigos derrotados.</li>
      <li><b>Técnicas y mejoras</b> (arriba a la izquierda, debajo de las Esferas): en la primera fila tus técnicas y en la segunda tus mejoras de la partida, cada una con su nivel (de 1 a {max}). Las técnicas evolucionadas tienen borde dorado y ★; la esquina de color de cada técnica es la mejora que pide para evolucionar, y las mejoras con ★ son las que te sirven para eso.</li>
      <li><b>Barra de Ki</b> (abajo): se llena derrotando enemigos. Al transformarte o fusionarte muestra los segundos que quedan.</li>
      <li>En la <b>pausa</b> ves tus estadísticas (daño por técnica, derrotados, daño recibido) y un mapa de la zona.</li></ul>`, { max: MAX_ATTACK_LEVEL })),

    section('Personajes', `<table><tr><th>${t('Personaje')}</th><th>${t('Técnica inicial')}</th><th>${t('Transformación')}</th><th>${t('Ventaja')}</th><th>${t('Vida')}</th><th>${t('Cómo se consigue')}</th></tr>${chars}</table>`),

    section('Técnicas', t('<p>Al subir de nivel eliges entre 3 opciones: una técnica nueva (máximo {attacks}; cada guerrero solo aprende las suyas y las comunes), subir una que ya tienes o una mejora de la partida (también máximo {passives} distintas). El daño es por golpe (en los rayos, por cada décima de segundo que el enemigo está dentro).</p>', { attacks: MAX_ATTACKS, passives: MAX_PASSIVES }) +
      `<table><tr><th>${t('Técnica')}</th><th>${t('Tipo')}</th><th>${t('Daño Nv1 → Nv{n}', { n: MAX_ATTACK_LEVEL })}</th><th>${t('Recarga')}</th><th></th><th>${t('Quién la aprende')}</th></tr>${techs}</table>` +
      t('<p>Cada golpe tiene un 8% de probabilidad de ser crítico (doble de daño, número amarillo).</p>')),

    section('Evoluciones', t(`<p>Cuando una técnica llega al <b>nivel {max}</b> y tienes la mejora de la partida que pide (al menos nivel 1), en la siguiente subida de nivel aparece una <b>carta dorada de evolución</b> que la transforma en su versión definitiva.</p>
      <ul><li>Las cartas de técnicas te dicen en qué evolucionan y qué mejora necesitan; las de mejoras avisan si sirven para evolucionar una técnica tuya.</li>
      <li>En la pausa ves el progreso de cada técnica (nivel, mejora ✓/✗ y en qué evoluciona).</li></ul>`, { max: MAX_ATTACK_LEVEL }) +
      `<table><tr><th>${t('Técnica')}</th><th>${t('+ Mejora')}</th><th>${t('Evolución')}</th><th></th></tr>${evolutions}</table>`),

    section('Mejoras de la partida', `<ul>${passives}</ul>` + t('<p>Solo duran la partida actual. Las permanentes se compran en la Tienda de Zeni.</p>')),

    section('Ki y transformaciones', t(`<ul>
      <li>La barra de Ki se llena derrotando enemigos: <b>+1</b> por enemigo común, <b>+15</b> por uno de élite y <b>+50</b> por un jefe. No se carga mientras estás transformado.</li>
      <li>Con la barra llena, pulsa Ki para transformarte durante <b>20 segundos</b>:
        <ul><li><b>×1,5 de daño</b> (Gohan: <b>×2</b>, por su ira oculta)</li><li><b>+20% de velocidad</b></li><li><b>−20% de recarga</b> de técnicas</li>
        <li>Al transformarte liberas un estallido que daña y empuja a los enemigos cercanos (a los jefes no les hace nada).</li></ul></li>
      <li><b>Ki concentrado:</b> si guardas el Ki lleno sin transformarte, se va concentrando (lo ves en la barra). A los <b>20 segundos</b>, la próxima transformación dura un <b>50% más</b> y pega un <b>25% más</b>. Conviene guardarla para el momento justo, como la llegada de un jefe.</li>
      <li>Goku, Vegeta y Gohan pasan a Super Saiyajin (Gohan a Super Saiyajin 2); Piccolo se fusiona con Kami y Krilin libera su potencial.</li>
      <li>El deseo <b>Ki infinito</b> te transforma durante 60 segundos.</li></ul>`)),

    section('Fusión (Gogeta)', t(`<ul>
      <li><b>En online:</b> un jugador con Goku y otro con Vegeta, los dos con el Ki lleno y juntos, pulsan Ki con menos de <b>{window} segundos</b> de diferencia. Si el compañero no responde a tiempo, el que lo pidió se transforma normal.</li>
      <li>Tras la Danza de la Fusión aparece <b>Gogeta</b> durante <b>{time} segundos</b>: suma la vida y usa las técnicas de los dos, hace <b>×{dmg} de daño</b>, recarga un {cd}% más rápido, va un {speed}% más rápido y recibe la mitad de daño. Mucho más poderoso que un Super Saiyajin.</li>
      <li><b>Se sortea quién lo mueve.</b> El otro va dentro y controla las técnicas: con el botón de Ki lanza el <b>Big Bang Kamehameha</b> hacia donde apunta el mouse (o al enemigo más cercano), cada {bb} segundos.</li>
      <li>Al terminar se separan, y cada uno conserva la proporción de vida que le quedaba a Gogeta.</li>
      <li><b>En solitario:</b> con Goku o Vegeta, pídele a Shenlong el deseo <b>Fusión</b>: llega tu rival Saiyajin y os fusionáis {wish} segundos; tú controlas todo.</li></ul>`,
      { window: FUSION_WINDOW, time: FUSION_TIME, dmg: FUSION_POWER.dmg, cd: Math.round((1 - FUSION_POWER.cd) * 100),
        speed: Math.round((FUSION_POWER.speed - 1) * 100), bb: BIGBANG_CD, wish: FUSION_TIME_WISH })),

    section('Esferas del Dragón y deseos', t('<p>Las sueltan los enemigos de élite (con aura dorada, uno cada 45 segundos) y los jefes. Con las 7, Shenlong concede un deseo a cada jugador:</p>') +
      t('<p>Cada vez ofrece {n} deseos al azar de esta lista:</p>', { n: WISH_OFFER }) + `<ul>${wishes}</ul>` +
      t('<p>Y un cuarto deseo fijo:</p>') + `<ul>${extraWishes}</ul>` +
      t('<p>Si una esfera queda fuera de la pantalla, una flecha naranja en el borde te indica hacia dónde está.</p>') +
      t(`<p>Las <b>Semillas del Ermitaño</b> ({senzu} de probabilidad por enemigo) curan la mitad de tu vida. Se reconocen por su brillo blanco y amarillo.</p>
      <p>La <b>Cápsula de Bulma</b> ({capsule} por enemigo; mucho más probable en los de élite) atrae hacia ti todas las gemas de experiencia del mapa.</p>`,
        { senzu: pctDrop(SENZU_DROP), capsule: pctDrop(CAPSULE_DROP) })),

    section('Enemigos', `<ul>${enemies}</ul>` +
      t('<p>Los enemigos tienen más vida y pegan más fuerte a medida que pasa el tiempo. Cada 75 segundos una horda de Saibaimans te rodea.</p>')),

    section('Partidas online', t(`<ul>
      <li>Uno crea la sala y comparte el código o el enlace; hasta 4 jugadores. El anfitrión elige si se juega a velocidad x{fast}.</li>
      <li>Cada uno tiene su vida, técnicas, Ki y transformación; la experiencia y las Esferas son del grupo. Al subir de nivel la partida espera a que todos elijan.</li>
      <li>Si alguien cae, un compañero lo reanima quedándose a su lado 2,5 segundos. La partida termina cuando caen todos.</li>
      <li>Por cada jugador extra los enemigos tienen un 60% más de vida y aparecen más seguido.</li>
      <li>Si alguien se desconecta, el resto sigue jugando.</li></ul>`, { fast: FAST_SPEED })),

    section('Desafío semanal', t('<p>Cada semana hay un desafío: uno de los niveles con reglas especiales (y a veces un guerrero fijo), con su propio ranking. Cambia todos los lunes a las 00:00 (hora de Argentina). Se elige en la ventana de <b>Jugar</b> o en la sala online, da un {n}% más de Zeni y ganarlo da un logro. No cuenta para los récords del nivel ni abre niveles nuevos.</p>', { n: Math.round((WEEKLY_ZENI - 1) * 100) }) +
      `<ul>${Object.values(WEEKLY_RULES).map(r => `<li>${r.icon} <b>${esc(r.name)}</b>: ${esc(r.desc)}</li>`).join('')}</ul>`),

    section('Logros', t('<p>Hay {n} logros (botón <b>Logros</b> del menú): ganar con distintos guerreros, derrotar enemigos, evolucionar técnicas, transformarte, sobrevivir sin recibir daño, invocar a Shenlong y más. Cada uno da Zeni una sola vez; los acumulables muestran su progreso. Se avisan con un cartel 🏆 durante la partida y aparecen en la pantalla final. En online cuentan para cada jugador por separado.</p>', { n: ACHIEVEMENTS.length })),

    section('Tienda de Zeni', t('<p>Ganas Zeni en cada partida (1 por cada 8 enemigos y por cada 6 segundos, +500 si ganas). Las mejoras son permanentes, sirven para todos los personajes y también en online. Puedes reiniciarlas cuando quieras y recuperar todo el Zeni.</p>') + `<ul>${shop}</ul>`),
  ].join('');
}

// ─── Pantalla "Técnicas": qué técnicas tiene y puede aprender cada guerrero ─────────
// Arriba se elige el guerrero; abajo, sus técnicas en tarjetas (ícono, tipo, qué hace, cómo crece
// del nivel 1 al 5) y, a la derecha de cada una, su evolución: mejora que pide → técnica evolucionada.
let techsChar = null;
function buildTechs(charId = techsChar || myChar()) {
  techsChar = charId;
  const c = CHARACTERS[charId];
  const typeName = TECH_TYPES();
  const icon = (kind, id, size = 40) => `<canvas class="tk-icon" data-${kind}="${id}" width="${size}" height="${size}"></canvas>`;
  // Cómo crece del nivel 1 al máximo (daño siempre; el resto, si cambia)
  const growth = id => {
    const a = ATTACKS[id], s1 = a.stats(1), s5 = a.stats(MAX_ATTACK_LEVEL);
    return Object.keys(STAT_INFO).filter(k => s1[k] !== undefined && (k === 'dmg' || k === 'cd' || fmtStat(k, s1[k]) !== fmtStat(k, s5[k])))
      .slice(0, 4).map(k => `${STAT_INFO[k][0]} <b>${fmtStat(k, s1[k])}</b> → <b>${fmtStat(k, s5[k])}</b>`).join(' · ');
  };
  const card = id => {
    const a = ATTACKS[id], evoId = EVOLUTION_OF[id], evo = ATTACKS[evoId];
    const evoHtml = evo && canLearn(charId, evoId) ? `<div class="tk-evo">
        <div class="tk-evo-path">${icon('atk', id, 28)}<span>+</span>${icon('pas', evo.needs, 28)}<span>➜</span>${icon('atk', evoId, 34)}</div>
        <b>★ ${esc(evo.name)}</b>
        <small>${t('Nivel {n}', { n: MAX_ATTACK_LEVEL })} + <span style="color:${PASSIVES[evo.needs].color}">${esc(PASSIVES[evo.needs].name)}</span></small>
        <p>${esc(evo.desc)}</p></div>` : `<div class="tk-evo none">${t('Sin evolución')}</div>`;
    return `<div class="tk-card">${icon('atk', id)}
      <div class="tk-main"><div class="tk-name"><b>${esc(a.name)}</b><span class="tk-type">${typeName[a.type]}</span></div>
        <p>${esc(a.desc)}</p><div class="tk-stats">${growth(id)} <small>${t('(nivel 1 → {n})', { n: MAX_ATTACK_LEVEL })}</small></div></div>
      ${evoHtml}</div>`;
  };
  const base = Object.keys(ATTACKS).filter(id => !ATTACKS[id].evolved);
  const own = base.filter(id => ATTACKS[id].users && id !== c.start && canLearn(charId, id));
  const common = base.filter(id => !ATTACKS[id].users);
  const tabs = Object.keys(CHARACTERS).map(id => `<button class="tk-tab${id === charId ? ' active' : ''}${isUnlocked(id) ? '' : ' locked'}" data-char="${id}">
      <canvas width="40" height="37"></canvas><span>${isUnlocked(id) ? '' : '🔒 '}${esc(CHARACTERS[id].name)}</span></button>`).join('');
  const lock = c.unlock && !isUnlocked(charId) ? `<p class="tk-lock">🔒 ${t('Bloqueado')}: ${esc(c.unlock.text)}</p>` : '';
  // Las mejoras de la partida son iguales para todos: van en una columna fija a la izquierda
  const passives = Object.keys(PASSIVES).map(id => {
    const evos = Object.values(ATTACKS).filter(a => a.evolved && a.needs === id && canLearn(charId, Object.keys(ATTACKS).find(k => ATTACKS[k] === a)));
    const forChar = evos.length ? `<em>${t('Evoluciona')}: ${evos.map(a => esc(ATTACKS[a.from].name)).join(', ')}</em>` : '';
    return `<div class="tk-pas">${icon('pas', id, 26)}<div><b style="color:${PASSIVES[id].color}">${esc(PASSIVES[id].name)}</b><small>${esc(PASSIVES[id].desc)}</small>${forChar}</div></div>`;
  }).join('');
  $('techsContent').innerHTML = `
    <div class="tk-layout">
      <aside class="tk-side">
        <h3 class="tk-group">${t('Mejoras de la partida')}</h3>
        <p class="tk-side-note">${t('Iguales para todos los guerreros. Hasta {n} distintas por partida, cada una hasta nivel {max}.', { n: MAX_PASSIVES, max: MAX_PASSIVE_LEVEL })}</p>
        <div class="tk-pas-list">${passives}</div>
      </aside>
      <div class="tk-content">
        <div class="tk-tabs">${tabs}</div>
        <div class="tk-head"><b>${esc(c.name)}</b> <small>· ${esc(c.title)}</small><div>${t('Transformación')}: <b>${esc(c.transform)}</b> · ${esc(c.perk)}</div>${lock}</div>
        <h3 class="tk-group">${t('Técnica inicial')}</h3>${card(c.start)}
        ${own.length ? `<h3 class="tk-group">${t('Puede aprender al subir de nivel')}</h3>${own.map(card).join('')}` : ''}
        ${c.noKi ? `<p class="hint">${t('Mr. Satán no usa el Ki: no puede aprender las técnicas comunes.')}</p>` : `<h3 class="tk-group">${t('Técnicas comunes')} <small>· ${t('cualquier guerrero')}</small></h3>${common.map(card).join('')}`}
        <p class="hint">${t('Hasta {attacks} técnicas y {passives} mejoras por partida. Con una técnica a nivel {max} y la mejora indicada, al subir de nivel aparece una carta dorada para evolucionarla.', { attacks: MAX_ATTACKS, passives: MAX_PASSIVES, max: MAX_ATTACK_LEVEL })}</p>
      </div>
    </div>`;
  // Íconos (los mismos del HUD) y retratos
  for (const cv of $('techsContent').querySelectorAll('canvas.tk-icon')) {
    const x = cv.getContext('2d'), s = cv.width;
    x.fillStyle = '#0a0f2e'; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(155,184,255,0.5)'; x.lineWidth = 2; x.strokeRect(1, 1, s - 2, s - 2);
    if (cv.dataset.atk) drawAttackIcon(cv.dataset.atk, 3, 3, s - 6, x);
    else drawPassiveIcon(cv.dataset.pas, 3, 3, s - 6, x);
  }
  for (const b of $('techsContent').querySelectorAll('.tk-tab')) {
    drawPortraitTo(b.querySelector('canvas').getContext('2d'), CHARACTERS[b.dataset.char].look, false, 0, 0, 40);
    b.onclick = () => { buildTechs(b.dataset.char); };
  }
}
$('btnTechs').onclick = () => { buildTechs(myChar()); $('menu').classList.add('hidden'); $('techs').classList.remove('hidden'); $('techs').scrollTop = 0; };
$('btnTechsBack').onclick = () => { $('techs').classList.add('hidden'); $('menu').classList.remove('hidden'); };

// ─── Pantalla "Logros": conseguidos en color, pendientes en gris, con progreso ───────
function buildAchs() {
  const done = ACHIEVEMENTS.filter(a => SAVE.ach[a.id]).length;
  const earned = ACHIEVEMENTS.filter(a => SAVE.ach[a.id]).reduce((s, a) => s + a.zeni, 0);
  const cats = Object.entries(ACH_CATEGORIES).map(([cat, title]) => {
    const items = ACHIEVEMENTS.filter(a => a.cat === cat).map(a => {
      const ok = !!SAVE.ach[a.id];
      let prog = '';
      if (a.goal && !ok) {
        const g = achGoal(a), v = Math.min(g, a.progress(SAVE));
        prog = `<div class="ach-prog"><i style="width:${(v / g * 100).toFixed(1)}%"></i></div><small>${fmtInt(v)} / ${fmtInt(g)}</small>`;
      }
      return `<div class="ach${ok ? ' done' : ''}"><span class="trophy">${ok ? '🏆' : '🔒'}</span>
        <div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>${prog}</div><em>+${a.zeni}</em></div>`;
    }).join('');
    return `<details open><summary>${esc(title)}</summary><div class="ach-list">${items}</div></details>`;
  }).join('');
  $('achsContent').innerHTML = `<p>${t('<b>{done} / {total}</b> logros conseguidos · {zeni} Zeni ganados con ellos.', { done, total: ACHIEVEMENTS.length, zeni: fmtInt(earned) })}${TEST_MODE ? ` <i>${t('(Modo prueba: no se guardan.)')}</i>` : ''}</p>${cats}`;
}
$('btnAchs').onclick = () => { buildAchs(); $('menu').classList.add('hidden'); $('achs').classList.remove('hidden'); $('achs').scrollTop = 0; };
$('btnAchsBack').onclick = () => { $('achs').classList.add('hidden'); $('menu').classList.remove('hidden'); };

$('btnHelp').onclick =() => { buildHelp(); $('menu').classList.add('hidden'); $('help').classList.remove('hidden'); $('help').scrollTop = 0; };
$('btnHelpBack').onclick = () => { $('help').classList.add('hidden'); $('menu').classList.remove('hidden'); };
