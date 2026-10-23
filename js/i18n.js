'use strict';
// ─── Idioma: español (original) o inglés ─────────────────────────────────────────
// Los textos se escriben en español en el código y pasan por t(): en inglés se buscan en
// EN_TEXT (js/lang-en.js), y si falta alguno se muestra en español. Las plantillas usan {nombre}:
//   t('¡{name} ha llegado!', { name: b.name })
// Los datos del juego (personajes, técnicas, logros...) se pasan al inglés al cargar (EN_DATA).
// El idioma se cambia desde el menú y la página se recarga, así todo queda en el idioma nuevo.
const LANG_KEY = 'dbz-lang';
const LANG = (() => {
  try { const v = localStorage.getItem(LANG_KEY); if (v === 'es' || v === 'en') return v; } catch (e) { /* sin almacenamiento */ }
  return /^es\b/i.test(navigator.language || 'es') ? 'es' : 'en';
})();
document.documentElement.lang = LANG;
let EN_TEXT = {};                 // español → inglés (se llena en js/lang-en.js)
const NAME_EN = {}, NAME_ES = {}; // nombres de los datos en los dos sentidos (para los avisos online)
const I18N_MISSING = new Set();   // textos sin traducir (para revisarlos en la consola)

// Un nombre de los datos (jefe, personaje, técnica...) en el idioma actual, venga en el que venga
const trName = v => typeof v === 'string' ? (LANG === 'en' ? NAME_EN[v] : NAME_ES[v]) || v : v;

const normKey = s => s.replace(/\s+/g, ' ').trim();
function t(s, params) {
  if (typeof s !== 'string') return String(s);
  let out = s;
  if (LANG === 'en') {
    const key = normKey(s), en = EN_TEXT[key];   // los espacios y saltos de línea no cuentan
    if (en !== undefined) out = en;
    else if (/[a-záéíóúñ]/i.test(s)) I18N_MISSING.add(key);
  }
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (k in params ? trName(params[k]) : m));
  return out;
}
// Plural simple: tn(n, 'enemigo', 'enemigos') → la forma que corresponde, ya traducida
const tn = (n, one, many) => t(n === 1 ? one : many, { n });

function setLang(l) {
  if (l === LANG) return;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* sin almacenamiento */ }
  location.reload();
}

// Pasa los datos al inglés: EN_DATA tiene la misma forma que los datos (por id o por posición)
function applyDataLang(target, over) {
  for (const k in over) {
    const o = over[k], dst = target[k];
    if (dst === undefined) continue;
    if (o && typeof o === 'object' && !Array.isArray(o) && typeof dst === 'object') applyDataLang(dst, o);
    else {
      if (typeof dst === 'string' && typeof o === 'string' && (k === 'name' || k === 'transform')) { NAME_EN[dst] = o; NAME_ES[o] = dst; }
      if (LANG === 'en') target[k] = o;
    }
  }
}

// Textos fijos del HTML: se traducen una vez al cargar (nodos de texto y algunos atributos)
function translateStatic(root = document.body) {
  if (LANG !== 'en') return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const raw = n.nodeValue, key = raw.replace(/\s+/g, ' ').trim();
    if (!key || !/[a-záéíóúñ]/i.test(key)) continue;
    const en = t(key);
    if (en !== key) n.nodeValue = raw.replace(raw.trim(), en);
  }
  for (const el of root.querySelectorAll('[placeholder],[title],[aria-label],[data-tip]')) {
    for (const a of ['placeholder', 'title', 'aria-label', 'data-tip']) {
      const v = el.getAttribute(a);
      if (v && /[a-záéíóúñ]/i.test(v)) el.setAttribute(a, t(v));
    }
  }
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.content = t(meta.content);
}
