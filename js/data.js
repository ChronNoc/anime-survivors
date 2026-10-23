'use strict';

// Versión del juego y autoría (se muestran en el menú y en Créditos)
// Versionado semántico: MAYOR.MENOR.PARCHE (ver CHANGELOG.md)
const GAME_VERSION = '2.24.0';
const AUTHOR = { name: "Nicolas Villacorta", url: 'https://github.com/nicolasvillacorta' };
// ─── Datos del juego: personajes, técnicas, mejoras, enemigos y jefes ───────────
// Las velocidades están en píxeles por frame a 60 fps; los tiempos, en segundos.

const CHARACTERS = {
  goku: {
    name: 'Goku', title: 'El Saiyajin criado en la Tierra',
    look: { style: 'goku', hair: '#16161c', skin: '#f7c9a0', top: '#ff7b1c', pants: '#ff7b1c', shirt: '#2546c9',
      belt: '#2546c9', boots: '#2546c9', wrist: '#2546c9' },
    ssjHair: '#ffd93b', aura: '#ffe14d', transform: 'Super Saiyajin',
    hp: 100, speed: 2.6, start: 'kamehameha', perk: 'Equilibrado: +10% velocidad de recarga',
    cdBonus: 0.1,
  },
  vegeta: {
    name: 'Vegeta', title: 'El orgulloso Príncipe de los Saiyajin',
    look: { style: 'vegeta', hair: '#16161c', skin: '#f3c296', top: '#2c3fbf', pants: '#2c3fbf', armor: true,
      plate: '#f4f2ea', pad: '#e7c35a', boots: '#f4f4f4', wrist: '#f4f4f4', sleeve: '#2c3fbf' },
    ssjHair: '#ffd93b', aura: '#ffe14d', transform: 'Super Saiyajin',
    hp: 95, speed: 2.75, start: 'galick', perk: 'Orgullo: +15% de daño',
    dmgBonus: 0.15,
  },
  piccolo: {
    name: 'Piccolo', title: 'El guerrero namekiano',
    look: { style: 'piccolo', skin: '#6cc24a', top: '#4b2a7a', pants: '#4b2a7a', belt: '#3b8fd8', boots: '#8b5a2b',
      cape: '#f2f2f2', wrist: '#c0392b' },
    ssjHair: null, transformSprite: true, aura: '#b4ff8a', transform: 'Fusión con Kami',   // transformado: sin capa ni turbante
    hp: 125, speed: 2.45, start: 'makanko', perk: 'Regeneración: recupera salud con el tiempo',
    regen: 0.7,
  },
  gohan: {
    name: 'Gohan', title: 'El poder oculto del hijo de Goku',
    look: { style: 'gohan', hair: '#16161c', skin: '#f7c9a0', top: '#4b2a7a', pants: '#4b2a7a', belt: '#e23b3b',
      boots: '#8b5a2b', wrist: '#e23b3b' },
    ssjHair: '#ffe45c', aura: '#fff07a', transform: 'Super Saiyajin 2',
    hp: 90, speed: 2.7, start: 'masenko', perk: 'Ira oculta: la transformación es un 50% más poderosa',
    transformBonus: 0.5,
  },
  krilin: {
    name: 'Krilin', title: 'El humano más fuerte de la Tierra',
    look: { style: 'krilin', skin: '#f7c9a0', top: '#ff7b1c', pants: '#ff7b1c', shirt: '#2546c9', belt: '#2546c9',
      boots: '#2546c9', wrist: '#2546c9' },
    ssjHair: null, aura: '#ffffff', transform: 'Potencial liberado',
    hp: 85, speed: 2.9, start: 'kienzan', perk: 'Ingenio: +20% de experiencia',
    xpBonus: 0.2,
  },
  // ─── Personajes desbloqueables (unlock: cómo se consiguen) ───
  goten: {
    name: 'Goten', title: 'El hijo menor de Goku',
    look: { style: 'goku', hair: '#16161c', skin: '#f7c9a0', top: '#ff7b1c', pants: '#ff7b1c', shirt: '#2546c9',
      belt: '#2546c9', boots: '#2546c9', wrist: '#2546c9' },
    ssjHair: '#ffd93b', aura: '#ffe14d', transform: 'Super Saiyajin',
    hp: 85, speed: 2.85, start: 'gotenfist', perk: 'Energía infantil: el Ki se carga un 50% más rápido',
    kiBonus: 0.5,
    unlock: { kind: 'zeni', cost: 1500, text: 'Cómpralo con Zeni' },
  },
  trunks: {
    name: 'Trunks', title: 'El hijo del Príncipe de los Saiyajin',
    look: { style: 'vegeta', hair: '#b88ad8', skin: '#f3c296', top: '#2a2a33', pants: '#2a2a33', boots: '#c98a2a',
      wrist: '#c98a2a', sleeve: '#2a2a33' },
    ssjHair: '#ffd93b', aura: '#ffe14d', transform: 'Super Saiyajin',
    hp: 90, speed: 2.85, start: 'buster', perk: 'Prodigio: la transformación dura un 50% más',
    transformTime: 0.5,
    unlock: { kind: 'vegetaKills', goal: 1000, text: 'Derrota 1000 enemigos jugando con Vegeta' },
  },
  ftrunks: {
    name: 'Trunks del Futuro', title: 'El guerrero que viajó en el tiempo',
    look: { style: 'gohan', hair: '#b88ad8', skin: '#f3c296', top: '#3a2a8c', pants: '#8a8a94', belt: '#c98a2a',
      boots: '#c98a2a', wrist: '#c98a2a' },
    ssjHair: '#ffd93b', aura: '#ffe14d', transform: 'Super Saiyajin',
    hp: 105, speed: 2.7, start: 'burning', perk: 'Guerrero del futuro: +25% de daño a los jefes',
    bossBonus: 0.25,
    unlock: { kind: 'boss', boss: 'cell', text: 'Derrota a Cell' },
  },
  // Mr. Satán (2.20.0): malísimo peleando, pero con suerte, fama y amigos que hacen el trabajo por él
  //   dodge: parte de los golpes que "fallan solos" · zeniBonus: más Zeni · buddy: su "transformación" llama
  //   a Majin Buu · credit: se lleva el crédito de los jefes que caen cerca · flee: corre más con poca vida ·
  //   pose: al subir de nivel posa y los enemigos se quedan mirándolo
  hercule: {
    name: 'Mr. Satán', title: 'El campeón mundial de artes marciales',
    look: { style: 'goku', hair: '#16161c', skin: '#c98a5a', top: '#f4f4f4', pants: '#f4f4f4', shirt: '#f4f4f4',
      belt: '#e23b3b', boots: '#8b5a2b', wrist: '#e23b3b' },
    ssjHair: null, aura: '#ffd93b', transform: '¡Amigo Buu!',
    hp: 140, speed: 2.6, start: 'megaton', perk: 'Suerte del campeón: 1 de cada 4 golpes falla solo, y gana un 50% más de Zeni',
    dodge: 0.25, zeniBonus: 0.5, kiBonus: -0.65, noKi: true, noPassives: ['instinct'], buddy: true,   // el Ki le carga muy lento: Buu vale la espera
    credit: true, flee: true, pose: true,
    unlock: { kind: 'quickLoss', goal: 3, text: 'Pierde 3 partidas en el primer minuto (abandonar no cuenta)' },
  },
};

