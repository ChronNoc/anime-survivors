'use strict';

// Local crossover pack. Move choices are restricted to their matching fighter,
// keeping Naruto, Luffy and Sung Jinwoo's level-up pools personal to them.
Object.assign(ATTACKS, {
  rasengan: {
    name: 'Rasengan', color: '#39c6ff', core: '#f4fdff', type: 'projectile', kind: 'rasengan', users: ['naruto'], crossover: true,
    desc: 'A dense, rotating chakra sphere that drills through a line of enemies.',
    stats: l => ({ cd: 1.55 - l * 0.09, dmg: 21 + l * 7, count: 1, speed: 8.8, r: 9 + l,
      pierce: 1 + Math.floor(l / 2), life: 1.25, spread: 0, knock: 10 + l * 2 }),
  },
  shadowclone: {
    name: 'Shadow Clone Barrage', color: '#e8f4ff', type: 'decoy', users: ['naruto'], shadowClone: true, crossover: true,
    desc: 'Creates fighting clones that draw enemies in, then finish with a coordinated chakra burst.',
    stats: l => ({ cd: 6.1 - l * 0.38, dur: 2.8 + l * 0.18, count: 1 + Math.floor((l + 1) / 2),
      taunt: 190 + l * 18, dmg: 27 + l * 11, explode: 58 + l * 9 }),
  },
  rasenshuriken: {
    name: 'Wind Style: Rasenshuriken', color: '#a9f4ff', core: '#ffffff', type: 'projectile', kind: 'rasenshuriken', users: ['naruto'], crossover: true,
    desc: 'A huge spinning wind shuriken that tracks its target and detonates in a cutting vortex.',
    stats: l => ({ cd: 5.8 - l * 0.34, dmg: 46 + l * 18, count: 1, speed: 4.8 + l * 0.15, r: 14 + l,
      pierce: 0, life: 3.2, spread: 0, explode: 76 + l * 13, home: 2.7 + l * 0.12 }),
  },
  kuramabarrage: {
    name: 'Nine-Tails Chakra Arms', color: '#ff9f2d', core: '#fff1a6', type: 'projectile', kind: 'chakraarm', users: ['naruto'], crossover: true,
    desc: 'Chakra arms strike several enemies at once from different angles.',
    stats: l => ({ cd: 2.75 - l * 0.16, dmg: 18 + l * 8, count: 2 + Math.floor(l / 2), speed: 9.4,
      r: 7 + l * 0.5, pierce: 1, life: 1.05, spread: 0.34, knock: 14 }),
  },
  uzumakibarrage: {
    name: 'Uzumaki Barrage', color: '#ffb84f', core: '#fff1a6', type: 'rush', users: ['naruto'], crossover: true,
    desc: 'Naruto closes in with a full melee combo, launching everyone caught in his path.',
    stats: l => ({ cd: 1.55 - l * 0.08, dmg: 15 + l * 5.5, count: 2 + Math.floor(l / 2), speed: 11, r: 15 + l * 0.6, knock: 11 }),
  },

  gumpistol: {
    name: 'Gum-Gum Pistol', color: '#f2b28f', core: '#fff0de', type: 'projectile', kind: 'rubberfist', users: ['luffy'], crossover: true,
    desc: 'Luffy stretches one arm into a long-range punch with strong knockback.',
    stats: l => ({ cd: 1.35 - l * 0.07, dmg: 23 + l * 8, count: 1, speed: 11.2, r: 9 + l * 0.4,
      pierce: 2 + Math.floor(l / 2), life: 1.02, spread: 0, knock: 16 + l * 2 }),
  },
  gumgatling: {
    name: 'Gum-Gum Gatling', color: '#f2b28f', core: '#fff0de', type: 'projectile', kind: 'rubberfist', users: ['luffy'], crossover: true,
    desc: 'A rapid fan of elastic punches that fills the space in front of Luffy.',
    stats: l => ({ cd: 1.8 - l * 0.1, dmg: 9 + l * 4, count: 3 + l, speed: 10.5, r: 6 + l * 0.25,
      pierce: 0, life: 0.92, spread: 0.16, knock: 7 }),
  },
  redhawk: {
    name: 'Gum-Gum Red Hawk', color: '#ff5b32', core: '#ffe59b', type: 'projectile', kind: 'redhawk', users: ['luffy'], crossover: true,
    desc: 'A blazing armored punch that bursts on impact.',
    stats: l => ({ cd: 4.1 - l * 0.24, dmg: 38 + l * 15, count: 1, speed: 8.6, r: 11 + l,
      pierce: 0, life: 1.5, spread: 0, explode: 54 + l * 11, knock: 18 }),
  },
  elephantgun: {
    name: 'Gum-Gum Elephant Gun', color: '#2c2430', core: '#d77d65', type: 'projectile', kind: 'elephantfist', users: ['luffy'], crossover: true,
    desc: 'An enormous hardened fist crushes everything in its path before exploding outward.',
    stats: l => ({ cd: 6.0 - l * 0.36, dmg: 62 + l * 23, count: 1, speed: 3.8, r: 20 + l * 1.8,
      pierce: 2, life: 3.1, spread: 0, explode: 68 + l * 12, knock: 24 }),
  },
  redroc: {
    name: 'Gum-Gum Red Roc', color: '#ff5b32', core: '#ffe59b', type: 'rush', users: ['luffy'], crossover: true,
    desc: 'Luffy coats his leg in armament haki and dives feet-first through the enemy line.',
    stats: l => ({ cd: 1.65 - l * 0.08, dmg: 17 + l * 6.5, count: 2 + Math.floor(l / 2), speed: 11.5, r: 16 + l * 0.6, knock: 12 }),
  },

  monarchdagger: {
    name: "Monarch's Dagger Rush", color: '#50cfff', core: '#f2fbff', type: 'rush', users: ['jinwoo'], crossover: true,
    desc: 'Jinwoo closes in with twin shadow daggers, cutting through anyone caught between him and his target.',
    stats: l => ({ cd: 1.25 - l * 0.065, dmg: 19 + l * 7.5, count: 2 + Math.floor(l / 2), speed: 12.4, r: 16 + l * 0.7, knock: 9 }),
  },
  rulersauthority: {
    name: "Ruler's Authority", color: '#8c63ff', type: 'nova', kind: 'rulersauthority', users: ['jinwoo'], crossover: true,
    desc: 'Crushes and throws every nearby enemy with invisible telekinetic force.',
    stats: l => ({ cd: 4.9 - l * 0.28, dmg: 36 + l * 14, radius: 105 + l * 13, count: 1, stun: 0.35 + l * 0.04 }),
  },
  shadowarmy: {
    name: 'Arise: Shadow Army', color: '#684cff', type: 'decoy', users: ['jinwoo'], shadowArmy: true, crossover: true,
    desc: 'Raises shadow soldiers that taunt the horde and erupt in Monarch energy.',
    stats: l => ({ cd: 7.4 - l * 0.42, dur: 4 + l * 0.22, count: 2 + Math.floor((l + 1) / 2),
      taunt: 220 + l * 20, dmg: 34 + l * 12, explode: 66 + l * 10 }),
  },
  shadowexchange: {
    name: 'Shadow Exchange', color: '#b06cff', core: '#f0deff', type: 'projectile', kind: 'shadowexchange', users: ['jinwoo'], crossover: true,
    desc: 'Vanishes into shadow and sends a high-speed Monarch slash through the battlefield.',
    stats: l => ({ cd: 5.4 - l * 0.31, dmg: 54 + l * 20, count: 1, speed: 15.5, r: 13 + l,
      pierce: 4 + l, life: 1.45, spread: 0, knock: 18, home: 2.4 }),
  },
});

