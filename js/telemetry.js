'use strict';
// ─── Telemetría anónima, cartel del menú y reportes (api/telemetry.js) ──────────────
// · Cada minuto, con la pestaña a la vista, avisa que hay alguien jugando (en el menú, en partida u online).
// · Al terminar una partida suma sus datos a las estadísticas del backoffice.
// · Para contar cuánta gente distinta juega: un número al azar de este navegador y el nombre elegido en el juego
//   (el servidor guarda solo una huella de la IP, nunca la IP; solo los reportes guardan la IP, para el backoffice).
// · Muestra el cartel del menú que se escribe en el backoffice.
// · "Reportar un problema": un texto corto que llega al backoffice.
// En el modo prueba no se manda nada.
const Telemetry = (() => {
  const API = '/api/telemetry', EVERY = 60 * 1000;
  let sid = '';
  try { sid = sessionStorage.getItem('dbz-sid') || ''; } catch (e) { /* sin almacenamiento */ }
  if (!/^[a-z0-9]{8,24}$/.test(sid)) {
    sid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { sessionStorage.setItem('dbz-sid', sid); } catch (e) { /* sin almacenamiento */ }
  }
  // Identificador anónimo de este navegador (16/10/2026): un número al azar que se guarda una vez, para que el backoffice
  // sepa cuánta gente distinta juega. No dice quién es nadie (no lo borra el reinicio general del progreso).
  let pid = '';
  try { pid = localStorage.getItem('dbz-pid') || ''; } catch (e) { /* sin almacenamiento */ }
  if (!/^[a-z0-9]{12,32}$/.test(pid)) {
    pid = (Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).slice(0, 24);
    try { localStorage.setItem('dbz-pid', pid); } catch (e) { /* sin almacenamiento */ }
  }
  const post = body => fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true });
  const state = () => !G ? 'menu' : G.net ? 'online' : 'play';

  let pingN = 0;
  function ping() {
    if (TEST_MODE || document.visibilityState !== 'visible') return;
    // Una vez por día: el aviso de jugador distinto (con el nombre); cada 5 avisos, los 5 minutos jugados
    const day = artDay();   // el día de Argentina, como los contadores del servidor (2.23.5)
    let daily = false;
    try { daily = localStorage.getItem('dbz-pid-day') !== day; if (daily) localStorage.setItem('dbz-pid-day', day); } catch (e) { daily = !pingN; }
    const min = ++pingN % 5 === 0 ? 5 : 0;
    post({ type: 'ping', sid, state: state(), pid, ...(daily ? { daily: 1, name: SAVE.name || '' } : {}), ...(min ? { min } : {}) }).catch(() => {});
  }
  setInterval(ping, EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ping(); });
  setTimeout(ping, 3000);

  // Partida terminada: cada jugador manda la suya
  function run(d) {
    if (TEST_MODE) return;
    post({ type: 'run', ...d, pid }).catch(() => {});
  }

  // Cartel del menú
  async function loadMotd() {
    try {
      const r = await fetch(`${API}?type=motd`);
      if (!r.ok) return;
      const { motd, maint, reset } = await r.json();
      applyReset(reset);
      const text = motd && motd.active ? (LANG === 'en' && motd.en ? motd.en : motd.es) : '';
      $('motd').textContent = text || '';
      $('motd').classList.toggle('hidden', !text);
      showMaintenance(maint && maint.on ? maint : null);
    } catch (e) { /* sin conexión: sin cartel */ }
  }
  // Reinicio general del progreso (backoffice): si la marca del servidor no es la de esta partida guardada, se
  // borra (Zeni, mejoras, logros, desbloqueos, récords y estadísticas) y se avisa. Se conservan el nombre y el idioma.
  // Quien está jugando lo recibe al volver al menú; los jugadores nuevos no ven el aviso (no tenían nada).
  function applyReset(epoch) {
    if (!epoch || TEST_MODE || G || SAVE.resetEpoch === epoch) return;
    const hadProgress = SAVE.runs > 0 || SAVE.zeni > 0 || Object.keys(SAVE.ach || {}).length > 0;
    const name = SAVE.name;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* sin almacenamiento */ }
    const fresh = loadSave();
    for (const k of Object.keys(SAVE)) delete SAVE[k];
    Object.assign(SAVE, fresh, { name, resetEpoch: epoch });
    writeSave();
    buildMenu();
    if (hadProgress) $('resetNotice').classList.remove('hidden');
  }
  $('btnResetOk').onclick = () => $('resetNotice').classList.add('hidden');

  // Mantenimiento: pantalla completa que no deja jugar. Quien está en una partida la termina (se muestra
  // al volver al menú). En el modo prueba se puede jugar igual, con un aviso.
  let maintOn = null;
  function showMaintenance(m) {
    maintOn = m;
    const block = !!m && !TEST_MODE;
    if (m) $('maintText').textContent = (LANG === 'en' && m.en ? m.en : m.es) || t('Estamos haciendo mejoras. Vuelve en un rato.');
    $('maint').classList.toggle('hidden', !block || !!G);
    $('maintTest').classList.toggle('hidden', !(m && TEST_MODE));
  }
  loadMotd();
  setInterval(() => { if (!G) loadMotd(); }, 2 * 60 * 1000);   // revisa cada 2 minutos (en el menú)
  // Al volver al menú después de una partida, si entró en mantenimiento, aparece el cartel
  setInterval(() => { if (!G && maintOn && !TEST_MODE && $('maint').classList.contains('hidden')) $('maint').classList.remove('hidden'); }, 1000);

  // Reportar un problema
  let reportFrom = 'menu';
  function openReport(from) {
    reportFrom = from;
    $('reportText').value = '';
    $('reportMsg').textContent = '';
    $('btnReportSend').disabled = false;
    $('report').classList.remove('hidden');
    setTimeout(() => $('reportText').focus(), 50);
  }
  const closeReport = () => $('report').classList.add('hidden');
  async function sendReport() {
    const text = $('reportText').value.trim();
    if (text.length < 3) { $('reportMsg').textContent = t('Cuéntanos un poco más.'); return; }
    if (TEST_MODE) { $('reportMsg').textContent = t('Modo prueba: el reporte no se envía.'); return; }
    $('btnReportSend').disabled = true;
    $('reportMsg').textContent = t('Enviando...');
    try {
      const r = await post({ type: 'report', text, ver: GAME_VERSION, lang: LANG, where: G ? (G.net ? 'online' : 'partida') : reportFrom, ua: navigator.userAgent,
        pid, name: SAVE.name || '', scr: `${screen.width}x${screen.height}`, ...(G ? { level: G.lv.id, char: G.me.charId, min: Math.floor(G.t / 60) } : {}) });
      if (!r.ok) throw Object.assign(new Error(), { status: r.status });
      $('reportMsg').textContent = t('¡Gracias! Lo vamos a revisar.');
      setTimeout(closeReport, 1400);
    } catch (e) {
      $('btnReportSend').disabled = false;
      $('reportMsg').textContent = t(e.status === 429 ? 'Mandaste varios reportes seguidos; espera unos minutos.' : 'No se pudo enviar. Prueba de nuevo en un rato.');
    }
  }
  $('btnReport').onclick = () => openReport('menu');
  $('btnReportPause').onclick = () => openReport('pausa');
  $('btnReportCancel').onclick = closeReport;
  $('btnReportSend').onclick = sendReport;
  $('reportText').addEventListener('keydown', e => e.stopPropagation());   // que escribir no dispare atajos del juego

  // Partida online terminada o cortada (2.23.2): cómo era la conexión, para entender los cortes
  function net(d) {
    if (TEST_MODE) return;
    post({ type: 'net', ...d, ver: GAME_VERSION, pid }).catch(() => {});
  }
  return { run, ping, net };
})();
