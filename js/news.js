// ─── Novedades: los cambios de cada versión, leídos de CHANGELOG.md ─────────────
// Cada "## x.y.z" es una versión y sus "- ..." son los cambios. Lo que va antes de la primera
// versión (la explicación del versionado) no se muestra, y tampoco las líneas marcadas con
// <!-- dev --> (cosas internas, como el modo prueba o las herramientas).
const NEWS_SEEN_KEY = 'dbz-news-seen';
let newsCache = null;

const newsInline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/\*(.+?)\*/g, '<i>$1</i>')
  .replace(/`(.+?)`/g, '<code>$1</code>');

// → [{ ver, date, items: [{ text, sub: [texto] }] }]
function parseChangelog(md) {
  const out = [];
  let cur = null, last = null;
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const head = line.match(/^## (\d+\.\d+\.\d+)(?:\s*\((\d{4})-(\d{2})-(\d{2})\))?/);   // ## x.y.z (AAAA-MM-DD)
    if (head) { cur = { ver: head[1], date: head[2] ? new Date(+head[2], head[3] - 1, +head[4]) : null, items: [] }; out.push(cur); last = null; continue; }
    if (!cur || !line.trim() || line.includes('<!-- dev -->')) continue;
    const bullet = line.match(/^(\s*)- (.*)$/);
    if (bullet && bullet[1].length && last) last.sub.push(bullet[2]);           // sub-viñeta
    else if (bullet) cur.items.push(last = { text: bullet[2], sub: [] });
    else cur.items.push(last = { text: line.trim(), sub: [] });               // párrafo suelto
  }
  return out.filter(v => v.items.length);
}

function newsSeen() { try { return localStorage.getItem(NEWS_SEEN_KEY) || ''; } catch (e) { return ''; } }
function markNewsSeen() {
  try { localStorage.setItem(NEWS_SEEN_KEY, GAME_VERSION); } catch (e) { /* sin almacenamiento */ }
  $('btnNews').classList.remove('has-new');
}

// Devuelve si se pudo mostrar (para no marcarlas como vistas si falló la carga)
async function buildNews() {
  const box = $('newsContent');
  if (!newsCache) {
    box.innerHTML = `<p class="rk-msg">${t('Cargando...')}</p>`;
    try {
      const r = await fetch('CHANGELOG.md', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      newsCache = parseChangelog(await r.text());
    } catch (e) {
      box.innerHTML = `<p class="rk-msg">${t('No se pudieron cargar las novedades. Prueba de nuevo en un rato.')}</p>`;
      return false;
    }
  }
  // La versión más nueva (y las que salieron desde la última vez que entraste) aparecen abiertas
  const seen = newsSeen();
  // Las novedades se escriben solo en español: en inglés se avisa arriba
  const note = LANG === 'en' ? `<p class="hint">${t('Las novedades solo están en español.')}</p>` : '';
  const li = it => `<li>${newsInline(it.text)}${it.sub.length ? `<ul>${it.sub.map(x => `<li>${newsInline(x)}</li>`).join('')}</ul>` : ''}</li>`;
  const version = (v, i) => {
    const open = i === 0 || (seen && cmpVersion(v.ver, seen) > 0);
    const tag = v.ver === GAME_VERSION ? ` <small>${t('(la que estás jugando)')}</small>` : '';
    const date = v.date ? ` <span class="news-date">· ${v.date.toLocaleDateString(LANG === 'en' ? 'en-US' : 'es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>` : '';
    return `<details${open ? ' open' : ''}><summary>${t('Versión {v}', { v: v.ver })}${date}${tag}</summary><ul>${v.items.map(li).join('')}</ul></details>`;
  };
  // Agrupadas por versión mayor (2.x.x, 1.x.x): solo la actual viene abierta, así la lista no es tan larga
  const majors = [...new Set(newsCache.map(v => v.ver.split('.')[0]))];
  const current = GAME_VERSION.split('.')[0];
  box.innerHTML = majors.map(m => {
    const list = newsCache.filter(v => v.ver.split('.')[0] === m);
    return `<details class="news-major"${m === current ? ' open' : ''}><summary>${t('Versiones {m}.x.x', { m })} <small>${t('({n} versiones)', { n: list.length })}</small></summary>
      <div class="news-major-list">${list.map(v => version(v, newsCache.indexOf(v))).join('')}</div></details>`;
  }).join('');
  box.insertAdjacentHTML('afterbegin', note);
  return true;
}
// Compara versiones "x.y.z": positivo si a es más nueva que b
function cmpVersion(a, b) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

// Puntito en el enlace si hay una versión que todavía no viste
if (newsSeen() !== GAME_VERSION) $('btnNews').classList.add('has-new');
$('btnNews').onclick = () => {
  $('menu').classList.add('hidden'); $('news').classList.remove('hidden'); $('news').scrollTop = 0;
  buildNews().then(ok => { if (ok) markNewsSeen(); });
};
$('btnNewsBack').onclick = () => { $('news').classList.add('hidden'); $('menu').classList.remove('hidden'); };