const crossoverSprite = src => ({
  src, frameW: 48, frameH: 48, footY: 48, fps: 10, scale: 0.9,
  dirs: { side: 0, down: 1, up: 2 },
  anims: {
    idle: { row: 0, col: 0, count: 1 },
    walk: { row: 0, col: 1, count: 4 },
    cast: { row: 0, col: 5, count: 2 },
    punch: { row: 0, col: 5, count: 2 },
    kohit: { row: 0, col: 7, count: 1 },
    kolie: { row: 0, col: 8, count: 1 },
    koup: { row: 0, col: 9, count: 1 },
  },
});

Object.assign(SPRITE_OVERRIDES, {
  naruto: crossoverSprite('assets/sprites/naruto-crossover.svg'),
  'naruto:ssj': crossoverSprite('assets/sprites/naruto-kcm.svg'),
  luffy: crossoverSprite('assets/sprites/luffy-crossover.svg'),
  'luffy:ssj': crossoverSprite('assets/sprites/luffy-gear5.svg'),
  jinwoo: crossoverSprite('assets/sprites/jinwoo-crossover.svg'),
  'jinwoo:ssj': crossoverSprite('assets/sprites/jinwoo-monarch.svg'),
});

CHARACTERS.naruto = {
  name: 'Naruto', title: 'Hero of the Hidden Leaf',
  look: { id: 'naruto', style: 'goku', hair: '#f4c63a', skin: '#f2b98d', top: '#ed761d', pants: '#20263f',
    shirt: '#202638', belt: '#202638', boots: '#202638', wrist: '#202638' },
  aura: '#ff921f', transform: 'Sage Mode',
  hp: 108, speed: 2.9, start: 'rasengan', perk: 'Shadow clone decoy: the first hit each run is taken by a clone instead', xpBonus: 0.2, cloneSave: true,
  // Climbs one tier per transform (stat buffs apply now; sprite art for sage/baryon still uses the base
  // look until dedicated sheets are added - only Nine-Tails Chakra Mode has real art today, via naruto:ssj).
  forms: [
    { key: 'sage', name: 'Sage Mode', aura: '#ffb020' },
    { key: 'ssj', name: 'Nine-Tails Chakra Mode', aura: '#ff6a1f', ssjHair: '#ffe45c' },
    { key: 'baryon', name: 'Baryon Mode', aura: '#5ad1ff', ssjHair: '#eaf6ff', statMult: { dmg: 0.25 } },
  ],
};