// type: projectile | beam | orbit | nova
// users: personajes que pueden aprenderla (técnicas propias de cada uno, fieles a la serie);
// sin users, cualquiera puede aprenderla
const ATTACKS = {
  kiblast: {
    name: 'Ráfaga de Ki', color: '#8fe3ff', type: 'projectile', kind: 'ball',
    desc: 'Dispara esferas de ki al enemigo más cercano.',
    stats: l => ({ cd: 1.0 - l * 0.08, dmg: 9 + l * 4, count: 1 + Math.floor(l / 2), speed: 7.5, r: 5,
      pierce: l >= 5 ? 1 : 0, life: 1.3, spread: 0.18 }),
  },
  kamehameha: {
    name: 'Kamehameha', color: '#5fd0ff', core: '#effcff', type: 'beam', users: ['goku', 'gohan', 'krilin', 'goten'],
    desc: 'Un rayo de energía que atraviesa a todos los enemigos en línea.',
    stats: l => ({ cd: 3.4 - l * 0.22, dmg: 7 + l * 3, len: 240 + l * 35, width: 16 + l * 4, dur: 0.6 + l * 0.06 }),
  },
  galick: {
    name: 'Galick Ho', color: '#c46bff', core: '#f6e8ff', type: 'beam', users: ['vegeta', 'trunks'],
    desc: 'Un rayo de energía violeta. Más corto que el Kamehameha pero más dañino.',
    stats: l => ({ cd: 3.2 - l * 0.22, dmg: 9 + l * 4, len: 200 + l * 30, width: 18 + l * 4, dur: 0.55 + l * 0.05 }),
  },
  masenko: {
    name: 'Masenko', color: '#ffe45c', core: '#fffbe0', type: 'beam', users: ['gohan', 'piccolo', 'ftrunks'],
    desc: 'Rayo dorado lanzado sobre la cabeza. Muy ancho.',
    stats: l => ({ cd: 3.0 - l * 0.2, dmg: 6 + l * 3, len: 190 + l * 25, width: 26 + l * 6, dur: 0.5 + l * 0.05 }),
  },
  makanko: {
    name: 'Makankosappo', color: '#ffef7a', type: 'projectile', kind: 'spiral', users: ['piccolo'],
    desc: 'Rayo perforante en espiral, rapidísimo. Atraviesa todo.',
    stats: l => ({ cd: 2.3 - l * 0.15, dmg: 28 + l * 12, count: 1 + Math.floor((l - 1) / 2), speed: 15, r: 5,
      pierce: 99, life: 0.9, spread: 0.12 }),
  },
  hellzone: {
    name: 'Hellzone Grenade', color: '#ffef7a', type: 'projectile', kind: 'ball', users: ['piccolo'], ring: true,
    desc: 'Makosen: esferas de energía rodean al enemigo y se cierran sobre él. Más esferas a más nivel.',
    stats: l => ({ cd: 3.2 - l * 0.2, dmg: 18 + l * 7, count: 4 + l, speed: 3.6, r: 5, pierce: 99, ringR: 90 + l * 4, spread: 0 }),
  },
  kienzan: {
    name: 'Kienzan', color: '#ffd84a', type: 'projectile', kind: 'disc', users: ['krilin'],
    desc: 'Disco de energía cortante que atraviesa a los enemigos.',
    stats: l => ({ cd: 2.6 - l * 0.15, dmg: 20 + l * 9, count: 1 + (l >= 3 ? 1 : 0) + (l >= 5 ? 1 : 0), speed: 6.5,
      r: 10 + l, pierce: 99, life: 1.8, spread: 0.5 }),
  },
  orbit: {
    name: 'Esferas de Ki', color: '#7dffb0', type: 'orbit',
    desc: 'Esferas de energía giran a tu alrededor y golpean a quien se acerque.',
    stats: l => ({ count: 1 + l, dmg: 7 + l * 3, radius: 52 + l * 5, r: 7, spin: 2.8 + l * 0.2 }),
  },
  wave: {
    name: 'Onda Explosiva', color: '#ff9b5c', type: 'nova',
    desc: 'Liberas tu ki de golpe y empujas a todos los enemigos cercanos.',
    stats: l => ({ cd: 4.2 - l * 0.3, dmg: 14 + l * 8, radius: 85 + l * 15 }),
  },
  genkidama: {
    name: 'Genkidama', color: '#a6e9ff', type: 'projectile', kind: 'big', users: ['goku'],
    desc: 'Una enorme esfera de energía lenta que estalla al impactar.',
    stats: l => ({ cd: 6.5 - l * 0.45, dmg: 55 + l * 25, count: 1, speed: 2.6, r: 16 + l * 3, pierce: 0, life: 4,
      spread: 0, explode: 75 + l * 15 }),
  },
  bigbangatk: {
    name: 'Big Bang Attack', color: '#9fd8ff', type: 'projectile', kind: 'big', users: ['vegeta', 'trunks'],
    desc: 'Una esfera de energía rápida que estalla al impactar.',
    stats: l => ({ cd: 3.6 - l * 0.25, dmg: 30 + l * 14, count: 1, speed: 5.5, r: 9 + l, pierce: 0, life: 1.6,
      spread: 0, explode: 50 + l * 10 }),
  },
  burning: {
    name: 'Burning Attack', color: '#ffb84a', type: 'projectile', kind: 'big', users: ['ftrunks'],
    desc: 'La técnica de Trunks del Futuro: una ráfaga de fuego de ki que estalla al impactar.',
    stats: l => ({ cd: 2.4 - l * 0.15, dmg: 24 + l * 11, count: 1 + Math.floor(l / 3), speed: 6.5, r: 8 + l, pierce: 0, life: 1.4,
      spread: 0.25, explode: 45 + l * 9 }),
  },
  gotenfist: {
    name: 'Ráfaga de Puños', color: '#ffb84a', type: 'nova', users: ['goten'], punch: true,
    desc: 'Goten reparte una lluvia de golpes a su alrededor y empuja a los enemigos. Corto alcance, muy rápida.',
    stats: l => ({ cd: 1.1 - l * 0.06, dmg: 10 + l * 5, radius: 50 + l * 6 }),
  },
  // ─── Técnicas para todos (2.18.0) ───
  taiyoken: {
    name: 'Taiyoken', color: '#fffbe0', type: 'nova',
    desc: 'Un destello cegador: los enemigos cercanos quedan paralizados un momento (los jefes, menos).',
    stats: l => ({ cd: 7 - l * 0.5, dmg: 4 + l * 2, radius: 110 + l * 15, stun: 1.2 + l * 0.15 }),
  },
  sokidan: {
    name: 'Sokidan', color: '#7ad8ff', type: 'projectile', kind: 'ball',
    desc: 'Una bola de Ki que persigue a los enemigos y salta de uno a otro.',
    stats: l => ({ cd: 2.2 - l * 0.12, dmg: 14 + l * 6, count: 1, speed: 4.5, r: 6, pierce: 2 + l, life: 3, spread: 0, home: 4,
      bounce: 1 + Math.floor(l / 2) }),
  },
  kirain: {
    name: 'Lluvia de Ki', color: '#b48cff', type: 'rain', kind: 'ball',
    desc: 'Esferas de Ki caen del cielo sobre enemigos al azar y estallan.',
    stats: l => ({ cd: 3.2 - l * 0.2, dmg: 16 + l * 7, count: 3 + l, explode: 34 + l * 3, r: 6 }),
  },
  kigrenade: {
    name: 'Granada de Ki', color: '#ff7a3d', type: 'projectile', kind: 'big', grenade: true,
    desc: 'Lanzas una bomba de Ki: cae junto a los enemigos y al rato estalla en un área grande.',
    stats: l => ({ cd: 3.8 - l * 0.25, dmg: 30 + l * 14, count: 1, speed: 5, r: 7, spread: 0, fuse: 0.6, explode: 70 + l * 10 }),
  },
  zanzoken: {
    name: 'Zanzoken', color: '#c8e0ff', type: 'decoy',
    desc: 'Dejas una imagen residual que atrae a los enemigos y al final estalla.',
    stats: l => ({ cd: 6 - l * 0.4, dur: 2.5 + l * 0.2, count: 1, taunt: 220 + l * 20, dmg: 25 + l * 12, explode: 70 + l * 8 }),
  },
  buster: {
    name: 'Buster Cannon', color: '#ffcf5c', type: 'projectile', kind: 'big', users: ['trunks'],
    desc: 'Trunks dispara esferas de energía rápidas que estallan al impactar. Más esferas a más nivel.',
    stats: l => ({ cd: 1.6 - l * 0.1, dmg: 18 + l * 8, count: 1 + (l >= 3 ? 1 : 0) + (l >= 5 ? 1 : 0), speed: 7, r: 7 + l * 0.5,
      pierce: 0, life: 1.2, spread: 0.3, explode: 30 + l * 6 }),
  },

  // ─── Mr. Satán ───
  megaton: {
    name: 'Megaton Punch', color: '#ffd93b', type: 'nova', punch: true, megaton: true, users: ['hercule'],
    desc: 'Un puñetazo legendario... que hace 1 de daño. Aunque muy de vez en cuando sale el golpe de verdad y no queda nadie en pie.',
    stats: l => ({ cd: 1.2 - l * 0.05, dmg: 1, radius: 50, legend: 0.035 + l * 0.008, boss: 0.15 }),
  },
  dynamite: {
    name: 'Dynamite Kick', color: '#ff9b3d', type: 'nova', kick: true, users: ['hercule'],
    desc: 'Una patada voladora contra el enemigo más cercano. La mitad de las veces se tropieza y se cae de cara.',
    stats: l => ({ cd: 4 - l * 0.3, dmg: 18 + l * 9, radius: 55 + l * 5, trip: 0.5 }),
  },
  gift: {
    name: 'Bomba de regalo', color: '#ff4d6d', type: 'decoy', gift: true, users: ['hercule'],
    desc: 'Deja una caja de regalo: los enemigos se acercan curiosos... y explota. Majin Buu tampoco se la esperaba.',
    stats: l => ({ cd: 6 - l * 0.4, dur: 2.2, count: 1, taunt: 210 + l * 20, dmg: 45 + l * 20, explode: 85 + l * 10 }),
  },
  kaioken: {
    name: 'Kaioken', color: '#ff3d3d', type: 'buff', users: ['goku'], reward: 'kaioken',
    desc: 'Por unos segundos, más daño y más velocidad, a cambio de un poco de vida. Se aprende al llegar al planeta de Kaio-sama por el Camino de la Serpiente.',
    stats: l => ({ cd: 14 - l, dur: 3.5 + l * 0.5, boost: 0.3 + l * 0.08, cost: 5 }),
  },

  // ─── Evoluciones: técnica a nivel máximo + mejora de la partida (al menos nivel 1) ───
  // evolved: from = técnica de origen, needs = mejora necesaria. Tienen un solo nivel.
  kame10: {
    name: 'Kamehameha x10', color: '#5fd0ff', core: '#effcff', type: 'beam', evolved: true, from: 'kamehameha', needs: 'power',
    desc: 'El Kamehameha a diez veces su poder: un rayo enorme que barre la pantalla.',
    stats: () => ({ cd: 1.9, dmg: 34, len: 560, width: 64, dur: 1.1 }),
  },
  finalflash: {
    name: 'Final Flash', color: '#ffe45c', core: '#fffbe0', type: 'beam', evolved: true, from: 'galick', needs: 'focus',
    desc: 'La evolución del Galick Ho: un rayo gigante y devastador.',
    stats: () => ({ cd: 2.2, dmg: 42, len: 480, width: 70, dur: 1.0 }),
  },
  supermasenko: {
    name: 'Super Masenko', color: '#ffe45c', core: '#fffbe0', type: 'beam', evolved: true, from: 'masenko', needs: 'sense', both: true,
    desc: 'Un Masenko enorme que se dispara hacia adelante y hacia atrás a la vez.',
    stats: () => ({ cd: 1.9, dmg: 26, len: 360, width: 70, dur: 0.85 }),
  },
  makosen: {   // (el id se mantiene para no perder el progreso del logro de evoluciones)
    name: 'Gran Hellzone Grenade', color: '#ffef7a', type: 'projectile', kind: 'ball', evolved: true, from: 'hellzone', needs: 'power', ring: true,
    desc: 'Una lluvia de esferas rodea por completo al enemigo y se cierra sobre él sin escapatoria.',
    stats: () => ({ cd: 2.4, dmg: 60, count: 12, speed: 4, r: 6, pierce: 99, ringR: 110, spread: 0 }),
  },
  makankox: {
    name: 'Makankosappo Supremo', color: '#ffef7a', type: 'projectile', kind: 'spiral', evolved: true, from: 'makanko', needs: 'focus',
    desc: 'Tres rayos en espiral, más rápidos y destructivos, que atraviesan todo a su paso.',
    stats: () => ({ cd: 1.3, dmg: 110, count: 3, speed: 17, r: 6, pierce: 99, life: 1.1, spread: 0.14 }),
  },
  kienzanx: {
    name: 'Kienzan Múltiple', color: '#ffd84a', type: 'projectile', kind: 'disc', evolved: true, from: 'kienzan', needs: 'speed',
    desc: 'Varios discos cortantes que rebotan de enemigo en enemigo.',
    stats: () => ({ cd: 1.8, dmg: 70, count: 5, speed: 7, r: 15, pierce: 99, life: 2.4, spread: 0.6, bounce: 3 }),
  },
  genkiuniv: {
    name: 'Genkidama Universal', color: '#a6e9ff', type: 'projectile', kind: 'big', evolved: true, from: 'genkidama', needs: 'vital',
    desc: 'La energía de todo el universo: una esfera gigantesca con una explosión enorme.',
    stats: () => ({ cd: 4, dmg: 260, count: 1, speed: 2.8, r: 40, pierce: 0, life: 4.5, spread: 0, explode: 220 }),
  },
  kiburst: {
    name: 'Ráfaga Continua', color: '#8fe3ff', type: 'projectile', kind: 'ball', evolved: true, from: 'kiblast', needs: 'speed',
    desc: 'Una lluvia incesante de esferas de ki que atraviesan a los enemigos.',
    stats: () => ({ cd: 0.35, dmg: 30, count: 4, speed: 9, r: 5, pierce: 2, life: 1.3, spread: 0.12 }),
  },
  kishield: {
    name: 'Escudo de Ki', color: '#7dffb0', type: 'orbit', evolved: true, from: 'orbit', needs: 'armor', shield: true,
    desc: 'Más esferas, más grandes y rápidas, que además destruyen los disparos enemigos.',
    stats: () => ({ count: 7, dmg: 26, radius: 80, r: 9, spin: 4 }),
  },
  kiexplosion: {
    name: 'Explosión de Ki', color: '#ff9b5c', type: 'nova', evolved: true, from: 'wave', needs: 'vital',
    desc: 'Una onda enorme que arrasa con todo alrededor y te cura un poco.',
    stats: () => ({ cd: 2.4, dmg: 70, radius: 200, heal: 8 }),
  },
  gotencombo: {
    name: 'Combo Saiyajin', color: '#ffb84a', type: 'nova', evolved: true, from: 'gotenfist', needs: 'speed', punch: true,
    desc: 'Goten pelea sin parar: golpes casi continuos, con mucho más alcance y daño.',
    stats: () => ({ cd: 0.45, dmg: 40, radius: 95 }),
  },
  finishbuster: {
    name: 'Finish Buster', color: '#ffcf5c', type: 'projectile', kind: 'big', evolved: true, from: 'buster', needs: 'focus',
    desc: 'Trunks lanza tres esferas enormes que estallan en grandes explosiones.',
    stats: () => ({ cd: 1.4, dmg: 70, count: 3, speed: 7.5, r: 12, pierce: 0, life: 1.4, spread: 0.35, explode: 80 }),
  },
  heatdome: {
    name: 'Heat Dome Attack', color: '#ffd84a', core: '#fffbe0', type: 'beam', evolved: true, from: 'burning', needs: 'power',
    desc: 'Trunks del Futuro concentra todo su poder en un rayo gigantesco que arrasa con todo.',
    stats: () => ({ cd: 2.1, dmg: 40, len: 520, width: 72, dur: 1.0 }),
  },
  megatonx: {
    name: 'Megaton Punch Definitivo', color: '#ffd93b', type: 'nova', punch: true, megaton: true, evolved: true, from: 'megaton', needs: 'crit',
    desc: 'El golpe legendario sale el doble de seguido, y a los jefes les saca un cuarto de la vida. ¡¿Vieron eso?!',
    stats: () => ({ cd: 0.9, dmg: 3, radius: 60, legend: 0.15, boss: 0.25 }),   // 2.23.1: antes 8% (casi igual que el nivel 5)
  },
  dynamitex: {
    name: 'Dynamite Kick Perfecto', color: '#ff9b3d', type: 'nova', kick: true, evolved: true, from: 'dynamite', needs: 'speed',
    desc: 'Casi nunca se tropieza, y cuando acierta lo hace temblar todo.',
    stats: () => ({ cd: 2.2, dmg: 80, radius: 95, trip: 0.15 }),
  },
  giftx: {
    name: 'Lluvia de regalos', color: '#ff4d6d', type: 'decoy', gift: true, evolved: true, from: 'gift', needs: 'area',
    desc: 'Tres cajas de regalo a su alrededor, con más pólvora que nunca.',
    stats: () => ({ cd: 3.5, dur: 2.2, count: 3, taunt: 300, dmg: 150, explode: 120 }),
  },
  kaioken20: {
    name: 'Kaioken x20', color: '#ff3d3d', type: 'buff', evolved: true, from: 'kaioken', needs: 'power',
    desc: 'El Kaioken llevado al límite: el doble de poder durante más tiempo.',
    stats: () => ({ cd: 9, dur: 7, boost: 1, cost: 8 }),
  },
  taiyokenx: {
    name: 'Taiyoken Máximo', color: '#fffbe0', type: 'nova', evolved: true, from: 'taiyoken', needs: 'area',
    desc: 'Un destello enorme que paraliza durante más tiempo a todos los que alcanza, y los daña.',
    stats: () => ({ cd: 3.5, dmg: 30, radius: 200, stun: 2.5 }),
  },
  sokidanx: {
    name: 'Sokidan Múltiple', color: '#7ad8ff', type: 'projectile', kind: 'ball', evolved: true, from: 'sokidan', needs: 'focus',
    desc: 'Tres bolas de Ki que persiguen y rebotan de enemigo en enemigo sin parar.',
    stats: () => ({ cd: 1.2, dmg: 40, count: 3, speed: 5, r: 7, pierce: 6, life: 3.5, spread: 0.6, home: 5, bounce: 4 }),
  },
  kistorm: {
    name: 'Tormenta de Ki', color: '#b48cff', type: 'rain', kind: 'ball', evolved: true, from: 'kirain', needs: 'multi',
    desc: 'Una tormenta de esferas que cae sin parar sobre todos los enemigos de la pantalla.',
    stats: () => ({ cd: 1.6, dmg: 45, count: 10, explode: 52, r: 7 }),
  },
  kigrenadex: {
    name: 'Granada Saiyajin', color: '#ff7a3d', type: 'projectile', kind: 'big', grenade: true, evolved: true, from: 'kigrenade', needs: 'power',
    desc: 'Tres bombas de Ki que estallan juntas en explosiones enormes.',
    stats: () => ({ cd: 2.6, dmg: 100, count: 3, speed: 5.5, r: 9, spread: 0.5, fuse: 0.5, explode: 115 }),
  },
  zanzokenx: {
    name: 'Zanzoken Múltiple', color: '#c8e0ff', type: 'decoy', evolved: true, from: 'zanzoken', needs: 'speed',
    desc: 'Tres imágenes residuales a tu alrededor que atraen a los enemigos y estallan con fuerza.',
    stats: () => ({ cd: 3.5, dur: 3.5, count: 3, taunt: 300, dmg: 90, explode: 110 }),
  },
  finalimpact: {
    name: 'Final Impact', color: '#9fd8ff', type: 'projectile', kind: 'big', evolved: true, from: 'bigbangatk', needs: 'armor',
    desc: 'Tres Big Bang Attack a la vez, con explosiones más grandes.',
    stats: () => ({ cd: 2.6, dmg: 110, count: 3, speed: 6, r: 13, pierce: 0, life: 1.6, spread: 0.35, explode: 95 }),
  },
};
// Las evoluciones heredan quién puede aprenderlas; EVOLUTION_OF: técnica de origen → evolución
const EVOLUTION_OF = {};
for (const id in ATTACKS) {
  const a = ATTACKS[id];
  if (!a.evolved) continue;
  a.users = ATTACKS[a.from].users;
  EVOLUTION_OF[a.from] = id;
}
// (las evoluciones siguen a su técnica de origen; Mr. Satán, noKi, no aprende las técnicas de Ki de todos)
function canLearn(charId, id) {
  const a = ATTACKS[id];
  if (a.evolved && a.from) return canLearn(charId, a.from);
  if (a.users) return a.users.includes(charId);
  return !(CHARACTERS[charId] || {}).noKi;
}
// Velocidad rápida (opción del menú y de la sala): todo el juego va 1,5 veces más rápido
const FAST_SPEED = 1.5;
const MAX_ATTACK_LEVEL = 5;
// Casillas por partida: la misma cantidad de técnicas que de mejoras (cambiar acá para jugar con 4 y 4)
const MAX_ATTACKS = 5;
const MAX_PASSIVES = MAX_ATTACKS;

