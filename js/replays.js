'use strict';
// ─── Repeticiones (2.22.0) ───────────────────────────────────────────────────
// Graba la pantalla del juego con MediaRecorder y, al terminar la partida, guarda los últimos ~10 segundos en el
// navegador (IndexedDB). No se sube nada: si se borran los datos del navegador, se pierden.
// Una grabación continua no se puede recortar, así que hay dos grabadoras que se reinician cada 10 s, desfasadas
// 5 s: al terminar, la que lleva más tiempo grabando tiene entre 5 y 10 s del final (un video completo y válido).
// En el celular viene apagada (grabar video gasta batería y rendimiento); se prende desde Perfil → Repeticiones.
const Replays = (() => {
  const KEY = 'dbz-replays', SEG = 10000, MAX_CLIPS = 10, DB = 'dbz-replays', STORE = 'clips';
  const supported = typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  const mime = supported ? ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '' : '';
  let enabled;
  try { const v = localStorage.getItem(KEY); enabled = v ? v === 'on' : !isTouch(); } catch (e) { enabled = false; }
  let stream = null, recs = [], timers = [];
  // Se graba una copia chica de la pantalla (640 px de ancho): mucho más liviano que grabar el canvas entero
  const REC_W = 640, rec = document.createElement('canvas'), rctx = rec.getContext('2d');
  function frame() {   // cada cuadro (desde render): copia la pantalla a la copia chica
    if (!stream || !canvas.width) return;
    const h = Math.round(REC_W * canvas.height / canvas.width) & ~1;
    if (rec.width !== REC_W || rec.height !== h) { rec.width = REC_W; rec.height = h; }
    rctx.drawImage(canvas, 0, 0, REC_W, h);
  }

  // Una grabadora: junta los pedazos desde su último arranque y se reinicia cada SEG
  function makeRec(delay) {
    const r = { mr: null, chunks: [], since: 0 };
    const begin = () => {
      if (!stream) return;
      try {
        r.mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 1500000 } : { videoBitsPerSecond: 1500000 });
      } catch (e) { r.mr = null; return; }
      r.chunks = []; r.since = performance.now();
      r.mr.ondataavailable = ev => { if (ev.data && ev.data.size) r.chunks.push(ev.data); };
      r.mr.start(1000);
    };
    const restart = () => { if (r.mr && r.mr.state !== 'inactive') { r.mr.onstop = begin; r.mr.stop(); } else begin(); };
    timers.push(setTimeout(() => { begin(); timers.push(setInterval(restart, SEG)); }, delay));
    return r;
  }
  function start() {
    stop();
    if (!supported || !enabled) return;
    rec.width = REC_W; rec.height = Math.round(REC_W * (canvas.height || 9) / (canvas.width || 16)) & ~1;
    try { stream = rec.captureStream(30); } catch (e) { stream = null; return; }
    recs = [makeRec(0), makeRec(SEG / 2)];
  }
  function stop() {
    for (const tm of timers) { clearTimeout(tm); clearInterval(tm); }
    timers = [];
    for (const r of recs) if (r.mr && r.mr.state !== 'inactive') { r.mr.onstop = null; try { r.mr.stop(); } catch (e) { /* ya parada */ } }
    recs = [];
    if (stream) for (const tr of stream.getTracks()) tr.stop();
    stream = null;
  }

  // ─── IndexedDB ───
  function db() {
    return new Promise((ok, fail) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((ok, fail) => {
      const tr = d.transaction(STORE, mode), st = tr.objectStore(STORE), out = fn(st);
      tr.oncomplete = () => ok(out && out.result !== undefined ? out.result : out);
      tr.onerror = () => fail(tr.error);
    });
  }
  const list = () => tx('readonly', st => st.getAll()).then(a => (a || []).sort((x, y) => y.id - x.id)).catch(() => []);
  const remove = id => tx('readwrite', st => st.delete(id)).catch(() => {});

  // Al terminar la partida: se queda con la grabadora que más lleva y guarda ese video
  function capture(meta) {
    if (!recs.length) return Promise.resolve(false);
    const r = recs.filter(x => x.mr).sort((a, b) => a.since - b.since)[0];
    if (!r) { stop(); return Promise.resolve(false); }
    return new Promise(done => {
      const finish = async () => {
        const blob = new Blob(r.chunks, { type: (r.mr && r.mr.mimeType) || mime || 'video/webm' });
        stop();
        if (blob.size < 20000) return done(false);   // casi nada grabado
        try {
          const clip = Object.assign({ id: Date.now(), blob, secs: Math.round((performance.now() - r.since) / 1000) }, meta);
          await tx('readwrite', st => st.put(clip));
          const all = await list();   // solo las últimas MAX_CLIPS
          for (const old of all.slice(MAX_CLIPS)) await remove(old.id);
          done(true);
        } catch (e) { done(false); }
      };
      for (const x of recs) if (x !== r && x.mr) x.mr.onstop = null;
      if (r.mr.state === 'inactive') finish();
      else { r.mr.onstop = finish; r.mr.stop(); }
    });
  }

  return {
    supported, start, stop, capture, list, remove, frame, max: MAX_CLIPS,
    get enabled() { return enabled; },
    setEnabled(v) { enabled = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) { /* sin almacenamiento */ } },
  };
})();