CHARACTERS.luffy = {
  name: 'Luffy', title: 'Captain of the Straw Hat Pirates',
  look: { id: 'luffy', style: 'goku', hair: '#17151a', skin: '#efb483', top: '#c92d32', pants: '#245cb3',
    shirt: '#f2b43d', belt: '#f2b43d', boots: '#8a5b30', wrist: '#efb483' },
  aura: '#f7f4ff', transform: 'Gear Second',
  hp: 122, speed: 2.75, start: 'gumpistol', perk: 'Rubber body: 12% chance to dodge', dodge: 0.12,
  // Gear Second/Fourth reuse the base look (steam/armament-haki tint via aura only) until their own
  // sprite sheets exist; Gear Fifth already has real art (luffy:ssj -> luffy-gear5.svg).
  forms: [
    { key: 'gear2', name: 'Gear Second', aura: '#ff5c5c' },
    { key: 'gear4', name: 'Gear Fourth', aura: '#8a1f3d' },
    { key: 'ssj', name: 'Gear Fifth', aura: '#f7f4ff', ssjHair: '#fffaff', statMult: { dmg: 0.25 } },
  ],
};

CHARACTERS.jinwoo = {
  name: 'Sung Jinwoo', title: 'The Shadow Monarch',
  look: { id: 'jinwoo', style: 'vegeta', hair: '#10131d', skin: '#e8b38b', top: '#111722', pants: '#141927',
    shirt: '#77869b', belt: '#252d42', boots: '#080b13', wrist: '#4fcfff' },
  ssjHair: '#7868ff', aura: '#7654ff', transform: 'Shadow Monarch Awakening',
  hp: 114, speed: 3.05, start: 'monarchdagger', perk: "Arise: 12% chance a kill rises as a shadow soldier", dmgBonus: 0.15, shadowExtract: true,
};
