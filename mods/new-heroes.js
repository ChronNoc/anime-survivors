'use strict';

// Extra crossover pack: Killua, Asta, Beerus and Yoshiyuki Taira. Procedural look (no external
// sprite sheets needed - reuses the same pixel-art pipeline as the base DB cast) so these are
// playable immediately with no art dependency. Each gets its own moveset, a tiered transformation
// (see charForms/activeForm in game.js), and a locked "ultimate" technique only obtainable from the
// rare Ultimate Orb pickup (see G.pickups kind 'ultimate' in game.js).
//
// Note on Yoshiyuki Taira (Beck: Mongolian Chop Squad): this is a very minor character from an
// obscure series - his moveset below is an original, loose "rock musician" interpretation rather
// than a careful canon reproduction, since there isn't enough reliable reference to do otherwise.

Object.assign(ATTACKS, {
  // ── Killua Zoldyck ──────────────────────────────────────────────────────
  lightningneedle: {
    name: 'Lightning Needle', color: '#8ff2ff', core: '#eafffe', type: 'projectile', users: ['killua'], crossover: true,
    desc: 'A flick of Nen-charged needles, impossibly fast and precise.',
    stats: l => ({ cd: 1.1 - l * 0.06, dmg: 15 + l * 5, count: 2 + Math.floor(l / 2), speed: 13.5, r: 5 + l * 0.3,
      pierce: 1 + Math.floor(l / 2), life: 0.95, spread: 0.12, knock: 6 }),
  },
  thunderyoyo: {
    name: 'Thunder Yo-Yo', color: '#4fd2ff', core: '#eafffe', type: 'projectile', kind: 'disc', users: ['killua'], crossover: true,
    desc: 'A weighted yo-yo on a Nen thread, arcing back and forth through the crowd.',
    stats: l => ({ cd: 2.0 - l * 0.11, dmg: 24 + l * 9, count: 1, speed: 7.2, r: 9 + l * 0.6,
      pierce: 3 + l, life: 1.8, spread: 0, knock: 10 }),
  },
  electrocharge: {
    name: 'Electrodynamic Discharge', color: '#5cf2ff', type: 'nova', kind: 'rulersauthority', users: ['killua'], crossover: true,
    desc: 'Floods the ground around him with crackling current, stunning everyone caught in it.',
    stats: l => ({ cd: 4.6 - l * 0.25, dmg: 20 + l * 8, radius: 95 + l * 11, count: 1, stun: 0.3 + l * 0.04 }),
  },
  godspeedexecution: {
    name: 'Godspeed: Execution', color: '#eafffe', core: '#8ff2ff', type: 'decoy', users: ['killua'], shadowClone: true, crossover: true, ultimate: true,
    desc: 'Moves faster than the eye can track, striking every enemy on screen in one motion.',
    stats: () => ({ cd: 9, dur: 1.4, count: 3, taunt: 260, dmg: 60, explode: 95 }),
  },

  // ── Asta ─────────────────────────────────────────────────────────────────
  antimagicslash: {
    name: 'Anti-Magic Slash', color: '#f2f2f2', core: '#dff0ff', type: 'projectile', kind: 'spiral', users: ['asta'], crossover: true,
    desc: 'A wide sword swing that cuts clean through anything in its path.',
    stats: l => ({ cd: 1.3 - l * 0.07, dmg: 22 + l * 8, count: 1, speed: 9.6, r: 10 + l * 0.6,
      pierce: 99, life: 1.1, spread: 0, knock: 12 + l * 2 }),
  },
  demonsliverush: {
    name: 'Demon-Slayer Rush', color: '#e8e8e8', core: '#ffffff', type: 'projectile', users: ['asta'], crossover: true,
    desc: 'A flurry of short-range slashes thrown out in quick succession.',
    stats: l => ({ cd: 1.75 - l * 0.09, dmg: 10 + l * 4, count: 3 + l, speed: 10.2, r: 6 + l * 0.25,
      pierce: 0, life: 0.85, spread: 0.18, knock: 6 }),
  },
  blackdivider: {
    name: 'Black Divider', color: '#3a1a52', core: '#b878ff', type: 'projectile', kind: 'rasenshuriken', users: ['asta'], crossover: true,
    desc: 'A grounded, mana-nullifying shockwave that splits and detonates on impact.',
    stats: l => ({ cd: 5.4 - l * 0.31, dmg: 40 + l * 16, count: 1, speed: 4.6 + l * 0.15, r: 13 + l,
      pierce: 0, life: 2.6, spread: 0, explode: 62 + l * 11, home: 1.2 }),
  },
  devilunion: {
    name: 'Black Asta: Devil Union', color: '#8a0f2a', type: 'nova', users: ['asta'], crossover: true, ultimate: true,
    desc: 'Lets the demon take over for a moment - every nearby enemy is cut down at once.',
    stats: () => ({ cd: 9, dmg: 95, radius: 140, count: 1, stun: 0.5 }),
  },

  // ── Beerus ───────────────────────────────────────────────────────────────
  hakaiwave: {
    name: 'Hakai Wave', color: '#b06cff', core: '#f2e6ff', type: 'projectile', users: ['beerus'], crossover: true,
    desc: 'A lazy flick of destruction energy that erases what it touches.',
    stats: l => ({ cd: 1.5 - l * 0.08, dmg: 26 + l * 9, count: 1, speed: 9.0, r: 10 + l * 0.6,
      pierce: 2 + Math.floor(l / 2), life: 1.3, spread: 0, explode: 20 + l * 4, knock: 10 }),
  },
  godofdestructionpalm: {
    name: 'God of Destruction Palm', color: '#ff6cff', type: 'nova', users: ['beerus'], crossover: true,
    desc: 'A short, contemptuous shockwave from an open palm - small, but it hits like a planet.',
    stats: l => ({ cd: 3.6 - l * 0.2, dmg: 30 + l * 11, radius: 80 + l * 9, count: 1, stun: 0.2 + l * 0.03 }),
  },
  spheredestruction: {
    name: 'Sphere of Destruction', color: '#8c3fff', core: '#ffffff', type: 'projectile', kind: 'big', users: ['beerus'], crossover: true,
    desc: 'A dense ball of annihilation that drifts forward, consuming everything it meets.',
    stats: l => ({ cd: 6.2 - l * 0.35, dmg: 50 + l * 19, count: 1, speed: 3.6, r: 17 + l * 1.4,
      pierce: 99, life: 3.0, spread: 0, explode: 40 + l * 9 }),
  },
  completeannihilation: {
    name: 'Complete Annihilation', color: '#ff6cff', type: 'nova', users: ['beerus'], crossover: true, ultimate: true,
    desc: "A God of Destruction's true power, unleashed without restraint across the whole battlefield.",
    stats: () => ({ cd: 9, dmg: 100, radius: 160, count: 1, stun: 0.45 }),
  },

  // ── Yoshiyuki Taira (Beck) ───────────────────────────────────────────────
  soundwaveslash: {
    name: 'Sound Wave Slash', color: '#ff7a3d', core: '#ffe0b3', type: 'projectile', kind: 'spiral', users: ['taira'], crossover: true,
    desc: 'A cutting wall of sound thrown out in a single wide arc.',
    stats: l => ({ cd: 1.4 - l * 0.07, dmg: 20 + l * 7, count: 1, speed: 8.8, r: 10 + l * 0.6,
      pierce: 2 + Math.floor(l / 2), life: 1.15, spread: 0, knock: 10 }),
  },
  rockbeatbarrage: {
    name: 'Rock Beat Barrage', color: '#ffb02f', core: '#fff1c6', type: 'projectile', users: ['taira'], crossover: true,
    desc: 'A rapid-fire string of notes, each one landing like a punch.',
    stats: l => ({ cd: 1.85 - l * 0.1, dmg: 9 + l * 4, count: 3 + l, speed: 9.4, r: 6 + l * 0.2,
      pierce: 0, life: 0.9, spread: 0.2, knock: 6 }),
  },
  ampoverdrive: {
    name: 'Amp Overdrive', color: '#ffd93b', type: 'nova', users: ['taira'], crossover: true,
    desc: 'Cranks the amp past its limit, blasting everyone nearby off their feet.',
    stats: l => ({ cd: 4.2 - l * 0.22, dmg: 22 + l * 8, radius: 90 + l * 10, count: 1, stun: 0.3 + l * 0.04 }),
  },
  encorefinale: {
    name: 'Encore Finale', color: '#ffd93b', type: 'nova', users: ['taira'], crossover: true, ultimate: true,
    desc: 'One last song, played loud enough to level the crowd.',
    stats: () => ({ cd: 9, dmg: 85, radius: 150, count: 1, stun: 0.4 }),
  },
});