const PASSIVES = {
  power:    { name: 'Fuerza',            color: '#ff5c5c', desc: '+12% de daño a todas las técnicas.' },
  speed:    { name: 'Velocidad',         color: '#5cf2ff', desc: '+8% de velocidad de movimiento.' },
  vital:    { name: 'Vitalidad',         color: '#6cff7a', desc: '+20 de salud máxima y te cura 20.' },
  focus:    { name: 'Concentración',     color: '#d68cff', desc: '-8% de tiempo de recarga de técnicas.' },
  sense:    { name: 'Percepción del Ki', color: '#ffe45c', desc: 'Atraes la experiencia desde más lejos.' },
  armor:    { name: 'Armadura Saiyajin', color: '#cfcfcf', desc: 'Reduce en 1 el daño de cada golpe recibido.' },
  // 2.18.0
  crit:     { name: 'Golpe certero',      color: '#ff9b3d', desc: '+4% de probabilidad de golpe crítico (daño doble).' },
  kictl:    { name: 'Dominio del Ki',     color: '#ffb0f0', desc: 'El Ki se carga un 15% más rápido.' },
  absorb:   { name: 'Absorción',          color: '#3dffc8', desc: 'Cada enemigo derrotado tiene un 3% de probabilidad de curarte un poco.' },
  area:     { name: 'Técnica amplia',     color: '#8f9bff', desc: '+8% de tamaño y área de las técnicas.' },
  multi:    { name: 'Multiplicación',     color: '#ff6ad5', max: 1, desc: '+1 proyectil en las técnicas que disparan varios. Un solo nivel.' },
  // 2.21.0
  gravity:  { name: 'Entrenamiento en gravedad', color: '#9a7cff', desc: '+8% de experiencia ganada.' },
  instinct: { name: 'Instinto de combate', color: '#e8f2ff', desc: '3% de probabilidad de esquivar un golpe.' },
  regen:    { name: 'Regeneración namekiana', color: '#7cff9a', desc: 'Recuperas 1 de salud cada 4 segundos.' },
  aura:     { name: 'Aura de combate',     color: '#ff7a3d', desc: 'Los enemigos pegados a ti reciben daño todo el tiempo.' },
  tracker:  { name: 'Rastreador',          color: '#ff4d6d', desc: '+10% de daño a los jefes y a los enemigos de élite.' },
  sustain:  { name: 'Técnica sostenida',   color: '#5cc8ff', desc: '+10% de duración de rayos, señuelos y técnicas que duran.' },
  meditate: { name: 'Meditación',          color: '#c8a2ff', desc: 'Quieto, recuperas salud y cargas Ki.' },
  fury:     { name: 'Furia',               color: '#ff3d3d', desc: 'Más daño cuanta menos salud te queda (hasta +5%).' },
  senzubag: { name: 'Bolsa de Semillas',   color: '#9be05c', desc: 'Las Semillas del Ermitaño curan un 10% más y suben tu salud máxima.' },
  luck:     { name: 'Suerte de Mr. Satán', color: '#d8a850', desc: 'Un poco más de Semillas del Ermitaño, Cápsulas de Bulma y Zeni al terminar.' },
};
const MAX_PASSIVE_LEVEL = 5;
// Nivel máximo de cada mejora (max en PASSIVES; si no tiene, MAX_PASSIVE_LEVEL)
const passiveMax = id => (PASSIVES[id] && PASSIVES[id].max) || MAX_PASSIVE_LEVEL;

