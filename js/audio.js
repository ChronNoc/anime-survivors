'use strict';
// ─── Audio sintetizado con Web Audio: efectos y música chiptune (sin archivos) ───

// Volumen de la música y de los efectos (0 a 1), elegido en la pausa y guardado en el navegador
const AudioVolume = (() => {
  const KEY = 'dbzsurvivor.volume';
  let v = { music: 1, sfx: 1 };
  try { v = { ...v, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { /* sin almacenamiento */ }
  const clamp = x => Math.max(0, Math.min(1, +x || 0));
  return {
    get music() { return clamp(v.music); },
    get sfx() { return clamp(v.sfx); },
    set(kind, value) {
      v[kind] = clamp(value);
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ }
    },
  };
})();

const AudioCore = (() => {
  let ac = null, master = null, sfxBus = null;
  return {
    get ctx() { return ac; },
    get master() { return master; },
    get sfxBus() { return sfxBus; },
    ensure() {
      if (ac) return true;
      try {
        ac = new (window.AudioContext || window.webkitAudioContext)();
        master = ac.createGain(); master.gain.value = 0.25; master.connect(ac.destination);
        sfxBus = ac.createGain(); sfxBus.gain.value = AudioVolume.sfx; sfxBus.connect(master);
      } catch (e) { return false; }
      return true;
    },
    running() { return !!ac && ac.state === 'running'; },
    noiseBuffer(dur) {
      const len = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    },
  };
})();

// ─── Efectos de sonido ────────────────────────────────────────────────────────
const SFX = (() => {
  const last = {}, KEY = 'dbzsurvivor.sfx';
  let enabled = true;   // se puede silenciar aparte de la música (botón 🔊 o tecla B)
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* sin almacenamiento */ }
  function tone(freq, dur, type = 'square', vol = 0.3, slide = 0) {
    const ac = AudioCore.ctx, t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(AudioCore.sfxBus); o.start(t); o.stop(t + dur);
  }
  function noise(dur, vol = 0.3) {
    const ac = AudioCore.ctx, t = ac.currentTime, len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf; g.gain.value = vol; src.connect(g); g.connect(AudioCore.sfxBus); src.start(t);
  }
  // Plucked electric bass: a filtered sawtooth (the string) + a sub-octave sine (body/weight), with a
  // fast pluck attack and a lowpass sweep that darkens quickly - that filter sweep is what reads as a
  // real plucked string rather than a synth blip. A tiny pick-noise click adds the finger/pick attack.
  function pluck(freq, dur = 0.38, vol = 0.34) {
    const ac = AudioCore.ctx, t = ac.currentTime;
    const o = ac.createOscillator(), sub = ac.createOscillator();
    const filt = ac.createBiquadFilter(), g = ac.createGain(), subG = ac.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.985, t + dur);   // string settling pitch-sag
    sub.type = 'sine'; sub.frequency.setValueAtTime(freq / 2, t);
    subG.gain.value = 0.55;
    filt.type = 'lowpass'; filt.Q.value = 2.2;
    filt.frequency.setValueAtTime(freq * 16, t);
    filt.frequency.exponentialRampToValueAtTime(Math.max(90, freq * 1.6), t + dur * 0.85);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);   // snappy pluck attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(filt); sub.connect(subG); subG.connect(filt); filt.connect(g); g.connect(AudioCore.sfxBus);
    o.start(t); o.stop(t + dur); sub.start(t); sub.stop(t + dur);
    noise(0.02, 0.035);   // brief pick/finger click at the attack
  }
  const sounds = {
    shot:    () => tone(880, 0.08, 'square', 0.08, 0.5),
    beam:    () => { tone(220, 0.5, 'sawtooth', 0.12, 2.5); noise(0.4, 0.08); },
    hit:     () => tone(180, 0.05, 'square', 0.07, 0.6),
    boom:    () => { noise(0.35, 0.3); tone(90, 0.3, 'sine', 0.3, 0.4); },
    pickup:  () => tone(1300, 0.05, 'sine', 0.07, 1.4),
    levelup: () => { tone(523, 0.12, 'square', 0.15); setTimeout(() => tone(784, 0.2, 'square', 0.15), 110); },
    hurt:    () => tone(140, 0.18, 'sawtooth', 0.2, 0.5),
    power:   () => { tone(110, 1.2, 'sawtooth', 0.2, 6); noise(1.0, 0.15); },
    boss:    () => { tone(70, 0.9, 'sawtooth', 0.25, 0.8); setTimeout(() => tone(60, 0.9, 'sawtooth', 0.25, 0.8), 450); },
    ball:    () => { tone(660, 0.1, 'triangle', 0.2); setTimeout(() => tone(990, 0.25, 'triangle', 0.2), 90); },
    // Taira: un bajo eléctrico pulsado de verdad (ver pluck() arriba) - una nota de un pequeño
    // riff (E1/A1/D2/G2, las cuerdas al aire de un bajo de 4 cuerdas) para que no suene siempre igual.
    bass:    () => pluck([41.2, 55, 73.4, 98][Math.floor(Math.random() * 4)]),
  };
  return {
    unlock() {
      if (AudioCore.ensure() && AudioCore.ctx.state === 'suspended') AudioCore.ctx.resume();
    },
    get enabled() { return enabled; },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* sin almacenamiento */ }
      return enabled;
    },
    setVolume(v) {
      AudioVolume.set('sfx', v);
      if (AudioCore.sfxBus) AudioCore.sfxBus.gain.setTargetAtTime(AudioVolume.sfx, AudioCore.ctx.currentTime, 0.03);
    },
    play(name, minGap = 0.04) {
      if (!enabled || !AudioCore.running() || !sounds[name]) return;
      const now = AudioCore.ctx.currentTime;
      if (last[name] && now - last[name] < minGap) return;
      last[name] = now;
      sounds[name]();
    },
  };
})();