// AI-generated sprite sheets (sliced/cropped/background-keyed from the source art into a clean
// 3-row (side/down/up) grid of 64x64 cells, see dev notes). cols=4 -> idle,walk-a,walk-b,cast;
// cols=3 -> idle,walk,cast (only one walk frame available, so walking won't animate for those).
const newHeroSprite = (src, cols) => ({
  src, frameW: 64, frameH: 64, footY: 60, fps: 6, scale: 0.72,
  dirs: { side: 0, down: 1, up: 2 },
  anims: cols === 4 ? {
    idle: { row: 0, col: 0, count: 1 },
    walk: { row: 0, col: 1, count: 2 },
    cast: { row: 0, col: 3, count: 1 },
  } : {
    idle: { row: 0, col: 0, count: 1 },
    walk: { row: 0, col: 1, count: 1 },
    cast: { row: 0, col: 2, count: 1 },
  },
});
// Each transformed tier now has its own dedicated sheet (aura/colors drawn in, not just a palette
// swap of the base art) instead of reusing the base sprite like the first pass did. There's only one
// piece of transformed art per character (not one per tier), so both tiers share it - the tier's own
// aura color/name/stat bonus still differ, only the sprite art is shared between tier 1 and tier 2.
Object.assign(SPRITE_OVERRIDES, {
  killua: newHeroSprite('assets/sprites/killua-crossover.png', 4),
  'killua:godspeed': newHeroSprite('assets/sprites/killua-crossover-tf.png', 4),
  'killua:godspeedblitz': newHeroSprite('assets/sprites/killua-crossover-tf.png', 4),
  asta: newHeroSprite('assets/sprites/asta-crossover.png', 4),
  'asta:blackasta': newHeroSprite('assets/sprites/asta-crossover-tf.png', 4),
  'asta:devilform': newHeroSprite('assets/sprites/asta-crossover-tf.png', 4),
  beerus: newHeroSprite('assets/sprites/beerus-crossover.png', 4),
  'beerus:awakened': newHeroSprite('assets/sprites/beerus-crossover-tf.png', 4),
  'beerus:truegod': newHeroSprite('assets/sprites/beerus-crossover-tf.png', 4),
  taira: newHeroSprite('assets/sprites/taira-crossover.png', 4),
  'taira:overdrive': newHeroSprite('assets/sprites/taira-crossover-tf.png', 4),
  'taira:encore': newHeroSprite('assets/sprites/taira-crossover-tf.png', 4),
});