// ─── Sección del Perfil ───
async function buildReplays() {
  const box = $('replaysContent');
  if (!box) return;
  if (!Replays.supported) { box.innerHTML = `<p class="hint">${t('Este navegador no puede grabar repeticiones.')}</p>`; return; }
  const clips = await Replays.list();
  const items = clips.map(c => {
    const ch = CHARACTERS[c.char], lv = levelDef(c.level);
    const where = lv ? (lv.bonus ? t('El Camino de la Serpiente') : t('Nivel {n}', { n: lv.num })) : '';
    const when = new Date(c.id).toLocaleString(LANG === 'en' ? 'en-US' : 'es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<div class="rp-item" data-id="${c.id}"><video controls playsinline preload="metadata"></video>
      <div class="rp-meta"><b>${c.won ? '🏆 ' : '💀 '}${esc(ch ? ch.name : c.char)} · ${esc(where)}</b><small>${esc(when)} · ${t('minuto {m}', { m: fmtTime(c.time || 0) })} · ${c.secs || 0} s</small>
      <span><a class="btn small ghost rp-dl" download>${t('Descargar')}</a> <button class="btn small ghost rp-del">${t('Borrar')}</button></span></div></div>`;
  }).join('');
  box.innerHTML = `<label class="rp-toggle"><input type="checkbox" id="rpOn"${Replays.enabled ? ' checked' : ''}> ${t('Grabar los últimos 10 segundos de cada partida')}</label>
    <p class="rp-warn">⚠ ${t('Las repeticiones se guardan solo en este navegador: si borras los datos del navegador, se pierden. Se guardan las últimas {n}; para quedarte con una, descárgala.', { n: Replays.max })}</p>
    ${isTouch() ? `<p class="hint">${t('En el celular grabar gasta más batería y puede hacer que el juego ande más lento.')}</p>` : ''}
    ${items ? `<div class="rp-list">${items}</div>` : `<p class="hint">${t('Todavía no hay repeticiones guardadas.')}</p>`}`;
  $('rpOn').onchange = e => Replays.setEnabled(e.target.checked);
  for (const el of box.querySelectorAll('.rp-item')) {
    const c = clips.find(x => x.id === +el.dataset.id), url = URL.createObjectURL(c.blob);
    el.querySelector('video').src = url;
    const a = el.querySelector('.rp-dl');
    a.href = url; a.download = `dbz-survivor-${c.id}.${/mp4/.test(c.blob.type) ? 'mp4' : 'webm'}`;
    el.querySelector('.rp-del').onclick = async () => { await Replays.remove(c.id); buildReplays(); };
  }
}