// ─── Música ───────────────────────────────────────────────────────────────────
// Cada tema: tempo, un acorde por compás, melodía en semicorcheas ('.' prolonga la
// nota anterior, '-' es silencio), patrón de bajo y batería. El arpegio y el bajo
// se generan a partir de los acordes.
const MUSIC_TRACKS = {
  menu: {
    bpm: 112, chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'],
    lead: `E5 . . . G5 . . . C6 . . . B5 . G5 . | A5 . . . . . E5 . . . C5 . . . E5 . |
           F5 . . . A5 . . . C6 . . . A5 . F5 . | G5 . . . . . D5 . . . B4 . D5 . G5 . |
           E5 . G5 . C6 . . . D6 . C6 . B5 . G5 . | A5 . . . C6 . . . E6 . . . D6 . C6 . |
           A5 . . . F5 . . . A5 . C6 . F6 . E6 . | D6 . . . . . . . B5 . . . G5 . . .`,
    bass: 'r . . . . . . . R . . . . . . .', drums: 'k---h---s---h-h-', fill: 'k---h---s-h-s-ss', leadVol: 0.05, arpVol: 0.018,
  },
  battle: {
    bpm: 150, chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'G', 'E'],
    lead: `A4 . . . C5 . E5 . . . D5 . C5 . B4 . | C5 . . . A4 . . . F4 . A4 . C5 . . . |
           B4 . . . D5 . G5 . . . F5 . E5 . D5 . | E5 . . . . . . . G#4 . B4 . E5 . . . |
           E5 . A5 . . . G5 . E5 . . . C5 . D5 . | F5 . . . E5 . C5 . A4 . . . C5 . F5 . |
           G5 . . . F5 . D5 . B4 . . . D5 . G5 . | G#5 . . . E5 . . . B4 . . . E5 . . .`,
    bass: 'r . R . r . R . r . R . r . R .', drums: 'k-h-s-h-k-k-s-h-', fill: 'k-h-s-h-k-s-ssss', leadVol: 0.055, arpVol: 0.02,
  },
  boss: {
    bpm: 168, chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'C', 'A'],
    lead: `D5 . . D5 . . F5 . E5 . D5 . C#5 . D5 . | F5 . . . D5 . . . Bb4 . . . D5 . F5 . |
           G5 . . G5 . . E5 . C5 . . . E5 . G5 . | A5 . . . . . . . C#5 . E5 . A5 . . . |
           D6 . . . A5 . . . F5 . A5 . D6 . C6 . | Bb5 . . . F5 . . . D5 . F5 . Bb5 . A5 . |
           G5 . . . E5 . G5 . C6 . . . Bb5 . G5 . | A5 . . . G5 . F5 . E5 . . . C#5 . . .`,
    bass: 'r r R r r r R r r r R r r r R r', drums: 'k-hks-hkk-hks-hk', fill: 'k-hks-hks-s-ssss', leadVol: 0.055, arpVol: 0.02,
  },
  // Un tema de batalla por escenario (2.22.0); el Nivel 1 usa "battle" y los jefes, "boss"
  namek: {   // Namek: misterioso, en Mi menor
    bpm: 140, chords: ['Em', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'],
    lead: `E5 . . . G5 . B5 . . . A5 . G5 . F#5 . | E5 . . . . . C5 . . . E5 . G5 . . . |
           F#5 . . . A5 . . . D6 . . . C6 . A5 . | B5 . . . . . . . D#5 . F#5 . B5 . . . |
           G5 . E5 . B4 . E5 . G5 . B5 . E6 . . . | C6 . . . B5 . G5 . E5 . . . G5 . C6 . |
           A5 . . . F#5 . D5 . F#5 . A5 . D6 . C6 . | B5 . . . . . . . F#5 . . . D#5 . . .`,
    bass: 'r . . . r . R . r . . . r . R .', drums: 'k---h-s-k-h-s-h-', fill: 'k---h-s-k-s-s-ss', leadVol: 0.05, arpVol: 0.018,
  },
  cell: {   // Cell: tenso, en Do menor
    bpm: 158, chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Bb', 'G'],
    lead: `C5 . . C5 . . Eb5 . G5 . . . F5 . Eb5 . | Ab5 . . . G5 . . . Eb5 . . . C5 . Eb5 . |
           D5 . . D5 . . F5 . Bb5 . . . Ab5 . G5 . | G5 . . . . . . . B4 . D5 . G5 . . . |
           G5 . . . C6 . . . Bb5 . Ab5 . G5 . Eb5 . | F5 . . . Eb5 . C5 . Ab4 . . . C5 . Eb5 . |
           F5 . . . D5 . Bb4 . D5 . F5 . Bb5 . Ab5 . | G5 . . . . . . . D5 . . . B4 . . .`,
    bass: 'r . r R r . r R r . r R r . r R', drums: 'k-h-s-hkk-h-s-h-', fill: 'k-h-s-hks-s-ssss', leadVol: 0.055, arpVol: 0.02,
  },
  buu: {   // Buu: juguetón, en Fa mayor
    bpm: 146, chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C'],
    lead: `F5 . A5 . C6 . A5 . F5 . . . C5 . F5 . | D5 . F5 . A5 . . . G5 . F5 . E5 . D5 . |
           Bb4 . D5 . F5 . Bb5 . A5 . . . G5 . F5 . | E5 . . . G5 . . . C6 . . . . . . . |
           A5 . . A5 . . G5 . F5 . . . A5 . C6 . | D6 . . . C6 . A5 . F5 . . . A5 . D6 . |
           D6 . C6 . Bb5 . A5 . G5 . F5 . E5 . D5 . | C5 . . . E5 . G5 . C6 . . . . . . .`,
    bass: 'r . R . r . R . r . R . r . R .', drums: 'k-h-s-h-k-hks-h-', fill: 'k-h-s-h-k-s-sss-', leadVol: 0.055, arpVol: 0.02,
  },
  kaio: {   // Nivel 5: épico, en Sol menor
    bpm: 160, chords: ['Gm', 'Eb', 'F', 'D', 'Gm', 'Eb', 'F', 'D'],
    lead: `G4 . . . Bb4 . D5 . . . G5 . . . F5 . | Eb5 . . . D5 . Bb4 . . . G4 . Bb4 . Eb5 . |
           F5 . . . A5 . C6 . . . A5 . F5 . A5 . | D5 . . . . . . . F#5 . A5 . D6 . . . |
           D6 . . . Bb5 . G5 . . . D5 . G5 . Bb5 . | G5 . . . Eb5 . Bb4 . Eb5 . G5 . Bb5 . G5 . |
           A5 . . . C6 . A5 . F5 . . . C5 . F5 . | F#5 . . . . . . . A5 . . . D6 . . .`,
    bass: 'r r R r r r R r r r R r r r R r', drums: 'k-hks-h-k-hks-hk', fill: 'k-hks-hks-s-ssss', leadVol: 0.055, arpVol: 0.02,
  },
  snake: {   // Camino de la Serpiente: aventurero, en Sol mayor
    bpm: 128, chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'],
    lead: `D5 . G5 . . . B5 . . . A5 . G5 . . . | E5 . . . G5 . B5 . . . G5 . E5 . . . |
           C5 . E5 . G5 . . . C6 . . . B5 . A5 . | A5 . . . . . . . F#5 . . . D5 . . . |
           G5 . . . B5 . D6 . . . B5 . G5 . . . | B5 . . . G5 . E5 . . . G5 . B5 . . . |
           C6 . . . G5 . E5 . G5 . C6 . E6 . D6 . | D6 . . . . . . . A5 . . . F#5 . . .`,
    bass: 'r . . . R . . . r . . . R . . .', drums: 'k---h---s---h---', fill: 'k---h---s---s-s-', leadVol: 0.05, arpVol: 0.016,
  },
};
const CHORD_TONES = {
  C: ['C4', 'E4', 'G4'], Am: ['A4', 'C5', 'E5'], F: ['F4', 'A4', 'C5'], G: ['G4', 'B4', 'D5'], E: ['E4', 'G#4', 'B4'],
  Dm: ['D4', 'F4', 'A4'], Bb: ['Bb3', 'D4', 'F4'], A: ['A3', 'C#4', 'E4'],
  Em: ['E4', 'G4', 'B4'], D: ['D4', 'F#4', 'A4'], B: ['B3', 'D#4', 'F#4'], Cm: ['C4', 'Eb4', 'G4'], Ab: ['Ab3', 'C4', 'Eb4'],
  Gm: ['G4', 'Bb4', 'D5'], Eb: ['Eb4', 'G4', 'Bb4'],
};