// look: configuración para drawFighter (ver draw.js)
// Mecánicas (2.10.0, ver enemyTricks en game.js): shooter + shootChance (qué parte dispara), spread (abanico de n),
// burst (ráfaga de n), lunge (embestida con aviso), stomp (pisotón: radio del círculo), ring (anillo de n cada tanto),
// deathRing (anillo de n al morir), kamikaze (explota al tocarte)
const ENEMIES = {
  saibaman: { name: 'Saibaiman', hp: 12, speed: 1.35, r: 10, dmg: 6, xp: 1, scale: 0.85,
    look: { style: 'saibaman', skin: '#5fbf3a', top: '#4ea832', pants: '#4ea832', boots: '#3c8a26', sleeve: '#4ea832' } },
  soldier: { name: 'Soldado de Freezer', hp: 26, speed: 1.0, r: 12, dmg: 8, xp: 2, scale: 1, shooter: true,
    look: { style: 'bald', skin: '#e48fb0', top: '#2a2a33', pants: '#2a2a33', armor: true, plate: '#f1efe6',
      pad: '#c9a64a', boots: '#f1efe6', wrist: '#f1efe6', scouter: true } },
  celljr: { name: 'Cell Jr.', hp: 30, speed: 2.05, r: 9, dmg: 9, xp: 3, scale: 0.8, shooter: true, shootChance: 0.4, spread: 2,
    look: { style: 'celljr', skin: '#7fd0f0', top: '#3e9a4a', pants: '#3e9a4a', boots: '#1e1e1e', sleeve: '#3e9a4a', spots: true } },
  // Animales del Nivel 1 (sprites de Legacy of Goku / Legacy of Goku II; el look solo es el respaldo dibujado)
  wolf: { name: 'Lobo', hp: 10, speed: 1.75, r: 9, dmg: 5, xp: 1, scale: 0.9,
    look: { style: 'bald', skin: '#8a8fb0', top: '#8a8fb0', pants: '#8a8fb0', boots: '#5a5f80' } },
  warthog: { name: 'Jabalí', hp: 22, speed: 1.15, r: 11, dmg: 8, xp: 2, scale: 1,
    look: { style: 'bald', skin: '#9c7a45', top: '#9c7a45', pants: '#9c7a45', boots: '#6b5230' } },
  snake: { name: 'Serpiente', hp: 14, speed: 1.0, r: 9, dmg: 7, xp: 1, scale: 0.85,
    look: { style: 'bald', skin: '#3fae4a', top: '#3fae4a', pants: '#3fae4a', boots: '#2a7a33' } },
  sabertooth: { name: 'Tigre dientes de sable', hp: 34, speed: 1.6, r: 12, dmg: 11, xp: 3, scale: 1.1,
    look: { style: 'bald', skin: '#e3b73a', top: '#e3b73a', pants: '#e3b73a', boots: '#9a7420' } },
  triceratops: { name: 'Tricerátops', hp: 120, speed: 0.6, r: 18, dmg: 16, xp: 8, scale: 1.4,
    look: { style: 'bald', skin: '#9a6a3a', top: '#9a6a3a', pants: '#9a6a3a', boots: '#6a4626' } },
  // Nivel 2 (Namek): criaturas de la Tierra con los colores de Namek, halcones y soldados de élite
  nsnake: { name: 'Serpiente de Namek', hp: 16, speed: 1.05, r: 9, dmg: 7, xp: 1, scale: 0.85, look: { style: 'bald', skin: '#3a6fd8', top: '#3a6fd8', pants: '#3a6fd8', boots: '#333' } },
  nbeast: { name: 'Bestia de Namek', hp: 30, speed: 1.6, r: 12, dmg: 10, xp: 3, scale: 1.1, lunge: true, look: { style: 'bald', skin: '#4fb6c9', top: '#4fb6c9', pants: '#4fb6c9', boots: '#333' } },
  ndino: { name: 'Dinosaurio de Namek', hp: 110, speed: 0.6, r: 18, dmg: 15, xp: 8, scale: 1.4, stomp: 55, look: { style: 'bald', skin: '#4caa5a', top: '#4caa5a', pants: '#4caa5a', boots: '#333' } },
  nbird: { name: 'Ave de Namek', hp: 12, speed: 1.9, r: 9, dmg: 6, xp: 1, scale: 0.9, look: { style: 'bald', skin: '#7a3fbf', top: '#7a3fbf', pants: '#7a3fbf', boots: '#333' } },
  hawk: { name: 'Halcón', hp: 10, speed: 2.0, r: 9, dmg: 5, xp: 1, scale: 0.85, lunge: true, look: { style: 'bald', skin: '#8a5a2a', top: '#8a5a2a', pants: '#8a5a2a', boots: '#333' } },
  esoldier: { name: 'Soldado de élite', hp: 60, speed: 1.05, r: 13, dmg: 11, xp: 4, scale: 1.15, shooter: true, shootChance: 1, spread: 3, look: { style: 'bald', skin: '#e48fb0', top: '#2a2a33', pants: '#2a2a33', boots: '#333' } },
  // Nivel 3 (Androides y Cell)
  eggbot: { name: 'Robot del Dr. Gero', hp: 28, speed: 1.1, r: 11, dmg: 9, xp: 2, scale: 1, shooter: true, shootChance: 0.5, burst: 3, look: { style: 'bald', skin: '#d8d8e0', top: '#d8d8e0', pants: '#d8d8e0', boots: '#333' } },
  scorpion: { name: 'Escorpión', hp: 20, speed: 1.45, r: 10, dmg: 9, xp: 2, scale: 0.95, look: { style: 'bald', skin: '#c9b23a', top: '#c9b23a', pants: '#c9b23a', boots: '#333' } },
  alligator: { name: 'Cocodrilo', hp: 45, speed: 0.85, r: 14, dmg: 12, xp: 3, scale: 1.2, lunge: true, look: { style: 'bald', skin: '#3fae3a', top: '#3fae3a', pants: '#3fae3a', boots: '#333' } },
  // Nivel 4 (Majin Buu): los secuaces de Babidi de Buu's Fury
  criminal: { name: 'Criminal', hp: 30, speed: 1.2, r: 11, dmg: 10, xp: 2, scale: 1, lunge: true, look: { style: 'bald', skin: '#e8b88a', top: '#b8302a', pants: '#5a5a9a', boots: '#333' } },
  msoldier: { name: 'Soldado Majin', hp: 45, speed: 1.15, r: 12, dmg: 12, xp: 3, scale: 1, shooter: true, shootChance: 0.25, spread: 2, look: { style: 'bald', skin: '#e8a050', top: '#d8d8e0', pants: '#2a2a7a', boots: '#333' } },
  // Se lanza contra el jugador y explota al tocarlo
  bomber: { name: 'Bombardero', hp: 22, speed: 1.55, r: 11, dmg: 18, xp: 2, scale: 1, kamikaze: true, look: { style: 'bald', skin: '#6a4a3a', top: '#2f7a2f', pants: '#2f7a2f', boots: '#333' } },
  mercenary: { name: 'Mercenario', hp: 40, speed: 1.0, r: 12, dmg: 12, xp: 3, scale: 1, shooter: true, shootChance: 0.7, look: { style: 'bald', skin: '#c98a5a', top: '#5a3a2a', pants: '#5a3a2a', boots: '#333' } },
  cyborg: { name: 'Cíborg', hp: 70, speed: 1.0, r: 13, dmg: 14, xp: 4, scale: 1.05, deathRing: 5, look: { style: 'bald', skin: '#c98a5a', top: '#2f3a7a', pants: '#2f9a3a', boots: '#333' } },
  destroyer: { name: 'Destructor', hp: 160, speed: 0.65, r: 18, dmg: 18, xp: 9, scale: 1, stomp: 65, look: { style: 'bald', skin: '#c8c8d0', top: '#c03030', pants: '#c03030', boots: '#333' } },
  majin: { name: 'Guerrero Majin', hp: 95, speed: 0.85, r: 16, dmg: 14, xp: 6, scale: 1.2, ring: 6,
    look: { style: 'bald', skin: '#e8b88a', top: '#3a3a3a', pants: '#b23030', belt: '#222', boots: '#222', majin: true } },
};


const BOSSES = [
  { id: 'raditz', name: 'Raditz', hp: 900, speed: 1.5, r: 20, dmg: 15, scale: 1.45, every: 2.6,
    patterns: ['aimed', 'dash', 'aimed', 'ring'],
    look: { style: 'long', hair: '#16161c', skin: '#e8b88a', top: '#2a2a33', pants: '#2a2a33', armor: true,
      plate: '#4a3b2f', pad: '#6b4f2f', boots: '#f1efe6', wrist: '#c0392b', scouter: true } },
  { id: 'nappa', name: 'Nappa', hp: 2400, speed: 1.15, r: 24, dmg: 20, scale: 1.75, every: 2.4,
    patterns: ['slam', 'ring', 'slam', 'dash'],
    look: { style: 'bald', skin: '#e2a877', mustache: '#16161c', top: '#2a2a33', pants: '#2a2a33', armor: true,
      plate: '#f1efe6', pad: '#8b6a3a', boots: '#f1efe6', wrist: '#f1efe6' } },
  { id: 'freezer', name: 'Freezer', hp: 5000, speed: 1.8, r: 20, dmg: 24, scale: 1.4, every: 2.0,
    patterns: ['aimed', 'ring', 'dash', 'aimed', 'slam'],
    look: { style: 'freezer', skin: '#f4f0f8', dome: '#8a3fbf', top: '#f4f0f8', pants: '#f4f0f8', boots: '#f4f0f8',
      sleeve: '#f4f0f8', gem: '#8a3fbf', tail: '#f4f0f8' } },
  { id: 'cell', name: 'Cell', hp: 9000, speed: 1.7, r: 24, dmg: 28, scale: 1.6, every: 1.8,
    patterns: ['ring', 'aimed', 'slam', 'dash', 'ring'],
    look: { style: 'cell', skin: '#e3d6ee', top: '#4fae4a', pants: '#4fae4a', boots: '#e8e8e8', sleeve: '#4fae4a',
      spots: true, wings: '#1f5e2a' } },
  { id: 'buu', name: 'Kid Buu', hp: 16000, speed: 1.5, r: 28, dmg: 32, scale: 1.8, every: 1.5,
    patterns: ['ring', 'slam', 'aimed', 'dash', 'ring', 'slam'],
    look: { style: 'buu', skin: '#f39ac0', top: '#26213a', pants: '#f2f2f2', belt: '#ffd84a', boots: '#ffd84a',
      sleeve: '#f39ac0', fat: true } },
  // Saga Freezer: las Fuerzas Especiales Ginyu (la vida de cada jefe la fija su nivel en LEVELS)
  { id: 'recoome', name: 'Recoome', hp: 3000, speed: 1.3, r: 20, dmg: 20, scale: 1.5, every: 2.2,
    patterns: ['slam', 'dash', 'slam', 'aimed'], look: { style: 'bald', skin: '#f0b080', top: '#e8e8e8', pants: '#2a2a33', boots: '#333' } },
  { id: 'burter', name: 'Burter', hp: 3000, speed: 2.3, r: 16, dmg: 16, scale: 1.35, every: 2,
    patterns: ['dash', 'aimed', 'dash', 'ring'], look: { style: 'bald', skin: '#4a6ac8', top: '#e8e8e8', pants: '#2a2a33', boots: '#333' } },
  { id: 'jeice', name: 'Jeice', hp: 3000, speed: 1.8, r: 16, dmg: 16, scale: 1.35, every: 2,
    patterns: ['aimed', 'ring', 'aimed', 'dash'], look: { style: 'bald', skin: '#d8403a', top: '#e8e8e8', pants: '#2a2a33', boots: '#333' } },
  { id: 'ginyu', name: 'Capitán Ginyu', hp: 3000, speed: 1.7, r: 18, dmg: 20, scale: 1.4, every: 1.9,
    patterns: ['aimed', 'dash', 'ring', 'slam'], look: { style: 'bald', skin: '#8a5ac8', top: '#e8e8e8', pants: '#2a2a33', boots: '#333' } },
  // Saga de los Androides y Cell
  { id: 'a19', name: 'Androide 19', hp: 3000, speed: 1.2, r: 18, dmg: 18, scale: 1.4, every: 2.2,
    patterns: ['aimed', 'slam', 'aimed', 'dash'], look: { style: 'bald', skin: '#e8e8f0', top: '#e8a020', pants: '#e8a020', boots: '#333' } },
  { id: 'gero', name: 'Dr. Gero', hp: 3000, speed: 1.3, r: 17, dmg: 18, scale: 1.4, every: 2.1,
    patterns: ['aimed', 'ring', 'aimed', 'slam'], look: { style: 'bald', skin: '#e8c8a0', top: '#c8a050', pants: '#c8a050', boots: '#333' } },
  { id: 'a16', name: 'Androide 16', hp: 3000, speed: 1.2, r: 20, dmg: 22, scale: 1.5, every: 2.2,
    patterns: ['slam', 'aimed', 'slam', 'ring'], look: { style: 'bald', skin: '#e8b88a', top: '#4a7a2a', pants: '#4a7a2a', boots: '#333' } },
  { id: 'a17', name: 'Androide 17', hp: 3000, speed: 2, r: 16, dmg: 18, scale: 1.35, every: 1.9,
    patterns: ['dash', 'aimed', 'ring', 'dash'], look: { style: 'bald', skin: '#e8b88a', top: '#2a2a2a', pants: '#2a3a8a', boots: '#333' } },
  { id: 'a18', name: 'Androide 18', hp: 3000, speed: 2, r: 16, dmg: 18, scale: 1.35, every: 1.9,
    patterns: ['aimed', 'dash', 'aimed', 'ring'], look: { style: 'bald', skin: '#f0c8a0', top: '#3a3a8a', pants: '#2a3a8a', boots: '#333' } },
  { id: 'cellimp', name: 'Cell Imperfecto', hp: 3000, speed: 1.5, r: 20, dmg: 22, scale: 1.5, every: 2,
    patterns: ['aimed', 'dash', 'ring', 'slam'], look: { style: 'bald', skin: '#4fae4a', top: '#4fae4a', pants: '#4fae4a', boots: '#333' } },
  { id: 'cellsemi', name: 'Cell Semi-Perfecto', hp: 3000, speed: 1.4, r: 22, dmg: 25, scale: 1.55, every: 1.9,
    patterns: ['slam', 'ring', 'dash', 'aimed'], look: { style: 'bald', skin: '#4fae4a', top: '#4fae4a', pants: '#4fae4a', boots: '#333' } },
  // Saga Majin Buu
  { id: 'puipui', name: 'Puipui', hp: 3000, speed: 1.7, r: 17, dmg: 20, scale: 1.4, every: 2,
    patterns: ['aimed', 'dash', 'aimed', 'ring'], look: { style: 'bald', skin: '#c8a0d8', top: '#e8e8f0', pants: '#2a2a8a', boots: '#333' } },
  { id: 'dabura', name: 'Dabura', hp: 3000, speed: 1.6, r: 22, dmg: 26, scale: 1.6, every: 1.8,
    patterns: ['aimed', 'slam', 'ring', 'dash', 'aimed'], look: { style: 'bald', skin: '#e88a8a', top: '#2a4ab8', pants: '#2a4ab8', boots: '#333' } },
  { id: 'fatbuu', name: 'Majin Buu', hp: 3000, speed: 1.3, r: 26, dmg: 28, scale: 1.7, every: 1.7,
    patterns: ['slam', 'ring', 'dash', 'slam'], look: { style: 'bald', skin: '#f39ac0', top: '#26213a', pants: '#f2f2f2', boots: '#333' } },
  { id: 'vegetas', name: 'Vegeta', hp: 6500, speed: 1.9, r: 18, dmg: 22, scale: 1.4, every: 1.9,
    patterns: ['aimed', 'dash', 'ring', 'aimed', 'slam'],
    look: { style: 'vegeta', hair: '#16161c', skin: '#f3c296', top: '#2c3fbf', pants: '#2c3fbf', armor: true,
      plate: '#f4f2ea', pad: '#e7c35a', boots: '#f4f4f4', wrist: '#f4f4f4', sleeve: '#2c3fbf' } },
];
// Los jefes se describen arriba; en qué nivel, en qué minuto y con cuánta vida aparecen lo decide cada nivel
const bossDef = id => BOSSES.find(b => b.id === id);