CHARACTERS.killua = {
  name: 'Killua Zoldyck', title: 'Ex-Assassin, Hunter-in-training',
  look: { id: 'killua', style: 'goku', hair: '#eef0f2', skin: '#f2cbaa', top: '#15171c', pants: '#2b1f3a',
    shirt: '#15171c', belt: '#2b1f3a', boots: '#15171c', wrist: '#eef0f2' },
  aura: '#8ff2ff', transform: 'Godspeed',
  hp: 102, speed: 3.2, start: 'lightningneedle', perk: 'Godspeed: dodges hit 14% of the time, and a dodge leaves him 60% faster for a moment', dodge: 0.14, dodgeBurst: true,
  forms: [
    { key: 'godspeed', name: 'Godspeed', aura: '#8ff2ff' },
    { key: 'godspeedblitz', name: 'Godspeed: Blitz', aura: '#4fd2ff', ssjHair: '#eaffff', statMult: { dmg: 0.2 } },
  ],
};

CHARACTERS.asta = {
  name: 'Asta', title: 'The Anti-Magic Swordsman',
  look: { id: 'asta', style: 'vegeta', hair: '#17151a', skin: '#e8b98a', top: '#f2f2f2', pants: '#1f2a44',
    shirt: '#f2f2f2', belt: '#5c4326', boots: '#5c4326', wrist: '#e8b98a' },
  aura: '#b878ff', transform: 'Black Asta',
  hp: 128, speed: 2.7, start: 'antimagicslash', perk: 'Anti-Magic: immune to petrify, candy and body-swap effects', dmgBonus: 0.08, statusImmune: true,
  forms: [
    { key: 'blackasta', name: 'Black Asta', aura: '#3a1a52', ssjHair: '#15101c' },
    { key: 'devilform', name: 'Full Devil Union', aura: '#8a0f2a', ssjHair: '#2a0810', statMult: { dmg: 0.25 } },
  ],
};

CHARACTERS.beerus = {
  name: 'Beerus', title: 'God of Destruction',
  look: { id: 'beerus', style: 'bald', hair: '#9a7ad1', skin: '#9a7ad1', top: '#3a1f5c', pants: '#2a1646',
    shirt: '#3a1f5c', belt: '#1f1033', boots: '#1f1033', wrist: '#9a7ad1', cape: '#3a1f5c', gem: '#ffd93b' },
  aura: '#b06cff', transform: 'Awakened Destroyer',
  hp: 118, speed: 2.9, start: 'hakaiwave', perk: 'God of Destruction: +18% damage, and ticks 6 damage/s to anything nearby', dmgBonus: 0.18, destructionAura: true,
  forms: [
    // transformSprite (not ssjHair - he's bald, nothing to recolor): just flags that this form has
    // its own look, so hasTransformLook() is true and the game actually swaps to the transformed art.
    { key: 'awakened', name: 'Awakened Destroyer', aura: '#b06cff', transformSprite: true },
    { key: 'truegod', name: 'God of Destruction: Unleashed', aura: '#ff6cff', transformSprite: true, statMult: { dmg: 0.3 } },
  ],
};

CHARACTERS.taira = {
  name: 'Yoshiyuki Taira', title: 'Rhythm Guitarist',
  look: { id: 'taira', style: 'goku', hair: '#4a3321', skin: '#e8b98a', top: '#2c2c34', pants: '#2a3f66',
    shirt: '#2c2c34', belt: '#1a1a20', boots: '#5c4326', wrist: '#e8b98a' },
  aura: '#ff7a3d', transform: 'Overdrive',
  hp: 112, speed: 2.85, start: 'soundwaveslash', perk: 'Stage presence: +15% experience, and drops a bass line that stuns nearby enemies every 8s', xpBonus: 0.15, bassDrop: true, sfxVoice: 'bass',
  forms: [
    { key: 'overdrive', name: 'Overdrive', aura: '#ff7a3d' },
    { key: 'encore', name: 'Encore', aura: '#ffd93b', ssjHair: '#ffe680', statMult: { dmg: 0.2 } },
  ],
};
