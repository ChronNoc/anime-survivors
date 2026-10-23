'use strict';
// ─── Aviso de versión nueva ──────────────────────────────────────────────────────
// Cada tanto se lee la GAME_VERSION de js/data.js publicada (sin caché). Si es más nueva que
// la que está corriendo, aparece un cartel para recargar. Durante una partida queda oculto
// (body.playing) para no cortarla, y se ve al volver al menú.
const UpdateCheck = (() => {
  const EVERY = 5 * 60 * 1000;
  let last = 0, dismissed = '';
  const parse = v => String(v).split('.').map(n => parseInt(n, 10) || 0);
  function isNewer(a, b) {   // ¿a es más nueva que b?
    const x = parse(a), y = parse(b);
    for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
  }
  async function check() {
    if (location.protocol === 'file:' || Date.now() - last < 30 * 1000) return;
    last = Date.now();
    try {
      const res = await fetch(`js/data.js?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const m = (await res.text()).match(/GAME_VERSION\s*=\s*'([\d.]+)'/);
      if (m && isNewer(m[1], GAME_VERSION) && m[1] !== dismissed) show(m[1]);
    } catch (e) { /* sin conexión: se vuelve a intentar más tarde */ }
  }
  function show(ver) {
    $('updateText').textContent = t('Hay una versión nueva del juego ({ver}). Tienes la {mine}.', { ver, mine: GAME_VERSION });
    $('updateBanner').dataset.ver = ver;
    $('updateBanner').classList.remove('hidden');
  }
  $('btnUpdate').onclick = () => location.reload();
  $('btnUpdateClose').onclick = () => { dismissed = $('updateBanner').dataset.ver; $('updateBanner').classList.add('hidden'); };
  // Al abrir, cada 5 minutos y al volver a la pestaña o a la app (p. ej. desde segundo plano en el celular)
  setTimeout(check, 3000);
  setInterval(check, EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  return { check, isNewer };
})();