// Frases de la pantalla final (2.13.0), en español latino. who: guerrero o jefe con retrato (CHARACTERS / BOSSES);
// los demás llevan name e icon. Las del guerrero con el que jugaste salen más seguido.
const QUOTES = {
  win: [
    { who: 'hercule', text: '¡Como siempre, el gran Mr. Satán salva al mundo! ¡JA, JA, JA!' },
    { who: 'vegeta', text: '¡Soy el príncipe de todos los Saiyajin!' },
    { who: 'vegeta', text: 'Kakaroto... tú eres el número uno.' },
    { who: 'goku', text: '¡Soy un Saiyajin que creció en la Tierra!' },
    { who: 'vegeta', text: '¡Su poder de pelea es de más de 8000!' },
    { name: 'Shenlong', icon: '🐉', text: 'Tu deseo ha sido concedido. ¡Adiós!' },
    { name: 'Mr. Satán', icon: '🥊', text: '¡Ja, ja, ja! ¡Sabía que lo lograrías gracias a mi entrenamiento!' },
    { name: 'Narrador', icon: '📺', text: '¡No se pierdan el próximo capítulo de Dragon Ball Z!' },
    { who: 'goku', text: '¡Qué gran pelea! Ya quiero enfrentarme a alguien todavía más fuerte.' },
    { who: 'gohan', text: 'Papá, lo logré... protegí a todos.' },
    { who: 'piccolo', text: 'Hmph. No estuvo nada mal... para ser tú.' },
    { who: 'krilin', text: '¡Lo logramos! ¡Y esta vez sigo con vida!' },
    { who: 'ftrunks', text: 'Gracias a ti, el futuro todavía tiene esperanza.' },
    { who: 'vegeta', text: 'No te confíes. La próxima vez te superaré.' },
    { name: 'Maestro Roshi', icon: '🐢', text: '¡Así se hace! Todo ese entrenamiento valió la pena.' },
    { name: 'Kaio-sama', icon: '🪐', text: '¡Bien hecho! Ya puedes venir a entrenar a mi planeta.' },
    { who: 'goten', text: '¡Otra vez, otra vez! ¡Eso fue divertidísimo!' },
    { name: 'Bulma', icon: '🔧', text: 'Un genio como yo sabía que ganarías.' },
    { who: 'goku', text: 'Cuando creas que llegaste a tu límite, ¡supéralo!' },
    { name: 'Ten Shin Han', icon: '👁️', text: 'Un verdadero guerrero nunca deja de entrenar.' },
    { name: 'Chi-Chi', icon: '🍳', text: '¡Muy bien! Pero ahora, ¡a estudiar!' },
  ],
  lose: [
    { who: 'hercule', text: 'Me resbalé... ¡fue culpa del piso!' },
    { who: 'hercule', text: '¡Me duele el estómago! Si no, los derrotaba a todos.' },
    { who: 'vegeta', text: '¡Insecto!' },
    { who: 'freezer', text: 'Mi poder de pelea es de 530.000.' },
    { who: 'cell', text: '¡Soy el ser perfecto!' },
    { who: 'fatbuu', text: '¡Te convertiré en chocolate!' },
    { name: 'Narrador', icon: '📺', text: '¿Podrá nuestro héroe levantarse? ¡No se pierdan el próximo capítulo de Dragon Ball Z!' },
    { who: 'krilin', text: '¡Ay, no! ¡Otra vez me mataron!' },
    { name: 'Maestro Roshi', icon: '🐢', text: 'Hay que entrenar, estudiar, comer bien y descansar.' },
    { who: 'raditz', text: 'Kakaroto, eres una vergüenza para nuestra raza.' },
    { who: 'vegeta', text: 'Un guerrero de clase baja nunca superará a uno de élite.' },
    { who: 'freezer', text: '¿Eso es todo? Qué decepción.' },
    { who: 'goku', text: 'Perder también te hace más fuerte. ¡Vamos otra vez!' },
    { who: 'piccolo', text: '¡Levántate, Gohan! ¡Tú puedes dar mucho más!' },
    { who: 'gohan', text: 'No voy a rendirme... ¡todavía no!' },
    { name: 'Kaio-sama', icon: '🪐', text: '¿Otra vez por aquí? Bienvenido al Otro Mundo.' },
    { who: 'goku', text: 'No te preocupes, con una semilla del ermitaño quedas como nuevo.' },
    { who: 'vegeta', text: 'Mi orgullo no me permite quedarme en el suelo.' },
    { who: 'ftrunks', text: 'En mi futuro perdimos muchas veces. Nunca dejamos de pelear.' },
    { who: 'nappa', text: '¿Vegeta, ya puedo pelear en serio?' },
    { who: 'cell', text: 'Vuelve cuando seas más fuerte. Los Juegos de Cell te esperan.' },
    { name: 'Babidi', icon: '🧙', text: '¡Papapara! ¡Ni siquiera llegaste a mi nave!' },
  ],
};

// ─── Niveles (Nivel 1-4, uno por saga): cada uno con su mapa, enemigos, jefes y dificultad ──
// spawns: enemigos comunes (desde qué segundo, peso) · swarm: enemigo de las hordas que rodean
// bosses: { id, at (segundos), hp, final } · hp/dmg: multiplicadores de los enemigos · zeni: del Zeni ganado
const LEVELS = [
  { id: 'saiyan', num: 1, desc: 'Los Saiyajin llegan a la Tierra.', theme: 'saiyan',
    hp: 1, dmg: 1, zeni: 1,
    // from/to: segundos en que ese enemigo empieza (y deja) de aparecer
    spawns: [{ id: 'saibaman', from: 0, weight: 10 }, { id: 'wolf', from: 0, to: 300, weight: 8 },
      { id: 'warthog', from: 60, weight: 6 }, { id: 'snake', from: 120, weight: 6 },
      { id: 'sabertooth', from: 240, weight: 5 }, { id: 'triceratops', from: 360, weight: 2 }],
    swarm: 'saibaman', swarmText: '¡Una horda de Saibaimans os rodea!',
    bosses: [{ id: 'raditz', at: 150, hp: 900 }, { id: 'nappa', at: 360, hp: 2600 }, { id: 'vegetas', at: 600, hp: 6500, final: true }] },
  { id: 'namek', num: 2, desc: 'Planeta Namek, bajo el ejército de Freezer.', theme: 'namek',
    hp: 1.3, dmg: 1.15, zeni: 1.3,
    spawns: [{ id: 'soldier', from: 0, weight: 10 }, { id: 'nbird', from: 0, to: 300, weight: 6 },
      { id: 'nsnake', from: 60, weight: 6 }, { id: 'hawk', from: 120, weight: 4 }, { id: 'nbeast', from: 180, weight: 5 },
      { id: 'esoldier', from: 300, weight: 4 }, { id: 'ndino', from: 420, weight: 2 }],
    swarm: 'soldier', swarmText: '¡Una escuadra de soldados de Freezer os rodea!',
    bosses: [{ id: 'recoome', at: 120, hp: 3000 }, { id: 'burter', at: 240, hp: 2600 }, { id: 'jeice', at: 240, hp: 2600 },
      { id: 'ginyu', at: 390, hp: 5000 }, { id: 'freezer', at: 600, hp: 9000, final: true }] },
  { id: 'cell', num: 3, desc: 'Los androides del Dr. Gero y Cell.', theme: 'rocky',
    hp: 1.7, dmg: 1.3, zeni: 1.6,
    spawns: [{ id: 'eggbot', from: 0, weight: 10 }, { id: 'scorpion', from: 0, weight: 7 },
      { id: 'alligator', from: 120, weight: 5 }, { id: 'celljr', from: 480, weight: 8 }],
    swarm: 'eggbot', swarmText: '¡Un escuadrón de robots del Dr. Gero os rodea!',
    bosses: [{ id: 'a19', at: 105, hp: 3000 }, { id: 'gero', at: 210, hp: 3800 },
      { id: 'a16', at: 300, hp: 4200 }, { id: 'a17', at: 300, hp: 3800 }, { id: 'a18', at: 300, hp: 3800 },
      { id: 'cellimp', at: 390, hp: 7000 }, { id: 'cellsemi', at: 495, hp: 9500 }, { id: 'cell', at: 600, hp: 14000, final: true }] },
  { id: 'buu', num: 4, desc: 'Babidi, Dabura y Majin Buu.', theme: 'buu',
    hp: 1.95, dmg: 1.3, zeni: 2,   // 2.10.2: era 2.2 / 1.5 (muy difícil)
    spawns: [{ id: 'criminal', from: 0, weight: 10 }, { id: 'msoldier', from: 0, weight: 8 },
      { id: 'bomber', from: 60, weight: 5 }, { id: 'mercenary', from: 120, weight: 5 }, { id: 'majin', from: 180, weight: 6 },
      { id: 'cyborg', from: 270, weight: 5 }, { id: 'destroyer', from: 420, weight: 2 }],
    swarm: 'msoldier', swarmText: '¡Los soldados de Babidi os rodean!',
    bosses: [{ id: 'puipui', at: 120, hp: 4000 }, { id: 'dabura', at: 270, hp: 7500 },
      { id: 'fatbuu', at: 420, hp: 13000 }, { id: 'buu', at: 600, hp: 20000, final: true }] },
];
// ─── Nivel 5 (2.14.0): modo infinito en el planeta de Kaio-sama ───
// No tiene jefe final: los jefes de las 4 sagas vuelven en orden, una "vuelta" tras otra y cada vez más duros
// (en la primera de a uno, en la segunda de a dos y desde la tercera de a tres). Gana el ranking quien más aguanta.
const KAIO_SAGAS = ['Saiyajin', 'Freezer', 'Cell', 'Majin Buu'];
function kaioBosses(levels) {
  const out = [];
  let t = 50;
  for (let round = 0; round < 8; round++) {
    const size = Math.min(3, round + 1);
    levels.forEach((L, saga) => {
      for (let i = 0; i < L.bosses.length; i += size) {
        for (let k = i; k < Math.min(L.bosses.length, i + size); k++) {
          const b = L.bosses[k];
          // La vida crece con el minuto en que aparece y con cada vuelta
          out.push({ id: b.id, at: t, hp: Math.round(b.hp * (0.35 + t / 600) * (1 + 0.6 * round)), saga, round, sagaStart: i === 0 && k === 0 });
        }
        t += 45;
      }
    });
  }
  return out;
}
{
  // Los enemigos de cada nivel se van sumando: los del Nivel 1 desde el principio, los del 4 desde el minuto 8:30
  const from = [0, 150, 330, 510], until = [600, 1000, Infinity, Infinity];
  const spawns = LEVELS.flatMap((L, i) => L.spawns.map(s => ({ id: s.id, from: from[i] + Math.round(s.from * 0.4), to: until[i], weight: s.weight })));
  LEVELS.push({ id: 'kaio', num: 5, infinite: true, theme: 'kaiplanet',
    desc: 'Modo infinito: vuelven los villanos de todas las sagas.',
    hp: 1.6, dmg: 1.25, zeni: 1.8,
    spawns, swarm: 'saibaman', swarmText: '¡Una horda de villanos del Otro Mundo os rodea!',
    bosses: kaioBosses(LEVELS.slice(0, 4)) });
}
// Niveles que se pueden ganar (todos menos el infinito): para los logros de ganar niveles
const WINNABLE = () => LEVELS.filter(L => !L.infinite);