const Music = (() => {
  const KEY = 'dbzsurvivor.music', MUSIC_GAIN = 0.55;   // volumen de la música al 100%
  let enabled = true, bus = null, current = null, wanted = null, step = 0, nextTime = 0, timer = null, pulse = null;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* sin almacenamiento */ }

  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name);
    if (!m) return 0;
    const midi = 12 * (+m[3] + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  // Convierte una secuencia de tokens en eventos { step, len, f }
  function parse(seq) {
    const toks = seq.replace(/\|/g, ' ').trim().split(/\s+/), ev = [];
    toks.forEach((tk, i) => {
      if (tk === '.' || tk === '-') { return; }
      let len = 1;
      while (toks[i + len] === '.') len++;
      ev.push({ step: i, len, f: freq(tk) });
    });
    return { ev, steps: toks.length };
  }
  // Pre-calcula todos los eventos de un tema, indexados por paso
  const compiled = {};
  function compile(name) {
    if (compiled[name]) return compiled[name];
    const T = MUSIC_TRACKS[name], steps = T.chords.length * 16, at = Array.from({ length: steps }, () => []);
    for (const e of parse(T.lead).ev) at[e.step % steps].push({ v: 'lead', len: e.len, f: e.f });
    const bassTok = T.bass.split(/\s+/);
    T.chords.forEach((ch, bar) => {
      const root = CHORD_TONES[ch][0].replace(/\d$/, ''), low = freq(root + '2'), high = low * 2;
      bassTok.forEach((tk, i) => {
        if (tk !== 'r' && tk !== 'R') return;
        let len = 1;
        while (bassTok[i + len] === '.') len++;
        at[bar * 16 + i].push({ v: 'bass', len, f: tk === 'r' ? low : high });
      });
      const tones = CHORD_TONES[ch].map(freq), order = [0, 1, 2, 1];
      for (let i = 0; i < 16; i++) at[bar * 16 + i].push({ v: 'arp', len: 1, f: tones[order[i % 4]] * (i >= 8 ? 2 : 1) });
      const dr = bar === T.chords.length - 1 ? T.fill : T.drums;
      for (let i = 0; i < 16; i++) if (dr[i] !== '-') at[bar * 16 + i].push({ v: dr[i] });
    });
    return (compiled[name] = { T, at, steps });
  }

  function pulseWave(ac) { // onda de pulso al 25%, más "8 bits" que la cuadrada
    if (pulse) return pulse;
    const n = 32, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    return (pulse = ac.createPeriodicWave(re, im));
  }
  function playNote(ac, t, dur, f, type, vol, wave) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (wave) o.setPeriodicWave(wave); else o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setValueAtTime(vol * 0.75, t + Math.min(dur * 0.4, 0.08));
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function playDrum(ac, t, kind) {
    if (kind === 'k') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.16);
      return;
    }
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), dur = kind === 's' ? 0.13 : 0.035;
    src.buffer = AudioCore.noiseBuffer(dur);
    f.type = 'highpass'; f.frequency.value = kind === 's' ? 1200 : 7000;
    g.gain.setValueAtTime(kind === 's' ? 0.16 : 0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus); src.start(t);
  }

  function schedule() {
    const ac = AudioCore.ctx;
    if (!current || !AudioCore.running()) return;
    if (document.hidden) { nextTime = ac.currentTime + 0.05; return; }
    const { T, at, steps } = current, sd = 60 / T.bpm / 4;
    if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05;
    while (nextTime < ac.currentTime + 0.15) {
      for (const e of at[step]) {
        if (e.v === 'lead') playNote(ac, nextTime, e.len * sd * 0.95, e.f, 'square', T.leadVol, pulseWave(ac));
        else if (e.v === 'arp') playNote(ac, nextTime, sd * 0.6, e.f, 'square', T.arpVol);
        else if (e.v === 'bass') playNote(ac, nextTime, e.len * sd * 0.9, e.f, 'triangle', 0.16);
        else playDrum(ac, nextTime, e.v);
      }
      step = (step + 1) % steps;
      nextTime += sd;
    }
  }
  function ensureBus() {
    if (bus || !AudioCore.ensure()) return !!bus;
    bus = AudioCore.ctx.createGain();
    bus.gain.value = enabled ? MUSIC_GAIN * AudioVolume.music : 0;
    bus.connect(AudioCore.master);
    timer = setInterval(schedule, 25);
    return true;
  }
  function start(name) {
    current = compile(name);
    step = 0;
    nextTime = AudioCore.ctx.currentTime + 0.1;
  }

  return {
    // Se llama cada fotograma con el tema que corresponde; cambia solo si es distinto
    want(name) {
      if (name === wanted) return;
      wanted = name;
      if (!ensureBus()) return;
      if (!name) { current = null; return; }
      if (enabled) start(name);
    },
    get enabled() { return enabled; },
    setVolume(v) {
      AudioVolume.set('music', v);
      if (bus && enabled) bus.gain.setTargetAtTime(MUSIC_GAIN * AudioVolume.music, AudioCore.ctx.currentTime, 0.05);
    },
    toggle() {
      enabled = !enabled;
      try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) { /* sin almacenamiento */ }
      if (!ensureBus()) return enabled;
      const t = AudioCore.ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(enabled ? MUSIC_GAIN * AudioVolume.music : 0, t, 0.05);
      if (enabled && wanted) start(wanted); else if (!enabled) current = null;
      return enabled;
    },
  };
})();
