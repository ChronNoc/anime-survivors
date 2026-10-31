'use strict';
// ─── Multijugador online (WebRTC con PeerJS) ─────────────────────────────────────
// Quien crea la sala es el anfitrión: simula la partida y envía instantáneas del
// estado ~15 veces por segundo. Los clientes mueven a su propio personaje en local
// (respuesta inmediata), envían su posición y acciones, y suavizan el resto.

const Net = (() => {
  const PREFIX = 'dbzsurvivor-v1-';
  const MAX_PLAYERS = 4;
  const SNAP_RATE = 1 / 15, POS_RATE = 1 / 20;
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // Self-hostable networking config - no secrets live in this file. Override from the page (before
  // net.js loads) or via mods/config.js with: window.DBZ_NET_CONFIG = { iceServers: [...], host, port,
  // path, secure, key }. With nothing set, this falls back to PeerJS's free public broker + Google's
  // public STUN servers, which cannot traverse every NAT (notably symmetric NAT on both sides) - see
  // README "Online play" for how to point this at your own PeerJS/coturn TURN server instead.
  const NET_CFG = (typeof window !== 'undefined' && window.DBZ_NET_CONFIG) || {};
  const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
  function peerOptions(extra) {
    const opts = Object.assign({}, extra);
    const ice = NET_CFG.iceServers || DEFAULT_ICE;
    opts.config = { iceServers: ice };
    for (const k of ['host', 'port', 'path', 'secure', 'key']) if (NET_CFG[k] !== undefined) opts[k] = NET_CFG[k];
    return opts;
  }

  let peer = null, role = null, code = '', myId = 0, inGame = false, nextId = 1, retries = 0;
  let roster = [];                 // [{ id, name, charId }]
  const conns = new Map();         // anfitrión: id → conexión
  let hostConn = null;             // cliente: conexión con el anfitrión
  let snapAcc = 0, posAcc = 0, lastSnap = 0, roomSpeed = 1, roomLevel = 'saiyan';
  // Indicador de conexión visible (ping real ida y vuelta, no solo "hace cuánto llegó la última
  // instantánea"): cada lado manda un 'ping' cada 2 s y el otro lo devuelve tal cual como 'pong'.
  const PING_RATE = 2000;
  let pingAcc = 0, myRtt = -1;         // cliente: ida y vuelta con el anfitrión
  const hostRtt = new Map();           // anfitrión: ida y vuelta con cada invitado (id → ms)
  const HOST_TIMEOUT = 15000, CLIENT_TIMEOUT = 15000; // ms sin noticias para dar por caída la conexión (2.23.2: antes 8 y 10 s)
  // Si a un invitado se le acumulan más de MAX_QUEUE bytes sin enviar, el anfitrión saltea instantáneas hasta que se
  // vacíe: si no, en una conexión lenta (p. ej. por el servidor intermediario TURN) la cola crecía minuto a minuto y a
  // los 5-7 minutos la conexión se caía (reporte del 21/10/2026). Ver netInfo y netReport para el registro.
  const MAX_QUEUE = 96 * 1024;
  // Avisos de una conexión que no la cortan (el mensaje no salió, pero la conexión sigue bien)
  const SOFT_ERRORS = ['message-too-big'];
  let chunks = [];   // (invitado) las partes de un mensaje grande que van llegando
  // Reconexión ante un corte breve (wifi, cambio de red, pestaña suspendida): el personaje, la vida, las
  // técnicas y la posición se conservan durante una pequeña ventana en vez de perderse al instante.
  const RECONNECT_GRACE = 25000;   // ms que un jugador caído puede volver sin perder su lugar
  let reconnectState = null;       // null | 'host' (cliente intentando reconectar) | 'guest:<name>' (anfitrión esperando)
  const pendingRejoin = new Map(); // anfitrión: id → { name, charId, deadline }
  let myReconnectKey = null;       // cliente: { code, id } guardado para poder reclamar su lugar
  // Errores de la conexión con el servidor de PeerJS (solo sirve para encontrarse al crear o unirse a una sala): NO
  // afectan a la conexión directa entre los jugadores. Antes cualquier error cerraba todo y las partidas online se
  // cortaban para todos a los 5-7 minutos, cuando el servidor cortaba su conexión (registro del 21/10/2026). Ahora se
  // reconecta al servidor en segundo plano y la partida sigue.
  const SIGNAL_ERRORS = ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'];
  function reconnectSignal() { try { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) { /* se reintenta en el próximo aviso */ } }
  // Registro de la conexión de esta partida (para el backoffice): directa o por intermediario, cola máxima, datos enviados
  const netInfo = { path: '?', maxBuf: 0, bytes: 0, skipped: 0, sent: 0, reported: false, err: '' };
  const queued = c => ((c.dataChannel && c.dataChannel.bufferedAmount) || 0) + (c.bufferSize || 0) * 4096;
  // ¿La conexión va directa entre los dos navegadores o por el servidor intermediario (relay)?
  function probePath(c) {
    const pc = c && c.peerConnection;
    if (!pc || !pc.getStats) return;
    pc.getStats().then(rep => {
      let pair = null;
      rep.forEach(s => { if (s.type === 'transport' && s.selectedCandidatePairId) pair = rep.get(s.selectedCandidatePairId); });
      if (!pair) rep.forEach(s => { if (s.type === 'candidate-pair' && s.nominated && s.state === 'succeeded') pair = s; });
      if (!pair) return;
      const l = rep.get(pair.localCandidateId), r = rep.get(pair.remoteCandidateId);
      const relay = (l && l.candidateType === 'relay') || (r && r.candidateType === 'relay');
      netInfo.path = relay ? 'relay' : 'direct';
    }).catch(() => {});
  }
  function netStart(connsToProbe) {
    Object.assign(netInfo, { path: '?', maxBuf: 0, bytes: 0, skipped: 0, sent: 0, reported: false, err: '' });
    setTimeout(() => connsToProbe().forEach(probePath), 5000);
  }
  // ev: 'end' (la partida terminó bien) o 'drop' (se cortó)
  function netReport(ev) {
    if (netInfo.reported || typeof Telemetry === 'undefined' || !Telemetry.net) return;
    netInfo.reported = true;
    const secs = G ? Math.floor(G.t) : 0;
    Telemetry.net({ ev, role, secs, path: netInfo.path, maxBuf: Math.round(netInfo.maxBuf / 1024), kbs: secs ? Math.round(netInfo.bytes / 1024 / Math.max(1, secs)) : 0,
      skipped: netInfo.skipped, sent: netInfo.sent, err: netInfo.err, players: G ? G.players.filter(p => !p.ally).length : 0, level: G && G.lv ? G.lv.id : '' });
  }

  // Tablas para codificar ids como números en las instantáneas
  const ENEMY_CODES = [...Object.keys(ENEMIES), ...BOSSES.map(b => b.id)];
  const ATTACK_CODES = Object.keys(ATTACKS);
  // Los niveles bonus se juegan solos: en una sala, el Nivel 1 en su lugar
  const roomLevelOf = () => (levelDef(myLevel()).bonus ? 'saiyan' : myLevel());
  const PASSIVE_CODES = Object.keys(PASSIVES);
  const PICK_CODES = ['xp', 'senzu', 'ball', 'capsule'];
  const BREAK_PROP_CODES = BREAK_PROP_TYPES.map(t => t.id);
  const r1 = v => Math.round(v);
  const r2 = v => Math.round(v * 100) / 100;

  const setMsg = m => { $('netMsg').textContent = m || ''; };   // m ya viene traducido
  const genCode = () => Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const cleanName = n => String(n || '').replace(/[<>]/g, '').trim().slice(0, 12) || t('Guerrero');
  const validChar = c => (CHARACTERS[c] ? c : 'goku');
  const peerAvailable = () => {
    if (typeof Peer !== 'undefined') return true;
    setMsg(t('No se pudo cargar el módulo online. Revisa tu conexión a internet.'));
    return false;
  };

  // ─── Sala ──────────────────────────────────────────────────────────────────
  function host() {
    if (!peerAvailable()) return;
    cleanup();
    role = 'host'; code = genCode(); myId = 0;
    setMsg(t('Creando sala...'));
    peer = new Peer(PREFIX + code, peerOptions());
    peer.on('open', () => {
      retries = 0;
      roster = [{ id: 0, name: myName(), charId: myChar(), perks: myPerks(), ver: GAME_VERSION }];
      setMsg('');
      showLobby();
    });
    peer.on('connection', conn => {
      // Mid-match: this might be a brand new join (reject, room's locked) or someone from THIS
      // room reconnecting after a brief drop (welcome them back into their existing spot instead).
      // Which one it is can only be known once their first message says 'rejoin' or 'hello', so the
      // accept/reject decision happens there, not at 'open'.
      conn.on('open', () => { if (!inGame && roster.length < MAX_PLAYERS) { conn._pid = nextId++; conns.set(conn._pid, conn); conn.send({ t: 'welcome', id: conn._pid, code }); } });
      conn.on('data', d => {
        if (d && d.t === 'rejoin' && inGame) { tryRejoin(conn, d); return; }
        if (conn._pid === undefined) { conn.send({ t: 'full', inGame }); setTimeout(() => conn.close(), 500); return; }
        onHostData(conn, d);
      });
      conn.on('close', () => { if (inGame && !netInfo.err) netInfo.err = 'conn-close'; dropClient(conn); });
      conn.on('error', e => { if (inGame) netInfo.err = 'conn-' + String((e && e.type) || 'error').slice(0, 18); if (!(e && SOFT_ERRORS.includes(e.type))) dropClient(conn); });
    });
    peer.on('disconnected', reconnectSignal);
    peer.on('error', err => {
      netInfo.err = String(err.type || '').slice(0, 24);
      if (err.type === 'unavailable-id' && retries++ < 3) { host(); return; }
      if (err.type === 'peer-unavailable') return; // un cliente que se fue
      // El servidor de encuentro se cayó o cortó: con la sala ya abierta, no pasa nada (los jugadores siguen conectados)
      if (SIGNAL_ERRORS.includes(err.type) && roster.length) { reconnectSignal(); return; }
      failed(t('Error de conexión ({type}).', { type: err.type }));
    });
  }

  function join(rawCode) {
    if (!peerAvailable()) return;
    const c = String(rawCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length !== 5) { setMsg(t('El código de sala tiene 5 caracteres.')); return; }
    cleanup();
    role = 'client'; code = c;
    setMsg(t('Conectando a la sala {code}...', { code }));
    peer = new Peer(peerOptions());
    peer.on('open', () => {
      hostConn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      hostConn.on('open', () => hostConn.send({ t: 'hello', name: myName(), charId: myChar(), perks: myPerks(), ver: GAME_VERSION }));
      hostConn.on('data', onClientData);
      hostConn.on('close', () => { if (!netInfo.err) netInfo.err = 'conn-close'; if (inGame) attemptReconnect(); else hostLost(); });
      hostConn.on('error', e => { netInfo.err = 'conn-' + String((e && e.type) || 'error').slice(0, 18); if (!(e && SOFT_ERRORS.includes(e.type))) { if (inGame) attemptReconnect(); else hostLost(); } });
    });
    peer.on('disconnected', reconnectSignal);
    peer.on('error', err => {
      netInfo.err = String(err.type || '').slice(0, 24);
      // Ya conectado con el anfitrión: un error del servidor de encuentro no corta nada (si se corta la conexión
      // con el anfitrión, avisa hostConn con 'close')
      if (hostConn && hostConn.open && err.type !== 'peer-unavailable') { reconnectSignal(); return; }
      if (err.type === 'peer-unavailable') failed(t('No se encontró la sala {code}.', { code }));
      else failed(t('Error de conexión ({type}).', { type: err.type }));
    });
  }

  function onHostData(conn, d) {
    const id = conn._pid;
    if (id === undefined || !d) return;
    switch (d.t) {
      case 'ping': conn.send({ t: 'pong', ts: d.ts }); break;
      case 'pong': hostRtt.set(id, Math.max(0, Math.round(performance.now() - d.ts))); break;
      case 'hello':
        if (!roster.some(r => r.id === id)) roster.push({ id, name: cleanName(d.name), charId: validChar(d.charId), perks: cleanPerks(d.perks), ver: String(d.ver || '?').slice(0, 12) });
        broadcastLobby();
        break;
      case 'char': {
        const r = roster.find(r => r.id === id);
        if (r && !inGame) { r.charId = validChar(d.charId); broadcastLobby(); }
        break;
      }
      case 'pos': {
        const P = inGame && G && G.players.find(p => p.id === id);
        if (P) { P.lastSeen = performance.now(); P.aim = Number.isFinite(d.a) ? d.a : null; }
        if (P && !P.dead && G.mode === 'play' && !fusionLocked(P) && isFinite(d.x) && isFinite(d.y)) {
          P.tx = d.x; P.ty = d.y; P.facing = d.f === -1 ? -1 : 1; P.moving = !!d.m; P.dir = DIR_CODES[d.v] || 'side';
          if (P.x === undefined || Math.hypot(P.tx - P.x, P.ty - P.y) > 200) { P.x = P.tx; P.y = P.ty; }
        }
        break;
      }
      case 'tr':
        if (inGame && G) handleKi(G.players.find(p => p.id === id), isFinite(d.a) ? d.a : 0);
        break;
      case 'pick':
        if (inGame && G) applyPick(id, d.r, d.c);
        break;
      case 'waveBuy':
        if (inGame && G) buyWaveItem(id, d.item);
        break;
      case 'waveReady':
        if (inGame && G) readyWaveShop(id);
        break;
    }
  }

  function onClientData(d) {
    if (!d) return;
    switch (d.t) {
      case 'ping': send({ t: 'pong', ts: d.ts }); break;
      case 'pong': myRtt = Math.max(0, Math.round(performance.now() - d.ts)); break;
      case 'welcome': myId = d.id; setMsg(''); showLobby(); break;
      case 'lobby':
        roster = d.players; roomSpeed = d.speed > 1 ? FAST_SPEED : 1; roomLevel = d.level === 'weekly' ? 'weekly' : levelDef(d.level).id;
        if (!inGame) { if ($('lobby').classList.contains('hidden') && !G) showLobby(); renderLobby(); }
        break;
      case 'full': failed(t(d.inGame ? 'La partida de esa sala ya comenzó.' : 'La sala está llena (máximo 4).')); break;
      case 'start':
        inGame = true; roster = d.players; lastSnap = performance.now();
        netStart(() => (hostConn ? [hostConn] : []));
        newGame(roster, { role: 'client' }, myId, d.speed > 1 ? FAST_SPEED : 1, d.level === 'weekly' ? 'weekly' : levelDef(d.level).id);
        break;
      case 's': if (inGame && G) applySnapshot(d); break;
      case 'ck':   // un mensaje grande que llega en partes (en orden: el canal es confiable y ordenado)
        if (d.i === 0) chunks = [];
        chunks.push(String(d.d || ''));
        if (d.i === d.n - 1) { const whole = chunks.join(''); chunks = []; let m = null; try { m = JSON.parse(whole); } catch (e) { /* llegó roto: se descarta */ } if (m && m.t !== 'ck') onClientData(m); }
        break;
      case 'end': if (inGame && G) { netReport('end'); inGame = false; endRun(d.won); } break;
    }
  }

  // PeerJS, con serialization 'json', no manda mensajes de más de ~16 KB: los descarta y avisa 'message-too-big' en la
  // conexión. Con 4 jugadores y mucha horda, algunas instantáneas completas (cada KEYFRAME) pasaban ese tamaño, y el
  // anfitrión tomaba el aviso como un corte y echaba al invitado (registro del 21/10/2026, partidas de 4 en PH, minuto 1-2).
  // Ahora los mensajes grandes van en partes de CHUNK caracteres (cada parte, aun con caracteres de 3 bytes, entra) (2.23.6)
  const CHUNK = 5000;
  function chunked(msg) {
    const s = JSON.stringify(msg);
    if (s.length <= CHUNK) return null;
    const parts = [];
    for (let i = 0; i < s.length;) {
      let j = Math.min(s.length, i + CHUNK);
      if (j < s.length && /[\uD800-\uDBFF]/.test(s[j - 1])) j--;   // no cortar un carácter de dos mitades (emoji)
      parts.push(s.slice(i, j)); i = j;
    }
    return parts.map((d, i) => ({ t: 'ck', i, n: parts.length, d }));
  }
  function broadcast(msg) {
    const parts = chunked(msg);
    for (const c of conns.values()) if (c.open) { if (parts) for (const p of parts) c.send(p); else c.send(msg); }
  }
  function broadcastLobby() {
    roomSpeed = SAVE.speed2 ? FAST_SPEED : 1; roomLevel = roomLevelOf();
    broadcast({ t: 'lobby', players: roster, speed: roomSpeed, level: roomLevel });
    if (!inGame) renderLobby();
  }
  function finalizeDrop(id) {
    pendingRejoin.delete(id);
    roster = roster.filter(r => r.id !== id);
    if (inGame && G) {
      const P = G.players.find(p => p.id === id);
      if (P && !P.gone) {
        netReport('drop');
        P.gone = true; P.dead = true; P.netDisconnected = false;
        announce('{name} se ha desconectado', '#ff8a9a', { name: P.name });
        if (G.fusion && G.fusion.ids.includes(id)) endFusion();
        if (G.round && G.round.waiting.delete(id) && !G.round.waiting.size) finishRound();
      }
    } else broadcastLobby();
  }
  // tryRejoin: a connection from the SAME room claims an id that dropped mid-match within the grace
  // window. Rebinds the connection to the existing player - position, HP, Ki, attacks, everything the
  // player had is untouched, since G.players was never modified while they were just disconnected.
  function tryRejoin(conn, d) {
    const id = d.id, pending = pendingRejoin.get(id);
    if (!Number.isFinite(id) || !pending || performance.now() > pending.deadline) {
      conn.send({ t: 'rejoinFail' }); setTimeout(() => conn.close(), 300); return;
    }
    pendingRejoin.delete(id);
    conn._pid = id;
    conns.set(id, conn);
    const P = G && G.players.find(p => p.id === id);
    if (P) P.netDisconnected = false;
    const r = roster.find(r => r.id === id);
    if (r) r.name = pending.name;
    conn.send({ t: 'rejoined', id, code });
    if (G && G.me) announce('{name} se reconectó', '#8fe3ff', { name: pending.name });
  }
  function dropClient(conn) {
    const id = conn._pid;
    if (id === undefined || !conns.has(id)) return;
    conns.delete(id);
    if (inGame && G) {
      const P = G.players.find(p => p.id === id);
      const r = roster.find(r => r.id === id);
      if (P && !P.gone && !pendingRejoin.has(id)) {
        // Grace window: keep their seat, position and stats exactly as they were, just freeze them
        // (brief invulnerability so the horde doesn't finish them off while disconnected) and show a
        // "reconnecting" state, instead of instantly treating the drop as final.
        P.netDisconnected = true; P.inv = Math.max(P.inv, RECONNECT_GRACE / 1000);
        pendingRejoin.set(id, { name: r ? r.name : P.name, charId: P.charId, deadline: performance.now() + RECONNECT_GRACE });
        setTimeout(() => { if (pendingRejoin.has(id)) finalizeDrop(id); }, RECONNECT_GRACE + 50);
      }
      return;
    }
    roster = roster.filter(r => r.id !== id);
    broadcastLobby();
  }
  // Client-side reconnect: tears down the dead peer/connection and opens a fresh one, claiming the
  // same player id with 'rejoin' instead of 'hello' so the host hands back the exact same character,
  // HP, Ki, attacks and position instead of starting a new player. Gives up after a few tries over
  // roughly the same window as the host's own grace period (RECONNECT_GRACE), then falls back to the
  // normal "connection lost" screen.
  const RECONNECT_TRIES = 6, RECONNECT_RETRY_DELAY = 3000;
  let reconnectTries = 0, reconnectTimer = null;
  function attemptReconnect() {
    if (role !== 'client' || !inGame) return;
    if (reconnectTries++ >= RECONNECT_TRIES) { reconnectState = null; hostLost(); return; }
    reconnectState = 'host';
    setMsg(t('Reconectando con el anfitrión... ({n})', { n: reconnectTries }));
    try { if (peer) peer.destroy(); } catch (e) { /* ya destruido */ }
    peer = new Peer(peerOptions());
    const retry = () => { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(attemptReconnect, RECONNECT_RETRY_DELAY); };
    peer.on('open', () => {
      hostConn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      hostConn.on('open', () => hostConn.send({ t: 'rejoin', id: myId }));
      hostConn.on('data', d => {
        if (d && d.t === 'rejoined') { reconnectState = null; reconnectTries = 0; lastSnap = performance.now(); setMsg(''); }
        else if (d && d.t === 'rejoinFail') retry();
        else onClientData(d);
      });
      hostConn.on('close', retry);
      hostConn.on('error', retry);
    });
    peer.on('error', retry);
  }
  function hostLost() {
    if (role !== 'client') return;
    reconnectState = null;
    if (inGame) netReport('drop');
    failed(t('Se perdió la conexión con el anfitrión.'));
  }
  function failed(msg) {
    const wasPlaying = !!G;
    leave();
    setMsg(msg);
    if (wasPlaying) setTimeout(() => setMsg(msg), 0);
  }

  function cleanup() {
    for (const c of conns.values()) try { c.close(); } catch (e) { /* ya cerrada */ }
    conns.clear();
    if (hostConn) try { hostConn.close(); } catch (e) { /* ya cerrada */ }
    hostConn = null;
    if (peer) try { peer.destroy(); } catch (e) { /* ya destruido */ }
    peer = null; role = null; inGame = false; roster = []; nextId = 1;
    reconnectState = null; reconnectTries = 0; clearTimeout(reconnectTimer);
    pendingRejoin.clear(); myRtt = -1; hostRtt.clear();
  }
  function leave() {
    cleanup();
    $('lobby').classList.add('hidden');
    history.replaceState(null, '', location.pathname);
    toMenu();
  }

  // ─── Pantalla de sala ──────────────────────────────────────────────────────
  function showLobby() {
    G = null;
    document.body.classList.remove('playing');
    for (const id of ['menu', 'gameover', 'levelup', 'pause', 'shop', 'credits', 'help', 'techs', 'achs', 'rank']) $(id).classList.add('hidden');
    $('lobby').classList.remove('hidden');
    $('lobbyChars').innerHTML = '';   // se rearma: puede haber personajes recién desbloqueados
    $('roomCode').textContent = code;
    history.replaceState(null, '', `${location.pathname}?sala=${code}`);
    renderLobby();
  }
  function renderLobby() {
    const box = $('lobbyPlayers');
    box.innerHTML = '';
    roster.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'lobby-player';
      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 37;
      drawPortraitTo(cv.getContext('2d'), CHARACTERS[r.charId].look, false, 0, 0, 40);
      const name = document.createElement('span');
      name.className = 'lp-name';
      name.style.color = PLAYER_COLORS[i % 4];
      name.textContent = r.name + (r.id === myId ? ' ' + t('(tú)') : '') + (r.id === 0 ? ' ★' : '');
      const ch = document.createElement('span');
      ch.className = 'lp-char';
      ch.textContent = CHARACTERS[r.charId].name;
      row.append(cv, name, ch);
      if (r.ver && r.ver !== GAME_VERSION) {   // otra versión del juego: puede haber diferencias
        const v = document.createElement('span');
        v.className = 'lp-ver';
        v.textContent = `⚠ v${r.ver}`;
        v.title = t('Este jugador tiene otra versión del juego');
        row.appendChild(v);
      }
      box.appendChild(row);
    });
    if (roster.some(r => r.ver && r.ver !== GAME_VERSION)) {
      const warn = document.createElement('div');
      warn.className = 'lobby-ver-warn';
      warn.textContent = t('Hay jugadores con otra versión del juego (la tuya es la {v}). Recarguen la página para jugar todos con la misma.', { v: GAME_VERSION });
      box.appendChild(warn);
    }
    for (let i = roster.length; i < MAX_PLAYERS; i++) {
      const row = document.createElement('div');
      row.className = 'lobby-player empty';
      row.textContent = t('Esperando jugador...');
      box.appendChild(row);
    }
    // Selector de personaje
    const chars = $('lobbyChars');
    if (!chars.children.length) {
      for (const id in CHARACTERS) {
        if (!isUnlocked(id)) continue;   // solo personajes desbloqueados
        const b = document.createElement('button');
        b.className = 'lobby-char';
        b.title = CHARACTERS[id].name;
        const cv = document.createElement('canvas');
        cv.width = 40; cv.height = 37;
        drawPortraitTo(cv.getContext('2d'), CHARACTERS[id].look, false, 0, 0, 40);
        b.appendChild(cv);
        b.onclick = () => selectChar(id);
        b._id = id;
        chars.appendChild(b);
      }
    }
    const mine = roster.find(r => r.id === myId);
    for (const b of chars.children) b.classList.toggle('selected', !!mine && mine.charId === b._id);
    $('btnStart').classList.toggle('hidden', role !== 'host');
    $('lobbyWait').classList.toggle('hidden', role === 'host');
    // Velocidad: el anfitrión la elige; los demás ven cuál está activa
    $('lobbySpeedOpt').classList.toggle('hidden', role !== 'host');
    $('lobbySpeed').checked = !!SAVE.speed2;
    $('lobbySpeedInfo').textContent = role === 'host' ? '' : `${t('Velocidad')}: ${roomSpeed > 1 ? `x${FAST_SPEED}` : t('normal')}`;
    // Nivel: el anfitrión lo elige (de los que tiene abiertos); los demás ven cuál se va a jugar
    const sel = $('lobbyLevel');
    if (role === 'host') {
      sel.innerHTML = LEVELS.filter(L => isLevelOpen(L.id)).map(L => `<option value="${L.id}">${t('Nivel {n}', { n: L.num })}</option>`).join('') +
        (WEEKLY ? `<option value="weekly">⭐ ${t('Desafío semanal')} · ${esc(weeklyWhere(WEEKLY))}</option>` : '');
      sel.value = roomLevelOf();
    }
    sel.classList.toggle('hidden', role !== 'host');
    $('lobbyLevelInfo').textContent = role === 'host' ? '' : (roomLevel === 'weekly' && WEEKLY ? `⭐ ${t('Desafío semanal')} · ${weeklyWhere(WEEKLY)}` : t('Nivel {n}', { n: levelDef(roomLevel).num }));
  }
  function speedChanged() { if (role === 'host' && !inGame) broadcastLobby(); }
  function levelChanged() { if (role === 'host' && !inGame) broadcastLobby(); }
  function changeChar(id) {
    if (!role || inGame) return;
    const mine = roster.find(r => r.id === myId);
    if (mine) mine.charId = id;
    if (role === 'host') broadcastLobby();
    else { if (hostConn && hostConn.open) hostConn.send({ t: 'char', charId: id }); renderLobby(); }
  }
  function start() {
    if (role !== 'host') return;
    inGame = true;
    snapAcc = 0;
    roomSpeed = SAVE.speed2 ? FAST_SPEED : 1;
    roomLevel = roomLevelOf();
    broadcast({ t: 'start', players: roster, speed: roomSpeed, level: roomLevel });
    newGame(roster, { role: 'host' }, 0, roomSpeed, roomLevel);
    netStart(() => [...conns.values()]);
  }
  function gameOver(won) {
    if (role !== 'host') return;
    broadcast({ t: 's', ...encodeSnapshot() });
    broadcast({ t: 'end', won });
    netReport('end');
    inGame = false;
  }
  function backToLobby() {
    if (!role) { toMenu(); return; }
    inGame = false;
    showLobby();
    if (role === 'host') broadcastLobby();
  }

  // ─── Instantáneas (anfitrión → clientes) ───────────────────────────────────
  // Para no mandar todo en cada instantánea (2.12.0: ~12 KB → ~3 KB con 200 enemigos y 500 gemas):
  //  · Enemigos: la primera vez van completos [nid, tipo, x, y, vida%, marcas, mira]; después solo
  //    [-nid, dx, dy, vida%, marcas] con lo que se movió desde el último envío (la mira sale de dx).
  //  · Objetos (gemas, semillas, esferas...): solo los que aparecen (Ka), los que se mueven (Km) y los
  //    que desaparecen (Kd). El canal es confiable y ordenado, así que las diferencias no se pierden.
  //  Cada KEYFRAME instantáneas va todo completo, por si acaso.
  const KEYFRAME = 60;
  let deltaG = null, snapN = 0, pickSeq = 0;
  const sentE = new Map(), sentK = new Map();
  function encodeEnemiesAndPickups() {
    if (deltaG !== G) { deltaG = G; snapN = 0; sentE.clear(); sentK.clear(); }
    const full = snapN++ % KEYFRAME === 0;
    if (full) { sentE.clear(); sentK.clear(); }
    const E = [], seenE = new Set();
    for (const e of G.enemies) {
      const x = r1(e.x), y = r1(e.y), hp = Math.max(0, Math.ceil(e.hp / e.maxHp * 100));
      const flags = (e.elite ? 1 : 0) | (e.flash > 0 ? 2 : 0) | (e.windup > 0 ? 4 : 0) | (e.air ? 8 : 0) | (e.tp ? 16 : 0) | (e.cast ? 32 : 0) | (e.shield > 0 ? 64 : 0) | (e.stun > 0 ? 128 : 0), prev = sentE.get(e.nid);   // 8: en el aire · 16: teletransportándose · 32: cargando su técnica · 64: barrera
      if (prev) E.push(-e.nid, x - prev[0], y - prev[1], hp, flags);
      else E.push(e.nid, ENEMY_CODES.indexOf(e.id), x, y, hp, flags, e.facing);
      sentE.set(e.nid, [x, y]); seenE.add(e.nid);
    }
    for (const nid of sentE.keys()) if (!seenE.has(nid)) sentE.delete(nid);
    const Ka = [], Km = [], Kd = [], seenK = new Set();
    for (const p of G.pickups) {
      if (!p.pid) p.pid = ++pickSeq;
      const x = r1(p.x), y = r1(p.y), prev = sentK.get(p.pid);
      if (!prev) Ka.push(p.pid, x, y, PICK_CODES.indexOf(p.kind), p.v || 0);
      else if (prev[0] !== x || prev[1] !== y) Km.push(p.pid, x, y);
      sentK.set(p.pid, [x, y]); seenK.add(p.pid);
    }
    for (const pid of sentK.keys()) if (!seenK.has(pid)) { Kd.push(pid); sentK.delete(pid); }
    return { E, Ka, Km, Kd, kf: full ? 1 : 0 };
  }
  function encodeSnapshot() {
    const J = [], S = [];
    const JO = [];   // dueño de cada proyectil (para dibujar más suaves los de los compañeros, 2.24.0)
    for (const p of G.projs) { J.push(r1(p.x), r1(p.y), r2(p.vx), r2(p.vy), r1(p.r), ATTACK_CODES.indexOf(p.aid), r2(p.life)); JO.push(p.owner ? p.owner.id : -1); }
    for (const s of G.shots) S.push(r1(s.x), r1(s.y), r2(s.vx), r2(s.vy), s.r, s.ci);
    const snap = {
      tm: r2(G.t), lv: G.level, xp: r2(G.xp), xn: G.xpNext, k: G.kills, db: G.dragonBalls, md: G.mode, sh: r2(Math.max(0, G.shake)),
      bn: G.banner ? [G.banner.text, G.banner.color, r2(G.banner.t), G.banner.params || null] : null,
      rd: G.round ? [G.round.id, G.round.kind, G.round.level, [...G.round.waiting], G.round.offers || null] : null,   // offers: deseos sorteados por jugador
      dn: G.ballsNeeded,
      // Brotato-style wave/shop state: wave number, kills so far/needed, shared money, and (while open)
      // the shop round's waiting set + each player's rolled item offers.
      wv: G.wave, wk: G.waveKills, wt: G.waveTarget, mn: G.money, tu: r1(G.teamUlt),
      ws: G.waveShop ? [[...G.waveShop.waiting], G.waveShop.offers] : null,
      P: G.players.map(p => [p.id, r1(p.x), r1(p.y), Math.ceil(p.hp), p.maxHp, p.facing, p.moving ? 1 : 0, p.punchT > 0 ? -r2(p.punchT) : r2(p.castT), r2(p.inv),
        r2(p.transformed), Math.floor(p.ki), p.dead ? 1 : 0, r2(p.revive), p.gone ? 1 : 0,
        p.attacks.map(a => [ATTACK_CODES.indexOf(a.id), a.lvl]), PASSIVE_CODES.map(k => p.passives[k]), p.bonusZeni,
        [p.stats.kills, p.stats.taken, Object.fromEntries(Object.entries(p.stats.dmg).map(([k, v]) => [k, Math.round(v)]))],
        p.hidden ? 1 : 0, DIR_CODES.indexOf(p.dir || 'side'), p.senzuLeft || 0, r2(p.immortal || 0), p.wishDmg || 0, p.wishZeni || 0, r1(p.kiHold || 0), p.halo ? 1 : 0, r2(p.stone || 0), r2(p.candy || 0), r2(p.swapBody || 0), r2(p.invert || 0), r2(p.kaioken || 0), p.kaiokenBoost || 0, r2(p.tripT || 0), r2(p.poseT || 0), r2(p.koT || 0), p.owUses || 0,
        Object.values(p.shop)]),
      fu: G.fusion ? [G.fusion.ids, G.fusion.driverId, G.fusion.gunnerId, G.fusion.phase, r2(G.fusion.t), G.fusion.dur, r2(G.fusion.bbCd), r1(G.fusion.mx), r1(G.fusion.my)] : null,
      ...encodeEnemiesAndPickups(), J, JO, S,
      // técnicas normales por índice; las especiales (Big Bang) por nombre
      B: G.beams.map(b => [b.owner.id, r2(b.ang), r1(b.len), r1(b.width), r2(b.t), r2(b.dur), ATTACK_CODES.includes(b.aid) ? ATTACK_CODES.indexOf(b.aid) : b.aid]),
      N: G.novas.map(n => [r1(n.x), r1(n.y), r1(n.r), r1(n.maxR), n.color, n.hold === undefined ? -1 : r2(n.hold), n.owner ? n.owner.id : -1]),
      Z: G.hazards.map(h => [r1(h.x), r1(h.y), h.r, r2(h.t), h.dur, h.dmg ? 0 : 1, h.ball ? [r1(h.ball.x), r1(h.ball.y), h.ball.r] : 0]),   // marca sin daño · Death Ball
      GZ: G.zones.map(z => [r1(z.x), r1(z.y), z.r, r2(z.t), z.dur]),   // zonas de gravedad (Puipui)
      DC: G.decoys.map(d => [r1(d.x), r1(d.y), r2(d.t), d.owner.id, d.facing, Math.round(d.taunt), d.gift ? 1 : 0]),   // Zanzoken / Bomba de regalo
      HB: G.helpers.map(h => [r1(h.x), r1(h.y), h.facing, r2(h.t), h.punch > 0 ? 1 : 0]),   // ¡Amigo Buu! (Mr. Satán)
      EB: G.ebeams.map(b => [r1(b.x), r1(b.y), r2(b.ang), b.len, b.width, r2(b.t), b.dur, b.color, b.core, r2(b.spin || 0)]),   // rayos de los jefes
      L: G.lanes.map(l => [r1(l.x), r1(l.y), r2(l.dx), r2(l.dy), r1(l.len), r1(l.w), r2(l.t), l.dur]),
      BP: G.breakProps.map(b => [b.id, BREAK_PROP_CODES.indexOf(b.type.id), r1(b.x), r1(b.y), Math.max(0, Math.ceil(b.hp / b.maxHp * 100)), b.flash > 0 ? 1 : 0]),
      ev: G.out,
    };
    G.out = [];
    return snap;
  }
  function hostTick(dt) {
    if (!inGame) return;
    // Jugadores que dejaron de enviar su posición (se cayó su conexión sin avisar)
    const now = performance.now();
    for (const [id, conn] of conns) {
      const P = G.players.find(p => p.id === id);
      if (P && !P.gone && P.lastSeen && now - P.lastSeen > CLIENT_TIMEOUT) { if (!netInfo.err) netInfo.err = 'timeout'; dropClient(conn); try { conn.close(); } catch (e) { /* ya cerrada */ } }
    }
    pingAcc += dt * 1000;
    if (pingAcc >= PING_RATE) { pingAcc = 0; const ping = { t: 'ping', ts: now }; for (const c of conns.values()) if (c.open) c.send(ping); }
    snapAcc += dt;
    if (snapAcc < SNAP_RATE) return;
    if (!conns.size) { snapAcc = 0; G.out = []; return; }
    // Algún invitado todavía no recibió lo anterior: esta vez no se manda nada (los avisos esperan a la próxima)
    let worst = 0;
    for (const c of conns.values()) if (c.open) worst = Math.max(worst, queued(c));
    netInfo.maxBuf = Math.max(netInfo.maxBuf, worst);
    if (worst > MAX_QUEUE) {
      netInfo.skipped++;
      if (G.out.length > 400) G.out.splice(0, G.out.length - 400);
      return;   // (snapAcc sigue lleno: se vuelve a intentar en el próximo cuadro)
    }
    snapAcc = 0;
    const msg = { t: 's', ...encodeSnapshot() };
    netInfo.sent++;
    if (netInfo.sent % 15 === 0) netInfo.bytes += JSON.stringify(msg).length * 15;   // (se mide 1 de cada 15)
    broadcast(msg);
  }

  // ─── Cliente: aplicar instantáneas y suavizar ──────────────────────────────
  function applySnapshot(d) {
    G.t = d.tm; G.level = d.lv; G.xp = d.xp; G.xpNext = d.xn; G.kills = d.k; G.dragonBalls = d.db;
    if (G.mode !== 'over') G.mode = d.md;
    G.shake = Math.max(G.shake, d.sh);
    if (d.bn && (!G.banner || G.banner.text !== d.bn[0])) G.banner = { text: d.bn[0], color: d.bn[1], t: d.bn[2], params: d.bn[3] || null };
    G.round = d.rd ? { id: d.rd[0], kind: d.rd[1], level: d.rd[2], waiting: new Set(d.rd[3]), offers: d.rd[4] || null } : null;
    G.ballsNeeded = d.dn || 7;
    G.wave = d.wv || 1; G.waveKills = d.wk || 0; G.waveTarget = d.wt || 1; G.money = d.mn || 0; G.teamUlt = d.tu || 0;
    G.waveShop = d.ws ? { waiting: new Set(d.ws[0]), offers: d.ws[1] || {} } : null;
    G.fusion = d.fu ? { ids: d.fu[0], driverId: d.fu[1], gunnerId: d.fu[2], phase: d.fu[3], t: d.fu[4], dur: d.fu[5], bbCd: d.fu[6], mx: d.fu[7], my: d.fu[8] } : null;
    lastSnap = performance.now();

    for (const a of d.P) {
      const P = G.players.find(p => p.id === a[0]);
      if (!P) continue;
      const wasDead = P.dead;
      if (P !== G.me) {
        P.tx = a[1]; P.ty = a[2]; P.facing = a[5]; P.moving = !!a[6]; P.dir = DIR_CODES[a[19]] || 'side';
        if (Math.hypot(P.tx - P.x, P.ty - P.y) > 200) { P.x = P.tx; P.y = P.ty; }
      }
      P.hp = a[3]; P.maxHp = a[4]; P.castT = Math.max(0, a[7]); P.punchT = Math.max(0, -a[7]); P.inv = a[8]; P.transformed = a[9]; P.ki = a[10];   // a[7] negativo = puñetazo
      P.dead = !!a[11]; P.revive = a[12]; P.gone = !!a[13];
      // Semilla de reserva, efectos de los deseos y Ki concentrado (para el HUD; también los míos)
      P.senzuLeft = a[20] || 0; P.immortal = a[21] || 0; P.wishDmg = a[22] || 0; P.wishZeni = a[23] || 0; P.kiHold = a[24] || 0; P.halo = !!a[25]; P.stone = a[26] || 0; P.candy = a[27] || 0; P.swapBody = a[28] || 0; P.invert = a[29] || 0; P.kaioken = a[30] || 0; P.kaiokenBoost = a[31] || 0; P.tripT = a[32] || 0; P.poseT = a[33] || 0; P.koT = a[34] || 0; P.owUses = a[35] || 0;   // a[25]: aureola (usó la Semilla de reserva)
      if (a[36]) Object.keys(P.shop).forEach((k, i) => { P.shop[k] = a[36][i] || 0; });   // compras de la tienda de oleada
      P.attacks = a[14].map(([i, l]) => ({ id: ATTACK_CODES[i], lvl: l, cd: 0 }));
      PASSIVE_CODES.forEach((k, i) => { P.passives[k] = a[15][i]; });
      P.bonusZeni = a[16];
      if (a[17]) P.stats = { kills: a[17][0], taken: a[17][1], dmg: a[17][2] || {} };
      const wasHidden = P.hidden;
      P.hidden = !!a[18];
      // Mi posición la manda el anfitrión al revivir, durante la danza / dentro de Gogeta y al separarnos
      if (P === G.me && ((wasDead && !P.dead) || fusionLocked(P) || (wasHidden && !P.hidden))) { P.x = a[1]; P.y = a[2]; }
    }

    // Enemigos: completos (nid positivo, 7 datos) o solo lo que se movió (nid negativo, 5 datos)
    const known = new Map(G.enemies.map(e => [e.nid, e])), E = d.E || [], enemies = [];
    for (let i = 0; i < E.length;) {
      let e, flags;
      if (E[i] > 0) {
        e = known.get(E[i]);
        if (!e) {
          const id = ENEMY_CODES[E[i + 1]], boss = !ENEMIES[id], elite = !!(E[i + 5] & 1);
          const def = boss ? BOSSES.find(b => b.id === id) : ENEMIES[id];
          if (!def) { i += 7; continue; }
          e = { nid: E[i], id, def, boss, elite, x: E[i + 2], y: E[i + 3], r: def.r, scale: def.scale * (elite ? 1.4 : 1), phase: Math.random() * 10, flash: 0, maxHp: 100 };
        }
        e.sx = e.tx = E[i + 2]; e.sy = e.ty = E[i + 3]; e.hp = E[i + 4]; e.facing = E[i + 6]; flags = E[i + 5];
        i += 7;
      } else {
        e = known.get(-E[i]);
        if (!e) { i += 5; continue; }   // no debería pasar: llegó completo antes
        const dx = E[i + 1];
        e.sx += dx; e.sy += E[i + 2]; e.tx = e.sx; e.ty = e.sy; e.hp = E[i + 3]; flags = E[i + 4];
        if (dx) e.facing = dx > 0 ? 1 : -1;
        i += 5;
      }
      if (flags & 2) e.flash = 0.08;
      e.windup = flags & 4 ? 1 : 0;   // avisando una embestida
      e.airF = !!(flags & 8); e.tpF = !!(flags & 16); e.castF = !!(flags & 32); e.shieldF = !!(flags & 64); e.stunF = !!(flags & 128);   // cruzando las nubes por el aire · jefe teletransportándose
      if (Math.hypot(e.tx - e.x, e.ty - e.y) > 150) { e.x = e.tx; e.y = e.ty; }
      enemies.push(e);
    }
    G.enemies = enemies;

    G.projs = [];
    for (let i = 0; i < d.J.length; i += 7) {
      const def = ATTACKS[ATTACK_CODES[d.J[i + 5]]];
      if (!def) continue;
      G.projs.push({ x: d.J[i], y: d.J[i + 1], vx: d.J[i + 2], vy: d.J[i + 3], r: d.J[i + 4], life: d.J[i + 6], color: def.color, kind: def.kind, spin: Math.random() * 6, ownerId: d.JO ? d.JO[i / 7] : -1 });
    }
    G.shots = [];
    for (let i = 0; i < d.S.length; i += 6) G.shots.push({ x: d.S[i], y: d.S[i + 1], vx: d.S[i + 2], vy: d.S[i + 3], r: d.S[i + 4], color: SHOT_COLORS[d.S[i + 5]] || SHOT_COLORS[0] });
    // Objetos: los que aparecen, se mueven o desaparecen (en una instantánea completa, la lista entera)
    const picks = d.kf ? new Map() : new Map(G.pickups.map(p => [p.pid, p]));
    for (const pid of d.Kd || []) picks.delete(pid);
    const Ka = d.Ka || [], Km = d.Km || [];
    for (let i = 0; i < Ka.length; i += 5) picks.set(Ka[i], { pid: Ka[i], x: Ka[i + 1], y: Ka[i + 2], kind: PICK_CODES[Ka[i + 3]], v: Ka[i + 4] });
    for (let i = 0; i < Km.length; i += 3) { const p = picks.get(Km[i]); if (p) { p.x = Km[i + 1]; p.y = Km[i + 2]; } }
    G.pickups = [...picks.values()];
    G.beams = d.B.map(b => {
      const def = b[6] === 'bigbang' ? BIGBANG_LOOK : ATTACKS[ATTACK_CODES[b[6]]] || ATTACKS.kamehameha;
      return { owner: G.players.find(p => p.id === b[0]), ang: b[1], len: b[2], width: b[3], t: b[4], dur: b[5], color: def.color, core: def.core };
    });
    G.novas = d.N.map(n => ({ x: n[0], y: n[1], r: n[2], maxR: n[3], color: n[4], hold: n[5] >= 0 ? n[5] : undefined, ownerId: n[6] === undefined ? -1 : n[6] }));
    G.hazards = d.Z.map(h => ({ x: h[0], y: h[1], r: h[2], t: h[3], dur: h[4], mark: !!h[5], ball: h[6] ? { x: h[6][0], y: h[6][1], r: h[6][2] } : null }));
    G.zones = (d.GZ || []).map(z => ({ x: z[0], y: z[1], r: z[2], t: z[3], dur: z[4] }));
    G.decoys = (d.DC || []).map(q => ({ x: q[0], y: q[1], t: q[2], ownerId: q[3], facing: q[4], taunt: q[5], gift: !!q[6] }));
    G.helpers = (d.HB || []).map(q => ({ x: q[0], y: q[1], facing: q[2], t: q[3], punch: q[4] ? 0.2 : 0 }));
    G.ebeams = (d.EB || []).map(b => ({ x: b[0], y: b[1], ang: b[2], len: b[3], width: b[4], t: b[5], dur: b[6], color: b[7], core: b[8], spin: b[9] || 0 }));
    G.lanes = (d.L || []).map(l => ({ x: l[0], y: l[1], dx: l[2], dy: l[3], len: l[4], w: l[5], t: l[6], dur: l[7] }));
    G.breakProps = (d.BP || []).map(b => ({ id: b[0], type: BREAK_PROP_TYPES[b[1]] || BREAK_PROP_TYPES[0], x: b[2], y: b[3], hp: b[4], maxHp: 100, hit: new Set(), flash: b[5] ? 0.1 : 0 }));

    for (const ev of d.ev) {
      if (ev[0] === 't') localText(ev[1], ev[2], ev[3], ev[4], ev[5] === 2 ? 2 : !!ev[5], ev[6] || null);   // 2: crítico
      else if (ev[0] === 'b') localBurst(ev[1], ev[2], ev[3], ev[4], ev[5], ev[6]);
      else if (ev[0] === 'r') G.fx.push({ type: 'ring', x: ev[1], y: ev[2], r: ev[3], t: ev[4], dur: ev[4], color: ev[5] });
      else if (ev[0] === 'p') G.fx.push({ type: 'poof', x: ev[1], y: ev[2], t: 0.5, dur: 0.5 });   // se abrió una cápsula
      else if (ev[0] === 'f') G.blind = Math.max(G.blind || 0, ev[1]);   // Taiyoken de Cell
      else if (ev[0] === 'w' && G.me && ev[1] === G.me.id) { G.me.x = ev[2]; G.me.y = ev[3]; }   // Ginyu te cambió de lugar
      else if (ev[0] === 's') SFX.play(ev[1], ev[2]);
      else if (ev[0] === 'x') localAnim(ev[1], ev[2], ev[3], ev[4]);   // efecto de técnica (impacto, explosión, onda)
      else if (ev[0] === 'k') bossDefeated(ev[1], ev[2]);   // un jefe cayó (desbloqueos y logros)
      else if (ev[0] === 'a' && G.me && ev[1] === G.me.id) localAchEvent(ev[2]);   // evento de logro para mí
    }
  }

  function clientUpdate(dt) {
    const k = dt * 60, a = Math.min(1, dt * 14);
    moveLocal(dt);
    for (const P of G.players) {
      if (P !== G.me && P.tx !== undefined) { P.x += (P.tx - P.x) * a; P.y += (P.ty - P.y) * a; }
      P.orbitAng += dt;
      if (P.castT > 0) P.castT -= dt;
      if (P.punchT > 0) P.punchT -= dt;
      if (P.inv > 0) P.inv -= dt;
      if (P.stone > 0) P.stone -= dt;
      if (P.candy > 0) P.candy -= dt;
      if (P.swapBody > 0) P.swapBody -= dt;
      if (P.invert > 0) P.invert -= dt;
    }
    for (const e of G.enemies) {
      if (e.tx !== undefined) { e.x += (e.tx - e.x) * a; e.y += (e.ty - e.y) * a; }
      if (e.flash > 0) e.flash -= dt;
    }
    for (const p of G.projs) { p.x += p.vx * k; p.y += p.vy * k; p.spin += dt * 20; }
    for (const s of G.shots) { s.x += s.vx * k; s.y += s.vy * k; }
    for (const b of G.beams) b.t -= dt;
    for (const b of G.ebeams || []) { b.t -= dt; b.ang += b.spin * dt; }
    for (const z of G.zones || []) z.t -= dt;
    if (G.blind > 0) G.blind -= dt;
    for (const n of G.novas) { if (n.hold !== undefined) n.hold = Math.max(0, n.hold - dt); else n.r = Math.min(n.maxR, n.r + (n.maxR / 0.3) * dt); }
    for (const h of G.hazards) h.t -= dt;
    tickLanes(dt);
    tickFx(dt, k);

    // El anfitrión dejó de mandar el estado: la conexión se cayó sin avisar
    if (inGame && lastSnap && performance.now() - lastSnap > HOST_TIMEOUT) { if (!netInfo.err) netInfo.err = 'timeout'; hostLost(); return; }
    pingAcc += dt * 1000;
    if (pingAcc >= PING_RATE && hostConn && hostConn.open) { pingAcc = 0; hostConn.send({ t: 'ping', ts: performance.now() }); }
    posAcc += dt;
    if (posAcc >= POS_RATE && hostConn && hostConn.open) {
      posAcc = 0;
      const M = G.me;
      const aim = manualAim();   // apuntado manual (null = automático)
      hostConn.send({ t: 'pos', x: Math.round(M.x * 10) / 10, y: Math.round(M.y * 10) / 10, f: M.facing, m: M.moving ? 1 : 0, v: DIR_CODES.indexOf(M.dir || 'side'),
        a: aim === null ? undefined : Math.round(aim * 100) / 100 });
    }
  }

  function send(msg) { if (hostConn && hostConn.open) hostConn.send(msg); }

  function init() {
    $('btnHost').onclick = () => { SFX.unlock(); host(); };
    $('btnJoin').onclick = () => { SFX.unlock(); join($('codeInput').value); };
    $('codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('btnJoin').click(); });
    $('btnStart').onclick = start;
    $('btnLeave').onclick = leave;
    $('btnCopy').onclick = async () => {
      const url = `${location.origin}${location.pathname}?sala=${code}`;
      try { await navigator.clipboard.writeText(url); $('btnCopy').textContent = t('¡Enlace copiado!'); }
      catch (e) { prompt(t('Copia este enlace:'), url); }
      setTimeout(() => { $('btnCopy').textContent = t('Copiar enlace'); }, 1500);
    };
    // Enlace de invitación: ?sala=CODIGO
    const invited = new URLSearchParams(location.search).get('sala');
    if (invited) {
      $('codeInput').value = invited.toUpperCase();
      setMsg(t('Te invitaron a la sala {code}. Elige tu guerrero y pulsa «Unirse».', { code: invited.toUpperCase() }));
    }
  }

  return {
    get lag() { return role === 'client' && inGame && lastSnap ? performance.now() - lastSnap : 0; },
    // Indicador de conexión: ping real (ida y vuelta), directo/por intermediario y cuántos jugadores
    // llegaron. En el anfitrión, el ping mostrado es el peor de todos los invitados conectados.
    get ping() { return role === 'client' ? myRtt : (hostRtt.size ? Math.max(...hostRtt.values()) : -1); },
    get path() { return netInfo.path; },
    get peerCount() { return role === 'host' ? conns.size : (hostConn && hostConn.open ? 1 : 0); },
    get reconnecting() { return reconnectState; },
    init, send, hostTick, clientUpdate, gameOver, leave, backToLobby, changeChar, speedChanged, levelChanged, get role() { return role; },
  };
})();