// 'weekly' es el desafío semanal: se juega en el nivel que le toca esa semana (WEEKLY, ver js/weekly.js)
// ─── Niveles bonus (2.19.0): aparte de los 5 niveles, en su propia sección de la ventana de Jugar (js/bonus.js) ───
const BONUS_LEVELS = [
  { id: 'snake', num: 'B1', bonus: true, theme: 'snakeway', name: 'El Camino de la Serpiente',
    desc: 'Un millón de kilómetros sobre las nubes hasta el planeta de Kaio-sama.',
    hp: 1.1, dmg: 1, zeni: 1.2,
    spawns: [{ id: 'saibaman', from: 0, weight: 10 }, { id: 'nbird', from: 0, weight: 6 }, { id: 'soldier', from: 20, weight: 6 },
      { id: 'hawk', from: 60, weight: 4 }, { id: 'esoldier', from: 150, weight: 3 }, { id: 'celljr', from: 240, weight: 3 }],
    swarm: 'saibaman', swarmText: '¡Una horda de Saibaimans os alcanza!',
    bosses: [] },
];
const levelDef = id => [...LEVELS, ...BONUS_LEVELS].find(l => l.id === (id === 'weekly' && WEEKLY ? WEEKLY.level : id)) || LEVELS[0];

// ─── Desafío semanal: reglas (las elige el servidor, api/_lib.js; acá su nombre y lo que hacen) ───
let WEEKLY = null;   // { week, endsAt, level, char, rules } de esta semana, o null si no se pudo cargar
const WEEKLY_RULES = {
  speedy:    { icon: '💨', name: 'Enemigos veloces',   desc: 'Los enemigos son un 50% más rápidos.' },
  horde:     { icon: '👥', name: 'Hordas',             desc: 'Aparecen el doble de enemigos, pero con menos vida.' },
  nosenzu:   { icon: '🚫', name: 'Sin semillas',       desc: 'No caen Semillas del Ermitaño.' },
  glass:     { icon: '💥', name: 'Cañón de cristal',   desc: 'Haces el doble de daño, pero tienes la mitad de vida.' },
  bossHp:    { icon: '🛡️', name: 'Jefes reforzados',   desc: 'Los jefes tienen el doble de vida.' },
  notrans:   { icon: '⛔', name: 'Sin transformación', desc: 'El Ki no te transforma y no hay fusión.' },
  fast:      { icon: '⏩', name: 'Siempre x1.5',       desc: 'La partida va siempre a velocidad x1.5.' },
  balls4:    { icon: '🐉', name: 'Esferas generosas',  desc: 'Shenlong aparece con 4 Esferas del Dragón.' },
  bossPairs: { icon: '👹', name: 'Jefes en pareja',    desc: 'Cada jefe llega junto con el siguiente. El jefe final llega solo.' },
};
const WEEKLY_ZENI = 1.5;   // las partidas del desafío dan un 50% más de Zeni

// Tienda de Zeni: mejoras permanentes para todos los personajes.
// Precio del siguiente nivel = base × crecimiento^nivel actual (redondeado a 10).
const SHOP_UPGRADES = [
  { id: 'hp',     name: 'Cuerpo Saiyajin',       icon: '♥', color: '#4dff6a', max: 10, base: 60,   grow: 1.35, per: 8,    fmt: v => `+${v} de salud máxima` },
  { id: 'atk',    name: 'Gravedad x100',         icon: '✊', color: '#ff5c5c', max: 10, base: 80,   grow: 1.38, per: 0.04, fmt: v => `+${Math.round(v * 100)}% de daño` },
  { id: 'spd',    name: 'Ropa con pesas',        icon: '»', color: '#5cf2ff', max: 8,  base: 70,   grow: 1.40, per: 0.03, fmt: v => `+${Math.round(v * 100)}% de velocidad` },
  { id: 'cd',     name: 'Control del Ki',        icon: '↻', color: '#d68cff', max: 8,  base: 90,   grow: 1.42, per: 0.03, fmt: v => `-${Math.round(v * 100)}% de recarga` },
  { id: 'def',    name: 'Armadura de combate',   icon: '▣', color: '#cfcfcf', max: 8,  base: 80,   grow: 1.40, per: 0.02, fmt: v => `-${Math.round(v * 100)}% de daño recibido` },
  { id: 'regen',  name: 'Meditación',            icon: '✚', color: '#9dff8a', max: 5,  base: 120,  grow: 1.50, per: 0.2,  fmt: v => `+${v.toFixed(1)} de salud por segundo` },
  { id: 'magnet', name: 'Radar del Dragón',      icon: '◎', color: '#ffb81c', max: 6,  base: 50,   grow: 1.40, per: 0.12, fmt: v => `+${Math.round(v * 100)}% de radio de recogida` },
  { id: 'xp',     name: 'Habitación del Tiempo', icon: '★', color: '#3da5ff', max: 8,  base: 100,  grow: 1.42, per: 0.05, fmt: v => `+${Math.round(v * 100)}% de experiencia` },
  { id: 'coins',  name: 'Corporación Cápsula',   icon: 'Z', color: '#ffe27a', max: 8,  base: 120,  grow: 1.45, per: 0.08, fmt: v => `+${Math.round(v * 100)}% de Zeni` },
  { id: 'reroll', name: 'Visión de Kaio-sama',   icon: '🎲', color: '#8fe3ff', max: 3, base: 1000, grow: 1.75, per: 1,   fmt: v => `${v} sorteo${v === 1 ? '' : 's'} de cartas por partida` },
  { id: 'senzu',  name: 'Semilla de reserva',    icon: '🌱', color: '#6cff7a', max: 1, base: 4000, grow: 1,    per: 1,    fmt: () => 'Si caes, revives una vez por partida con la mitad de la vida, una explosión de Ki y el Zenkai (+20% de daño y de vida)' },
];
const shopCost = (u, lvl) => Math.round(u.base * Math.pow(u.grow, lvl) / 10) * 10;

// ─── Logros ───────────────────────────────────────────────────────────────────
// goal + progress (a partir de la partida guardada): logros acumulables con barra de progreso
const ACH_CATEGORIES = { prog: 'Progreso', fight: 'Combate', tech: 'Técnicas', power: 'Transformaciones y fusión',
  surv: 'Supervivencia y objetos', online: 'Online y desafíos', legend: 'Leyendas (a largo plazo)' };
const ACHIEVEMENTS = [
  { id: 'first',     cat: 'prog',   zeni: 50,   name: 'Primer combate',         desc: 'Termina tu primera partida (ganando o perdiendo).' },
  { id: 'win',       cat: 'prog',   zeni: 300,  name: 'Salvador de la Tierra',  desc: 'Gana un nivel (derrota a su jefe final).' },
  { id: 'allsagas',  cat: 'prog',   zeni: 1500, name: 'Héroe de todas las sagas', desc: 'Gana los 4 niveles.',
    goal: () => WINNABLE().length, progress: S => Object.keys(S.levelsWon || {}).length },
  { id: 'win5',      cat: 'prog',   zeni: 800,  name: 'Guerreros de todo tipo', desc: 'Gana con 5 guerreros distintos.',
    goal: 5, progress: S => Object.keys(S.stats.winsBy).length },
  { id: 'win8',      cat: 'prog',   zeni: 2000, name: 'Leyenda viviente',       desc: 'Gana con los 8 guerreros.',
    goal: 8, progress: S => Object.keys(S.stats.winsBy).length },
  { id: 'kills1000', cat: 'fight',  zeni: 300,  name: 'Mil caídos',             desc: 'Derrota 1000 enemigos en una sola partida.' },
  { id: 'kills10k',  cat: 'fight',  zeni: 500,  name: 'Exterminador',           desc: 'Derrota 10.000 enemigos en total, sumando todas las partidas.',
    goal: 10000, progress: S => S.stats.kills },
  { id: 'elite10',   cat: 'fight',  zeni: 200,  name: 'Cazador de élite',       desc: 'Derrota 10 enemigos de élite (aura dorada) en una partida.' },
  { id: 'freezer60', cat: 'fight',  zeni: 300,  name: 'Sin piedad',             desc: 'Derrota a Freezer antes de que pase 1 minuto desde que aparece.' },
  { id: 'lowhp',     cat: 'fight',  zeni: 250,  name: 'Al borde de la muerte',  desc: 'Derrota a un jefe teniendo menos del 10% de vida.' },
  { id: 'evo1',      cat: 'tech',   zeni: 100,  name: 'Primera evolución',      desc: 'Evoluciona una técnica.' },
  { id: 'evo3',      cat: 'tech',   zeni: 400,  name: 'Maestro de las técnicas', desc: 'Evoluciona 3 técnicas en una misma partida.' },
  { id: 'arsenal',   cat: 'tech',   zeni: 300,  name: 'Arsenal completo',       desc: 'Ten 5 técnicas a la vez, todas a nivel 5 o evolucionadas.' },
  { id: 'allevo',    cat: 'tech',   zeni: 1500, name: 'Enciclopedia del Ki',    desc: 'Consigue todas las evoluciones, en distintas partidas.',
    goal: () => Object.values(ATTACKS).filter(a => a.evolved).length, progress: S => Object.keys(S.stats.evos).length },
  { id: 'transform5', cat: 'power', zeni: 150,  name: 'Furia Saiyajin',         desc: 'Transfórmate 5 veces en una misma partida.' },
  { id: 'fusion',    cat: 'power',  zeni: 200,  name: '¡Fu-sión-ha!',           desc: 'Fusiónate en Gogeta, en online o con el deseo.' },
  { id: 'notrans',   cat: 'power',  zeni: 600,  name: 'Orgullo de guerrero',    desc: 'Gana sin transformarte ni fusionarte nunca.' },
  { id: 'untouch',   cat: 'surv',   zeni: 300,  name: 'Intocable',              desc: 'Sobrevive 3 minutos seguidos sin recibir daño.' },
  { id: 'nosenzu',   cat: 'surv',   zeni: 400,  name: 'Sin ayuda del Ermitaño', desc: 'Gana sin recoger ninguna Semilla del Ermitaño.' },
  { id: 'shenlong',  cat: 'surv',   zeni: 150,  name: '¡Aparece, Shenlong!',    desc: 'Junta las 7 Esferas del Dragón.' },
  { id: 'shenlong3', cat: 'surv',   zeni: 400,  name: 'Amigo de Shenlong',      desc: 'Invoca a Shenlong 3 veces en una partida.' },
  { id: 'allwishes', cat: 'surv',   zeni: 800,  name: 'Todos los deseos',       desc: 'Pide los 7 deseos de Shenlong, en distintas partidas.',
    goal: () => WISH_POOL.length, progress: S => WISH_POOL.filter(w => S.stats.wishes && S.stats.wishes[w.id]).length },
  { id: 'online3',   cat: 'online', zeni: 500,  name: 'Guerreros Z',            desc: 'Gana una partida online con 3 o más jugadores.' },
  { id: 'weekly',    cat: 'online', zeni: 500,  name: 'Desafío cumplido',       desc: 'Gana un desafío semanal.' },
  { id: 'satanwin',  cat: 'prog',   zeni: 500,  name: '¡El campeón!',           desc: 'Gana un nivel con Mr. Satán (de alguna manera).' },
  { id: 'snakeway',  cat: 'prog',   zeni: 500,  name: 'El Camino de la Serpiente', desc: 'Llega al planeta de Kaio-sama por el Camino de la Serpiente (nivel bonus).' },
  // Nivel 5 (2.14.0): el modo infinito en el planeta de Kaio-sama
  { id: 'kaio10',    cat: 'surv',   zeni: 300,  name: 'De visita en el Otro Mundo', desc: 'Aguanta 10 minutos en el Nivel 5.' },
  { id: 'kaio20',    cat: 'surv',   zeni: 800,  name: 'Alumno de Kaio-sama',     desc: 'Aguanta 20 minutos en el Nivel 5.' },
  { id: 'kaio30',    cat: 'legend', zeni: 2000, name: 'Leyenda del Otro Mundo',  desc: 'Aguanta 30 minutos en el Nivel 5.' },
  { id: 'kaioSagas', cat: 'fight',  zeni: 600,  name: 'Todas las sagas',         desc: 'En el Nivel 5, llega a la segunda vuelta de jefes.' },
  // ─── Leyendas (2.12.0): metas largas que se acumulan entre partidas (ver SAVE.stats en game.js) ───
  { id: 'runs100',   cat: 'legend', zeni: 1000,  name: 'Veterano',               desc: 'Juega 100 partidas.', goal: 100, progress: S => S.runs },
  { id: 'runs500',   cat: 'legend', zeni: 4000,  name: 'Incansable',             desc: 'Juega 500 partidas.', goal: 500, progress: S => S.runs },
  { id: 'hours10',   cat: 'legend', zeni: 3000,  name: 'Maratón',                desc: 'Juega 10 horas en total (600 minutos de partida).', goal: 600, progress: S => Math.floor(S.stats.time / 60) },
  { id: 'kills50k',  cat: 'legend', zeni: 2000,  name: 'Ejército caído',         desc: 'Derrota 50.000 enemigos en total.', goal: 50000, progress: S => S.stats.kills },
  { id: 'kills250k', cat: 'legend', zeni: 6000,  name: 'Exterminio total',       desc: 'Derrota 250.000 enemigos en total.', goal: 250000, progress: S => S.stats.kills },
  { id: 'elites200', cat: 'legend', zeni: 1500,  name: 'Cazarrecompensas',       desc: 'Derrota 200 enemigos de élite en total.', goal: 200, progress: S => S.stats.elites },
  { id: 'bosses100', cat: 'legend', zeni: 2000,  name: 'Azote de jefes',         desc: 'Derrota 100 jefes en total.', goal: 100, progress: S => Object.values(S.stats.bosses).reduce((a, b) => a + b, 0) },
  { id: 'bestiary',  cat: 'legend', zeni: 2500,  name: 'Bestiario completo',     desc: 'Derrota a todos los jefes del juego al menos una vez.',
    goal: () => ALL_BOSS_IDS().length, progress: S => ALL_BOSS_IDS().filter(id => S.stats.bosses[id]).length },
  { id: 'finals10',  cat: 'legend', zeni: 3000,  name: 'Verdugo de villanos',    desc: 'Derrota 10 veces a cada jefe final (Vegeta, Freezer, Cell y Kid Buu).',
    goal: () => FINAL_BOSS_IDS().length * 10, progress: S => FINAL_BOSS_IDS().reduce((a, id) => a + Math.min(10, S.stats.bosses[id] || 0), 0) },
  { id: 'evo50',     cat: 'legend', zeni: 2000,  name: 'Maestro del Ki',         desc: 'Evoluciona 50 técnicas en total.', goal: 50, progress: S => S.stats.evoCount },
  { id: 'trans200',  cat: 'legend', zeni: 1500,  name: 'Siempre al máximo',      desc: 'Transfórmate 200 veces en total.', goal: 200, progress: S => S.stats.transforms },
  { id: 'fusion25',  cat: 'legend', zeni: 2000,  name: 'Fusión perfecta',        desc: 'Fusiónate en Gogeta 25 veces.', goal: 25, progress: S => S.stats.fusions },
  { id: 'summon50',  cat: 'legend', zeni: 2500,  name: 'Íntimo de Shenlong',     desc: 'Invoca a Shenlong 50 veces en total.', goal: 50, progress: S => S.stats.summons },
  { id: 'zeni100k',  cat: 'legend', zeni: 3000,  name: 'Fortuna de la Corporación', desc: 'Gana 100.000 Zeni en total jugando.', goal: 100000, progress: S => S.stats.zeniEarned },
  { id: 'shopmax',   cat: 'legend', zeni: 5000,  name: 'Entrenamiento completo', desc: 'Compra todas las mejoras de la Tienda de Zeni hasta el máximo.',
    goal: () => SHOP_UPGRADES.reduce((a, u) => a + u.max, 0), progress: S => SHOP_UPGRADES.reduce((a, u) => a + Math.min(u.max, (S.upgrades || {})[u.id] || 0), 0) },
  { id: 'wins3x',    cat: 'legend', zeni: 3000,  name: 'Maestro de las sagas',   desc: 'Gana cada nivel con 3 guerreros distintos.',
    goal: () => WINNABLE().length * 3, progress: S => WINNABLE().reduce((a, L) => a + Math.min(3, winnersOf(S, L.id)), 0) },
  { id: 'wins8x',    cat: 'legend', zeni: 10000, name: 'Dominio total',          desc: 'Gana cada nivel con los 8 guerreros.',
    goal: () => WINNABLE().length * 8, progress: S => WINNABLE().reduce((a, L) => a + Math.min(8, winnersOf(S, L.id)), 0) },
  { id: 'online25',  cat: 'legend', zeni: 2500,  name: 'Hermanos de armas',      desc: 'Gana 25 partidas online.', goal: 25, progress: S => S.stats.onlineWins },
  { id: 'weekly10',  cat: 'legend', zeni: 3000,  name: 'Retador semanal',        desc: 'Gana 10 desafíos semanales.', goal: 10, progress: S => S.stats.weeklyWins },
  { id: 'weeks8',    cat: 'legend', zeni: 2000,  name: 'Fiel al desafío',        desc: 'Juega el desafío semanal en 8 semanas distintas.', goal: 8, progress: S => Object.keys(S.stats.weeklyWeeks).length },
  { id: 'fast',      cat: 'online', zeni: 300,  name: 'A toda máquina',         desc: 'Gana con la Velocidad x1.5 activada.' },
];
const achGoal = a => (typeof a.goal === 'function' ? a.goal() : a.goal);
// Para los logros de leyenda: todos los jefes de los niveles, los finales y cuántos guerreros ganaron cada nivel
const ALL_BOSS_IDS = () => [...new Set(LEVELS.flatMap(L => L.bosses.map(b => b.id)))];
const FINAL_BOSS_IDS = () => WINNABLE().map(L => L.bosses.find(b => b.final).id);
const winnersOf = (S, lv) => Object.keys(S.stats.lvWins || {}).filter(k => k.startsWith(lv + '|')).length;

// Deseos de Shenlong (2.11.0): cada jugador ve 3 al azar de la lista y un cuarto fijo, la Fusión si su guerrero
// puede fusionarse (Goku o Vegeta, en solitario) o el Ki infinito (extra: no entra en el sorteo). Ver wishOffer en game.js
const WISH_OFFER = 3;
const WISHES = [
  { id: 'heal',     name: 'Salud eterna',                  desc: 'Recuperas toda tu salud y ganas +50 de salud máxima.' },
  { id: 'strong',   name: 'El más fuerte del universo',    desc: '+25% de daño a todas tus técnicas durante el resto de la partida.' },
  { id: 'chamber',  name: 'Habitación del Tiempo',         desc: 'Subes 3 niveles de golpe y eliges sus 3 mejoras.' },
  { id: 'immortal', name: 'Inmortalidad',                  desc: 'Eres invulnerable durante 10 segundos.' },
  { id: 'vanish',   name: 'Que desaparezcan los enemigos', desc: 'Todos los enemigos desaparecen y dejan su experiencia. Los jefes no.' },
  { id: 'riches',   name: 'Riquezas',                      desc: '+300 Zeni al terminar la partida, ganes o pierdas.' },
  { id: 'attract',  name: 'Atraer las esferas',            desc: 'La próxima vez Shenlong aparece con 5 Esferas del Dragón en vez de 7.' },
  { id: 'ki', extra: true, name: 'Ki infinito',            desc: 'Te transformas durante 60 segundos.' },
  // 2.23.0: solo después de usar la Semilla de reserva (con la aureola); no entra en el sorteo ni en «Todos los deseos»
  { id: 'otherworld', extra: true, name: 'Volver del Otro Mundo', desc: 'Shenlong te trae de vuelta del Otro Mundo: recuperas la Semilla de reserva. Hasta 3 veces por partida.' },
  // 2.24.0: a veces (AWAKEN_CHANCE), si tienes una técnica que todavía no puede evolucionar; no entra en «Todos los deseos»
  { id: 'awaken', extra: true, name: 'Despertar el poder oculto', desc: 'Tu técnica de mayor nivel evoluciona al instante, aunque no tenga el nivel máximo ni la mejora que pide.' },
];
const WISH_POOL = WISHES.filter(w => !w.extra);

const RUN_LENGTH = 600; // segundos: al derrotar a Majin Buu se gana la partida

// Detalles de apariencia extra para los sprites
ENEMIES.saibaman.look.eye = '#e01e1e';
BOSSES.find(b => b.id === 'freezer').look.eye = '#a0102a';
BOSSES.find(b => b.id === 'cell').look.eye = '#5a1a6a';
ENEMIES.celljr.look.hair = BOSSES.find(b => b.id === 'cell').look.hair = '#2f7a35';

// Cada apariencia recibe un id (para la caché de sprites y los sprites externos)
for (const id in CHARACTERS) Object.assign(CHARACTERS[id].look, { id, ssjHair: CHARACTERS[id].ssjHair });
for (const id in ENEMIES) ENEMIES[id].look.id = id;
for (const b of BOSSES) b.look.id = b.id;

/*
 * Sprites externos opcionales. Si tienes una hoja de sprites (PNG) con permiso para
 * usarla, ponla en assets/sprites/ y regístrala aquí; sustituye al sprite generado.
 * Para la versión transformada usa el id con ':ssj' (por ejemplo 'goku:ssj').
 *
 *   goku: {
 *     src: 'assets/sprites/goku.png',
 *     frameW: 48, frameH: 48,   // tamaño de cada fotograma
 *     footY: 44,                // fila de los pies dentro del fotograma
 *     fps: 8,
 *     anims: {                  // fila, primera columna y número de fotogramas
 *       idle: { row: 0, col: 0, count: 4 },
 *       walk: { row: 1, col: 0, count: 6 },
 *       cast: { row: 2, col: 0, count: 3 },
 *     },
 *   },
 */
// Hojas generadas con tools/build-sprites.ps1 a partir de Buu's Fury y The Legacy of
// Goku II (GBA): fotogramas 0 reposo · 1-4 caminar/correr · 5-6 lanzar ki.
// Personajes: una fila por dirección (perfil, de frente, de espaldas) y, en los Saiyajin,
// cada una seguida de su versión Super Saiyajin. "dirs" indica la fila de cada dirección.
const GBA_ANIMS = (row) => ({
  frameW: 32, frameH: 32, footY: 32, fps: 10, scale: 1.25, // 32 px del GBA → ~40 px como el resto
  anims: { idle: { row, col: 0, count: 1 }, walk: { row, col: 1, count: 4 }, cast: { row, col: 5, count: 2 } },
});
const gbaSprite = (id, row = 0, dirs = null) => ({ src: `assets/sprites/${id}.png`, ...GBA_ANIMS(row), dirs });
// Hojas con celdas de 64 px (Cell, Buu gordo, Destructores, Puipui y Dabura)
const bigSprite = (id, scale, dirs = null) => ({ ...gbaSprite(id, 0, dirs), frameW: 64, frameH: 64, footY: 64, scale });
const withPunch = sp => ({ ...sp, anims: { ...sp.anims, punch: { row: 0, col: 7, count: 2 } } });
const DIRS_PLAIN = { side: 0, down: 1, up: 2 };           // hoja sin Super Saiyajin
const DIRS_SAIYAN = { side: 0, down: 2, up: 4 };          // filas normales de una hoja con SSJ
const DIRS_SAIYAN_SSJ = { side: 1, down: 3, up: 5 };      // filas Super Saiyajin
const SPRITE_OVERRIDES = {
  // Goku y Vegeta Super Saiyajin usan sus sprites originales de Buu's Fury
  // Gohan: hoja armada con tools/compose-gohan.ps1 (ropa de Demon Clothes, pelo de Battle Suit y SSJ2)
  goku: gbaSprite('goku', 0, DIRS_SAIYAN),       'goku:ssj': gbaSprite('goku-ssj', 0, DIRS_PLAIN),
  'goku:ssj3': gbaSprite('goku-ssj3', 0, DIRS_PLAIN),   // Super Saiyajin 3: preparado, todavía no se usa en el juego
  vegeta: gbaSprite('vegeta', 0, DIRS_SAIYAN),   'vegeta:ssj': gbaSprite('vegeta-ssj', 0, DIRS_PLAIN),
  gohan: gbaSprite('gohan', 0, DIRS_SAIYAN),     'gohan:ssj': gbaSprite('gohan', 1, DIRS_SAIYAN_SSJ),
  // Goten tiene además una animación de puñetazos (cuadros 7-8) para la Ráfaga de Puños
  goten: withPunch(gbaSprite('goten', 0, DIRS_PLAIN)),   'goten:ssj': withPunch(gbaSprite('goten-ssj', 0, DIRS_PLAIN)),
  trunks: gbaSprite('trunks', 0, DIRS_PLAIN),     'trunks:ssj': gbaSprite('trunks-ssj', 0, DIRS_PLAIN),
  ftrunks: gbaSprite('ftrunks', 0, DIRS_PLAIN),   'ftrunks:ssj': gbaSprite('ftrunks-ssj', 0, DIRS_PLAIN),
  piccolo: gbaSprite('piccolo', 0, DIRS_PLAIN),   'piccolo:ssj': gbaSprite('piccolo-ssj', 0, DIRS_PLAIN),   // Fusión con Kami: sin capa
  // Krilin no es jugable en Legacy of Goku II y su hoja solo trae caminata: se acelera,
  // se inclina el torso hacia delante y rebota un píxel por paso para que parezca correr
  krilin: { ...gbaSprite('krilin', 0, DIRS_PLAIN), run: { fps: 15, lean: 2, waist: 0.62 } },
  // Mr. Satán (Buu's Fury): 7-8 el Megaton Punch; el cuadro 9 es la pose de victoria de frente y tirado en el piso de perfil;
  // 11-14, la carrera asustada (con poca vida)
  hercule: (() => { const sp = withPunch(gbaSprite('hercule', 0, DIRS_PLAIN)); return { ...sp, anims: { ...sp.anims, pose: { row: 0, col: 9, count: 1 }, trip: { row: 0, col: 9, count: 2 }, flee: { row: 0, col: 11, count: 4 } } }; })(),
  gogeta: gbaSprite('gogeta', 0, DIRS_PLAIN),   // fusión de Goku y Vegeta (ya viene en Super Saiyajin)
  // Soldados de Freezer (Legacy of Goku): 6 variantes de 3 filas (perfil, frente, espaldas)
  soldier: { ...gbaSprite('soldier', 0, DIRS_PLAIN), variants: 6, variantRows: 3 },
  celljr: gbaSprite('celljr', 0, DIRS_PLAIN),
  // Animales del Nivel 1
  wolf: gbaSprite('wolf', 0, DIRS_PLAIN),       warthog: gbaSprite('warthog', 0, DIRS_PLAIN),
  snake: gbaSprite('snake', 0, DIRS_PLAIN),     sabertooth: gbaSprite('sabertooth', 0, DIRS_PLAIN),
  triceratops: gbaSprite('triceratops', 0, DIRS_PLAIN),
  // Guerrero Majin: Majin Fighter de Buu's Fury, 4 variantes de 3 filas (perfil, frente, espaldas)
  majin: { ...gbaSprite('majin', 0, DIRS_PLAIN), variants: 4, variantRows: 3 },
  // Nivel 2
  nsnake: gbaSprite('nsnake', 0, DIRS_PLAIN),   nbeast: gbaSprite('nbeast', 0, DIRS_PLAIN),
  ndino: gbaSprite('ndino', 0, DIRS_PLAIN),     nbird: gbaSprite('nbird', 0, DIRS_PLAIN),
  hawk: gbaSprite('hawk', 0, DIRS_PLAIN),       esoldier: gbaSprite('esoldier', 0, DIRS_PLAIN),
  // Nivel 3 (con las variantes de color de cada hoja)
  eggbot: { ...gbaSprite('eggbot', 0, DIRS_PLAIN), variants: 4, variantRows: 3 },
  scorpion: { ...gbaSprite('scorpion', 0, DIRS_PLAIN), variants: 3, variantRows: 3 },
  alligator: gbaSprite('alligator', 0, DIRS_PLAIN),
  // Nivel 4
  criminal: { ...gbaSprite('criminal', 0, DIRS_PLAIN), variants: 3, variantRows: 3 },
  msoldier: { ...gbaSprite('msoldier', 0, DIRS_PLAIN), variants: 3, variantRows: 3 },
  bomber: { ...gbaSprite('bomber', 0, DIRS_PLAIN), variants: 3, variantRows: 3 },
  mercenary: { ...gbaSprite('mercenary', 0, DIRS_PLAIN), variants: 3, variantRows: 3 },
  cyborg: { ...gbaSprite('cyborg', 0, DIRS_PLAIN), variants: 2, variantRows: 3 },
  destroyer: { ...bigSprite('destroyer', 0.7, DIRS_PLAIN), variants: 3, variantRows: 3 },
  // Jefes (la escala del jefe en BOSSES se aplica encima de esta)
  raditz: gbaSprite('raditz', 0, DIRS_PLAIN),   // perfil, frente y espaldas
  nappa: gbaSprite('nappa', 0, DIRS_PLAIN),
  vegetas: gbaSprite('vegeta-saiyan', 0, DIRS_PLAIN),   // Vegeta de la saga Saiyajin (jefe del Nivel 1)
  recoome: gbaSprite('recoome', 0, DIRS_PLAIN), burter: gbaSprite('burter', 0, DIRS_PLAIN),
  jeice: gbaSprite('jeice', 0, DIRS_PLAIN),     ginyu: gbaSprite('ginyu', 0, DIRS_PLAIN),
  a19: gbaSprite('a19', 0, DIRS_PLAIN),         gero: gbaSprite('gero', 0, DIRS_PLAIN),
  a16: gbaSprite('a16', 0, DIRS_PLAIN),         a17: gbaSprite('a17', 0, DIRS_PLAIN),   a18: gbaSprite('a18', 0, DIRS_PLAIN),
  cellimp: bigSprite('cellimp', 0.65, DIRS_PLAIN), cellsemi: bigSprite('cellsemi', 0.65, DIRS_PLAIN),
  // Buu's Fury: Puipui y Dabura vienen al doble de tamaño; Buu gordo en celdas de 64
  // (el perfil de Puipui viene mirando a la izquierda: se refleja)
  puipui: { ...bigSprite('puipui', 0.78, DIRS_PLAIN), flip: true }, dabura: bigSprite('dabura', 0.6, DIRS_PLAIN),
  fatbuu: bigSprite('fatbuu', 0.65, DIRS_PLAIN),
  freezer: gbaSprite('freezer'),
  buu: gbaSprite('buu'),
  cell: { // hoja de Legacy of Goku II con celdas de 64 px y un Cell de ~58 px de alto
    src: 'assets/sprites/cell.png', frameW: 64, frameH: 64, footY: 64, fps: 10, scale: 0.65,
    anims: { idle: { row: 0, col: 0, count: 1 }, walk: { row: 0, col: 1, count: 4 }, cast: { row: 0, col: 5, count: 2 } },
  },
};
// Caída de la Semilla de reserva (2.23.0): los últimos 3 cuadros de cada guerrero son el golpe, tirado en el piso y
// levantándose (ver tools/build-sprites.ps1). Mr. Satán usa los de cuando tropieza y se levanta con la pose quieta.
{
  const KO_COL = { goku: 7, vegeta: 7, gohan: 7, piccolo: 7, krilin: 7, goten: 9, trunks: 7, ftrunks: 7 };
  const ko = (hit, lie, up) => ({ kohit: { row: 0, col: hit, count: 1 }, kolie: { row: 0, col: lie, count: 1 }, koup: { row: 0, col: up, count: 1 } });
  for (const [id, c] of Object.entries(KO_COL)) SPRITE_OVERRIDES[id] = { ...SPRITE_OVERRIDES[id], anims: { ...SPRITE_OVERRIDES[id].anims, ...ko(c, c + 1, c + 2) } };
  SPRITE_OVERRIDES.hercule = { ...SPRITE_OVERRIDES.hercule, anims: { ...SPRITE_OVERRIDES.hercule.anims, ...ko(9, 10, 0) } };
}
